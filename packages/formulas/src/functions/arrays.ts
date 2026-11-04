// Fonctions de tableaux dynamiques : FILTRE, TRIER, TRIERPAR, UNIQUE, SEQUENCE, ASSEMB.V/H, PRENDRE, EXCLURE...
import { collectNumbers, compareText, deref, toBool, toMatrix, toNumber, toScalar } from '../eval/coerce.ts';
import { LambdaValue, type EvalContext } from '../eval/types.ts';
import { ERR, FormulaError, Matrix, type Scalar } from '../values.ts';
import { arrayArg } from './lookup.ts';
import { define, type Arg } from './registry.ts';

const L = 'lookup' as const;

function optNum(a: Arg, def: number, ctx: EvalContext): number | FormulaError {
  return a === undefined || a === null ? def : toNumber(a, ctx);
}

function pick(m: Matrix, rows: number[], cols: number[]): Matrix {
  const data: Scalar[] = [];
  for (const r of rows) for (const c of cols) data.push(m.get(r, c));
  return new Matrix(rows.length, cols.length, data);
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

function chooseLines(byRow: boolean) {
  return (args: Arg[], ctx: EvalContext) => {
    const m = arrayArg(args[0], ctx);
    if (m instanceof FormulaError) return m;
    const n = byRow ? m.rows : m.cols;
    const idx: number[] = [];
    for (const a of args.slice(1)) {
      const mm = toMatrix(a, ctx);
      if (mm instanceof FormulaError) return mm;
      for (const v of mm.data) {
        const k = toNumber(v, ctx);
        if (k instanceof FormulaError) return k;
        const i = Math.trunc(k);
        if (i === 0 || Math.abs(i) > n) return ERR.VALUE;
        idx.push(i > 0 ? i - 1 : n + i);
      }
    }
    return byRow ? pick(m, idx, range(m.cols)) : pick(m, range(m.rows), idx);
  };
}
define(L, 'CHOOSEROWS', { min: 2, max: 255, kinds: 'RV' }, chooseLines(true));
define(L, 'CHOOSECOLS', { min: 2, max: 255, kinds: 'RV' }, chooseLines(false));

function takeDrop(take: boolean) {
  return ([a, r, c]: Arg[], ctx: EvalContext) => {
    const m = arrayArg(a, ctx);
    if (m instanceof FormulaError) return m;
    const rr = r === undefined || r === null ? undefined : toNumber(r, ctx);
    const cc = c === undefined || c === null ? undefined : toNumber(c, ctx);
    if (rr instanceof FormulaError) return rr;
    if (cc instanceof FormulaError) return cc;
    const sel = (n: number, k: number | undefined): number[] => {
      if (k === undefined) return range(n);
      const t = Math.trunc(k);
      if (take) return t >= 0 ? range(Math.min(t, n)) : range(Math.min(-t, n)).map((i) => n - Math.min(-t, n) + i);
      return t >= 0 ? range(Math.max(0, n - t)).map((i) => i + t) : range(Math.max(0, n + t));
    };
    const rows = sel(m.rows, rr);
    const cols = sel(m.cols, cc);
    if (rows.length === 0 || cols.length === 0) return ERR.CALC;
    return pick(m, rows, cols);
  };
}
define(L, 'TAKE', { min: 2, max: 3, kinds: 'RS' }, takeDrop(true));
define(L, 'DROP', { min: 2, max: 3, kinds: 'RS' }, takeDrop(false));

define(L, 'EXPAND', { min: 2, max: 4, kinds: 'RSSV' }, ([a, r, c, p], ctx) => {
  const m = arrayArg(a, ctx);
  if (m instanceof FormulaError) return m;
  const rr = optNum(r, m.rows, ctx);
  const cc = optNum(c, m.cols, ctx);
  if (rr instanceof FormulaError) return rr;
  if (cc instanceof FormulaError) return cc;
  const rows = Math.trunc(rr);
  const cols = Math.trunc(cc);
  if (rows < m.rows || cols < m.cols) return ERR.VALUE;
  const pad: Scalar = p === undefined ? ERR.NA : toScalar(p, ctx);
  const data: Scalar[] = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) data.push(i < m.rows && j < m.cols ? m.get(i, j) : pad);
  return new Matrix(rows, cols, data);
});

function stack(vertical: boolean) {
  return (args: Arg[], ctx: EvalContext) => {
    const mats: Matrix[] = [];
    for (const a of args) {
      const m = arrayArg(a, ctx);
      if (m instanceof FormulaError) return m;
      mats.push(m);
    }
    const rows = vertical ? mats.reduce((s, m) => s + m.rows, 0) : Math.max(...mats.map((m) => m.rows));
    const cols = vertical ? Math.max(...mats.map((m) => m.cols)) : mats.reduce((s, m) => s + m.cols, 0);
    const out = Matrix.filled(rows, cols, ERR.NA);
    let offset = 0;
    for (const m of mats) {
      for (let i = 0; i < m.rows; i++) {
        for (let j = 0; j < m.cols; j++) {
          const r = vertical ? offset + i : i;
          const c = vertical ? j : offset + j;
          out.data[r * cols + c] = m.get(i, j);
        }
      }
      offset += vertical ? m.rows : m.cols;
    }
    return out;
  };
}
define(L, 'VSTACK', { min: 1, max: 254, kinds: 'R' }, stack(true));
define(L, 'HSTACK', { min: 1, max: 254, kinds: 'R' }, stack(false));

function toLine(column: boolean) {
  return ([a, ig, sc]: Arg[], ctx: EvalContext) => {
    const m = arrayArg(a, ctx);
    if (m instanceof FormulaError) return m;
    const ignore = optNum(ig, 0, ctx);
    if (ignore instanceof FormulaError) return ignore;
    const byCol = sc === undefined || sc === null ? false : toBool(sc, ctx);
    if (byCol instanceof FormulaError) return byCol;
    const src = byCol ? m.transpose() : m;
    const vals = src.data.filter(
      (v) => !(((ignore === 1 || ignore === 3) && v === null) || ((ignore === 2 || ignore === 3) && v instanceof FormulaError)),
    );
    if (vals.length === 0) return ERR.CALC;
    return column ? Matrix.column(vals) : Matrix.row(vals);
  };
}
define(L, 'TOCOL', { min: 1, max: 3, kinds: 'RS' }, toLine(true));
define(L, 'TOROW', { min: 1, max: 3, kinds: 'RS' }, toLine(false));

function wrap(byRows: boolean) {
  return ([a, n, p]: Arg[], ctx: EvalContext) => {
    const m = arrayArg(a, ctx);
    if (m instanceof FormulaError) return m;
    if (m.rows > 1 && m.cols > 1) return ERR.VALUE;
    const k = toNumber(n, ctx);
    if (k instanceof FormulaError) return k;
    const w = Math.trunc(k);
    if (w < 1) return ERR.NUM;
    const pad: Scalar = p === undefined ? ERR.NA : toScalar(p, ctx);
    const vals = m.data;
    const lines = Math.ceil(vals.length / w);
    const out = byRows ? Matrix.filled(lines, w, pad) : Matrix.filled(w, lines, pad);
    vals.forEach((v, i) => {
      const line = Math.floor(i / w);
      const pos = i % w;
      if (byRows) out.data[line * w + pos] = v;
      else out.data[pos * lines + line] = v;
    });
    return out;
  };
}
define(L, 'WRAPROWS', { min: 2, max: 3, kinds: 'RSS' }, wrap(true));
define(L, 'WRAPCOLS', { min: 2, max: 3, kinds: 'RSS' }, wrap(false));

define(L, 'SEQUENCE', { min: 1, max: 4 }, ([r, c, s, st], ctx) => {
  const rows = toNumber(r, ctx);
  const cols = optNum(c, 1, ctx);
  const start = optNum(s, 1, ctx);
  const step = optNum(st, 1, ctx);
  if (rows instanceof FormulaError) return rows;
  if (cols instanceof FormulaError) return cols;
  if (start instanceof FormulaError) return start;
  if (step instanceof FormulaError) return step;
  const nr = Math.trunc(rows);
  const nc = Math.trunc(cols);
  if (nr === 0 || nc === 0) return ERR.CALC;
  if (nr < 0 || nc < 0 || nr * nc > 1_048_576 * 16) return ERR.VALUE;
  const data: Scalar[] = [];
  for (let i = 0; i < nr * nc; i++) data.push(start + i * step);
  return new Matrix(nr, nc, data);
});

define(L, 'FILTER', { min: 2, max: 3, kinds: 'RVV' }, ([a, inc, empty], ctx) => {
  const m = arrayArg(a, ctx);
  if (m instanceof FormulaError) return m;
  const f = toMatrix(inc, ctx);
  if (f instanceof FormulaError) return f;
  const keep: boolean[] = [];
  let byRows: boolean;
  if (f.cols === 1 && f.rows === m.rows) byRows = true;
  else if (f.rows === 1 && f.cols === m.cols) byRows = false;
  else return ERR.VALUE;
  for (const v of f.data) {
    if (v instanceof FormulaError) return v;
    const b = toBool(v, ctx);
    if (b instanceof FormulaError) return b;
    keep.push(b);
  }
  const sel = keep.map((k, i) => (k ? i : -1)).filter((i) => i >= 0);
  if (sel.length === 0) return empty === undefined ? ERR.CALC : empty;
  return byRows ? pick(m, sel, range(m.cols)) : pick(m, range(m.rows), sel);
});

/** Ordre de tri d'Excel : nombres < textes < booleens < erreurs, vides en dernier. */
export function sortCompare(a: Scalar, b: Scalar): number {
  const rank = (v: Scalar): number =>
    v === null ? 4 : typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : typeof v === 'boolean' ? 2 : 3;
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return compareText(a, b);
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return 0;
}

interface SortKey {
  values: Scalar[];
  order: number;
}

function sortedIndices(n: number, keys: SortKey[]): number[] {
  return range(n).sort((i, j) => {
    for (const k of keys) {
      const a = k.values[i] ?? null;
      const b = k.values[j] ?? null;
      if (a === null && b !== null) return 1;
      if (b === null && a !== null) return -1;
      const c = sortCompare(a, b) * k.order;
      if (c !== 0) return c;
    }
    return i - j;
  });
}

define(L, 'SORT', { min: 1, max: 4, kinds: 'RVVS' }, ([a, si, so, bc], ctx) => {
  const m = arrayArg(a, ctx);
  if (m instanceof FormulaError) return m;
  const byCol = bc === undefined || bc === null ? false : toBool(bc, ctx);
  if (byCol instanceof FormulaError) return byCol;
  const idx = si === undefined || si === null ? [1] : collectNumbers([si], ctx);
  const ord = so === undefined || so === null ? [1] : collectNumbers([so], ctx);
  if (idx instanceof FormulaError) return idx;
  if (ord instanceof FormulaError) return ord;
  const src = byCol ? m.transpose() : m;
  const keys: SortKey[] = [];
  for (let k = 0; k < idx.length; k++) {
    const col = Math.trunc(idx[k] ?? 1);
    const o = ord[Math.min(k, ord.length - 1)] ?? 1;
    if (col < 1 || col > src.cols || (o !== 1 && o !== -1)) return ERR.VALUE;
    keys.push({ values: src.colAt(col - 1), order: o });
  }
  const rows = sortedIndices(src.rows, keys);
  const out = pick(src, rows, range(src.cols));
  return byCol ? out.transpose() : out;
});

define(L, 'SORTBY', { min: 2, max: 253, kinds: 'RVS+' }, (args, ctx) => {
  const m = arrayArg(args[0], ctx);
  if (m instanceof FormulaError) return m;
  const keys: SortKey[] = [];
  let byCol: boolean | undefined;
  for (let i = 1; i < args.length; i += 2) {
    const k = toMatrix(args[i], ctx);
    if (k instanceof FormulaError) return k;
    const o = optNum(args[i + 1], 1, ctx);
    if (o instanceof FormulaError) return o;
    if (o !== 1 && o !== -1) return ERR.VALUE;
    const col = k.cols === 1 && k.rows === m.rows;
    const row = k.rows === 1 && k.cols === m.cols;
    if (!col && !row) return ERR.VALUE;
    const thisByCol = !col;
    if (byCol !== undefined && byCol !== thisByCol) return ERR.VALUE;
    byCol = thisByCol;
    keys.push({ values: k.data, order: o });
  }
  const src = byCol ? m.transpose() : m;
  const out = pick(src, sortedIndices(src.rows, keys), range(src.cols));
  return byCol ? out.transpose() : out;
});

function rowKey(vals: Scalar[]): string {
  return vals
    .map((v) => (v === null ? '\u0001' : typeof v === 'string' ? `s${v.toLowerCase()}` : typeof v === 'number' ? `n${v}` : typeof v === 'boolean' ? `b${v}` : `e${v.code}`))
    .join('\u0000');
}

define(L, 'UNIQUE', { min: 1, max: 3, kinds: 'RSS' }, ([a, bc, eo], ctx) => {
  const m = arrayArg(a, ctx);
  if (m instanceof FormulaError) return m;
  const byCol = bc === undefined || bc === null ? false : toBool(bc, ctx);
  const once = eo === undefined || eo === null ? false : toBool(eo, ctx);
  if (byCol instanceof FormulaError) return byCol;
  if (once instanceof FormulaError) return once;
  const src = byCol ? m.transpose() : m;
  const counts = new Map<string, { first: number; n: number }>();
  for (let i = 0; i < src.rows; i++) {
    const k = rowKey(src.rowAt(i));
    const e = counts.get(k);
    if (e) e.n++;
    else counts.set(k, { first: i, n: 1 });
  }
  const rows = [...counts.values()].filter((e) => !once || e.n === 1).map((e) => e.first);
  if (rows.length === 0) return ERR.CALC;
  const out = pick(src, rows, range(src.cols));
  return byCol ? out.transpose() : out;
});

define('math', 'PERCENTOF', { min: 2, max: 2, kinds: 'R' }, ([s, all], ctx) => {
  const a = collectNumbers([s], ctx);
  const b = collectNumbers([all], ctx);
  if (a instanceof FormulaError) return a;
  if (b instanceof FormulaError) return b;
  const tb = b.reduce((x, y) => x + y, 0);
  return tb === 0 ? ERR.DIV0 : a.reduce((x, y) => x + y, 0) / tb;
});

/** GROUPER.PAR simplifie : cles (colonnes), valeurs, fonction ; total general par defaut. */
define(L, 'GROUPBY', { min: 3, max: 7, kinds: 'RRRSSSV' }, ([rf, vals, fn, _hdr, depth, order, filt], ctx, ev) => {
  const keys = arrayArg(rf, ctx);
  const values = arrayArg(vals, ctx);
  if (keys instanceof FormulaError) return keys;
  if (values instanceof FormulaError) return values;
  if (!(fn instanceof LambdaValue)) return fn instanceof FormulaError ? fn : ERR.VALUE;
  if (keys.rows !== values.rows) return ERR.VALUE;
  const totalDepth = optNum(depth, 1, ctx);
  const sortOrder = optNum(order, 1, ctx);
  if (totalDepth instanceof FormulaError) return totalDepth;
  if (sortOrder instanceof FormulaError) return sortOrder;
  let keep: boolean[] | undefined;
  if (filt !== undefined && filt !== null) {
    const f = toMatrix(filt, ctx);
    if (f instanceof FormulaError) return f;
    keep = f.data.map((v) => v === true || (typeof v === 'number' && v !== 0));
  }
  const groups = new Map<string, { key: Scalar[]; rows: number[] }>();
  for (let i = 0; i < keys.rows; i++) {
    if (keep && !keep[i]) continue;
    const k = keys.rowAt(i);
    const id = rowKey(k);
    const g = groups.get(id);
    if (g) g.rows.push(i);
    else groups.set(id, { key: k, rows: [i] });
  }
  const list = [...groups.values()];
  const dir = sortOrder < 0 ? -1 : 1;
  list.sort((x, y) => {
    for (let c = 0; c < x.key.length; c++) {
      const r = sortCompare(x.key[c] ?? null, y.key[c] ?? null);
      if (r !== 0) return r * dir;
    }
    return 0;
  });
  const aggregate = (rows: number[]): Scalar[] =>
    range(values.cols).map((c) => {
      const col = Matrix.column(rows.map((r) => values.get(r, c)));
      const v = deref(ev.callLambda(fn, [col], ctx), ctx);
      return v instanceof Matrix ? v.get(0, 0) : v;
    });
  const out: Scalar[][] = list.map((g) => [...g.key, ...aggregate(g.rows)]);
  if (totalDepth !== 0) {
    const all = list.flatMap((g) => g.rows);
    out.push(['Total', ...new Array<Scalar>(keys.cols - 1).fill(null), ...aggregate(all)]);
  }
  return out.length === 0 ? ERR.CALC : Matrix.from2D(out);
});
