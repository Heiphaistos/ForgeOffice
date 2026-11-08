// Modification des points : noeuds et poignees de Bezier de la forme selectionnee, par-dessus la diapositive.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AutoShape } from '@forgeoffice/pptx';
import type { MenuItem } from '@forgeoffice/ui';
import type { Pt } from '../canvas/boolean-ops/clip.ts';
import { localSubPaths, toPage } from '../canvas/boolean-ops/merge.ts';
import { locate } from '../canvas/ops.ts';
import { flatten, nodeBounds, toGeometry, type SubPath } from '../canvas/path-edit/model.ts';
import { deleteNode, insertNode, moveHandle, moveNode, nearestOnPath, nodeKind, setClosed, setNodeKind, setSegmentKind, type HandleSide, type NodeKind } from '../canvas/path-edit/ops.ts';
import type { Editor } from './editor.ts';
import { S3 } from './strings-text.ts';

const P = S3.points;
const ACCENT = 'var(--fo-accent, #c43e1c)';

interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
}

interface Selection {
  si: number;
  ni: number;
}

type Drag =
  | { kind: 'node'; base: SubPath[]; si: number; ni: number; start: Pt }
  | { kind: 'handle'; base: SubPath[]; si: number; ni: number; side: HandleSide; nodeKind: NodeKind };

/** Page -> local (inverse de toPage). */
function toLocal(p: Pt, f: Frame): Pt {
  const a = (-(f.rotation ?? 0) * Math.PI) / 180;
  const dx = p.x - (f.x + f.width / 2);
  const dy = p.y - (f.y + f.height / 2);
  const rx = dx * Math.cos(a) - dy * Math.sin(a) + f.width / 2;
  const ry = dx * Math.sin(a) + dy * Math.cos(a) + f.height / 2;
  return { x: f.flipH ? f.width - rx : rx, y: f.flipV ? f.height - ry : ry };
}

export interface PointsOverlayProps {
  ed: Editor;
  shapeId: number;
  openMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, items: readonly MenuItem[]) => void;
  onExit: () => void;
}

export function PointsOverlay({ ed, shapeId, openMenu, onExit }: PointsOverlayProps) {
  const raw = locate(ed.pageShapes, shapeId)?.shape;
  const shape = raw?.kind === 'shape' ? (raw as AutoShape) : undefined;
  const frame: Frame | undefined = shape ? ed.ctx.resolve(shape).xfrm : undefined;
  const [selected, setSelected] = useState<Selection | null>(null);
  const [page, setPage] = useState<{ left: number; top: number; scale: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const subsRef = useRef<SubPath[]>([]);

  const measure = (): void => {
    const el = document.querySelector('.fo-canvas__page');
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPage((cur) => (cur && cur.left === r.left && cur.top === r.top && cur.scale === r.width / ed.deck.size.width ? cur : { left: r.left, top: r.top, scale: r.width / ed.deck.size.width }));
  };
  useLayoutEffect(measure);
  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  });

  const subs = shape && frame ? localSubPaths(shape, frame.width, frame.height, false) : [];
  subsRef.current = subs;
  const filled = !!shape && shape.geometry.type === 'custom' && shape.geometry.paths.some((p) => p.fill !== 'none');

  const write = (next: SubPath[]): void => {
    if (!frame) return;
    ed.editShapes((list) => {
      const found = locate(list, shapeId);
      if (found?.shape.kind === 'shape') found.shape.geometry = toGeometry(next, 0, 0, frame.width, frame.height, filled);
    }, 'edit-points');
  };

  /** Ajuste le cadre de la forme aux noeuds quand la forme n'est ni tournee ni miroitee (a la sortie). */
  const refit = (): void => {
    if (!frame || frame.rotation || frame.flipH || frame.flipV) return;
    const b = nodeBounds(subsRef.current);
    if (b.width < 0.5 || b.height < 0.5 || (Math.abs(b.x) < 0.01 && Math.abs(b.y) < 0.01 && Math.abs(b.width - frame.width) < 0.01 && Math.abs(b.height - frame.height) < 0.01)) return;
    const shifted = subsRef.current;
    ed.editShapes((list) => {
      const found = locate(list, shapeId);
      if (found?.shape.kind !== 'shape' || !found.shape.xfrm) return;
      found.shape.xfrm = { ...found.shape.xfrm, x: found.shape.xfrm.x + b.x, y: found.shape.xfrm.y + b.y, width: b.width, height: b.height };
      found.shape.geometry = toGeometry(shifted, b.x, b.y, b.width, b.height, filled);
    }, 'edit-points');
  };
  const exit = (): void => {
    refit();
    onExit();
  };

  const toScreen = (p: Pt): Pt => {
    if (!frame || !page) return p;
    const g = toPage(p, frame);
    return { x: page.left + g.x * page.scale, y: page.top + g.y * page.scale };
  };
  const localOf = (clientX: number, clientY: number): Pt => (frame && page ? toLocal({ x: (clientX - page.left) / page.scale, y: (clientY - page.top) / page.scale }, frame) : { x: 0, y: 0 });

  // Deplacement des noeuds et des poignees : calcule depuis le contour de depart, une seule etape d'annulation.
  useEffect(() => {
    const move = (e: PointerEvent): void => {
      const d = drag.current;
      if (!d) return;
      const p = localOf(e.clientX, e.clientY);
      if (d.kind === 'node') write(moveNode(d.base, d.si, d.ni, p.x - d.start.x, p.y - d.start.y));
      else write(moveHandle(d.base, d.si, d.ni, d.side, p, e.altKey ? 'corner' : d.nodeKind));
    };
    const up = (): void => {
      drag.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  });

  // Clavier : Suppr retire le point, Echap quitte ; un clic sur la diapositive hors de la forme quitte.
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exit();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        write(deleteNode(subsRef.current, selected.si, selected.ni));
        setSelected(null);
      }
    };
    const down = (e: PointerEvent): void => {
      const t = e.target as Element | null;
      if (t?.closest('[data-points-overlay]') || t?.closest('.fo-menu, [role=menu]')) return;
      if (t?.closest('.fo-canvas')) exit();
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', down, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('pointerdown', down, true);
    };
  });

  if (!shape || !frame || !page) return null;

  const startNode = (e: ReactPointerEvent, si: number, ni: number): void => {
    e.stopPropagation();
    setSelected({ si, ni });
    drag.current = { kind: 'node', base: subs, si, ni, start: localOf(e.clientX, e.clientY) };
  };
  const startHandle = (e: ReactPointerEvent, si: number, ni: number, side: HandleSide): void => {
    e.stopPropagation();
    const n = subs[si]?.nodes[ni];
    drag.current = { kind: 'handle', base: subs, si, ni, side, nodeKind: n ? nodeKind(n) : 'corner' };
  };
  const addNodeAt = (e: ReactPointerEvent): void => {
    e.stopPropagation();
    const near = nearestOnPath(subs, localOf(e.clientX, e.clientY));
    if (!near) return;
    write(insertNode(subs, near.si, near.seg, Math.min(0.95, Math.max(0.05, near.t))));
    setSelected({ si: near.si, ni: near.seg + 1 });
  };

  const nodeMenu = (si: number, ni: number): MenuItem[] => {
    const s = subs[si];
    const kind = s?.nodes[ni] ? nodeKind(s.nodes[ni] as never) : 'corner';
    const apply = (next: SubPath[]): (() => void) => () => write(next);
    return [
      { id: 'del', label: P.deleteNode, icon: 'delete', shortcut: 'Suppr', onClick: () => { write(deleteNode(subs, si, ni)); setSelected(null); } },
      { id: 's1', kind: 'separator' },
      { id: 'corner', label: P.corner, checked: kind === 'corner', onClick: apply(setNodeKind(subs, si, ni, 'corner')) },
      { id: 'smooth', label: P.smooth, checked: kind === 'smooth', onClick: apply(setNodeKind(subs, si, ni, 'smooth')) },
      { id: 'symmetric', label: P.symmetric, checked: kind === 'symmetric', onClick: apply(setNodeKind(subs, si, ni, 'symmetric')) },
      { id: 's2', kind: 'separator' },
      { id: 'closed', label: s?.closed ? P.openPath : P.closePath, disabled: !s || s.nodes.length < 3, onClick: apply(setClosed(subs, si, !s?.closed)) },
      { id: 'quit', label: P.quit, onClick: exit },
    ];
  };
  const segmentMenu = (e: ReactPointerEvent): MenuItem[] => {
    const near = nearestOnPath(subs, localOf(e.clientX, e.clientY));
    if (!near) return [{ id: 'quit', label: P.quit, onClick: exit }];
    const t = Math.min(0.95, Math.max(0.05, near.t));
    return [
      { id: 'add', label: P.addNode, onClick: () => write(insertNode(subs, near.si, near.seg, t)) },
      { id: 'line', label: P.straightSegment, onClick: () => write(setSegmentKind(subs, near.si, near.seg, 'line')) },
      { id: 'curve', label: P.curvedSegment, onClick: () => write(setSegmentKind(subs, near.si, near.seg, 'curve')) },
      { id: 's', kind: 'separator' },
      { id: 'quit', label: P.quit, onClick: exit },
    ];
  };

  const outline = subs.map((s) => flatten(s, 0.3).map(toScreen));
  const sel = selected ? subs[selected.si]?.nodes[selected.ni] : undefined;
  return (
    <svg data-points-overlay="" data-testid="points-overlay" style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 40 }} aria-label={P.label}>
      {outline.map((pts, i) => {
        const d = `M${pts.map((p) => `${p.x} ${p.y}`).join('L')}${subs[i]?.closed ? 'Z' : ''}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={ACCENT} strokeWidth={1} pointerEvents="none" />
            <path d={d} fill="none" stroke="transparent" strokeWidth={12} style={{ pointerEvents: 'stroke', cursor: 'copy' }} onPointerDown={addNodeAt} onContextMenu={(e) => { e.preventDefault(); openMenu(e, segmentMenu(e as unknown as ReactPointerEvent)); }} data-segment="" />
          </g>
        );
      })}
      {sel && selected && (['inH', 'outH'] as const).map((side) => {
        const h = sel[side];
        if (!h) return null;
        const a = toScreen(sel);
        const b = toScreen(h);
        return (
          <g key={side}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ACCENT} strokeWidth={1} pointerEvents="none" />
            <circle cx={b.x} cy={b.y} r={5} fill="#fff" stroke={ACCENT} strokeWidth={1.5} style={{ pointerEvents: 'all', cursor: 'move' }} data-handle={side} onPointerDown={(e) => startHandle(e, selected.si, selected.ni, side)} />
          </g>
        );
      })}
      {subs.flatMap((s, si) =>
        s.nodes.map((n, ni) => {
          const p = toScreen(n);
          const on = selected?.si === si && selected.ni === ni;
          return (
            <rect key={`${si}-${ni}`} x={p.x - 4.5} y={p.y - 4.5} width={9} height={9} fill={on ? ACCENT : '#fff'} stroke={ACCENT} strokeWidth={1.5} style={{ pointerEvents: 'all', cursor: 'move' }} data-node={`${si}:${ni}`} onPointerDown={(e) => startNode(e, si, ni)} onContextMenu={(e) => { e.preventDefault(); setSelected({ si, ni }); openMenu(e, nodeMenu(si, ni)); }} />
          );
        }),
      )}
    </svg>
  );
}
