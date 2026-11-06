// Titres a periode irreguliere et amortissements comptables : ACCRINT, AMORLINC, AMORDEGRC, ODDFPRICE/YIELD, ODDLPRICE/YIELD.
import { toBool } from '../eval/coerce.ts';
import type { EvalContext } from '../eval/types.ts';
import { serialToDate } from '../format/dates.ts';
import { ERR, FormulaError } from '../values.ts';
import { addMonths, days360, yearFrac } from './datetime.ts';
import { solve } from './financial.ts';
import { define } from './registry.ts';
import { badBasis, badFreq, isMonthEnd, secFn } from './securities.ts';

/** Jours entre deux dates selon la base (30/360 US ou europeen, sinon jours reels). */
function dayCount(a: number, b: number, basis: number, ctx: EvalContext): number {
  if (basis !== 0 && basis !== 4) return b - a;
  return days360(serialToDate(a, ctx.wb.dateSystem), serialToDate(b, ctx.wb.dateSystem), basis === 4);
}

/** Longueur normale d'une periode de coupon [p, q]. */
function periodLength(p: number, q: number, freq: number, basis: number): number {
  return basis === 1 ? q - p : basis === 3 ? 365 / freq : 360 / freq;
}

/** Date de coupon theorique `anchor + k * pas` (k entier, negatif = avant l'ancre). */
function quasiDate(anchor: number, k: number, freq: number, eom: boolean, ctx: EvalContext): number | FormulaError {
  return addMonths(anchor, (12 / freq) * k, eom, ctx);
}

/**
 * Somme, sur les periodes de coupon theoriques recouvertes par [from, to], de (jours couverts / longueur normale).
 * `anchor` est une date de coupon ; les periodes sont [anchor + k pas, anchor + (k+1) pas].
 */
function periodsBetween(
  anchor: number, from: number, to: number, freq: number, basis: number, ctx: EvalContext, wholeAsOne = false, skipUntil?: number,
): number | FormulaError {
  if (to <= from) return 0;
  const eom = isMonthEnd(serialToDate(anchor, ctx.wb.dateSystem));
  let k = 0;
  let lo = anchor;
  while (lo > from) {
    k--;
    const d = quasiDate(anchor, k, freq, eom, ctx);
    if (d instanceof FormulaError) return d;
    lo = d;
  }
  // lo <= from : on avance periode par periode jusqu'a `to`
  const before = wholeAsOne && basis === 1 ? quasiDate(anchor, -1, freq, eom, ctx) : anchor;
  if (before instanceof FormulaError) return before;
  const firstLength = periodLength(before, anchor, freq, basis);
  let total = 0;
  let firstPeriod = true;
  for (let guard = 0; guard < 4000 && lo < to; guard++) {
    const hi = quasiDate(anchor, k + 1, freq, eom, ctx);
    if (hi instanceof FormulaError) return hi;
    const a = Math.max(lo, from);
    const b = Math.min(hi, to);
    const skip = skipUntil !== undefined && !firstPeriod && a === lo && b === hi && hi <= skipUntil;
    firstPeriod = false;
    if (b > a && !skip) {
      if (wholeAsOne && a === lo && b === hi && hi < to) total += 1;
      else if (wholeAsOne && lo >= anchor) total += dayCount(a, b, basis, ctx) / firstLength;
      else total += dayCount(a, b, basis, ctx) / periodLength(lo, hi, freq, basis);
    }
    lo = hi;
    k++;
  }
  return total;
}

// ---------- ACCRINT ----------

define('financial', 'ACCRINT', { min: 6, max: 8 }, (args, ctx) => {
  const v: number[] = [];
  for (let i = 0; i < 7; i++) {
    const a = args[i];
    if (a === undefined || a === null) {
      v.push(i === 6 ? 0 : NaN);
      continue;
    }
    if (a instanceof FormulaError) return a;
    if (typeof a !== 'number') return ERR.VALUE;
    v.push(a);
  }
  let method = true;
  if (args[7] !== undefined && args[7] !== null) {
    const m = toBool(args[7], ctx);
    if (m instanceof FormulaError) return m;
    method = m;
  }
  const [iss = NaN, first = NaN, settle = NaN, rate = NaN, par = NaN, freq = NaN, basis = 0] = v;
  if ([iss, first, settle, rate, par, freq].some(Number.isNaN)) return ERR.VALUE;
  const [i, f, s, fr, b] = [iss, first, settle, freq, basis].map(Math.trunc) as [number, number, number, number, number];
  if (rate <= 0 || par <= 0 || badFreq(fr) || badBasis(b) || i >= s) return ERR.NUM;
  // calc_method FALSE : les periodes entieres entre celle de l'emission et la derniere avant `f` (ou celle du reglement) sont ignorees
  let skipUntil: number | undefined;
  if (!method) {
    const eom = isMonthEnd(serialToDate(f, ctx.wb.dateSystem));
    let k = s >= f ? -1 : 0;
    let d = quasiDate(f, k, fr, eom, ctx);
    while (s < f && d instanceof FormulaError === false && d > s) d = quasiDate(f, --k, fr, eom, ctx);
    if (d instanceof FormulaError) return d;
    skipUntil = d;
  }
  const sum = periodsBetween(f, i, s, fr, b, ctx, true, skipUntil);
  return sum instanceof FormulaError ? sum : (par * rate * sum) / fr;
});

// ---------- Amortissements francais ----------

interface AmortInput {
  cost: number;
  yf: number;
  salvage: number;
  period: number;
  rate: number;
}

function amortArgs(a: number[], ctx: EvalContext): AmortInput | FormulaError {
  const [cost = 0, purchased = 0, first = 0, salvage = 0, period = 0, rate = 0, basis = 0] = a;
  const b = Math.trunc(basis);
  if (cost < 0 || salvage < 0 || salvage > cost || period < 0 || rate <= 0 || purchased > first || b < 0 || b > 4 || b === 2) {
    return ERR.NUM;
  }
  const [from, to] = [Math.trunc(purchased), Math.trunc(first)];
  const year = serialToDate(from, ctx.wb.dateSystem).y;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  // la base 1 divise par la longueur de l'annee d'achat ; la fraction est plafonnee a une annee
  const yf = b === 1 ? (to - from) / (leap ? 366 : 365) : yearFrac(from, to, b, ctx);
  return yf instanceof FormulaError ? yf : { cost, yf: Math.min(1, yf), salvage, period: Math.trunc(period), rate };
}

secFn('AMORLINC', 6, 7, [], (a, ctx) => {
  const p = amortArgs(a, ctx);
  if (p instanceof FormulaError) return p;
  const one = p.cost * p.rate;
  const first = p.yf * p.rate * p.cost;
  const full = Math.trunc((p.cost - p.salvage - first) / one);
  if (p.period === 0) return first;
  if (p.period <= full) return one;
  if (p.period === full + 1) return p.cost - p.salvage - one * full - first;
  return 0;
});

const round = (x: number): number => Math.floor(x + 0.5);

secFn('AMORDEGRC', 6, 7, [], (a, ctx) => {
  const p = amortArgs(a, ctx);
  if (p instanceof FormulaError) return p;
  if (p.rate >= 0.5) return ERR.NUM;
  const life = 1 / p.rate;
  const rate = p.rate * (life <= 4 ? 1.5 : life <= 6 ? 2 : 2.5);
  const periods = Math.ceil(life - 1e-9);
  const first = round(p.yf * rate * p.cost);
  if (p.period === 0) return first;
  let rest = p.cost - first;
  let dep = 0;
  for (let n = 1; n <= p.period; n++) {
    if (n >= periods || rest < p.salvage) dep = 0;
    else if (n >= periods - 2) dep = n === periods - 2 ? rest / 2 : dep;
    else dep = rate * rest;
    rest -= dep;
  }
  return round(dep);
});

// ---------- Premiere periode irreguliere ----------

function oddFirst(a: number[], ctx: EvalContext): ((yld: number) => number) | FormulaError {
  const [s0 = 0, m0 = 0, i0 = 0, f0 = 0, rate = 0, red = 0, fr = 0, b0 = 0] = a;
  const [s, m, iss, fc, freq, basis] = [s0, m0, i0, f0, fr, b0].map(Math.trunc) as [number, number, number, number, number, number];
  if (!(m > fc && fc > s && s > iss) || rate < 0 || red <= 0 || badFreq(freq) || badBasis(basis)) return ERR.NUM;
  const eom = isMonthEnd(serialToDate(fc, ctx.wb.dateSystem));
  let n = 1;
  for (let guard = 0; guard < 4000; guard++) {
    const d = quasiDate(fc, n, freq, eom, ctx);
    if (d instanceof FormulaError) return d;
    if (d > m) break;
    n++;
    if (d === m) break;
  }
  const c = (100 * rate) / freq;
  const first = periodsBetween(fc, iss, fc, freq, basis, ctx);
  const accrued = periodsBetween(fc, iss, s, freq, basis, ctx);
  const t1 = periodsBetween(fc, s, fc, freq, basis, ctx);
  if (first instanceof FormulaError) return first;
  if (accrued instanceof FormulaError) return accrued;
  if (t1 instanceof FormulaError) return t1;
  return (yld) => {
    const v = 1 / (1 + yld / freq);
    let p = red * v ** (t1 + n - 1) + c * first * v ** t1;
    for (let k = 2; k <= n; k++) p += c * v ** (t1 + k - 1);
    return p - c * accrued;
  };
}

secFn('ODDFPRICE', 8, 9, [], (a, ctx) => {
  const [s, m, i, fc, rate, yld = 0, red, fr, b = 0] = a;
  if (yld < 0) return ERR.NUM;
  const price = oddFirst([s ?? 0, m ?? 0, i ?? 0, fc ?? 0, rate ?? 0, red ?? 0, fr ?? 0, b], ctx);
  return price instanceof FormulaError ? price : price(yld);
});

secFn('ODDFYIELD', 8, 9, [], (a, ctx) => {
  const [s, m, i, fc, rate = 0, pr = 0, red, fr, b = 0] = a;
  if (pr <= 0) return ERR.NUM;
  const price = oddFirst([s ?? 0, m ?? 0, i ?? 0, fc ?? 0, rate ?? 0, red ?? 0, fr ?? 0, b], ctx);
  if (price instanceof FormulaError) return price;
  const y = solve((x) => price(x) - pr, rate > 0 ? rate : 0.05, 200, 1e-12);
  return y === undefined ? ERR.NUM : y;
});

// ---------- Derniere periode irreguliere ----------

interface OddLast {
  coupon: number;
  accrued: number;
  toMaturity: number;
  fromLast: number;
  red: number;
  freq: number;
}

function oddLast(a: number[], ctx: EvalContext): OddLast | FormulaError {
  const [s0 = 0, m0 = 0, l0 = 0, rate = 0, red = 0, fr = 0, b0 = 0] = a;
  const [s, m, last, freq, basis] = [s0, m0, l0, fr, b0].map(Math.trunc) as [number, number, number, number, number];
  if (!(m > s && s > last) || rate < 0 || red <= 0 || badFreq(freq) || badBasis(basis)) return ERR.NUM;
  const fromLast = periodsBetween(last, last, m, freq, basis, ctx);
  const accrued = periodsBetween(last, last, s, freq, basis, ctx);
  const toMaturity = periodsBetween(last, s, m, freq, basis, ctx);
  if (fromLast instanceof FormulaError) return fromLast;
  if (accrued instanceof FormulaError) return accrued;
  if (toMaturity instanceof FormulaError) return toMaturity;
  return { coupon: (100 * rate) / freq, accrued, toMaturity, fromLast, red, freq };
}

secFn('ODDLPRICE', 7, 8, [], (a, ctx) => {
  const [s, m, l, rate, yld = 0, red, fr, b = 0] = a;
  if (yld < 0) return ERR.NUM;
  const o = oddLast([s ?? 0, m ?? 0, l ?? 0, rate ?? 0, red ?? 0, fr ?? 0, b], ctx);
  if (o instanceof FormulaError) return o;
  return (o.red + o.coupon * o.fromLast) / (1 + (o.toMaturity * yld) / o.freq) - o.coupon * o.accrued;
});

secFn('ODDLYIELD', 7, 8, [], (a, ctx) => {
  const [s, m, l, rate, pr = 0, red, fr, b = 0] = a;
  if (pr <= 0) return ERR.NUM;
  const o = oddLast([s ?? 0, m ?? 0, l ?? 0, rate ?? 0, red ?? 0, fr ?? 0, b], ctx);
  if (o instanceof FormulaError) return o;
  return (((o.red + o.coupon * o.fromLast) / (pr + o.coupon * o.accrued) - 1) * o.freq) / o.toMaturity;
});
