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

export type CaseMode = 'upper' | 'lower' | 'title' | 'sentence' | 'invert';

export function changeCase(text: string, mode: CaseMode): string {
  switch (mode) {
    case 'upper': return text.toLocaleUpperCase('fr');
    case 'lower': return text.toLocaleLowerCase('fr');
    case 'title': return text.toLocaleLowerCase('fr').replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toLocaleUpperCase('fr'));
    case 'sentence': return text.toLocaleLowerCase('fr').replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, sep: string, c: string) => sep + c.toLocaleUpperCase('fr'));
    case 'invert': return [...text].map((c) => (c === c.toLocaleUpperCase('fr') ? c.toLocaleLowerCase('fr') : c.toLocaleUpperCase('fr'))).join('');
  }
}

/** Date et heure facon Bloc-notes Windows (F5) : « 14:05 04/11/2026 ». */
export function dateTimeStamp(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
