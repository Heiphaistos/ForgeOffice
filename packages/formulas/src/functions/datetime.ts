// Fonctions de date et d'heure (systemes 1900 et 1904).
import { textToNumber, toMatrix, toNumber, toText } from '../eval/coerce.ts';
import type { EvalContext } from '../eval/types.ts';
import { dateToSerial, daysInMonth, isLeapYear, maxSerial, serialToDate, serialWeekday, type DateParts } from '../format/dates.ts';
import { ERR, FormulaError } from '../values.ts';
import { define, numFn, type Arg } from './registry.ts';

const D = 'date' as const;

/** Numero de serie valide (entier >= 0, <= 31/12/9999) ou erreur. */
function serialArg(a: Arg, ctx: EvalContext): number | FormulaError {
  const n = toNumber(a, ctx);
  if (n instanceof FormulaError) return n;
  if (n < 0 || n >= maxSerial(ctx.wb.dateSystem) + 1) return ERR.NUM;
  return n;
}

function parts(serial: number, ctx: EvalContext): DateParts {
  return serialToDate(serial, ctx.wb.dateSystem);
}

function fromParts(y: number, m: number, d: number, ctx: EvalContext): number | FormulaError {
  const s = dateToSerial(y, m, d, ctx.wb.dateSystem);
  return s < 0 || s > maxSerial(ctx.wb.dateSystem) ? ERR.NUM : s;
}

numFn(D, 'DATE', 3, 3, ([y = 0, m = 0, d = 0], ctx) => {
  const yy = Math.trunc(y);
  if (yy < 0 || yy >= 10000) return ERR.NUM;
  return fromParts(yy, Math.trunc(m), Math.trunc(d), ctx);
});
define(D, 'DATEVALUE', { min: 1 }, ([a], ctx) => {
  const s = toText(a, ctx);
  if (s instanceof FormulaError) return s;
  if (typeof a === 'number') return ERR.VALUE;
  const n = textToNumber(s, ctx);
  if (n === undefined || !/[/\-.\p{L}]/u.test(s)) return ERR.VALUE;
  return Math.floor(n);
});
define(D, 'TIMEVALUE', { min: 1 }, ([a], ctx) => {
  const s = toText(a, ctx);
  if (s instanceof FormulaError) return s;
  const n = textToNumber(s, ctx);
  if (n === undefined || !/[:]|[AaPp][Mm]/.test(s)) return ERR.VALUE;
  return n - Math.floor(n);
});
const datePart = (name: string, f: (p: DateParts) => number): void =>
  define(D, name, { min: 1 }, ([a], ctx) => {
    const s = serialArg(a, ctx);
    return s instanceof FormulaError ? s : f(parts(s, ctx));
  });
datePart('DAY', (p) => p.d);
datePart('MONTH', (p) => p.m);
datePart('YEAR', (p) => p.y);

/** Secondes de la journee, arrondies a la seconde comme HEURE/MINUTE/SECONDE d'Excel. */
function daySeconds(serial: number): number {
  const s = Math.round((serial - Math.floor(serial)) * 86400);
  return s >= 86400 ? 0 : s;
}
const timePart = (name: string, f: (sec: number) => number): void =>
  define(D, name, { min: 1 }, ([a], ctx) => {
    const s = serialArg(a, ctx);
    return s instanceof FormulaError ? s : f(daySeconds(s));
  });
timePart('HOUR', (s) => Math.floor(s / 3600));
timePart('MINUTE', (s) => Math.floor((s % 3600) / 60));
timePart('SECOND', (s) => s % 60);
numFn(D, 'TIME', 3, 3, ([h = 0, m = 0, s = 0]) => {
  const hh = Math.trunc(h);
  const mm = Math.trunc(m);
  const ss = Math.trunc(s);
  if (hh > 32767 || mm > 32767 || ss > 32767) return ERR.NUM;
  const total = hh * 3600 + mm * 60 + ss;
  if (total < 0) return ERR.NUM;
  return (total % 86400) / 86400;
});
define(D, 'NOW', { min: 0, volatile: true }, (_a, ctx) => ctx.wb.now());
define(D, 'TODAY', { min: 0, volatile: true }, (_a, ctx) => Math.floor(ctx.wb.now()));

function weekdayOf(serial: number, type: number, ctx: EvalContext): number | FormulaError {
  const wd = serialWeekday(serial, ctx.wb.dateSystem);
  if (type === 1) return wd + 1;
  if (type === 2) return ((wd + 6) % 7) + 1;
  if (type === 3) return (wd + 6) % 7;
  if (type >= 11 && type <= 17) {
    const start = (type - 10) % 7;
    return ((wd - start + 7) % 7) + 1;
  }
  return ERR.NUM;
}
define(D, 'WEEKDAY', { min: 1, max: 2 }, ([a, t], ctx) => {
  const s = serialArg(a, ctx);
  if (s instanceof FormulaError) return s;
  const ty = t === undefined || t === null ? 1 : toNumber(t, ctx);
  if (ty instanceof FormulaError) return ty;
  return weekdayOf(Math.floor(s), Math.trunc(ty), ctx);
});

function isoWeek(p: DateParts): number {
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}
define(D, 'ISOWEEKNUM', { min: 1 }, ([a], ctx) => {
  const s = serialArg(a, ctx);
  return s instanceof FormulaError ? s : isoWeek(parts(s, ctx));
});
define(D, 'WEEKNUM', { min: 1, max: 2 }, ([a, t], ctx) => {
  const s = serialArg(a, ctx);
  if (s instanceof FormulaError) return s;
  const ty0 = t === undefined || t === null ? 1 : toNumber(t, ctx);
  if (ty0 instanceof FormulaError) return ty0;
  const ty = Math.trunc(ty0);
  const p = parts(s, ctx);
  if (ty === 21) return isoWeek(p);
  const startMap: Record<number, number> = { 1: 0, 17: 0, 2: 1, 11: 1, 12: 2, 13: 3, 14: 4, 15: 5, 16: 6 };
  const start = startMap[ty];
  if (start === undefined) return ERR.NUM;
  const jan1 = dateToSerial(p.y, 1, 1, ctx.wb.dateSystem);
  const offset = (serialWeekday(jan1, ctx.wb.dateSystem) - start + 7) % 7;
  return Math.floor((Math.floor(s) - jan1 + offset) / 7) + 1;
});

define(D, 'DAYS', { min: 2, max: 2 }, ([e, s], ctx) => {
  const a = serialArg(e, ctx);
  const b = serialArg(s, ctx);
  if (a instanceof FormulaError) return a;
  if (b instanceof FormulaError) return b;
  return Math.floor(a) - Math.floor(b);
});

function isLastOfMonth(p: DateParts): boolean {
  return p.y === 1900 && p.m === 2 ? p.d === 29 : p.d === daysInMonth(p.y, p.m);
}

export function days360(a: DateParts, b: DateParts, european: boolean): number {
  let d1 = a.d;
  let d2 = b.d;
  let m2 = b.m;
  let y2 = b.y;
  if (european) {
    d1 = Math.min(d1, 30);
    d2 = Math.min(d2, 30);
  } else {
    if (isLastOfMonth(a)) d1 = 30;
    if (isLastOfMonth(b) && b.d === 31) {
      if (d1 < 30) {
        d2 = 1;
        m2 += 1;
        if (m2 > 12) {
          m2 = 1;
          y2 += 1;
        }
      } else d2 = 30;
    }
  }
  return (y2 - a.y) * 360 + (m2 - a.m) * 30 + (d2 - d1);
}
define(D, 'DAYS360', { min: 2, max: 3 }, ([s, e, m], ctx) => {
  const a = serialArg(s, ctx);
  const b = serialArg(e, ctx);
  if (a instanceof FormulaError) return a;
  if (b instanceof FormulaError) return b;
  const eu = m === undefined || m === null ? 0 : toNumber(m, ctx);
  if (eu instanceof FormulaError) return eu;
  return days360(parts(a, ctx), parts(b, ctx), eu !== 0);
});

export function addMonths(serial: number, months: number, endOfMonth: boolean, ctx: EvalContext): number | FormulaError {
  const p = parts(serial, ctx);
  const total = p.y * 12 + (p.m - 1) + Math.trunc(months);
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  if (y < 1900 || y > 9999) return ERR.NUM;
  const last = daysInMonth(y, m);
  return fromParts(y, m, endOfMonth ? last : Math.min(p.d, last), ctx);
}
define(D, 'EDATE', { min: 2, max: 2 }, ([s, n], ctx) => {
  const a = serialArg(s, ctx);
  const k = toNumber(n, ctx);
  if (a instanceof FormulaError) return a;
  if (k instanceof FormulaError) return k;
  return addMonths(Math.floor(a), k, false, ctx);
});
define(D, 'EOMONTH', { min: 2, max: 2 }, ([s, n], ctx) => {
  const a = serialArg(s, ctx);
  const k = toNumber(n, ctx);
  if (a instanceof FormulaError) return a;
  if (k instanceof FormulaError) return k;
  return addMonths(Math.floor(a), k, true, ctx);
});

// ---------- Jours ouvres ----------

/** Masque de fin de semaine lundi..dimanche (true = non travaille). */
function weekendMask(a: Arg, ctx: EvalContext): boolean[] | FormulaError {
  if (a === undefined || a === null) return [false, false, false, false, false, true, true];
  if (typeof a === 'string') {
    if (!/^[01]{7}$/.test(a) || a === '1111111') return ERR.VALUE;
    return a.split('').map((c) => c === '1');
  }
  const n = toNumber(a, ctx);
  if (n instanceof FormulaError) return n;
  const k = Math.trunc(n);
  const mask = new Array<boolean>(7).fill(false);
  if (k >= 1 && k <= 7) {
    // 1 = samedi+dimanche, 2 = dimanche+lundi, ... 7 = vendredi+samedi
    mask[(k + 4) % 7] = true;
    mask[(k + 5) % 7] = true;
    return mask;
  }
  if (k >= 11 && k <= 17) {
    mask[(k - 11 + 6) % 7] = true;
    return mask;
  }
  return ERR.NUM;
}

function holidaySet(a: Arg, ctx: EvalContext): Set<number> | FormulaError {
  const out = new Set<number>();
  if (a === undefined || a === null) return out;
  const m = toMatrix(a, ctx);
  if (m instanceof FormulaError) return m;
  for (const v of m.data) {
    if (v === null) continue;
    const n = toNumber(v, ctx);
    if (n instanceof FormulaError) return n;
    out.add(Math.floor(n));
  }
  return out;
}

/** Index lundi=0..dimanche=6. */
function monIndex(serial: number, ctx: EvalContext): number {
  return (serialWeekday(serial, ctx.wb.dateSystem) + 6) % 7;
}

function networkDays(start: number, end: number, mask: boolean[], hol: Set<number>, ctx: EvalContext): number {
  const sign = end >= start ? 1 : -1;
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const span = hi - lo + 1;
  const perWeek = mask.filter((w) => !w).length;
  let count = Math.floor(span / 7) * perWeek;
  for (let d = lo + Math.floor(span / 7) * 7; d <= hi; d++) if (!mask[monIndex(d, ctx)]) count++;
  for (const h of hol) if (h >= lo && h <= hi && !mask[monIndex(h, ctx)]) count--;
  return sign * count;
}

function networkImpl(intl: boolean) {
  return (args: Arg[], ctx: EvalContext): number | FormulaError => {
    const s = serialArg(args[0], ctx);
    const e = serialArg(args[1], ctx);
    if (s instanceof FormulaError) return s;
    if (e instanceof FormulaError) return e;
    const mask = weekendMask(intl ? args[2] : undefined, ctx);
    if (mask instanceof FormulaError) return mask;
    const hol = holidaySet(intl ? args[3] : args[2], ctx);
    if (hol instanceof FormulaError) return hol;
    return networkDays(Math.floor(s), Math.floor(e), mask, hol, ctx);
  };
}
define(D, 'NETWORKDAYS', { min: 2, max: 3, kinds: 'SSV' }, networkImpl(false));
define(D, 'NETWORKDAYS.INTL', { min: 2, max: 4, kinds: 'SSSV' }, networkImpl(true));

function workdayImpl(intl: boolean) {
  return (args: Arg[], ctx: EvalContext): number | FormulaError => {
    const s = serialArg(args[0], ctx);
    const n = toNumber(args[1], ctx);
    if (s instanceof FormulaError) return s;
    if (n instanceof FormulaError) return n;
    const mask = weekendMask(intl ? args[2] : undefined, ctx);
    if (mask instanceof FormulaError) return mask;
    const hol = holidaySet(intl ? args[3] : args[2], ctx);
    if (hol instanceof FormulaError) return hol;
    let d = Math.floor(s);
    let left = Math.trunc(n);
    const step = left >= 0 ? 1 : -1;
    const max = maxSerial(ctx.wb.dateSystem);
    while (left !== 0) {
      d += step;
      if (d < 0 || d > max) return ERR.NUM;
      if (!mask[monIndex(d, ctx)] && !hol.has(d)) left -= step;
    }
    return d;
  };
}
define(D, 'WORKDAY', { min: 2, max: 3, kinds: 'SSV' }, workdayImpl(false));
define(D, 'WORKDAY.INTL', { min: 2, max: 4, kinds: 'SSSV' }, workdayImpl(true));

// ---------- FRACTION.ANNEE, DATEDIF ----------

/** Fraction d'annee entre deux numeros de serie selon la base (0 a 4). */
export function yearFrac(s: number, e: number, basis: number, ctx: EvalContext): number | FormulaError {
  const a = Math.floor(Math.min(s, e));
  const b = Math.floor(Math.max(s, e));
  const pa = parts(a, ctx);
  const pb = parts(b, ctx);
  switch (basis) {
    case 0: {
      let d1 = pa.d;
      let d2 = pb.d;
      const febEnd = (p: DateParts): boolean => p.m === 2 && p.d === daysInMonth(p.y, 2);
      if (febEnd(pa) && febEnd(pb)) d2 = 30;
      if (d2 === 31 && d1 >= 30) d2 = 30;
      if (d1 === 31 || febEnd(pa)) d1 = 30;
      return ((pb.y - pa.y) * 360 + (pb.m - pa.m) * 30 + (d2 - d1)) / 360;
    }
    case 1: {
      if (a === b) return 0;
      const within =
        pa.y === pb.y || (pb.y === pa.y + 1 && (pa.m > pb.m || (pa.m === pb.m && pa.d >= pb.d)));
      if (within) {
        let leap = false;
        if (pa.y === pb.y) leap = isLeapYear(pa.y);
        else {
          leap = (isLeapYear(pa.y) && (pa.m < 3)) || (isLeapYear(pb.y) && (pb.m > 2 || (pb.m === 2 && pb.d === 29)));
        }
        return (b - a) / (leap ? 366 : 365);
      }
      let total = 0;
      for (let y = pa.y; y <= pb.y; y++) total += isLeapYear(y) ? 366 : 365;
      return (b - a) / (total / (pb.y - pa.y + 1));
    }
    case 2:
      return (b - a) / 360;
    case 3:
      return (b - a) / 365;
    case 4:
      return ((pb.y - pa.y) * 360 + (pb.m - pa.m) * 30 + (Math.min(pb.d, 30) - Math.min(pa.d, 30))) / 360;
    default:
      return ERR.NUM;
  }
}
define(D, 'YEARFRAC', { min: 2, max: 3 }, ([s, e, b], ctx) => {
  const a = serialArg(s, ctx);
  const c = serialArg(e, ctx);
  if (a instanceof FormulaError) return a;
  if (c instanceof FormulaError) return c;
  const basis = b === undefined || b === null ? 0 : toNumber(b, ctx);
  if (basis instanceof FormulaError) return basis;
  const k = Math.trunc(basis);
  if (k < 0 || k > 4) return ERR.NUM;
  return yearFrac(a, c, k, ctx);
});
define(D, 'DATEDIF', { min: 3, max: 3 }, ([s, e, u], ctx) => {
  const a = serialArg(s, ctx);
  const b = serialArg(e, ctx);
  const unit = toText(u, ctx);
  if (a instanceof FormulaError) return a;
  if (b instanceof FormulaError) return b;
  if (unit instanceof FormulaError) return unit;
  const x = Math.floor(a);
  const y = Math.floor(b);
  if (x > y) return ERR.NUM;
  const p = parts(x, ctx);
  const q = parts(y, ctx);
  let months = (q.y - p.y) * 12 + (q.m - p.m);
  if (q.d < p.d) months--;
  switch (unit.toUpperCase()) {
    case 'Y':
      return Math.floor(months / 12);
    case 'M':
      return months;
    case 'D':
      return y - x;
    case 'YM':
      return ((months % 12) + 12) % 12;
    case 'MD': {
      if (q.d >= p.d) return q.d - p.d;
      const pm = q.m === 1 ? 12 : q.m - 1;
      const py = q.m === 1 ? q.y - 1 : q.y;
      return daysInMonth(py, pm) - p.d + q.d;
    }
    case 'YD': {
      let anniv = dateToSerial(q.y, p.m, p.d, ctx.wb.dateSystem);
      if (anniv > y) anniv = dateToSerial(q.y - 1, p.m, p.d, ctx.wb.dateSystem);
      return y - anniv;
    }
    default:
      return ERR.NUM;
  }
});
