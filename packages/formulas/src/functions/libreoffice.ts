// Fonctions propres a LibreOffice Calc qui ont un sens dans un tableur Excel : EASTERSUNDAY et les fonctions de calendrier
// (DAYSINMONTH, DAYSINYEAR, ISLEAPYEAR, WEEKSINYEAR, MONTHS, WEEKS, YEARS), les variantes *_ADD (memes calculs que les fonctions
// d'Excel), FOURIER (transformee de Fourier discrete) et SINGLE (intersection implicite, equivalent de l'operateur @).
// Refusees volontairement : IMPORTRANGE (reseau), STYLE / CURRENT / DDE (effets de bord hors formule).
import { toBool, toMatrix, toNumber } from '../eval/coerce.ts';
import { implicitIntersection } from '../eval/evaluator.ts';
import type { EvalContext } from '../eval/types.ts';
import { dateToSerial, daysInMonth, isLeapYear, maxSerial, serialToDate, serialWeekday } from '../format/dates.ts';
import { ERR, FormulaError, Matrix, type Scalar } from '../values.ts';
import { alias, define, type Arg } from './registry.ts';

const D = 'date' as const;

/** Dimanche de Paques (calendrier gregorien, algorithme de Meeus/Jones/Butcher) : [mois, jour]. */
export function easterMonthDay(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return [month, ((h + l - 7 * m + 114) % 31) + 1];
}

define(D, 'EASTERSUNDAY', { min: 1 }, ([a], ctx) => {
  const y0 = toNumber(a, ctx);
  if (y0 instanceof FormulaError) return y0;
  const y = Math.trunc(y0);
  if (y < 1583 || y > 9956) return ERR.NUM;
  const [m, d] = easterMonthDay(y);
  return dateToSerial(y, m, d, ctx.wb.dateSystem);
});

/** Numero de serie d'une date valide ou erreur. */
function dateArg(a: Arg, ctx: EvalContext): number | FormulaError {
  const n = toNumber(a, ctx);
  if (n instanceof FormulaError) return n;
  return n < 0 || n >= maxSerial(ctx.wb.dateSystem) + 1 ? ERR.NUM : Math.floor(n);
}

define(D, 'DAYSINMONTH', { min: 1 }, ([a], ctx) => {
  const s = dateArg(a, ctx);
  if (s instanceof FormulaError) return s;
  const p = serialToDate(s, ctx.wb.dateSystem);
  return daysInMonth(p.y, p.m);
});
define(D, 'DAYSINYEAR', { min: 1 }, ([a], ctx) => {
  const s = dateArg(a, ctx);
  return s instanceof FormulaError ? s : isLeapYear(serialToDate(s, ctx.wb.dateSystem).y) ? 366 : 365;
});
define(D, 'ISLEAPYEAR', { min: 1 }, ([a], ctx) => {
  const s = dateArg(a, ctx);
  return s instanceof FormulaError ? s : isLeapYear(serialToDate(s, ctx.wb.dateSystem).y);
});
/** Annee ISO de 53 semaines : le 1er janvier est un jeudi, ou un mercredi d'annee bissextile. */
define(D, 'WEEKSINYEAR', { min: 1 }, ([a], ctx) => {
  const s = dateArg(a, ctx);
  if (s instanceof FormulaError) return s;
  const y = serialToDate(s, ctx.wb.dateSystem).y;
  const w = serialWeekday(dateToSerial(y, 1, 1, ctx.wb.dateSystem), ctx.wb.dateSystem);
  return w === 4 || (w === 3 && isLeapYear(y)) ? 53 : 52;
});

/** Debut et fin ordonnes d'un intervalle + mode (0 = ecart complet, 1 = ecart de calendrier) ; `sign` = -1 si inverses. */
function interval(a: Arg, b: Arg, t: Arg, ctx: EvalContext): { lo: number; hi: number; sign: number; mode: number } | FormulaError {
  const s = dateArg(a, ctx);
  const e = dateArg(b, ctx);
  if (s instanceof FormulaError) return s;
  if (e instanceof FormulaError) return e;
  const m = t === undefined || t === null ? 0 : toNumber(t, ctx);
  if (m instanceof FormulaError) return m;
  if (m !== 0 && m !== 1) return ERR.NUM;
  return s <= e ? { lo: s, hi: e, sign: 1, mode: m } : { lo: e, hi: s, sign: -1, mode: m };
}

function monthsBetween(lo: number, hi: number, mode: number, ctx: EvalContext): number {
  const p = serialToDate(lo, ctx.wb.dateSystem);
  const q = serialToDate(hi, ctx.wb.dateSystem);
  const calendar = (q.y - p.y) * 12 + (q.m - p.m);
  return mode === 1 || q.d >= p.d ? calendar : calendar - 1;
}

define(D, 'MONTHS', { min: 2, max: 3 }, ([a, b, t], ctx) => {
  const r = interval(a, b, t, ctx);
  return r instanceof FormulaError ? r : r.sign * monthsBetween(r.lo, r.hi, r.mode, ctx);
});
define(D, 'YEARS', { min: 2, max: 3 }, ([a, b, t], ctx) => {
  const r = interval(a, b, t, ctx);
  if (r instanceof FormulaError) return r;
  const months = monthsBetween(r.lo, r.hi, r.mode, ctx);
  return r.sign * (r.mode === 1 ? serialToDate(r.hi, ctx.wb.dateSystem).y - serialToDate(r.lo, ctx.wb.dateSystem).y : Math.floor(months / 12));
});
define(D, 'WEEKS', { min: 2, max: 3 }, ([a, b, t], ctx) => {
  const r = interval(a, b, t, ctx);
  if (r instanceof FormulaError) return r;
  if (r.mode === 0) return r.sign * Math.floor((r.hi - r.lo) / 7);
  const monday = (s: number): number => s - ((serialWeekday(s, ctx.wb.dateSystem) + 6) % 7);
  return r.sign * ((monday(r.hi) - monday(r.lo)) / 7);
});

// ---------- Variantes *_ADD : memes calculs que les fonctions d'Excel ----------

alias('CONVERT_ADD', 'CONVERT');
alias('GCD_ADD', 'GCD');
alias('LCM_ADD', 'LCM');
alias('WEEKNUM_ADD', 'WEEKNUM');
alias('ISOWEEKNUM_ADD', 'ISOWEEKNUM');

// ---------- SINGLE ----------

define('lookup', 'SINGLE', { min: 1, kinds: 'R' }, ([a], ctx) => implicitIntersection(a as Parameters<typeof implicitIntersection>[0], ctx));

// ---------- FOURIER ----------

/** Plus grande taille acceptee (transformee en O(n^2)). */
const MAX_FOURIER = 8192;

/**
 * FOURIER(donnees; [groupes_en_colonnes]; [inverse]; [polaire]) : transformee de Fourier discrete d'une serie reelle (une colonne ou une
 * ligne) ou complexe (deux colonnes ou lignes : partie reelle, partie imaginaire). Resultat : n lignes de [reel; imaginaire], ou
 * [module; phase] en polaire. La transformee directe n'est pas normalisee ; l'inverse est divisee par n.
 */
define('engineering', 'FOURIER', { min: 1, max: 4, kinds: 'RSSS' }, (args, ctx) => {
  const m = toMatrix(args[0], ctx);
  if (m instanceof FormulaError) return m;
  let byCol = true;
  let inverse = false;
  let polar = false;
  for (let i = 1; i < 4; i++) {
    const a = args[i];
    if (a === undefined || a === null) continue;
    const b = toBool(a, ctx);
    if (b instanceof FormulaError) return b;
    if (i === 1) byCol = b;
    else if (i === 2) inverse = b;
    else polar = b;
  }
  const n = byCol ? m.rows : m.cols;
  const width = byCol ? m.cols : m.rows;
  if (width < 1 || width > 2 || n < 1 || n > MAX_FOURIER) return ERR.VALUE;
  const at = (k: number, part: number): Scalar => (byCol ? m.get(k, part) : m.get(part, k));
  const re: number[] = [];
  const im: number[] = [];
  for (let k = 0; k < n; k++) {
    const x = toNumber(at(k, 0), ctx);
    const y = width === 2 ? toNumber(at(k, 1), ctx) : 0;
    if (x instanceof FormulaError) return x;
    if (y instanceof FormulaError) return y;
    re.push(x);
    im.push(y);
  }
  const sign = inverse ? 1 : -1;
  const out: Scalar[] = [];
  for (let f = 0; f < n; f++) {
    let sr = 0;
    let si = 0;
    for (let k = 0; k < n; k++) {
      const ang = (sign * 2 * Math.PI * ((f * k) % n)) / n;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      sr += (re[k] ?? 0) * c - (im[k] ?? 0) * s;
      si += (re[k] ?? 0) * s + (im[k] ?? 0) * c;
    }
    if (inverse) {
      sr /= n;
      si /= n;
    }
    if (polar) out.push(Math.hypot(sr, si), Math.atan2(si, sr));
    else out.push(sr, si);
  }
  return new Matrix(n, 2, out);
});
