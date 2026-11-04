// Reconnaissance de la saisie comme Excel : nombre, pourcentage, monnaie, date, heure, booleen, erreur, formule.
import { FRENCH, CANONICAL } from '../parse/syntax.ts';
import type { ErrorCode } from '../values.ts';
import { dateToSerial, daysInMonth, type DateSystem } from './dates.ts';
import { localeData, type LocaleData, type NumberLocale } from './locale.ts';

export type ParsedInput =
  | { type: 'blank' }
  | { type: 'formula'; formula: string }
  | { type: 'number'; value: number; format?: string | undefined }
  | { type: 'boolean'; value: boolean }
  | { type: 'error'; value: ErrorCode }
  | { type: 'text'; value: string };

export interface InputOptions {
  dateSystem?: DateSystem;
  /** Annee utilisee quand la date saisie n'en comporte pas (annee courante par defaut). */
  currentYear?: number;
}

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\.$/, '');

function monthFromName(word: string, l: LocaleData): number {
  const w = fold(word);
  if (w.length < 3) return 0;
  for (let i = 0; i < 12; i++) {
    const full = fold(l.months[i] ?? '');
    const short = fold(l.monthsShort[i] ?? '');
    if (w === full || w === short || (w.length >= 3 && full.startsWith(w))) return i + 1;
  }
  // Noms anglais acceptes aussi en francais (et inversement) pour les abreviations courantes.
  const other = l.id === 'fr-FR' ? localeData('en-US') : localeData('fr-FR');
  for (let i = 0; i < 12; i++) {
    if (w === fold(other.months[i] ?? '') || w === fold(other.monthsShort[i] ?? '')) return i + 1;
  }
  return 0;
}

interface NumberParse {
  value: number;
  format?: string | undefined;
}

/** Nombre, pourcentage, monnaie, notation scientifique, negatif entre parentheses. */
function parsePlainNumber(text: string, l: LocaleData): NumberParse | undefined {
  let t = text.trim();
  let neg = false;
  let percent = false;
  let currency = '';
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1).trim();
  }
  const sign = t.match(/^[+-]/);
  if (sign) {
    neg = neg !== (sign[0] === '-');
    t = t.slice(1).trim();
  }
  const cur = t.match(/^([€$£¥])\s*/) ?? t.match(/\s*([€$£¥]|EUR)$/i);
  if (cur) {
    currency = (cur[1] ?? '').toUpperCase() === 'EUR' ? '€' : (cur[1] ?? '');
    t = cur.index === 0 ? t.slice(cur[0].length) : t.slice(0, cur.index);
    const s2 = t.match(/^[+-]/);
    if (s2) {
      neg = neg !== (s2[0] === '-');
      t = t.slice(1);
    }
  }
  if (t.endsWith('%')) {
    percent = true;
    t = t.slice(0, -1).trim();
  }
  if (t === '') return undefined;
  const dec = l.decimal === ',' ? ',' : '\\.';
  const groups = l.groupInput.map((g) => (g === '.' ? '\\.' : g)).join('');
  const re = new RegExp(`^(\\d{1,3}(?:[${groups}]\\d{3})+|\\d*)(?:${dec}(\\d*))?(?:[eE]([+-]?\\d+))?$`);
  const m = t.match(re);
  if (!m || (m[1] === '' && (m[2] === undefined || m[2] === ''))) return undefined;
  const intTxt = (m[1] ?? '').replace(new RegExp(`[${groups}]`, 'g'), '');
  const grouped = (m[1] ?? '').length !== intTxt.length;
  const fracTxt = m[2] ?? '';
  let v = Number(`${intTxt || '0'}.${fracTxt || '0'}${m[3] !== undefined ? `e${m[3]}` : ''}`);
  if (!Number.isFinite(v)) return undefined;
  if (percent) v /= 100;
  if (neg) v = -v;
  const decimals = fracTxt.length > 0 ? '.00' : '';
  let format: string | undefined;
  if (currency) {
    const d = fracTxt.length > 0 ? '.00' : '';
    format = l.id === 'fr-FR' && currency === '€' ? `#,##0${d} [$€-40C]` : `[$${currency}-409]#,##0${d}`;
  } else if (percent) format = `0${fracTxt.length > 0 ? `.${'0'.repeat(fracTxt.length)}` : ''}%`;
  else if (m[3] !== undefined) format = '0.00E+00';
  else if (grouped) format = `#,##0${decimals}`;
  return { value: v, format };
}

function parseFractionInput(text: string): NumberParse | undefined {
  const m = text.trim().match(/^([+-])?(\d+)\s+(\d+)\/(\d+)$/);
  if (!m) return undefined;
  const den = Number(m[4]);
  const num = Number(m[3]);
  if (den === 0 || num >= den) return undefined;
  const v = Number(m[2]) + num / den;
  return { value: m[1] === '-' ? -v : v, format: den < 10 ? '# ?/?' : '# ??/??' };
}

interface TimeParse {
  value: number;
  seconds: boolean;
  ampm: boolean;
}

function parseTime(text: string, l: LocaleData): TimeParse | undefined {
  const dec = l.decimal === ',' ? '[,.]' : '\\.';
  const re = new RegExp(`^(\\d{1,4}):(\\d{1,2})(?::(\\d{1,2})(?:${dec}(\\d+))?)?\\s*([AaPp][Mm]?)?$`);
  const m = text.trim().match(re);
  let h: number;
  let mi: number;
  let s = 0;
  let frac = 0;
  let ap: string | undefined;
  if (m) {
    h = Number(m[1]);
    mi = Number(m[2]);
    s = m[3] !== undefined ? Number(m[3]) : 0;
    frac = m[4] !== undefined ? Number(`0.${m[4]}`) : 0;
    ap = m[5];
  } else {
    const m2 = text.trim().match(/^(\d{1,2})\s*([AaPp][Mm]?)$/);
    if (!m2) return undefined;
    h = Number(m2[1]);
    mi = 0;
    ap = m2[2];
  }
  if (mi > 59 || s > 59) return undefined;
  if (ap) {
    if (h < 1 || h > 12) return undefined;
    const pm = ap.toLowerCase().startsWith('p');
    h = (h % 12) + (pm ? 12 : 0);
  }
  return { value: (h * 3600 + mi * 60 + s + frac) / 86400, seconds: m?.[3] !== undefined, ampm: ap !== undefined };
}

interface DateParse {
  value: number;
  format: string;
}

function makeDate(y: number, mo: number, d: number, system: DateSystem): number | undefined {
  if (mo < 1 || mo > 12 || d < 1) return undefined;
  const leap1900 = y === 1900 && mo === 2 && d === 29 && system === 1900;
  if (d > daysInMonth(y, mo) && !leap1900) return undefined;
  const v = dateToSerial(y, mo, d, system);
  return v < 0 ? undefined : v;
}

function fullYear(txt: string): number {
  const n = Number(txt);
  if (txt.length <= 2) return n < 30 ? 2000 + n : 1900 + n;
  return n;
}

function parseDate(text: string, l: LocaleData, opt: InputOptions): DateParse | undefined {
  const t = text.trim();
  const system = opt.dateSystem ?? 1900;
  const year = opt.currentYear ?? new Date().getFullYear();
  // ISO aaaa-mm-jj
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const v = makeDate(Number(m[1]), Number(m[2]), Number(m[3]), system);
    return v === undefined ? undefined : { value: v, format: l.shortDate };
  }
  // Numerique : j/m/a (fr) ou m/j/a (en), separateurs / - .
  m = t.match(/^(\d{1,2})([/.-])(\d{1,2})(?:\2(\d{1,4}))?$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[3]);
    const [d, mo] = l.dateOrder === 'DMY' ? [a, b] : [b, a];
    if (m[4] === undefined && m[2] === '.') return undefined;
    const y = m[4] !== undefined ? fullYear(m[4]) : year;
    const v = makeDate(y, mo, d, system);
    if (v === undefined) return undefined;
    return { value: v, format: m[4] !== undefined ? l.shortDate : 'd-mmm' };
  }
  // Mois/annee numerique : 03/2024
  m = t.match(/^(\d{1,2})[/-](\d{4})$/);
  if (m) {
    const v = makeDate(Number(m[2]), Number(m[1]), 1, system);
    return v === undefined ? undefined : { value: v, format: 'mmm-yy' };
  }
  // Avec nom de mois : 15 mars 2024, 15-mars-24, mars 2024, Mar 15, 2024
  m = t.match(/^(\d{1,2})[\s-]+([A-Za-zÀ-ſ.]+)(?:[\s-]+(\d{2,4}))?$/);
  if (m) {
    const mo = monthFromName(m[2] ?? '', l);
    if (mo === 0) return undefined;
    const y = m[3] !== undefined ? fullYear(m[3]) : year;
    const v = makeDate(y, mo, Number(m[1]), system);
    if (v === undefined) return undefined;
    return { value: v, format: m[3] !== undefined ? 'd-mmm-yy' : 'd-mmm' };
  }
  m = t.match(/^([A-Za-zÀ-ſ.]+)[\s-]+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = monthFromName(m[1] ?? '', l);
    const v = mo === 0 ? undefined : makeDate(Number(m[3]), mo, Number(m[2]), system);
    return v === undefined ? undefined : { value: v, format: 'd-mmm-yy' };
  }
  m = t.match(/^([A-Za-zÀ-ſ.]+)[\s-]+(\d{2,4})$/);
  if (m) {
    const mo = monthFromName(m[1] ?? '', l);
    const yTxt = m[2] ?? '';
    if (mo === 0 || yTxt.length === 3) return undefined;
    const v = makeDate(fullYear(yTxt), mo, 1, system);
    return v === undefined ? undefined : { value: v, format: 'mmm-yy' };
  }
  return undefined;
}

function parseDateTime(text: string, l: LocaleData, opt: InputOptions): NumberParse | undefined {
  const d = parseDate(text, l, opt);
  if (d) return d;
  const tm = parseTime(text, l);
  if (tm) {
    const f = tm.ampm ? (tm.seconds ? 'h:mm:ss AM/PM' : 'h:mm AM/PM') : tm.seconds ? 'hh:mm:ss' : 'hh:mm';
    return { value: tm.value, format: tm.value >= 1 ? '[h]:mm:ss' : f };
  }
  const sp = text.trim().match(/^(.+?)\s+(\d{1,2}:\d{1,2}(?::\d{1,2}(?:[.,]\d+)?)?(?:\s*[AaPp][Mm]?)?)$/);
  if (sp) {
    const dd = parseDate(sp[1] ?? '', l, opt);
    const tt = parseTime(sp[2] ?? '', l);
    if (dd && tt && tt.value < 1) return { value: dd.value + tt.value, format: `${l.shortDate} hh:mm` };
  }
  return undefined;
}

/**
 * Convertit un texte en nombre comme le fait Excel pour les calculs (="1/1/2024"+0, CNUM...).
 * Renvoie undefined si le texte n'est pas numerique.
 */
export function parseNumberText(text: string, locale: NumberLocale = 'fr-FR', opt: InputOptions = {}): number | undefined {
  const l = localeData(locale);
  if (text.trim() === '') return undefined;
  const r = parsePlainNumber(text, l) ?? parseFractionInput(text) ?? parseDateTime(text, l, opt);
  return r?.value;
}

/** Comme parseNumberText mais renvoie aussi le format suggere (pourcentage, date...). */
export function parseNumberWithFormat(text: string, locale: NumberLocale = 'fr-FR', opt: InputOptions = {}): NumberParse | undefined {
  const l = localeData(locale);
  if (text.trim() === '') return undefined;
  return parsePlainNumber(text, l) ?? parseFractionInput(text) ?? parseDateTime(text, l, opt);
}

/** Interprete une saisie utilisateur dans une cellule. */
export function parseInput(text: string, locale: NumberLocale = 'fr-FR', opt: InputOptions = {}): ParsedInput {
  const l = localeData(locale);
  if (text === '') return { type: 'blank' };
  if (text.startsWith("'")) return { type: 'text', value: text.slice(1) };
  if (text.startsWith('=') && text.length > 1) return { type: 'formula', formula: text };
  const t = text.trim();
  const up = t.toUpperCase();
  if (up === l.trueName) return { type: 'boolean', value: true };
  if (up === l.falseName) return { type: 'boolean', value: false };
  if (t.startsWith('#')) {
    const syntax = l.id === 'fr-FR' ? FRENCH : CANONICAL;
    const hit = syntax.errorsIn.find(([e]) => e.toUpperCase() === up);
    if (hit) return { type: 'error', value: hit[1] };
  }
  const n = parseNumberWithFormat(text, locale, opt);
  if (n) return n.format === undefined ? { type: 'number', value: n.value } : { type: 'number', value: n.value, format: n.format };
  if (/^[+-][A-Za-z$(_]/.test(t)) return { type: 'formula', formula: `=${t}` };
  return { type: 'text', value: text };
}
