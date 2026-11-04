// Gestes tactiles du canevas (Presentation, Publication) : deux doigts = pincement (zoom) et defilement de la zone ;
// double toucher = double clic (edition du texte). Un doigt sur le fond fait defiler (voir mode `pan` de CanvasEditor).
import { useRef, type PointerEvent, type RefObject } from 'react';
import { ZOOM_MAX, ZOOM_MIN, pinchGeometry, pinchZoom } from '@forgeoffice/ui';

interface Gesture { dist: number; zoom: number; mx: number; my: number }

export interface CanvasTouchDeps {
  viewport: RefObject<HTMLElement | null>;
  zoom: number;
  onZoomChange?: (zoom: number) => void;
  /** Un deuxieme doigt arrive : annule le glisser en cours (deplacement, lasso...). */
  cancelDrag: () => void;
}

export function useCanvasTouch(d: CanvasTouchDeps) {
  const latest = useRef(d);
  latest.current = d;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  const geometry = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? pinchGeometry(a, b) : null;
  };

  return {
    /** true si le deuxieme doigt demarre un geste (l'appelant ne fait rien d'autre). */
    down(e: PointerEvent): boolean {
      if (e.pointerType !== 'touch') return false;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size < 2) return false;
      latest.current.cancelDrag();
      const g = geometry();
      if (g) gesture.current = { dist: g.dist, zoom: latest.current.zoom, mx: g.mx, my: g.my };
      return true;
    },
    /** true si le mouvement appartient au geste a deux doigts. */
    move(e: PointerEvent): boolean {
      if (e.pointerType !== 'touch' || !pointers.current.has(e.pointerId)) return false;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const gs = gesture.current;
      const g = geometry();
      if (!gs || !g) return false;
      const { viewport, onZoomChange } = latest.current;
      if (viewport.current) {
        viewport.current.scrollLeft -= g.mx - gs.mx;
        viewport.current.scrollTop -= g.my - gs.my;
      }
      gs.mx = g.mx;
      gs.my = g.my;
      onZoomChange?.(pinchZoom(gs.zoom, gs.dist, g.dist, ZOOM_MIN, ZOOM_MAX));
      return true;
    },
    /** true si le relachement termine un geste a deux doigts (rien d'autre a faire). */
    up(e: PointerEvent): boolean {
      if (e.pointerType !== 'touch') return false;
      pointers.current.delete(e.pointerId);
      const was = gesture.current !== null;
      if (pointers.current.size < 2) gesture.current = null;
      if (was && pointers.current.size === 0) lastTap.current = null;
      return was;
    },
    /** Deux touchers rapproches (hors geste) = double toucher. */
    isDoubleTap(e: PointerEvent): boolean {
      const now = { t: performance.now(), x: e.clientX, y: e.clientY };
      const prev = lastTap.current;
      const dbl = prev !== null && now.t - prev.t <= 350 && Math.hypot(now.x - prev.x, now.y - prev.y) <= 24;
      lastTap.current = dbl ? null : now;
      return dbl;
    },
  };
}
