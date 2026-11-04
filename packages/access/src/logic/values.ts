// Saisie et affichage des valeurs de la feuille de donnees (sans DOM, teste) : analyse a la francaise, controles du type.
import { S } from '../strings.ts';
import type { Json, TypeChamp } from '../types.ts';

export interface FieldRule {
  nom: string;
  type: TypeChamp | null;
  requis?: boolean;
  taille?: number | null;
  liste_valeurs?: string[];
  limiter_a_liste?: boolean;
}

export type Parsed = { ok: true; value: Json } | { ok: false; error: string };

const INT_RANGES: Partial<Record<TypeChamp, [number, number]>> = {
  octet: [0, 255],
  entier: [-32768, 32767],
  entier_long: [-2147483648, 2147483647],
  grand_entier: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
};
const NUMERIC: readonly TypeChamp[] = ['octet', 'entier', 'entier_long', 'grand_entier', 'reel_simple', 'reel_double', 'decimal', 'monetaire'];
const LOCKED: readonly TypeChamp[] = ['numero_auto', 'calcule', 'piece_jointe', 'objet_ole'];

export function isNumericType(t: TypeChamp | null): boolean {
  return t !== null && NUMERIC.includes(t);
}

export function isEditableType(t: TypeChamp | null): boolean {
  return t === null || !LOCKED.includes(t);
}

/** « 1 234,56 », « 12.5 », « -3 € » -> nombre ; null si illisible. */
export function parseNumber(text: string): number | null {
  const t = text.replace(/[\s  €$%]/g, '');
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)([eE][-+]?\d+)?$/.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function validDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const FR_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/** « 31/12/2026 [14:30[:05]] » ou ISO -> « 2026-12-31[T14:30:05] » ; null si invalide. */
export function parseDate(text: string): string | null {
  const t = text.trim();
  const fr = t.match(FR_DATE);
  const iso = t.match(ISO_DATE);
  let y: number, m: number, d: number;
  let time: (string | undefined)[];
  if (fr) {
    d = Number(fr[1]);
    m = Number(fr[2]);
    y = Number(fr[3]);
    if (y < 100) y += y < 30 ? 2000 : 1900;
    time = [fr[4], fr[5], fr[6]];
  } else if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
    time = [iso[4], iso[5], iso[6]];
  } else return null;
  if (!validDate(y, m, d)) return null;
  const date = `${y}-${pad(m)}-${pad(d)}`;
  if (time[0] === undefined) return date;
  const h = Number(time[0]);
  const mi = Number(time[1]);
  const s = Number(time[2] ?? 0);
  if (h > 23 || mi > 59 || s > 59) return null;
  return `${date}T${pad(h)}:${pad(mi)}:${pad(s)}`;
}

export function parseBoolean(text: string): boolean | null {
  const t = text.trim().toLowerCase();
  if (['oui', 'vrai', 'true', '1', 'o', 'x', '-1'].includes(t)) return true;
  if (['non', 'faux', 'false', '0', 'n'].includes(t)) return false;
  return null;
}

/** Lien sur : http, https, mailto, ou adresse sans schema (jamais javascript:, data:...). */
export function safeLink(text: string): boolean {
  const scheme = text.trim().match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  return scheme === undefined || scheme === 'http' || scheme === 'https' || scheme === 'mailto';
}

/** Convertit une saisie en valeur pour le moteur, avec les controles d'Access. */
export function parseInput(text: string, rule: FieldRule): Parsed {
  const t = rule.type;
  const f = rule.nom;
  if (!isEditableType(t)) return { ok: false, error: S.err.notEditable(f) };
  if (text.trim() === '') return rule.requis ? { ok: false, error: S.err.required(f) } : { ok: true, value: null };
  if (rule.limiter_a_liste && rule.liste_valeurs && rule.liste_valeurs.length > 0 && !rule.liste_valeurs.includes(text)) {
    return { ok: false, error: S.err.notInList(f) };
  }
  if (t !== null && NUMERIC.includes(t)) {
    const n = parseNumber(text);
    if (n === null) return { ok: false, error: S.err.notNumber(f) };
    const range = INT_RANGES[t];
    if (range) {
      if (!Number.isInteger(n)) return { ok: false, error: S.err.notInteger(f) };
      if (n < range[0] || n > range[1]) return { ok: false, error: S.err.outOfRange(f, range[0], range[1]) };
    }
    return { ok: true, value: t === 'monetaire' ? Math.round(n * 10000) / 10000 : n };
  }
  switch (t) {
    case 'date_heure': {
      const d = parseDate(text);
      return d === null ? { ok: false, error: S.err.notDate(f) } : { ok: true, value: d };
    }
    case 'oui_non': {
      const b = parseBoolean(text);
      return b === null ? { ok: false, error: S.err.notBool(f) } : { ok: true, value: b };
    }
    case 'lien_hypertexte':
      return safeLink(text) ? { ok: true, value: text.trim() } : { ok: false, error: S.err.notLink(f) };
    case 'texte_court': {
      const max = Math.min(255, Math.max(1, rule.taille ?? 255));
      return [...text].length > max ? { ok: false, error: S.err.tooLong(f, max) } : { ok: true, value: text };
    }
    default:
      return { ok: true, value: text };
  }
}

const ISO_VALUE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/** Nombre a la francaise ; `money` ajoute le symbole euro et 2 decimales. */
export function frenchNumber(n: number, money = false): string {
  return money
    ? n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
    : n.toLocaleString('fr-FR', { maximumFractionDigits: 10 });
}

/** Texte affiche dans une cellule (dates JJ/MM/AAAA, decimales a la virgule, euros). */
export function displayValue(value: Json, type: TypeChamp | null): string {
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? S.td.yes : S.td.no;
  if (typeof value === 'number') return frenchNumber(value, type === 'monetaire');
  if (typeof value === 'string') {
    const m = value.match(ISO_VALUE);
    if (!m) return value;
    const date = `${m[3]}/${m[2]}/${m[1]}`;
    if (!m[4] || (m[4] === '00' && m[5] === '00' && (m[6] ?? '00') === '00')) return date;
    return `${date} ${m[4]}:${m[5]}${m[6] && m[6] !== '00' ? `:${m[6]}` : ''}`;
  }
  if (Array.isArray(value)) return value.map((v) => displayValue(v, null)).join(', ');
  if (value.type === 'blob') return `(${String(value.taille ?? 0)} octets)`;
  return JSON.stringify(value);
}

/** Texte propose a l'edition (sans symbole monetaire ni separateur de milliers). */
export function editText(value: Json, type: TypeChamp | null): string {
  if (typeof value === 'number') return String(value).replace('.', ',');
  return displayValue(value, type);
}

/** Nom d'objet ou de champ selon les regles d'Access ; null si valide, sinon le message. */
export function validateName(name: string): string | null {
  if (name.trim() === '') return S.err.nameEmpty;
  if ([...name].length > 64) return S.err.nameTooLong;
  if (/^\s/.test(name)) return S.err.nameSpace;
  if (/[\u0000-\u001f]/.test(name)) return S.err.nameControl;
  if (/[.!`[\]]/.test(name)) return S.err.nameChars;
  return null;
}

/** Nom libre « Table1 », « Table2 »... absent de `taken`. */
export function uniqueName(base: string, taken: readonly string[]): string {
  const lower = new Set(taken.map((t) => t.toLowerCase()));
  const stem = base.replace(/\d+$/, '');
  for (let i = 1; ; i++) {
    const candidate = `${stem}${i}`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
}
