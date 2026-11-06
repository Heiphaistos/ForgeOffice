// Commandes d'edition (sans DOM) : mise en forme des caracteres et des paragraphes, insertions, casse, listes.
import { Fragment, type Mark, type MarkType, type Node as PMNode, type Schema } from 'prosemirror-model';
import { NodeSelection, TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import type { Inline, NumberFormat, ParagraphProps, RunProps } from '@forgeoffice/docx';
import { markName, type RunKey } from './schema.ts';

type Patch<T> = { [K in keyof T]?: T[K] | undefined };

/** Applique (ou retire si `value` est undefined) une propriete de caracteres a la selection. */
export function setRunProp<K extends RunKey>(key: K, value: RunProps[K] | undefined): Command {
  return (state, dispatch) => {
    const type = state.schema.marks[markName(key)];
    if (!type) return false;
    if (dispatch) dispatch(markTr(state, type, value === undefined ? null : type.create({ v: value })));
    return true;
  };
}

function markTr(state: EditorState, type: MarkType, mark: Mark | null): Transaction {
  return markInto(state.tr, state, type, mark).scrollIntoView();
}

function markInto(tr: Transaction, state: EditorState, type: MarkType, mark: Mark | null): Transaction {
  const { empty, ranges } = state.selection;
  if (empty) {
    tr.removeStoredMark(type);
    if (mark) tr.addStoredMark(mark);
    return tr;
  }
  for (const r of ranges) {
    if (mark) tr.addMark(r.$from.pos, r.$to.pos, mark);
    else tr.removeMark(r.$from.pos, r.$to.pos, type);
  }
  return tr;
}

/** Applique une marque quelconque (lien, style de caractere) ou la retire (mark = null). */
export function setMark(type: MarkType, mark: Mark | null): Command {
  return (state, dispatch) => {
    if (dispatch) dispatch(markTr(state, type, mark));
    return true;
  };
}

/** Retire toute la mise en forme des caracteres (Ctrl+Espace). */
export const clearRunFormatting: Command = (state, dispatch) => {
  if (!dispatch) return true;
  const tr = state.tr;
  const types = Object.values(state.schema.marks).filter((t) => t.name.startsWith('rp_') || t.name === 'cstyle');
  if (state.selection.empty) for (const t of types) tr.removeStoredMark(t);
  else for (const r of state.selection.ranges) for (const t of types) tr.removeMark(r.$from.pos, r.$to.pos, t);
  dispatch(tr);
  return true;
};

/** Paragraphes (et leur position) touches par la selection. */
export function selectedParagraphs(state: EditorState): { node: PMNode; pos: number }[] {
  const out: { node: PMNode; pos: number }[] = [];
  const { from, to } = state.selection;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'paragraph') {
      out.push({ node, pos });
      return false;
    }
    return true;
  });
  return out;
}

/** Fusionne des proprietes de paragraphe (undefined = retirer la propriete directe). */
export function mergeProps<T extends object>(base: T, patch: Patch<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out as T;
}

/** Modifie les paragraphes selectionnes : style et/ou proprietes directes. */
export function setParagraph(patch: { styleId?: string | null; props?: Patch<ParagraphProps> | ((p: ParagraphProps, node: PMNode) => ParagraphProps) }): Command {
  return (state, dispatch) => {
    const paras = selectedParagraphs(state);
    if (!paras.length) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const { node, pos } of paras) {
        const props = node.attrs.props as ParagraphProps;
        const next = typeof patch.props === 'function' ? patch.props(props, node) : patch.props ? mergeProps(props, patch.props) : props;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, props: next, ...(patch.styleId !== undefined ? { styleId: patch.styleId } : {}) });
      }
      dispatch(tr);
    }
    return true;
  };
}

/** Style de paragraphe ou de caractere (selon son type). */
export function applyStyle(id: string, type: 'paragraph' | 'character'): Command {
  return (state, dispatch) => {
    if (type === 'character') {
      const cs = state.schema.marks.cstyle!;
      return setMark(cs, id ? cs.create({ id }) : null)(state, dispatch);
    }
    // Comme Word : appliquer un style de titre retire la mise en forme directe des paragraphes.
    return setParagraph({ styleId: id === 'Normal' ? null : id, props: (p) => mergeProps(p, { outlineLevel: undefined }) })(state, dispatch);
  };
}

export type CaseMode = 'sentence' | 'lower' | 'upper' | 'title' | 'toggle';

/** Transformation de casse (francais : « Majuscule en début de phrase. »). */
export function transformCase(text: string, mode: CaseMode, atSentenceStart = true): string {
  switch (mode) {
    case 'lower': return text.toLocaleLowerCase('fr');
    case 'upper': return text.toLocaleUpperCase('fr');
    case 'title': return text.toLocaleLowerCase('fr').replace(/(^|[\s\-'’(«"])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toLocaleUpperCase('fr'));
    case 'toggle': return [...text].map((c) => (c === c.toLocaleUpperCase('fr') ? c.toLocaleLowerCase('fr') : c.toLocaleUpperCase('fr'))).join('');
    case 'sentence': {
      let start = atSentenceStart;
      return [...text.toLocaleLowerCase('fr')].map((c) => {
        if (start && /\p{L}/u.test(c)) {
          start = false;
          return c.toLocaleUpperCase('fr');
        }
        if (/[.!?]/.test(c)) start = true;
        return c;
      }).join('');
    }
  }
}

export function changeCase(mode: CaseMode): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    if (dispatch) {
      const tr = state.tr;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isText || !node.text) return;
        const a = Math.max(from, pos);
        const b = Math.min(to, pos + node.text.length);
        const before = state.doc.textBetween(Math.max(0, a - 3), a, ' ', ' ');
        const original = node.text.slice(a - pos, b - pos);
        const changed = transformCase(original, mode, a === pos && /(^|[.!?]\s*)$/.test(before));
        if (changed !== original) tr.replaceWith(a, b, state.schema.text(changed, node.marks));
      });
      dispatch(tr.setSelection(TextSelection.create(tr.doc, from, to)));
    }
    return true;
  };
}

/** Insere un element en ligne conserve (image, champ, note, signet, saut...). */
export function insertInline(data: Inline): Command {
  return (state, dispatch) => {
    const type = data.type === 'break' && data.kind === 'line' ? state.schema.nodes.hard_break! : state.schema.nodes.atom!;
    const node = type.create({ data }, null, state.storedMarks ?? state.selection.$from.marks());
    if (dispatch) dispatch(state.tr.replaceSelectionWith(node, false).scrollIntoView());
    return true;
  };
}

/** Saut de page (Ctrl+Entree) : comme Word, le saut termine le paragraphe et le texte continue sur la page suivante. */
export const insertPageBreak: Command = (state, dispatch) => {
  if (!dispatch) return true;
  const tr = state.tr.replaceSelectionWith(state.schema.nodes.atom!.create({ data: { type: 'break', kind: 'page' } }), false);
  const $pos = tr.selection.$from;
  if ($pos.parent.type.name === 'paragraph') tr.split($pos.pos);
  dispatch(tr.scrollIntoView());
  return true;
};

/** Paragraphes ProseMirror a partir de textes simples (avec un style). */
export function paragraphs(schema: Schema, items: readonly { text: string; styleId?: string; props?: ParagraphProps; run?: RunProps }[]): PMNode[] {
  return items.map((i) => schema.nodes.paragraph!.create(
    { styleId: i.styleId ?? null, props: i.props ?? {} },
    i.text ? schema.text(i.text, i.run ? Object.entries(i.run).map(([k, v]) => schema.marks[`rp_${k}`]!.create({ v })) : []) : null,
  ));
}

/** Insere des blocs a la place de la selection (ou apres le paragraphe courant). */
export function insertBlocks(nodes: readonly PMNode[], atStart = false): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const tr = state.tr;
      let at = 0;
      if (atStart) tr.insert(0, Fragment.from(nodes));
      else {
        const $from = state.selection.$from;
        const depth = $from.depth > 0 ? 1 : 0;
        const after = depth ? $from.after(depth) : state.doc.content.size;
        const empty = $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0 && depth === 1;
        at = empty ? $from.before(1) : after;
        if (empty) tr.replaceWith($from.before(1), $from.after(1), Fragment.from(nodes));
        else tr.insert(after, Fragment.from(nodes));
      }
      // Curseur au debut du contenu insere (premiere cellule d'un tableau, premiere ligne d'un bloc).
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(tr.doc.content.size, at + 1))));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** Tableau vide de r x c avec le style Grille du tableau. Largeurs egales sur `width` points. */
export function createTable(schema: Schema, rows: number, cols: number, width = 453.6): PMNode {
  const col = Math.round((width / cols) * 100) / 100;
  const cell = (): PMNode => schema.nodes.table_cell!.create({ props: {}, colwidth: [Math.round((col * 4) / 3)] }, schema.nodes.paragraph!.create());
  const row = (): PMNode => schema.nodes.table_row!.create({ props: {} }, Array.from({ length: cols }, cell));
  return schema.nodes.table!.create({ styleId: 'TableGrid', props: { width: { value: 0, type: 'auto' } }, grid: Array.from({ length: cols }, () => col) }, Array.from({ length: rows }, row));
}

/** Image selectionnee (NodeSelection sur un atome image). */
export function selectedImage(state: EditorState): { node: PMNode; pos: number } | null {
  const sel = state.selection;
  if (sel instanceof NodeSelection && sel.node.type.name === 'atom' && (sel.node.attrs.data as Inline).type === 'image') return { node: sel.node, pos: sel.from };
  return null;
}

/** Remplace les donnees de l'atome a `pos` (redimensionner une image, mettre a jour un champ). */
export function updateAtom(pos: number, data: Inline): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || (node.type.name !== 'atom' && node.type.name !== 'hard_break')) return false;
    if (dispatch) {
      // La selection doit viser le document APRES la modification (sinon RangeError : l'image ne se mettait jamais a jour).
      const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, data });
      dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)));
    }
    return true;
  };
}

/** Retrait (+/- 1,25 cm ou niveau de liste). */
export function indent(delta: 1 | -1, step = 35.4): Command {
  return setParagraph({
    props: (p) => {
      if (p.numbering && p.numbering.numId !== 0) {
        return { ...p, numbering: { ...p.numbering, level: Math.min(8, Math.max(0, p.numbering.level + delta)) } };
      }
      const left = Math.max(0, (p.indentLeft ?? 0) + delta * step);
      return mergeProps(p, { indentLeft: left || undefined });
    },
  });
}

/** Liste : numId a appliquer (0 = retirer). */
export function setList(numId: number): Command {
  return (state, dispatch) => {
    const paras = selectedParagraphs(state);
    if (!paras.length) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const { node, pos } of paras) {
        const p = node.attrs.props as ParagraphProps;
        const style = node.attrs.styleId as string | null;
        // Comme Word : une liste appliquee a un paragraphe Normal prend le style « Paragraphe de liste ».
        const styleId = numId && !style ? 'ListParagraph' : !numId && style === 'ListParagraph' ? null : style;
        const props = numId ? { ...p, numbering: { numId, level: p.numbering?.level ?? 0 } } : mergeProps(p, { numbering: undefined });
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, styleId, props });
      }
      dispatch(tr);
    }
    return true;
  };
}

export const BULLETS = ['•', '○', '▪', '➤', '✔', '–'] as const;

export type ListKind = { kind: 'bullet'; char: string } | { kind: 'number'; format: NumberFormat; suffix: string } | { kind: 'multilevel' };

/** Plusieurs proprietes de caracteres en une seule etape d'annulation (police + retrait de la police du theme...). */
export function setRunProps(patch: { [K in RunKey]?: RunProps[K] | undefined }): Command {
  return (state, dispatch) => {
    if (!dispatch) return true;
    const tr = state.tr;
    for (const [key, value] of Object.entries(patch) as [RunKey, unknown][]) {
      const type = state.schema.marks[markName(key)];
      if (type) markInto(tr, state, type, value === undefined ? null : type.create({ v: value }));
    }
    dispatch(tr.scrollIntoView());
    return true;
  };
}
