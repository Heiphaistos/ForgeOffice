// Gestes tactiles de la grille : un doigt fait defiler (mode « Defilement »), appui long = selection, double toucher = edition,
// toucher = selection d'une cellule, ligne ou colonne. Mode « Selection » : le doigt selectionne comme une souris.
import { useCallback, useEffect, useRef, type Dispatch, type PointerEvent as RPointerEvent, type SetStateAction } from 'react';
import { MAX_COLS, MAX_ROWS, type Sheet } from '@forgeoffice/xlsx';
import { LONG_PRESS_MS, gridIntent, type GridMode } from '@forgeoffice/ui';
import { cellSelection, extendTo, selectAll, selectCols, selectRows, type Selection } from '../logic/selection.ts';
import { colAt, rowAt, type Viewport } from '../logic/viewport.ts';
import { isDoubleTap, momentumStep } from '../logic/touch.ts';

const SLOP = 10;

interface Press { id: number; x0: number; y0: number; sx0: number; sy0: number; moved: boolean; longPressed: boolean; dragged: boolean; timer: number; last: { x: number; y: number; t: number }; vx: number; vy: number }

export interface GridTouchDeps {
  view: Viewport;
  zoom: number;
  mode: GridMode;
  sheet: Sheet;
  scroll: { x: number; y: number };
  setScroll: Dispatch<SetStateAction<{ x: number; y: number }>>;
  onSelect: (sel: Selection) => void;
  onEdit: (row: number, col: number) => void;
  /** Debut d'une selection par glisser (appui long, ou mode Selection). */
  startSelectDrag: () => void;
}

export interface GridTouch {
  /** true si le geste est pris en charge (sinon le chemin souris s'applique). */
  down(e: RPointerEvent, x: number, y: number): boolean;
  /** true si le mouvement est un defilement au doigt. */
  move(e: RPointerEvent): boolean;
  up(e: RPointerEvent): void;
  /** Toucher sur une poignee sans glisser : retransmis a la cellule dessous (double toucher = edition, la selection est gardee). */
  tapThrough(e: RPointerEvent): void;
  cancel(): void;
}

export function useGridTouch(d: GridTouchDeps): GridTouch {
  const latest = useRef(d);
  latest.current = d;
  const press = useRef<Press | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const raf = useRef(0);

  const stopMomentum = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
  }, []);
  const cancel = useCallback(() => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  }, []);
  useEffect(() => () => { stopMomentum(); cancel(); }, [stopMomentum, cancel]);

  const selectAt = (x: number, y: number, extend: boolean): { row: number; col: number } | null => {
    const { view, onSelect, sheet } = latest.current;
    if (y < view.headerH && x < view.headerW) {
      onSelect(selectAll());
      return null;
    }
    if (y < view.headerH) {
      const c = Math.max(0, colAt(view, x));
      onSelect(selectCols(c, c));
      return null;
    }
    if (x < view.headerW) {
      const r = Math.max(0, rowAt(view, y));
      onSelect(selectRows(r, r));
      return null;
    }
    const row = Math.min(MAX_ROWS - 1, Math.max(0, rowAt(view, y)));
    const col = Math.min(MAX_COLS - 1, Math.max(0, colAt(view, x)));
    onSelect(extend ? extendTo(cellSelection(row, col), row, col, sheet.merges) : cellSelection(row, col));
    return { row, col };
  };

  const startMomentum = (vx: number, vy: number): void => {
    stopMomentum();
    let last = performance.now();
    const step = (now: number): void => {
      const dt = Math.min(48, now - last);
      last = now;
      const mx = momentumStep(vx, dt);
      const my = momentumStep(vy, dt);
      vx = mx.v;
      vy = my.v;
      const { zoom, setScroll } = latest.current;
      setScroll((s) => ({ x: Math.max(0, s.x - mx.dist / zoom), y: Math.max(0, s.y - my.dist / zoom) }));
      raf.current = vx !== 0 || vy !== 0 ? requestAnimationFrame(step) : 0;
    };
    raf.current = requestAnimationFrame(step);
  };

  return {
    down(e, x, y) {
      if (e.pointerType !== 'touch') return false;
      stopMomentum();
      if (press.current) {
        cancel(); // deuxieme doigt : pincement (usePinchZoom), plus de defilement
        return true;
      }
      const { mode, scroll } = latest.current;
      if (gridIntent('touch', mode, false) === 'select') {
        const cell = selectAt(x, y, true);
        const now = { t: performance.now(), x: e.clientX, y: e.clientY };
        if (cell && isDoubleTap(lastTap.current, now)) {
          lastTap.current = null;
          latest.current.onEdit(cell.row, cell.col);
          return true;
        }
        lastTap.current = now;
        if (cell) latest.current.startSelectDrag();
        return true;
      }
      const timer = window.setTimeout(() => {
        const p = press.current;
        if (!p || p.moved) return;
        p.longPressed = true;
        selectAt(x, y, true);
        latest.current.startSelectDrag();
        navigator.vibrate?.(15);
      }, LONG_PRESS_MS);
      const t0 = performance.now();
      press.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, sx0: scroll.x, sy0: scroll.y, moved: false, longPressed: false, dragged: false, timer, last: { x: e.clientX, y: e.clientY, t: t0 }, vx: 0, vy: 0 };
      return true;
    },
    move(e) {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return false;
      const dx = e.clientX - p.x0;
      const dy = e.clientY - p.y0;
      if (p.longPressed) {
        if (Math.hypot(dx, dy) > SLOP) p.dragged = true;
        return false;
      }
      if (!p.moved && Math.hypot(dx, dy) > SLOP) {
        p.moved = true;
        window.clearTimeout(p.timer);
      }
      if (!p.moved) return true;
      const { zoom, setScroll } = latest.current;
      setScroll({ x: Math.max(0, p.sx0 - dx / zoom), y: Math.max(0, p.sy0 - dy / zoom) });
      const now = performance.now();
      const dt = Math.max(1, now - p.last.t);
      p.vx = 0.8 * p.vx + 0.2 * ((e.clientX - p.last.x) / dt);
      p.vy = 0.8 * p.vy + 0.2 * ((e.clientY - p.last.y) / dt);
      p.last = { x: e.clientX, y: e.clientY, t: now };
      return true;
    },
    up(e) {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return;
      window.clearTimeout(p.timer);
      press.current = null;
      if (p.longPressed) {
        // Appui long sans glisser : comme un clic droit, le menu contextuel s'ouvre au relachement.
        if (!p.dragged) e.target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, clientX: e.clientX, clientY: e.clientY, button: 2 }));
        return;
      }
      if (p.moved) {
        if (performance.now() - p.last.t < 80 && Math.hypot(p.vx, p.vy) > 0.15) startMomentum(p.vx, p.vy);
        return;
      }
      // Toucher bref : selection ; deux touchers : edition.
      const host = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const cell = selectAt(e.clientX - host.left, e.clientY - host.top, false);
      const now = { t: performance.now(), x: e.clientX, y: e.clientY };
      if (cell && isDoubleTap(lastTap.current, now)) {
        lastTap.current = null;
        latest.current.onEdit(cell.row, cell.col);
      } else lastTap.current = now;
    },
    tapThrough(e) {
      const host = (e.currentTarget as HTMLElement).closest('.xl-grid')?.getBoundingClientRect();
      if (!host) return;
      const { view } = latest.current;
      const x = e.clientX - host.left;
      const y = e.clientY - host.top;
      if (x < view.headerW || y < view.headerH) return;
      const row = Math.min(MAX_ROWS - 1, Math.max(0, rowAt(view, y)));
      const col = Math.min(MAX_COLS - 1, Math.max(0, colAt(view, x)));
      const now = { t: performance.now(), x: e.clientX, y: e.clientY };
      if (isDoubleTap(lastTap.current, now)) {
        lastTap.current = null;
        latest.current.onEdit(row, col);
      } else lastTap.current = now;
    },
    cancel,
  };
}
