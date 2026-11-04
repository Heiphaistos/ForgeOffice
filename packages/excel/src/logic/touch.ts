// Geometrie tactile de la grille : poignees de selection (cibles de 44 px), double toucher, inertie du defilement.
export interface PxRect { x1: number; y1: number; x2: number; y2: number }
export type HandleId = 'tl' | 'br' | 'fill';
export interface GridHandle { id: HandleId; x: number; y: number }

/** Poignees d'une plage selectionnee : deux ronds (debut et fin, decales vers l'exterieur) et la poignee de recopie au milieu du bord bas. */
export function selectionHandles(r: PxRect, offset = 10): GridHandle[] {
  const w = r.x2 - r.x1;
  const mid = Math.min(Math.max(r.x1 + w / 2, r.x1 + 8), Math.max(r.x1 + 8, r.x2 - 8));
  return [
    { id: 'tl', x: r.x1 - offset, y: r.y1 - offset },
    { id: 'br', x: r.x2 + offset, y: r.y2 + offset },
    { id: 'fill', x: mid, y: r.y2 },
  ];
}

/** Deux touchers successifs proches dans le temps et l'espace = double toucher. */
export function isDoubleTap(prev: { t: number; x: number; y: number } | null, now: { t: number; x: number; y: number }, maxMs = 350, maxPx = 24): boolean {
  return prev !== null && now.t - prev.t <= maxMs && Math.hypot(now.x - prev.x, now.y - prev.y) <= maxPx;
}

/** Inertie : vitesse (px/ms) amortie apres `dtMs` et deplacement correspondant. */
export function momentumStep(v: number, dtMs: number, friction = 0.004): { v: number; dist: number } {
  const decay = Math.exp(-friction * dtMs);
  const next = v * decay;
  return { v: Math.abs(next) < 0.02 ? 0 : next, dist: (v * (1 - decay)) / friction };
}
