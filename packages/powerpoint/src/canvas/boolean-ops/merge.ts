// Fusion de formes (union, combinaison, intersection, soustraction) : contours des formes en repere de la page, resultat en forme libre.
import type { AutoShape } from '@forgeoffice/pptx';
import { buildGeometry } from '../geometry/index.ts';
import { flatten, nodeBounds, parseSvgPath, polygonToSubPath, toGeometry, type SubPath } from '../path-edit/model.ts';
import { booleanOp, type BoolOp, type Pt, type Ring } from './clip.ts';

export type MergeOp = BoolOp;

interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
}

/** Contours (repere local en points) d'une forme : tous les chemins qui ont un remplissage. */
export function localSubPaths(shape: Pick<AutoShape, 'geometry'>, width: number, height: number, onlyFilled = true): SubPath[] {
  return buildGeometry(shape.geometry, width, height).paths.filter((p) => !onlyFilled || p.fill !== 'none').flatMap((p) => parseSvgPath(p.d));
}

/** Point local -> page (miroirs puis rotation autour du centre, puis translation). */
export function toPage(p: Pt, f: Frame): Pt {
  const lx = f.flipH ? f.width - p.x : p.x;
  const ly = f.flipV ? f.height - p.y : p.y;
  const a = ((f.rotation ?? 0) * Math.PI) / 180;
  const dx = lx - f.width / 2;
  const dy = ly - f.height / 2;
  return { x: f.x + f.width / 2 + dx * Math.cos(a) - dy * Math.sin(a), y: f.y + f.height / 2 + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Contours fermes de la forme dans le repere de la page. */
export function pageRings(shape: Pick<AutoShape, 'geometry'>, frame: Frame): Ring[] {
  return localSubPaths(shape, frame.width, frame.height)
    .filter((s) => s.closed)
    .map((s) => flatten(s, 0.1).map((p) => toPage(p, frame)));
}

/** Resultat de la fusion : cadre et geometrie libre, ou null si la region est vide. */
export function mergeRings(rings: Ring[]): Pick<AutoShape, 'geometry' | 'xfrm'> | null {
  if (!rings.length) return null;
  const subs = rings.map(polygonToSubPath);
  const b = nodeBounds(subs);
  if (b.width <= 0 || b.height <= 0) return null;
  return { xfrm: { x: b.x, y: b.y, width: b.width, height: b.height }, geometry: toGeometry(subs, b.x, b.y, b.width, b.height, true) };
}

/** Fusionne les formes dans l'ordre de selection : la premiere est le sujet, les suivantes sont appliquees une a une. */
export function mergeShapes(frames: ReadonlyArray<{ shape: Pick<AutoShape, 'geometry'>; frame: Frame }>, op: MergeOp): Pick<AutoShape, 'geometry' | 'xfrm'> | null {
  const [first, ...rest] = frames;
  if (!first) return null;
  let acc = pageRings(first.shape, first.frame);
  for (const next of rest) acc = booleanOp(acc, pageRings(next.shape, next.frame), op);
  return mergeRings(acc);
}
