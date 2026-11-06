// Reecriture des references d'une formule canonique : recopie (poignee), insertion/suppression
// de lignes et colonnes, renommage et suppression de feuille.
import type { RefNode } from '../parse/ast.ts';
import { rewriteTokens } from '../parse/localize.ts';
import { printRef, printSheetPrefix } from '../parse/printer.ts';
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
  /**
   * Feuilles modifiees ensemble (feuilles groupees) : une reference 3D n'est ajustee que si toutes ses feuilles
   * en font partie. Comme Excel, une insertion sur une seule feuille laisse les references 3D inchangees.
   */
  group?: readonly string[];
  /** Noms des feuilles dans l'ordre des onglets (indispensable pour reconnaitre les feuilles d'une reference 3D). */
  order?: readonly string[];
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
    if (ref.sheetError || ref.book !== undefined) return undefined;
    const targets = shift.group && shift.group.length > 0 ? shift.group : [shift.sheet];
    const inGroup = (n: string | undefined): boolean => n !== undefined && targets.some((t) => same(n, t));
    const onTarget = ref.sheet2 !== undefined
      ? spanSheets(ref.sheet, ref.sheet2, shift.order).every(inGroup)
      : inGroup(ref.sheet === undefined ? formulaSheet : ref.sheet);
    if (!onTarget) return undefined;
    const r: RefNode = { ...ref };
    if (shift.axis === 'row') {
      if (r.kind === 'cols') return undefined;
      const s = shiftSpan(r.r1, r.r2, shift.at, shift.count, MAX_ROWS);
      if (!s) return ref.sheet === undefined ? REF_ERROR : `${printSheetPrefix(ref.sheet, ref.sheet2, undefined)}${REF_ERROR}`;
      [r.r1, r.r2] = s;
    } else {
      if (r.kind === 'rows') return undefined;
      const s = shiftSpan(r.c1, r.c2, shift.at, shift.count, MAX_COLS);
      if (!s) return ref.sheet === undefined ? REF_ERROR : `${printSheetPrefix(ref.sheet, ref.sheet2, undefined)}${REF_ERROR}`;
      [r.c1, r.c2] = s;
    }
    if (r.r1 === ref.r1 && r.r2 === ref.r2 && r.c1 === ref.c1 && r.c2 === ref.c2) return undefined;
    return printRef(r);
  });
}

/** Feuilles d'une reference 3D `a:b` (a seule si l'ordre des onglets est inconnu ou si une borne est introuvable). */
function spanSheets(a: string | undefined, b: string, order: readonly string[] | undefined): string[] {
  if (a === undefined) return [b];
  const i = order?.findIndex((n) => same(n, a)) ?? -1;
  const j = order?.findIndex((n) => same(n, b)) ?? -1;
  if (!order || i < 0 || j < 0) return [a, b];
  return order.slice(Math.min(i, j), Math.max(i, j) + 1);
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

/**
 * References vers une feuille supprimee -> #REF! (comme Excel : =#REF!A1). Avec `order` (onglets avant la
 * suppression), une reference 3D dont une borne est supprimee se raccourcit a la feuille voisine
 * (`A:C!B2` sans C devient `A:B!B2`) ; supprimer une feuille intermediaire ne la change pas.
 */
export function removeSheetInFormula(formula: string, name: string, order?: readonly string[]): string {
  return rewriteTokens(formula, (tk) => {
    if (tk.t === 'ref' && order && tk.ref.sheet !== undefined && tk.ref.sheet2 !== undefined && !tk.ref.sheetError) {
      const span = spanSheets(tk.ref.sheet, tk.ref.sheet2, order);
      const k = span.findIndex((n) => same(n, name));
      if (k >= 0 && span.length > 1) {
        const left = k === 0 ? 1 : 0;
        const right = k === span.length - 1 ? span.length - 2 : span.length - 1;
        const first = span[left] ?? name;
        const last = span[right] ?? name;
        if (k > 0 && k < span.length - 1) return undefined;
        return printRef({ ...tk.ref, sheet: first, sheet2: same(first, last) ? undefined : last });
      }
    }
    if (tk.t === 'ref' && (same(tk.ref.sheet, name) || same(tk.ref.sheet2, name))) {
      return printRef({ ...tk.ref, sheet: undefined, sheet2: undefined, book: undefined, sheetError: true });
    }
    if (tk.t === 'name' && same(tk.sheet, name)) return REF_ERROR;
    return undefined;
  });
}
