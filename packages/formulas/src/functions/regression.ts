// Regression par moindres carres : DROITEREG, LOGREG, TENDANCE, CROISSANCE.
import { toBool } from '../eval/coerce.ts';
import type { EvalContext } from '../eval/types.ts';
import { ERR, FormulaError, Matrix, type Scalar } from '../values.ts';
import { numericMatrix } from './helpers.ts';
import { define, type Arg } from './registry.ts';

interface Design {
  y: number[];
  X: number[][];
  k: number;
  vertical: boolean;
}

function design(ys: Arg, xs: Arg, ctx: EvalContext): Design | FormulaError {
  const my = numericMatrix(ys, ctx);
  if (my instanceof FormulaError) return my;
  const vertical = (my[0]?.length ?? 0) === 1;
  const y = my.flat();
  const n = y.length;
  if (n === 0) return ERR.VALUE;
  if (xs === undefined || xs === null) return { y, X: y.map((_, i) => [i + 1]), k: 1, vertical };
  const mx = numericMatrix(xs, ctx);
  if (mx instanceof FormulaError) return mx;
  const rows = mx.length;
  const cols = mx[0]?.length ?? 0;
  if (rows * cols === n && (rows === 1 || cols === 1)) return { y, X: mx.flat().map((v) => [v]), k: 1, vertical };
  if (vertical && rows === n) return { y, X: mx, k: cols, vertical };
  if (!vertical && cols === n) return { y, X: Array.from({ length: n }, (_, i) => mx.map((r) => r[i] ?? 0)), k: rows, vertical };
  return ERR.REF;
}

function invertMatrix(m: number[][]): number[][] | undefined {
  const n = m.length;
  const a = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r]?.[i] ?? 0) > Math.abs(a[p]?.[i] ?? 0)) p = r;
    if (Math.abs(a[p]?.[i] ?? 0) < 1e-13) return undefined;
    [a[p], a[i]] = [a[i] ?? [], a[p] ?? []];
    const row = a[i] ?? [];
    const pv = row[i] ?? 1;
    for (let c = 0; c < 2 * n; c++) row[c] = (row[c] ?? 0) / pv;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const o = a[r] ?? [];
      const f = o[i] ?? 0;
      for (let c = 0; c < 2 * n; c++) o[c] = (o[c] ?? 0) - f * (row[c] ?? 0);
    }
  }
  return a.map((r) => r.slice(n));
}

interface Fit {
  /** Ordonnee a l'origine puis pentes b1..bk. */
  b0: number;
  slopes: number[];
  seB0: number;
  seSlopes: number[];
  r2: number;
  sey: number;
  F: number;
  df: number;
  ssreg: number;
  ssresid: number;
}

function leastSquares(y: number[], X: number[][], k: number, withConst: boolean): Fit | FormulaError {
  const n = y.length;
  const p = k + (withConst ? 1 : 0);
  const A = X.map((r) => (withConst ? [1, ...r] : r.slice()));
  const AtA = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => A.reduce((s, r) => s + (r[i] ?? 0) * (r[j] ?? 0), 0)),
  );
  const Aty = Array.from({ length: p }, (_, i) => A.reduce((s, r, t) => s + (r[i] ?? 0) * (y[t] ?? 0), 0));
  const inv = invertMatrix(AtA);
  if (!inv) return ERR.NUM;
  const beta = inv.map((r) => r.reduce((s, v, j) => s + v * (Aty[j] ?? 0), 0));
  let ssresid = 0;
  A.forEach((r, t) => {
    const fitted = r.reduce((s, v, j) => s + v * (beta[j] ?? 0), 0);
    ssresid += ((y[t] ?? 0) - fitted) ** 2;
  });
  const my = y.reduce((a, b) => a + b, 0) / n;
  const sstot = withConst ? y.reduce((s, v) => s + (v - my) ** 2, 0) : y.reduce((s, v) => s + v * v, 0);
  const ssreg = sstot - ssresid;
  const df = n - p;
  const sey = df > 0 ? Math.sqrt(ssresid / df) : 0;
  const se = inv.map((r, i) => Math.sqrt(Math.max(0, (r[i] ?? 0) * sey * sey)));
  return {
    b0: withConst ? (beta[0] ?? 0) : 0,
    slopes: withConst ? beta.slice(1) : beta,
    seB0: withConst ? (se[0] ?? 0) : 0,
    seSlopes: withConst ? se.slice(1) : se,
    r2: ssreg + ssresid === 0 ? 1 : ssreg / (ssreg + ssresid),
    sey,
    F: df > 0 && ssresid > 0 ? ssreg / k / (ssresid / df) : 0,
    df,
    ssreg,
    ssresid,
  };
}

function optBool(a: Arg, def: boolean, ctx: EvalContext): boolean | FormulaError {
  return a === undefined || a === null ? def : toBool(a, ctx);
}

function estimate(log: boolean) {
  return ([ys, xs, c, st]: Arg[], ctx: EvalContext) => {
    const d = design(ys, xs, ctx);
    if (d instanceof FormulaError) return d;
    const withConst = optBool(c, true, ctx);
    const stats = optBool(st, false, ctx);
    if (withConst instanceof FormulaError) return withConst;
    if (stats instanceof FormulaError) return stats;
    if (log && d.y.some((v) => v <= 0)) return ERR.NUM;
    const f = leastSquares(log ? d.y.map(Math.log) : d.y, d.X, d.k, withConst);
    if (f instanceof FormulaError) return f;
    const tr = (v: number): number => (log ? Math.exp(v) : v);
    const row1: Scalar[] = [...f.slopes.slice().reverse().map(tr), tr(f.b0)];
    if (!stats) return Matrix.row(row1);
    const w = row1.length;
    const pad = (vals: Scalar[]): Scalar[] => [...vals, ...new Array<Scalar>(w - vals.length).fill(ERR.NA)];
    return Matrix.from2D([
      row1,
      [...f.seSlopes.slice().reverse(), withConst ? f.seB0 : ERR.NA],
      pad([f.r2, f.sey]),
      pad([f.F, f.df]),
      pad([f.ssreg, f.ssresid]),
    ]);
  };
}
define('stats', 'LINEST', { min: 1, max: 4, kinds: 'VVSS' }, estimate(false));
define('stats', 'LOGEST', { min: 1, max: 4, kinds: 'VVSS' }, estimate(true));

function project(log: boolean) {
  return ([ys, xs, nx, c]: Arg[], ctx: EvalContext) => {
    const d = design(ys, xs, ctx);
    if (d instanceof FormulaError) return d;
    const withConst = optBool(c, true, ctx);
    if (withConst instanceof FormulaError) return withConst;
    if (log && d.y.some((v) => v <= 0)) return ERR.NUM;
    const f = leastSquares(log ? d.y.map(Math.log) : d.y, d.X, d.k, withConst);
    if (f instanceof FormulaError) return f;
    let points: number[][];
    let shape: { rows: number; cols: number };
    if (nx === undefined || nx === null) {
      points = d.X;
      shape = d.vertical ? { rows: d.y.length, cols: 1 } : { rows: 1, cols: d.y.length };
    } else {
      const m = numericMatrix(nx, ctx);
      if (m instanceof FormulaError) return m;
      const rows = m.length;
      const cols = m[0]?.length ?? 0;
      if (d.k === 1) {
        points = m.flat().map((v) => [v]);
        shape = { rows, cols };
      } else if (d.vertical) {
        if (cols !== d.k) return ERR.REF;
        points = m;
        shape = { rows, cols: 1 };
      } else {
        if (rows !== d.k) return ERR.REF;
        points = Array.from({ length: cols }, (_, i) => m.map((r) => r[i] ?? 0));
        shape = { rows: 1, cols };
      }
    }
    const vals: Scalar[] = points.map((pt) => {
      const v = pt.reduce((s, x, j) => s + x * (f.slopes[j] ?? 0), f.b0);
      return log ? Math.exp(v) : v;
    });
    return new Matrix(shape.rows, shape.cols, vals);
  };
}
define('stats', 'TREND', { min: 1, max: 4, kinds: 'VVVS' }, project(false));
define('stats', 'GROWTH', { min: 1, max: 4, kinds: 'VVVS' }, project(true));
