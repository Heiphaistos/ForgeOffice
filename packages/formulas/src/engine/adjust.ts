// Reecriture des references d'une formule canonique : recopie (poignee), insertion/suppression
// de lignes et colonnes, renommage et suppression de feuille.
import type { RefNode } from '../parse/ast.ts';
import { rewriteTokens } from '../parse/localize.ts';
import { printRef } from '../parse/printer.ts';
import { MAX_COLS, MAX_ROWS, quoteSheetName } from '../refs.ts';

const REF_ERROR = '#REF!';
const same = (a: string | undefined, b: string): boolean => a !== undefined && a.toUpperCase() === b.toUpperCase();

/**
 * Formule recopiee de dRow lignes et dCol colonnes (copier/coller, poignee de recopie) :
 * les parties relatives se decalent, une reference qui sort de la feuille devient #REF!.
 */
export function translateFormula(formula: string, dRow: number, dCol: number): string {
  if (dRow === 0 && dCol === 0) return formula;
  return rewriteTokens(formula, (tk) => {
    if (tk.t !== 'ref' || tk.ref.sheetError) return undefined;
    const r: RefNode = { ...tk.ref };
    const moveRows = r.kind !== 'cols';
    const moveCols = r.kind !== 'rows';
    if (moveRows) {
      if (!r.ar1) r.r1 += dRow;
      if (!r.ar2) r.r2 += dRow;
    }
    if (moveCols) {
      if (!r.ac1) r.c1 += dCol;
      if (!r.ac2) r.c2 += dCol;
    }
    const out = r.r1 < 0 || r.r2 < 0 || r.c1 < 0 || r.c2 < 0 || r.r1 >= MAX_ROWS || r.r2 >= MAX_ROWS ||
      r.c1 >= MAX_COLS || r.c2 >= MAX_COLS;
    return out ? REF_ERROR : printRef(r);
  });
}

/** Insertion (count > 0) ou suppression (count < 0) de lignes ou colonnes a partir de l'indice `at` (base 0). */
export interface StructuralShift {
  sheet: string;
  axis: 'row' | 'col';
  at: number;
  count: number;
}

/** Nouvelles bornes [a, b] d'un intervalle apres decalage ; undefined si l'intervalle est detruit. */
export function shiftSpan(a: number, b: number, at: number, count: number, max: number): [number, number] | undefined {
  if (count > 0) {
    const na = a >= at ? a + count : a;
    const nb = b >= at ? b + count : b;
    if (na >= max) return undefined;
    return [na, Math.min(nb, max - 1)];
  }
  const n = -count;
  const last = at + n - 1;
  const na = a < at ? a : a > last ? a - n : at;
  const nb = b < at ? b : b > last ? b - n : at - 1;
  return nb < na ? undefined : [na, nb];
}

/**
 * Ajuste les references d'une formule a une insertion/suppression sur la feuille `shift.sheet`.
 * `formulaSheet` = feuille qui contient la formule (references sans nom de feuille) ; undefined pour un nom global.
 */
export function shiftFormula(formula: string, shift: StructuralShift, formulaSheet: string | undefined): string {
  return rewriteTokens(formula, (tk) => {
    if (tk.t !== 'ref') return undefined;
    const ref = tk.ref;
    if (ref.sheetError || ref.book !== undefined || ref.sheet2 !== undefined) return undefined;
    const onTarget = ref.sheet === undefined ? formulaSheet !== undefined && same(formulaSheet, shift.sheet) : same(ref.sheet, shift.sheet);
    if (!onTarget) return undefined;
    const r: RefNode = { ...ref };
    if (shift.axis === 'row') {
      if (r.kind === 'cols') return undefined;
      const s = shiftSpan(r.r1, r.r2, shift.at, shift.count, MAX_ROWS);
      if (!s) return ref.sheet === undefined ? REF_ERROR : `${quoteSheetName(ref.sheet)}!${REF_ERROR}`;
      [r.r1, r.r2] = s;
    } else {
      if (r.kind === 'rows') return undefined;
      const s = shiftSpan(r.c1, r.c2, shift.at, shift.count, MAX_COLS);
      if (!s) return ref.sheet === undefined ? REF_ERROR : `${quoteSheetName(ref.sheet)}!${REF_ERROR}`;
      [r.c1, r.c2] = s;
    }
    if (r.r1 === ref.r1 && r.r2 === ref.r2 && r.c1 === ref.c1 && r.c2 === ref.c2) return undefined;
    return printRef(r);
  });
}

/** Renomme une feuille dans les references d'une formule. */
export function renameSheetInFormula(formula: string, oldName: string, newName: string): string {
  return rewriteTokens(formula, (tk) => {
    if (tk.t === 'ref') {
      if (!same(tk.ref.sheet, oldName) && !same(tk.ref.sheet2, oldName)) return undefined;
      const r: RefNode = { ...tk.ref };
      if (same(r.sheet, oldName)) r.sheet = newName;
      if (same(r.sheet2, oldName)) r.sheet2 = newName;
      return printRef(r);
    }
    if (tk.t === 'name' && same(tk.sheet, oldName)) return `${quoteSheetName(newName)}!${tk.v}`;
    return undefined;
  });
}

/** References vers une feuille supprimee -> #REF! (comme Excel : =#REF!A1). */
export function removeSheetInFormula(formula: string, name: string): string {
  return rewriteTokens(formula, (tk) => {
    if (tk.t === 'ref' && (same(tk.ref.sheet, name) || same(tk.ref.sheet2, name))) {
      return printRef({ ...tk.ref, sheet: undefined, sheet2: undefined, book: undefined, sheetError: true });
    }
    if (tk.t === 'name' && same(tk.sheet, name)) return REF_ERROR;
    return undefined;
  });
}
