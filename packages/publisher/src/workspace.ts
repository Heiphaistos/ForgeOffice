// Zone de travail (hors page) et deplacement d'objets d'une page a l'autre (sans DOM). Les objets places hors de la page restent
// dans la publication et visibles a l'ecran, mais ne sont ni imprimes ni exportes : c'est la « reserve » de l'espace de travail.
import type { Deck, Shape, Transform } from '@forgeoffice/pptx';
import { insertCopies } from '../../powerpoint/src/canvas/ops.ts';
import { boundsOfXfrm } from './geom.ts';
import type { PubSettings } from './model.ts';

export interface PageSize {
  width: number;
  height: number;
}

/** Ecart entre le bord de la page et un objet mis en reserve (points). */
export const RESERVE_GAP = 18;

/** L'objet est-il entierement hors de la page (donc dans la zone de travail) ? */
export function isOffPage(xfrm: Transform, page: PageSize): boolean {
  const b = boundsOfXfrm(xfrm);
  return b.x + b.width <= 0 || b.x >= page.width || b.y + b.height <= 0 || b.y >= page.height;
}

/** Position qui met l'objet dans la zone de travail, a gauche de la page (sa hauteur est conservee dans la page). */
export function reservePosition(xfrm: Transform): { x: number; y: number } {
  const b = boundsOfXfrm(xfrm);
  return { x: xfrm.x - (b.x + b.width) - RESERVE_GAP, y: xfrm.y };
}

/** Position qui ramene l'objet dans la page (marge `margin`), taille inchangee ; plus grand que la page : coin haut gauche. */
export function placeInPage(xfrm: Transform, page: PageSize, margin = 0): { x: number; y: number } {
  const b = boundsOfXfrm(xfrm);
  const fit = (pos: number, size: number, length: number): number => Math.max(margin, Math.min(pos, length - margin - size));
  return { x: xfrm.x + (fit(b.x, b.width, page.width) - b.x), y: xfrm.y + (fit(b.y, b.height, page.height) - b.y) };
}

/** Identifiants des objets engages dans un article (zones chainees) : ils ne changent pas de page sans rompre le lien. */
export function chainedIds(pub: PubSettings, pageId: number): Set<number> {
  const out = new Set<number>();
  for (const chain of pub.chains) for (const box of chain.boxes) if (box.page === pageId) out.add(box.shape);
  return out;
}

export type MoveResult = { deck: Deck; ids: number[] } | { error: 'chained' | 'same' | 'unknown' };

/** Deplace des objets de la page `from` vers la page `to` (meme position, nouvel identifiant) ; refuse les zones d'un article chaine. */
export function moveShapesToPage(deck: Deck, pub: PubSettings, from: number, to: number, ids: readonly number[]): MoveResult {
  const source = deck.slides[from];
  const target = deck.slides[to];
  if (!source || !target) return { error: 'unknown' };
  if (source === target) return { error: 'same' };
  const moving = ids.map((id) => source.shapes.find((s) => s.id === id)).filter((s): s is Shape => s !== undefined);
  if (!moving.length) return { error: 'unknown' };
  const chained = chainedIds(pub, source.id);
  if (moving.some((s) => chained.has(s.id))) return { error: 'chained' };
  const next = structuredClone(deck);
  const src = next.slides[from] as typeof source;
  const dst = next.slides[to] as typeof target;
  src.shapes = src.shapes.filter((s) => !ids.includes(s.id));
  return { deck: next, ids: insertCopies(dst.shapes, moving, { x: 0, y: 0 }) };
}
