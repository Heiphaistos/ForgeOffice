// Editeur de page interactif : selection (clic, Maj, lasso), deplacement (Ctrl = copie, Maj = axe), poignees de taille
// avec rotation, rotation, poignees d'ajustement, extremites de ligne et connecteurs, reperes intelligents, magnetisme,
// trace de formes, zones de texte et encre, edition du texte en place, zoom (Ctrl+molette), regles et reperes.
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type WheelEvent } from 'react';
import { useDeviceMode, useFontsEpoch } from '@forgeoffice/ui';
import type { Fill, GroupShape, Shape, TableShape, TextBody } from '@forgeoffice/pptx';
import { lineBox, lineEnds, nearestSite, rerouteConnectors } from './connectors.ts';
import type { PageContext } from './context.ts';
import { adjustFromPoint, buildGeometry, LINE_PRESETS } from './geometry/index.ts';
import {
  boundsOf, center, hitBox, rectContains, rectFromPoints, resizeBox, rotatePoint, rotationFromPoint, snapLineEnd, snapMove, snapPoint, toLocal, unionRects,
  handlePoint, type Box, type GuideLine, type HandleId, type Point, type Rect, type SnapTargets,
} from './math.ts';
import { boxOfXfrm, childToParent, deleteShapes, duplicateShapes, locate, moveShapes, pageBox, rotateShapes, setPageBox, xfrmOfBox } from './ops.ts';
import { handleCanvasKey, isTextCapable } from './keys.ts';
import { ObjectBar } from './ObjectBar.tsx';
import { Overlay, isLineShape, type OverlayItem } from './Overlay.tsx';
import { PageView, type PageLayer } from './PageView.tsx';
import { Ruler } from './Rulers.tsx';
import { endPos, shiftLevel, wordAt, type TextRange } from './text.ts';
import { posFromPoint } from './text-dom.ts';
import type { CanvasOptions, CanvasSelection, CanvasTool, CreateRequest, EditFn, TextTarget } from './types.ts';
import { useCanvasTouch } from './useCanvasTouch.ts';
import { useTextEditing } from './useTextEditing.ts';
import { S } from '../strings.ts';
import './canvas.css';

export interface CanvasEditorProps {
  /** Taille de la page en points. */
  width: number;
  height: number;
  background: Fill | undefined;
  ctx: PageContext;
  /** Formes modifiables de la page (modele courant). */
  shapes: Shape[];
  underlay?: readonly PageLayer[];
  uid: string;
  /** Zoom en % (100 % = 96 ppp). */
  zoom: number;
  onZoomChange?: (zoom: number) => void;
  selection: CanvasSelection;
  onSelectionChange: (selection: CanvasSelection) => void;
  onEdit: EditFn;
  tool?: CanvasTool;
  /** Fin d'un trace : l'hote cree la forme (puis la selectionne). */
  onCreate?: (request: CreateRequest) => void;
  options?: CanvasOptions;
  onContextMenu?: (e: MouseEvent, shapeId: number | null) => void;
  /** Double-clic sur une forme sans texte (image, graphique, media) : vrai si l'hote l'a traite. */
  onShapeDoubleClick?: (shapeId: number) => boolean;
  /** Lecture seule (pas de poignees ni de modification). */
  locked?: boolean;
  className?: string;
}

export interface EditorItem extends OverlayItem {
  raw: Shape;
  ancestors: GroupShape[];
}

/** Formes effectives a plat avec leur boite dans la page (enfants de groupe compris). */
export function editorItems(shapes: readonly Shape[], ctx: PageContext, ancestors: GroupShape[] = []): EditorItem[] {
  const out: EditorItem[] = [];
  for (const raw of shapes) {
    if (raw.hidden) continue;
    const shape = ancestors.length ? raw : ctx.resolve(raw);
    let box: Box | null = shape.xfrm ? boxOfXfrm(shape.xfrm) : null;
    for (const g of ancestors) if (box) box = childToParent(g, box);
    if (box) out.push({ id: raw.id, shape, raw, box, ancestors });
    if (raw.kind === 'group') out.push(...editorItems(raw.children, ctx, [raw, ...ancestors]));
  }
  return out;
}

const PX = 96 / 72;

type Drag =
  | { mode: 'pending'; start: Point; client: Point; hit: EditorItem | null; wasSelected: boolean; duplicate: boolean }
  | { mode: 'move'; start: Point; ids: number[]; boxes: Map<number, Box>; base: Shape[]; duplicate: boolean }
  | { mode: 'resize'; handle: HandleId; ids: number[]; boxes: Map<number, Box>; base: Shape[]; origin: Point }
  | { mode: 'rotate'; ids: number[]; boxes: Map<number, Box>; base: Shape[]; startAngle: number; target: Box }
  | { mode: 'adjust'; id: number; index: number; box: Box; base: Shape[]; shape: Shape }
  | { mode: 'lineEnd'; id: number; which: 'start' | 'end'; ends: [Point, Point]; base: Shape[] }
  | { mode: 'marquee'; start: Point; additive: boolean }
  | { mode: 'pan'; x: number; y: number; moved: boolean }
  | { mode: 'create'; start: Point }
  | { mode: 'ink' }
  | { mode: 'erase' }
  | { mode: 'guide'; axis: 'x' | 'y'; index: number };

export function CanvasEditor(props: CanvasEditorProps) {
  const { width, height, background, ctx, shapes, underlay, uid, zoom, onZoomChange, selection, onSelectionChange, onEdit, tool = { kind: 'select' }, onCreate, options = {}, onContextMenu, onShapeDoubleClick, locked, className } = props;
  const s = (zoom / 100) * PX;
  useFontsEpoch(); // l'ajustement de la forme au texte se refait quand les polices sont chargees
  const pageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const lastOp = useRef<{ op: (shapes: Shape[]) => void; group: string; select?: () => number[] } | null>(null);
  const pendingCaret = useRef<{ x: number; y: number; mode: 'caret' | 'word' | 'end' } | null>(null);
  const [preview, setPreview] = useState<Shape[] | null>(null);
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const [draftLine, setDraftLine] = useState<[Point, Point] | null>(null);
  const [ink, setInk] = useState<Point[] | null>(null);
  const [guideDrag, setGuideDrag] = useState<{ x: number[]; y: number[] } | null>(null);
  const device = useDeviceMode();
  // Tactile : deux doigts = zoom et defilement ; un doigt sur le fond = defilement ; la barre d'objets remplace le clic droit.
  const touch = useCanvasTouch({
    viewport: viewportRef, zoom, onZoomChange,
    cancelDrag: () => {
      drag.current = null;
      lastOp.current = null;
      setPreview(null);
      setGuides([]);
      setMarquee(null);
      setDraft(null);
      setDraftLine(null);
      setInk(null);
    },
  });

  const current = preview ?? shapes;
  const items = useMemo(() => editorItems(current, ctx), [current, ctx]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const selected = useMemo(() => selection.ids.map((id) => byId.get(id)).filter((i): i is EditorItem => !!i), [selection.ids, byId]);
  const guidesX = guideDrag?.x ?? options.guidesX ?? [];
  const guidesY = guideDrag?.y ?? options.guidesY ?? [];

  const apply = useCallback(
    (op: (draft: Shape[]) => void, group?: string) =>
      onEdit((draftShapes) => {
        op(draftShapes);
        rerouteConnectors(draftShapes, ctx.resolve);
      }, group),
    [onEdit, ctx],
  );

  /** Donne une position explicite aux formes qui heritent la leur (espaces reserves) avant de les deplacer. */
  const materialize = useCallback(
    (draftShapes: Shape[], ids: readonly number[]) => {
      for (const id of ids) {
        const found = locate(draftShapes, id);
        const item = byId.get(id);
        if (found && !found.shape.xfrm && item?.shape.xfrm) found.shape.xfrm = { ...item.shape.xfrm };
      }
    },
    [byId],
  );

  // ---- Edition du texte ----
  const textTarget = selection.text ?? null;
  const rawBody = useMemo(() => {
    if (!textTarget) return null;
    const found = locate(shapes, textTarget.shapeId);
    if (!found) return null;
    if (found.shape.kind === 'table' && textTarget.cell) return found.shape.table.rows[textTarget.cell.row]?.cells[textTarget.cell.col]?.text ?? null;
    return found.shape.kind === 'shape' ? (found.shape.text ?? null) : null;
  }, [shapes, textTarget]);

  const bodyOf = (shape: Shape, cell: TextTarget['cell']): TextBody | null => {
    if (shape.kind === 'table') return cell ? (shape.table.rows[cell.row]?.cells[cell.col]?.text ?? null) : null;
    if (shape.kind !== 'shape') return null;
    shape.text ??= { props: {}, paragraphs: [] };
    return shape.text;
  };

  const editText = useCallback(
    (fn: (body: TextBody, range: TextRange) => TextRange, group = 'typing') => {
      const t = selection.text;
      if (!t) return;
      let next = t.range;
      apply((draftShapes) => {
        const found = locate(draftShapes, t.shapeId);
        const body = found && bodyOf(found.shape, t.cell);
        if (body) next = fn(body, t.range);
      }, `${group}:${t.shapeId}`);
      onSelectionChange({ ...selection, text: { ...t, range: next } });
    },
    [apply, selection, onSelectionChange],
  );

  const exitText = useCallback(() => {
    const t = selection.text;
    onSelectionChange({ ids: t ? [t.shapeId] : selection.ids, text: null, cells: null });
    viewportRef.current?.focus({ preventScroll: true });
  }, [selection, onSelectionChange]);

  const onTab = useCallback(
    (shift: boolean): boolean => {
      const t = selection.text;
      if (!t) return false;
      const found = locate(shapes, t.shapeId);
      if (found?.shape.kind === 'table' && t.cell) {
        const table = (found.shape as TableShape).table;
        const cols = table.columns.length;
        let index = t.cell.row * cols + t.cell.col + (shift ? -1 : 1);
        if (index >= table.rows.length * cols) {
          apply((draftShapes) => {
            const f = locate(draftShapes, t.shapeId);
            if (f?.shape.kind !== 'table') return;
            const last = f.shape.table.rows[f.shape.table.rows.length - 1];
            if (last) f.shape.table.rows.push({ height: last.height, cells: last.cells.map(() => ({ text: { props: {}, paragraphs: [{ props: {}, runs: [] }] } })) });
            if (f.shape.xfrm && last) f.shape.xfrm = { ...f.shape.xfrm, height: f.shape.xfrm.height + last.height };
          }, 'table-row');
        }
        index = Math.max(0, index);
        const cell = { row: Math.floor(index / cols), col: index % cols };
        onSelectionChange({ ids: [t.shapeId], text: { shapeId: t.shapeId, cell, range: { start: { p: 0, o: 0 }, end: { p: 0, o: 0 } } }, cells: null });
        return true;
      }
      editText((body, range) => {
        shiftLevel(body, range, shift ? -1 : 1);
        return range;
      }, 'level');
      return true;
    },
    [selection, shapes, apply, editText, onSelectionChange],
  );

  const text = useTextEditing({
    target: locked ? null : textTarget,
    body: rawBody,
    edit: editText,
    setRange: (range) => selection.text && onSelectionChange({ ...selection, text: { ...selection.text, range } }),
    exit: exitText,
    onTab,
  });

  // Place le curseur au point clique une fois la zone de saisie affichee.
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    const root = text.flowRef.current;
    const t = selection.text;
    if (!caret || !root || !t) return;
    pendingCaret.current = null;
    const body = rawBody ?? { props: {}, paragraphs: [] };
    let range: TextRange;
    if (caret.mode === 'end') {
      const end = endPos(body);
      range = { start: end, end };
    } else {
      const pos = posFromPoint(root, caret.x, caret.y) ?? endPos(body);
      range = caret.mode === 'word' ? wordAt(body, pos) : { start: pos, end: pos };
    }
    onSelectionChange({ ...selection, text: { ...t, range } });
  });

  // Ajustement automatique de la forme au texte (zones de texte) pendant la saisie.
  useLayoutEffect(() => {
    const t = selection.text;
    const root = text.flowRef.current;
    if (!t || t.cell || !root) return;
    const item = byId.get(t.shapeId);
    if (!item || item.shape.kind !== 'shape' || item.shape.text?.props.autofit?.type !== 'shape') return;
    const props = item.shape.text.props;
    const insets = { left: 7.2, top: 3.6, right: 7.2, bottom: 3.6, ...(props.insets ?? {}) };
    const wanted = Math.ceil(root.scrollHeight + insets.top + insets.bottom);
    const wantedW = props.wrap === false ? Math.ceil(root.scrollWidth + insets.left + insets.right) : item.box.width;
    if (Math.abs(wanted - item.box.height) < 1 && Math.abs(wantedW - item.box.width) < 1) return;
    apply((draftShapes) => {
      materialize(draftShapes, [t.shapeId]);
      const found = locate(draftShapes, t.shapeId);
      if (found?.shape.xfrm) found.shape.xfrm = { ...found.shape.xfrm, height: wanted, width: wantedW };
    }, `typing:${t.shapeId}`);
  });

  const startEditing = (item: EditorItem, client: Point | null, mode: 'caret' | 'word' | 'end'): void => {
    if (locked || !isTextCapable(item.raw)) return;
    let cell: TextTarget['cell'];
    if (item.raw.kind === 'table') {
      const el = client ? document.elementFromPoint(client.x, client.y)?.closest('[data-cell]') : null;
      const [row, col] = (el?.getAttribute('data-cell') ?? '0:0').split(':').map(Number);
      cell = { row: row ?? 0, col: col ?? 0 };
    }
    pendingCaret.current = client ? { x: client.x, y: client.y, mode } : { x: 0, y: 0, mode: 'end' };
    onSelectionChange({ ids: [item.id], text: { shapeId: item.id, cell, range: { start: { p: 0, o: 0 }, end: { p: 0, o: 0 } } }, cells: null });
  };

  // ---- Outils ----
  const toPage = (clientX: number, clientY: number): Point => {
    const r = pageRef.current?.getBoundingClientRect();
    return r ? { x: (clientX - r.left) / s, y: (clientY - r.top) / s } : { x: 0, y: 0 };
  };

  const entered = useMemo(() => {
    const set = new Set<number>();
    for (const item of selected) {
      if (item.raw.kind === 'group') set.add(item.id);
      for (const g of item.ancestors) set.add(g.id);
    }
    return set;
  }, [selected]);

  const hitTest = (p: Point): EditorItem | null => {
    const tolerance = 5 / s;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i] as EditorItem;
      if (item.raw.kind === 'group' && item.ancestors.length === 0 && entered.has(item.id)) continue;
      if (item.ancestors.some((g) => !entered.has(g.id))) continue;
      if (item.ancestors.length && !entered.has((item.ancestors[0] as GroupShape).id)) continue;
      if (isLineShape(item.shape)) {
        const [a, b] = lineEnds(item.box);
        if (distanceToSegment(p, a, b) <= tolerance) return item;
        continue;
      }
      if (hitBox(item.box, p, tolerance / 2)) return item;
    }
    return null;
  };

  const snapTargets = (exclude: ReadonlySet<number>): SnapTargets => ({
    shapes: options.smartGuides === false ? [] : items.filter((i) => i.ancestors.length === 0 && !exclude.has(i.id)).map((i) => boundsOf(i.box)),
    page: { width, height },
    guidesX,
    guidesY,
    grid: options.snapToGrid ? (options.grid ?? 14.17) : undefined,
  });

  const runPreview = (base: Shape[], op: (draftShapes: Shape[]) => void, group: string, select?: () => number[]): void => {
    const draftShapes = structuredClone(base);
    op(draftShapes);
    rerouteConnectors(draftShapes, ctx.resolve);
    setPreview(draftShapes);
    lastOp.current = { op, group, select };
  };

  const finish = (): void => {
    const last = lastOp.current;
    lastOp.current = null;
    setPreview(null);
    setGuides([]);
    if (!last) return;
    let created: number[] | null = null;
    apply((draftShapes) => {
      last.op(draftShapes);
      if (last.select) created = last.select();
    }, last.group);
    if (created) onSelectionChange({ ids: created, text: null, cells: null });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 || touch.down(e)) return;
    const p = toPage(e.clientX, e.clientY);
    viewportRef.current?.focus({ preventScroll: true });
    const target = e.target as Element;
    const guide = target.closest('[data-guide]')?.getAttribute('data-guide');
    if (guide && !locked) {
      const [axis, index] = guide.split(':');
      drag.current = { mode: 'guide', axis: axis === 'x' ? 'x' : 'y', index: Number(index) };
      setGuideDrag({ x: [...guidesX], y: [...guidesY] });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (tool.kind !== 'select' && !locked) {
      e.currentTarget.setPointerCapture(e.pointerId);
      if (tool.kind === 'ink') {
        drag.current = { mode: 'ink' };
        setInk([p]);
      } else if (tool.kind === 'eraser') {
        drag.current = { mode: 'erase' };
        erase(p);
      } else drag.current = { mode: 'create', start: p };
      return;
    }
    if (selection.text) onSelectionChange({ ids: selection.ids, text: null, cells: null });
    const handle = target.closest('[data-handle]')?.getAttribute('data-handle');
    if (handle && !locked) {
      e.currentTarget.setPointerCapture(e.pointerId);
      startHandle(handle, p);
      return;
    }
    const hit = hitTest(p);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (hit) {
      const isSel = selection.ids.includes(hit.id);
      if (e.shiftKey) {
        onSelectionChange({ ids: isSel ? selection.ids.filter((id) => id !== hit.id) : [...selection.ids.filter((id) => !hit.ancestors.some((g) => g.id === id)), hit.id], text: null });
        drag.current = null;
        return;
      }
      if (!isSel && !(e.ctrlKey && selection.ids.length)) onSelectionChange({ ids: [hit.id], text: null, cells: null });
      else if (!isSel && e.ctrlKey) onSelectionChange({ ids: [...selection.ids, hit.id], text: null, cells: null });
      drag.current = { mode: 'pending', start: p, client: { x: e.clientX, y: e.clientY }, hit, wasSelected: isSel, duplicate: e.ctrlKey };
      return;
    }
    if (e.pointerType === 'touch') {
      drag.current = { mode: 'pan', x: e.clientX, y: e.clientY, moved: false };
      return;
    }
    drag.current = { mode: 'marquee', start: p, additive: e.shiftKey };
    if (!e.shiftKey && selection.ids.length) onSelectionChange({ ids: [], text: null, cells: null });
  };

  const startHandle = (handle: string, p: Point): void => {
    const [kind = '', idText = ''] = handle.split(':');
    const id = Number(idText);
    const item = byId.get(id);
    if (!item) return;
    const base = structuredClone(shapes);
    const boxes = new Map(selected.map((i) => [i.id, i.box]));
    const ids = selection.ids.includes(id) ? selection.ids : [id];
    if (kind === 'rot') drag.current = { mode: 'rotate', ids, boxes, base, startAngle: rotationFromPoint(item.box, p), target: item.box };
    else if (kind.startsWith('adj')) drag.current = { mode: 'adjust', id, index: Number(kind.slice(3)), box: item.box, base, shape: item.shape };
    else if (kind === 'start' || kind === 'end') drag.current = { mode: 'lineEnd', id, which: kind, ends: lineEnds(item.box), base };
    else drag.current = { mode: 'resize', handle: kind as HandleId, ids: [id, ...ids.filter((x) => x !== id)], boxes, base, origin: handlePoint(item.box, kind as HandleId) };
  };

  const erase = (p: Point): void => {
    const hit = hitTest(p);
    if (hit && hit.raw.name.startsWith(S.canvas.inkName)) apply((draftShapes) => deleteShapes(draftShapes, [hit.id]), 'erase');
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (touch.move(e)) return;
    const d = drag.current;
    if (!d) return;
    let p = toPage(e.clientX, e.clientY);
    const threshold = 6 / s;
    switch (d.mode) {
      case 'pan': {
        const view = viewportRef.current;
        if (view) {
          view.scrollLeft -= e.clientX - d.x;
          view.scrollTop -= e.clientY - d.y;
        }
        d.moved = d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 3;
        d.x = e.clientX;
        d.y = e.clientY;
        return;
      }
      case 'pending': {
        if (Math.hypot(e.clientX - d.client.x, e.clientY - d.client.y) < 4 || locked) return;
        const ids = d.hit && !selection.ids.includes(d.hit.id) ? [...(d.duplicate ? selection.ids : []), d.hit.id] : selection.ids;
        const movable = ids.filter((id) => !byId.get(id)?.raw.locks?.noMove);
        drag.current = { mode: 'move', start: d.start, ids: movable, boxes: new Map(movable.map((id) => [id, byId.get(id)?.box as Box])), base: structuredClone(shapes), duplicate: d.duplicate };
        onPointerMove(e);
        return;
      }
      case 'move': {
        let dx = p.x - d.start.x;
        let dy = p.y - d.start.y;
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }
        const union = unionRects([...d.boxes.values()].map(boundsOf));
        let found: GuideLine[] = [];
        if (union && !e.altKey) {
          const snap = snapMove({ ...union, x: union.x + dx, y: union.y + dy }, snapTargets(new Set(d.ids)), threshold);
          dx += e.shiftKey && dx === 0 ? 0 : snap.dx;
          dy += e.shiftKey && dy === 0 ? 0 : snap.dy;
          found = snap.guides;
        }
        setGuides(found);
        const ids = d.ids;
        if (d.duplicate) {
          let created: number[] = [];
          runPreview(
            d.base,
            (draftShapes) => {
              materialize(draftShapes, ids);
              created = duplicateShapes(draftShapes, ids, { x: 0, y: 0 });
              moveShapes(draftShapes, created, dx, dy);
            },
            'duplicate',
            () => created,
          );
        } else {
          runPreview(d.base, (draftShapes) => {
            materialize(draftShapes, ids);
            moveShapes(draftShapes, ids, dx, dy);
          }, 'move');
        }
        return;
      }
      case 'resize': {
        const first = d.ids[0] as number;
        const firstBox = d.boxes.get(first) ?? byId.get(first)?.box;
        if (!firstBox) return;
        if (!firstBox.rotation && !e.altKey) {
          const snap = snapPoint(p, snapTargets(new Set(d.ids)), threshold);
          p = snap.point;
          setGuides(snap.guides);
        }
        const delta = { x: p.x - d.origin.x, y: p.y - d.origin.y };
        const lockAspect = (id: number): boolean => {
          const raw = byId.get(id)?.raw;
          return !!raw && (raw.kind === 'picture' || !!raw.locks?.noChangeAspect) && d.handle.length === 2;
        };
        runPreview(d.base, (draftShapes) => {
          materialize(draftShapes, d.ids);
          for (const id of d.ids) {
            const box = d.boxes.get(id) ?? byId.get(id)?.box;
            const found = locate(draftShapes, id);
            if (!box || !found) continue;
            const origin = handlePoint(box, d.handle);
            const next = resizeBox(box, d.handle, { x: origin.x + delta.x, y: origin.y + delta.y }, { keepAspect: e.shiftKey !== lockAspect(id), fromCenter: e.ctrlKey, minSize: 1 });
            setPageBox(found, next);
          }
        }, 'resize');
        return;
      }
      case 'rotate': {
        const angle = rotationFromPoint(d.target, p, e.shiftKey ? 15 : 0);
        const delta = angle - (d.target.rotation ?? 0);
        runPreview(d.base, (draftShapes) => {
          materialize(draftShapes, d.ids);
          rotateShapes(draftShapes, d.ids, delta);
        }, 'rotate');
        return;
      }
      case 'adjust': {
        const local = toLocal(d.box, p);
        const lx = d.box.flipH ? d.box.width - local.x : local.x;
        const ly = d.box.flipV ? d.box.height - local.y : local.y;
        const shape = d.shape;
        if (!('geometry' in shape)) return;
        const adjust = adjustFromPoint(shape.geometry, d.box.width, d.box.height, d.index, lx, ly);
        runPreview(d.base, (draftShapes) => {
          const found = locate(draftShapes, d.id);
          if (found && 'geometry' in found.shape && found.shape.geometry.type === 'preset') found.shape.geometry = { ...found.shape.geometry, adjust };
        }, 'adjust');
        return;
      }
      case 'lineEnd': {
        const fixed = d.which === 'start' ? d.ends[1] : d.ends[0];
        let point = e.shiftKey ? snapLineEnd(fixed, p) : p;
        const site = nearestSite(current, point, 8 / s, d.id);
        if (site) point = site.point;
        else if (!e.shiftKey && !e.altKey) point = snapPoint(point, snapTargets(new Set([d.id])), threshold).point;
        const box = d.which === 'start' ? lineBox(point, fixed) : lineBox(fixed, point);
        runPreview(d.base, (draftShapes) => {
          const found = locate(draftShapes, d.id);
          if (!found) return;
          setPageBox(found, box);
          if (found.shape.kind === 'connector') {
            if (site) found.shape[d.which] = { shapeId: site.shapeId, site: site.site };
            else delete found.shape[d.which];
          }
        }, 'line');
        return;
      }
      case 'marquee':
        setMarquee(rectFromPoints(d.start, p));
        return;
      case 'create': {
        if (tool.kind === 'shape' && LINE_PRESETS.has(tool.preset)) {
          let end = e.shiftKey ? snapLineEnd(d.start, p) : p;
          const site = nearestSite(current, end, 8 / s, -1);
          if (site) end = site.point;
          setDraftLine([d.start, end]);
        } else {
          let r = rectFromPoints(d.start, p);
          if (e.shiftKey) {
            const side = Math.max(r.width, r.height);
            r = { x: p.x < d.start.x ? d.start.x - side : d.start.x, y: p.y < d.start.y ? d.start.y - side : d.start.y, width: side, height: side };
          }
          if (e.ctrlKey) r = { x: d.start.x - Math.abs(p.x - d.start.x), y: d.start.y - Math.abs(p.y - d.start.y), width: Math.abs(p.x - d.start.x) * 2, height: Math.abs(p.y - d.start.y) * 2 };
          setDraft(r);
        }
        return;
      }
      case 'ink':
        setInk((pts) => {
          const last = pts?.[pts.length - 1];
          return last && Math.hypot(last.x - p.x, last.y - p.y) < 0.6 / (s / PX) ? pts : [...(pts ?? []), p];
        });
        return;
      case 'erase':
        erase(p);
        return;
      case 'guide': {
        const value = d.axis === 'x' ? p.x : p.y;
        const size = d.axis === 'x' ? width : height;
        const snapped = Math.abs(value - size / 2) < threshold ? size / 2 : Math.round(value * 10) / 10;
        setGuideDrag((g) => {
          if (!g) return g;
          const list = [...g[d.axis]];
          list[d.index] = snapped;
          return { ...g, [d.axis]: list };
        });
        return;
      }
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    if (touch.up(e)) {
      drag.current = null;
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const p = toPage(e.clientX, e.clientY);
    switch (d.mode) {
      case 'pan':
        if (!d.moved && selection.ids.length) onSelectionChange({ ids: [], text: null, cells: null });
        return;
      case 'pending': {
        const hit = d.hit;
        if (!hit || locked) return;
        if (e.pointerType === 'touch' && touch.isDoubleTap(e)) {
          doubleAt(e.clientX, e.clientY);
          return;
        }
        const textual = hit.raw.kind === 'shape' && (hit.raw.textBox || hit.raw.placeholder) && isTextCapable(hit.raw);
        if ((d.wasSelected && isTextCapable(hit.raw) && !e.ctrlKey) || textual) startEditing(hit, { x: e.clientX, y: e.clientY }, 'caret');
        return;
      }
      case 'marquee': {
        setMarquee(null);
        const rect = rectFromPoints(d.start, p);
        if (rect.width < 1 && rect.height < 1) return;
        const inside = items.filter((i) => i.ancestors.length === 0 && rectContains(rect, boundsOf(i.box))).map((i) => i.id);
        onSelectionChange({ ids: d.additive ? [...new Set([...selection.ids, ...inside])] : inside, text: null, cells: null });
        return;
      }
      case 'create': {
        const clicked = Math.hypot(p.x - d.start.x, p.y - d.start.y) * s < 4;
        if (tool.kind === 'shape') {
          if (LINE_PRESETS.has(tool.preset)) {
            const [a, b] = draftLine ?? [d.start, clicked ? { x: d.start.x + 144, y: d.start.y } : p];
            const start = nearestSite(current, a, 8 / s, -1);
            const end = nearestSite(current, b, 8 / s, -1);
            onCreate?.({ kind: 'shape', preset: tool.preset, box: lineBox(a, b), start: start ? { shapeId: start.shapeId, site: start.site } : undefined, end: end ? { shapeId: end.shapeId, site: end.site } : undefined, clicked });
          } else {
            const box = clicked || !draft ? { x: d.start.x - 36, y: d.start.y - 36, width: 72, height: 72 } : draft;
            onCreate?.({ kind: 'shape', preset: tool.preset, box, clicked });
          }
        } else if (tool.kind === 'textbox') {
          onCreate?.({ kind: 'textbox', box: clicked || !draft ? { x: d.start.x, y: d.start.y, width: 0, height: 0 } : draft, vertical: tool.vertical, clicked });
        } else if (tool.kind === 'place') {
          onCreate?.({ kind: 'place', what: tool.what, box: clicked || !draft ? { x: d.start.x, y: d.start.y, width: 0, height: 0 } : draft, clicked });
        }
        setDraft(null);
        setDraftLine(null);
        return;
      }
      case 'ink': {
        const points = ink ?? [];
        setInk(null);
        if (tool.kind === 'ink' && points.length > 1) onCreate?.({ kind: 'ink', points, color: tool.color, width: tool.width, highlighter: tool.highlighter });
        return;
      }
      case 'guide': {
        const g = guideDrag;
        setGuideDrag(null);
        if (!g || !options.onGuidesChange) return;
        const outside = d.axis === 'x' ? p.x < -20 / s || p.x > width + 20 / s : p.y < -20 / s || p.y > height + 20 / s;
        const list = [...g[d.axis]];
        if (outside) list.splice(d.index, 1);
        options.onGuidesChange({ ...g, [d.axis]: list });
        return;
      }
      case 'erase':
        return;
      default:
        finish();
    }
  };

  const doubleAt = (clientX: number, clientY: number): void => {
    if (tool.kind !== 'select' || locked) return;
    const p = toPage(clientX, clientY);
    const all = items.filter((i) => hitBox(i.box, p, 2 / s));
    const hit = hitTest(p) ?? all[all.length - 1] ?? null;
    if (!hit) return;
    if (hit.raw.kind === 'group') {
      const child = [...all].reverse().find((i) => i.ancestors.some((g) => g.id === hit.id));
      if (child) {
        if (isTextCapable(child.raw)) startEditing(child, { x: clientX, y: clientY }, 'word');
        else onSelectionChange({ ids: [child.id], text: null });
      }
      return;
    }
    if (isTextCapable(hit.raw)) startEditing(hit, { x: clientX, y: clientY }, 'word');
    else onShapeDoubleClick?.(hit.id);
  };

  const onDoubleClick = (e: MouseEvent<HTMLDivElement>): void => doubleAt(e.clientX, e.clientY);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (selection.text || locked || e.target !== viewportRef.current) return;
    handleCanvasKey(e, { ids: selection.ids, items, byId, apply, materialize, onSelectionChange, startEditing, bodyOf, pendingCaret });
  };

  const onWheel = (e: WheelEvent<HTMLDivElement>): void => {
    if (!(e.ctrlKey || e.metaKey) || !onZoomChange) return;
    e.preventDefault();
    onZoomChange(Math.max(10, Math.min(400, Math.round(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))));
  };

  const onContext = (e: MouseEvent<HTMLDivElement>): void => {
    if (!onContextMenu) return;
    e.preventDefault();
    if (selection.text) {
      onContextMenu(e, selection.text.shapeId);
      return;
    }
    const hit = hitTest(toPage(e.clientX, e.clientY));
    if (hit && !selection.ids.includes(hit.id)) onSelectionChange({ ids: [hit.id], text: null });
    onContextMenu(e, hit?.id ?? null);
  };

  const editingItem = selection.text ? byId.get(selection.text.shapeId) : undefined;
  const overlayItems = selected.map((i) => ({ id: i.id, shape: i.shape, box: i.box }));
  const gridStep = options.grid ? options.grid * s : 0;
  const cursor = tool.kind === 'select' ? undefined : tool.kind === 'eraser' ? 'cell' : 'crosshair';

  return (
    <div
      ref={viewportRef}
      className={`fo-canvas${className ? ` ${className}` : ''}${options.rulers ? ' has-rulers' : ''}`}
      tabIndex={0}
      aria-label={S.canvas.label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      onContextMenu={onContext}
      style={{ cursor }}
    >
      <div className="fo-canvas__stage">
        <div className="fo-canvas__page" ref={pageRef} style={{ width: width * s, height: height * s }}>
          <PageView
            width={width}
            height={height}
            background={background}
            ctx={ctx}
            shapes={current}
            underlay={underlay}
            uid={uid}
            scale={s}
            style={{ overflow: 'visible', boxShadow: '0 0 0 1px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.18)' }}
            editing={editingItem && selection.text ? { shapeId: editingItem.id, text: { cell: selection.text.cell, flowProps: text.flowProps, flowRef: text.flowRef, flowKey: text.flowKey } } : undefined}
            selectedCells={selection.cells ?? null}
          />
          {gridStep > 3 && <div className="fo-canvas__grid" style={{ backgroundSize: `${gridStep}px ${gridStep}px` }} />}
          <Overlay
            scale={s}
            items={overlayItems}
            editingId={editingItem?.id ?? null}
            guides={guides}
            marquee={marquee}
            guidesX={guidesX}
            guidesY={guidesY}
            page={{ width, height }}
            draft={draft}
            draftLine={draftLine}
            ink={ink}
            inkStyle={tool.kind === 'ink' ? tool : undefined}
            locked={locked}
          />
          {device.form !== 'desktop' && !selection.text && !locked && !preview && tool.kind === 'select' && selected.length > 0 && onContextMenu && (
            <ObjectBar boxes={selected.map((i) => i.box)} ids={selection.ids} scale={s} pageHeight={height * s} apply={apply} onSelectionChange={onSelectionChange} onMenu={onContextMenu} />
          )}
          {options.rulers && (
            <>
              <div className="fo-canvas__ruler-h">
                <Ruler orientation="h" length={width} scale={s} offset={0} />
              </div>
              <div className="fo-canvas__ruler-v">
                <Ruler orientation="v" length={height} scale={s} offset={0} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Centre de la page visible (pour inserer au centre). */
export function pageCenter(width: number, height: number): Point {
  return center({ x: 0, y: 0, width, height });
}

export { rotatePoint, pageBox, xfrmOfBox, buildGeometry };
