// Langue et verification orthographique par paragraphe ou par mot : proprietes de caracteres lang / noProof (comme Word).
import type { Command, Transaction } from 'prosemirror-state';
import type { MarkType } from 'prosemirror-model';
import type { RunProps } from '@forgeoffice/docx';

/** Pose ou retire noProof (« ne pas verifier l'orthographe ») sur une plage, en conservant les autres proprietes rares des caracteres. */
export function setNoProof(tr: Transaction, from: number, to: number, on: boolean): void {
  const type: MarkType | undefined = tr.doc.type.schema.marks.rp_rest;
  if (!type) return;
  const doc = tr.doc;
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return true;
    const a = Math.max(from, pos);
    const b = Math.min(to, pos + node.nodeSize);
    const cur = node.marks.find((m) => m.type === type);
    const props: Partial<RunProps> = { ...(cur?.attrs.props as Partial<RunProps> | undefined) };
    if (on) props.noProof = true;
    else delete props.noProof;
    tr.removeMark(a, b, type);
    if (Object.keys(props).length) tr.addMark(a, b, type.create({ props }));
    return false;
  });
}

/** Mot ignore par le correcteur (noProof sur le mot). */
export function ignoreWord(from: number, to: number): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const tr = state.tr;
      setNoProof(tr, from, to, true);
      dispatch(tr);
    }
    return true;
  };
}

/** Langue des paragraphes touches par la selection : une balise (fr-FR...), ou null = ne pas verifier ; undefined = langue du document. */
export function setParagraphLanguage(tag: string | null | undefined): Command {
  return (state, dispatch) => {
    const lang = state.schema.marks.rp_lang;
    if (!lang) return false;
    const tr = state.tr;
    state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
      if (node.type.name !== 'paragraph') return true;
      const from = pos + 1;
      const to = pos + node.nodeSize - 1;
      if (to > from) {
        if (tag) tr.addMark(from, to, lang.create({ v: tag }));
        else tr.removeMark(from, to, lang);
        setNoProof(tr, from, to, tag === null);
      }
      return false;
    });
    if (dispatch) dispatch(tr);
    return true;
  };
}

/** Langue du paragraphe qui contient le curseur (balise du premier caractere), undefined = langue du document. */
export function paragraphLanguage(state: Parameters<Command>[0]): string | null | undefined {
  const { $from } = state.selection;
  const para = $from.parent;
  if (para.type.name !== 'paragraph' || !para.childCount) return undefined;
  const first = para.firstChild;
  const props = first?.marks.find((m) => m.type.name === 'rp_rest')?.attrs.props as Partial<RunProps> | undefined;
  if (props?.noProof) return null;
  const lang = first?.marks.find((m) => m.type.name === 'rp_lang')?.attrs.v as string | undefined;
  return lang;
}
