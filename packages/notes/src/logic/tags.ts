// Étiquettes #tag (comme WinNote notes.rs line_tags / tag_hits) : pas les titres « # titre », ni les blocs de code.

import type { NoteSource } from './links.ts';

/** Étiquettes d'une ligne : « # » après un blanc ou « ( », lettres/chiffres/_ - /, au moins une lettre. */
export function lineTags(line: string): string[] {
  const out: string[] = [];
  let prev = ' ';
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? '';
    if (c === '#' && (/\s/.test(prev) || prev === '(')) {
      const m = /^[\p{L}\p{N}_/-]*/u.exec(line.slice(i + 1));
      const tag = m?.[0] ?? '';
      if (/\p{L}/u.test(tag)) out.push(tag);
    }
    prev = c;
  }
  return out;
}

export interface TagHit {
  tag: string;
  sourceId: string;
  sourceName: string;
  /** Ligne (0 = première). */
  line: number;
  excerpt: string;
}

const TEXT_NAME = /\.(md|markdown|mdx|txt)$/i;

/** Toutes les étiquettes des notes texte, triées par étiquette puis source puis ligne. */
export function tagHits(sources: readonly NoteSource[]): TagHit[] {
  const out: TagHit[] = [];
  for (const src of sources) {
    if (/\.[^./\\]+$/.test(src.name) && !TEXT_NAME.test(src.name)) continue;
    let fence = false;
    src.text.split('\n').forEach((raw, line) => {
      if (raw.trimStart().startsWith('```')) fence = !fence;
      if (fence) return;
      for (const tag of lineTags(raw)) out.push({ tag, sourceId: src.id, sourceName: src.name, line, excerpt: raw.trim().slice(0, 70) });
    });
  }
  const key = (s: string): string => s.toLocaleLowerCase('fr');
  return out.sort((a, b) => key(a.tag).localeCompare(key(b.tag), 'fr') || a.sourceName.localeCompare(b.sourceName, 'fr') || a.line - b.line);
}
