// Proprietes d'un style relevees sur la selection (nouveau style, « Mettre a jour d'apres la selection »).
import type { Node as PMNode } from 'prosemirror-model';
import type { Command, EditorState } from 'prosemirror-state';
import type { Paragraph, RunProps } from '@forgeoffice/docx';
import { selectedParagraphs } from '../editor/commands.ts';

export function styleFromSelection(state: EditorState): { paragraph: Paragraph['props']; run: RunProps; basedOn: string | null } {
  const para = selectedParagraphs(state)[0]?.node;
  const run: Record<string, unknown> = {};
  for (const m of state.selection.$from.marks()) if (m.type.name.startsWith('rp_') && m.type.name !== 'rp_rest') run[m.type.name.slice(3)] = m.attrs.v;
  return { paragraph: { ...(para?.attrs.props as Paragraph['props'] | undefined) }, run: run as RunProps, basedOn: (para?.attrs.styleId as string | null | undefined) ?? null };
}

/** Les paragraphes et caracteres qui utilisaient un style supprime reviennent au style Normal. */
export const resetStyleUsers = (id: string): Command => (state, dispatch) => {
  const tr = state.tr;
  const cstyle = state.schema.marks.cstyle;
  state.doc.descendants((node: PMNode, pos) => {
    if (node.type.name === 'paragraph' && node.attrs.styleId === id) tr.setNodeMarkup(pos, undefined, { ...node.attrs, styleId: null });
    if (node.isText && cstyle && node.marks.some((m) => m.type === cstyle && m.attrs.id === id)) tr.removeMark(pos, pos + node.nodeSize, cstyle);
    return true;
  });
  if (!tr.docChanged) return false;
  if (dispatch) dispatch(tr);
  return true;
};
