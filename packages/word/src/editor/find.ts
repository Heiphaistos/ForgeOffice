// Rechercher / Remplacer (sans DOM) : casse, mot entier, expressions regulieres, codes Word ^t ^^.
import type { Node as PMNode } from 'prosemirror-model';
import type { Transaction } from 'prosemirror-state';
import { wildcardReplacement, wildcardToRegex } from './wildcards.ts';

export interface FindOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  /** Ignorer les accents (« ete » trouve « été »). */
  ignoreAccents?: boolean;
  /** « Format… » : ne garde que le texte portant cette mise en forme (recherche sans texte = tout le texte ainsi mis en forme). */
  format?: FindFormat;
  /** Caracteres generiques de Word (?, *, [a-z], <, >, @, {n,m}, groupes). */
  wildcards?: boolean;
  /** Rechercher dans la selection seulement. */
  range?: { from: number; to: number };
}

export type FindFormat = 'bold' | 'italic' | 'underline' | 'strike' | 'highlight';

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
  if (opts.wildcards && !opts.regex) {
    const w = wildcardToRegex(query);
    if (w === null) return null;
    source = w;
  }
  if (opts.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
  try {
    return new RegExp(source, `g${opts.caseSensitive || (opts.wildcards && !opts.regex) ? '' : 'i'}u`);
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
/** Vrai si tout le texte de la plage porte la mise en forme. */
function allFormatted(doc: PMNode, from: number, to: number, format: FindFormat): boolean {
  let any = false;
  let all = true;
  doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return true;
    any = true;
    const mark = node.marks.find((m) => m.type.name === `rp_${format}`);
    const v = mark?.attrs.v;
    if (!mark || v === false || v === 'none' || v === undefined) all = false;
    return true;
  });
  return any && all;
}

/** Segments de texte consecutifs portant la mise en forme (recherche par format seul). */
function formattedRuns(doc: PMNode, format: FindFormat): Match[] {
  const out: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let run: Match | null = null;
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      const on = child.isText && allFormatted(doc, start, start + child.nodeSize, format);
      if (on && run && run.to === start) {
        run.to = start + child.nodeSize;
        run.text += child.text ?? '';
      } else if (on) {
        run = { from: start, to: start + child.nodeSize, text: child.text ?? '' };
        out.push(run);
      } else run = null;
    });
    return false;
  });
  return out;
}

/**
 * Recherche avec marque de paragraphe (^p) : le texte des paragraphes voisins est mis bout a bout, separes par un saut de ligne.
 * Une correspondance qui couvre un saut s'etend de la fin du paragraphe a l'ouverture du suivant (la remplacer joint les paragraphes).
 */
function findAcrossParagraphs(doc: PMNode, query: string, opts: FindOptions): Match[] {
  const source = query.split('^p').map((part) => escape(wordCodes(opts.ignoreAccents ? fold(part) : part))).join('\n');
  let re: RegExp;
  try {
    re = new RegExp(opts.wholeWord ? `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])` : source, `g${opts.caseSensitive ? '' : 'i'}u`);
  } catch {
    return [];
  }
  let text = '';
  const spans: { from: number; to: number }[] = [];
  let prev: { end: number; start: number; parent: PMNode | null } | null = null;
  doc.descendants((node, pos, parent) => {
    if (!node.isTextblock) return true;
    const start = pos + 1;
    const raw = textOf(node);
    if (prev) {
      // Saut entre deux blocs de texte freres ; sinon un caractere qui ne correspond a rien.
      if (prev.parent === parent) { spans.push({ from: prev.end, to: start }); text += '\n'; } else { spans.push({ from: -1, to: -1 }); text += '\u0000'; }
    }
    for (let i = 0; i < raw.length; i++) spans.push({ from: start + i, to: start + i + 1 });
    text += opts.ignoreAccents ? fold(raw) : raw;
    prev = { end: start + raw.length, start, parent };
    return false;
  });
  if (text.length !== spans.length) return [];
  const out: Match[] = [];
  for (const m of text.matchAll(re)) {
    if (!m[0] || m[0].includes('\u0000')) continue;
    const first = spans[m.index]!;
    const last = spans[m.index + m[0].length - 1]!;
    out.push({ from: first.from, to: last.to, text: m[0] });
  }
  return out;
}

export function findMatches(doc: PMNode, query: string, opts: FindOptions = {}): Match[] {
  const all = findAll(doc, query, opts);
  const r = opts.range;
  return r ? all.filter((m) => m.from >= r.from && m.to <= r.to) : all;
}

function findAll(doc: PMNode, query: string, opts: FindOptions): Match[] {
  if (!query && opts.format) return formattedRuns(doc, opts.format);
  if (!opts.regex && query.includes('^p') && !opts.format) return findAcrossParagraphs(doc, query, opts);
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
      const from = pos + 1 + at;
      if (opts.format && !allFormatted(doc, from, from + m[0].length, opts.format)) continue;
      out.push({ from, to: from + m[0].length, text: raw.slice(at, at + m[0].length) });
    }
    return false;
  });
  return out;
}

/** Texte de remplacement d'une occurrence ($1, $& en mode expression reguliere ; ^t, ^& en mode simple). */
export function replacementFor(match: Match, query: string, replacement: string, opts: FindOptions = {}): string {
  if (!opts.regex && !opts.wildcards) return wordCodes(replacement.replace(/\^&/g, () => match.text));
  const re = buildRegex(query, { ...opts, wholeWord: false });
  if (!re) return replacement;
  return match.text.replace(new RegExp(re.source, re.flags.replace('g', '')), opts.wildcards && !opts.regex ? wildcardReplacement(replacement) : replacement);
}

/** Remplace des occurrences (de la fin vers le debut pour garder les positions). Renvoie le nombre remplace. */
export function replaceMatches(tr: Transaction, matches: readonly Match[], query: string, replacement: string, opts: FindOptions = {}): number {
  const sorted = [...matches].sort((a, b) => b.from - a.from);
  for (const m of sorted) {
    const text = replacementFor(m, query, replacement, opts);
    // ^p dans le remplacement : coupe le paragraphe a cet endroit.
    const parts = text.split('^p');
    if (parts.length === 1) {
      if (text) tr.insertText(text, m.from, m.to);
      else tr.delete(m.from, m.to);
      continue;
    }
    tr.delete(m.from, m.to);
    let at = m.from;
    parts.forEach((part, k) => {
      if (part) {
        tr.insertText(part, at);
        at += part.length;
      }
      if (k < parts.length - 1) {
        tr.split(at);
        at += 2;
      }
    });
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
