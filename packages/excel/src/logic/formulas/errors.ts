// Verification des erreurs (triangle vert, Formules > Verification des erreurs) : les regles d'Excel qui s'appliquent a une cellule,
// recherche de la suivante, correctifs proposes (convertir en nombre, inclure les cellules omises, recopier la formule voisine).
import { FormulaError, parseFormula, parseNumberText, printFormula, translateFormula, type Node, type Scalar } from '@forgeoffice/formulas';
import type { Cell, Sheet } from '@forgeoffice/xlsx';
import { walk } from './ast.ts';
import { toStructured } from './table-auto.ts';

export type ErrorRuleId = 'formulaError' | 'textNumber' | 'inconsistent' | 'omitted' | 'unlocked' | 'emptyRef' | 'columnInconsistent';

export const ERROR_RULES: readonly ErrorRuleId[] = ['formulaError', 'columnInconsistent', 'textNumber', 'inconsistent', 'omitted', 'unlocked', 'emptyRef'];

/** Reglages par defaut d'Excel : tout actif sauf « formules faisant reference a des cellules vides ». */
export const DEFAULT_ERROR_RULES: Readonly<Record<ErrorRuleId, boolean>> = {
  formulaError: true, columnInconsistent: true, textNumber: true, inconsistent: true, omitted: true, unlocked: true, emptyRef: false,
};

export const ERROR_RULES_KEY = 'excel.errorRules';

export interface Finding {
  rule: ErrorRuleId;
  row: number;
  col: number;
  /** Code d'erreur pour `formulaError`. */
  detail?: string;
}

export interface CheckEnv {
  sheet: Sheet;
  /** Valeur calculee (formules) ou saisie. */
  value: (row: number, col: number) => Scalar;
  isLocked: (row: number, col: number) => boolean;
  rules: Readonly<Record<ErrorRuleId, boolean>>;
}

const cellAt = (sheet: Sheet, row: number, col: number): Cell | undefined => sheet.cells.get(row)?.get(col);
const AGGREGATES = new Set(['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'PRODUCT', 'MEDIAN']);
const NUMBER_TEXT = /^\s*[-+]?\d[\d\s .,]*%?\s*$/;

/** Formule d'un voisin ramenee a la position (row, col) ; null si elle sort de la feuille ou n'est pas lisible. */
function movedFormula(f: string, dRow: number, dCol: number): string | null {
  try {
    const out = translateFormula(f, dRow, dCol);
    return out.includes('#REF!') ? null : printFormula(parseFormula(out));
  } catch {
    return null; // formule que l'analyseur refuse : pas de comparaison possible
  }
}

/** Formule d'une cellule de tableau ecrite avec [@Colonne], pour la comparer a la formule de la colonne calculee. */
function structuredOf(f: string, t: Parameters<typeof toStructured>[1], row: number): string | null {
  try {
    return toStructured(f, t, row);
  } catch {
    return null; // formule illisible : pas de comparaison
  }
}

function canonical(f: string): string | null {
  try {
    return printFormula(parseFormula(f));
  } catch {
    return null;
  }
}

/** Voisins qui, ensemble, disent que la formule est incoherente : [gauche, droite] puis [haut, bas] doivent donner la meme formule. */
function inconsistentWithNeighbours(env: CheckEnv, row: number, col: number, own: string): boolean {
  const mine = canonical(own);
  if (mine === null) return false;
  const pairs: [number, number][][] = [[[0, -1], [0, 1]], [[-1, 0], [1, 0]]];
  for (const [a, b] of pairs) {
    if (!a || !b) continue;
    const fa = cellAt(env.sheet, row + a[0], col + a[1])?.formula;
    const fb = cellAt(env.sheet, row + b[0], col + b[1])?.formula;
    if (fa === undefined || fb === undefined) continue;
    const ma = movedFormula(fa, -a[0], -a[1]);
    const mb = movedFormula(fb, -b[0], -b[1]);
    if (ma !== null && ma === mb && ma !== mine) return true;
  }
  return false;
}

/** Adjacent a la plage d'une fonction de totalisation et numerique : { where } indique le cote ('before' ou 'after'). */
function omittedCell(env: CheckEnv, row: number, col: number, formula: string): { r: number; c: number } | null {
  let ast: Node;
  try {
    ast = parseFormula(formula);
  } catch {
    return null;
  }
  let hit: { r: number; c: number } | null = null;
  walk(ast, (n) => {
    if (hit || n.type !== 'call' || !AGGREGATES.has(n.name.toUpperCase())) return;
    for (const a of n.args) {
      if (a.type !== 'ref' || a.kind !== 'area' || a.sheet !== undefined) continue;
      const column = a.c1 === a.c2;
      const line = a.r1 === a.r2;
      const probes: [number, number][] = column ? [[a.r1 - 1, a.c1], [a.r2 + 1, a.c1]] : line ? [[a.r1, a.c1 - 1], [a.r1, a.c2 + 1]] : [];
      for (const [r, c] of probes) {
        if (r < 0 || c < 0 || (r === row && c === col)) continue;
        const k = cellAt(env.sheet, r, c);
        if (k && k.formula === undefined && typeof k.value === 'number') {
          hit = { r, c };
          return;
        }
      }
    }
  });
  return hit;
}

/** Une cellule referencee est vide (regle desactivee par defaut). */
function refersToEmpty(env: CheckEnv, formula: string): boolean {
  let ast: Node;
  try {
    ast = parseFormula(formula);
  } catch {
    return false;
  }
  let found = false;
  walk(ast, (n) => {
    if (found || n.type !== 'ref' || n.kind !== 'cell' || n.sheet !== undefined || n.sheetError) return;
    const k = cellAt(env.sheet, n.r1, n.c1);
    if (!k || k.value === null || k.value === '') found = true;
  });
  return found;
}

/** Premiere regle violee par la cellule, ou null. */
export function checkCell(env: CheckEnv, row: number, col: number): Finding | null {
  const cell = cellAt(env.sheet, row, col);
  if (!cell) return null;
  const { rules } = env;
  const f = cell.formula;
  if (f !== undefined) {
    const v = env.value(row, col);
    if (rules.formulaError && v instanceof FormulaError) return { rule: 'formulaError', row, col, detail: v.code };
    if (rules.columnInconsistent) {
      const t = env.sheet.tables.find((k) => row >= k.ref.r1 + k.headerRowCount && row <= k.ref.r2 - k.totalsRowCount && col >= k.ref.c1 && col <= k.ref.c2);
      const calc = t?.columns[col - (t?.ref.c1 ?? 0)]?.calculatedFormula;
      if (t && calc !== undefined && canonical(calc) !== structuredOf(f, t, row)) return { rule: 'columnInconsistent', row, col };
    }
    if (rules.inconsistent && inconsistentWithNeighbours(env, row, col, f)) return { rule: 'inconsistent', row, col };
    if (rules.omitted && omittedCell(env, row, col, f)) return { rule: 'omitted', row, col };
    if (rules.unlocked && !env.isLocked(row, col)) return { rule: 'unlocked', row, col };
    if (rules.emptyRef && refersToEmpty(env, f)) return { rule: 'emptyRef', row, col };
    return null;
  }
  if (rules.textNumber && typeof cell.value === 'string' && NUMBER_TEXT.test(cell.value) && parseNumberText(cell.value.trim(), 'fr-FR') !== undefined) {
    return { rule: 'textNumber', row, col };
  }
  return null;
}

/** Cle d'une erreur ignoree (« Ignorer l'erreur ») : feuille, cellule et regle. */
export const ignoreKey = (sheet: string, f: Finding): string => `${sheet}|${f.row}|${f.col}|${f.rule}`;

/** Toutes les erreurs de la feuille, dans l'ordre de lecture (ligne par ligne), hors erreurs ignorees. */
export function allErrors(env: CheckEnv, ignored: ReadonlySet<string>): Finding[] {
  const out: Finding[] = [];
  for (const r of [...env.sheet.cells.keys()].sort((a, b) => a - b)) {
    const line = env.sheet.cells.get(r);
    if (!line) continue;
    for (const c of [...line.keys()].sort((a, b) => a - b)) {
      const f = checkCell(env, r, c);
      if (f && !ignored.has(ignoreKey(env.sheet.name, f))) out.push(f);
    }
  }
  return out;
}

/** Prochaine cellule en erreur apres (row, col), en bouclant sur la feuille ; null s'il n'y en a aucune. */
export function findNextError(env: CheckEnv, from: { row: number; col: number }, ignored: ReadonlySet<string>): Finding | null {
  const all = allErrors(env, ignored);
  return all.find((f) => f.row > from.row || (f.row === from.row && f.col > from.col)) ?? all[0] ?? null;
}

/** Erreur precedente avant (row, col), en bouclant sur la feuille. */
export function findPreviousError(env: CheckEnv, from: { row: number; col: number }, ignored: ReadonlySet<string>): Finding | null {
  const all = allErrors(env, ignored);
  const before = all.filter((f) => f.row < from.row || (f.row === from.row && f.col < from.col));
  return before[before.length - 1] ?? all[all.length - 1] ?? null;
}

// ---------------------------------------------------------------- Correctifs

export type FixKind = 'toNumber' | 'includeCells' | 'copyAbove' | 'copyLeft' | 'copyBelow' | 'copyRight' | 'lock';

export interface Fix {
  kind: FixKind;
  /** Nouvelle formule canonique (sans « = »). */
  formula?: string;
  /** Nouvelle valeur numerique. */
  number?: number;
}

/** Plage de la fonction de totalisation etendue jusqu'a la cellule omise. */
function extendedFormula(env: CheckEnv, row: number, col: number, formula: string): string | undefined {
  const miss = omittedCell(env, row, col, formula);
  if (!miss) return undefined;
  const ast = parseFormula(formula);
  walk(ast, (n) => {
    if (n.type !== 'ref' || n.kind !== 'area' || n.sheet !== undefined) return;
    if (n.c1 === n.c2 && n.c1 === miss.c) {
      if (miss.r < n.r1) n.r1 = miss.r;
      else if (miss.r > n.r2) n.r2 = miss.r;
    } else if (n.r1 === n.r2 && n.r1 === miss.r) {
      if (miss.c < n.c1) n.c1 = miss.c;
      else if (miss.c > n.c2) n.c2 = miss.c;
    }
  });
  return printFormula(ast);
}

/** Correctifs proposes pour une erreur trouvee. */
export function fixesFor(env: CheckEnv, f: Finding): Fix[] {
  const cell = cellAt(env.sheet, f.row, f.col);
  if (!cell) return [];
  if (f.rule === 'textNumber' && typeof cell.value === 'string') {
    const n = parseNumberText(cell.value.trim(), 'fr-FR');
    return n === undefined ? [] : [{ kind: 'toNumber', number: n }];
  }
  if (f.rule === 'omitted' && cell.formula !== undefined) {
    const formula = extendedFormula(env, f.row, f.col, cell.formula);
    return formula ? [{ kind: 'includeCells', formula }] : [];
  }
  if (f.rule === 'inconsistent') {
    const out: Fix[] = [];
    const sides: [FixKind, number, number][] = [['copyAbove', -1, 0], ['copyLeft', 0, -1], ['copyBelow', 1, 0], ['copyRight', 0, 1]];
    for (const [kind, dr, dc] of sides) {
      const nf = cellAt(env.sheet, f.row + dr, f.col + dc)?.formula;
      const moved = nf === undefined ? null : movedFormula(nf, -dr, -dc);
      if (moved !== null) out.push({ kind, formula: moved });
    }
    return out;
  }
  if (f.rule === 'unlocked') return [{ kind: 'lock' }];
  return [];
}
