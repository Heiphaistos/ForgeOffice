// Gestes tactiles du diaporama : toucher = suite, balayage gauche/droite = diapositive suivante/precedente, pincement = quitter.
import { useRef, type PointerEvent } from 'react';
import { pinchGeometry, swipeDirection } from '@forgeoffice/ui';

export type ShowGesture = 'tap' | 'next' | 'prev' | 'exit' | null;

/** Un pincement vers l'interieur qui reduit l'ecart des doigts de 40 % ou plus quitte le diaporama. */
export const EXIT_PINCH_RATIO = 0.6;

export function useShowTouch() {
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const pinch = useRef<{ d0: number; d: number } | null>(null);
  const lastTarget = useRef<Element | null>(null);

  const spread = (): number => {
    const [a, b] = [...pts.current.values()];
    return a && b ? pinchGeometry(a, b).dist : 0;
  };

  return {
    /** Element touche au debut du geste (pour le clic sur une forme interactive). */
    get target(): Element | null {
      return lastTarget.current;
    },
    down(e: PointerEvent): void {
      pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.current.size === 1) {
        start.current = { x: e.clientX, y: e.clientY, t: performance.now() };
        lastTarget.current = e.target instanceof Element ? e.target : null;
      }
      else if (pts.current.size === 2) pinch.current = { d0: spread(), d: spread() };
    },
    move(e: PointerEvent): void {
      if (!pts.current.has(e.pointerId)) return;
      pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current) pinch.current.d = spread();
    },
    up(e: PointerEvent): ShowGesture {
      if (!pts.current.has(e.pointerId)) return null;
      pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = pinch.current;
      if (p) p.d = Math.min(p.d, spread() || p.d);
      pts.current.delete(e.pointerId);
      if (pts.current.size > 0) return null;
      const s = start.current;
      start.current = null;
      pinch.current = null;
      if (p) return p.d0 > 0 && p.d <= p.d0 * EXIT_PINCH_RATIO ? 'exit' : null;
      if (!s) return null;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const dir = swipeDirection(dx, dy, performance.now() - s.t);
      if (dir === 'left') return 'next';
      if (dir === 'right') return 'prev';
      return Math.hypot(dx, dy) < 12 ? 'tap' : null;
    },
    cancel(): void {
      pts.current.clear();
      start.current = null;
      pinch.current = null;
    },
  };
}
