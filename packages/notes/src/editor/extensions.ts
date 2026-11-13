// Extensions CodeMirror du Bloc-notes : compartiments reglables, raccourcis, textes francais, coloration par variables CSS.
import { history, historyKeymap, defaultKeymap, indentLess, indentMore } from '@codemirror/commands';
import {
  HighlightStyle, bracketMatching, foldGutter, foldKeymap, foldService, getIndentUnit, indentOnInput, indentUnit, syntaxHighlighting, type LanguageSupport,
} from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completeAnyWord, type CompletionSource } from '@codemirror/autocomplete';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorSelection, EditorState, Prec, type Extension, type StateEffect } from '@codemirror/state';
import {
  EditorView, crosshairCursor, drawSelection, dropCursor, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars,
  highlightTrailingWhitespace, highlightWhitespace, keymap, lineNumbers, rectangularSelection, type ViewUpdate,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import type { LinkTarget } from '../logic/links.ts';
import type { NotesPrefs } from '../logic/prefs.ts';
import { PHRASES, S } from '../strings.ts';
import type { Eol } from '../logic/encoding.ts';
import { tabInsertion, type IndentStyle } from '../logic/indent.ts';
import { createFindPanel, type FindHost } from './findpanel.ts';
import { changeHistory, eolMarks, indentGuides } from './visual.ts';
import { bookmarkExtension, linkExtension } from './marks.ts';

const language = new Compartment();
const wrap = new Compartment();
const gutterNumbers = new Compartment();
const gutterFold = new Compartment();
const whitespace = new Compartment();
const readOnly = new Compartment();
const spell = new Compartment();
const tabs = new Compartment();
const typing = new Compartment();
const visual = new Compartment();
const smart = new Compartment();

/** Mots deja presents dans le document, proposes a partir de 3 lettres (ou a la demande, Ctrl+Espace). Code seulement : voir `configOf`. */
/** La completion des mots ne sert qu'au code : pas de langage (texte brut) = pas de propositions. */
export const wantsCompletion = (p: NotesPrefs, language: LanguageSupport | null): boolean => p.autoComplete && language !== null;

export const wordsFromDocument: CompletionSource = (context) => {
  if (!context.explicit && !context.matchBefore(/[\p{L}\p{N}_]{3,}/u)) return null;
  return completeAnyWord(context);
};

/** Tab sans selection : une tabulation ou les espaces jusqu'au taquet suivant (selon le style d'indentation) ; avec selection : retrait. */
const insertIndent = (view: EditorView): boolean => {
  const { state } = view;
  if (state.readOnly) return false;
  if (state.selection.ranges.some((r) => !r.empty)) return indentMore(view);
  const unit = getIndentUnit(state);
  const style: IndentStyle = state.facet(indentUnit) === '\t' ? { size: state.tabSize, tabs: true } : { size: unit, tabs: false };
  view.dispatch(state.changeByRange((range) => {
    const line = state.doc.lineAt(range.head);
    const insert = tabInsertion(style, range.head - line.from);
    return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(range.from + insert.length) };
  }), { userEvent: 'input', scrollIntoView: true });
  return true;
};

const indentWidth = (s: string): number => (s.match(/^[ \t]*/)?.[0] ?? '').replace(/\t/g, '    ').length;

/** Repli par indentation pour le texte brut (les langages ont leur propre repli). */
const indentFold = foldService.of((state, from) => {
  const line = state.doc.lineAt(from);
  if (!line.text.trim()) return null;
  const base = indentWidth(line.text);
  let end = -1;
  for (let n = line.number + 1; n <= state.doc.lines; n++) {
    const next = state.doc.line(n);
    if (!next.text.trim()) continue;
    if (indentWidth(next.text) <= base) break;
    end = next.to;
  }
  return end > line.to ? { from: line.to, to: end } : null;
});

const highlight = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment, t.quote], color: 'var(--nt-c-comment)', fontStyle: 'italic' },
  { tag: [t.string, t.special(t.string), t.regexp, t.character, t.inserted, t.monospace], color: 'var(--nt-c-string)' },
  { tag: [t.number, t.bool, t.null, t.atom, t.unit], color: 'var(--nt-c-number)' },
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword, t.modifier, t.self, t.tagName], color: 'var(--nt-c-keyword)' },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName), t.standard(t.variableName)], color: 'var(--nt-c-type)' },
  { tag: [t.meta, t.processingInstruction, t.annotation, t.deleted, t.special(t.variableName)], color: 'var(--nt-c-meta)' },
  { tag: [t.operator, t.derefOperator, t.compareOperator, t.arithmeticOperator, t.logicOperator, t.bitwiseOperator], color: 'var(--nt-c-operator)' },
  { tag: [t.propertyName, t.attributeName, t.labelName, t.definition(t.propertyName)], color: 'var(--nt-c-attr)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName, t.definition(t.function(t.variableName))], color: 'var(--nt-c-func)' },
  { tag: [t.heading, t.heading3, t.heading4, t.heading5, t.heading6], color: 'var(--nt-c-keyword)', fontWeight: '700' },
  { tag: t.heading1, color: 'var(--nt-c-keyword)', fontWeight: '700', fontSize: '1.3em' },
  { tag: t.heading2, color: 'var(--nt-c-keyword)', fontWeight: '700', fontSize: '1.15em' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: 'var(--nt-accent)', textDecoration: 'underline' },
  { tag: t.invalid, color: 'var(--nt-c-meta)', textDecoration: 'underline wavy' },
]);

export interface EditorSettings {
  prefs: NotesPrefs;
  readOnly: boolean;
  language: LanguageSupport | null;
  eol: Eol;
  indent: IndentStyle;
}

function foldMarker(open: boolean): HTMLElement {
  const el = document.createElement('span');
  el.className = `cm-fold-marker${open ? ' is-open' : ''}`;
  el.title = open ? S.foldLine : S.unfoldLine;
  return el;
}

function configOf(s: EditorSettings): readonly [Compartment, Extension][] {
  const p = s.prefs;
  return [
    [language, s.language ?? indentFold],
    [wrap, p.wrap ? EditorView.lineWrapping : []],
    [gutterNumbers, p.lineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []],
    [gutterFold, p.foldGutter ? foldGutter({ markerDOM: foldMarker }) : []],
    [whitespace, p.whitespace ? [highlightWhitespace(), highlightTrailingWhitespace()] : []],
    [readOnly, EditorState.readOnly.of(s.readOnly)],
    [spell, EditorView.contentAttributes.of({ spellcheck: p.spell ? 'true' : 'false', lang: p.spellLang, autocorrect: 'off', autocapitalize: 'off' })],
    [visual, [p.guides ? indentGuides(p.tabSize) : [], p.eolMarks ? eolMarks(s.eol) : [], p.changeHistory ? changeHistory : []]],
    [smart, p.smart ? highlightSelectionMatches() : []],
    [tabs, [EditorState.tabSize.of(s.indent.size), indentUnit.of(s.indent.tabs ? '\t' : ' '.repeat(s.indent.size))]],
    // La fermeture automatique passe avant les raccourcis par défaut (Retour arrière supprime la paire).
    [typing, [p.autoClose ? [closeBrackets(), Prec.high(keymap.of(closeBracketsKeymap))] : [], wantsCompletion(p, s.language) ? autocompletion({ override: [wordsFromDocument], icons: false }) : []]],
  ];
}

export interface EditorHooks {
  onUpdate: (u: ViewUpdate) => void;
  onOpenLink: (link: LinkTarget) => void;
  onZoom: (delta: number) => void;
  /** Historique et « Tous les onglets » du panneau Rechercher (vue principale seulement). */
  find?: FindHost;
}

/** Extensions d'un etat d'editeur. `primary` = vue principale (historique d'annulation). */
export function editorExtensions(settings: EditorSettings, hooks: EditorHooks, primary: boolean): Extension[] {
  return [
    primary ? history() : [],
    drawSelection(),
    dropCursor(),
    highlightSpecialChars(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    search({ top: true, createPanel: (v) => createFindPanel(v, hooks.find ?? null) }),
    syntaxHighlighting(highlight),
    bookmarkExtension,
    linkExtension(hooks.onOpenLink),
    EditorState.phrases.of(PHRASES),
    // Ctrl+I met en italique (Markdown) : « Étendre la sélection » passe à Alt+Maj+→ dans le registre de commandes.
    keymap.of([{ key: 'Tab', run: insertIndent, shift: indentLess }, ...defaultKeymap.filter((k) => k.key !== 'Mod-i'), ...searchKeymap, ...(primary ? historyKeymap : []), ...foldKeymap]),
    EditorView.updateListener.of(hooks.onUpdate),
    EditorView.domEventHandlers({
      wheel(e) {
        if (!(e.ctrlKey || e.metaKey)) return false;
        e.preventDefault();
        hooks.onZoom(e.deltaY < 0 ? 10 : -10);
        return true;
      },
    }),
    ...configOf(settings).map(([c, ext]) => c.of(ext)),
  ];
}

/** Effets qui appliquent des reglages a un editeur deja cree. */
export function reconfigure(settings: EditorSettings): StateEffect<unknown>[] {
  return configOf(settings).map(([c, ext]) => c.reconfigure(ext));
}
