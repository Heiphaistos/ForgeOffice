// Modele de selection de la grille : plages multiples (Ctrl), cellule active, ancre d'extension (Maj),
// deplacements clavier (fleches, Ctrl+fleches jusqu'au bord des donnees, Entree/Tab dans la selection).
import { MAX_COLS, MAX_ROWS, columnName, type CellAddress, type CellRange } from '@forgeoffice/xlsx';

export interface Selection {
  /** Au moins une plage ; la derniere est la plage active. */
  ranges: readonly CellRange[];
  active: CellAddress;
  /** Coin fixe de la plage active (extension par Maj+clic / Maj+fleches). */
  anchor: CellAddress;
}

export function norm(a: CellAddress, b: CellAddress): CellRange {
  return { r1: Math.min(a.row, b.row), c1: Math.min(a.col, b.col), r2: Math.max(a.row, b.row), c2: Math.max(a.col, b.col) };
}

const clampRow = (r: number): number => Math.min(MAX_ROWS - 1, Math.max(0, r));
const clampCol = (c: number): number => Math.min(MAX_COLS - 1, Math.max(0, c));

export function cellSelection(row: number, col: number): Selection {
  const a = { row: clampRow(row), col: clampCol(col) };
  return { ranges: [{ r1: a.row, c1: a.col, r2: a.row, c2: a.col }], active: a, anchor: a };
}

export function rangeSelection(range: CellRange, active?: CellAddress): Selection {
  const a = active ?? { row: range.r1, col: range.c1 };
  return { ranges: [range], active: a, anchor: a };
}

/** Plage agrandie aux fusions qu'elle touche (une plage selectionnee ne coupe jamais une fusion). */
export function expandForMerges(range: CellRange, merges: readonly CellRange[]): CellRange {
  let r = { ...range };
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of merges) {
      if (m.r1 > r.r2 || m.r2 < r.r1 || m.c1 > r.c2 || m.c2 < r.c1) continue;
      const next = { r1: Math.min(r.r1, m.r1), c1: Math.min(r.c1, m.c1), r2: Math.max(r.r2, m.r2), c2: Math.max(r.c2, m.c2) };
      if (next.r1 !== r.r1 || next.c1 !== r.c1 || next.r2 !== r.r2 || next.c2 !== r.c2) {
        r = next;
        changed = true;
      }
    }
  }
  return r;
}

/** Maj+clic ou glisser : la plage active va de l'ancre a la cible. */
export function extendTo(sel: Selection, row: number, col: number, merges: readonly CellRange[] = []): Selection {
  const target = { row: clampRow(row), col: clampCol(col) };
  const range = expandForMerges(norm(sel.anchor, target), merges);
  return { ranges: [...sel.ranges.slice(0, -1), range], active: sel.active, anchor: sel.anchor };
}

/** Ctrl+clic : ajoute une nouvelle plage (selection discontinue). */
export function addCell(sel: Selection, row: number, col: number): Selection {
  const a = { row: clampRow(row), col: clampCol(col) };
  return { ranges: [...sel.ranges, { r1: a.row, c1: a.col, r2: a.row, c2: a.col }], active: a, anchor: a };
}

export function selectRows(r1: number, r2: number, add = false, prev?: Selection): Selection {
  const range = { r1: Math.min(r1, r2), c1: 0, r2: Math.max(r1, r2), c2: MAX_COLS - 1 };
  const active = { row: r1, col: prev && !add ? prev.active.col : 0 };
  return { ranges: add && prev ? [...prev.ranges, range] : [range], active: { row: range.r1, col: 0 }, anchor: active };
}

export function selectCols(c1: number, c2: number, add = false, prev?: Selection): Selection {
  const range = { r1: 0, c1: Math.min(c1, c2), r2: MAX_ROWS - 1, c2: Math.max(c1, c2) };
  const active = { row: 0, col: c1 };
  return { ranges: add && prev ? [...prev.ranges, range] : [range], active: { row: 0, col: range.c1 }, anchor: active };
}

export function selectAll(): Selection {
  return { ranges: [{ r1: 0, c1: 0, r2: MAX_ROWS - 1, c2: MAX_COLS - 1 }], active: { row: 0, col: 0 }, anchor: { row: 0, col: 0 } };
}

export function activeRange(sel: Selection): CellRange {
  return sel.ranges[sel.ranges.length - 1] ?? { r1: sel.active.row, c1: sel.active.col, r2: sel.active.row, c2: sel.active.col };
}

export function isSingleCell(sel: Selection, merges: readonly CellRange[] = []): boolean {
  if (sel.ranges.length !== 1) return false;
  const r = activeRange(sel);
  if (r.r1 === r.r2 && r.c1 === r.c2) return true;
  return merges.some((m) => m.r1 === r.r1 && m.c1 === r.c1 && m.r2 === r.r2 && m.c2 === r.c2);
}

export function isSelected(sel: Selection, row: number, col: number): boolean {
  return sel.ranges.some((r) => row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2);
}

export function isFullRows(r: CellRange): boolean {
  return r.c1 === 0 && r.c2 === MAX_COLS - 1;
}

export function isFullCols(r: CellRange): boolean {
  return r.r1 === 0 && r.r2 === MAX_ROWS - 1;
}

/** Fleches : deplace la cellule active (selection simple). `skip` saute les lignes/colonnes masquees. */
export function moveActive(sel: Selection, dr: number, dc: number, skip?: (row: number, col: number) => boolean): Selection {
  let row = clampRow(sel.active.row + dr);
  let col = clampCol(sel.active.col + dc);
  let guard = 0;
  while (skip && skip(row, col) && guard++ < 100_000) {
    const nr = clampRow(row + Math.sign(dr));
    const nc = clampCol(col + Math.sign(dc));
    if (nr === row && nc === col) break;
    row = nr;
    col = nc;
  }
  return cellSelection(row, col);
}

/** Maj+fleches : etend la plage active depuis l'ancre en deplacant le coin oppose. */
export function extendBy(sel: Selection, dr: number, dc: number): Selection {
  const r = activeRange(sel);
  const corner = {
    row: sel.anchor.row === r.r1 ? r.r2 : r.r1,
    col: sel.anchor.col === r.c1 ? r.c2 : r.c1,
  };
  return extendTo(sel, corner.row + dr, corner.col + dc);
}

/**
 * Ctrl+fleche : saute au bord du bloc de donnees (comme Excel). `filled(r, c)` indique une cellule non vide ;
 * `limit` = derniere cellule utilisee (au-dela, on va directement au bord de la feuille).
 */
export function jumpEdge(from: CellAddress, dr: number, dc: number, filled: (row: number, col: number) => boolean, limit: CellAddress): CellAddress {
  const inside = (r: number, c: number): boolean => r >= 0 && c >= 0 && r < MAX_ROWS && c < MAX_COLS;
  let r = from.row;
  let c = from.col;
  const edge = (): CellAddress => ({ row: dr === 0 ? r : dr > 0 ? MAX_ROWS - 1 : 0, col: dc === 0 ? c : dc > 0 ? MAX_COLS - 1 : 0 });
  if (filled(r, c) && inside(r + dr, c + dc) && filled(r + dr, c + dc)) {
    while (inside(r + dr, c + dc) && filled(r + dr, c + dc)) {
      r += dr;
      c += dc;
    }
    return { row: r, col: c };
  }
  while (inside(r + dr, c + dc)) {
    r += dr;
    c += dc;
    if (filled(r, c)) return { row: r, col: c };
    if ((dr > 0 && r > limit.row) || (dc > 0 && c > limit.col)) return edge();
  }
  return { row: r, col: c };
}

/** Entree / Tab dans une selection de plusieurs cellules : la cellule active parcourt la selection. */
export function cycleActive(sel: Selection, dr: number, dc: number): Selection {
  const r = activeRange(sel);
  if (r.r1 === r.r2 && r.c1 === r.c2 && sel.ranges.length === 1) return moveActive(sel, dr, dc);
  let { row, col } = sel.active;
  const forward = dr > 0 || dc > 0;
  const nextRange = (): Selection => {
    const idx = forward ? 0 : sel.ranges.length - 2;
    if (sel.ranges.length === 1) return { ...sel, active: forward ? { row: r.r1, col: r.c1 } : { row: r.r2, col: r.c2 } };
    const nr = sel.ranges[idx < 0 ? 0 : idx] ?? r;
    return rotate(sel, idx < 0 ? 0 : idx, forward ? { row: nr.r1, col: nr.c1 } : { row: nr.r2, col: nr.c2 });
  };
  if (dr !== 0) {
    row += dr;
    if (row > r.r2 || row < r.r1) {
      row = forward ? r.r1 : r.r2;
      col += forward ? 1 : -1;
      if (col > r.c2 || col < r.c1) return nextRange();
    }
  } else {
    col += dc;
    if (col > r.c2 || col < r.c1) {
      col = forward ? r.c1 : r.c2;
      row += forward ? 1 : -1;
      if (row > r.r2 || row < r.r1) return nextRange();
    }
  }
  return { ...sel, active: { row, col } };
}

/** Met la plage `idx` en derniere position (plage active) avec la cellule active donnee. */
function rotate(sel: Selection, idx: number, active: CellAddress): Selection {
  const target = sel.ranges[idx];
  if (!target) return sel;
  const others = sel.ranges.filter((_, i) => i !== idx);
  return { ranges: [...others, target], active, anchor: active };
}

/** Libelle de la zone Nom : « B3 », « A1:C4 », « 1:3 », « A:C ». */
export function rangeLabel(r: CellRange): string {
  if (isFullRows(r) && !isFullCols(r)) return `${r.r1 + 1}:${r.r2 + 1}`;
  if (isFullCols(r) && !isFullRows(r)) return `${columnName(r.c1)}:${columnName(r.c2)}`;
  const a = `${columnName(r.c1)}${r.r1 + 1}`;
  return r.r1 === r.r2 && r.c1 === r.c2 ? a : `${a}:${columnName(r.c2)}${r.r2 + 1}`;
}

/** Taille d'une plage pendant le glisser : « 3L x 2C ». */
export function sizeLabel(r: CellRange): string {
  return `${r.r2 - r.r1 + 1}L x ${r.c2 - r.c1 + 1}C`;
}

/** Plage bornee a une etendue utile (evite de parcourir 17 milliards de cellules). */
export function clipRange(r: CellRange, used: CellRange | undefined): CellRange | null {
  if (!used) return null;
  const out = { r1: Math.max(r.r1, used.r1), c1: Math.max(r.c1, used.c1), r2: Math.min(r.r2, used.r2), c2: Math.min(r.c2, used.c2) };
  return out.r1 > out.r2 || out.c1 > out.c2 ? null : out;
}
