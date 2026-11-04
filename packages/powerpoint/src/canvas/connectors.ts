// Connecteurs : points de connexion des formes, accroche et suivi quand une forme reliee bouge (sans DOM).
import type { Connector, Shape } from '@forgeoffice/pptx';
import { buildGeometry } from './geometry/index.ts';
import { fromLocal, type Box, type Point } from './math.ts';
import { boxOfXfrm, flattenWithBoxes, locate, pageBox, xfrmOfBox } from './ops.ts';

/** Sites de connexion d'une forme dans la page. */
export function connectionPoints(shape: Shape, box: Box): Point[] {
  if (!('geometry' in shape) || shape.kind === 'connector') return [];
  const geo = buildGeometry(shape.geometry, box.width, box.height);
  return geo.connectionSites.map((s) => fromLocal(box, { x: box.flipH ? box.width - s.x : s.x, y: box.flipV ? box.height - s.y : s.y }));
}

/** Boite d'une ligne entre deux points (les retournements donnent le sens). */
export function lineBox(start: Point, end: Point): Box {
  const box: Box = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
  if (end.x < start.x) box.flipH = true;
  if (end.y < start.y) box.flipV = true;
  return box;
}

/** Extremites (debut, fin) d'une ligne d'apres sa boite. */
export function lineEnds(box: Box): [Point, Point] {
  const a = fromLocal(box, { x: box.flipH ? box.width : 0, y: box.flipV ? box.height : 0 });
  const b = fromLocal(box, { x: box.flipH ? 0 : box.width, y: box.flipV ? 0 : box.height });
  return [a, b];
}

/** Site de connexion le plus proche d'un point (accroche des extremites). */
export function nearestSite(shapes: Shape[], p: Point, threshold: number, exclude: number): { shapeId: number; site: number; point: Point } | null {
  let best: { shapeId: number; site: number; point: Point } | null = null;
  let dist = threshold;
  for (const item of flattenWithBoxes(shapes)) {
    if (!item.box || item.shape.id === exclude || item.shape.kind === 'group') continue;
    connectionPoints(item.shape, item.box).forEach((point, site) => {
      const d = Math.hypot(point.x - p.x, point.y - p.y);
      if (d <= dist) {
        dist = d;
        best = { shapeId: item.shape.id, site, point };
      }
    });
  }
  return best;
}

/**
 * Recale les connecteurs relies sur la position courante de leurs formes. `resolve` donne la forme effective
 * (position heritee des espaces reserves).
 */
export function rerouteConnectors(shapes: Shape[], resolve: (shape: Shape) => Shape = (s) => s): void {
  const site = (ref: Connector['start']): Point | null => {
    if (!ref) return null;
    const found = locate(shapes, ref.shapeId);
    if (!found) return null;
    const effective = resolve(found.shape);
    const box = pageBox({ shape: effective, ancestors: found.ancestors });
    return box ? (connectionPoints(effective, box)[ref.site] ?? null) : null;
  };
  for (const item of flattenWithBoxes(shapes)) {
    const c = item.shape;
    if (c.kind !== 'connector' || (!c.start && !c.end) || !c.xfrm) continue;
    const [a, b] = lineEnds(boxOfXfrm(c.xfrm));
    const start = site(c.start) ?? a;
    const end = site(c.end) ?? b;
    if (Math.hypot(start.x - a.x, start.y - a.y) < 0.01 && Math.hypot(end.x - b.x, end.y - b.y) < 0.01) continue;
    c.xfrm = xfrmOfBox(lineBox(start, end));
  }
}
