// Selection de plage de la feuille de donnees : rectangle de cellules entre deux coins, en tenant compte de l'ordre
// d'affichage des colonnes (sans DOM, teste).
import { toTsv } from './columns-layout.ts';

export interface GridCell {
  row: number;
  /** Indice du champ dans la source (pas le rang d'affichage). */
  col: number;
}

export interface GridRange {
  a: GridCell;
  b: GridCell;
}

export interface RangeBox {
  r1: number;
  r2: number;
  /** Champs de la plage, dans l'ordre d'affichage. */
  cols: number[];
}

/** Rectangle couvert par la plage ; null si un coin n'est pas affiche (champ masque). */
export function rangeBox(range: GridRange, shown: readonly number[]): RangeBox | null {
  const pa = shown.indexOf(range.a.col);
  const pb = shown.indexOf(range.b.col);
  if (pa < 0 || pb < 0) return null;
  return { r1: Math.min(range.a.row, range.b.row), r2: Math.max(range.a.row, range.b.row), cols: shown.slice(Math.min(pa, pb), Math.max(pa, pb) + 1) };
}

export const inBox = (box: RangeBox | null, row: number, col: number): boolean => box !== null && row >= box.r1 && row <= box.r2 && box.cols.includes(col);

/** Plage d'une ligne entiere / d'une colonne entiere / de toute la grille. */
export const rowRange = (row: number, shown: readonly number[]): GridRange => ({ a: { row, col: shown[0] ?? 0 }, b: { row, col: shown[shown.length - 1] ?? 0 } });
export const columnRange = (col: number, rowCount: number): GridRange => ({ a: { row: 0, col }, b: { row: Math.max(0, rowCount - 1), col } });
export const allRange = (rowCount: number, shown: readonly number[]): GridRange => ({ a: { row: 0, col: shown[0] ?? 0 }, b: { row: Math.max(0, rowCount - 1), col: shown[shown.length - 1] ?? 0 } });

/** Texte tabule d'une plage ; `text(row, col)` donne le texte affiche d'une cellule. Avec `headers`, ajoute la ligne des intitules. */
export function rangeText(box: RangeBox, text: (row: number, col: number) => string, headers?: (col: number) => string): string {
  const lines: string[][] = headers ? [box.cols.map(headers)] : [];
  for (let r = box.r1; r <= box.r2; r++) lines.push(box.cols.map((c) => text(r, c)));
  return toTsv(lines);
}
