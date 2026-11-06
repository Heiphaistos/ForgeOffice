// Tableaux structures : extension automatique en tapant sous le tableau (ou a droite de la ligne d'en-tete) et colonnes calculees
// (une formule saisie dans une colonne vide du tableau se recopie sur toute la colonne), comme Excel.
import { parseFormula, printFormula, translateFormula } from '@forgeoffice/formulas';
import type { CellRange, Sheet, Table } from '@forgeoffice/xlsx';
import type { Entry } from '../cells.ts';
import type { Draft } from '../draft.ts';
import { mapNode } from './ast.ts';

/** Au-dela, la recopie d'une colonne calculee est abandonnee (comme les grandes recopies). */
const MAX_COLUMN_FILL = 5000;

/** Formule canonique d'une cellule de la ligne `row` du tableau, avec les references aux cellules de la meme ligne ecrites [@Colonne]. */
export function toStructured(formula: string, t: Table, row: number): string {
  const ast = mapNode(parseFormula(formula), (n) => {
    if (n.type !== 'ref' || n.kind !== 'cell' || n.sheet !== undefined || n.sheetError || n.r1 !== row) return undefined;
    if (n.c1 < t.ref.c1 || n.c1 > t.ref.c2) return undefined;
    const name = t.columns[n.c1 - t.ref.c1]?.name;
    return name === undefined ? undefined : { type: 'table', table: '', specials: ['#This Row'], col1: name };
  });
  return printFormula(ast);
}

const dataRows = (t: Table): [number, number] => [t.ref.r1 + t.headerRowCount, t.ref.r2 - t.totalsRowCount];

const overlaps = (a: CellRange, b: CellRange): boolean => a.r1 <= b.r2 && a.r2 >= b.r1 && a.c1 <= b.c2 && a.c2 >= b.c1;

function isBlank(sh: Sheet, row: number, col: number): boolean {
  const c = sh.cells.get(row)?.get(col);
  return !c || (c.value === null && c.formula === undefined);
}

function replaceTable(d: Draft, si: number, old: Table, next: Table): void {
  const sh = d.sheet(si);
  sh.tables = sh.tables.map((k) => (k === old ? next : k));
}

/** Etend le tableau d'une ligne (saisie juste sous lui) ou d'une colonne (en-tete saisi juste a droite) ; renvoie le tableau etendu. */
function expand(d: Draft, si: number, t: Table, row: number, col: number, entry: Entry & { ok: true }): Table | undefined {
  const sh = d.wb.sheets[si];
  if (!sh) return undefined;
  if (col >= t.ref.c1 && col <= t.ref.c2 && row === t.ref.r2 + 1 && t.totalsRowCount === 0) {
    const ref = { ...t.ref, r2: t.ref.r2 + 1 };
    if (sh.tables.some((k) => k !== t && overlaps(k.autoFilter?.ref ?? k.ref, ref))) return undefined;
    return { ...t, ref, ...(t.autoFilter ? { autoFilter: { ...t.autoFilter, ref: { ...t.autoFilter.ref, r2: ref.r2 } } } : {}) };
  }
  if (row === t.ref.r1 && col === t.ref.c2 + 1 && t.headerRowCount === 1 && typeof entry.value === 'string' && entry.value.trim() !== '') {
    const ref = { ...t.ref, c2: t.ref.c2 + 1 };
    if (sh.tables.some((k) => k !== t && overlaps(k.ref, ref))) return undefined;
    let name = entry.value.trim();
    while (t.columns.some((c) => c.name.toLowerCase() === name.toLowerCase())) name = `${name}2`;
    const columns = [...t.columns, { id: Math.max(0, ...t.columns.map((c) => c.id)) + 1, name }];
    return { ...t, ref, columns, ...(t.autoFilter ? { autoFilter: { ...t.autoFilter, ref: { ...t.autoFilter.ref, c2: ref.c2 } } } : {}) };
  }
  return undefined;
}

/**
 * Apres une saisie dans une cellule : extension automatique du tableau voisin, mise en forme de la nouvelle ligne et
 * recopie des colonnes calculees ; formule saisie dans une colonne vide = nouvelle colonne calculee, dans une colonne calculee
 * = nouvelle formule pour toute la colonne. A appeler pour une saisie unique (jamais pour un collage multiple).
 */
export function afterEntry(d: Draft, si: number, row: number, col: number, entry: Entry & { ok: true }): void {
  const sh0 = d.wb.sheets[si];
  if (!sh0 || sh0.tables.length === 0) return;
  const blank = entry.value === null && entry.formula === undefined;
  if (blank) return;
  const t = sh0.tables.find((k) => row >= k.ref.r1 && row <= k.ref.r2 && col >= k.ref.c1 && col <= k.ref.c2);
  if (!t) {
    const near = sh0.tables.find((k) => expand(d, si, k, row, col, entry) !== undefined);
    const grown = near ? expand(d, si, near, row, col, entry) : undefined;
    if (!near || !grown) return;
    replaceTable(d, si, near, grown);
    // Nouvelle ligne : mise en forme de la ligne du dessus et colonnes calculees.
    if (grown.ref.r2 > near.ref.r2) {
      for (let c = grown.ref.c1; c <= grown.ref.c2; c++) {
        const above = d.get(si, row - 1, c);
        const here = d.get(si, row, c);
        const styleId = above?.styleId;
        const calc = grown.columns[c - grown.ref.c1]?.calculatedFormula;
        if (c !== col && calc !== undefined && isBlank(d.wb.sheets[si] ?? sh0, row, c)) {
          const aboveFormula = above?.formula;
          d.set(si, row, c, { value: null, formula: aboveFormula !== undefined ? translateFormula(aboveFormula, 1, 0) : calc, ...(styleId ? { styleId } : {}) });
        } else if (styleId && !here?.styleId) d.set(si, row, c, here ? { ...here, styleId } : { value: null, styleId });
      }
    }
    return;
  }
  const [first, last] = dataRows(t);
  if (entry.formula === undefined || row < first || row > last || last - first + 1 > MAX_COLUMN_FILL) return;
  const ci = col - t.ref.c1;
  const column = t.columns[ci];
  if (!column) return;
  const sh = d.wb.sheets[si] ?? sh0;
  let calc = false;
  if (column.calculatedFormula !== undefined) calc = true;
  else if (last > first) {
    calc = true;
    for (let r = first; r <= last && calc; r++) if (r !== row && !isBlank(sh, r, col)) calc = false;
  }
  if (!calc) return;
  const structured = toStructured(entry.formula, t, row);
  replaceTable(d, si, t, { ...t, columns: t.columns.map((c, i) => (i === ci ? { ...c, calculatedFormula: structured } : c)) });
  for (let r = first; r <= last; r++) {
    if (r === row) continue;
    const old = d.get(si, r, col);
    d.set(si, r, col, { value: null, formula: translateFormula(entry.formula, r - row, 0), ...(old?.styleId ? { styleId: old.styleId } : {}) });
  }
}
