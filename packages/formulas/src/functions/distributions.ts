// Lois de probabilite et tests statistiques (LOI.NORMALE.N, LOI.STUDENT.N, KHIDEUX, F, BETA...).
import { collectNumbers, toMatrix, toNumber } from '../eval/coerce.ts';
import type { EvalContext } from '../eval/types.ts';
import { ERR, FormulaError } from '../values.ts';
import {
  betaInc,
  chiCdf,
  combin,
  fCdf,
  gamma,
  gammaln,
  gammaP,
  invert,
  mean,
  normCdf,
  normInv,
  normPdf,
  tCdf,
  tPdf,
  variance,
} from './numeric.ts';
import { alias, define, numFn, type Arg } from './registry.ts';

const S = 'stats' as const;
const C = 'compat' as const;
type Fn = (a: number[]) => number | FormulaError;
const both = (name: string, compat: string | undefined, min: number, max: number, f: Fn, compatMin = min, compatMax = max, compatF: Fn = f): void => {
  numFn(S, name, min, max, f);
  if (compat) numFn(C, compat, compatMin, compatMax, compatF);
};

// ---------- Normale ----------
const normDist = ([x = 0, m = 0, s = 0, cum = 0]: number[]): number | FormulaError => {
  if (s <= 0) return ERR.NUM;
  const z = (x - m) / s;
  return cum ? normCdf(z) : normPdf(z) / s;
};
const normInvF = ([p = 0, m = 0, s = 0]: number[]): number | FormulaError =>
  p <= 0 || p >= 1 || s <= 0 ? ERR.NUM : m + s * normInv(p);
both('NORM.DIST', 'NORMDIST', 4, 4, normDist);
both('NORM.INV', 'NORMINV', 3, 3, normInvF);
numFn(S, 'NORM.S.DIST', 2, 2, ([z = 0, cum = 0]) => (cum ? normCdf(z) : normPdf(z)));
numFn(C, 'NORMSDIST', 1, 1, ([z = 0]) => normCdf(z));
const normSInv = ([p = 0]: number[]): number | FormulaError => (p <= 0 || p >= 1 ? ERR.NUM : normInv(p));
both('NORM.S.INV', 'NORMSINV', 1, 1, normSInv);
numFn(S, 'PHI', 1, 1, ([x = 0]) => normPdf(x));
numFn(S, 'GAUSS', 1, 1, ([x = 0]) => normCdf(x) - 0.5);
both('LOGNORM.DIST', 'LOGNORMDIST', 4, 4, ([x = 0, m = 0, s = 0, cum = 0]) => {
  if (x <= 0 || s <= 0) return ERR.NUM;
  const z = (Math.log(x) - m) / s;
  return cum ? normCdf(z) : normPdf(z) / (x * s);
}, 3, 3, ([x = 0, m = 0, s = 0]) => (x <= 0 || s <= 0 ? ERR.NUM : normCdf((Math.log(x) - m) / s)));
both('LOGNORM.INV', 'LOGINV', 3, 3, ([p = 0, m = 0, s = 0]) =>
  p <= 0 || p >= 1 || s <= 0 ? ERR.NUM : Math.exp(m + s * normInv(p)));

// ---------- Student ----------
const df1 = (d: number): number => Math.trunc(d);
numFn(S, 'T.DIST', 3, 3, ([x = 0, d = 0, cum = 0]) => {
  const n = df1(d);
  if (n < 1) return ERR.NUM;
  return cum ? tCdf(x, n) : tPdf(x, n);
});
numFn(S, 'T.DIST.2T', 2, 2, ([x = 0, d = 0]) => {
  const n = df1(d);
  return x < 0 || n < 1 ? ERR.NUM : 2 * (1 - tCdf(x, n));
});
numFn(S, 'T.DIST.RT', 2, 2, ([x = 0, d = 0]) => {
  const n = df1(d);
  return n < 1 ? ERR.NUM : 1 - tCdf(x, n);
});
numFn(C, 'TDIST', 3, 3, ([x = 0, d = 0, tails = 0]) => {
  const n = df1(d);
  const t = Math.trunc(tails);
  if (x < 0 || n < 1 || (t !== 1 && t !== 2)) return ERR.NUM;
  return t * (1 - tCdf(x, n));
});
const tInv = (p: number, n: number): number => invert((x) => tCdf(x, n), p, -10, 10);
numFn(S, 'T.INV', 2, 2, ([p = 0, d = 0]) => {
  const n = df1(d);
  return p <= 0 || p >= 1 || n < 1 ? ERR.NUM : tInv(p, n);
});
const tInv2 = ([p = 0, d = 0]: number[]): number | FormulaError => {
  const n = df1(d);
  return p <= 0 || p > 1 || n < 1 ? ERR.NUM : Math.abs(tInv(p / 2, n));
};
both('T.INV.2T', 'TINV', 2, 2, tInv2);

function tTest([a, b, tails, type]: Arg[], ctx: EvalContext): number | FormulaError {
  const t = toNumber(tails, ctx);
  const ty = toNumber(type, ctx);
  if (t instanceof FormulaError) return t;
  if (ty instanceof FormulaError) return ty;
  const tl = Math.trunc(t);
  const tp = Math.trunc(ty);
  if ((tl !== 1 && tl !== 2) || tp < 1 || tp > 3) return ERR.NUM;
  let stat: number;
  let df: number;
  if (tp === 1) {
    const ma = toMatrix(a, ctx);
    const mb = toMatrix(b, ctx);
    if (ma instanceof FormulaError) return ma;
    if (mb instanceof FormulaError) return mb;
    if (ma.data.length !== mb.data.length) return ERR.NA;
    const d: number[] = [];
    ma.data.forEach((u, i) => {
      const v = mb.data[i];
      if (typeof u === 'number' && typeof v === 'number') d.push(u - v);
    });
    if (d.length < 2) return ERR.DIV0;
    const sd = Math.sqrt(variance(d, false));
    stat = (mean(d) / sd) * Math.sqrt(d.length);
    df = d.length - 1;
  } else {
    const x = collectNumbers([a], ctx);
    const y = collectNumbers([b], ctx);
    if (x instanceof FormulaError) return x;
    if (y instanceof FormulaError) return y;
    if (x.length < 2 || y.length < 2) return ERR.DIV0;
    const vx = variance(x, false);
    const vy = variance(y, false);
    const nx = x.length;
    const ny = y.length;
    if (tp === 2) {
      df = nx + ny - 2;
      const sp = ((nx - 1) * vx + (ny - 1) * vy) / df;
      stat = (mean(x) - mean(y)) / Math.sqrt(sp * (1 / nx + 1 / ny));
    } else {
      const se = vx / nx + vy / ny;
      stat = (mean(x) - mean(y)) / Math.sqrt(se);
      df = (se * se) / ((vx / nx) ** 2 / (nx - 1) + (vy / ny) ** 2 / (ny - 1));
    }
  }
  if (!Number.isFinite(stat)) return ERR.DIV0;
  return tl * (1 - tCdf(Math.abs(stat), df));
}
define(S, 'T.TEST', { min: 4, max: 4, kinds: 'VVSS' }, tTest);
alias('TTEST', 'T.TEST', C);

// ---------- Khi-deux ----------
const chiPdf = (x: number, k: number): number =>
  x < 0 ? 0 : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.log(2) - gammaln(k / 2));
numFn(S, 'CHISQ.DIST', 3, 3, ([x = 0, d = 0, cum = 0]) => {
  const k = df1(d);
  if (x < 0 || k < 1 || k > 1e10) return ERR.NUM;
  return cum ? chiCdf(x, k) : chiPdf(x, k);
});
const chiRt = ([x = 0, d = 0]: number[]): number | FormulaError => {
  const k = df1(d);
  return x < 0 || k < 1 || k > 1e10 ? ERR.NUM : 1 - chiCdf(x, k);
};
both('CHISQ.DIST.RT', 'CHIDIST', 2, 2, chiRt);
numFn(S, 'CHISQ.INV', 2, 2, ([p = 0, d = 0]) => {
  const k = df1(d);
  return p < 0 || p >= 1 || k < 1 ? ERR.NUM : p === 0 ? 0 : invert((x) => chiCdf(x, k), p, 0, Math.max(10, k * 5));
});
both('CHISQ.INV.RT', 'CHIINV', 2, 2, ([p = 0, d = 0]) => {
  const k = df1(d);
  return p <= 0 || p > 1 || k < 1 ? ERR.NUM : p === 1 ? 0 : invert((x) => chiCdf(x, k), 1 - p, 0, Math.max(10, k * 5));
});
define(S, 'CHISQ.TEST', { min: 2, max: 2, kinds: 'V' }, ([a, e], ctx) => {
  const ma = toMatrix(a, ctx);
  const me = toMatrix(e, ctx);
  if (ma instanceof FormulaError) return ma;
  if (me instanceof FormulaError) return me;
  if (ma.rows !== me.rows || ma.cols !== me.cols) return ERR.NA;
  let stat = 0;
  for (let i = 0; i < ma.data.length; i++) {
    const o = ma.data[i];
    const x = me.data[i];
    if (typeof o !== 'number' || typeof x !== 'number') continue;
    if (x === 0) return ERR.DIV0;
    stat += (o - x) ** 2 / x;
  }
  const df = ma.rows > 1 && ma.cols > 1 ? (ma.rows - 1) * (ma.cols - 1) : ma.data.length - 1;
  return df < 1 ? ERR.NA : 1 - chiCdf(stat, df);
});
alias('CHITEST', 'CHISQ.TEST', C);

// ---------- Fisher-Snedecor ----------
const fPdf = (x: number, a: number, b: number): number =>
  Math.exp(0.5 * (a * Math.log(a * x) + b * Math.log(b) - (a + b) * Math.log(a * x + b)) - Math.log(x) - (gammaln(a / 2) + gammaln(b / 2) - gammaln((a + b) / 2)));
numFn(S, 'F.DIST', 4, 4, ([x = 0, a = 0, b = 0, cum = 0]) => {
  const d1 = df1(a);
  const d2 = df1(b);
  if (x < 0 || d1 < 1 || d2 < 1) return ERR.NUM;
  return cum ? fCdf(x, d1, d2) : x === 0 ? 0 : fPdf(x, d1, d2);
});
both('F.DIST.RT', 'FDIST', 3, 3, ([x = 0, a = 0, b = 0]) => {
  const d1 = df1(a);
  const d2 = df1(b);
  return x < 0 || d1 < 1 || d2 < 1 ? ERR.NUM : 1 - fCdf(x, d1, d2);
});
numFn(S, 'F.INV', 3, 3, ([p = 0, a = 0, b = 0]) => {
  const d1 = df1(a);
  const d2 = df1(b);
  return p < 0 || p > 1 || d1 < 1 || d2 < 1 ? ERR.NUM : invert((x) => fCdf(x, d1, d2), p, 0, 100);
});
both('F.INV.RT', 'FINV', 3, 3, ([p = 0, a = 0, b = 0]) => {
  const d1 = df1(a);
  const d2 = df1(b);
  return p <= 0 || p > 1 || d1 < 1 || d2 < 1 ? ERR.NUM : invert((x) => fCdf(x, d1, d2), 1 - p, 0, 100);
});
define(S, 'F.TEST', { min: 2, max: 2, kinds: 'V' }, ([a, b], ctx) => {
  const x = collectNumbers([a], ctx);
  const y = collectNumbers([b], ctx);
  if (x instanceof FormulaError) return x;
  if (y instanceof FormulaError) return y;
  if (x.length < 2 || y.length < 2) return ERR.DIV0;
  const vx = variance(x, false);
  const vy = variance(y, false);
  if (vx === 0 || vy === 0) return ERR.DIV0;
  const p = fCdf(vx / vy, x.length - 1, y.length - 1);
  return 2 * Math.min(p, 1 - p);
});
alias('FTEST', 'F.TEST', C);

// ---------- Beta ----------
const betaPdf = (x: number, a: number, b: number): number =>
  Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - (gammaln(a) + gammaln(b) - gammaln(a + b)));
numFn(S, 'BETA.DIST', 4, 6, ([x = 0, a = 0, b = 0, cum = 0, lo = 0, hi = 1]) => {
  if (a <= 0 || b <= 0 || x < lo || x > hi || lo === hi) return ERR.NUM;
  const t = (x - lo) / (hi - lo);
  return cum ? betaInc(t, a, b) : betaPdf(t, a, b) / (hi - lo);
});
numFn(C, 'BETADIST', 3, 5, ([x = 0, a = 0, b = 0, lo = 0, hi = 1]) => {
  if (a <= 0 || b <= 0 || x < lo || x > hi || lo === hi) return ERR.NUM;
  return betaInc((x - lo) / (hi - lo), a, b);
});
both('BETA.INV', 'BETAINV', 3, 5, ([p = 0, a = 0, b = 0, lo = 0, hi = 1]) => {
  if (p <= 0 || p > 1 || a <= 0 || b <= 0 || lo === hi) return ERR.NUM;
  return lo + (hi - lo) * invert((t) => betaInc(t, a, b), p, 0, 1);
});

// ---------- Lois discretes ----------
const binomPmf = (k: number, n: number, p: number): number => combin(n, k) * p ** k * (1 - p) ** (n - k);
const binomCdf = (k: number, n: number, p: number): number => {
  let s = 0;
  for (let i = 0; i <= k; i++) s += binomPmf(i, n, p);
  return Math.min(1, s);
};
both('BINOM.DIST', 'BINOMDIST', 4, 4, ([k0 = 0, n0 = 0, p = 0, cum = 0]) => {
  const k = Math.trunc(k0);
  const n = Math.trunc(n0);
  if (k < 0 || k > n || p < 0 || p > 1) return ERR.NUM;
  return cum ? binomCdf(k, n, p) : binomPmf(k, n, p);
});
both('BINOM.INV', 'CRITBINOM', 3, 3, ([n0 = 0, p = 0, alpha = 0]) => {
  const n = Math.trunc(n0);
  if (n < 0 || p < 0 || p > 1 || alpha <= 0 || alpha >= 1) return ERR.NUM;
  let s = 0;
  for (let k = 0; k <= n; k++) {
    s += binomPmf(k, n, p);
    if (s >= alpha - 1e-14) return k;
  }
  return n;
});
numFn(S, 'BINOM.DIST.RANGE', 3, 4, (a) => {
  const n = Math.trunc(a[0] ?? 0);
  const p = a[1] ?? 0;
  const s1 = Math.trunc(a[2] ?? 0);
  const s2 = a.length > 3 ? Math.trunc(a[3] ?? 0) : s1;
  if (n < 0 || p < 0 || p > 1 || s1 < 0 || s1 > n || s2 < s1 || s2 > n) return ERR.NUM;
  let s = 0;
  for (let k = s1; k <= s2; k++) s += binomPmf(k, n, p);
  return s;
});
const negBinom = (f: number, s: number, p: number): number => combin(f + s - 1, s - 1) * p ** s * (1 - p) ** f;
numFn(S, 'NEGBINOM.DIST', 4, 4, ([f0 = 0, s0 = 0, p = 0, cum = 0]) => {
  const f = Math.trunc(f0);
  const s = Math.trunc(s0);
  if (f < 0 || s < 1 || p < 0 || p > 1) return ERR.NUM;
  if (!cum) return negBinom(f, s, p);
  let t = 0;
  for (let i = 0; i <= f; i++) t += negBinom(i, s, p);
  return t;
});
numFn(C, 'NEGBINOMDIST', 3, 3, ([f0 = 0, s0 = 0, p = 0]) => {
  const f = Math.trunc(f0);
  const s = Math.trunc(s0);
  return f < 0 || s < 1 || p < 0 || p > 1 ? ERR.NUM : negBinom(f, s, p);
});
const hyper = (k: number, n: number, K: number, N: number): number => (combin(K, k) * combin(N - K, n - k)) / combin(N, n);
const hyperCheck = (k: number, n: number, K: number, N: number): boolean =>
  k < 0 || n <= 0 || K <= 0 || N <= 0 || k > n || k > K || n > N || K > N || n - k > N - K;
numFn(S, 'HYPGEOM.DIST', 5, 5, (a) => {
  const [k, n, K, N] = a.slice(0, 4).map(Math.trunc) as [number, number, number, number];
  if (hyperCheck(k, n, K, N)) return ERR.NUM;
  if (!a[4]) return hyper(k, n, K, N);
  let s = 0;
  for (let i = Math.max(0, n - (N - K)); i <= k; i++) s += hyper(i, n, K, N);
  return s;
});
numFn(C, 'HYPGEOMDIST', 4, 4, (a) => {
  const [k, n, K, N] = a.map(Math.trunc) as [number, number, number, number];
  return hyperCheck(k, n, K, N) ? ERR.NUM : hyper(k, n, K, N);
});
both('POISSON.DIST', 'POISSON', 3, 3, ([x0 = 0, m = 0, cum = 0]) => {
  const x = Math.trunc(x0);
  if (x < 0 || m < 0) return ERR.NUM;
  if (!cum) return Math.exp(x * Math.log(m) - m - gammaln(x + 1));
  return m === 0 ? 1 : 1 - gammaP(x + 1, m);
});
both('EXPON.DIST', 'EXPONDIST', 3, 3, ([x = 0, l = 0, cum = 0]) => {
  if (x < 0 || l <= 0) return ERR.NUM;
  return cum ? 1 - Math.exp(-l * x) : l * Math.exp(-l * x);
});

// ---------- Gamma, Weibull ----------
both('GAMMA.DIST', 'GAMMADIST', 4, 4, ([x = 0, a = 0, b = 0, cum = 0]) => {
  if (x < 0 || a <= 0 || b <= 0) return ERR.NUM;
  if (cum) return gammaP(a, x / b);
  if (x === 0) return a < 1 ? ERR.NUM : a === 1 ? 1 / b : 0;
  return Math.exp((a - 1) * Math.log(x) - x / b - gammaln(a) - a * Math.log(b));
});
both('GAMMA.INV', 'GAMMAINV', 3, 3, ([p = 0, a = 0, b = 0]) => {
  if (p < 0 || p >= 1 || a <= 0 || b <= 0) return ERR.NUM;
  return p === 0 ? 0 : invert((x) => gammaP(a, x / b), p, 0, Math.max(10, a * b * 5));
});
numFn(S, 'GAMMA', 1, 1, ([x = 0]) => (x === 0 || (x < 0 && Number.isInteger(x)) ? ERR.NUM : gamma(x)));
const gln = ([x = 0]: number[]): number | FormulaError => (x <= 0 ? ERR.NUM : gammaln(x));
numFn(S, 'GAMMALN', 1, 1, gln);
numFn(S, 'GAMMALN.PRECISE', 1, 1, gln);
both('WEIBULL.DIST', 'WEIBULL', 4, 4, ([x = 0, a = 0, b = 0, cum = 0]) => {
  if (x < 0 || a <= 0 || b <= 0) return ERR.NUM;
  const t = (x / b) ** a;
  return cum ? 1 - Math.exp(-t) : (a / b ** a) * x ** (a - 1) * Math.exp(-t);
});

// ---------- Tests et intervalles ----------
function zTest([arr, x, sigma]: Arg[], ctx: EvalContext): number | FormulaError {
  const xs = collectNumbers([arr], ctx);
  if (xs instanceof FormulaError) return xs;
  const xv = toNumber(x, ctx);
  if (xv instanceof FormulaError) return xv;
  if (xs.length < 2) return ERR.DIV0;
  let s = Math.sqrt(variance(xs, false));
  if (sigma !== undefined && sigma !== null) {
    const sv = toNumber(sigma, ctx);
    if (sv instanceof FormulaError) return sv;
    s = sv;
  }
  if (s === 0) return ERR.DIV0;
  return 1 - normCdf((mean(xs) - xv) / (s / Math.sqrt(xs.length)));
}
define(S, 'Z.TEST', { min: 2, max: 3, kinds: 'VSS' }, zTest);
alias('ZTEST', 'Z.TEST', C);
const confNorm = ([a = 0, s = 0, n0 = 0]: number[]): number | FormulaError => {
  const n = Math.trunc(n0);
  if (a <= 0 || a >= 1 || s <= 0 || n < 1) return ERR.NUM;
  return (normInv(1 - a / 2) * s) / Math.sqrt(n);
};
both('CONFIDENCE.NORM', 'CONFIDENCE', 3, 3, confNorm);
numFn(S, 'CONFIDENCE.T', 3, 3, ([a = 0, s = 0, n0 = 0]) => {
  const n = Math.trunc(n0);
  if (a <= 0 || a >= 1 || s <= 0 || n < 1) return ERR.NUM;
  if (n === 1) return ERR.DIV0;
  return (Math.abs(invert((x) => tCdf(x, n - 1), a / 2, -10, 10)) * s) / Math.sqrt(n);
});
