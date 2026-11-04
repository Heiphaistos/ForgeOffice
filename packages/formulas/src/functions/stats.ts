// Statistiques descriptives : moyennes, comptages, dispersion, rangs, centiles, correlation.
import { collectNumbers, forEachValue, textToNumber, toMatrix, toNumber, type NumberCollectOptions } from '../eval/coerce.ts';
import type { EvalContext } from '../eval/types.ts';
import { RefValue } from '../eval/types.ts';
import { ERR, FormulaError, Matrix } from '../values.ts';
import { numberPairs } from './helpers.ts';
import {
  devsq,
  mean,
  median,
  modes,
  percentileExc,
  percentileInc,
  roundDown,
  sorted,
  sum,
  variance,
} from './numeric.ts';
import { define, numFn, type Arg } from './registry.ts';

/** Fonction d'agregation sur la liste des nombres de tous les arguments. */
function agg(
  name: string,
  f: (xs: number[]) => number | FormulaError,
  opt: NumberCollectOptions = {},
  category: 'stats' | 'compat' = 'stats',
): void {
  define(category, name, { min: 1, max: 255, kinds: 'R' }, (args, ctx) => {
    const ns = collectNumbers(args, ctx, opt);
    if (ns instanceof FormulaError) return ns;
    const r = f(ns);
    return typeof r === 'number' && !Number.isFinite(r) ? ERR.NUM : r;
  });
}

export const avg = (xs: number[]): number | FormulaError => (xs.length === 0 ? ERR.DIV0 : mean(xs));
export const maxOf = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => (b > a ? b : a), -Infinity));
export const minOf = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => (b < a ? b : a), Infinity));
export const stdevS = (xs: number[]): number | FormulaError => (xs.length < 2 ? ERR.DIV0 : Math.sqrt(variance(xs, false)));
export const stdevP = (xs: number[]): number | FormulaError => (xs.length < 1 ? ERR.DIV0 : Math.sqrt(variance(xs, true)));
export const varS = (xs: number[]): number | FormulaError => (xs.length < 2 ? ERR.DIV0 : variance(xs, false));
export const varP = (xs: number[]): number | FormulaError => (xs.length < 1 ? ERR.DIV0 : variance(xs, true));
export const medianOf = (xs: number[]): number | FormulaError => (xs.length === 0 ? ERR.NUM : median(xs));
export const modeOf = (xs: number[]): number | FormulaError => modes(xs)[0] ?? ERR.NA;
export const productOf = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a * b, 1));

agg('AVERAGE', avg);
agg('AVERAGEA', avg, { aMode: true });
agg('MAX', maxOf);
agg('MAXA', maxOf, { aMode: true });
agg('MIN', minOf);
agg('MINA', minOf, { aMode: true });
agg('MEDIAN', medianOf);
agg('MODE.SNGL', modeOf);
agg('MODE', modeOf, {}, 'compat');
agg('STDEV.S', stdevS);
agg('STDEV', stdevS, {}, 'compat');
agg('STDEV.P', stdevP);
agg('STDEVP', stdevP, {}, 'compat');
agg('STDEVA', stdevS, { aMode: true });
agg('STDEVPA', stdevP, { aMode: true });
agg('VAR.S', varS);
agg('VAR', varS, {}, 'compat');
agg('VAR.P', varP);
agg('VARP', varP, {}, 'compat');
agg('VARA', varS, { aMode: true });
agg('VARPA', varP, { aMode: true });
agg('DEVSQ', (xs) => (xs.length === 0 ? ERR.NUM : devsq(xs)));
agg('AVEDEV', (xs) => {
  if (xs.length === 0) return ERR.NUM;
  const m = mean(xs);
  return sum(xs.map((x) => Math.abs(x - m))) / xs.length;
});
agg('GEOMEAN', (xs) => {
  if (xs.length === 0 || xs.some((x) => x <= 0)) return ERR.NUM;
  return Math.exp(sum(xs.map(Math.log)) / xs.length);
});
agg('HARMEAN', (xs) => {
  if (xs.length === 0 || xs.some((x) => x <= 0)) return ERR.NUM;
  return xs.length / sum(xs.map((x) => 1 / x));
});
agg('KURT', (xs) => {
  const n = xs.length;
  if (n < 4) return ERR.DIV0;
  const m = mean(xs);
  const s = Math.sqrt(variance(xs, false));
  if (s === 0) return ERR.DIV0;
  const s4 = sum(xs.map((x) => ((x - m) / s) ** 4));
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * s4 - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
});
agg('SKEW', (xs) => {
  const n = xs.length;
  if (n < 3) return ERR.DIV0;
  const m = mean(xs);
  const s = Math.sqrt(variance(xs, false));
  if (s === 0) return ERR.DIV0;
  return (n / ((n - 1) * (n - 2))) * sum(xs.map((x) => ((x - m) / s) ** 3));
});
agg('SKEW.P', (xs) => {
  const n = xs.length;
  if (n < 1) return ERR.DIV0;
  const m = mean(xs);
  const s = Math.sqrt(variance(xs, true));
  if (s === 0) return ERR.DIV0;
  return sum(xs.map((x) => ((x - m) / s) ** 3)) / n;
});

define('stats', 'MODE.MULT', { min: 1, max: 255, kinds: 'R' }, (args, ctx) => {
  const ns = collectNumbers(args, ctx);
  if (ns instanceof FormulaError) return ns;
  const m = modes(ns);
  return m.length === 0 ? ERR.NA : Matrix.column(m);
});

define('stats', 'COUNT', { min: 1, max: 255, kinds: 'R' }, (args, ctx) => {
  let n = 0;
  for (const a of args) {
    forEachValue(a, ctx, (v, direct) => {
      if (typeof v === 'number') n++;
      else if (direct && (typeof v === 'boolean' || (typeof v === 'string' && textToNumber(v, ctx) !== undefined))) n++;
      else if (direct && v === null && a !== undefined) n++;
    });
  }
  return n;
});
define('stats', 'COUNTA', { min: 1, max: 255, kinds: 'R' }, (args, ctx) => {
  let n = 0;
  for (const a of args) {
    if (a === undefined) continue;
    forEachValue(a, ctx, (v, direct) => {
      if (v !== null || direct) n++;
    });
  }
  return n;
});
define('stats', 'COUNTBLANK', { min: 1, kinds: 'R' }, ([a], ctx) => {
  if (a instanceof RefValue) {
    let total = 0;
    let filled = 0;
    for (const ar of a.areas) {
      total += (ar.r2 - ar.r1 + 1) * (ar.c2 - ar.c1 + 1);
      forEachValue(new RefValue([ar]), ctx, (v) => {
        if (v !== null && v !== '') filled++;
      });
    }
    return total - filled;
  }
  const m = toMatrix(a, ctx);
  if (m instanceof FormulaError) return m;
  return m.data.filter((v) => v === null || v === '').length;
});

/** Nombres d'un argument tableau (pour GRANDE.VALEUR, CENTILE, RANG...). */
function arrayNumbers(a: Arg, ctx: EvalContext): number[] | FormulaError {
  return collectNumbers([a], ctx);
}

define('stats', 'LARGE', { min: 2, max: 2, kinds: 'RS' }, ([a, k], ctx) => {
  const ns = arrayNumbers(a, ctx);
  if (ns instanceof FormulaError) return ns;
  const kv = toNumber(k, ctx);
  if (kv instanceof FormulaError) return kv;
  const i = Math.ceil(kv);
  if (i < 1 || i > ns.length) return ERR.NUM;
  return sorted(ns)[ns.length - i] ?? ERR.NUM;
});
define('stats', 'SMALL', { min: 2, max: 2, kinds: 'RS' }, ([a, k], ctx) => {
  const ns = arrayNumbers(a, ctx);
  if (ns instanceof FormulaError) return ns;
  const kv = toNumber(k, ctx);
  if (kv instanceof FormulaError) return kv;
  const i = Math.ceil(kv);
  if (i < 1 || i > ns.length) return ERR.NUM;
  return sorted(ns)[i - 1] ?? ERR.NUM;
});

function rank(avgTies: boolean) {
  return ([x, ref, order]: Arg[], ctx: EvalContext) => {
    const xv = toNumber(x, ctx);
    if (xv instanceof FormulaError) return xv;
    const ns = arrayNumbers(ref, ctx);
    if (ns instanceof FormulaError) return ns;
    let ord = 0;
    if (order !== undefined && order !== null) {
      const o = toNumber(order, ctx);
      if (o instanceof FormulaError) return o;
      ord = o;
    }
    let better = 0;
    let equal = 0;
    for (const n of ns) {
      if (n === xv) equal++;
      else if (ord === 0 ? n > xv : n < xv) better++;
    }
    if (equal === 0) return ERR.NA;
    return avgTies ? better + (equal + 1) / 2 : better + 1;
  };
}
define('stats', 'RANK.EQ', { min: 2, max: 3, kinds: 'SRS' }, rank(false));
define('compat', 'RANK', { min: 2, max: 3, kinds: 'SRS' }, rank(false));
define('stats', 'RANK.AVG', { min: 2, max: 3, kinds: 'SRS' }, rank(true));

function centile(name: string, f: (s: number[], p: number) => number | FormulaError, scale = 1, cat: 'stats' | 'compat' = 'stats'): void {
  define(cat, name, { min: 2, max: 2, kinds: 'RS' }, ([a, k], ctx) => {
    const ns = arrayNumbers(a, ctx);
    if (ns instanceof FormulaError) return ns;
    const kv = toNumber(k, ctx);
    if (kv instanceof FormulaError) return kv;
    if (ns.length === 0) return ERR.NUM;
    const r = f(sorted(ns), scale === 1 ? kv : Math.trunc(kv) / scale);
    return typeof r === 'number' && Number.isNaN(r) ? ERR.NUM : r;
  });
}
const pInc = (s: number[], p: number): number | FormulaError => (p < 0 || p > 1 ? ERR.NUM : percentileInc(s, p));
const pExc = (s: number[], p: number): number | FormulaError => (p <= 0 || p >= 1 ? ERR.NUM : percentileExc(s, p));
centile('PERCENTILE.INC', pInc);
centile('PERCENTILE', pInc, 1, 'compat');
centile('PERCENTILE.EXC', pExc);
centile('QUARTILE.INC', pInc, 4);
centile('QUARTILE', pInc, 4, 'compat');
centile('QUARTILE.EXC', pExc, 4);

function percentRank(exclusive: boolean) {
  return ([a, x, sig]: Arg[], ctx: EvalContext) => {
    const ns = arrayNumbers(a, ctx);
    if (ns instanceof FormulaError) return ns;
    const xv = toNumber(x, ctx);
    if (xv instanceof FormulaError) return xv;
    let digits = 3;
    if (sig !== undefined && sig !== null) {
      const s = toNumber(sig, ctx);
      if (s instanceof FormulaError) return s;
      digits = Math.trunc(s);
      if (digits < 1) return ERR.NUM;
    }
    const s = sorted(ns);
    const n = s.length;
    if (n === 0 || xv < (s[0] ?? 0) || xv > (s[n - 1] ?? 0)) return ERR.NA;
    const lt = s.filter((v) => v < xv).length;
    let pos: number;
    if (s.includes(xv)) pos = lt;
    else {
      const lo = s[lt - 1] ?? 0;
      const hi = s[lt] ?? 0;
      pos = lt - 1 + (xv - lo) / (hi - lo);
    }
    const r = exclusive ? (pos + 1) / (n + 1) : n === 1 ? 1 : pos / (n - 1);
    return roundDown(r, digits);
  };
}
define('stats', 'PERCENTRANK.INC', { min: 2, max: 3, kinds: 'RS' }, percentRank(false));
define('compat', 'PERCENTRANK', { min: 2, max: 3, kinds: 'RS' }, percentRank(false));
define('stats', 'PERCENTRANK.EXC', { min: 2, max: 3, kinds: 'RS' }, percentRank(true));

define('stats', 'TRIMMEAN', { min: 2, max: 2, kinds: 'RS' }, ([a, p], ctx) => {
  const ns = arrayNumbers(a, ctx);
  if (ns instanceof FormulaError) return ns;
  const pv = toNumber(p, ctx);
  if (pv instanceof FormulaError) return pv;
  if (pv < 0 || pv >= 1 || ns.length === 0) return ERR.NUM;
  const k = Math.floor((ns.length * pv) / 2);
  return mean(sorted(ns).slice(k, ns.length - k));
});

// ---------- Deux series ----------

function pairStat(name: string, f: (x: number[], y: number[]) => number | FormulaError, swap = false, cat: 'stats' | 'compat' = 'stats'): void {
  define(cat, name, { min: 2, max: 2, kinds: 'V' }, ([a, b], ctx) => {
    const p = numberPairs(a, b, ctx);
    if (p instanceof FormulaError) return p;
    const r = swap ? f(p.y, p.x) : f(p.x, p.y);
    return typeof r === 'number' && !Number.isFinite(r) ? ERR.DIV0 : r;
  });
}

export function covariance(x: number[], y: number[], sample: boolean): number {
  const mx = mean(x);
  const my = mean(y);
  let s = 0;
  for (let i = 0; i < x.length; i++) s += ((x[i] ?? 0) - mx) * ((y[i] ?? 0) - my);
  return s / (sample ? x.length - 1 : x.length);
}

export function correl(x: number[], y: number[]): number | FormulaError {
  if (x.length < 2) return ERR.DIV0;
  const sx = Math.sqrt(devsq(x));
  const sy = Math.sqrt(devsq(y));
  if (sx === 0 || sy === 0) return ERR.DIV0;
  return covariance(x, y, false) * x.length / (sx * sy);
}

/** Pente et ordonnee a l'origine de y = a + b x. */
export function linearFit(x: number[], y: number[]): { slope: number; intercept: number } | FormulaError {
  if (x.length < 1) return ERR.DIV0;
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += ((x[i] ?? 0) - mx) * ((y[i] ?? 0) - my);
    sxx += ((x[i] ?? 0) - mx) ** 2;
  }
  if (sxx === 0) return ERR.DIV0;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

pairStat('CORREL', correl);
pairStat('PEARSON', correl);
pairStat('RSQ', (x, y) => {
  const r = correl(x, y);
  return r instanceof FormulaError ? r : r * r;
});
pairStat('COVARIANCE.P', (x, y) => (x.length === 0 ? ERR.DIV0 : covariance(x, y, false)));
pairStat('COVAR', (x, y) => (x.length === 0 ? ERR.DIV0 : covariance(x, y, false)), false, 'compat');
pairStat('COVARIANCE.S', (x, y) => (x.length < 2 ? ERR.DIV0 : covariance(x, y, true)));
// PENTE(y_connus; x_connus) : les arguments sont dans l'ordre (y, x).
pairStat('SLOPE', (x, y) => {
  const f = linearFit(x, y);
  return f instanceof FormulaError ? f : f.slope;
}, true);
pairStat('INTERCEPT', (x, y) => {
  const f = linearFit(x, y);
  return f instanceof FormulaError ? f : f.intercept;
}, true);
pairStat('STEYX', (x, y) => {
  const n = x.length;
  if (n < 3) return ERR.DIV0;
  const sxx = devsq(x);
  if (sxx === 0) return ERR.DIV0;
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  for (let i = 0; i < n; i++) sxy += ((x[i] ?? 0) - mx) * ((y[i] ?? 0) - my);
  return Math.sqrt((devsq(y) - (sxy * sxy) / sxx) / (n - 2));
}, true);

function forecast([xa, ys, xs]: Arg[], ctx: EvalContext) {
  const x = toNumber(xa, ctx);
  if (x instanceof FormulaError) return x;
  const p = numberPairs(xs, ys, ctx);
  if (p instanceof FormulaError) return p;
  const f = linearFit(p.x, p.y);
  return f instanceof FormulaError ? f : f.intercept + f.slope * x;
}
define('stats', 'FORECAST.LINEAR', { min: 3, max: 3, kinds: 'SVV' }, forecast);
define('compat', 'FORECAST', { min: 3, max: 3, kinds: 'SVV' }, forecast);

numFn('stats', 'STANDARDIZE', 3, 3, ([x = 0, m = 0, s = 0]) => (s <= 0 ? ERR.NUM : (x - m) / s));
numFn('stats', 'FISHER', 1, 1, ([x = 0]) => (Math.abs(x) >= 1 ? ERR.NUM : 0.5 * Math.log((1 + x) / (1 - x))));
numFn('stats', 'FISHERINV', 1, 1, ([y = 0]) => Math.tanh(y));

define('stats', 'FREQUENCY', { min: 2, max: 2, kinds: 'V' }, ([data, bins], ctx) => {
  const ds = collectNumbers([data], ctx);
  if (ds instanceof FormulaError) return ds;
  const bs = collectNumbers([bins], ctx);
  if (bs instanceof FormulaError) return bs;
  const order = bs.map((b, i) => ({ b, i })).sort((a, b) => a.b - b.b);
  const counts = new Array<number>(bs.length + 1).fill(0);
  for (const d of ds) {
    const k = order.find((o) => d <= o.b);
    counts[k ? k.i : bs.length] = (counts[k ? k.i : bs.length] ?? 0) + 1;
  }
  return Matrix.column(counts);
});

define('stats', 'PROB', { min: 3, max: 4, kinds: 'VVSS' }, ([xr, pr, lo, hi], ctx) => {
  const p = numberPairs(xr, pr, ctx);
  if (p instanceof FormulaError) return p;
  const total = sum(p.y);
  if (p.y.some((v) => v < 0 || v > 1) || Math.abs(total - 1) > 1e-9) return ERR.NUM;
  const l = toNumber(lo, ctx);
  if (l instanceof FormulaError) return l;
  let h = l;
  if (hi !== undefined && hi !== null) {
    const hv = toNumber(hi, ctx);
    if (hv instanceof FormulaError) return hv;
    h = hv;
  }
  let s = 0;
  p.x.forEach((x, i) => {
    if (x >= l && x <= h) s += p.y[i] ?? 0;
  });
  return s;
});
