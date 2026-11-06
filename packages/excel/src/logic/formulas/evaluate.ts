// Evaluation de formule pas a pas (Formules > Evaluation de formule) : a chaque pas, la plus petite sous-expression prete
// (reference, operation ou fonction dont les operandes sont des valeurs) est remplacee par son resultat, comme dans Excel.
// Pas a pas detaille = entrer dans la formule d'une cellule referencee ; pas sortant = finir cette formule et revenir.
import { FormulaError, Matrix, parseFormula, printFormula, toLocalized, type Node, type Value } from '@forgeoffice/formulas';

/** Calcule une formule canonique (sans « = ») dans le contexte d'une feuille. */
export interface EvalEnv {
  evaluate: (canonical: string, sheet: string) => Value;
  /** Formule canonique (sans « = ») de la cellule, undefined si c'est une constante. */
  formulaAt: (sheet: string, row: number, col: number) => string | undefined;
}

export interface EvalFrame {
  ast: Node;
  sheet: string;
  /** « Feuil1!B4 » : cellule dont la formule est evaluee. */
  origin: string;
}

export interface EvalState {
  frames: readonly EvalFrame[];
}

/** Fonctions qui evaluent toutes leurs formes en un seul pas (variables locales, evaluation paresseuse de plusieurs branches). */
const WHOLE = new Set(['LET', 'LAMBDA', 'MAP', 'REDUCE', 'SCAN', 'BYROW', 'BYCOL', 'MAKEARRAY', 'ISOMITTED', 'IFS', 'SWITCH', 'IFNA', 'AND', 'OR', 'XOR']);
/** Fonctions dont les arguments restent des references (la reference est leur objet, pas sa valeur). */
const KEEP_REFS = new Set([
  'ROW', 'COLUMN', 'ROWS', 'COLUMNS', 'OFFSET', 'INDEX', 'INDIRECT', 'ISREF', 'AREAS', 'CELL', 'FORMULATEXT', 'ISFORMULA', 'SHEET', 'SHEETS',
  'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS', 'AVERAGEIF', 'AVERAGEIFS', 'MAXIFS', 'MINIFS', 'VLOOKUP', 'HLOOKUP', 'LOOKUP', 'MATCH', 'XLOOKUP', 'XMATCH',
  'SUBTOTAL', 'AGGREGATE', 'GETPIVOTDATA', 'COUNTBLANK',
]);
const LAZY_FIRST = new Set(['IF', 'IFERROR', 'CHOOSE']);
/** Au-dela, une zone n'est pas developpee en matrice : la fonction qui la lit se calcule d'un coup. */
const MAX_EXPANDED_CELLS = 12;
const MAX_STEPS = 2000;

const LITERAL = new Set(['num', 'str', 'bool', 'err', 'array', 'missing']);
const isLiteral = (n: Node): boolean => LITERAL.has(n.type) || (n.type === 'paren' && n.arg.type === 'num' && n.arg.value < 0);

function children(n: Node): Node[] {
  switch (n.type) {
    case 'unary': case 'postfix': case 'paren': return [n.arg];
    case 'binary': return [n.left, n.right];
    case 'call': return n.args;
    case 'invoke': return [n.callee, ...n.args];
    default: return [];
  }
}

function withChildren(n: Node, kids: Node[]): Node {
  switch (n.type) {
    case 'unary': case 'postfix': case 'paren': return { ...n, arg: kids[0] ?? n.arg };
    case 'binary': return { ...n, left: kids[0] ?? n.left, right: kids[1] ?? n.right };
    case 'call': return { ...n, args: kids };
    case 'invoke': return { ...n, callee: kids[0] ?? n.callee, args: kids.slice(1) };
    default: return n;
  }
}

function bigRef(n: Node): boolean {
  return n.type === 'ref' && n.kind !== 'cell' && (n.r2 - n.r1 + 1) * (n.c2 - n.c1 + 1) > MAX_EXPANDED_CELLS;
}

/** Chemin (indices d'enfants) de la prochaine sous-expression a evaluer ; null si `n` est deja une valeur. */
export function nextPath(n: Node, keepRefs = false): number[] | null {
  if (isLiteral(n)) return null;
  switch (n.type) {
    case 'ref': return keepRefs || bigRef(n) ? null : [];
    case 'name': case 'table': return keepRefs ? null : [];
    case 'binary':
      if (n.op === ':' || n.op === ' ' || n.op === ',') return keepRefs ? null : [];
      break;
    case 'invoke': return [];
    case 'call':
      if (WHOLE.has(n.name.toUpperCase())) return [];
      break;
    default:
  }
  const kids = children(n);
  const lazy = n.type === 'call' && LAZY_FIRST.has(n.name.toUpperCase());
  const keep = n.type === 'call' && KEEP_REFS.has(n.name.toUpperCase());
  for (let i = 0; i < (lazy ? Math.min(1, kids.length) : kids.length); i++) {
    const kid = kids[i];
    if (!kid) continue;
    const p = nextPath(kid, keep);
    if (p) return [i, ...p];
  }
  return [];
}

function nodeAt(root: Node, path: readonly number[]): Node {
  let n = root;
  for (const i of path) n = children(n)[i] ?? n;
  return n;
}

function replaceAt(root: Node, path: readonly number[], value: Node): Node {
  const head = path[0];
  if (head === undefined) return value;
  const kids = children(root);
  const kid = kids[head];
  if (!kid) return root;
  let sub = replaceAt(kid, path.slice(1), value);
  // Un nombre negatif sous un operateur garde ses parentheses ((-5)^2 et non -5^2).
  if (path.length === 1 && sub.type === 'num' && sub.value < 0 && root.type !== 'call' && root.type !== 'paren' && root.type !== 'invoke') sub = { type: 'paren', arg: sub };
  const next = kids.slice();
  next[head] = sub;
  return withChildren(root, next);
}

/** Valeur du moteur -> noeud litteral. */
export function valueNode(v: Value): Node {
  if (v instanceof FormulaError) return { type: 'err', code: v.code };
  if (v instanceof Matrix) {
    if (v.rows === 1 && v.cols === 1) return valueNode(v.get(0, 0));
    const rows: Node[][] = [];
    for (let r = 0; r < v.rows; r++) {
      const line: Node[] = [];
      for (let c = 0; c < v.cols; c++) line.push(valueNode(v.get(r, c)));
      rows.push(line);
    }
    return { type: 'array', rows };
  }
  if (v === null) return { type: 'num', value: 0 };
  if (typeof v === 'number') return { type: 'num', value: v };
  if (typeof v === 'boolean') return { type: 'bool', value: v };
  return { type: 'str', value: v };
}

const print = (n: Node): string => printFormula(n);

/** Remplace le noeud pret par son resultat. */
function reduce(n: Node, env: EvalEnv, sheet: string): Node {
  if (n.type === 'paren') return n.arg;
  if (n.type === 'call') {
    const name = n.name.toUpperCase();
    const [a0, a1, a2] = n.args;
    if (name === 'IF' && a0) {
      const c = env.evaluate(`IF(${print(a0)},TRUE,FALSE)`, sheet);
      if (c instanceof FormulaError) return valueNode(c);
      if (c === true) return a1 && a1.type !== 'missing' ? a1 : { type: 'num', value: 0 };
      return a2 ? (a2.type === 'missing' ? { type: 'num', value: 0 } : a2) : { type: 'bool', value: false };
    }
    if (name === 'IFERROR' && a0) return a0.type === 'err' ? (a1 ?? { type: 'num', value: 0 }) : a0;
    if (name === 'CHOOSE' && a0) {
      const i = env.evaluate(print(a0), sheet);
      const k = typeof i === 'number' ? Math.trunc(i) : 0;
      return k >= 1 && k < n.args.length ? (n.args[k] ?? valueNode(new FormulaError('#VALUE!'))) : valueNode(new FormulaError('#VALUE!'));
    }
  }
  return valueNode(env.evaluate(print(n), sheet));
}

// ---------------------------------------------------------------- Etat de l'evaluation

export function startEvaluation(canonicalFormula: string, sheet: string, origin: string): EvalState {
  return { frames: [{ ast: parseFormula(canonicalFormula), sheet, origin }] };
}

const top = (s: EvalState): EvalFrame => s.frames[s.frames.length - 1] as EvalFrame;

/** Chemin du prochain pas dans le cadre courant ; une valeur non litterale (grande zone) se reduit d'un coup. */
function pathOf(f: EvalFrame): number[] | null {
  return nextPath(f.ast) ?? (isLiteral(f.ast) ? null : []);
}

/** Vrai si le cadre courant est entierement evalue. */
export function frameDone(s: EvalState): boolean {
  return pathOf(top(s)) === null;
}

export function isFinished(s: EvalState): boolean {
  return s.frames.length === 1 && frameDone(s);
}

function popInto(s: EvalState): EvalState {
  const done = top(s);
  const parent = s.frames[s.frames.length - 2];
  if (!parent) return s;
  const p = pathOf(parent) ?? [];
  const frames = s.frames.slice(0, -1);
  frames[frames.length - 1] = { ...parent, ast: replaceAt(parent.ast, p, done.ast) };
  return { frames };
}

/** Bouton « Evaluer » : un pas dans le cadre courant (un cadre termine revient dans son parent). */
export function evaluateStep(s: EvalState, env: EvalEnv): EvalState {
  const f = top(s);
  const p = pathOf(f);
  if (p === null) return s.frames.length > 1 ? popInto(s) : s;
  const frames = s.frames.slice();
  frames[frames.length - 1] = { ...f, ast: replaceAt(f.ast, p, reduce(nodeAt(f.ast, p), env, f.sheet)) };
  return { frames };
}

/** Cellule referencee dont la formule peut etre ouverte (pas a pas detaille). */
export function stepInTarget(s: EvalState, env: EvalEnv): { sheet: string; row: number; col: number; formula: string } | null {
  const f = top(s);
  const p = pathOf(f);
  if (p === null) return null;
  const n = nodeAt(f.ast, p);
  if (n.type !== 'ref' || n.kind !== 'cell' || n.sheetError || n.sheet2 !== undefined || n.book !== undefined) return null;
  const sheet = n.sheet ?? f.sheet;
  const formula = env.formulaAt(sheet, n.r1, n.c1);
  return formula === undefined ? null : { sheet, row: n.r1, col: n.c1, formula };
}

/** Bouton « Pas a pas detaille » : ouvre la formule de la cellule referencee dans un nouveau cadre. */
export function stepIn(s: EvalState, env: EvalEnv, origin: (sheet: string, row: number, col: number) => string): EvalState {
  const t = stepInTarget(s, env);
  if (!t) return s;
  return { frames: [...s.frames, { ast: parseFormula(t.formula), sheet: t.sheet, origin: origin(t.sheet, t.row, t.col) }] };
}

/** Bouton « Pas sortant » : termine la formule ouverte et remplace la reference par sa valeur. */
export function stepOut(s: EvalState, env: EvalEnv): EvalState {
  if (s.frames.length < 2) return s;
  let cur = s;
  for (let i = 0; i < MAX_STEPS && !frameDone(cur); i++) cur = evaluateStep(cur, env);
  return popInto(cur);
}

export interface EvalView {
  /** Formule en francais, avec « = ». */
  text: string;
  /** Partie soulignee (prochaine evaluation), null si termine. */
  underline: [number, number] | null;
  origin: string;
  depth: number;
  finished: boolean;
  canStepIn: boolean;
  canStepOut: boolean;
}

const localized = (n: Node): string => toLocalized(`=${print(n)}`, 'fr');

export function viewOf(s: EvalState, env: EvalEnv): EvalView {
  const f = top(s);
  const p = pathOf(f);
  const base = { origin: f.origin, depth: s.frames.length - 1, finished: isFinished(s), canStepIn: stepInTarget(s, env) !== null, canStepOut: s.frames.length > 1 };
  if (p === null) return { ...base, text: localized(f.ast), underline: null };
  if (p.length === 0) {
    const t = localized(f.ast);
    return { ...base, text: t, underline: [1, t.length] };
  }
  const marker = 'ZZEVALNEXT';
  const shell = toLocalized(`=${print(replaceAt(f.ast, p, { type: 'name', name: marker }))}`, 'fr');
  const at = shell.indexOf(marker);
  const piece = localized(nodeAt(f.ast, p)).slice(1);
  return { ...base, text: shell.slice(0, at) + piece + shell.slice(at + marker.length), underline: [at, at + piece.length] };
}
