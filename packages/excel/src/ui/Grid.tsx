// Grille virtualisee sur canvas : defilement (molette, barres, glisser), selection a la souris (Maj, Ctrl,
// lignes/colonnes), poignee de recopie, redimensionnement des en-tetes, mode Pointer pendant la saisie d'une formule.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { MAX_COLS, MAX_ROWS, type CellRange, type Sheet } from '@forgeoffice/xlsx';
import { axisPos, axisSize, colAxis, rowAxis, type Axis } from '../logic/geometry.ts';
import { activeRange, addCell, cellSelection, extendTo, norm, selectAll, selectCols, selectRows, type Selection } from '../logic/selection.ts';
import { colAt, colX, layout, rowAt, rowHeaderWidth, rowY, scrollToShow, type Viewport } from '../logic/viewport.ts';
import { paintGrid, type Palette, type PaintSource } from './paint.ts';
import { Icon, type GridMode } from '@forgeoffice/ui';
import { selectionHandles, type HandleId } from '../logic/touch.ts';
import { useGridTouch } from './useGridTouch.ts';
import { S } from '../strings/index.ts';

export type ContextArea = 'cell' | 'row' | 'col' | 'corner';

export interface GridProps {
  sheet: Sheet;
  zoom: number;
  sel: Selection;
  onSelect: (sel: Selection) => void;
  source: Omit<PaintSource, 'palette' | 'dash' | 'sel' | 'fillTarget' | 'sheet'>;
  /** Saisie d'une formule : un clic insere une reference au lieu de deplacer la selection. */
  pointing: boolean;
  onPoint: (range: CellRange) => void;
  onEdit: (row: number, col: number) => void;
  onFill: (src: CellRange, target: CellRange, copyOnly: boolean) => void;
  onResize: (axis: 'row' | 'col', first: number, last: number, px: number | 'auto') => void;
  onContext: (e: { clientX: number; clientY: number }, area: ContextArea) => void;
  onFilterButton: (row: number, col: number, anchor: { x: number; y: number }) => void;
  onZoom: (zoom: number) => void;
  onHover: (cell: { row: number; col: number; x: number; y: number } | null) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  /** Elements superposes (editeur, graphiques, images) positionnes avec la fenetre courante. */
  overlay: (v: Viewport) => ReactNode;
  onViewport?: (v: Viewport) => void;
  gridRef?: (el: HTMLDivElement | null) => void;
}

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

type Drag =
  | { kind: 'select'; add: boolean }
  | { kind: 'rows' | 'cols'; from: number; add: boolean }
  | { kind: 'fill'; src: CellRange; target: CellRange | null }
  | { kind: 'resize'; axis: 'row' | 'col'; index: number; start: number; size: number; first: number; last: number }
  | { kind: 'point'; anchor: { row: number; col: number } }
  | { kind: 'thumb'; axis: 'x' | 'y'; start: number; scroll: number; ratio: number };

const BAR = 14;

export function Grid(p: GridProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [fillTarget, setFillTarget] = useState<CellRange | null>(null);
  const [dash, setDash] = useState(0);
  const [cursor, setCursor] = useState('cell');
  // Tactile : un doigt defile (mode Defilement) ou selectionne (mode Selection) ; poignees de selection et de recopie au doigt.
  const [mode, setMode] = useState<GridMode>('scroll');
  const grab = useRef<{ dx: number; dy: number; ix: number; iy: number; cx: number; cy: number } | null>(null);
  const rows: Axis = useMemo(() => rowAxis(p.sheet), [p.sheet.rows, p.sheet.defaultRowHeight]);
  const cols: Axis = useMemo(() => colAxis(p.sheet), [p.sheet.cols, p.sheet.defaultColWidth]);
  const zoom = p.zoom;
  const showHeaders = p.source.showHeaders;
  const frozen = p.sheet.view.frozen ?? { rows: 0, cols: 0 };

  const view = useMemo((): Viewport => {
    const headerH = showHeaders ? Math.round(20 * zoom) : 0;
    const base = { rows, cols, zoom, width: size.w - BAR, height: size.h - BAR, headerH, headerW: 0, frozenRows: frozen.rows, frozenCols: frozen.cols, scrollX: scroll.x, scrollY: scroll.y };
    const lastRow = Math.min(MAX_ROWS - 1, rowAt({ ...base, headerW: 40 }, base.height));
    return { ...base, headerW: showHeaders ? rowHeaderWidth(Math.max(lastRow, 99), zoom) : 0 };
  }, [rows, cols, zoom, size, scroll, frozen.rows, frozen.cols, showHeaders]);

  useEffect(() => p.onViewport?.(view), [view, p.onViewport]);

  // Taille du canvas
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Fourmis du presse-papiers
  useEffect(() => {
    if (!p.source.copyRange) return;
    const t = window.setInterval(() => setDash((d) => (d + 1) % 14), 90);
    return () => window.clearInterval(t);
  }, [p.source.copyRange]);

  // La cellule active reste visible.
  const active = p.sel.active;
  useEffect(() => {
    const next = scrollToShow(view, active.row, active.col);
    if (next && !drag) setScroll({ x: next.scrollX, y: next.scrollY });
    // view volontairement absent : seul un changement de cellule active fait defiler
  }, [active.row, active.col]);

  // Ctrl+Retour arriere (evenement envoye par App) : defilement jusqu'a la cellule active, meme sans changement de cellule.
  const reveal = useRef(() => undefined as void);
  reveal.current = () => {
    const next = scrollToShow(view, active.row, active.col);
    if (next) setScroll({ x: next.scrollX, y: next.scrollY });
  };
  useEffect(() => {
    const el = host.current;
    const on = (): void => reveal.current();
    el?.addEventListener('xl:reveal', on);
    return () => el?.removeEventListener('xl:reveal', on);
  }, []);

  // Dessin
  useEffect(() => {
    const c = canvas.current;
    const el = host.current;
    if (!c || !el) return;
    const dpr = window.devicePixelRatio || 1;
    const w = view.width;
    const h = view.height;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const palette: Palette = {
      canvas: '#FFFFFF',
      grid: p.sheet.view.gridColor?.rgb ? `#${p.sheet.view.gridColor.rgb.slice(-6)}` : '#E1E1E1',
      header: cssVar(el, '--xl-header', '#F5F5F5'),
      headerText: cssVar(el, '--xl-header-text', '#424242'),
      headerLine: cssVar(el, '--xl-header-line', '#D4D4D4'),
      headerSel: cssVar(el, '--xl-header-sel', '#D3F0E0'),
      headerSelText: cssVar(el, '--xl-header-sel-text', '#0E5C2F'),
      headerFull: cssVar(el, '--xl-accent', '#107C41'),
      accent: cssVar(el, '--xl-accent', '#107C41'),
      selFill: 'rgba(16, 124, 65, 0.10)',
    };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = layout(view);
    paintGrid(ctx, view, L, { ...p.source, sheet: p.sheet, sel: p.sel, palette, dash, fillTarget });
  });

  const cellFrom = useCallback((x: number, y: number): { row: number; col: number } => ({
    row: Math.max(0, rowAt(view, Math.max(view.headerH, y))),
    col: Math.max(0, colAt(view, Math.max(view.headerW, x))),
  }), [view]);

  const local = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = host.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  /** Bordure d'en-tete sous le pointeur (redimensionnement). */
  const resizeEdge = (x: number, y: number, k = 1): { axis: 'row' | 'col'; index: number } | null => {
    if (y < view.headerH && x > view.headerW) {
      const c = colAt(view, x);
      const right = colX(view, c) + axisSize(cols, c) * zoom;
      const left = colX(view, c);
      if (Math.abs(x - right) <= 4 * k) return { axis: 'col', index: c };
      if (Math.abs(x - left) <= 4 * k && c > 0) return { axis: 'col', index: c - 1 };
    }
    if (x < view.headerW && y > view.headerH) {
      const r = rowAt(view, y);
      const bottom = rowY(view, r) + axisSize(rows, r) * zoom;
      const top = rowY(view, r);
      if (Math.abs(y - bottom) <= 3 * k) return { axis: 'row', index: r };
      if (Math.abs(y - top) <= 3 * k && r > 0) return { axis: 'row', index: r - 1 };
    }
    return null;
  };

  const onFillHandle = (x: number, y: number): boolean => {
    if (p.sel.ranges.length !== 1) return false;
    const r = activeRange(p.sel);
    const hx = colX(view, r.c2) + axisSize(cols, r.c2) * zoom;
    const hy = rowY(view, r.r2) + axisSize(rows, r.r2) * zoom;
    return Math.abs(x - hx) <= 5 && Math.abs(y - hy) <= 5;
  };

  const touchG = useGridTouch({
    view, zoom, mode, sheet: p.sheet, scroll, setScroll, onSelect: p.onSelect, onEdit: p.onEdit,
    startSelectDrag: () => setDrag({ kind: 'select', add: false }),
  });

  const filterButtonAt = (x: number, y: number): { row: number; col: number } | null => {
    for (const b of p.source.filterButtons) {
      const bx = colX(view, b.col) + axisSize(cols, b.col) * zoom;
      const by = rowY(view, b.row) + axisSize(rows, b.row) * zoom;
      const s = Math.min(axisSize(rows, b.row) * zoom - 2, 17 * zoom);
      if (x >= bx - s - 2 && x <= bx && y >= by - s - 1 && y <= by) return b;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 && e.button !== 2) return;
    // Les objets superposes (editeur, graphiques, boutons) gerent leurs propres clics.
    if (e.target !== canvas.current && e.target !== host.current) return;
    const { x, y } = local(e);
    if (x > view.width || y > view.height) return;
    host.current?.focus({ preventScroll: true });
    if (e.button === 2) {
      const r = rowAt(view, y);
      const c = colAt(view, x);
      if (r >= 0 && c >= 0 && !p.sel.ranges.some((s) => r >= s.r1 && r <= s.r2 && c >= s.c1 && c <= s.c2)) p.onSelect(cellSelection(r, c));
      else if (r < 0 && c >= 0 && !p.sel.ranges.some((s) => c >= s.c1 && c <= s.c2 && s.r1 === 0 && s.r2 === MAX_ROWS - 1)) p.onSelect(selectCols(c, c));
      else if (c < 0 && r >= 0 && !p.sel.ranges.some((s) => r >= s.r1 && r <= s.r2 && s.c1 === 0 && s.c2 === MAX_COLS - 1)) p.onSelect(selectRows(r, r));
      return;
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const touch = e.pointerType === 'touch';
    const edge = touch && mode !== 'select' ? null : resizeEdge(x, y, touch ? 3 : 1);
    if (edge) {
      const ranges = p.sel.ranges.filter((s) => (edge.axis === 'col' ? s.r1 === 0 && s.r2 === MAX_ROWS - 1 : s.c1 === 0 && s.c2 === MAX_COLS - 1));
      const within = ranges.find((s) => (edge.axis === 'col' ? edge.index >= s.c1 && edge.index <= s.c2 : edge.index >= s.r1 && edge.index <= s.r2));
      const first = within ? (edge.axis === 'col' ? within.c1 : within.r1) : edge.index;
      const last = within ? (edge.axis === 'col' ? within.c2 : within.r2) : edge.index;
      if (e.detail === 2) {
        p.onResize(edge.axis, first, last, 'auto');
        return;
      }
      setDrag({ kind: 'resize', axis: edge.axis, index: edge.index, start: edge.axis === 'col' ? x : y, size: axisSize(edge.axis === 'col' ? cols : rows, edge.index), first, last });
      return;
    }
    if (touch && !p.pointing && !filterButtonAt(x, y) && touchG.down(e, x, y)) return;
    if (y < view.headerH && x < view.headerW) {
      p.onSelect(selectAll());
      return;
    }
    if (y < view.headerH) {
      const c = colAt(view, x);
      p.onSelect(e.shiftKey ? selectCols(p.sel.anchor.col, c, false) : selectCols(c, c, e.ctrlKey, p.sel));
      setDrag({ kind: 'cols', from: e.shiftKey ? p.sel.anchor.col : c, add: e.ctrlKey });
      return;
    }
    if (x < view.headerW) {
      const r = rowAt(view, y);
      p.onSelect(e.shiftKey ? selectRows(p.sel.anchor.row, r, false) : selectRows(r, r, e.ctrlKey, p.sel));
      setDrag({ kind: 'rows', from: e.shiftKey ? p.sel.anchor.row : r, add: e.ctrlKey });
      return;
    }
    const fb = filterButtonAt(x, y);
    if (fb) {
      p.onFilterButton(fb.row, fb.col, { x: e.clientX, y: e.clientY });
      return;
    }
    const cell = cellFrom(x, y);
    if (p.pointing) {
      p.onPoint({ r1: cell.row, c1: cell.col, r2: cell.row, c2: cell.col });
      setDrag({ kind: 'point', anchor: cell });
      return;
    }
    if (onFillHandle(x, y)) {
      setDrag({ kind: 'fill', src: activeRange(p.sel), target: null });
      return;
    }
    if (e.detail === 2) {
      p.onEdit(cell.row, cell.col);
      return;
    }
    if (e.shiftKey) p.onSelect(extendTo(p.sel, cell.row, cell.col, p.sheet.merges));
    else if (e.ctrlKey || e.metaKey) p.onSelect(addCell(p.sel, cell.row, cell.col));
    else p.onSelect(extendTo(cellSelection(cell.row, cell.col), cell.row, cell.col, p.sheet.merges));
    setDrag({ kind: 'select', add: e.ctrlKey || e.metaKey });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'touch' && touchG.move(e)) return;
    let { x, y } = local(e);
    if (grab.current && drag) {
      x += grab.current.ix - grab.current.dx;
      y += grab.current.iy - grab.current.dy;
    }
    if (!drag) {
      const edge = resizeEdge(x, y);
      setCursor(edge ? (edge.axis === 'col' ? 'col-resize' : 'row-resize') : onFillHandle(x, y) ? 'crosshair'
        : y < view.headerH && x > view.headerW ? 'xl-col' : x < view.headerW && y > view.headerH ? 'xl-row' : 'cell');
      if (x > view.headerW && y > view.headerH && x < view.width && y < view.height) {
        const c = cellFrom(x, y);
        p.onHover({ ...c, x: e.clientX, y: e.clientY });
      } else p.onHover(null);
      return;
    }
    autoScroll(x, y);
    const cell = cellFrom(x, y);
    switch (drag.kind) {
      case 'select':
        p.onSelect(extendTo(p.sel, cell.row, cell.col, p.sheet.merges));
        break;
      case 'cols':
        p.onSelect(selectCols(drag.from, Math.max(0, colAt(view, Math.max(view.headerW, x))), false));
        break;
      case 'rows':
        p.onSelect(selectRows(drag.from, Math.max(0, rowAt(view, Math.max(view.headerH, y))), false));
        break;
      case 'point':
        p.onPoint(norm(drag.anchor, cell));
        break;
      case 'fill': {
        const s = drag.src;
        const dr = cell.row > s.r2 ? cell.row - s.r2 : cell.row < s.r1 ? cell.row - s.r1 : 0;
        const dc = cell.col > s.c2 ? cell.col - s.c2 : cell.col < s.c1 ? cell.col - s.c1 : 0;
        let t: CellRange | null = null;
        if (Math.abs(dr) >= Math.abs(dc) && dr !== 0) t = dr > 0 ? { ...s, r2: cell.row } : { ...s, r1: cell.row };
        else if (dc !== 0) t = dc > 0 ? { ...s, c2: cell.col } : { ...s, c1: cell.col };
        setFillTarget(t);
        setDrag({ ...drag, target: t });
        break;
      }
      case 'resize': {
        const delta = ((drag.axis === 'col' ? x : y) - drag.start) / zoom;
        const px = Math.max(0, Math.round(drag.size + delta));
        p.onResize(drag.axis, drag.first, drag.last, px);
        break;
      }
      case 'thumb': {
        const delta = ((drag.axis === 'x' ? x : y) - drag.start) * drag.ratio;
        setScroll((s) => (drag.axis === 'x' ? { ...s, x: Math.max(0, drag.scroll + delta) } : { ...s, y: Math.max(0, drag.scroll + delta) }));
        break;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    touchG.up(e);
    if (grab.current && Math.hypot(e.clientX - grab.current.cx, e.clientY - grab.current.cy) < 6) touchG.tapThrough(e);
    grab.current = null;
    if (drag?.kind === 'fill' && drag.target) p.onFill(drag.src, drag.target, e.ctrlKey);
    setFillTarget(null);
    setDrag(null);
  };

  const onPointerCancel = (): void => {
    touchG.cancel();
    grab.current = null;
    setFillTarget(null);
    setDrag(null);
  };

  /** Poignee tactile : prolonge la selection (debut/fin) ou lance la recopie ; le decalage du doigt est compense. */
  const startHandle = (id: HandleId, corner: { x: number; y: number }) => (e: React.PointerEvent<HTMLDivElement>): void => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = local(e);
    const inset = id === 'tl' ? 2 : id === 'br' ? -2 : 0;
    grab.current = { dx: x - corner.x, dy: y - corner.y, ix: inset, iy: id === 'fill' ? -2 : inset, cx: e.clientX, cy: e.clientY };
    const r = activeRange(p.sel);
    if (id === 'fill') {
      setDrag({ kind: 'fill', src: r, target: null });
      return;
    }
    const from = id === 'tl' ? { row: r.r2, col: r.c2 } : { row: r.r1, col: r.c1 };
    const to = id === 'tl' ? { row: r.r1, col: r.c1 } : { row: r.r2, col: r.c2 };
    p.onSelect(extendTo(cellSelection(from.row, from.col), to.row, to.col, p.sheet.merges));
    setDrag({ kind: 'select', add: false });
  };

  const autoScroll = (x: number, y: number): void => {
    if (!drag || drag.kind === 'resize' || drag.kind === 'thumb') return;
    const step = 20;
    setScroll((s) => ({
      x: x > view.width - 10 ? s.x + step : x < view.headerW && s.x > 0 && drag.kind !== 'rows' ? Math.max(0, s.x - step) : s.x,
      y: y > view.height - 10 ? s.y + step : y < view.headerH && s.y > 0 && drag.kind !== 'cols' ? Math.max(0, s.y - step) : s.y,
    }));
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    if (e.ctrlKey) {
      p.onZoom(Math.round(Math.min(400, Math.max(10, zoom * 100 - Math.sign(e.deltaY) * 10))));
      return;
    }
    const k = e.deltaMode === 1 ? 20 : 1;
    const dx = e.shiftKey ? e.deltaY : e.deltaX;
    const dy = e.shiftKey ? 0 : e.deltaY;
    setScroll((s) => ({ x: Math.max(0, s.x + (dx * k) / zoom), y: Math.max(0, s.y + (dy * k) / zoom) }));
  };

  // Etendue des barres de defilement : zone utilisee + fenetre (s'agrandit en defilant, comme Excel).
  const used = useMemo(() => {
    let r2 = 0;
    let c2 = 0;
    for (const [r, line] of p.sheet.cells) {
      if (r > r2) r2 = r;
      for (const c of line.keys()) if (c > c2) c2 = c;
    }
    return { r2, c2 };
  }, [p.sheet.cells]);
  const extentY = Math.max(axisPos(rows, Math.min(MAX_ROWS, used.r2 + 60)), scroll.y + (view.height / zoom) * 1.5);
  const extentX = Math.max(axisPos(cols, Math.min(MAX_COLS, used.c2 + 20)), scroll.x + (view.width / zoom) * 1.5);
  const trackH = view.height - view.headerH;
  const trackW = view.width - view.headerW;
  const thumbH = Math.max(24, (trackH * (view.height / zoom)) / extentY);
  const thumbW = Math.max(24, (trackW * (view.width / zoom)) / extentX);
  const thumbY = view.headerH + ((trackH - thumbH) * scroll.y) / Math.max(1, extentY - view.height / zoom);
  const thumbX = view.headerW + ((trackW - thumbW) * scroll.x) / Math.max(1, extentX - view.width / zoom);

  const startThumb = (axis: 'x' | 'y') => (e: React.PointerEvent<HTMLDivElement>): void => {
    e.stopPropagation();
    host.current?.setPointerCapture(e.pointerId);
    const { x, y } = local(e);
    const ratio = axis === 'y' ? (extentY - view.height / zoom) / Math.max(1, trackH - thumbH) : (extentX - view.width / zoom) / Math.max(1, trackW - thumbW);
    setDrag({ kind: 'thumb', axis, start: axis === 'x' ? x : y, scroll: axis === 'x' ? scroll.x : scroll.y, ratio });
  };

  // Poignees tactiles (visibles seulement sur ecran tactile, hors edition) : plage simple, bords visibles.
  const r = activeRange(p.sel);
  const x1 = colX(view, r.c1);
  const y1 = rowY(view, r.r1);
  const x2 = colX(view, r.c2) + axisSize(cols, r.c2) * zoom;
  const y2 = rowY(view, r.r2) + axisSize(rows, r.r2) * zoom;
  const corners: Record<HandleId, { x: number; y: number }> = { tl: { x: x1, y: y1 }, br: { x: x2, y: y2 }, fill: { x: (x1 + x2) / 2, y: y2 } };
  const whole = r.r2 === MAX_ROWS - 1 || r.c2 === MAX_COLS - 1 || p.sel.ranges.length !== 1;
  const handles = whole || p.source.editing || p.pointing ? [] : selectionHandles({ x1, y1, x2, y2 }).filter((h) => h.x > view.headerW - 12 && h.x < view.width + 12 && h.y > view.headerH - 12 && h.y < view.height + 12);

  return (
    <div
      ref={(el) => {
        host.current = el;
        p.gridRef?.(el);
      }}
      className={`xl-grid xl-cursor-${cursor}`}
      data-fo-own-longpress=""
      tabIndex={0}
      role="grid"
      aria-label={S.grid}
      aria-rowcount={MAX_ROWS}
      aria-colcount={MAX_COLS}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={() => p.onHover(null)}
      onWheel={onWheel}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget) p.onKeyDown(e);
      }}
      onContextMenu={(e) => {
        if (e.target !== canvas.current && e.target !== host.current) return;
        e.preventDefault();
        const { x, y } = local(e);
        p.onContext(e, y < view.headerH && x < view.headerW ? 'corner' : y < view.headerH ? 'col' : x < view.headerW ? 'row' : 'cell');
      }}
    >
      <canvas ref={canvas} className="xl-canvas" />
      <div className="xl-overlay" style={{ left: view.headerW, top: view.headerH, width: view.width - view.headerW, height: view.height - view.headerH }}>
        <div className="xl-overlay__inner" style={{ left: -view.headerW, top: -view.headerH }}>{p.overlay(view)}</div>
      </div>
      {handles.map((h) => (
        <div key={h.id} className={`xl-thandle xl-thandle--${h.id}`} style={{ left: h.x - 22, top: h.y - 22 }} onPointerDown={startHandle(h.id, corners[h.id])} />
      ))}
      <button type="button" className={`xl-modebtn${mode === 'select' ? ' is-select' : ''}`} aria-pressed={mode === 'select'} aria-label={mode === 'select' ? S.touchSelectMode : S.touchScrollMode}
        onPointerDown={(e) => e.stopPropagation()} onClick={() => setMode((m) => (m === 'scroll' ? 'select' : 'scroll'))}>
        <Icon name={mode === 'select' ? 'cursor' : 'hand_left'} size={22} />
      </button>
      <div className="xl-scroll xl-scroll--v" style={{ top: 0, height: view.height }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="xl-scroll__thumb" style={{ top: thumbY, height: thumbH }} onPointerDown={startThumb('y')} />
      </div>
      <div className="xl-scroll xl-scroll--h" style={{ left: 0, width: view.width }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="xl-scroll__thumb" style={{ left: thumbX, width: thumbW }} onPointerDown={startThumb('x')} />
      </div>
    </div>
  );
}
