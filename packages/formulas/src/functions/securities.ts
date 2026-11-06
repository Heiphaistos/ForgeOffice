// Titres et obligations : coupons, PRIX.TITRE, RENDEMENT.TITRE, DUREE, bons du Tresor, escompte.
import { toNumber } from '../eval/coerce.ts';
import type { EvalContext } from '../eval/types.ts';
import { daysInMonth, serialToDate, type DateParts } from '../format/dates.ts';
import { ERR, FormulaError } from '../values.ts';
import { addMonths, days360, yearFrac } from './datetime.ts';
import { solve } from './financial.ts';
import { define, type Arg } from './registry.ts';

const F = 'financial' as const;

function ints(args: Arg[], ctx: EvalContext, truncate: readonly number[]): number[] | FormulaError {
  const out: number[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === undefined || a === null) continue; // trou : la valeur par defaut s'applique
    const n = toNumber(a, ctx);
    if (n instanceof FormulaError) return n;
    out[i] = truncate.includes(i) ? Math.trunc(n) : n;
  }
  return out;
}

/** Definit une fonction dont les arguments sont des nombres ; `dates` = positions tronquees en entier. */
export function secFn(
  name: string,
  min: number,
  max: number,
  dates: readonly number[],
  f: (a: number[], ctx: EvalContext) => number | FormulaError,
): void {
  define(F, name, { min, max }, (args, ctx) => {
    const v = ints(args, ctx, dates);
    if (v instanceof FormulaError) return v;
    const r = f(v, ctx);
    return typeof r === 'number' && !Number.isFinite(r) ? ERR.NUM : r;
  });
}

export const badBasis = (b: number): boolean => b < 0 || b > 4;
export const badFreq = (f: number): boolean => f !== 1 && f !== 2 && f !== 4;

interface Coupon {
  pcd: number;
  ncd: number;
  num: number;
  days: number;
  dayBs: number;
  dayNc: number;
}

export function isMonthEnd(p: DateParts): boolean {
  return p.d === daysInMonth(p.y, p.m);
}

function coupon(settle: number, mat: number, freq: number, basis: number, ctx: EvalContext): Coupon | FormulaError {
  if (settle >= mat || badFreq(freq) || badBasis(basis)) return ERR.NUM;
  const step = 12 / freq;
  const eom = isMonthEnd(serialToDate(mat, ctx.wb.dateSystem));
  let k = 1;
  let pcd = addMonths(mat, -step, eom, ctx);
  while (!(pcd instanceof FormulaError) && pcd > settle) {
    k++;
    pcd = addMonths(mat, -step * k, eom, ctx);
  }
  if (pcd instanceof FormulaError) return pcd;
  const ncd = addMonths(mat, -step * (k - 1), eom, ctx);
  if (ncd instanceof FormulaError) return ncd;
  const sys = ctx.wb.dateSystem;
  let days: number;
  if (basis === 1) days = ncd - pcd;
  else if (basis === 3) days = 365 / freq;
  else days = 360 / freq;
  let dayBs: number;
  if (basis === 0 || basis === 4) dayBs = days360(serialToDate(pcd, sys), serialToDate(settle, sys), basis === 4);
  else dayBs = settle - pcd;
  const dayNc = basis === 0 || basis === 4 ? days - dayBs : ncd - settle;
  return { pcd, ncd, num: k, days, dayBs, dayNc };
}

function couponFn(name: string, pick: (c: Coupon) => number): void {
  secFn(name, 3, 4, [0, 1, 2, 3], ([s = 0, m = 0, f = 0, b = 0], ctx) => {
    const c = coupon(s, m, f, b, ctx);
    return c instanceof FormulaError ? c : pick(c);
  });
}
couponFn('COUPPCD', (c) => c.pcd);
couponFn('COUPNCD', (c) => c.ncd);
couponFn('COUPNUM', (c) => c.num);
couponFn('COUPDAYS', (c) => c.days);
couponFn('COUPDAYBS', (c) => c.dayBs);
couponFn('COUPDAYSNC', (c) => c.dayNc);

function priceOf(c: Coupon, rate: number, yld: number, red: number, freq: number): number {
  const dsc = c.dayNc / c.days;
  const cpn = (100 * rate) / freq;
  const accrued = (cpn * c.dayBs) / c.days;
  if (c.num === 1) return (red + cpn) / (1 + (dsc * yld) / freq) - accrued;
  let p = red / (1 + yld / freq) ** (c.num - 1 + dsc);
  for (let k = 1; k <= c.num; k++) p += cpn / (1 + yld / freq) ** (k - 1 + dsc);
  return p - accrued;
}

secFn('PRICE', 6, 7, [0, 1, 5, 6], ([s = 0, m = 0, rate = 0, yld = 0, red = 0, f = 0, b = 0], ctx) => {
  if (rate < 0 || yld < 0 || red <= 0) return ERR.NUM;
  const c = coupon(s, m, f, b, ctx);
  return c instanceof FormulaError ? c : priceOf(c, rate, yld, red, f);
});

secFn('YIELD', 6, 7, [0, 1, 5, 6], ([s = 0, m = 0, rate = 0, pr = 0, red = 0, f = 0, b = 0], ctx) => {
  if (rate < 0 || pr <= 0 || red <= 0) return ERR.NUM;
  const c = coupon(s, m, f, b, ctx);
  if (c instanceof FormulaError) return c;
  const y = solve((x) => priceOf(c, rate, x, red, f) - pr, rate === 0 ? 0.05 : rate, 100, 1e-10);
  return y === undefined ? ERR.NUM : y;
});

function macaulay(c: Coupon, rate: number, yld: number, freq: number): number {
  const dsc = c.dayNc / c.days;
  const cpn = (100 * rate) / freq;
  let num = 0;
  let den = 0;
  for (let k = 1; k <= c.num; k++) {
    const t = k - 1 + dsc;
    const cf = cpn + (k === c.num ? 100 : 0);
    const pv = cf / (1 + yld / freq) ** t;
    num += (t / freq) * pv;
    den += pv;
  }
  return num / den;
}

function durationFn(name: string, modified: boolean): void {
  secFn(name, 5, 6, [0, 1, 4, 5], ([s = 0, m = 0, rate = 0, yld = 0, f = 0, b = 0], ctx) => {
    if (rate < 0 || yld < 0) return ERR.NUM;
    const c = coupon(s, m, f, b, ctx);
    if (c instanceof FormulaError) return c;
    const d = macaulay(c, rate, yld, f);
    return modified ? d / (1 + yld / f) : d;
  });
}
durationFn('DURATION', false);
durationFn('MDURATION', true);

// ---------- Bons du Tresor ----------

function tbillDays(s: number, m: number): number | FormulaError {
  const dsm = m - s;
  return dsm <= 0 || dsm > 366 ? ERR.NUM : dsm;
}

secFn('TBILLPRICE', 3, 3, [0, 1], ([s = 0, m = 0, disc = 0]) => {
  const dsm = tbillDays(s, m);
  if (dsm instanceof FormulaError) return dsm;
  const p = 100 * (1 - (disc * dsm) / 360);
  return disc <= 0 || p <= 0 ? ERR.NUM : p;
});
secFn('TBILLYIELD', 3, 3, [0, 1], ([s = 0, m = 0, pr = 0]) => {
  const dsm = tbillDays(s, m);
  if (dsm instanceof FormulaError) return dsm;
  return pr <= 0 ? ERR.NUM : ((100 - pr) / pr) * (360 / dsm);
});
secFn('TBILLEQ', 3, 3, [0, 1], ([s = 0, m = 0, disc = 0]) => {
  const dsm = tbillDays(s, m);
  if (dsm instanceof FormulaError) return dsm;
  if (disc <= 0) return ERR.NUM;
  if (dsm <= 182) return (365 * disc) / (360 - disc * dsm);
  const price = 100 * (1 - (disc * dsm) / 360);
  const t = dsm / 365;
  return (-t + Math.sqrt(t * t - (2 * t - 1) * (1 - 100 / price))) / (t - 0.5);
});

// ---------- Titres escomptes ----------

function yf(s: number, m: number, b: number, ctx: EvalContext): number | FormulaError {
  if (s >= m || badBasis(b)) return ERR.NUM;
  return yearFrac(s, m, b, ctx);
}

function discountFn(name: string, f: (x: number, y: number, t: number) => number | FormulaError): void {
  secFn(name, 4, 5, [0, 1, 4], ([s = 0, m = 0, x = 0, y = 0, b = 0], ctx) => {
    if (x <= 0 || y <= 0) return ERR.NUM;
    const t = yf(s, m, b, ctx);
    return t instanceof FormulaError ? t : f(x, y, t);
  });
}
discountFn('DISC', (pr, red, t) => (red - pr) / red / t);
discountFn('INTRATE', (inv, red, t) => (red - inv) / inv / t);
discountFn('RECEIVED', (inv, disc, t) => (1 - disc * t <= 0 ? ERR.NUM : inv / (1 - disc * t)));
discountFn('PRICEDISC', (disc, red, t) => red - disc * red * t);
discountFn('YIELDDISC', (pr, red, t) => (red / pr - 1) / t);

secFn('ACCRINTM', 3, 5, [0, 1, 4], ([iss = 0, s = 0, rate = 0, par = 1000, b = 0], ctx) => {
  if (rate <= 0 || par <= 0) return ERR.NUM;
  const t = yf(iss, s, b, ctx);
  return t instanceof FormulaError ? t : par * rate * t;
});

// ---------- Titres payant les interets a l'echeance ----------

secFn('PRICEMAT', 5, 6, [0, 1, 2, 5], ([s = 0, m = 0, iss = 0, rate = 0, yld = 0, b = 0], ctx) => {
  if (rate < 0 || yld < 0 || iss >= s) return ERR.NUM;
  const dim = yf(iss, m, b, ctx);
  const dsm = yf(s, m, b, ctx);
  const a = yf(iss, s, b, ctx);
  if (dim instanceof FormulaError) return dim;
  if (dsm instanceof FormulaError) return dsm;
  if (a instanceof FormulaError) return a;
  return (100 + dim * rate * 100) / (1 + dsm * yld) - a * rate * 100;
});

secFn('YIELDMAT', 5, 6, [0, 1, 2, 5], ([s = 0, m = 0, iss = 0, rate = 0, pr = 0, b = 0], ctx) => {
  if (rate < 0 || pr <= 0 || iss >= s) return ERR.NUM;
  const dim = yf(iss, m, b, ctx);
  const dsm = yf(s, m, b, ctx);
  const a = yf(iss, s, b, ctx);
  if (dim instanceof FormulaError) return dim;
  if (dsm instanceof FormulaError) return dsm;
  if (a instanceof FormulaError) return a;
  return ((1 + dim * rate) / (pr / 100 + a * rate) - 1) / dsm;
});
