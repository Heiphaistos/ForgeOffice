// SmartArt : opérations pures sur la liste d'éléments (ajout, retrait, promotion, abaissement, déplacement avec sous-arbre).
import type { SmartArtItem } from './smartart.ts';

export const NEW_ITEM = 'Nouvel élément';

/** Fin du sous-arbre de l'element `index` (exclue) : les elements suivants plus profonds lui appartiennent. */
export function subtreeEnd(items: readonly SmartArtItem[], index: number): number {
  const level = items[index]?.level ?? 0;
  let end = index + 1;
  while (end < items.length && (items[end] as SmartArtItem).level > level) end++;
  return end;
}

/** Ajoute un element apres le sous-arbre de `index` (a la fin sans index), au meme niveau. */
export function addItem(items: readonly SmartArtItem[], index?: number): SmartArtItem[] {
  if (index === undefined || index < 0 || index >= items.length) return [...items, { text: NEW_ITEM, level: items.at(-1)?.level ?? 0 }];
  const at = subtreeEnd(items, index);
  return [...items.slice(0, at), { text: NEW_ITEM, level: items[index]?.level ?? 0 }, ...items.slice(at)];
}

/** Retire l'element et son sous-arbre. */
export function removeItem(items: readonly SmartArtItem[], index: number): SmartArtItem[] {
  return index < 0 || index >= items.length ? [...items] : [...items.slice(0, index), ...items.slice(subtreeEnd(items, index))];
}

/** Promouvoir (-1) ou abaisser (+1) : l'element et son sous-arbre changent de niveau ; un element ne descend pas sous son precedent + 1. */
export function shiftLevel(items: readonly SmartArtItem[], index: number, delta: -1 | 1): SmartArtItem[] {
  const item = items[index];
  if (!item) return [...items];
  const next = item.level + delta;
  if (next < 0 || next > 4 || (delta > 0 && (index === 0 || next > (items[index - 1] as SmartArtItem).level + 1))) return [...items];
  const end = subtreeEnd(items, index);
  return items.map((it, i) => (i >= index && i < end ? { ...it, level: Math.max(0, Math.min(4, it.level + delta)) } : it));
}

/** Deplace l'element (avec son sous-arbre) avant son frere precedent (-1) ou apres son frere suivant (+1). */
export function moveItem(items: readonly SmartArtItem[], index: number, delta: -1 | 1): SmartArtItem[] {
  const item = items[index];
  if (!item) return [...items];
  const end = subtreeEnd(items, index);
  const block = items.slice(index, end);
  if (delta > 0) {
    const next = items[end];
    if (!next || next.level !== item.level) return [...items];
    const nextEnd = subtreeEnd(items, end);
    return [...items.slice(0, index), ...items.slice(end, nextEnd), ...block, ...items.slice(nextEnd)];
  }
  let prev = index - 1;
  while (prev >= 0 && (items[prev] as SmartArtItem).level > item.level) prev--;
  if (prev < 0 || (items[prev] as SmartArtItem).level !== item.level) return [...items];
  return [...items.slice(0, prev), ...block, ...items.slice(prev, index), ...items.slice(end)];
}
