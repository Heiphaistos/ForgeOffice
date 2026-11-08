// Recherche dans le texte des pages (sans DOM, teste) : texte simple (sans accents, casse au choix) ou expression reguliere,
// et remplacement dans le texte des annotations.
import type { Rect, TextBox } from './model.ts';

export interface SearchOptions {
  /** Le motif est une expression reguliere. */
  regex?: boolean;
  /** Respecter la casse (et les accents en texte simple). */
  matchCase?: boolean;
  /** Mot entier : la correspondance ne touche ni lettre ni chiffre de part et d'autre. */
  wholeWord?: boolean;
}

export interface SearchHit {
  page: number;
  /** Index de la boite de texte dans la page. */
  box: number;
  start: number;
  length: number;
  context: string;
}

const MAX_HITS = 500;
const MAX_PATTERN = 200;

/** Comparaison insensible a la casse et aux accents. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Expression reguliere utilisable (longueur bornee, syntaxe valide) ; null sinon. */
function compile(pattern: string, o: SearchOptions): RegExp | null {
  if (pattern === '' || pattern.length > MAX_PATTERN) return null;
  try {
    return new RegExp(o.regex ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.matchCase ? 'gu' : 'giu');
  } catch {
    return null; // motif invalide : aucune correspondance, signale par validPattern
  }
}

export const validPattern = (pattern: string, o: SearchOptions = {}): boolean => pattern.trim() === '' || compile(pattern, o) !== null;

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** Vrai si la correspondance est un mot entier (aucun caractere de mot juste avant ni juste apres). */
function isWhole(text: string, start: number, length: number): boolean {
  const before = text.slice(0, start).at(-1);
  const after = text[start + length];
  return !(before !== undefined && WORD_CHAR.test(before)) && !(after !== undefined && WORD_CHAR.test(after));
}

/** Positions (debut, longueur) des correspondances dans un texte. */
function matches(text: string, query: string, o: SearchOptions): { start: number; length: number }[] {
  const all = rawMatches(text, query, o);
  return o.wholeWord ? all.filter((m) => isWhole(text, m.start, m.length)) : all;
}

function rawMatches(text: string, query: string, o: SearchOptions): { start: number; length: number }[] {
  const out: { start: number; length: number }[] = [];
  if (!o.regex && !o.matchCase) {
    // Texte simple : insensible aux accents et a la casse.
    const q = fold(query.trim());
    if (!q) return out;
    const f = fold(text);
    for (let i = f.indexOf(q); i >= 0 && out.length < MAX_HITS; i = f.indexOf(q, i + q.length)) out.push({ start: i, length: q.length });
    return out;
  }
  const re = compile(o.regex ? query : query.trim(), o);
  if (!re) return out;
  for (const m of text.matchAll(re)) {
    if (m[0].length === 0) continue;
    out.push({ start: m.index, length: m[0].length });
    if (out.length >= MAX_HITS) break;
  }
  return out;
}

/** Recherche dans les boites de texte de chaque page (500 resultats au plus). Un mot coupe entre deux boites n'est pas trouve. */
export function search(pages: readonly (readonly TextBox[])[], query: string, o: SearchOptions = {}): SearchHit[] {
  const hits: SearchHit[] = [];
  pages.forEach((boxes, page) => {
    boxes.forEach((b, box) => {
      for (const m of matches(b.str, query, o)) {
        if (hits.length >= MAX_HITS) return;
        hits.push({ page, box, start: m.start, length: m.length, context: b.str.trim() });
      }
    });
  });
  return hits;
}

/** Rectangle approche d'un resultat : position des caracteres mesuree par `measure` (largeur d'un texte),
 *  sinon proportionnelle au nombre de caracteres. */
export function hitRect(b: TextBox, start: number, length: number, measure: (s: string) => number = (s) => s.length): Rect {
  const total = Math.max(1e-6, measure(b.str));
  const before = measure(b.str.slice(0, start)) / total;
  const width = measure(b.str.slice(start, start + length)) / total;
  return { x: b.rect.x + b.rect.w * before, y: b.rect.y, w: b.rect.w * width, h: b.rect.h };
}

/** Remplace toutes les correspondances ; en expression reguliere, $1.. designent les groupes. */
export function replaceIn(text: string, query: string, replacement: string, o: SearchOptions = {}): string {
  if (o.regex) {
    const re = compile(query, o);
    return re ? text.replace(re, replacement) : text;
  }
  let out = '';
  let last = 0;
  for (const m of matches(text, query, o)) {
    out += text.slice(last, m.start) + replacement;
    last = m.start + m.length;
  }
  return out + text.slice(last);
}
