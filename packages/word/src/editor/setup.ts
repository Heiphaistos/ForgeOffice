// Assemblage de l'editeur : greffons ProseMirror et raccourcis clavier Word.
import { tabPlugin } from './layout-deco.ts';
import { baseKeymap, chainCommands, deleteSelection, joinBackward, selectNodeBackward, splitBlockAs } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { columnResizing, goToNextCell, tableEditing, TableView } from 'prosemirror-tables';
import type { Node as PMNode } from 'prosemirror-model';
import type { Command, Plugin } from 'prosemirror-state';
import type { Schema } from 'prosemirror-model';
import type { ParagraphProps, WordDocument } from '@forgeoffice/docx';
import { applyStyle, changeCase, clearRunFormatting, indent, insertInline, insertPageBreak, mergeProps, setParagraph, setRunProp } from './commands.ts';
import { documentPlugin, paginationPlugin, searchPlugin, type StylePreview } from './plugins.ts';

/** Raccourcis traites par l'application (enregistrer, rechercher, lien...). */
export type ShortcutId =
  | 'save' | 'saveAs' | 'open' | 'new' | 'print' | 'find' | 'replace' | 'link' | 'goto' | 'footnote' | 'endnote' | 'comment'
  | 'copyFormat' | 'pasteFormat' | 'date' | 'time' | 'grow' | 'shrink' | 'spell' | 'bullets' | 'focusExit' | 'close' | 'fontDialog';

export interface SetupHooks {
  schema: Schema;
  getMeta: () => WordDocument;
  getActiveComment: () => number | null;
  getPreview: () => StylePreview | null;
  shortcut: (id: ShortcutId) => boolean;
  /** Derniere touche de suppression (pour le suivi des modifications). */
  onDeleteKey: (forward: boolean) => void;
}

const ui = (h: SetupHooks, id: ShortcutId): Command => () => h.shortcut(id);

/** Entree : le paragraphe suivant prend le « style suivant » (titre -> Normal) ; Entree sur une puce vide arrete la liste. */
function enter(h: SetupHooks): Command {
  return (state, dispatch, view) => {
    const { $from, empty } = state.selection;
    const para = $from.parent;
    const props = para.attrs.props as ParagraphProps;
    if (empty && para.type.name === 'paragraph' && para.content.size === 0 && props.numbering) {
      return setParagraph({ props: { numbering: undefined } })(state, dispatch, view);
    }
    const styleId = para.attrs.styleId as string | null;
    const next = styleId ? h.getMeta().styles.styles.find((s) => s.id === styleId)?.next : undefined;
    return splitBlockAs((node, atEnd) => {
      const attrs = { ...node.attrs, sectionBreak: null, paraId: null, markRevision: null };
      if (atEnd && next) return { type: node.type, attrs: { ...attrs, styleId: next === 'Normal' ? null : next, props: mergeProps(props, { numbering: undefined, pageBreakBefore: undefined }) } };
      return { type: node.type, attrs: { ...attrs, props: mergeProps(props, { pageBreakBefore: undefined }) } };
    })(state, dispatch, view);
  };
}

const toggle = (key: 'bold' | 'italic' | 'strike' | 'smallCaps' | 'caps' | 'hidden', h: SetupHooks): Command => (state, dispatch, view) => {
  const marks = state.storedMarks ?? state.selection.$from.marks();
  const mark = marks.find((m) => m.type.name === `rp_${key}`);
  const meta = h.getMeta();
  const style = (state.selection.$from.parent.attrs.styleId as string | null) ?? 'Normal';
  const styleRun = meta.styles.styles.find((s) => s.id === style)?.run;
  const current = mark ? Boolean(mark.attrs.v) : Boolean(styleRun?.[key]);
  return setRunProp(key, !current)(state, dispatch, view);
};

const underline = (kind: 'single' | 'double' | 'words'): Command => (state, dispatch, view) => {
  const mark = (state.storedMarks ?? state.selection.$from.marks()).find((m) => m.type.name === 'rp_underline');
  return setRunProp('underline', mark && mark.attrs.v === kind ? undefined : kind)(state, dispatch, view);
};

const valign = (v: 'superscript' | 'subscript'): Command => (state, dispatch, view) => {
  const mark = (state.storedMarks ?? state.selection.$from.marks()).find((m) => m.type.name === 'rp_vertAlign');
  return setRunProp('vertAlign', mark?.attrs.v === v ? undefined : v)(state, dispatch, view);
};

const lineSpacing = (value: number): Command => setParagraph({ props: { lineSpacing: { rule: 'auto', value } } });

/** Raccourcis Word (francais et anglais : Ctrl+G et Ctrl+B pour le gras). */
export function wordKeymap(h: SetupHooks): Plugin {
  const bold = toggle('bold', h);
  const bindings: Record<string, Command> = {
    'Mod-b': bold, 'Mod-g': bold, 'Mod-i': toggle('italic', h), 'Mod-u': underline('single'),
    'Mod-Shift-d': underline('double'), 'Mod-Shift-w': underline('words'), 'Mod-Shift-k': toggle('smallCaps', h),
    'Mod-Shift-a': toggle('caps', h), 'Mod-Shift-h': toggle('hidden', h), 'Mod-=': valign('subscript'), 'Mod-Shift-=': valign('superscript'),
    'Mod-Shift-+': valign('superscript'), 'Mod-+': valign('superscript'),
    'Mod-Alt-1': applyStyle('Heading1', 'paragraph'), 'Mod-Alt-2': applyStyle('Heading2', 'paragraph'), 'Mod-Alt-3': applyStyle('Heading3', 'paragraph'),
    'Mod-Shift-n': applyStyle('Normal', 'paragraph'), 'Mod-Shift-l': ui(h, 'bullets'),
    'Mod-l': setParagraph({ props: { alignment: 'left' } }), 'Mod-e': setParagraph({ props: { alignment: 'center' } }),
    'Mod-r': setParagraph({ props: { alignment: 'right' } }), 'Mod-j': setParagraph({ props: { alignment: 'justify' } }),
    'Mod-1': lineSpacing(1), 'Mod-2': lineSpacing(2), 'Mod-5': lineSpacing(1.5),
    'Mod-0': setParagraph({ props: (p) => mergeProps(p, { spacingBefore: p.spacingBefore ? undefined : 12 }) }),
    'Mod-m': indent(1), 'Mod-Shift-m': indent(-1),
    'Mod-t': setParagraph({ props: (p) => ({ ...p, indentLeft: (p.indentLeft ?? 0) + 35.4, indentFirstLine: -35.4 }) }),
    'Mod-Shift-t': setParagraph({ props: (p) => mergeProps(p, { indentLeft: undefined, indentFirstLine: undefined }) }),
    'Mod-q': setParagraph({ props: () => ({}) }), 'Mod-Space': clearRunFormatting,
    'Mod-Enter': insertPageBreak, 'Shift-Enter': insertInline({ type: 'break', kind: 'line' }),
    'Mod-Shift-Enter': insertInline({ type: 'break', kind: 'column' }),
    Enter: enter(h),
    'Shift-F3': changeCase('upper'),
    'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo, 'Alt-Backspace': undo,
    'Mod-s': ui(h, 'save'), F12: ui(h, 'saveAs'), 'Mod-o': ui(h, 'open'), 'Mod-n': ui(h, 'new'), 'Mod-p': ui(h, 'print'),
    'Mod-f': ui(h, 'find'), 'Mod-h': ui(h, 'replace'), 'Mod-k': ui(h, 'link'), F5: ui(h, 'goto'), 'Mod-Alt-f': ui(h, 'footnote'),
    'Mod-Alt-d': ui(h, 'endnote'), 'Mod-Alt-m': ui(h, 'comment'), 'Mod-Shift-c': ui(h, 'copyFormat'), 'Mod-Shift-v': ui(h, 'pasteFormat'),
    'Alt-Shift-d': ui(h, 'date'), 'Alt-Shift-t': ui(h, 'time'), 'Mod-]': ui(h, 'grow'), 'Mod-[': ui(h, 'shrink'),
    'Mod->': ui(h, 'grow'), 'Mod-<': ui(h, 'shrink'), 'Mod-Shift->': ui(h, 'grow'), 'Mod-Shift-<': ui(h, 'shrink'),
    F7: ui(h, 'spell'), Escape: ui(h, 'focusExit'), 'Mod-w': ui(h, 'close'), 'Mod-d': ui(h, 'fontDialog'),
    Tab: chainCommands(goToNextCell(1), (state, dispatch, view) => {
      const p = state.selection.$from.parent.attrs.props as ParagraphProps | undefined;
      if (p?.numbering) return indent(1)(state, dispatch, view);
      return false;
    }),
    'Shift-Tab': chainCommands(goToNextCell(-1), indent(-1)),
    Backspace: chainCommands((_s) => {
      h.onDeleteKey(false);
      return false;
    }, deleteSelection, joinBackward, selectNodeBackward),
    Delete: (_s) => {
      h.onDeleteKey(true);
      return false;
    },
  };
  return keymap(bindings);
}

/** Tabulation hors liste et tableau : insere un caractere de tabulation. */
const insertTab: Command = (state, dispatch) => {
  if (dispatch) dispatch(state.tr.insertText('\t').scrollIntoView());
  return true;
};

/** Vue de tableau redimensionnable qui garde le style de tableau Word (bordures de la feuille de styles). */
class WordTableView extends TableView {
  constructor(node: PMNode, cellMinWidth: number) {
    super(node, cellMinWidth);
    this.applyStyle(node);
  }

  override update(node: PMNode): boolean {
    const ok = super.update(node);
    if (ok) this.applyStyle(node);
    return ok;
  }

  private applyStyle(node: PMNode): void {
    const id = node.attrs.styleId as string | null;
    if (id) this.table.setAttribute('data-tstyle', id);
    else this.table.removeAttribute('data-tstyle');
  }
}

export function editorPlugins(h: SetupHooks): Plugin[] {
  return [
    history({ depth: 500, newGroupDelay: 600 }),
    wordKeymap(h),
    keymap({ Tab: insertTab }),
    keymap(baseKeymap),
    columnResizing({ cellMinWidth: 24, View: WordTableView }),
    tableEditing(),
    dropCursor({ color: '#185ABD', width: 2 }),
    gapCursor(),
    paginationPlugin(),
    tabPlugin(),
    searchPlugin(),
    documentPlugin(h.getMeta, h.getActiveComment, h.getPreview),
  ];
}
