// Etat de la selection pour le ruban : proprietes effectives des caracteres et du paragraphe, contexte (tableau, image).
import type { EditorState } from 'prosemirror-state';
import { isInTable } from 'prosemirror-tables';
import { effectiveParagraphProps, effectiveRunProps, type ImageInline, type ParagraphProps, type RunProps, type WordDocument } from '@forgeoffice/docx';
import { propsFromMarks } from '../editor/convert.ts';
import { selectedImage } from '../editor/commands.ts';

export interface SelectionInfo {
  /** Proprietes effectives (style + direct). */
  run: RunProps;
  /** Proprietes directes seulement. */
  directRun: RunProps;
  charStyle: string | null;
  para: ParagraphProps;
  directPara: ParagraphProps;
  styleId: string;
  inTable: boolean;
  image: { pos: number; data: ImageInline } | null;
  empty: boolean;
  /** Texte selectionne (borne a 10 000 caracteres). */
  text: string;
  canUndo: boolean;
  canRedo: boolean;
}

export const EMPTY_SELECTION: SelectionInfo = {
  run: {}, directRun: {}, charStyle: null, para: {}, directPara: {}, styleId: 'Normal', inTable: false, image: null, empty: true, text: '', canUndo: false, canRedo: false,
};

export function selectionInfo(state: EditorState, meta: WordDocument, undoDepth: number, redoDepth: number): SelectionInfo {
  const { $from, from, to, empty } = state.selection;
  let marks = state.storedMarks ?? $from.marks();
  if (!empty) {
    let found = false;
    state.doc.nodesBetween(from, to, (n) => {
      if (found) return false;
      if (n.isText) {
        marks = n.marks;
        found = true;
      }
      return !found;
    });
  }
  const { props, styleId: cs } = propsFromMarks(marks);
  let paraNode = $from.parent;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === 'paragraph') {
      paraNode = $from.node(d);
      break;
    }
  }
  const pStyle = (paraNode.attrs.styleId as string | null) ?? undefined;
  const directPara = (paraNode.attrs.props as ParagraphProps | undefined) ?? {};
  const img = selectedImage(state);
  return {
    run: effectiveRunProps(meta, { styleId: pStyle }, { styleId: cs, props }),
    directRun: props,
    charStyle: cs ?? null,
    para: effectiveParagraphProps(meta, { styleId: pStyle, props: directPara }),
    directPara,
    styleId: pStyle ?? 'Normal',
    inTable: isInTable(state),
    image: img ? { pos: img.pos, data: img.node.attrs.data as ImageInline } : null,
    empty,
    text: empty ? '' : state.doc.textBetween(from, Math.min(to, from + 10_000), '\n', ' '),
    canUndo: undoDepth > 0,
    canRedo: redoDepth > 0,
  };
}
