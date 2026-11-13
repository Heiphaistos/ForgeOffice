// Remplacement hors vue : tous les remplacements d'une requete sur un etat d'editeur (onglets non affiches).
import type { SearchQuery } from '@codemirror/search';
import type { EditorState } from '@codemirror/state';

export interface Replacement {
  from: number;
  to: number;
  insert: string;
}

/** Remplacement d'une regexp : $$ -> $, $& -> tout, $n -> groupe n (comme CodeMirror). */
export function expandReplacement(replace: string, match: readonly (string | undefined)[]): string {
  return replace.replace(/\$([$&\d]+)/g, (m, ref: string) => {
    if (ref === '$') return '$';
    if (ref === '&') return match[0] ?? '';
    const n = Number(ref);
    return n >= 1 && n < match.length ? (match[n] ?? '') : m;
  });
}

export function allReplacements(state: EditorState, query: SearchQuery): Replacement[] {
  if (!query.valid) return [];
  const out: Replacement[] = [];
  const cursor = query.getCursor(state);
  for (let r = cursor.next(); !r.done; r = cursor.next()) {
    const v = r.value as { from: number; to: number; match?: readonly (string | undefined)[] };
    if (v.to === v.from && !query.regexp) continue;
    out.push({ from: v.from, to: v.to, insert: query.regexp && v.match ? expandReplacement(query.replace, v.match) : query.replace });
  }
  return out;
}
