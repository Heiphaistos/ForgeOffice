// Fonctions pures extraites du moteur : antecedents/dependants, debordement bloque, reecriture et selection des formules a recalculer.
import { parseFormula } from '../parse/parser.ts';
import { MAX_COLS, MAX_ROWS, cellKey } from '../refs.ts';
import type { Matrix } from '../values.ts';
import type { DependencyIndex } from './deps.ts';
import type { FCell, NameEntry, Sheet } from './types.ts';
import { isStructureSensitive, isVolatile } from './util.ts';

/** Zone lue par une formule (un precedent) ou cellule qui en depend. */
export interface TracedArea {
  sheet: string;
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

/** Zones lues par la formule `f` lors de son dernier calcul, toutes feuilles confondues. */
export function tracePrecedents(deps: DependencyIndex<FCell>, sheets: ReadonlyMap<number, Sheet>, f: FCell): TracedArea[] {
  const p = deps.precedents(f);
  const name = (id: number): string | undefined => sheets.get(id)?.name;
  const out: TracedArea[] = [];
  for (const k of p.cells) {
    const id = Math.floor(k / 2 ** 34);
    const rest = k - id * 2 ** 34;
    const n = name(id);
    const r = Math.floor(rest / MAX_COLS);
    const c = rest % MAX_COLS;
    if (n !== undefined) out.push({ sheet: n, r1: r, c1: c, r2: r, c2: c });
  }
  for (const a of p.areas) {
    const n = name(a.sheet);
    if (n !== undefined && !(a.sheet === f.sheet.id && a.r1 === f.row && a.c1 === f.col)) out.push({ sheet: n, r1: a.r1, c1: a.c1, r2: a.r2, c2: a.c2 });
  }
  return out;
}

/** Vrai si le resultat matriciel `m` de `f` heurte une cellule occupee ou sort de la feuille. */
export function spillBlocked(f: FCell, m: Matrix): boolean {
  if (f.row + m.rows > MAX_ROWS || f.col + m.cols > MAX_COLS) return true;
  const sh = f.sheet;
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      if (r === 0 && c === 0) continue;
      const k = cellKey(f.row + r, f.col + c);
      if (sh.values.has(k) || sh.formulas.has(k)) return true;
      const owner = sh.spill.get(k);
      if (owner && owner !== f && !owner.dead) return true;
    }
  }
  return false;
}

/** Reecrit toutes les formules (cellules et noms) avec `fn` ; renvoie les cellules et noms modifies. */
export function rewriteFormulas(
  sheets: ReadonlyMap<number, Sheet>,
  names: Map<string, NameEntry>,
  volatiles: Set<FCell>,
  fn: (text: string, sheetName: string | undefined) => string,
): { cells: FCell[]; names: string[] } {
  const changed: FCell[] = [];
  const changedNames: string[] = [];
  for (const sh of sheets.values()) {
    for (const f of sh.formulas.values()) {
      const t = fn(f.text, sh.name);
      if (t === f.text) continue;
      changed.push(f);
      f.text = t;
      f.ast = parseFormula(t);
      f.volatile = isVolatile(f.ast);
      if (f.volatile) volatiles.add(f);
      else volatiles.delete(f);
    }
  }
  for (const [k, n] of names) {
    const t = fn(n.text, n.sheet === undefined ? undefined : sheets.get(n.sheet)?.name);
    if (t === n.text) continue;
    changedNames.push(k.slice(k.indexOf('|') + 1));
    n.text = t;
    n.node = parseFormula(t);
  }
  return { cells: changed, names: changedNames };
}

/**
 * Formules a recalculer apres un changement de feuille, de nom ou de tableau : celles dont le texte mentionne un des
 * `tokens` (ou un nom qui en depend), celles qui lisent la structure du classeur (INDIRECT, FEUILLE, CELLULE...), celles
 * de `extra`, et avec `structured` toutes les formules a references structurees.
 */
export function collectDirty(
  sheets: ReadonlyMap<number, Sheet>,
  names: ReadonlyMap<string, NameEntry>,
  tokens: string[],
  extra: Iterable<FCell>,
  structured: boolean,
): Set<FCell> {
  const keys = tokens.map((t) => t.toUpperCase());
  for (let grew = true; grew;) {
    grew = false;
    for (const [k, n] of names) {
      const own = k.slice(k.indexOf('|') + 1);
      if (!keys.includes(own) && keys.some((t) => n.text.toUpperCase().includes(t))) {
        keys.push(own);
        grew = true;
      }
    }
  }
  const hit = new Set<FCell>(extra);
  for (const sh of sheets.values()) {
    for (const f of sh.formulas.values()) {
      if (hit.has(f)) continue;
      const up = f.text.toUpperCase();
      if ((structured && up.includes('[')) || keys.some((t) => up.includes(t)) || isStructureSensitive(f.ast)) hit.add(f);
    }
  }
  return hit;
}
