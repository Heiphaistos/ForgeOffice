// Textes de plages (« B2:D5 ») et mesures simples sur une feuille.
import type { CellRange } from '@forgeoffice/xlsx';

/** Plage « A1 » ou « A1:C3 » (sans nom de feuille, majuscules) ; undefined si le texte n'est pas une plage. */
export function rangeFromText(t: string): CellRange | undefined {
  const [a = '', b = a] = t.split(':');
  const pa = a.match(/^([A-Z]+)(\d+)$/);
  const pb = b.match(/^([A-Z]+)(\d+)$/);
  if (!pa || !pb) return undefined;
  const col = (s: string): number => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const r1 = Number(pa[2]) - 1;
  const r2 = Number(pb[2]) - 1;
  const c1 = col(pa[1] ?? 'A');
  const c2 = col(pb[1] ?? 'A');
  return { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
}

/** Derniere colonne contenant une cellule. */
export function lastCol(sheet: { cells: Map<number, Map<number, unknown>> }): number {
  let max = 0;
  for (const line of sheet.cells.values()) for (const c of line.keys()) if (c > max) max = c;
  return max;
}
