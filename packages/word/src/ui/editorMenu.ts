// Menus contextuels de l'editeur, construits selon l'endroit du clic (texte, lien, image, tableau, liste, champ, revision, commentaire, note, en-tete).
import { TextSelection } from 'prosemirror-state';
import { addColumnAfter, addColumnBefore, addRowAfter, addRowBefore, deleteColumn, deleteRow, deleteTable, mergeCells, splitCell } from 'prosemirror-tables';
import type { MenuItem } from '@forgeoffice/ui';
import { groupsToMenu } from '@forgeoffice/ui/logic/commands';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';
import { ignoreWord, paragraphLanguage, setParagraphLanguage } from '../editor/lang.ts';
import { IMAGE_WRAPS, wrapOf, wrapPatch, withAlign, type ImageWrap } from '../editor/images.ts';
import { updateAtom } from '../editor/commands.ts';
import { LANGUAGES, languageName, suggest, vocabulary, wordAt, type WordAt } from '../features/spelling.ts';
import { styleGallery } from '../ribbon/shared.ts';
import { pictureTab, tableDesignTab, tableLayoutTab } from '../ribbon/contextual.ts';

const X = T.ctx;

/** Ce qui se trouve sous le pointeur, deduit du DOM. */
export interface ClickContext {
  link: HTMLElement | null;
  field: HTMLElement | null;
  revision: HTMLElement | null;
  comment: HTMLElement | null;
  note: HTMLElement | null;
  inTable: boolean;
  image: boolean;
}

export function clickContext(target: EventTarget | null): ClickContext {
  const el = typeof HTMLElement !== 'undefined' && target instanceof HTMLElement ? target : null;
  return {
    link: el?.closest<HTMLElement>('.fo-link') ?? null,
    field: el?.closest<HTMLElement>('.fo-fld') ?? null,
    revision: el?.closest<HTMLElement>('.fo-rev') ?? null,
    comment: el?.closest<HTMLElement>('.fo-commented') ?? null,
    note: el?.closest<HTMLElement>('.fo-fnref, .fo-enref') ?? null,
    inTable: !!el?.closest('td, th'),
    image: !!el?.closest('.fo-img'),
  };
}

/** Mot sous le point (x, y) ecran : texte du paragraphe, position ProseMirror de debut, ou null. */
export function wordUnder(c: Ctl, clientX: number, clientY: number): (WordAt & { pos: number }) | null {
  const view = c.view();
  const hit = view?.posAtCoords({ left: clientX, top: clientY });
  if (!view || !hit) return null;
  const $pos = view.state.doc.resolve(hit.pos);
  if (!$pos.parent.inlineContent) return null;
  const start = $pos.start();
  const text = $pos.parent.textBetween(0, $pos.parent.content.size, '￼', '￼');
  const w = wordAt(text, hit.pos - start);
  return w ? { ...w, pos: start } : null;
}

/** Entrees « Langue » : langue de chaque paragraphe touche (etat courant coche). */
export function languageItems(c: Ctl): MenuItem[] {
  const state = c.state();
  const cur = state ? paragraphLanguage(state) : undefined;
  return [
    ...LANGUAGES.map((l): MenuItem => ({ id: l.tag, label: l.name, checked: cur !== null && (cur ?? 'fr-FR').toLowerCase() === l.tag.toLowerCase(), onClick: () => c.run(setParagraphLanguage(l.tag)) })),
    { id: 'sep', kind: 'separator' },
    { id: 'none', label: X.noProof, checked: cur === null, onClick: () => c.run(setParagraphLanguage(null)) },
  ];
}

export function currentLanguageName(c: Ctl): string {
  const state = c.state();
  const cur = state ? paragraphLanguage(state) : undefined;
  return cur === null ? X.noProofShort : languageName(cur);
}

export interface EditorMenuHooks {
  /** Le prochain clic droit ouvre le menu du navigateur (corrections natives). */
  armNative(): void;
}

const sep = (id: string): MenuItem => ({ id, kind: 'separator' });
const header = (id: string, label: string): MenuItem => ({ id, kind: 'header', label });

function spellingItems(c: Ctl, clientX: number, clientY: number, hooks: EditorMenuHooks): MenuItem[] {
  const word = c.ui.spell ? wordUnder(c, clientX, clientY) : null;
  const view = c.view();
  if (!word || !view) return [];
  const from = word.pos + word.from;
  const to = word.pos + word.to;
  const options = suggest(word.word, vocabulary(view.state.doc.textBetween(0, view.state.doc.content.size, ' ', ' ')));
  if (!options.length) return [];
  return [
    header('h-spell', X.suggestions),
    ...options.map((o): MenuItem => ({ id: `s-${o}`, label: o, onClick: () => c.run((state, dispatch) => { if (dispatch) dispatch(state.tr.insertText(o, from, to)); return true; }) })),
    { id: 'ignore', label: X.ignore, icon: 'text_proofing_tools', onClick: () => c.run(ignoreWord(from, to)) },
    sep('sep-spell'),
  ];
}

function clipboardItems(c: Ctl): MenuItem[] {
  const has = !c.sel.empty || !!c.sel.image;
  return [
    { id: 'cut', label: T.cmd.cut, icon: 'cut', shortcut: 'Ctrl+X', disabled: !has, onClick: () => c.act.cut() },
    { id: 'copy', label: T.cmd.copy, icon: 'copy', shortcut: 'Ctrl+C', disabled: !has, onClick: () => c.act.copy() },
    { id: 'paste', label: X.pasteOptions, icon: 'clipboard_paste', items: [
      { id: 'p-keep', label: T.cmd.pasteKeep, icon: 'clipboard_paste', shortcut: 'Ctrl+V', onClick: () => void c.act.paste('keep') },
      { id: 'p-text', label: T.cmd.pasteText, icon: 'clipboard', onClick: () => void c.act.paste('text') },
      { id: 'p-special', label: T.cmd.pasteSpecial, onClick: () => c.openDialog('pasteSpecial') },
    ] },
  ];
}

function linkItems(c: Ctl, link: HTMLElement): MenuItem[] {
  const href = link.dataset.href ?? '';
  const external = /^(https?|mailto|tel|ftp):/i.test(href);
  return [
    { id: 'l-open', label: X.openLink, icon: 'link', disabled: !external, onClick: () => window.open(href, '_blank', 'noopener,noreferrer') },
    { id: 'l-edit', label: X.editLink, onClick: () => c.openDialog('link') },
    { id: 'l-copy', label: X.copyLink, onClick: () => void navigator.clipboard?.writeText(href) },
    { id: 'l-del', label: X.removeLink, onClick: () => c.run((state, dispatch) => {
      const type = state.schema.marks.link;
      const { $from } = state.selection;
      const node = $from.parent.maybeChild($from.index());
      if (!type || !node || !dispatch) return false;
      const from = $from.start() + $from.parent.content.cut(0, $from.parentOffset).size - ($from.textOffset ?? 0);
      dispatch(state.tr.removeMark(from, from + node.nodeSize, type));
      return true;
    }) },
    sep('sep-link'),
  ];
}

function tableItems(c: Ctl): MenuItem[] {
  return [
    { id: 't-insert', label: X.insert, icon: 'table', items: [
      { id: 'ra', label: X.rowAbove, onClick: () => c.run(addRowBefore) }, { id: 'rb', label: X.rowBelow, onClick: () => c.run(addRowAfter) },
      { id: 'cl', label: X.colLeft, onClick: () => c.run(addColumnBefore) }, { id: 'cr', label: X.colRight, onClick: () => c.run(addColumnAfter) },
    ] },
    { id: 't-delete', label: X.delete, icon: 'delete', items: [
      { id: 'dr', label: X.deleteRow, onClick: () => c.run(deleteRow) }, { id: 'dc', label: X.deleteCol, onClick: () => c.run(deleteColumn) }, { id: 'dt', label: X.deleteTable, onClick: () => c.run(deleteTable) },
    ] },
    { id: 't-merge', label: X.mergeCells, onClick: () => c.run(mergeCells) },
    { id: 't-split', label: X.splitCell, onClick: () => c.run(splitCell) },
    { id: 't-sort', label: X.sortTable, onClick: () => c.openDialog('sort') },
    { id: 't-layout', label: T.tabs.tableLayout, items: groupsToMenu(tableLayoutTab(c)) },
    { id: 't-design', label: T.tabs.tableDesign, items: groupsToMenu(tableDesignTab(c)) },
    sep('sep-table'),
  ];
}

function imageItems(c: Ctl): MenuItem[] {
  const img = c.sel.image;
  if (!img) return [];
  const update = (patch: Partial<typeof img.data>): void => { c.run(updateAtom(img.pos, { ...img.data, ...patch })); };
  const labels: Record<ImageWrap, string> = { inline: T.cmd.wrapInline, square: T.cmd.wrapSquare, tight: T.cmd.wrapTight, topAndBottom: T.cmd.wrapTopBottom, behind: T.cmd.wrapBehind, front: T.cmd.wrapFront };
  const cur = wrapOf(img.data);
  const align = (a: 'left' | 'center' | 'right'): void => { if (img.data.floating) c.run(updateAtom(img.pos, withAlign(img.data, a))); };
  return [
    { id: 'i-wrap', label: X.wrap, icon: 'text_wrap', items: IMAGE_WRAPS.map((m): MenuItem => ({ id: m, label: labels[m], checked: m === cur, onClick: () => update(wrapPatch(img.data, m)) })) },
    { id: 'i-align', label: T.cmd.position, disabled: !img.data.floating, items: [
      { id: 'al', label: X.alignLeft, onClick: () => align('left') }, { id: 'ac', label: X.alignCenter, onClick: () => align('center') }, { id: 'ar', label: X.alignRight, onClick: () => align('right') },
    ] },
    { id: 'i-caption', label: X.caption, onClick: () => c.openDialog('caption') },
    { id: 'i-alt', label: X.altText, icon: 'text_description', onClick: () => c.openDialog('alt') },
    { id: 'i-reset', label: X.resetPicture, onClick: () => update({ rotation: undefined, flipH: undefined, flipV: undefined, crop: undefined }) },
    { id: 'i-format', label: X.pictureFormat, items: groupsToMenu(pictureTab(c)) },
    sep('sep-image'),
  ];
}

function selectItems(c: Ctl): MenuItem[] {
  return [
    { id: 'sel-all', label: X.selectAll, shortcut: 'Ctrl+A', onClick: () => c.run((state, dispatch) => { if (dispatch) dispatch(state.tr.setSelection(TextSelection.create(state.doc, 1, state.doc.content.size - 1))); return true; }) },
    { id: 'sel-para', label: X.selectParagraph, onClick: () => c.run((state, dispatch) => {
      const { $from } = state.selection;
      if (!$from.parent.inlineContent || !dispatch) return false;
      dispatch(state.tr.setSelection(TextSelection.create(state.doc, $from.start(), $from.end())));
      return true;
    }) },
  ];
}

/** Elements du menu pour un clic droit en (clientX, clientY) sur `target`. */
export function editorMenu(c: Ctl, clientX: number, clientY: number, hooks: EditorMenuHooks, target: EventTarget | null = null): MenuItem[] {
  const ctx = clickContext(target);
  const items: MenuItem[] = [...spellingItems(c, clientX, clientY, hooks)];
  if (ctx.link) items.push(...linkItems(c, ctx.link));
  if (c.sel.image || ctx.image) items.push(...imageItems(c));
  if (ctx.inTable || c.sel.inTable) items.push(...tableItems(c));
  if (ctx.revision) items.push({ id: 'rev-a', label: X.accept, icon: 'checkmark', onClick: () => c.act.review('accept', false) }, { id: 'rev-r', label: X.reject, icon: 'dismiss', onClick: () => c.act.review('reject', false) }, sep('sep-rev'));
  if (ctx.field) items.push({ id: 'f-up', label: X.updateField, icon: 'arrow_sync', onClick: () => c.act.updateFields() }, { id: 'f-edit', label: X.editField, onClick: () => c.openDialog('field') }, sep('sep-field'));
  if (ctx.comment) items.push({ id: 'c-show', label: X.showComment, icon: 'comment', onClick: () => c.setUi({ pane: 'comments' }) }, sep('sep-comment'));
  if (ctx.note) items.push({ id: 'n-show', label: X.showNotes, onClick: () => c.setUi({ pane: 'notes' }) }, sep('sep-note'));
  const numbered = !!c.sel.para.numbering && c.sel.para.numbering.numId !== 0;
  if (numbered) items.push({ id: 'restart', label: X.restartNumbering, onClick: () => c.act.restartNumbering() }, sep('sep-list'));
  const word = !c.sel.empty ? c.sel.text.trim().slice(0, 24) : '';
  items.push(
    ...clipboardItems(c),
    sep('sep-clip'),
    { id: 'font', label: T.cmd.fontDialog, icon: 'text_font', shortcut: 'Ctrl+D', onClick: () => c.openDialog('font') },
    { id: 'paragraph', label: T.cmd.paragraphDialog, icon: 'text_paragraph', onClick: () => c.openDialog('paragraph') },
    { id: 'bullets', label: X.bullets, icon: 'text_bullet_list_ltr', onClick: () => c.act.list({ kind: 'bullet', char: '•' }) },
    { id: 'numbering', label: X.numbering, icon: 'text_number_list_ltr', onClick: () => c.act.list({ kind: 'number', format: 'decimal', text: '%1.' }) },
    { id: 'styles', label: X.styles, icon: 'text_font', items: styleGallery(c.meta).slice(0, 16).map((s): MenuItem => ({ id: s.id, label: s.label, onClick: () => c.act.applyStyle(s.id) })) },
    sep('sep-format'),
    { id: 'link', label: X.link, icon: 'link', shortcut: 'Ctrl+K', onClick: () => c.openDialog('link') },
    { id: 'comment', label: X.newComment, icon: 'comment', onClick: () => c.act.insertComment() },
    { id: 'find', label: word ? X.find(word) : X.findPlain, icon: 'search', shortcut: 'Ctrl+F', onClick: () => { if (word) c.act.findText(c.sel.text.trim()); c.setUi({ nav: true }); } },
    { id: 'synonyms', label: X.synonyms, items: [{ id: 'none', label: X.noSynonym, disabled: true }] },
    { id: 'read', label: X.readAloud, icon: 'speaker_2', disabled: typeof speechSynthesis === 'undefined', onClick: () => readAloud(c) },
    { id: 'translate', label: X.translateSoon, icon: 'translate', disabled: true },
    { id: 'language', label: X.language(currentLanguageName(c)), icon: 'translate', items: languageItems(c) },
    { id: 'select', label: X.select, items: selectItems(c) },
    ...(c.ui.spell ? [{ id: 'native', label: X.native, onClick: () => { hooks.armNative(); c.notify(X.nativeHint, 'info'); } } as MenuItem] : []),
  );
  return items;
}

/** Menu d'un en-tete ou pied de page. */
export function headerFooterMenu(c: Ctl, kind: 'header' | 'footer'): MenuItem[] {
  return [
    { id: 'hf-edit', label: kind === 'header' ? X.editHeader : X.editFooter, onClick: () => c.act.editHeaderFooter(kind) },
    { id: 'hf-num', label: X.pageNumber, onClick: () => c.act.pageNumbers(kind, 'center') },
    { id: 'hf-del', label: kind === 'header' ? X.removeHeader : X.removeFooter, icon: 'delete', onClick: () => c.act.removeHeaderFooter(kind) },
  ];
}

/** Lit la selection (ou le paragraphe du curseur) avec la synthese vocale du systeme, dans la langue du paragraphe. */
function readAloud(c: Ctl): void {
  const state = c.state();
  const text = c.sel.text.trim() || state?.selection.$from.parent.textContent.trim() || '';
  if (!text || typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 20000));
  utterance.lang = (state ? paragraphLanguage(state) : undefined) || 'fr-FR';
  speechSynthesis.speak(utterance);
}
