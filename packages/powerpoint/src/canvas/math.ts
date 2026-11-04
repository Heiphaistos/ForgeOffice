// Geometrie de l'editeur (sans DOM) : boites tournees, test de clic, redimensionnement avec rotation,
// rotation, magnetisme et reperes intelligents, alignement et distribution. Unites : points, degres (sens horaire).

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Boite d'une forme dans le repere de la page. */
export interface Box extends Rect {
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
}

/** Poignee de redimensionnement (points cardinaux). */
export type HandleId = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const HANDLES: readonly HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const RAD = Math.PI / 180;

export const center = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** Tourne un point autour d'un centre (degres, sens horaire a l'ecran). */
export function rotatePoint(p: Point, c: Point, deg: number): Point {
  if (!deg) return { x: p.x, y: p.y };
  const a = deg * RAD;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/** Angle normalise dans [0, 360). */
export function normalizeAngle(deg: number): number {
  const a = deg % 360;
  return a < 0 ? a + 360 : a === 0 ? 0 : a;
}

/** Quatre coins (nw, ne, se, sw) dans le repere de la page. */
export function corners(box: Box): [Point, Point, Point, Point] {
  const c = center(box);
  const r = box.rotation ?? 0;
  return [
    rotatePoint({ x: box.x, y: box.y }, c, r),
    rotatePoint({ x: box.x + box.width, y: box.y }, c, r),
    rotatePoint({ x: box.x + box.width, y: box.y + box.height }, c, r),
    rotatePoint({ x: box.x, y: box.y + box.height }, c, r),
  ];
}

/** Rectangle englobant (axes de la page) d'une boite tournee. */
export function boundsOf(box: Box): Rect {
  if (!box.rotation) return { x: box.x, y: box.y, width: box.width, height: box.height };
  return boundsOfPoints(corners(box));
}

export function boundsOfPoints(points: readonly Point[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Union de rectangles (null si la liste est vide). */
export function unionRects(rects: readonly Rect[]): Rect | null {
  if (!rects.length) return null;
  return boundsOfPoints(rects.flatMap((r) => [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y + r.height }]));
}

/** Le point est-il dans la boite tournee (avec une tolerance en points pour les formes tres fines) ? */
export function hitBox(box: Box, p: Point, tolerance = 0): boolean {
  const local = rotatePoint(p, center(box), -(box.rotation ?? 0));
  return local.x >= box.x - tolerance && local.x <= box.x + box.width + tolerance && local.y >= box.y - tolerance && local.y <= box.y + box.height + tolerance;
}

/** Point exprime dans le repere local non tourne de la boite (origine = coin haut gauche). */
export function toLocal(box: Box, p: Point): Point {
  const local = rotatePoint(p, center(box), -(box.rotation ?? 0));
  return { x: local.x - box.x, y: local.y - box.y };
}

/** Point local (0..w, 0..h) vers la page. */
export function fromLocal(box: Box, p: Point): Point {
  return rotatePoint({ x: box.x + p.x, y: box.y + p.y }, center(box), box.rotation ?? 0);
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
}

/** Rectangle normalise entre deux points (selection au lasso). */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

/** Position d'une poignee dans le repere local (fractions de la largeur et de la hauteur). */
export function handleFraction(h: HandleId): Point {
  const x = h.includes('w') ? 0 : h.includes('e') ? 1 : 0.5;
  const y = h.includes('n') ? 0 : h.includes('s') ? 1 : 0.5;
  return { x, y };
}

/** Position d'une poignee dans la page. */
export function handlePoint(box: Box, h: HandleId): Point {
  const f = handleFraction(h);
  return fromLocal(box, { x: box.width * f.x, y: box.height * f.y });
}

export interface ResizeOptions {
  /** Maj : conserver les proportions. */
  keepAspect?: boolean;
  /** Ctrl : redimensionner depuis le centre. */
  fromCenter?: boolean;
  /** Taille minimale (points). */
  minSize?: number;
}

/**
 * Redimensionne une boite (eventuellement tournee) en tirant la poignee `h` jusqu'au point `p` de la page.
 * Le point oppose reste fixe dans la page ; depasser le cote oppose retourne la forme (flipH / flipV).
 */
export function resizeBox(box: Box, h: HandleId, p: Point, options: ResizeOptions = {}): Box {
  const rot = box.rotation ?? 0;
  const c = center(box);
  const local = rotatePoint(p, c, -rot);
  const min = options.minSize ?? 0;
  let left = box.x;
  let right = box.x + box.width;
  let top = box.y;
  let bottom = box.y + box.height;
  const moveX = h.includes('e') ? 'right' : h.includes('w') ? 'left' : null;
  const moveY = h.includes('s') ? 'bottom' : h.includes('n') ? 'top' : null;
  if (moveX === 'right') right = local.x;
  if (moveX === 'left') left = local.x;
  if (moveY === 'bottom') bottom = local.y;
  if (moveY === 'top') top = local.y;
  if (options.fromCenter) {
    if (moveX === 'right') left = 2 * c.x - right;
    if (moveX === 'left') right = 2 * c.x - left;
    if (moveY === 'bottom') top = 2 * c.y - bottom;
    if (moveY === 'top') bottom = 2 * c.y - top;
  }
  let w = right - left;
  let hgt = bottom - top;
  if (options.keepAspect && box.width > 0 && box.height > 0) {
    const ratio = box.width / box.height;
    if (moveX && moveY) {
      const sx = Math.abs(w) / box.width;
      const sy = Math.abs(hgt) / box.height;
      const s = Math.max(sx, sy);
      const nw = Math.sign(w || 1) * box.width * s;
      const nh = Math.sign(hgt || 1) * box.height * s;
      if (options.fromCenter) {
        left = c.x - nw / 2;
        right = c.x + nw / 2;
        top = c.y - nh / 2;
        bottom = c.y + nh / 2;
      } else {
        if (moveX === 'right') right = left + nw;
        else left = right - nw;
        if (moveY === 'bottom') bottom = top + nh;
        else top = bottom - nh;
      }
    } else if (moveX) {
      const nh = (Math.abs(w) / ratio) * Math.sign(hgt || 1);
      top = c.y - nh / 2;
      bottom = c.y + nh / 2;
    } else if (moveY) {
      const nw = Math.abs(hgt) * ratio * Math.sign(w || 1);
      left = c.x - nw / 2;
      right = c.x + nw / 2;
    }
    w = right - left;
    hgt = bottom - top;
  }
  let flipH = box.flipH ?? false;
  let flipV = box.flipV ?? false;
  if (w < 0) {
    [left, right] = [right, left];
    flipH = !flipH;
  }
  if (hgt < 0) {
    [top, bottom] = [bottom, top];
    flipV = !flipV;
  }
  let nw = Math.max(min, right - left);
  let nh = Math.max(min, bottom - top);
  if (nw > right - left && moveX === 'left') left = right - nw;
  if (nh > bottom - top && moveY === 'top') top = bottom - nh;
  nw = Math.max(min, nw);
  nh = Math.max(min, nh);
  const localCenter = { x: left + nw / 2, y: top + nh / 2 };
  const pageCenter = rotatePoint(localCenter, c, rot);
  const out: Box = { x: pageCenter.x - nw / 2, y: pageCenter.y - nh / 2, width: nw, height: nh };
  if (rot) out.rotation = rot;
  if (flipH) out.flipH = true;
  if (flipV) out.flipV = true;
  return out;
}

/** Angle de rotation quand la poignee de rotation est tiree jusqu'a `p` (Maj : pas de 15 degres). */
export function rotationFromPoint(box: Rect, p: Point, snapStep = 0): number {
  const c = center(box);
  let deg = Math.atan2(p.y - c.y, p.x - c.x) / RAD + 90;
  if (snapStep > 0) deg = Math.round(deg / snapStep) * snapStep;
  return Math.round(normalizeAngle(deg) * 100) / 100;
}

/** Angle d'un vecteur (degres, 0 = vers la droite) et magnetisme sur les multiples de 45 degres (lignes avec Maj). */
export function snapLineEnd(start: Point, end: Point, step = 45): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  const a = Math.round(Math.atan2(dy, dx) / RAD / step) * step * RAD;
  return { x: start.x + Math.cos(a) * len, y: start.y + Math.sin(a) * len };
}

// ---- Magnetisme et reperes intelligents ----

/** Trait de repere a dessiner (vertical si x est defini). */
export interface GuideLine {
  orientation: 'v' | 'h';
  /** Position de la ligne (x pour vertical, y pour horizontal). */
  at: number;
  from: number;
  to: number;
  /** Repere d'espacement egal (fleches de distance). */
  spacing?: boolean;
}

export interface SnapTargets {
  /** Rectangles des autres formes (axes de la page). */
  shapes: readonly Rect[];
  page: { width: number; height: number };
  /** Reperes de dessin (Affichage > Reperes) : positions x et y. */
  guidesX?: readonly number[];
  guidesY?: readonly number[];
  /** Pas de la grille quand « Aligner sur la grille » est actif. */
  grid?: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: GuideLine[];
}

interface Candidate {
  value: number;
  /** Etendue de l'objet cible sur l'autre axe (pour tracer la ligne). */
  from: number;
  to: number;
}

function axisCandidates(targets: SnapTargets, axis: 'x' | 'y'): Candidate[] {
  const out: Candidate[] = [];
  const size = axis === 'x' ? targets.page.width : targets.page.height;
  const other = axis === 'x' ? targets.page.height : targets.page.width;
  for (const v of [0, size / 2, size]) out.push({ value: v, from: 0, to: other });
  for (const g of (axis === 'x' ? targets.guidesX : targets.guidesY) ?? []) out.push({ value: g, from: 0, to: other });
  for (const r of targets.shapes) {
    const start = axis === 'x' ? r.x : r.y;
    const len = axis === 'x' ? r.width : r.height;
    const from = axis === 'x' ? r.y : r.x;
    const to = from + (axis === 'x' ? r.height : r.width);
    for (const v of [start, start + len / 2, start + len]) out.push({ value: v, from, to });
  }
  return out;
}

function snapAxis(edges: readonly number[], candidates: readonly Candidate[], threshold: number): { delta: number; hits: Candidate[] } {
  let best = Infinity;
  let delta = 0;
  for (const edge of edges) {
    for (const c of candidates) {
      const d = c.value - edge;
      if (Math.abs(d) <= threshold && Math.abs(d) < Math.abs(best)) {
        best = d;
        delta = d;
      }
    }
  }
  if (best === Infinity) return { delta: 0, hits: [] };
  const hits = candidates.filter((c) => edges.some((e) => Math.abs(c.value - (e + delta)) < 0.01));
  return { delta, hits };
}

/** Espacement egal : la boite placee entre deux voisins sur un axe se cale au milieu (reperes de distance). */
function equalSpacing(moving: Rect, shapes: readonly Rect[], axis: 'x' | 'y', threshold: number): { delta: number; guides: GuideLine[] } | null {
  const pos = (r: Rect): number => (axis === 'x' ? r.x : r.y);
  const len = (r: Rect): number => (axis === 'x' ? r.width : r.height);
  const crossStart = (r: Rect): number => (axis === 'x' ? r.y : r.x);
  const crossLen = (r: Rect): number => (axis === 'x' ? r.height : r.width);
  const overlaps = (r: Rect): boolean => crossStart(r) < crossStart(moving) + crossLen(moving) && crossStart(moving) < crossStart(r) + crossLen(r);
  const before = shapes.filter((r) => overlaps(r) && pos(r) + len(r) <= pos(moving) + threshold).sort((a, b) => pos(b) + len(b) - (pos(a) + len(a)))[0];
  const after = shapes.filter((r) => overlaps(r) && pos(r) >= pos(moving) + len(moving) - threshold).sort((a, b) => pos(a) - pos(b))[0];
  if (!before || !after) return null;
  const free = pos(after) - (pos(before) + len(before)) - len(moving);
  if (free < 0) return null;
  const target = pos(before) + len(before) + free / 2;
  const delta = target - pos(moving);
  if (Math.abs(delta) > threshold) return null;
  const mid = crossStart(moving) + crossLen(moving) / 2;
  const orientation = axis === 'x' ? 'h' : 'v';
  return {
    delta,
    guides: [
      { orientation, at: mid, from: pos(before) + len(before), to: target, spacing: true },
      { orientation, at: mid, from: target + len(moving), to: pos(after), spacing: true },
    ],
  };
}

/**
 * Magnetisme d'un deplacement : `moving` est le rectangle englobant de la selection apres un deplacement brut.
 * Renvoie la correction a ajouter et les reperes intelligents a afficher. `threshold` en points.
 */
export function snapMove(moving: Rect, targets: SnapTargets, threshold: number): SnapResult {
  const xEdges = [moving.x, moving.x + moving.width / 2, moving.x + moving.width];
  const yEdges = [moving.y, moving.y + moving.height / 2, moving.y + moving.height];
  const sx = snapAxis(xEdges, axisCandidates(targets, 'x'), threshold);
  const sy = snapAxis(yEdges, axisCandidates(targets, 'y'), threshold);
  let dx = sx.delta;
  let dy = sy.delta;
  const guides: GuideLine[] = [];
  if (!sx.hits.length) {
    const eq = equalSpacing(moving, targets.shapes, 'x', threshold);
    if (eq) {
      dx = eq.delta;
      guides.push(...eq.guides);
    } else if (targets.grid) dx = Math.round(moving.x / targets.grid) * targets.grid - moving.x;
  }
  if (!sy.hits.length) {
    const eq = equalSpacing(moving, targets.shapes, 'y', threshold);
    if (eq) {
      dy = eq.delta;
      guides.push(...eq.guides);
    } else if (targets.grid) dy = Math.round(moving.y / targets.grid) * targets.grid - moving.y;
  }
  const final = { x: moving.x + dx, y: moving.y + dy, width: moving.width, height: moving.height };
  for (const hit of sx.hits) {
    guides.push({ orientation: 'v', at: hit.value, from: Math.min(hit.from, final.y), to: Math.max(hit.to, final.y + final.height) });
  }
  for (const hit of sy.hits) {
    guides.push({ orientation: 'h', at: hit.value, from: Math.min(hit.from, final.x), to: Math.max(hit.to, final.x + final.width) });
  }
  return { dx, dy, guides };
}

/** Magnetisme d'un point (bord tire pendant un redimensionnement ou un trace). */
export function snapPoint(p: Point, targets: SnapTargets, threshold: number): { point: Point; guides: GuideLine[] } {
  const sx = snapAxis([p.x], axisCandidates(targets, 'x'), threshold);
  const sy = snapAxis([p.y], axisCandidates(targets, 'y'), threshold);
  let x = p.x + sx.delta;
  let y = p.y + sy.delta;
  if (!sx.hits.length && targets.grid) x = Math.round(p.x / targets.grid) * targets.grid;
  if (!sy.hits.length && targets.grid) y = Math.round(p.y / targets.grid) * targets.grid;
  const guides: GuideLine[] = [
    ...sx.hits.map((h): GuideLine => ({ orientation: 'v', at: h.value, from: Math.min(h.from, y), to: Math.max(h.to, y) })),
    ...sy.hits.map((h): GuideLine => ({ orientation: 'h', at: h.value, from: Math.min(h.from, x), to: Math.max(h.to, x) })),
  ];
  return { point: { x, y }, guides };
}

// ---- Alignement et distribution ----

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Deplacements (dx, dy) a appliquer a chaque rectangle pour l'aligner sur `reference`. */
export function alignOffsets(rects: readonly Rect[], mode: AlignMode, reference: Rect): Point[] {
  return rects.map((r) => {
    switch (mode) {
      case 'left':
        return { x: reference.x - r.x, y: 0 };
      case 'center':
        return { x: reference.x + reference.width / 2 - (r.x + r.width / 2), y: 0 };
      case 'right':
        return { x: reference.x + reference.width - (r.x + r.width), y: 0 };
      case 'top':
        return { x: 0, y: reference.y - r.y };
      case 'middle':
        return { x: 0, y: reference.y + reference.height / 2 - (r.y + r.height / 2) };
      case 'bottom':
        return { x: 0, y: reference.y + reference.height - (r.y + r.height) };
    }
  });
}

/**
 * Distribution horizontale ou verticale : espaces egaux entre les rectangles, dans `span`
 * (la selection : les extremes ne bougent pas ; ou la page).
 */
export function distributeOffsets(rects: readonly Rect[], axis: 'h' | 'v', span?: Rect): Point[] {
  const pos = (r: Rect): number => (axis === 'h' ? r.x : r.y);
  const len = (r: Rect): number => (axis === 'h' ? r.width : r.height);
  const order = rects.map((r, i) => i).sort((a, b) => pos(rects[a] as Rect) - pos(rects[b] as Rect));
  const out: Point[] = rects.map(() => ({ x: 0, y: 0 }));
  if (rects.length < 2 && !span) return out;
  const first = rects[order[0] ?? 0] as Rect;
  const last = rects[order[order.length - 1] ?? 0] as Rect;
  const start = span ? pos(span) : pos(first);
  const end = span ? pos(span) + len(span) : pos(last) + len(last);
  const total = rects.reduce((sum, r) => sum + len(r), 0);
  const gap = rects.length > 1 ? (end - start - total) / (rects.length - 1) : 0;
  let cursor = rects.length > 1 ? start : start + (end - start - total) / 2;
  for (const i of order) {
    const r = rects[i] as Rect;
    const d = cursor - pos(r);
    out[i] = axis === 'h' ? { x: d, y: 0 } : { x: 0, y: d };
    cursor += len(r) + gap;
  }
  return out;
}

/** Zoom qui fait tenir une page dans une zone (en %, 100 % = 96 ppp). */
export function fitZoom(page: { width: number; height: number }, viewport: { width: number; height: number }, margin = 24): number {
  const px = 96 / 72;
  const zx = (viewport.width - margin * 2) / (page.width * px);
  const zy = (viewport.height - margin * 2) / (page.height * px);
  return Math.max(10, Math.min(400, Math.floor(Math.min(zx, zy) * 100)));
}
