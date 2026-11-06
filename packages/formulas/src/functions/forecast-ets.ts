// PREVISION.ETS et variantes : lissage exponentiel triple additif (ETS AAA / Holt-Winters additif).
// Les series exactement lineaires ou saisonnieres donnent les memes valeurs qu'Excel ; sur des donnees bruitees les
// parametres (alpha, beta, gamma) sont ceux de l'optimiseur de ce moteur et les previsions peuvent s'ecarter de quelques %.
import { toMatrix, toNumber } from '../eval/coerce.ts';
import type { EvalContext } from '../eval/types.ts';
import { serialToDate } from '../format/dates.ts';
import { ERR, FormulaError, type Scalar } from '../values.ts';
import { normInv } from './numeric.ts';
import { define, type Arg } from './registry.ts';

interface Series {
  y: number[];
  /** Date (ou numero) du premier point et pas de la grille. */
  t0: number;
  step: number;
  /** Chronologie mensuelle : `t0` est une date et `step` un nombre de mois. */
  monthly: boolean;
}

interface Fit {
  alpha: number;
  beta: number;
  gamma: number;
  level: number;
  trend: number;
  season: number[];
  /** Previsions a un pas pour chaque point de la serie. */
  fitted: number[];
  m: number;
}

const AGG: ((xs: number[]) => number)[] = [
  (xs) => xs.reduce((a, b) => a + b, 0) / xs.length,
  (xs) => xs.length,
  (xs) => xs.length,
  (xs) => Math.max(...xs),
  (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const k = s.length >> 1;
    return s.length % 2 ? (s[k] ?? 0) : ((s[k - 1] ?? 0) + (s[k] ?? 0)) / 2;
  },
  (xs) => Math.min(...xs),
  (xs) => xs.reduce((a, b) => a + b, 0),
];

/** Numeros de mois des dates si la chronologie est mensuelle (meme jour du mois ou fins de mois). */
function monthIndex(ts: number[], ctx: EvalContext): number[] | undefined {
  const parts = ts.map((t) => serialToDate(t, ctx.wb.dateSystem));
  const idx = parts.map((p) => p.y * 12 + p.m - 1);
  const eom = (p: { y: number; m: number; d: number }): boolean => new Date(p.y, p.m, 0).getDate() === p.d;
  const sameDay = parts.every((p) => p.d === parts[0]?.d) || parts.every(eom);
  const gaps = idx.slice(1).map((v, i) => v - (idx[i] ?? 0));
  return sameDay && gaps.every((g) => g >= 1) ? idx : undefined;
}

function prepare(
  values: Arg,
  timeline: Arg,
  completion: Arg,
  aggregation: Arg,
  ctx: EvalContext,
): Series | FormulaError {
  const vm = toMatrix(values, ctx);
  const tm = toMatrix(timeline, ctx);
  if (vm instanceof FormulaError) return vm;
  if (tm instanceof FormulaError) return tm;
  if (vm.data.length !== tm.data.length) return ERR.NA;
  if (vm.data.length < 2) return ERR.VALUE;
  const comp = completion === undefined || completion === null ? 1 : toNumber(completion, ctx);
  const aggr = aggregation === undefined || aggregation === null ? 1 : toNumber(aggregation, ctx);
  if (comp instanceof FormulaError) return comp;
  if (aggr instanceof FormulaError) return aggr;
  if ((comp !== 0 && comp !== 1) || !Number.isInteger(aggr) || aggr < 1 || aggr > 7) return ERR.NUM;
  const pts: [number, number][] = [];
  for (let i = 0; i < vm.data.length; i++) {
    const v: Scalar = vm.data[i] ?? null;
    const t: Scalar = tm.data[i] ?? null;
    if (v instanceof FormulaError) return v;
    if (t instanceof FormulaError) return t;
    if (typeof v !== 'number' || typeof t !== 'number') return ERR.VALUE;
    pts.push([t, v]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  const byTime = new Map<number, number[]>();
  for (const [t, v] of pts) byTime.set(t, [...(byTime.get(t) ?? []), v]);
  const times = [...byTime.keys()];
  const agg = AGG[aggr - 1] ?? AGG[0];
  const ys = times.map((t) => (agg ?? ((xs: number[]) => xs[0] ?? 0))(byTime.get(t) ?? []));
  if (times.length < 2) return ERR.NUM;
  const months = monthIndex(times, ctx);
  const grid = months ?? times;
  const gaps = grid.slice(1).map((v, i) => v - (grid[i] ?? 0));
  const step = Math.min(...gaps);
  if (!(step > 0) || gaps.some((g) => Math.abs(g / step - Math.round(g / step)) > 1e-6)) return ERR.NUM;
  const first = grid[0] ?? 0;
  const n = Math.round(((grid[grid.length - 1] ?? 0) - first) / step) + 1;
  if (n > 100000) return ERR.NUM;
  const y: (number | undefined)[] = new Array<number | undefined>(n).fill(undefined);
  grid.forEach((g, i) => {
    y[Math.round((g - first) / step)] = ys[i];
  });
  const filled: number[] = [];
  for (let i = 0; i < n; i++) {
    const cur = y[i];
    if (cur !== undefined) {
      filled.push(cur);
      continue;
    }
    if (comp === 0) {
      filled.push(0);
      continue;
    }
    let a = i - 1;
    while (a >= 0 && y[a] === undefined) a--;
    let b = i + 1;
    while (b < n && y[b] === undefined) b++;
    const ya = y[a] ?? 0;
    const yb = y[b] ?? 0;
    filled.push(ya + ((yb - ya) * (i - a)) / (b - a));
  }
  return { y: filled, t0: months ? (times[0] ?? 0) : first, step, monthly: months !== undefined };
}

/** Longueur de saisonnalite detectee par autocorrelation de la serie sans tendance (0 = aucune). */
function detectSeason(y: number[]): number {
  const n = y.length;
  if (n < 8) return 0;
  const mx = (n - 1) / 2;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  y.forEach((v, i) => {
    sxy += (i - mx) * (v - my);
    sxx += (i - mx) ** 2;
  });
  const slope = sxy / sxx;
  const d = y.map((v, i) => v - my - slope * (i - mx));
  const energy = d.reduce((a, b) => a + b * b, 0);
  if (energy < 1e-12 * Math.max(1, my * my * n)) return 0;
  const acf = (k: number): number => {
    let s = 0;
    for (let i = 0; i + k < n; i++) s += (d[i] ?? 0) * (d[i + k] ?? 0);
    return s / energy;
  };
  const maxLag = Math.floor(n / 2);
  const r: number[] = [];
  for (let k = 2; k <= maxLag; k++) r[k] = acf(k);
  let best = 0;
  let bestR = 0.7;
  for (let k = 2; k <= maxLag; k++) {
    const v = r[k] ?? 0;
    const isPeak = v >= (r[k - 1] ?? -1) && v >= (r[k + 1] ?? -1);
    if (isPeak && v > bestR * 1.0001 && (best === 0 || v > bestR + 0.1 || v > bestR)) {
      best = k;
      bestR = v;
    }
  }
  return best;
}

/** Une passe du lissage : renvoie la somme des carres des erreurs a un pas et l'etat final. */
function run(y: number[], m: number, a: number, b: number, g: number, init: { l: number; b: number; s: number[] }): Fit & { sse: number } {
  let l = init.l;
  let tr = init.b;
  const s = [...init.s];
  const fitted: number[] = [];
  let sse = 0;
  for (let t = 0; t < y.length; t++) {
    const si = m > 1 ? (s[t % m] ?? 0) : 0;
    const f = l + tr + si;
    fitted.push(f);
    const e = (y[t] ?? 0) - f;
    sse += e * e;
    const ln = l + tr + a * e;
    tr = tr + a * b * e;
    if (m > 1) s[t % m] = si + g * (1 - a) * e;
    l = ln;
  }
  return { alpha: a, beta: b, gamma: g, level: l, trend: tr, season: s, fitted, m, sse };
}

/** Etats initiaux par moindres carres : tendance lineaire + indices saisonniers (somme nulle). */
function initialState(y: number[], m: number): { l: number; b: number; s: number[] } {
  const n = y.length;
  if (m <= 1) {
    const mx = (n - 1) / 2;
    const my = y.reduce((p, q) => p + q, 0) / n;
    let sxy = 0;
    let sxx = 0;
    y.forEach((v, i) => {
      sxy += (i - mx) * (v - my);
      sxx += (i - mx) ** 2;
    });
    const slope = sxy / sxx;
    return { l: my - slope * mx - slope, b: slope, s: [] };
  }
  // tendance : pente moyenne entre cycles complets, indices : ecart moyen au niveau du cycle
  const cycles = Math.floor(n / m);
  const means = Array.from({ length: cycles }, (_, c) => y.slice(c * m, (c + 1) * m).reduce((p, q) => p + q, 0) / m);
  const slope = cycles > 1 ? ((means[cycles - 1] ?? 0) - (means[0] ?? 0)) / ((cycles - 1) * m) : 0;
  const s = Array.from({ length: m }, (_, i) => {
    let tot = 0;
    for (let c = 0; c < cycles; c++) tot += (y[c * m + i] ?? 0) - ((means[c] ?? 0) + slope * (i - (m - 1) / 2));
    return tot / cycles;
  });
  const avg = s.reduce((p, q) => p + q, 0) / m;
  const level0 = (means[0] ?? 0) - slope * ((m - 1) / 2);
  return { l: level0 - slope, b: slope, s: s.map((v) => v - avg) };
}

function fitModel(y: number[], m: number): Fit & { sse: number } {
  const init = initialState(y, m);
  let best = run(y, m, 0.9, 0.001, m > 1 ? 0.001 : 0, init);
  const grid = [0.001, 0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 0.9, 1];
  const gammas = m > 1 ? grid : [0];
  const betas = [0.001, 0.01, 0.05, 0.2];
  for (const a of grid) for (const b of betas) for (const g of gammas) {
    const r = run(y, m, a, b, g, init);
    if (r.sse < best.sse - 1e-12) best = r;
  }
  // affinage par coordonnees
  let span = 0.1;
  for (let it = 0; it < 30; it++) {
    for (const k of ['alpha', 'beta', 'gamma'] as const) {
      if (k === 'gamma' && m <= 1) continue;
      for (const dir of [-1, 1]) {
        const p = { a: best.alpha, b: best.beta, g: best.gamma };
        const key = k === 'alpha' ? 'a' : k === 'beta' ? 'b' : 'g';
        p[key] = Math.min(1, Math.max(k === 'alpha' ? 0.001 : 0, p[key] + dir * span));
        const r = run(y, m, p.a, p.b, p.g, init);
        if (r.sse < best.sse - 1e-12) best = r;
      }
    }
    span *= 0.7;
  }
  return best;
}

interface Model {
  series: Series;
  fit: Fit & { sse: number };
}

function build(
  values: Arg, timeline: Arg, seasonality: Arg, completion: Arg, aggregation: Arg, ctx: EvalContext,
): Model | FormulaError {
  const series = prepare(values, timeline, completion, aggregation, ctx);
  if (series instanceof FormulaError) return series;
  const sea = seasonality === undefined || seasonality === null ? 1 : toNumber(seasonality, ctx);
  if (sea instanceof FormulaError) return sea;
  if (!Number.isInteger(sea) || sea < 0 || sea > 8760) return ERR.NUM;
  let m = sea;
  if (sea === 1) {
    // saisonnalite candidate (autocorrelation) retenue seulement si elle reduit nettement l'erreur du modele
    m = detectSeason(series.y);
    if (m > 1) {
      const plain = fitModel(series.y, 0);
      const seasonal = fitModel(series.y, m);
      return { series, fit: seasonal.sse < 0.5 * plain.sse ? seasonal : { ...plain, m: 0 } };
    }
  }
  if (m > 1 && series.y.length < 2 * m) return ERR.NUM;
  return { series, fit: fitModel(series.y, m) };
}

/** Valeur lissee a l'indice (fractionnaire) `pos` de la grille. */
function predictAt(model: Model, pos: number): number {
  const { fit, series } = model;
  const n = series.y.length;
  const at = (k: number): number => {
    if (k < n) return fit.fitted[Math.max(0, k)] ?? 0;
    const h = k - n + 1;
    const si = fit.m > 1 ? (fit.season[(n + h - 1) % fit.m] ?? 0) : 0;
    return fit.level + h * fit.trend + si;
  };
  const lo = Math.floor(pos);
  const frac = pos - lo;
  return frac < 1e-12 ? at(lo) : at(lo) * (1 - frac) + at(lo + 1) * frac;
}

function targetIndex(target: Arg, model: Model, ctx: EvalContext): number | FormulaError {
  const t = toNumber(target, ctx);
  if (t instanceof FormulaError) return t;
  const { series } = model;
  let pos: number;
  if (series.monthly) {
    const a = serialToDate(Math.floor(t), ctx.wb.dateSystem);
    const b = serialToDate(series.t0, ctx.wb.dateSystem);
    pos = (a.y * 12 + a.m - (b.y * 12 + b.m)) / series.step;
  } else pos = (t - series.t0) / series.step;
  return pos < 0 ? ERR.NUM : pos;
}

const F = 'stats' as const;

define(F, 'FORECAST.ETS', { min: 3, max: 6, kinds: 'SVVSSS' }, ([target, values, timeline, sea, comp, agg], ctx) => {
  const model = build(values, timeline, sea, comp, agg, ctx);
  if (model instanceof FormulaError) return model;
  const pos = targetIndex(target, model, ctx);
  return pos instanceof FormulaError ? pos : predictAt(model, pos);
});

define(F, 'FORECAST.ETS.CONFINT', { min: 3, max: 7, kinds: 'SVVSSSS' }, ([target, values, timeline, conf, sea, comp, agg], ctx) => {
  const model = build(values, timeline, sea, comp, agg, ctx);
  if (model instanceof FormulaError) return model;
  const pos = targetIndex(target, model, ctx);
  if (pos instanceof FormulaError) return pos;
  const level = conf === undefined || conf === null ? 0.95 : toNumber(conf, ctx);
  if (level instanceof FormulaError) return level;
  if (level <= 0 || level >= 1) return ERR.NUM;
  const { fit, series } = model;
  const n = series.y.length;
  const sigma2 = fit.sse / Math.max(1, n - 2);
  const h = Math.max(1, Math.round(pos - n + 1));
  let v = 1;
  for (let j = 1; j < h; j++) {
    const c = fit.alpha * (1 + j * fit.beta) + (fit.m > 1 && j % fit.m === 0 ? fit.gamma * (1 - fit.alpha) : 0);
    v += c * c;
  }
  return normInv((1 + level) / 2) * Math.sqrt(sigma2 * v);
});

define(F, 'FORECAST.ETS.SEASONALITY', { min: 2, max: 4, kinds: 'VVSS' }, ([values, timeline, comp, agg], ctx) => {
  const series = prepare(values, timeline, comp, agg, ctx);
  return series instanceof FormulaError ? series : detectSeason(series.y);
});

define(F, 'FORECAST.ETS.STAT', { min: 3, max: 6, kinds: 'VVSSSS' }, ([values, timeline, kind, sea, comp, agg], ctx) => {
  const k = toNumber(kind, ctx);
  if (k instanceof FormulaError) return k;
  if (!Number.isInteger(k) || k < 1 || k > 8) return ERR.NUM;
  const model = build(values, timeline, sea, comp, agg, ctx);
  if (model instanceof FormulaError) return model;
  const { fit, series } = model;
  const y = series.y;
  const err = y.map((v, i) => v - (fit.fitted[i] ?? 0));
  const n = y.length;
  const mae = err.reduce((a, e) => a + Math.abs(e), 0) / n;
  switch (k) {
    case 1:
      return fit.alpha;
    case 2:
      return fit.beta;
    case 3:
      return fit.gamma;
    case 4: {
      const lag = Math.max(1, fit.m);
      let naive = 0;
      for (let i = lag; i < n; i++) naive += Math.abs((y[i] ?? 0) - (y[i - lag] ?? 0));
      naive /= Math.max(1, n - lag);
      return naive === 0 ? 0 : mae / naive;
    }
    case 5:
      return err.reduce((a, e, i) => {
        const d = Math.abs(y[i] ?? 0) + Math.abs(fit.fitted[i] ?? 0);
        return a + (d === 0 ? 0 : (2 * Math.abs(e)) / d);
      }, 0) / n;
    case 6:
      return mae;
    case 7:
      return Math.sqrt(err.reduce((a, e) => a + e * e, 0) / n);
    default:
      return series.monthly ? series.step * 31 : series.step;
  }
});
