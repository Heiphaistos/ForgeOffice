// Operations sur les lignes et la casse (texte pur, sans editeur).

const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

export function sortLines(lines: readonly string[], descending = false): string[] {
  const out = [...lines].sort((a, b) => collator.compare(a, b));
  return descending ? out.reverse() : out;
}

/** Supprime les doublons en gardant la premiere occurrence. */
export function dedupeLines(lines: readonly string[]): string[] {
  return [...new Set(lines)];
}

/** Supprime les lignes vides ou, par défaut, ne contenant que des espaces. */
export function removeEmptyLines(lines: readonly string[], blankToo = true): string[] {
  return lines.filter((l) => (blankToo ? l.trim() !== '' : l !== ''));
}

/** Supprime les doublons seulement quand ils se suivent (le reste de l'ordre est préservé). */
export function dedupeAdjacent(lines: readonly string[]): string[] {
  return lines.filter((l, i) => i === 0 || l !== lines[i - 1]);
}

export const trimLeading = (lines: readonly string[]): string[] => lines.map((l) => l.replace(/^[ 	]+/, ''));
export const trimBoth = (lines: readonly string[]): string[] => lines.map((l) => l.trim());

const LEADING_NUMBER = /^\s*([-+]?\d+(?:[.,]\d+)?)/;

/** Tri numérique sur le nombre en début de ligne (virgule décimale admise) ; les lignes sans nombre passent à la fin, ordre conservé. */
export function sortNumeric(lines: readonly string[], descending = false): string[] {
  const keyed = lines.map((line, i) => ({ line, i, n: LEADING_NUMBER.exec(line)?.[1] }));
  const withNum = keyed.filter((k) => k.n !== undefined).map((k) => ({ ...k, v: Number((k.n as string).replace(',', '.')) }));
  withNum.sort((a, b) => (descending ? b.v - a.v : a.v - b.v) || a.i - b.i);
  return [...withNum.map((k) => k.line), ...keyed.filter((k) => k.n === undefined).map((k) => k.line)];
}

/** Tri par longueur de ligne (puis ordre alphabétique). */
export function sortByLength(lines: readonly string[], descending = false): string[] {
  return [...lines].sort((a, b) => (descending ? b.length - a.length : a.length - b.length) || collator.compare(a, b));
}

/** Mélange (Fisher-Yates) ; `random` est injectable pour les tests. */
export function shuffleLines(lines: readonly string[], random: () => number = Math.random): string[] {
  const out = [...lines];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as string, out[i] as string];
  }
  return out;
}

/** Préfixe chaque ligne de son numéro (« 1. texte »). */
export function numberLines(lines: readonly string[], start = 1): string[] {
  return lines.map((l, i) => `${start + i}. ${l}`);
}

export function reverseLines(lines: readonly string[]): string[] {
  return [...lines].reverse();
}

export function trimTrailing(lines: readonly string[]): string[] {
  return lines.map((l) => l.replace(/[ \t]+$/, ''));
}

/** Joint les lignes en une seule (espaces de bord retires, separees par une espace). */
export function joinLines(lines: readonly string[]): string[] {
  return [lines.map((l, i) => (i === 0 ? l.replace(/\s+$/, '') : l.trim())).filter((l, i) => i === 0 || l !== '').join(' ')];
}

/** Tabulations -> espaces en respectant les taquets. */
export function tabsToSpaces(lines: readonly string[], tabSize: number): string[] {
  return lines.map((line) => {
    let out = '';
    for (const ch of line) {
      if (ch === '\t') out += ' '.repeat(tabSize - (out.length % tabSize));
      else out += ch;
    }
    return out;
  });
}

/** Espaces d'indentation -> tabulations (seulement en debut de ligne, comme WinNote). */
export function spacesToTabs(lines: readonly string[], tabSize: number): string[] {
  return lines.map((line) => {
    const lead = /^[ \t]*/.exec(line)?.[0] ?? '';
    let width = 0;
    for (const ch of lead) width = ch === '\t' ? width + tabSize - (width % tabSize) : width + 1;
    return '\t'.repeat(Math.floor(width / tabSize)) + ' '.repeat(width % tabSize) + line.slice(lead.length);
  });
}

export type CaseMode = 'upper' | 'lower' | 'title' | 'sentence' | 'invert' | 'camel' | 'pascal' | 'snake' | 'kebab';

/** Mots d'un identifiant ou d'une phrase : coupe aux séparateurs et aux changements de casse (maPhraseXML -> ma, Phrase, XML). */
export function words(text: string): string[] {
  return text.match(/\p{Lu}+(?!\p{Ll})|\p{Lu}?\p{Ll}+|\p{N}+/gu) ?? [];
}

const capital = (w: string): string => w.charAt(0).toLocaleUpperCase('fr') + w.slice(1).toLocaleLowerCase('fr');

export function changeCase(text: string, mode: CaseMode): string {
  switch (mode) {
    case 'upper': return text.toLocaleUpperCase('fr');
    case 'lower': return text.toLocaleLowerCase('fr');
    case 'title': return text.toLocaleLowerCase('fr').replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toLocaleUpperCase('fr'));
    case 'sentence': return text.toLocaleLowerCase('fr').replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, sep: string, c: string) => sep + c.toLocaleUpperCase('fr'));
    case 'camel': return words(text).map((w, i) => (i === 0 ? w.toLocaleLowerCase('fr') : capital(w))).join('');
    case 'pascal': return words(text).map(capital).join('');
    case 'snake': return words(text).map((w) => w.toLocaleLowerCase('fr')).join('_');
    case 'kebab': return words(text).map((w) => w.toLocaleLowerCase('fr')).join('-');
    case 'invert': return [...text].map((c) => (c === c.toLocaleUpperCase('fr') ? c.toLocaleLowerCase('fr') : c.toLocaleUpperCase('fr'))).join('');
  }
}

/** Date et heure facon Bloc-notes Windows (F5) : « 14:05 04/11/2026 ». */
export function dateTimeStamp(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
