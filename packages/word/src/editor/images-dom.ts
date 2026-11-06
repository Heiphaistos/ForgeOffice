// Deplacement d'une image flottante a la souris / au doigt : nouvel ancrage (paragraphe sous le pointeur) et alignement horizontal.
import { NodeSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { ImageInline } from '@forgeoffice/docx';
import { alignFromX, nudge, withAlign } from './images.ts';

/** Deplace l'image selectionnee vers le point ecran (clientX, clientY). Faux si la cible n'accepte pas de texte. */
export function moveFloatingImage(view: EditorView, pos: number, data: ImageInline, clientX: number, clientY: number): boolean {
  const hit = view.posAtCoords({ left: clientX, top: clientY });
  const node = view.state.doc.nodeAt(pos);
  if (!hit || !node) return false;
  const box = view.dom.getBoundingClientRect();
  const moved = withAlign(data, alignFromX(clientX, box.left, box.width));
  const tr = view.state.tr.delete(pos, pos + node.nodeSize);
  const target = tr.mapping.map(hit.pos);
  if (!tr.doc.resolve(target).parent.inlineContent) return false;
  tr.insert(target, node.type.create({ ...node.attrs, data: moved }));
  tr.setSelection(NodeSelection.create(tr.doc, target));
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** Image flottante selectionnee : fleches = 1 pt, Ctrl+fleches = 10 pt. Vrai si la touche est traitee. */
export function nudgeWithArrows(view: EditorView, e: KeyboardEvent): boolean {
  const sel = view.state.selection;
  const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[] | undefined>)[e.key];
  if (!d || !(sel instanceof NodeSelection) || sel.node.type.name !== 'atom') return false;
  const data = sel.node.attrs.data as ImageInline;
  if (data.type !== 'image' || !data.floating) return false;
  const step = e.ctrlKey || e.metaKey ? 10 : 1;
  view.dispatch(view.state.tr.setNodeMarkup(sel.from, undefined, { ...sel.node.attrs, data: nudge(data, d[0]! * step, d[1]! * step) }));
  return true;
}
