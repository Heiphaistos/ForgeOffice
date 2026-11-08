// Sections de titres du volet Navigation : plage d'un titre, deplacer, hausser / abaisser.
import type { Command } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { Heading } from '../features/toc.ts';
import { headingLevel, shiftedStyle } from '../keymap/outline.ts';

/** Plage d'un titre : jusqu'au titre suivant de niveau egal ou superieur (ou la fin du document). */
export function sectionEnd(doc: PMNode, headings: readonly Heading[], index: number): number {
  const h = headings[index]!;
  const next = headings.slice(index + 1).find((x) => x.level <= h.level);
  return next ? next.pos : doc.content.size;
}

/** Deplace la section `from` juste avant le titre `to` (`to` = nombre de titres : a la fin). */
export const moveSection = (headings: readonly Heading[], from: number, to: number): Command => (state, dispatch) => {
  const h = headings[from];
  if (!h) return false;
  const start = h.pos;
  const end = sectionEnd(state.doc, headings, from);
  const target = to >= headings.length ? state.doc.content.size : headings[to]!.pos;
  if (target >= start && target <= end) return false;
  if (dispatch) {
    const slice = state.doc.slice(start, end);
    const tr = state.tr.delete(start, end);
    tr.insert(target > end ? target - (end - start) : target, slice.content);
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Deplace la section d'un rang vers le haut (-1) ou le bas (+1) parmi ses voisines de meme niveau. */
export function moveStep(doc: PMNode, headings: readonly Heading[], index: number, dir: -1 | 1): Command {
  const h = headings[index];
  if (!h) return () => false;
  if (dir === -1) {
    for (let j = index - 1; j >= 0; j--) {
      const x = headings[j]!;
      if (x.level < h.level) break;
      if (x.level === h.level) return moveSection(headings, index, j);
    }
    return () => false;
  }
  const nextIdx = headings.findIndex((x) => x.pos === sectionEnd(doc, headings, index));
  const next = headings[nextIdx];
  if (!next || next.level !== h.level) return () => false;
  const after = headings.findIndex((x) => x.pos === sectionEnd(doc, headings, nextIdx));
  return moveSection(headings, index, after < 0 ? headings.length : after);
}

/** Hausse (-1) ou abaisse (+1) un titre et ses sous-titres (styles Titre N). */
export const shiftSection = (headings: readonly Heading[], index: number, delta: 1 | -1): Command => (state, dispatch) => {
  const h = headings[index];
  if (!h) return false;
  const end = sectionEnd(state.doc, headings, index);
  const tr = state.tr;
  let changed = false;
  state.doc.nodesBetween(h.pos, end, (node, pos) => {
    if (node.type.name !== 'paragraph' || pos < h.pos || pos >= end) return true;
    const id = node.attrs.styleId as string | null;
    if (headingLevel(id) === 0) return false;
    const target = shiftedStyle(id, delta);
    if (target) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, styleId: target === 'Normal' ? null : target });
      changed = true;
    }
    return false;
  });
  if (!changed) return false;
  if (dispatch) dispatch(tr);
  return true;
};
