// Noms definis : validation (regles d'Excel), lignes du gestionnaire de noms avec filtres, fonctions recemment utilisees
// (menu Formules > Recemment utilisees). La creation depuis la selection (Ctrl+Maj+F3) est dans ../keys-logic.ts.
import { FormulaError, Matrix, formatValue, functionNameFromFr, getFunction, printFormula, quoteSheetName, toLocalized, type Scalar, type Value } from '@forgeoffice/formulas';
import { valueNode } from './evaluate.ts';
import { MAX_COLS, MAX_ROWS, columnIndex, rangeName, type CellRange, type DefinedName, type Workbook } from '@forgeoffice/xlsx';

export type NameError = 'empty' | 'tooLong' | 'invalid' | 'cellRef' | 'duplicate';

const NAME_RE = /^[A-Za-z_\\À-￿][A-Za-z0-9_.\\?À-￿]*$/;

/** Vrai si le nom se lit comme une reference de cellule (A1, XFD1048576) ou R1C1 (« R », « C », « RC », « R2C3 »). */
export function looksLikeCellRef(name: string): boolean {
  if (/^[RrCc]$/.test(name) || /^[Rr]\d*[Cc]\d*$/.test(name)) return true;
  const m = name.match(/^([A-Za-z]{1,3})(\d{1,7})$/);
  if (!m) return false;
  const col = columnIndex(m[1] ?? '');
  const row = Number(m[2]);
  return col >= 0 && col < MAX_COLS && row >= 1 && row <= MAX_ROWS;
}

/**
 * Erreur d'un nom propose : vide, trop long (255), caracteres ou premier caractere refuses, reference de cellule, deja pris dans la meme
 * etendue (`scope` = index de feuille, undefined = classeur). `editing` = index du nom modifie (il ne se compare pas a lui-meme).
 */
export function nameError(name: string, existing: readonly DefinedName[], scope: number | undefined, editing: number | null = null): NameError | null {
  if (name.length === 0) return 'empty';
  if (name.length > 255) return 'tooLong';
  if (!NAME_RE.test(name) || name.startsWith('_xlnm')) return 'invalid';
  if (looksLikeCellRef(name)) return 'cellRef';
  const clash = existing.some((n, i) => i !== editing && n.name.toLowerCase() === name.toLowerCase() && n.localSheet === scope);
  return clash ? 'duplicate' : null;
}

// ---------------------------------------------------------------- Gestionnaire de noms

/** Texte de la colonne Valeur : nombre au format general, texte entre guillemets, matrice {..;..}, erreur. */
export function valueSummary(v: Value | undefined): string {
  if (v === undefined || v === null) return '';
  if (v instanceof FormulaError) return toLocalized(`=${v.code}`, 'fr').slice(1);
  if (typeof v === 'object') {
    // Matrice : ecrite comme Excel en francais ({1;2;4}), 4 x 4 valeurs au plus puis « … ».
    const rows = Math.min(v.rows, 4);
    const cols = Math.min(v.cols, 4);
    const data: Scalar[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) data.push(v.get(r, c));
    const text = toLocalized(`=${printFormula(valueNode(new Matrix(rows, cols, data)))}`, 'fr').slice(1);
    return v.rows > 4 || v.cols > 4 ? `${text.slice(0, -1)}…}` : text;
  }
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
  if (typeof v === 'number') return formatValue(v, 'General', 'fr-FR');
  return `"${v}"`;
}

export interface NameRow {
  /** Index dans `Workbook.definedNames` ; -1 pour un tableau. */
  index: number;
  name: string;
  refersTo: string;
  scope: number | undefined;
  comment: string;
  value: string;
  hasError: boolean;
  isTable: boolean;
}

export type NameFilter = 'all' | 'sheet' | 'workbook' | 'errors' | 'noErrors' | 'names' | 'tables';

/** Lignes du gestionnaire : noms definis (sans les noms internes _xlnm) puis tableaux. `evaluate` calcule une formule de nom. */
export function nameRows(wb: Workbook, evaluate: (formula: string, sheet?: string) => Value | undefined): NameRow[] {
  const rows: NameRow[] = [];
  wb.definedNames.forEach((n, index) => {
    if (n.name.startsWith('_xlnm')) return;
    let v: Value | undefined;
    try {
      v = evaluate(n.formula, n.localSheet === undefined ? undefined : wb.sheets[n.localSheet]?.name);
    } catch {
      v = undefined; // formule de nom que le moteur refuse : valeur non affichee
    }
    const hasError = v instanceof FormulaError || /#REF!/.test(n.formula);
    rows.push({ index, name: n.name, refersTo: toLocalized(`=${n.formula}`, 'fr'), scope: n.localSheet, comment: n.comment ?? '', value: valueSummary(v), hasError, isTable: false });
  });
  for (const sh of wb.sheets) {
    for (const t of sh.tables) {
      rows.push({ index: -1, name: t.displayName || t.name, refersTo: `=${quoteSheetName(sh.name)}!${rangeName(t.ref, true)}`, scope: undefined, comment: t.comment ?? '', value: '', hasError: false, isTable: true });
    }
  }
  return rows;
}

/** Filtre du gestionnaire (Excel : noms de la feuille, du classeur, avec ou sans erreurs, noms definis, noms de tableau). */
export function filterNameRows(rows: readonly NameRow[], filter: NameFilter, sheetIndex: number): NameRow[] {
  switch (filter) {
    case 'sheet': return rows.filter((r) => r.scope === sheetIndex);
    case 'workbook': return rows.filter((r) => r.scope === undefined);
    case 'errors': return rows.filter((r) => r.hasError);
    case 'noErrors': return rows.filter((r) => !r.hasError);
    case 'names': return rows.filter((r) => !r.isTable);
    case 'tables': return rows.filter((r) => r.isTable);
    default: return [...rows];
  }
}

// ---------------------------------------------------------------- Fonctions recentes

export const RECENT_FUNCTIONS_KEY = 'excel.recentFunctions';
export const RECENT_FUNCTIONS_MAX = 10;

/** Liste mise a jour : la fonction passe en tete, sans doublon, 10 au plus (le plus recent d'abord). */
export function pushRecent(list: readonly string[], name: string): string[] {
  const up = name.toUpperCase();
  return [up, ...list.filter((n) => n !== up)].slice(0, RECENT_FUNCTIONS_MAX);
}

/** Noms de fonctions trouves dans une formule saisie (francais), pour alimenter la liste des recentes. */
export function functionsIn(formula: string): string[] {
  const out: string[] = [];
  const text = formula.replace(/"(?:[^"]|"")*"/g, '""');
  for (const m of text.matchAll(/([A-Za-zÀ-ÿ][A-Za-z0-9.À-ÿ]*)\s*\(/g)) {
    const n = (m[1] ?? '').toUpperCase();
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Retient dans la liste des recentes les fonctions du moteur qu'une formule saisie (francais) vient d'utiliser. */
export function rememberFunctions(settings: { get<T>(key: string, fallback: T): T; set<T>(key: string, value: T): void }, formula: string): void {
  let list = settings.get<string[]>(RECENT_FUNCTIONS_KEY, []);
  const used = functionsIn(formula).filter((n) => getFunction(functionNameFromFr(n)) !== undefined);
  if (used.length === 0) return;
  for (const n of used.reverse()) list = pushRecent(list, n);
  settings.set(RECENT_FUNCTIONS_KEY, list);
}
