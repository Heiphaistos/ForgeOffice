// Rechercher / Remplacer (sans DOM) : casse, mot entier, expressions regulieres, codes Word ^t ^^.
import type { Node as PMNode } from 'prosemirror-model';
import type { Transaction } from 'prosemirror-state';

export interface FindOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  /** Ignorer les accents (« ete » trouve « été »). */
  ignoreAccents?: boolean;
}

export interface Match {
  from: number;
  to: number;
  text: string;
}

/** Caractere de substitution des elements en ligne non textuels (images, champs...). */
const OBJECT = '￼';

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Codes speciaux de Word dans une recherche simple. */
function wordCodes(s: string): string {
  const codes: Record<string, string> = { '^^': '^', '^t': '\t', '^s': ' ', '^-': '­', '^~': '‑' };
  return s.replace(/\^\^|\^t|\^s|\^-|\^~/g, (c) => codes[c] ?? c);
}

/** Retire les accents en gardant une lettre par lettre (é -> e). */
const fold = (s: string): string => [...s].map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '') || c).join('');

/** Expression de recherche, ou null si l'expression reguliere est invalide ou vide. */
export function buildRegex(query: string, opts: FindOptions = {}): RegExp | null {
  if (!query) return null;
  let source = opts.regex ? query : escape(wordCodes(opts.ignoreAccents ? fold(query) : query));
  if (opts.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
  try {
    return new RegExp(source, `g${opts.caseSensitive ? '' : 'i'}u`);
  } catch {
    return null; // expression invalide : l'interface affiche « expression incorrecte »
  }
}

/** Texte d'un bloc de texte avec un caractere par position ProseMirror. */
export function textOf(block: PMNode): string {
  let out = '';
  block.forEach((child) => {
    out += child.isText ? (child.text ?? '') : OBJECT;
  });
  return out;
}

/** Toutes les occurrences dans le document. Les correspondances vides (regex) sont ignorees. */
export function findMatches(doc: PMNode, query: string, opts: FindOptions = {}): Match[] {
  const re = buildRegex(query, opts);
  if (!re) return [];
  const out: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const raw = textOf(node);
    const text = opts.ignoreAccents ? fold(raw) : raw;
    if (text.length !== raw.length) return false;
    for (const m of text.matchAll(re)) {
      if (!m[0]) continue;
      const at = m.index;
      out.push({ from: pos + 1 + at, to: pos + 1 + at + m[0].length, text: raw.slice(at, at + m[0].length) });
    }
    return false;
  });
  return out;
}

/** Texte de remplacement d'une occurrence ($1, $& en mode expression reguliere ; ^t, ^& en mode simple). */
export function replacementFor(match: Match, query: string, replacement: string, opts: FindOptions = {}): string {
  if (!opts.regex) return wordCodes(replacement.replace(/\^&/g, () => match.text));
  const re = buildRegex(query, { ...opts, wholeWord: false });
  if (!re) return replacement;
  return match.text.replace(new RegExp(re.source, re.flags.replace('g', '')), replacement);
}

/** Remplace des occurrences (de la fin vers le debut pour garder les positions). Renvoie le nombre remplace. */
export function replaceMatches(tr: Transaction, matches: readonly Match[], query: string, replacement: string, opts: FindOptions = {}): number {
  const sorted = [...matches].sort((a, b) => b.from - a.from);
  for (const m of sorted) {
    const text = replacementFor(m, query, replacement, opts);
    if (text) tr.insertText(text, m.from, m.to);
    else tr.delete(m.from, m.to);
  }
  return sorted.length;
}

/** Occurrence suivante (ou precedente) a partir d'une position, en bouclant. */
export function nextMatch(matches: readonly Match[], from: number, backwards = false): number {
  if (!matches.length) return -1;
  if (backwards) {
    for (let i = matches.length - 1; i >= 0; i--) if (matches[i]!.to < from) return i;
    return matches.length - 1;
  }
  const i = matches.findIndex((m) => m.from >= from);
  return i < 0 ? 0 : i;
}
