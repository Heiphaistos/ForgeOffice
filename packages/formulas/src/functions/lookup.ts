// Recherche et reference : RECHERCHEV/H, EQUIV, INDEX, RECHERCHEX, EQUIVX, DECALER, INDIRECT, ADRESSE...
import { compareScalars, compareText, numEquals, readArea, toMatrix, toNumber, toScalar, toText } from '../eval/coerce.ts';
import { MAX_WILDCARD, wildcardMatcher } from '../eval/wildcard.ts';
import { evaluate } from '../eval/evaluator.ts';
import { RefValue, type EvalContext, type EvalValue } from '../eval/types.ts';
import { toLocalized } from '../parse/localize.ts';
import { parseFormula } from '../parse/parser.ts';
import { MAX_COLS, MAX_ROWS, colToLetters, quoteSheetName, type Area } from '../refs.ts';
import { ERR, FormulaError, Matrix, type Scalar } from '../values.ts';
import { define, type Arg } from './registry.ts';
import { safeRegex } from './safe-regex.ts';

const L = 'lookup' as const;

function optNum(a: Arg, def: number, ctx: EvalContext): number | FormulaError {
  return a === undefined || a === null ? def : toNumber(a, ctx);
}

function singleArea(a: Arg): Area | undefined {
  return a instanceof RefValue && a.areas.length === 1 ? a.areas[0] : undefined;
}

// ---------- Position ----------

define(L, 'ROW', { min: 0, max: 1, kinds: 'R' }, ([a], ctx) => {
  if (a === undefined) return ctx.row + 1;
  const ar = singleArea(a);
  if (!ar) return a instanceof FormulaError ? a : ERR.VALUE;
  if (ar.r1 === ar.r2) return ar.r1 + 1;
  return Matrix.column(Array.from({ length: Math.min(ar.r2 - ar.r1 + 1, MAX_ROWS) }, (_, i) => ar.r1 + i + 1));
});
define(L, 'COLUMN', { min: 0, max: 1, kinds: 'R' }, ([a], ctx) => {
  if (a === undefined) return ctx.col + 1;
  const ar = singleArea(a);
  if (!ar) return a instanceof FormulaError ? a : ERR.VALUE;
  if (ar.c1 === ar.c2) return ar.c1 + 1;
  return Matrix.row(Array.from({ length: ar.c2 - ar.c1 + 1 }, (_, i) => ar.c1 + i + 1));
});
define(L, 'ROWS', { min: 1, kinds: 'R' }, ([a], ctx) => {
  const ar = singleArea(a);
  if (ar) return ar.r2 - ar.r1 + 1;
  const m = toMatrix(a, ctx);
  return m instanceof FormulaError ? m : m.rows;
});
define(L, 'COLUMNS', { min: 1, kinds: 'R' }, ([a], ctx) => {
  const ar = singleArea(a);
  if (ar) return ar.c2 - ar.c1 + 1;
  const m = toMatrix(a, ctx);
  return m instanceof FormulaError ? m : m.cols;
});
define(L, 'AREAS', { min: 1, kinds: 'R' }, ([a]) => (a instanceof RefValue ? a.areas.length : ERR.VALUE));

define(L, 'ADDRESS', { min: 2, max: 5 }, ([r, c, abs, a1, sh], ctx) => {
  const row = toNumber(r, ctx);
  const col = toNumber(c, ctx);
  const ab = optNum(abs, 1, ctx);
  if (row instanceof FormulaError) return row;
  if (col instanceof FormulaError) return col;
  if (ab instanceof FormulaError) return ab;
  const style = a1 === undefined || a1 === null ? true : toScalar(a1, ctx);
  const rr = Math.trunc(row);
  const cc = Math.trunc(col);
  const mode = Math.trunc(ab);
  if (rr < 1 || cc < 1 || rr > MAX_ROWS || cc > MAX_COLS || mode < 1 || mode > 4) return ERR.VALUE;
  const absRow = mode === 1 || mode === 2;
  const absCol = mode === 1 || mode === 3;
  let addr: string;
  if (style === false || style === 0) {
    const rTxt = absRow ? `R${rr}` : `R[${rr}]`;
    const cTxt = absCol ? `C${cc}` : `C[${cc}]`;
    addr = rTxt + cTxt;
  } else addr = `${absCol ? '$' : ''}${colToLetters(cc - 1)}${absRow ? '$' : ''}${rr}`;
  if (sh === undefined || sh === null) return addr;
  const s = toText(sh, ctx);
  if (s instanceof FormulaError) return s;
  return s === '' ? addr : `${quoteSheetName(s)}!${addr}`;
});

// ---------- Comparaison et recherche ----------

function equalsLookup(v: Scalar, x: Scalar, re: { test(s: string): boolean } | undefined): boolean {
  if (re) return typeof v === 'string' && re.test(v);
  if (typeof x === 'number') return typeof v === 'number' && numEquals(v, x);
  if (typeof x === 'string') return typeof v === 'string' && compareText(v, x) === 0;
  if (typeof x === 'boolean') return v === x;
  return v === null && x === null;
}

function sameType(v: Scalar, x: Scalar): boolean {
  return typeof v === typeof x && v !== null;
}

/**
 * Position (base 0) de x dans arr. matchMode : 0 exact, -1 exact ou inferieur, 1 exact ou superieur,
 * 2 jokers, 3 expression reguliere. searchMode : 1 debut->fin, -1 fin->debut, 2 / -2 dichotomie.
 */
export function lookupIndex(x: Scalar, arr: readonly Scalar[], matchMode: number, searchMode: number): number {
  let re: { test(s: string): boolean } | undefined;
  if (matchMode === 2 && typeof x === 'string') {
    if (x.length > MAX_WILDCARD) return -1;
    re = wildcardMatcher(x);
  }
  if (matchMode === 3 && typeof x === 'string') {
    // Motif a retour arriere catastrophique, invalide ou trop long : aucune correspondance (#N/A).
    const safe = safeRegex(x, 'iu');
    if (safe instanceof FormulaError) return -1;
    re = { test: (v) => v.length <= safe.maxText && safe.re.test(v) };
  }
  const n = arr.length;
  if (searchMode === 2 || searchMode === -2) {
    const desc = searchMode === -2;
    let lo = 0;
    let hi = n - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = compareScalars(arr[mid] ?? null, x) * (desc ? -1 : 1);
      if (c === 0 && sameType(arr[mid] ?? null, x)) {
        found = mid;
        break;
      }
      if (c < 0) lo = mid + 1;
      else hi = mid - 1;
    }
    if (found >= 0 || matchMode === 0 || matchMode === 2) return found;
    // Approche : hi = dernier element < x (ordre de tri), lo = premier > x.
    const wantSmaller = matchMode === -1;
    const idx = desc ? (wantSmaller ? lo : hi) : wantSmaller ? hi : lo;
    return idx >= 0 && idx < n ? idx : -1;
  }
  const order = searchMode === -1 ? Array.from({ length: n }, (_, i) => n - 1 - i) : Array.from({ length: n }, (_, i) => i);
  let best = -1;
  for (const i of order) {
    const v = arr[i] ?? null;
    if (equalsLookup(v, x, re)) return i;
    if ((matchMode === -1 || matchMode === 1) && sameType(v, x)) {
      const c = compareScalars(v, x);
      if (matchMode === -1 && c < 0 && (best < 0 || compareScalars(v, arr[best] ?? null) > 0)) best = i;
      if (matchMode === 1 && c > 0 && (best < 0 || compareScalars(v, arr[best] ?? null) < 0)) best = i;
    }
  }
  return best;
}

/** Recherche approximative d'Excel (EQUIV type 1/-1, RECHERCHEV VRAI) par dichotomie. */
function approxIndex(x: Scalar, arr: readonly Scalar[], descending: boolean): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = arr[mid] ?? null;
    let c = v === null ? 1 : compareScalars(v, x);
    if (descending) c = -c;
    if (c <= 0) lo = mid + 1;
    else hi = mid - 1;
  }
  let i = hi;
  while (i >= 0 && !sameType(arr[i] ?? null, x)) i--;
  return i;
}

function exactIndex(x: Scalar, arr: readonly Scalar[]): number {
  const wild = typeof x === 'string' && /[*?~]/.test(x);
  return lookupIndex(x, arr, wild ? 2 : 0, 1);
}

function vector(m: Matrix): Scalar[] | undefined {
  if (m.rows === 1) return m.rowAt(0);
  if (m.cols === 1) return m.colAt(0);
  return undefined;
}

define(L, 'MATCH', { min: 2, max: 3, kinds: 'SVS' }, ([x, a, t], ctx) => {
  const xv = toScalar(x, ctx);
  if (xv instanceof FormulaError) return xv;
  const m = toMatrix(a, ctx);
  if (m instanceof FormulaError) return m;
  const arr = vector(m);
  if (!arr) return ERR.NA;
  const type = optNum(t, 1, ctx);
  if (type instanceof FormulaError) return type;
  const i = type === 0 ? exactIndex(xv, arr) : approxIndex(xv, arr, type < 0);
  return i < 0 ? ERR.NA : i + 1;
});
define(L, 'XMATCH', { min: 2, max: 4, kinds: 'SVSS' }, ([x, a, mm, sm], ctx) => {
  const xv = toScalar(x, ctx);
  if (xv instanceof FormulaError) return xv;
  const m = toMatrix(a, ctx);
  if (m instanceof FormulaError) return m;
  const arr = vector(m);
  if (!arr) return ERR.VALUE;
  const match = optNum(mm, 0, ctx);
  const search = optNum(sm, 1, ctx);
  if (match instanceof FormulaError) return match;
  if (search instanceof FormulaError) return search;
  if (![0, -1, 1, 2, 3].includes(match) || ![1, -1, 2, -2].includes(search)) return ERR.VALUE;
  const i = lookupIndex(xv, arr, match, search);
  return i < 0 ? ERR.NA : i + 1;
});

function tableLookup(horizontal: boolean) {
  return ([x, tb, idx, approx]: Arg[], ctx: EvalContext): EvalValue => {
    const xv = toScalar(x, ctx);
    if (xv instanceof FormulaError) return xv;
    const m = toMatrix(tb, ctx);
    if (m instanceof FormulaError) return m;
    const k = toNumber(idx, ctx);
    if (k instanceof FormulaError) return k;
    const col = Math.trunc(k);
    if (col < 1) return ERR.VALUE;
    const area = singleArea(tb);
    const fullLen = area ? (horizontal ? area.r2 - area.r1 + 1 : area.c2 - area.c1 + 1) : horizontal ? m.rows : m.cols;
    if (col > fullLen) return ERR.REF;
    let isApprox = true;
    if (approx !== undefined) {
      const b = toScalar(approx, ctx);
      if (b instanceof FormulaError) return b;
      isApprox = b === null ? false : Boolean(typeof b === 'string' ? b.length : b);
    }
    const keys = horizontal ? m.rowAt(0) : m.colAt(0);
    const i = isApprox ? approxIndex(xv, keys, false) : exactIndex(xv, keys);
    if (i < 0) return ERR.NA;
    if (horizontal) return col - 1 < m.rows ? m.get(col - 1, i) : null;
    return col - 1 < m.cols ? m.get(i, col - 1) : null;
  };
}
define(L, 'VLOOKUP', { min: 3, max: 4, kinds: 'SRSS' }, tableLookup(false));
define(L, 'HLOOKUP', { min: 3, max: 4, kinds: 'SRSS' }, tableLookup(true));

define(L, 'LOOKUP', { min: 2, max: 3, kinds: 'SVV' }, ([x, lv, rv], ctx) => {
  const xv = toScalar(x, ctx);
  if (xv instanceof FormulaError) return xv;
  const m = toMatrix(lv, ctx);
  if (m instanceof FormulaError) return m;
  let keys: Scalar[];
  let results: Scalar[];
  if (rv === undefined) {
    const byRow = m.cols > m.rows;
    keys = byRow ? m.rowAt(0) : m.colAt(0);
    results = byRow ? m.rowAt(m.rows - 1) : m.colAt(m.cols - 1);
  } else {
    const r = toMatrix(rv, ctx);
    if (r instanceof FormulaError) return r;
    const kv = vector(m);
    const res = vector(r);
    if (!kv || !res) return ERR.NA;
    keys = kv;
    results = res;
  }
  const i = approxIndex(xv, keys, false);
  if (i < 0) return ERR.NA;
  return i < results.length ? (results[i] ?? null) : ERR.NA;
});

define(L, 'XLOOKUP', { min: 3, max: 6, kinds: 'SRRVSS' }, ([x, la, ra, nf, mm, sm], ctx) => {
  const xv = toScalar(x, ctx);
  if (xv instanceof FormulaError) return xv;
  const lm = toMatrix(la, ctx);
  if (lm instanceof FormulaError) return lm;
  const keys = vector(lm);
  if (!keys) return ERR.VALUE;
  const vertical = lm.cols === 1 && lm.rows > 1;
  const rm = toMatrix(ra, ctx);
  if (rm instanceof FormulaError) return rm;
  if ((vertical ? rm.rows : rm.cols) !== keys.length && keys.length > 1) return ERR.VALUE;
  const match = optNum(mm, 0, ctx);
  const search = optNum(sm, 1, ctx);
  if (match instanceof FormulaError) return match;
  if (search instanceof FormulaError) return search;
  const i = lookupIndex(xv, keys, match, search);
  if (i < 0) return nf === undefined ? ERR.NA : nf;
  const area = singleArea(ra);
  if (area) {
    const sub: Area = vertical || keys.length === 1 && lm.cols === 1
      ? { sheet: area.sheet, r1: area.r1 + i, c1: area.c1, r2: area.r1 + i, c2: area.c2 }
      : { sheet: area.sheet, r1: area.r1, c1: area.c1 + i, r2: area.r2, c2: area.c1 + i };
    return new RefValue([sub]);
  }
  return vertical ? Matrix.row(rm.rowAt(i)) : Matrix.column(rm.colAt(i));
});

// ---------- INDEX, DECALER, INDIRECT ----------

define(L, 'INDEX', { min: 2, max: 4, kinds: 'RSSS' }, ([a, r, c, ar], ctx) => {
  const rowN = optNum(r, 0, ctx);
  const colN = optNum(c, 0, ctx);
  const areaN = optNum(ar, 1, ctx);
  if (rowN instanceof FormulaError) return rowN;
  if (colN instanceof FormulaError) return colN;
  if (areaN instanceof FormulaError) return areaN;
  let ri = Math.trunc(rowN);
  let ci = Math.trunc(colN);
  if (ri < 0 || ci < 0) return ERR.VALUE;
  if (a instanceof RefValue) {
    const area = a.areas[Math.trunc(areaN) - 1];
    if (!area) return ERR.REF;
    const h = area.r2 - area.r1 + 1;
    const w = area.c2 - area.c1 + 1;
    if (c === undefined && h === 1 && w > 1) {
      ci = ri;
      ri = 0;
    }
    if (ri > h || ci > w) return ERR.REF;
    return new RefValue([
      {
        sheet: area.sheet,
        r1: ri === 0 ? area.r1 : area.r1 + ri - 1,
        r2: ri === 0 ? area.r2 : area.r1 + ri - 1,
        c1: ci === 0 ? area.c1 : area.c1 + ci - 1,
        c2: ci === 0 ? area.c2 : area.c1 + ci - 1,
      },
    ]);
  }
  const m = toMatrix(a, ctx);
  if (m instanceof FormulaError) return m;
  if (c === undefined && m.rows === 1 && m.cols > 1) {
    ci = ri;
    ri = 0;
  }
  if (c === undefined && m.cols === 1 && ri === 0) ri = 1;
  if (ri > m.rows || ci > m.cols) return ERR.REF;
  if (ri === 0 && ci === 0) return m;
  if (ri === 0) return Matrix.column(m.colAt(ci - 1));
  if (ci === 0) return m.cols === 1 ? m.get(ri - 1, 0) : Matrix.row(m.rowAt(ri - 1));
  return m.get(ri - 1, ci - 1);
});

define(L, 'OFFSET', { min: 3, max: 5, kinds: 'RSSSS', volatile: true }, ([a, r, c, h, w], ctx) => {
  const area = singleArea(a);
  if (!area) return a instanceof FormulaError ? a : ERR.VALUE;
  const dr = toNumber(r, ctx);
  const dc = toNumber(c, ctx);
  if (dr instanceof FormulaError) return dr;
  if (dc instanceof FormulaError) return dc;
  const hh = optNum(h, area.r2 - area.r1 + 1, ctx);
  const ww = optNum(w, area.c2 - area.c1 + 1, ctx);
  if (hh instanceof FormulaError) return hh;
  if (ww instanceof FormulaError) return ww;
  const height = Math.trunc(hh);
  const width = Math.trunc(ww);
  if (height === 0 || width === 0) return ERR.REF;
  let r1 = area.r1 + Math.trunc(dr);
  let c1 = area.c1 + Math.trunc(dc);
  let r2 = r1 + height - (height > 0 ? 1 : -1);
  let c2 = c1 + width - (width > 0 ? 1 : -1);
  [r1, r2] = [Math.min(r1, r2), Math.max(r1, r2)];
  [c1, c2] = [Math.min(c1, c2), Math.max(c1, c2)];
  if (r1 < 0 || c1 < 0 || r2 >= MAX_ROWS || c2 >= MAX_COLS) return ERR.REF;
  return new RefValue([{ sheet: area.sheet, r1, c1, r2, c2 }]);
});

/** Reference R1C1 / L1C1 (absolue ou relative a la cellule de la formule). */
function parseR1C1(text: string, ctx: EvalContext): EvalValue {
  const m = text.match(/^(?:(?:'((?:[^']|'')+)'|([^!]+))!)?[RL](\[-?\d+\]|\d+)?C(\[-?\d+\]|\d+)?(?::[RL](\[-?\d+\]|\d+)?C(\[-?\d+\]|\d+)?)?$/i);
  if (!m) return ERR.REF;
  let sheet = ctx.sheet;
  const sheetName = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2];
  if (sheetName !== undefined) {
    const id = ctx.wb.sheetId(sheetName);
    if (id === undefined) return ERR.REF;
    sheet = id;
  }
  const coord = (t: string | undefined, base: number): number => {
    if (t === undefined) return base;
    if (t.startsWith('[')) return base + Number(t.slice(1, -1));
    return Number(t) - 1;
  };
  const r1 = coord(m[3], ctx.row);
  const c1 = coord(m[4], ctx.col);
  const r2 = m[5] !== undefined || m[6] !== undefined ? coord(m[5], ctx.row) : r1;
  const c2 = m[5] !== undefined || m[6] !== undefined ? coord(m[6], ctx.col) : c1;
  if ([r1, r2].some((v) => v < 0 || v >= MAX_ROWS) || [c1, c2].some((v) => v < 0 || v >= MAX_COLS)) return ERR.REF;
  return new RefValue([{ sheet, r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) }]);
}

define(L, 'INDIRECT', { min: 1, max: 2, volatile: true }, ([t, a1], ctx) => {
  const text = toText(t, ctx);
  if (text instanceof FormulaError) return text;
  const style = a1 === undefined || a1 === null ? true : toScalar(a1, ctx);
  const src = text.trim();
  if (src === '' || src.length > 2000) return ERR.REF;
  if (style === false || style === 0) return parseR1C1(src, ctx);
  let node;
  try {
    node = parseFormula(src);
  } catch {
    return ERR.REF;
  }
  const ok = node.type === 'ref' || node.type === 'name' || node.type === 'table' ||
    (node.type === 'binary' && node.op === ':');
  if (!ok) return ERR.REF;
  const v = evaluate(node, ctx);
  return v instanceof RefValue ? v : ERR.REF;
});

define(L, 'FORMULATEXT', { min: 1, kinds: 'R' }, ([a], ctx) => {
  const area = singleArea(a);
  if (!area) return a instanceof FormulaError ? a : ERR.NA;
  const f = ctx.wb.formulaText(area.sheet, area.r1, area.c1);
  if (f === undefined) return ERR.NA;
  const text = f.startsWith('=') ? f : `=${f}`;
  return ctx.wb.locale === 'fr-FR' ? toLocalized(text, 'fr') : text;
});

define(L, 'HYPERLINK', { min: 1, max: 2 }, ([l, f], ctx) => {
  const link = toScalar(l, ctx);
  if (f === undefined) return link;
  return toScalar(f, ctx);
});

define(L, 'TRANSPOSE', { min: 1, kinds: 'V' }, ([a], ctx) => {
  const m = toMatrix(a, ctx);
  return m instanceof FormulaError ? m : m.transpose();
});

/** Lecture d'une reference pour les fonctions de tableau dynamique. */
export function arrayArg(a: Arg, ctx: EvalContext): Matrix | FormulaError {
  const area = singleArea(a);
  return area ? readArea(area, ctx) : toMatrix(a, ctx);
}
