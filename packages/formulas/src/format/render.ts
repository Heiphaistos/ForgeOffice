// Application d'un code de format Excel a une valeur : formatValue(valeur, code, region).
import { errorToFr } from '../parse/syntax.ts';
import { FormulaError, type Scalar } from '../values.ts';
import { maxSerial, serialToDate, serialWeekday, type DateSystem } from './dates.ts';
import { localeData, type LocaleData, type NumberLocale } from './locale.ts';
import { compileFormat, type Part, type Section } from './numfmt.ts';

export interface FormatResult {
  text: string;
  /** Couleur demandee par le format ([Rouge], [Color10]...) en #RRGGBB. */
  color?: string | undefined;
}

export interface FormatOptions {
  dateSystem?: DateSystem;
  /** Largeur maximale du format Standard (11 caracteres comme une colonne par defaut). */
  generalWidth?: number;
}

/** Ecrit un nombre positif en decimal exact a 15 chiffres significatifs. */
function plainDigits(x: number): { int: string; frac: string } {
  const s = x.toPrecision(15);
  const m = s.match(/^(\d)(?:\.(\d+))?e([+-]\d+)$/);
  if (!m) {
    const [i = '0', f = ''] = s.split('.');
    return { int: i, frac: f };
  }
  const digits = (m[1] ?? '') + (m[2] ?? '');
  const e = Number(m[3]);
  if (e >= 0) {
    const pos = e + 1;
    if (digits.length <= pos) return { int: digits + '0'.repeat(pos - digits.length), frac: '' };
    return { int: digits.slice(0, pos), frac: digits.slice(pos) };
  }
  return { int: '0', frac: '0'.repeat(-e - 1) + digits };
}

/** Arrondi decimal au plus proche (moitie vers le haut), sur la representation a 15 chiffres. */
export function roundDecimal(x: number, decimals: number): { int: string; frac: string } {
  const p = plainDigits(Math.abs(x));
  let frac = p.frac.padEnd(decimals + 1, '0');
  const roundUp = Number(frac[decimals]) >= 5;
  frac = frac.slice(0, decimals);
  let all = (p.int + frac).split('').map(Number);
  if (roundUp) {
    let k = all.length - 1;
    while (k >= 0) {
      const d = (all[k] ?? 0) + 1;
      if (d < 10) {
        all[k] = d;
        break;
      }
      all[k] = 0;
      k--;
    }
    if (k < 0) all = [1, ...all];
  }
  const joined = all.join('');
  const intLen = joined.length - decimals;
  const int = joined.slice(0, intLen).replace(/^0+(?=\d)/, '');
  return { int: int === '' ? '0' : int, frac: joined.slice(intLen) };
}

function trimZeros(frac: string): string {
  return frac.replace(/0+$/, '');
}

function sciText(a: number, decimals: number, l: LocaleData): string {
  if (a === 0) return '0';
  let e = Math.floor(Math.log10(a));
  let r = roundDecimal(a / 10 ** e, decimals);
  if (r.int === '10') {
    e++;
    r = roundDecimal(a / 10 ** e, decimals);
  }
  const f = trimZeros(r.frac);
  const exp = `E${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`;
  return r.int + (f ? l.decimal + f : '') + exp;
}

/** Format Standard (General) d'Excel : au plus `width` caracteres. */
export function formatGeneral(v: number, locale: NumberLocale | LocaleData = 'fr-FR', width = 11): string {
  const l = typeof locale === 'string' ? localeData(locale) : locale;
  if (!Number.isFinite(v)) return '#NUM!';
  if (v === 0) return '0';
  const neg = v < 0;
  const a = Math.abs(v);
  const avail = width - (neg ? 1 : 0);
  const sign = neg ? '-' : '';
  const exp = Math.floor(Math.log10(Number(a.toPrecision(15))));
  const intDigits = Math.max(1, exp + 1);
  const expLen = Math.abs(exp) >= 100 ? 5 : 4;
  const sci = (): string => sciText(a, Math.max(0, avail - expLen - 2), l);
  if (intDigits > avail) return sign + sci();
  const decimals = Math.max(0, avail - intDigits - 1);
  const r = roundDecimal(a, decimals);
  const f = trimZeros(r.frac);
  const dec = r.int + (f ? l.decimal + f : '');
  if (r.int.length > avail) return sign + sci();
  if (a >= 1) return sign + dec;
  const exact = Number(`${r.int}.${f || '0'}`) === Number(a.toPrecision(15));
  if (exact && f !== '') return sign + dec;
  const sigDec = (r.int + f).replace(/^0+/, '').length;
  const s = sci();
  const sigSci = s.replace(/E.*$/, '').replace(/\D/g, '').replace(/0+$/, '').length;
  return sign + (sigDec === 0 || sigSci > sigDec ? s : dec);
}

/** Conversion nombre -> texte d'Excel (concatenation, TEXTE implicite) : 15 chiffres significatifs. */
export function numberToText(v: number, locale: NumberLocale | LocaleData = 'fr-FR'): string {
  const l = typeof locale === 'string' ? localeData(locale) : locale;
  if (v === 0) return '0';
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  const n = Number(a.toPrecision(15));
  if (n >= 1e15 || n < 1e-9) return sign + sciText(a, 14, l);
  const p = plainDigits(a);
  const f = trimZeros(p.frac);
  return sign + p.int + (f ? l.decimal + f : '');
}

function groupDigits(s: string, sep: string): string {
  const m = s.match(/^(\s*)(\d+)$/);
  if (!m) return s;
  const digits = m[2] ?? '';
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += sep;
    out += digits[i];
  }
  return (m[1] ?? '') + out;
}

type DigitPart = Extract<Part, { k: 'digit' }>;

function padChar(p: DigitPart): string {
  return p.ch === '0' ? '0' : p.ch === '?' ? ' ' : '';
}

/** Rend des chiffres entiers dans une suite de jetons (litteraux intercales eventuels). */
function renderIntegerRun(parts: Part[], digits: string, grouping: boolean, l: LocaleData): string {
  const ph = parts.filter((p): p is DigitPart => p.k === 'digit');
  const first = parts.findIndex((p) => p.k === 'digit');
  let last = -1;
  parts.forEach((p, i) => {
    if (p.k === 'digit') last = i;
  });
  const interleaved = parts.slice(first, last + 1).some((p) => p.k === 'lit');
  const d = digits.split('');
  if (!interleaved) {
    let s = '';
    for (let i = ph.length - 1; i >= 0; i--) {
      const p = ph[i];
      if (!p) continue;
      s = (d.length > 0 ? (d.pop() ?? '') : padChar(p)) + s;
    }
    s = d.join('') + s;
    if (grouping) s = groupDigits(s, l.group);
    let out = '';
    parts.forEach((p, i) => {
      if (i === first) out += s;
      else if (p.k === 'lit') out += p.v;
    });
    return out;
  }
  const assigned: string[] = new Array<string>(ph.length).fill('');
  for (let i = ph.length - 1; i >= 0; i--) {
    const p = ph[i];
    if (!p) continue;
    assigned[i] = d.length > 0 ? (d.pop() ?? '') : padChar(p);
  }
  assigned[0] = d.join('') + (assigned[0] ?? '');
  let out = '';
  let k = 0;
  for (const p of parts) {
    if (p.k === 'digit') out += assigned[k++] ?? '';
    else if (p.k === 'lit') out += p.v;
  }
  return out;
}

function renderFracRun(parts: Part[], frac: string, l: LocaleData): string {
  let lastNonZero = -1;
  for (let i = 0; i < frac.length; i++) if (frac[i] !== '0') lastNonZero = i;
  let out = '';
  let k = 0;
  for (const p of parts) {
    if (p.k === 'dot') out += l.decimal;
    else if (p.k === 'lit') out += p.v;
    else if (p.k === 'digit') {
      const ch = frac[k] ?? '0';
      if (k <= lastNonZero || p.ch === '0') out += ch;
      else if (p.ch === '?') out += ' ';
      k++;
    }
  }
  return out;
}

function bestFraction(x: number, maxDen: number): [number, number] {
  if (x === 0) return [0, 1];
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let b = x;
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) {
      const t = Math.floor((maxDen - k0) / k1);
      const hc = t * h1 + h0;
      const kc = t * k1 + k0;
      return Math.abs(x - hc / kc) < Math.abs(x - h1 / k1) ? [hc, kc] : [h1, k1];
    }
    [h0, h1, k0, k1] = [h1, h2, k1, k2];
    if (Math.abs(b - a) < 1e-12) break;
    b = 1 / (b - a);
  }
  return [h1, k1];
}

function renderFraction(x: number, sec: Section, l: LocaleData): string {
  const parts = sec.parts;
  const slash = parts.findIndex((p) => p.k === 'slash');
  // Numerateur : chiffres contigus juste avant la barre.
  let numStart = slash;
  while (numStart > 0 && parts[numStart - 1]?.k === 'digit') numStart--;
  const intParts = parts.slice(0, numStart);
  const hasInt = intParts.some((p) => p.k === 'digit');
  const numParts = parts.slice(numStart, slash) as DigitPart[];
  const after = parts.slice(slash + 1);
  const fixed = after.find((p) => p.k === 'denom');
  let denEnd = 0;
  while (after[denEnd]?.k === 'digit') denEnd++;
  const denParts = after.slice(0, denEnd) as DigitPart[];
  const tail = after.slice(fixed ? after.indexOf(fixed) + 1 : denEnd);
  let whole = hasInt ? Math.floor(x) : 0;
  const rest = hasInt ? x - whole : x;
  let num: number;
  let den: number;
  if (fixed && fixed.k === 'denom') {
    den = fixed.v;
    num = Math.round(rest * den);
  } else {
    [num, den] = bestFraction(rest, 10 ** Math.max(1, denParts.length) - 1);
  }
  if (hasInt && num === den) {
    whole++;
    num = 0;
  }
  let out = hasInt ? renderIntegerRun(intParts, whole === 0 ? '' : String(whole), false, l) : '';
  if (hasInt && whole === 0 && num === 0) out = renderIntegerRun(intParts, '0', false, l);
  const numTxt = String(num).padStart(numParts.length, ' ');
  const denTxt = fixed ? String(den) : String(den).padEnd(denParts.length, ' ');
  if (hasInt && num === 0) out += ' '.repeat(numTxt.length + 1 + denTxt.length);
  else out += `${numTxt}/${denTxt}`;
  for (const p of tail) if (p.k === 'lit') out += p.v;
  return out;
}

function renderScientific(x: number, sec: Section, l: LocaleData): string {
  const parts = sec.parts;
  const expIdx = parts.findIndex((p) => p.k === 'exp');
  const expPart = parts[expIdx];
  const mant = parts.slice(0, expIdx);
  const dot = mant.findIndex((p) => p.k === 'dot');
  const intRun = dot < 0 ? mant : mant.slice(0, dot);
  const fracRun = dot < 0 ? [] : mant.slice(dot);
  const intPh = intRun.filter((p): p is DigitPart => p.k === 'digit');
  const nInt = intPh.length;
  const nDec = fracRun.filter((p) => p.k === 'digit').length;
  const expDigits = parts.slice(expIdx + 1).filter((p) => p.k === 'digit').length;
  let e = 0;
  if (x !== 0) {
    e = Math.floor(Math.log10(x));
    if (nInt > 1 && intPh.some((p) => p.ch === '#')) e = Math.floor(e / nInt) * nInt;
    else if (nInt >= 1) e -= nInt - 1;
    else e += 1;
  }
  let r = roundDecimal(x / 10 ** e, nDec);
  if (x !== 0 && nInt <= 1 && r.int.length > Math.max(1, nInt)) {
    e += 1;
    r = roundDecimal(x / 10 ** e, nDec);
  }
  let out = renderIntegerRun(intRun, r.int === '0' && !intPh.some((p) => p.ch === '0') ? '' : r.int, false, l);
  out += renderFracRun(fracRun, r.frac, l);
  const plus = expPart?.k === 'exp' && expPart.plus;
  out += `E${e < 0 ? '-' : plus ? '+' : ''}${String(Math.abs(e)).padStart(expDigits, '0')}`;
  for (const p of parts.slice(expIdx + 1)) if (p.k === 'lit') out += p.v;
  return out;
}

function renderNumber(x: number, sec: Section, l: LocaleData, generalWidth: number): string {
  const parts = sec.parts;
  if (parts.some((p) => p.k === 'general')) {
    return parts.map((p) => (p.k === 'general' ? formatGeneral(x, l, generalWidth) : p.k === 'lit' ? p.v : '')).join('');
  }
  if (!parts.some((p) => p.k === 'digit')) return parts.map((p) => (p.k === 'lit' ? p.v : '')).join('');
  if (parts.some((p) => p.k === 'slash')) return renderFraction(x, sec, l);
  if (parts.some((p) => p.k === 'exp')) return renderScientific(x, sec, l);
  const dot = parts.findIndex((p) => p.k === 'dot');
  const intEnd = dot < 0 ? parts.length : dot;
  let lastIntDigit = -1;
  let firstIntDigit = -1;
  for (let i = 0; i < intEnd; i++) {
    if (parts[i]?.k === 'digit') {
      if (firstIntDigit < 0) firstIntDigit = i;
      lastIntDigit = i;
    }
  }
  let grouping = false;
  let scale = 0;
  for (let i = 0; i < intEnd; i++) {
    if (parts[i]?.k !== 'comma') continue;
    if (i > firstIntDigit && i < lastIntDigit && firstIntDigit >= 0) grouping = true;
    else if (i > lastIntDigit && lastIntDigit >= 0) scale++;
  }
  let v = x / 1000 ** scale;
  v *= 100 ** parts.filter((p) => p.k === 'pct').length;
  const fracParts = dot < 0 ? [] : parts.slice(dot);
  const nDec = fracParts.filter((p) => p.k === 'digit').length;
  const r = roundDecimal(v, nDec);
  const intParts = parts.slice(0, intEnd).filter((p) => p.k !== 'comma');
  const hasZero = intParts.some((p) => p.k === 'digit' && p.ch === '0');
  const digits = r.int === '0' && !hasZero ? '' : r.int;
  let out: string;
  if (firstIntDigit < 0) {
    // Pas d'emplacement entier (".00") : les chiffres entiers s'affichent quand meme avant la virgule.
    out = intParts.map((p) => (p.k === 'lit' ? p.v : '')).join('') + digits;
  } else out = renderIntegerRun(intParts, digits, grouping, l);
  return out + renderFracRun(fracParts, r.frac, l);
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

function renderDate(x: number, sec: Section, l: LocaleData, system: DateSystem): string {
  if (x < 0 || x >= maxSerial(system) + 1) return '#'.repeat(10);
  let sub = 0;
  for (const p of sec.parts) if (p.k === 'date' && p.tok === 'sub') sub = Math.max(sub, Math.min(3, p.width));
  const unit = 10 ** (3 - sub);
  const totalMs = Math.round((x * 86400000) / unit) * unit;
  const day = Math.floor(totalMs / 86400000);
  let ms = totalMs - day * 86400000;
  const h = Math.floor(ms / 3600000);
  ms -= h * 3600000;
  const mi = Math.floor(ms / 60000);
  ms -= mi * 60000;
  const s = Math.floor(ms / 1000);
  ms -= s * 1000;
  const dt = serialToDate(day, system);
  const wd = serialWeekday(day, system);
  let out = '';
  for (const p of sec.parts) {
    if (p.k === 'lit') {
      out += p.v;
      continue;
    }
    if (p.k !== 'date') continue;
    switch (p.tok) {
      case 'y':
      case 'yy':
        out += pad2(dt.y % 100);
        break;
      case 'yyyy':
        out += String(dt.y);
        break;
      case 'm':
        out += String(dt.m);
        break;
      case 'mm':
        out += pad2(dt.m);
        break;
      case 'mmm':
        out += l.monthsShort[dt.m - 1] ?? '';
        break;
      case 'mmmm':
        out += l.months[dt.m - 1] ?? '';
        break;
      case 'mmmmm':
        out += (l.months[dt.m - 1] ?? '').charAt(0).toUpperCase();
        break;
      case 'd':
        out += String(dt.d);
        break;
      case 'dd':
        out += pad2(dt.d);
        break;
      case 'ddd':
        out += l.daysShort[wd] ?? '';
        break;
      case 'dddd':
        out += l.days[wd] ?? '';
        break;
      case 'h':
      case 'hh': {
        const hh = sec.twelveHour ? (h % 12 === 0 ? 12 : h % 12) : h;
        out += p.tok === 'hh' ? pad2(hh) : String(hh);
        break;
      }
      case 'mi':
        out += String(mi);
        break;
      case 'mmi':
        out += pad2(mi);
        break;
      case 's':
        out += String(s);
        break;
      case 'ss':
        out += pad2(s);
        break;
      case '[h]':
        out += String(Math.floor(totalMs / 3600000)).padStart(p.width, '0');
        break;
      case '[m]':
        out += String(Math.floor(totalMs / 60000)).padStart(p.width, '0');
        break;
      case '[s]':
        out += String(Math.floor(totalMs / 1000)).padStart(p.width, '0');
        break;
      case 'sub':
        out += l.decimal + String(Math.floor(ms / 10 ** (3 - p.width))).padStart(p.width, '0');
        break;
      case 'ampm': {
        const t = h < 12 ? l.am : l.pm;
        out += p.upper ? t : t.toLowerCase();
        break;
      }
      case 'ap': {
        const t = h < 12 ? 'A' : 'P';
        out += p.upper ? t : t.toLowerCase();
        break;
      }
    }
  }
  return out;
}

function condHolds(sec: Section, v: number): boolean {
  const c = sec.cond;
  if (!c) return true;
  switch (c.op) {
    case '<':
      return v < c.value;
    case '<=':
      return v <= c.value;
    case '>':
      return v > c.value;
    case '>=':
      return v >= c.value;
    case '=':
      return v === c.value;
    case '<>':
      return v !== c.value;
  }
}

function pickNumberSection(secs: Section[], v: number): { sec: Section | undefined; autoMinus: boolean } {
  const numeric = secs.length === 4 ? secs.slice(0, 3) : secs.filter((s, i) => i < 3 && !(s.hasText && !s.hasNumber && i > 0));
  const s0 = numeric[0];
  const s1 = numeric[1];
  const s2 = numeric[2];
  if (s0?.cond || s1?.cond) {
    let sec: Section | undefined;
    if (s0 && condHolds(s0, v)) sec = s0;
    else if (s1 && (s1.cond ? condHolds(s1, v) : true)) sec = s1;
    else sec = s2;
    const forNegatives = sec?.cond !== undefined && (sec.cond.op === '<' || sec.cond.op === '<=') && sec.cond.value <= 0;
    return { sec, autoMinus: v < 0 && !forNegatives };
  }
  if (numeric.length <= 1) return { sec: s0, autoMinus: v < 0 };
  if (v < 0) return { sec: s1, autoMinus: false };
  if (v === 0 && s2) return { sec: s2, autoMinus: false };
  return { sec: s0, autoMinus: false };
}

/** Formate une valeur avec un code de format Excel ; renvoie le texte et la couleur eventuelle. */
export function formatValueDetailed(
  value: Scalar,
  code: string,
  locale: NumberLocale = 'fr-FR',
  options: FormatOptions = {},
): FormatResult {
  const l = localeData(locale);
  const fmt = compileFormat(code);
  const secs = fmt.sections;
  if (value === null) return { text: '' };
  if (value instanceof FormulaError) return { text: l.id === 'fr-FR' ? errorToFr(value.code) : value.code };
  if (typeof value === 'boolean') return { text: value ? l.trueName : l.falseName };
  if (typeof value === 'string') {
    const textSec = secs.length === 4 ? secs[3] : secs.find((s) => s.hasText);
    if (!textSec) return { text: value };
    const text = textSec.parts.map((p) => (p.k === 'text' ? value : p.k === 'lit' ? p.v : '')).join('');
    return { text, color: textSec.color };
  }
  if (!Number.isFinite(value)) return { text: l.id === 'fr-FR' ? '#NOMBRE!' : '#NUM!' };
  const { sec, autoMinus } = pickNumberSection(secs, value);
  if (!sec) return { text: '' };
  if (sec.isDate) return { text: renderDate(value, sec, l, options.dateSystem ?? 1900), color: sec.color };
  const a = Math.abs(value);
  const body = sec.hasText && !sec.hasNumber
    ? formatGeneral(a, l, options.generalWidth ?? 11)
    : renderNumber(a, sec, l, options.generalWidth ?? 11);
  return { text: (autoMinus ? '-' : '') + body, color: sec.color };
}

/** Formate une valeur avec un code de format Excel (canonique : "#,##0.00", "dd/mm/yyyy"...). */
export function formatValue(value: Scalar, code: string, locale: NumberLocale = 'fr-FR', options: FormatOptions = {}): string {
  return formatValueDetailed(value, code, locale, options).text;
}
