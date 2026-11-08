// Caviardage assisté (sans DOM, testé) : zones à marquer à partir d'une recherche ou de motifs courants (e-mail, téléphone, IBAN,
// carte bancaire, numéro de sécurité sociale, date). Les nombres de carte et d'IBAN sont validés (Luhn, modulo 97) pour limiter les faux positifs.
import { hitRect, search, type SearchOptions } from './find.ts';
import type { Rect, TextBox } from './model.ts';

export type RedactPattern = 'email' | 'phone' | 'iban' | 'card' | 'ssn' | 'date';
export const REDACT_PATTERNS: readonly RedactPattern[] = ['email', 'phone', 'iban', 'card', 'ssn', 'date'];

const RAW: Readonly<Record<RedactPattern, string>> = {
  email: String.raw`[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+`,
  phone: String.raw`(?:\+|00)\d{1,3}(?:[ .-]?\(0\))?(?:[ .-]?\d{1,4}){2,5}|0[1-9](?:[ .-]?\d{2}){4}`,
  iban: String.raw`[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?`,
  card: String.raw`\d(?:[ -]?\d){12,18}`,
  ssn: String.raw`[12] ?\d{2} ?(?:0[1-9]|1[0-2]|[2-9]\d) ?\d{2} ?\d{3} ?\d{3}(?: ?\d{2})?`,
  date: String.raw`\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2})`,
};

/** Chaque motif est isolé : jamais collé à une lettre ou un chiffre (évite de couper un IBAN en « téléphone »). */
const SOURCES = Object.fromEntries(REDACT_PATTERNS.map((p) => [p, String.raw`(?<![\p{L}\p{N}])(?:${RAW[p]})(?![\p{L}\p{N}])`])) as Readonly<Record<RedactPattern, string>>;

/** Somme de Luhn (cartes bancaires). */
export function luhn(digits: string): boolean {
  const d = digits.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** Contrôle IBAN (modulo 97 sur la forme réarrangée). */
export function ibanValid(iban: string): boolean {
  const s = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const c of v) rem = (rem * 10 + Number(c)) % 97;
  }
  return rem === 1;
}

const PRIORITY: readonly RedactPattern[] = ['email', 'iban', 'ssn', 'phone', 'date', 'card'];
const VALIDATORS: Partial<Record<RedactPattern, (text: string) => boolean>> = { card: luhn, iban: ibanValid };

export interface RedactZone {
  page: number;
  rect: Rect;
  text: string;
  /** Motif d'origine, null pour une recherche libre. */
  pattern: RedactPattern | null;
}

/** Zones correspondant à la recherche libre (vide = ignorée) et aux motifs choisis ; une zone par résultat, sans doublon exact. */
export function findRedactZones(
  pages: readonly (readonly TextBox[])[], query: string, options: SearchOptions, patterns: readonly RedactPattern[], measure?: (s: string) => number,
): RedactZone[] {
  const zones: RedactZone[] = [];
  const seen = new Set<string>();
  const collect = (hits: ReturnType<typeof search>, pattern: RedactPattern | null): void => {
    for (const h of hits) {
      const box = pages[h.page]?.[h.box];
      if (!box) continue;
      const text = box.str.slice(h.start, h.start + h.length);
      if (pattern && VALIDATORS[pattern]?.(text) === false) continue;
      const rect = hitRect(box, h.start, h.length, measure);
      const key = `${h.page}:${rect.x.toFixed(4)}:${rect.y.toFixed(4)}:${rect.w.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      zones.push({ page: h.page, rect, text, pattern });
    }
  };
  if (query.trim() !== '') collect(search(pages, query, options), null);
  // Les motifs précis passent avant « carte » (13 à 19 chiffres), qui reconnaîtrait sinon un numéro de sécurité sociale.
  for (const p of PRIORITY.filter((x) => patterns.includes(x))) collect(search(pages, SOURCES[p], { regex: true, matchCase: true }), p);
  return zones;
}
