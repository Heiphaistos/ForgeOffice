// « Rechercher suivant » (Maj+F4) : memorise la derniere recherche de la boite Rechercher et cherche la cellule suivante/precedente.
import type { Sheet } from '@forgeoffice/xlsx';

export interface FindQuery {
  what: string;
  matchCase: boolean;
  whole: boolean;
  inFormulas: boolean;
}

let last: FindQuery | null = null;
export const setLastFind = (q: FindQuery): void => {
  last = q.what ? { ...q } : last;
};
export const lastFind = (): FindQuery | null => last;

/** Meme regle que la boite Rechercher : contient (ou egale) le texte, casse selon l'option. */
export function matchesQuery(text: string, q: FindQuery): boolean {
  if (!q.what) return false;
  const a = q.matchCase ? text : text.toLowerCase();
  const b = q.matchCase ? q.what : q.what.toLowerCase();
  return q.whole ? a === b : a.includes(b);
}

/**
 * Cellule suivante (ou precedente) qui correspond, en parcourant ligne par ligne et en bouclant sur la feuille ;
 * `textOf` donne le texte a comparer (affiche, ou formule si `inFormulas`).
 */
export function findFrom(sh: Sheet, from: { row: number; col: number }, q: FindQuery, backwards: boolean, textOf: (row: number, col: number) => string): { row: number; col: number } | null {
  const hits: { row: number; col: number }[] = [];
  for (const row of [...sh.cells.keys()].sort((a, b) => a - b)) {
    for (const col of [...(sh.cells.get(row)?.keys() ?? [])].sort((a, b) => a - b)) {
      if (matchesQuery(textOf(row, col), q)) hits.push({ row, col });
      if (hits.length >= 50_000) break;
    }
  }
  if (!hits.length) return null;
  const after = (h: { row: number; col: number }): boolean => h.row > from.row || (h.row === from.row && h.col > from.col);
  const before = (h: { row: number; col: number }): boolean => h.row < from.row || (h.row === from.row && h.col < from.col);
  if (backwards) return [...hits].reverse().find(before) ?? hits[hits.length - 1] ?? null;
  return hits.find(after) ?? hits[0] ?? null;
}
