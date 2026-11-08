// Filtre et tri du volet Commentaires (sans DOM, testé) : par texte, type, auteur ; tri par page, auteur, type ou date.
import type { Item, ItemKind } from './model.ts';

export type CommentSort = 'page' | 'author' | 'kind' | 'recent';

export interface CommentFilter {
  text: string;
  kind: ItemKind | 'all';
  author: string | 'all';
  sort: CommentSort;
}

export const NO_FILTER: CommentFilter = { text: '', kind: 'all', author: 'all', sort: 'page' };

export const isFiltering = (f: CommentFilter): boolean => f.text.trim() !== '' || f.kind !== 'all' || f.author !== 'all';

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Texte libre d'un élément (note, zone de texte, surlignage, texte modifié) ; vide pour les autres. */
export const itemText = (i: Item): string => ('text' in i ? i.text : '');

const matchesText = (haystack: string, needle: string): boolean => needle.trim() === '' || fold(haystack).includes(fold(needle.trim()));

/** Éléments gardés par le filtre, dans l'ordre demandé (tri stable). */
export function filterComments(items: readonly Item[], f: CommentFilter, kindLabel: (k: ItemKind) => string): Item[] {
  const kept = items.filter((i) => (f.kind === 'all' || i.kind === f.kind) && (f.author === 'all' || i.author === f.author) && matchesText(`${itemText(i)} ${i.author} ${kindLabel(i.kind)}`, f.text));
  const cmp: Readonly<Record<CommentSort, (a: Item, b: Item) => number>> = {
    page: (a, b) => a.page - b.page,
    author: (a, b) => a.author.localeCompare(b.author, 'fr') || a.page - b.page,
    kind: (a, b) => kindLabel(a.kind).localeCompare(kindLabel(b.kind), 'fr') || a.page - b.page,
    recent: (a, b) => b.at - a.at,
  };
  return kept.sort(cmp[f.sort]);
}

/** Auteurs présents, sans doublon, triés. */
export function authorsOf(items: readonly { author: string }[]): string[] {
  return [...new Set(items.map((i) => i.author).filter((a) => a !== ''))].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Types présents, dans l'ordre d'apparition. */
export function kindsOf(items: readonly Item[]): ItemKind[] {
  return [...new Set(items.map((i) => i.kind))];
}
