// Liste du lot : ordre (glisser, haut/bas) et choix de la miniature, sans DOM (teste).
import { categoryOf } from './formats.ts';

/** Deplace l'element `from` a la place de l'element `to` (les autres glissent). Renvoie la meme liste si rien ne change. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list.slice();
  const out = list.slice();
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item as T);
  return out;
}

/** Monte (-1) ou descend (+1) l'element d'identifiant `id`. */
export function moveById<T extends { id: string }>(list: readonly T[], id: string, delta: -1 | 1): T[] {
  const i = list.findIndex((x) => x.id === id);
  return i < 0 ? list.slice() : moveItem(list, i, i + delta);
}

/** Deplace l'element `id` juste avant (ou apres, si `after`) l'element `target`. */
export function moveNear<T extends { id: string }>(list: readonly T[], id: string, target: string, after = false): T[] {
  const from = list.findIndex((x) => x.id === id);
  const at = list.findIndex((x) => x.id === target);
  if (from < 0 || at < 0 || from === at) return list.slice();
  let to = at + (after ? 1 : 0);
  if (from < to) to--;
  return moveItem(list, from, to);
}

export const MAX_THUMB_BYTES = 50 * 1024 * 1024;

export type ThumbKind = 'native' | 'image' | 'pdf';

/** Moteur de miniature d'un fichier : natif (fichier du disque connu de la coquille), image ou PDF dans le navigateur ; null = icone. */
export function thumbKind(file: { ext: string; size: number; path: string | null }, native: boolean): ThumbKind | null {
  if (file.size > MAX_THUMB_BYTES) return null;
  const cat = categoryOf(file.ext);
  if (cat === 'image') return native && file.path ? 'native' : 'image';
  return cat === 'pdf' ? 'pdf' : null;
}
