// Alt+Maj+fleches : deplacer le paragraphe (haut/bas), hausser/abaisser le niveau de titre (gauche/droite).
import { TextSelection, type Command } from 'prosemirror-state';
import { applyStyle } from '../editor/commands.ts';

/** Niveau de titre (1 a 9) d'un identifiant de style `HeadingN`, 0 sinon. */
export function headingLevel(styleId: string | null): number {
  return Number(styleId?.match(/^Heading([1-9])$/)?.[1] ?? 0);
}

/** Style cible apres hausse (-1) ou abaissement (+1) : Titre 1 -> Normal en hausse ; un paragraphe sans titre ne change pas ; null = rien a faire. */
export function shiftedStyle(styleId: string | null, delta: 1 | -1): string | null {
  const n = headingLevel(styleId);
  if (n === 0) return null;
  const next = n + delta;
  if (next < 1) return 'Normal';
  return next > 9 ? null : `Heading${next}`;
}

export const shiftHeading = (delta: 1 | -1): Command => (state, dispatch, view) => {
  const target = shiftedStyle(state.selection.$from.parent.attrs.styleId as string | null, delta);
  return target ? applyStyle(target, 'paragraph')(state, dispatch, view) : false;
};

/** Echange le bloc courant avec son voisin (dans le meme parent). */
export const moveParagraph = (dir: -1 | 1): Command => (state, dispatch) => {
  const { $from } = state.selection;
  if ($from.depth < 1) return false;
  const depth = $from.depth;
  const parent = $from.node(depth - 1);
  const index = $from.index(depth - 1);
  const swapIndex = index + dir;
  if (swapIndex < 0 || swapIndex >= parent.childCount) return false;
  if (dispatch) {
    const start = $from.before(depth);
    const node = parent.child(index);
    const other = parent.child(swapIndex);
    const from = dir === -1 ? start - other.nodeSize : start;
    const to = dir === -1 ? start + node.nodeSize : start + node.nodeSize + other.nodeSize;
    const pos = dir === -1 ? start - other.nodeSize : start + other.nodeSize;
    const tr = state.tr.replaceWith(from, to, dir === -1 ? [node, other] : [other, node]);
    const caret = state.selection.from - start + pos;
    dispatch(tr.setSelection(TextSelection.create(tr.doc, caret)).scrollIntoView());
  }
  return true;
};
