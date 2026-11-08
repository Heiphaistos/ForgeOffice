// Conversion des notes : toutes les notes de bas de page en notes de fin (et inversement), appels et contenus compris.
import type { Node as PMNode } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';
import type { Inline, Note, NoteMark, WordDocument } from '@forgeoffice/docx';

export type NoteKind = 'footnote' | 'endnote';

const refType = (k: NoteKind): 'footnoteRef' | 'endnoteRef' => (k === 'footnote' ? 'footnoteRef' : 'endnoteRef');

/** Notes deplacees d'une liste a l'autre avec de nouveaux identifiants ; `idMap` : ancien id -> nouvel id. */
export function moveNotes(meta: WordDocument, from: NoteKind): { meta: WordDocument; idMap: Map<number, number> } {
  const source = from === 'footnote' ? meta.footnotes : meta.endnotes;
  const target = from === 'footnote' ? meta.endnotes : meta.footnotes;
  const to: NoteKind = from === 'footnote' ? 'endnote' : 'footnote';
  const idMap = new Map<number, number>();
  let next = target.reduce((m, n) => Math.max(m, n.id), 0) + 1;
  const moved: Note[] = [];
  const kept: Note[] = [];
  for (const note of source) {
    if (note.special) {
      kept.push(note);
      continue;
    }
    idMap.set(note.id, next);
    moved.push({ ...note, id: next++, blocks: note.blocks.map((b) => (b.type === 'paragraph' ? { ...b, inlines: b.inlines.map((i): Inline => (i.type === 'noteMark' ? ({ ...i, kind: to } satisfies NoteMark) : i)) } : b)) });
  }
  const merged = [...target, ...moved];
  return { idMap, meta: { ...meta, footnotes: from === 'footnote' ? kept : merged, endnotes: from === 'footnote' ? merged : kept } };
}

/** Remplace les appels de note du document (footnoteRef <-> endnoteRef) selon la table d'identifiants. */
export const convertRefs = (from: NoteKind, idMap: ReadonlyMap<number, number>): Command => (state, dispatch) => {
  const tr = state.tr;
  const to: NoteKind = from === 'footnote' ? 'endnote' : 'footnote';
  state.doc.descendants((node: PMNode, pos) => {
    if (node.type.name !== 'atom') return true;
    const d = node.attrs.data as Inline;
    if (d.type === refType(from) && idMap.has(d.noteId)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, data: { ...d, type: refType(to), noteId: idMap.get(d.noteId)! } });
    return true;
  });
  if (!tr.docChanged) return false;
  if (dispatch) dispatch(tr);
  return true;
};
