// Dictionnaire personnel et mots suspects (sans DOM) : ignorer tout, ajouter au dictionnaire, changer tout.
// Le navigateur ne dit pas quels mots sont fautifs : les suspects sont les mots rares proches d'un mot plus frequent du document.
import type { Node as PMNode } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';
import { setNoProof } from '../editor/lang.ts';
import { suggest, vocabulary } from './spelling.ts';

export interface Range { from: number; to: number }
export interface Suspect { word: string; ranges: Range[]; suggestions: string[] }

export const DICTIONARY_SETTING = 'word.dictionary';

const WORD = /[\p{L}\p{M}][\p{L}\p{M}'’-]*[\p{L}\p{M}]|[\p{L}\p{M}]/gu;
const lower = (s: string): string => s.toLocaleLowerCase('fr');

/** Occurrences d'un mot entier (casse ignoree) dans le document. */
export function wordRanges(doc: PMNode, word: string): Range[] {
  const target = lower(word);
  const out: Range[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    node.forEach((child) => { text += child.isText ? child.text ?? '' : '￼'; });
    for (const m of text.matchAll(WORD)) if (lower(m[0]) === target) out.push({ from: pos + 1 + m.index, to: pos + 1 + m.index + m[0].length });
    return false;
  });
  return out;
}

const hasNoProof = (doc: PMNode, r: Range): boolean => {
  let all = true;
  doc.nodesBetween(r.from, r.to, (n) => {
    if (n.isText && !n.marks.some((m) => m.type.name === 'rp_rest' && (m.attrs.props as { noProof?: boolean }).noProof)) all = false;
    return true;
  });
  return all;
};

/** Mots suspects, dans l'ordre du document ; `ignored` = dictionnaire personnel (minuscules). */
export function scanSuspects(doc: PMNode, ignored: ReadonlySet<string>, limit = 50): Suspect[] {
  const vocab = vocabulary(doc.textBetween(0, doc.content.size, ' ', ' '));
  const out: Suspect[] = [];
  const seen = new Set<string>();
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    node.forEach((child) => { text += child.isText ? child.text ?? '' : '￼'; });
    for (const m of text.matchAll(WORD)) {
      const key = lower(m[0]);
      if (m[0].length < 3 || seen.has(key) || ignored.has(key)) continue;
      const suggestions = suggest(m[0], vocab);
      if (!suggestions.length) continue;
      seen.add(key);
      const ranges = wordRanges(doc, m[0]).filter((r) => !hasNoProof(doc, r));
      if (ranges.length) out.push({ word: m[0], ranges, suggestions });
      if (out.length >= limit) return false;
    }
    return true;
  });
  return out;
}

/** Ignorer tout : noProof sur chaque occurrence du mot. */
export const ignoreAll = (word: string): Command => (state, dispatch) => {
  const ranges = wordRanges(state.doc, word);
  if (!ranges.length) return false;
  if (dispatch) {
    const tr = state.tr;
    for (const r of ranges) setNoProof(tr, r.from, r.to, true);
    dispatch(tr);
  }
  return true;
};

/** Changer tout : remplace chaque occurrence (de la fin vers le debut). */
export const changeAll = (word: string, replacement: string): Command => (state, dispatch) => {
  const ranges = wordRanges(state.doc, word);
  if (!ranges.length) return false;
  if (dispatch) {
    const tr = state.tr;
    for (const r of [...ranges].reverse()) tr.insertText(replacement, r.from, r.to);
    dispatch(tr);
  }
  return true;
};

export const personalWords = (stored: readonly string[]): Set<string> => new Set(stored.map(lower));

/** Ajoute un mot au dictionnaire personnel (liste sans doublon, triee). */
export function addToDictionary(stored: readonly string[], word: string): string[] {
  const w = lower(word.trim());
  return !w || stored.map(lower).includes(w) ? [...stored] : [...stored, w].sort((a, b) => a.localeCompare(b, 'fr'));
}
