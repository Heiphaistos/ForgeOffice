// Correction orthographique (sans DOM) : mot sous le curseur, vocabulaire du document, suggestions par distance d'edition.
// Le navigateur ne donne pas ses suggestions a la page : celles-ci viennent des mots deja utilises dans le document.

export interface WordAt {
  word: string;
  from: number;
  to: number;
}

const LETTER = /[\p{L}\p{M}]/u;
const INNER = /['’-]/;

/** Mot (lettres, avec apostrophe ou trait d'union interne) qui contient `offset` ou le touche, ou null. */
export function wordAt(text: string, offset: number): WordAt | null {
  const isWordChar = (i: number): boolean => i >= 0 && i < text.length && (LETTER.test(text[i]!) || (INNER.test(text[i]!) && i > 0 && i < text.length - 1 && LETTER.test(text[i - 1]!) && LETTER.test(text[i + 1]!)));
  let from = Math.min(offset, text.length);
  if (!isWordChar(from) && isWordChar(from - 1)) from--;
  if (!isWordChar(from)) return null;
  let to = from;
  while (isWordChar(from - 1)) from--;
  while (isWordChar(to + 1)) to++;
  // Elision francaise (l', d', qu'...) : le mot est ce qui suit l'apostrophe.
  const elision = /^(?:[ldjmtsnc]|qu|jusqu|lorsqu|puisqu)['’]/i.exec(text.slice(from, to + 1));
  if (elision) {
    from += elision[0].length;
    if (offset < from) return null;
  }
  return { word: text.slice(from, to + 1), from, to: to + 1 };
}

/** Frequence de chaque mot (minuscules, 3 lettres au moins, sans chiffres). */
export function vocabulary(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of text.toLocaleLowerCase('fr').matchAll(/[\p{L}\p{M}][\p{L}\p{M}'’-]*[\p{L}\p{M}]/gu)) {
    out.set(m[0], (out.get(m[0]) ?? 0) + 1);
  }
  return out;
}

/** Distance de Damerau-Levenshtein bornee : renvoie max + 1 des que la distance depasse `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push(new Array<number>(b.length + 1).fill(0));
    rows[i]![0] = i;
  }
  for (let j = 0; j <= b.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2]![j - 2]! + 1);
      rows[i]![j] = d;
    }
  }
  return rows[a.length]![b.length]!;
}

function matchCase(source: string, candidate: string): string {
  if (source.length > 1 && source === source.toLocaleUpperCase('fr')) return candidate.toLocaleUpperCase('fr');
  if (source[0] === source[0]!.toLocaleUpperCase('fr') && source[0] !== source[0]!.toLocaleLowerCase('fr')) return candidate[0]!.toLocaleUpperCase('fr') + candidate.slice(1);
  return candidate;
}

/** Mots du document proches de `word` et plus utilises que lui (une faute de frappe est rarement repetee). */
export function suggest(word: string, vocab: ReadonlyMap<string, number>, limit = 5): string[] {
  const lower = word.toLocaleLowerCase('fr');
  const own = vocab.get(lower) ?? 0;
  const max = lower.length <= 4 ? 1 : 2;
  const found: { w: string; d: number; n: number }[] = [];
  for (const [w, n] of vocab) {
    if (w === lower || n <= own) continue;
    const d = editDistance(lower, w, max);
    if (d <= max) found.push({ w, d, n });
  }
  found.sort((x, y) => x.d - y.d || y.n - x.n || x.w.localeCompare(y.w, 'fr'));
  return found.slice(0, limit).map((f) => matchCase(word, f.w));
}

export interface LanguageChoice {
  tag: string;
  name: string;
}

/** Langues proposees pour un paragraphe (balise BCP 47 ecrite dans w:lang). */
export const LANGUAGES: readonly LanguageChoice[] = [
  { tag: 'fr-FR', name: 'Français (France)' },
  { tag: 'fr-BE', name: 'Français (Belgique)' },
  { tag: 'fr-CA', name: 'Français (Canada)' },
  { tag: 'en-GB', name: 'Anglais (Royaume-Uni)' },
  { tag: 'en-US', name: 'Anglais (États-Unis)' },
  { tag: 'de-DE', name: 'Allemand' },
  { tag: 'es-ES', name: 'Espagnol' },
  { tag: 'it-IT', name: 'Italien' },
  { tag: 'pt-PT', name: 'Portugais' },
  { tag: 'nl-NL', name: 'Néerlandais' },
];

export function languageName(tag: string | undefined): string {
  const t = tag ?? 'fr-FR';
  return LANGUAGES.find((l) => l.tag.toLowerCase() === t.toLowerCase())?.name ?? t;
}
