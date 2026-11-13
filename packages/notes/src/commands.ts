// Registre unique des commandes : ruban, menus classiques, palette (Ctrl+Maj+P) et raccourcis clavier.
import { copyLineDown, deleteLine, indentLess, indentMore, moveLineDown, moveLineUp, redo, selectAll, selectParentSyntax, toggleComment, undo } from '@codemirror/commands';
import { foldAll, unfoldAll } from '@codemirror/language';
import { findNext, findPrevious, gotoLine, openSearchPanel, selectNextOccurrence, selectSelectionMatches } from '@codemirror/search';
import type { EditorView } from '@codemirror/view';
import type { IconName } from '@forgeoffice/ui';
import {
  dedupeAdjacent, dedupeLines, joinLines, numberLines, removeEmptyLines, reverseLines, shuffleLines, sortByLength, sortLines, sortNumeric, spacesToTabs, tabsToSpaces, trimBoth, trimLeading, trimTrailing, type CaseMode,
} from './logic/lines.ts';
import { INDENT_CHOICES, type IndentChoice } from './logic/indent.ts';
import { tabsToClose } from './logic/tabs.ts';
import { SPELL_LANGS, type NotesPrefs, type SidePanel } from './logic/prefs.ts';
import { LAYOUTS, OFFICE_THEME, THEMES } from './logic/themes.ts';
import {
  changeSelectionCase, copySelection, deleteSelection, insertDateTime, insertLine, markdownHeading, markdownInline, markdownLines, markdownLink, pasteClipboard, transformLines,
} from './editor/actions.ts';
import { blockComment } from './editor/actions.ts';
import { clearBookmarks, stepBookmark, toggleBookmark } from './editor/marks.ts';
import type { PromptKind } from './folderops.ts';
import type { Workspace } from './workspace.ts';
import { CMD, S } from './strings.ts';

export interface Command {
  id: string;
  label: string;
  icon?: IconName;
  /** Raccourci affiche (« Ctrl+Maj+P »). */
  key?: string;
  /** Info-bulle expliquant pourquoi la commande est grisee. */
  hint?: string;
  /** Raccourci gere par l'editeur lui-meme (pas intercepte). */
  nativeKey?: boolean;
  /** Raccourci actif seulement quand le curseur est dans le texte. */
  editor?: boolean;
  run: () => void;
  checked?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

export type PaletteMode = 'commands' | 'quick' | 'inFiles' | 'tags' | 'symbols' | 'favs' | 'props' | 'propEdit' | 'language' | 'encoding' | 'reloadEncoding' | 'newFile' | 'newDir' | 'rename' | 'move' | 'macroTimes' | 'columnInsert' | 'eol' | 'theme' | 'compare';
export type DialogKind = 'stats' | 'font' | 'about' | 'keymap' | 'printLayout';

/** Ce que l'application fournit aux commandes. */
export interface CommandHost {
  ws: Workspace;
  prefs: NotesPrefs;
  setPrefs: (change: Partial<NotesPrefs>) => void;
  applyLayout: (index: number) => void;
  canTopmost: boolean;
  /** La coquille sait montrer un fichier dans l'explorateur du systeme (bureau). */
  canReveal?: boolean;
  reveal?: (path: string) => void;
  hasUpdater: boolean;
  isWeb: boolean;
  palette: (mode: PaletteMode) => void;
  dialog: (kind: DialogKind) => void;
  closeTabs: (ids: readonly string[]) => void;
  saveAll: () => void;
  openFolder: () => void;
  /** Le fichier de l'onglet actif est-il dans les favoris ? */
  isFavorite: boolean;
  toggleFavorite: () => void;
  recover: () => void;
  print: () => void;
  zen: () => void;
  openLinkAtCursor: () => void;
  convertDocx: () => void;
  copyPath: () => void;
  copyText: (text: string, message: string) => void;
  /** Demande un nom ou un dossier de destination pour une operation de l'explorateur. */
  promptEntry: (kind: PromptKind) => void;
  clearRecent: () => void;
  openInBrowser: () => void;
  newWindow: () => void;
  checkUpdate: () => void;
  quit: () => void;
  notify: (message: string) => void;
}

export function buildCommands(h: CommandHost): Command[] {
  const { ws, prefs: p } = h;
  const tab = ws.active;
  const withView = (fn: (view: EditorView) => unknown) => () => {
    const view = ws.view;
    if (!view) return;
    fn(view);
    view.focus();
  };
  const clip = (fn: (view: EditorView) => Promise<void>) => () => {
    const view = ws.view;
    if (view) fn(view).catch(() => h.notify(S.notices.clipboardDenied));
  };
  const lines = (fn: (l: string[]) => string[]) => withView((v) => transformLines(v, fn));
  const casing = (mode: CaseMode) => withView((v) => changeSelectionCase(v, mode));
  const toggle = (key: 'ligatures' | 'wrap' | 'lineNumbers' | 'foldGutter' | 'whitespace' | 'statusBar' | 'preview' | 'split' | 'spell' | 'topmost' | 'autoClose' | 'autoComplete' | 'autoReload' | 'guides' | 'eolMarks' | 'smart' | 'changeHistory') => () => h.setPrefs({ [key]: !p[key] });
  const side = (panel: SidePanel) => () => h.setPrefs({ side: p.side === panel ? 'none' : panel });
  const zoom = (z: number) => () => h.setPrefs({ zoom: Math.min(500, Math.max(10, z)) });
  const stepTab = (d: number) => () => {
    const i = ws.tabs.findIndex((t) => t.id === ws.activeId);
    const next = ws.tabs[(i + d + ws.tabs.length) % ws.tabs.length];
    if (next) ws.activate(next.id);
  };
  const playMacro = (times: number | 'end'): void => {
    if (ws.macro.last.length === 0) return h.notify(S.notices.macroNone);
    if (ws.playMacro(times)) h.notify(S.notices.macroRan(times === 'end' ? "jusqu'à la fin" : `${times} fois`));
    ws.view?.focus();
  };
  const ops = ws.folderOps;
  const entry = ops.target();
  const entryHint = ws.folder ? S.folderFsHint : S.side.filesEmpty;
  const entryOff = !ops.enabled;
  const closing = (mode: Parameters<typeof tabsToClose>[2]): string[] => tabsToClose(ws.tabs, ws.activeId, mode);

  const list: Command[] = [
    // Fichier
    { id: 'new', label: CMD.new, icon: 'document_add', key: 'Ctrl+N', run: () => ws.newTab() },
    { id: 'newWindow', label: CMD.newWindow, icon: 'window_new', key: 'Ctrl+Maj+N', run: h.newWindow },
    { id: 'open', label: CMD.open, icon: 'folder_open', key: 'Ctrl+O', run: () => void ws.openDialog() },
    { id: 'openFolder', label: CMD.openFolder, icon: 'folder', run: h.openFolder },
    { id: 'reopenClosed', label: CMD.reopenClosed, icon: 'history', key: 'Ctrl+Maj+T', run: () => ws.reopenClosed(), disabled: !ws.canReopen() },
    { id: 'save', label: CMD.save, icon: 'save', key: 'Ctrl+S', run: () => tab && void ws.save(tab.id) },
    { id: 'saveAs', label: CMD.saveAs, icon: 'save_copy', key: 'Ctrl+Maj+S', run: () => tab && void ws.save(tab.id, true) },
    { id: 'saveCopy', label: CMD.saveCopy, icon: 'save_copy', run: () => tab && void ws.saveCopy(tab.id), disabled: !tab },
    { id: 'saveAll', label: CMD.saveAll, icon: 'save_edit', key: 'Ctrl+Alt+S', run: h.saveAll },
    { id: 'reload', label: CMD.reload, icon: 'arrow_clockwise', run: () => tab && void ws.reload(tab.id), disabled: !tab?.path, hidden: h.isWeb },
    { id: 'follow', label: CMD.follow, icon: 'arrow_down', run: () => tab && (tab.follow || (tab.path && !tab.dirty) ? ws.setFollow(tab.id, !tab.follow) : h.notify(S.notices.followNeedsFile)), checked: tab?.follow ?? false, disabled: h.isWeb || !tab?.path, hint: S.notices.followNeedsFile },
    { id: 'autoReload', label: CMD.autoReload, icon: 'arrow_sync', run: toggle('autoReload'), checked: p.autoReload, hidden: h.isWeb },
    { id: 'print', label: CMD.print, icon: 'print', key: 'Ctrl+P', run: h.print },
    { id: 'printSetup', label: CMD.printSetup, icon: 'print', run: () => h.dialog('printLayout') },
    { id: 'favToggle', label: h.isFavorite ? CMD.favUnset : CMD.favToggle, icon: 'star', run: h.toggleFavorite, checked: h.isFavorite, disabled: !tab?.path, hint: S.notices.favNeedsFile },
    { id: 'favs', label: CMD.favs, icon: 'star', run: () => h.palette('favs') },
    { id: 'recover', label: CMD.recover, icon: 'history', run: h.recover },
    { id: 'copyPath', label: CMD.copyPath, icon: 'copy', run: h.copyPath, disabled: !tab?.path },
    { id: 'copyName', label: CMD.copyName, icon: 'copy', run: () => tab && h.copyText(tab.name, S.notices.nameCopied), disabled: !tab },
    { id: 'copyDir', label: CMD.copyDir, icon: 'copy', run: () => tab?.path && h.copyText(dirOf(tab.path), S.notices.dirCopied), disabled: !tab?.path },
    { id: 'dailyNote', label: CMD.dailyNote, icon: 'calendar_date', run: () => { const r = ws.openDailyNote(); if (r.created) h.notify(S.notices.dailyCreated(r.name)); } },
    { id: 'newFile', label: CMD.newFile, icon: 'document_add', run: () => h.promptEntry('newFile'), disabled: entryOff, hint: entryHint },
    { id: 'newDir', label: CMD.newDir, icon: 'folder_add', run: () => h.promptEntry('newDir'), disabled: entryOff, hint: entryHint },
    { id: 'renameEntry', label: CMD.renameEntry, icon: 'rename', run: () => h.promptEntry('rename'), disabled: entryOff || !entry, hint: entryHint },
    { id: 'duplicateEntry', label: CMD.duplicateEntry, icon: 'copy', run: () => { const t = ops.target(); if (t) void ops.duplicate(t.rel); }, disabled: entryOff || !entry, hint: entryHint },
    { id: 'moveEntry', label: CMD.moveEntry, icon: 'folder_open', run: () => h.promptEntry('move'), disabled: entryOff || !entry, hint: entryHint },
    { id: 'deleteEntry', label: CMD.deleteEntry, icon: 'delete', run: () => { const t = ops.target(); if (t) void ops.remove(t.rel); }, disabled: entryOff || !entry, hint: entryHint },
    { id: 'refreshFolder', label: CMD.refreshFolder, icon: 'arrow_sync', run: () => void ops.refresh().then((ok) => ok && ws.notify(S.notices.folderRefreshed)), disabled: entryOff, hint: entryHint },
    { id: 'reveal', label: CMD.reveal, icon: 'folder_open', run: () => tab?.path && h.reveal?.(tab.path), disabled: !h.canReveal || !tab?.path, hint: h.canReveal ? S.notices.noPath : S.revealSoon },
    { id: 'clearRecent', label: CMD.clearRecent, icon: 'delete', run: h.clearRecent },
    { id: 'openInBrowser', label: CMD.openInBrowser, icon: 'globe', run: h.openInBrowser },
    { id: 'close', label: CMD.close, icon: 'dismiss', key: 'Ctrl+W', run: () => tab && !tab.pinned && h.closeTabs([tab.id]), disabled: !tab || tab.pinned },
    { id: 'closeOthers', label: CMD.closeOthers, run: () => h.closeTabs(closing('others')), disabled: closing('others').length === 0 },
    { id: 'closeRight', label: CMD.closeRight, run: () => h.closeTabs(closing('right')), disabled: closing('right').length === 0 },
    { id: 'closeLeft', label: CMD.closeLeft, run: () => h.closeTabs(closing('left')), disabled: closing('left').length === 0 },
    { id: 'closeUnchanged', label: CMD.closeUnchanged, run: () => h.closeTabs(closing('unchanged')), disabled: closing('unchanged').length === 0 },
    { id: 'closeAll', label: CMD.closeAll, run: () => h.closeTabs(closing('all')) },
    { id: 'pinTab', label: tab?.pinned ? CMD.unpin : CMD.pin, icon: 'pin', run: () => tab && ws.setPinned(tab.id, !tab.pinned), checked: tab?.pinned ?? false },
    { id: 'quit', label: CMD.quit, icon: 'sign_out', run: h.quit },
    // Edition
    { id: 'undo', label: CMD.undo, icon: 'arrow_undo', key: 'Ctrl+Z', nativeKey: true, run: withView(undo) },
    { id: 'redo', label: CMD.redo, icon: 'arrow_redo', key: 'Ctrl+Y', nativeKey: true, run: withView(redo) },
    { id: 'cut', label: CMD.cut, icon: 'cut', key: 'Ctrl+X', nativeKey: true, run: clip((v) => copySelection(v, true)) },
    { id: 'copy', label: CMD.copy, icon: 'copy', key: 'Ctrl+C', nativeKey: true, run: clip((v) => copySelection(v, false)) },
    { id: 'paste', label: CMD.paste, icon: 'clipboard_paste', key: 'Ctrl+V', nativeKey: true, run: clip(pasteClipboard) },
    { id: 'del', label: CMD.del, icon: 'delete', key: 'Suppr', nativeKey: true, run: withView(deleteSelection) },
    { id: 'selectAll', label: CMD.selectAll, icon: 'select_all_on', key: 'Ctrl+A', nativeKey: true, run: withView(selectAll) },
    { id: 'find', label: CMD.find, icon: 'search', key: 'Ctrl+F', run: withView(openSearchPanel) },
    { id: 'findNext', label: CMD.findNext, icon: 'arrow_down', key: 'F3', run: withView(findNext) },
    { id: 'findPrev', label: CMD.findPrev, icon: 'arrow_up', key: 'Maj+F3', run: withView(findPrevious) },
    {
      id: 'replace', label: CMD.replace, icon: 'arrow_swap', key: 'Ctrl+H',
      run: withView((v) => {
        openSearchPanel(v);
        v.dom.querySelector<HTMLInputElement>('.cm-search input[name=replace]')?.focus();
      }),
    },
    { id: 'props', label: CMD.props, icon: 'document_bullet_list', run: () => h.palette('props'), disabled: !tab || tab.readOnly },
    { id: 'symbols', label: CMD.symbols, icon: 'document_bullet_list', run: () => h.palette('symbols'), disabled: !tab },
    { id: 'tags', label: CMD.tags, icon: 'tag', run: () => h.palette('tags') },
    { id: 'findInFiles', label: CMD.findInFiles, icon: 'document_search', key: 'Ctrl+Maj+F', run: () => h.palette('inFiles') },
    { id: 'gotoLine', label: CMD.gotoLine, icon: 'arrow_step_in', key: 'Ctrl+G', run: withView(gotoLine) },
    { id: 'selectNext', label: CMD.selectNext, icon: 'copy_add', key: 'Alt+D', editor: true, run: withView(selectNextOccurrence) },
    { id: 'selectAllMatches', label: CMD.selectAllMatches, icon: 'select_all_on', key: 'Ctrl+Maj+L', editor: true, run: withView(selectSelectionMatches) },
    { id: 'openLink', label: CMD.openLink, icon: 'link', key: 'Ctrl+Entrée', editor: true, run: h.openLinkAtCursor },
    {
      id: 'macroRecord', label: ws.macro.recording ? CMD.macroStop : CMD.macroRecord, icon: 'record', key: 'F9', checked: ws.macro.recording,
      run: () => {
        const n = ws.toggleMacro();
        h.notify(n === null ? S.notices.macroRecording : S.notices.macroSaved(n));
        ws.view?.focus();
      },
    },
    { id: 'macroPlay', label: CMD.macroPlay, icon: 'play', key: 'F10', run: () => playMacro(1), disabled: ws.macro.recording },
    { id: 'macroPlayTimes', label: CMD.macroPlayTimes, icon: 'play', run: () => h.palette('macroTimes'), disabled: ws.macro.recording },
    { id: 'macroToEnd', label: CMD.macroToEnd, icon: 'play', run: () => playMacro('end'), disabled: ws.macro.recording },
    { id: 'columnInsert', label: CMD.columnInsert, icon: 'table_insert_column', key: 'Alt+C', editor: true, run: () => h.palette('columnInsert') },
    { id: 'dateTime', label: CMD.dateTime, icon: 'calendar_date', key: 'F5', run: withView(insertDateTime) },
    // Lignes et texte
    { id: 'moveUp', label: CMD.moveUp, icon: 'arrow_up', key: 'Alt+↑', editor: true, run: withView(moveLineUp) },
    { id: 'moveDown', label: CMD.moveDown, icon: 'arrow_down', key: 'Alt+↓', editor: true, run: withView(moveLineDown) },
    { id: 'duplicate', label: CMD.duplicate, icon: 'copy', key: 'Ctrl+D', editor: true, run: withView(copyLineDown) },
    { id: 'deleteLine', label: CMD.deleteLine, icon: 'delete', key: 'Ctrl+Maj+K', editor: true, run: withView(deleteLine) },
    { id: 'join', label: CMD.join, icon: 'merge', key: 'Ctrl+J', editor: true, run: lines(joinLines) },
    { id: 'sortAsc', label: CMD.sortAsc, icon: 'text_sort_ascending', run: lines((l) => sortLines(l)) },
    { id: 'sortDesc', label: CMD.sortDesc, icon: 'text_sort_descending', run: lines((l) => sortLines(l, true)) },
    { id: 'dedupe', label: CMD.dedupe, icon: 'filter_dismiss', run: lines(dedupeLines) },
    { id: 'reverse', label: CMD.reverse, icon: 'arrow_sort', run: lines(reverseLines) },
    { id: 'trim', label: CMD.trim, icon: 'eraser', run: lines(trimTrailing) },
    { id: 'removeEmpty', label: CMD.removeEmpty, icon: 'delete', run: lines((l) => removeEmptyLines(l)) },
    { id: 'dedupeAdjacent', label: CMD.dedupeAdjacent, icon: 'filter_dismiss', run: lines(dedupeAdjacent) },
    { id: 'sortNumeric', label: CMD.sortNumeric, icon: 'text_sort_ascending', run: lines((l) => sortNumeric(l)) },
    { id: 'sortNumericDesc', label: CMD.sortNumericDesc, icon: 'text_sort_descending', run: lines((l) => sortNumeric(l, true)) },
    { id: 'sortLength', label: CMD.sortLength, icon: 'text_sort_ascending', run: lines((l) => sortByLength(l)) },
    { id: 'shuffle', label: CMD.shuffle, icon: 'arrow_swap', run: lines((l) => shuffleLines(l)) },
    { id: 'numberLines', label: CMD.numberLines, icon: 'number_row', run: lines((l) => numberLines(l)) },
    { id: 'trimLeading', label: CMD.trimLeading, icon: 'eraser', run: lines(trimLeading) },
    { id: 'trimBoth', label: CMD.trimBoth, icon: 'eraser', run: lines(trimBoth) },
    { id: 'lineAbove', label: CMD.lineAbove, icon: 'arrow_up', key: 'Ctrl+Alt+Entrée', editor: true, run: withView((v) => insertLine(v, true)) },
    { id: 'lineBelow', label: CMD.lineBelow, icon: 'arrow_down', key: 'Ctrl+Alt+Maj+Entrée', editor: true, run: withView((v) => insertLine(v, false)) },
    { id: 'blockComment', label: CMD.blockComment, icon: 'comment', key: 'Alt+Maj+A', editor: true, run: withView((v) => { if (!blockComment(v)) h.notify(S.notices.noBlockComment); }) },
    { id: 'toggleComment', label: CMD.toggleComment, icon: 'comment', key: 'Ctrl+/', editor: true, run: withView(toggleComment) },
    { id: 'upper', label: CMD.upper, icon: 'text_case_uppercase', key: 'Ctrl+Maj+U', editor: true, run: casing('upper') },
    { id: 'lower', label: CMD.lower, icon: 'text_case_lowercase', key: 'Ctrl+U', editor: true, run: casing('lower') },
    { id: 'titleCase', label: CMD.titleCase, icon: 'text_case_title', run: casing('title') },
    { id: 'sentenceCase', label: CMD.sentenceCase, icon: 'text_change_case', run: casing('sentence') },
    { id: 'invertCase', label: CMD.invertCase, icon: 'text_change_case', run: casing('invert') },
    { id: 'camelCase', label: CMD.camelCase, icon: 'text_case_title', run: casing('camel') },
    { id: 'pascalCase', label: CMD.pascalCase, icon: 'text_case_title', run: casing('pascal') },
    { id: 'snakeCase', label: CMD.snakeCase, icon: 'text_case_lowercase', run: casing('snake') },
    { id: 'kebabCase', label: CMD.kebabCase, icon: 'text_case_lowercase', run: casing('kebab') },
    { id: 'tabsToSpaces', label: CMD.tabsToSpaces, icon: 'text_indent_increase_ltr', run: lines((l) => tabsToSpaces(l, p.tabSize)) },
    { id: 'spacesToTabs', label: CMD.spacesToTabs, icon: 'text_indent_decrease_ltr', run: lines((l) => spacesToTabs(l, p.tabSize)) },
    { id: 'indent', label: CMD.indent, icon: 'text_indent_increase_ltr', key: 'Ctrl+]', nativeKey: true, run: withView(indentMore) },
    { id: 'outdent', label: CMD.outdent, icon: 'text_indent_decrease_ltr', key: 'Ctrl+[', nativeKey: true, run: withView(indentLess) },
    // Mise en forme Markdown
    { id: 'mdBold', label: CMD.mdBold, icon: 'text_bold', key: 'Ctrl+B', editor: true, run: withView((v) => markdownInline(v, '**')) },
    { id: 'mdItalic', label: CMD.mdItalic, icon: 'text_italic', key: 'Ctrl+I', editor: true, run: withView((v) => markdownInline(v, '*')) },
    { id: 'mdStrike', label: CMD.mdStrike, icon: 'text_strikethrough', run: withView((v) => markdownInline(v, '~~')) },
    { id: 'mdCode', label: CMD.mdCode, icon: 'code', editor: true, run: withView((v) => markdownInline(v, '`')) },
    { id: 'mdLink', label: CMD.mdLink, icon: 'link', key: 'Ctrl+K', editor: true, run: withView(markdownLink) },
    { id: 'mdH1', label: CMD.mdH(1), icon: 'text_header_1', run: withView((v) => markdownHeading(v, 1)) },
    { id: 'mdH2', label: CMD.mdH(2), icon: 'text_header_2', run: withView((v) => markdownHeading(v, 2)) },
    { id: 'mdH3', label: CMD.mdH(3), icon: 'text_header_3', run: withView((v) => markdownHeading(v, 3)) },
    { id: 'mdBullet', label: CMD.mdBullet, icon: 'text_bullet_list_ltr', run: withView((v) => markdownLines(v, 'bullet')) },
    { id: 'mdNumber', label: CMD.mdNumber, icon: 'text_number_list_ltr', run: withView((v) => markdownLines(v, 'number')) },
    { id: 'mdTask', label: CMD.mdTask, icon: 'checkbox_checked', run: withView((v) => markdownLines(v, 'task')) },
    { id: 'mdQuote', label: CMD.mdQuote, icon: 'text_quote', run: withView((v) => markdownLines(v, 'quote')) },
    { id: 'expandSelection', label: CMD.expandSelection, icon: 'select_all_on', key: 'Alt+Maj+→', editor: true, run: withView(selectParentSyntax) },
    // Signets et repli
    { id: 'bookmarkToggle', label: CMD.bookmarkToggle, icon: 'bookmark', key: 'Ctrl+F2', run: withView(toggleBookmark) },
    { id: 'bookmarkNext', label: CMD.bookmarkNext, icon: 'arrow_next', key: 'F2', run: withView((v) => stepBookmark(v, true)) },
    { id: 'bookmarkPrev', label: CMD.bookmarkPrev, icon: 'arrow_previous', key: 'Maj+F2', run: withView((v) => stepBookmark(v, false)) },
    { id: 'bookmarkClear', label: CMD.bookmarkClear, icon: 'bookmark_off', run: withView(clearBookmarks) },
    { id: 'foldAll', label: CMD.foldAll, icon: 'text_collapse', key: 'Ctrl+Alt+[', nativeKey: true, run: withView(foldAll) },
    { id: 'unfoldAll', label: CMD.unfoldAll, icon: 'text_expand', key: 'Ctrl+Alt+]', nativeKey: true, run: withView(unfoldAll) },
    // Affichage
    { id: 'zoomIn', label: CMD.zoomIn, icon: 'zoom_in', key: 'Ctrl++', run: zoom(p.zoom + 10) },
    { id: 'zoomOut', label: CMD.zoomOut, icon: 'zoom_out', key: 'Ctrl+-', run: zoom(p.zoom - 10) },
    { id: 'zoomReset', label: CMD.zoomReset, icon: 'zoom_fit', key: 'Ctrl+0', run: zoom(100) },
    { id: 'wrap', label: CMD.wrap, icon: 'text_wrap', run: toggle('wrap'), checked: p.wrap },
    { id: 'lineNumbers', label: CMD.lineNumbers, icon: 'number_row', run: toggle('lineNumbers'), checked: p.lineNumbers },
    { id: 'foldGutter', label: CMD.foldGutter, icon: 'chevron_down', run: toggle('foldGutter'), checked: p.foldGutter },
    { id: 'ligatures', label: CMD.ligatures, icon: 'text_font', run: toggle('ligatures'), checked: p.ligatures },
    { id: 'whitespace', label: CMD.whitespace, icon: 'text_paragraph', run: toggle('whitespace'), checked: p.whitespace },
    { id: 'guides', label: CMD.guides, icon: 'text_indent_increase_ltr', run: toggle('guides'), checked: p.guides },
    { id: 'eolMarks', label: CMD.eolMarks, icon: 'arrow_step_in', run: toggle('eolMarks'), checked: p.eolMarks },
    { id: 'smart', label: CMD.smart, icon: 'highlight', run: toggle('smart'), checked: p.smart },
    { id: 'changeHistory', label: CMD.changeHistory, icon: 'history', run: toggle('changeHistory'), checked: p.changeHistory },
    { id: 'statusBar', label: CMD.statusBar, icon: 'panel_bottom', run: toggle('statusBar'), checked: p.statusBar },
    { id: 'sideFiles', label: CMD.sideFiles, icon: 'folder', key: 'Ctrl+Maj+E', run: side('files'), checked: p.side === 'files' },
    { id: 'sideOutline', label: CMD.sideOutline, icon: 'document_bullet_list', key: 'Ctrl+Maj+O', run: side('outline'), checked: p.side === 'outline' },
    { id: 'sideBacklinks', label: CMD.sideBacklinks, icon: 'link_multiple', key: 'Ctrl+Maj+B', run: side('backlinks'), checked: p.side === 'backlinks' },
    { id: 'preview', label: CMD.preview, icon: 'markdown', key: 'Ctrl+Maj+M', run: toggle('preview'), checked: p.preview },
    { id: 'split', label: CMD.split, icon: 'split_horizontal', key: 'Ctrl+\\', run: toggle('split'), checked: p.split },
    { id: 'zen', label: CMD.zen, icon: 'full_screen_maximize', key: 'F11', run: h.zen },
    { id: 'topmost', label: CMD.topmost, icon: 'pin', run: toggle('topmost'), checked: p.topmost, hidden: !h.canTopmost },
    { id: 'readOnly', label: CMD.readOnly, icon: 'lock_closed', run: () => tab && ws.patch(tab.id, { readOnly: !tab.readOnly }), checked: tab?.readOnly ?? false },
    { id: 'tabNext', label: CMD.tabNext, icon: 'chevron_right', key: 'Ctrl+Tab', run: stepTab(1) },
    { id: 'tabPrev', label: CMD.tabPrev, icon: 'chevron_left', key: 'Ctrl+Maj+Tab', run: stepTab(-1) },
    { id: 'palette', label: CMD.palette, icon: 'key_command', key: 'Ctrl+Maj+P', run: () => h.palette('commands') },
    { id: 'quickOpen', label: CMD.quickOpen, icon: 'document_search', key: 'Ctrl+E', run: () => h.palette('quick') },
    { id: 'menus', label: CMD.menus, icon: 'navigation', run: () => h.setPrefs({ menus: p.menus === 'ribbon' ? 'classic' : 'ribbon' }), checked: p.menus === 'classic' },
    { id: 'keymap', label: CMD.keymap, icon: 'keyboard', run: () => h.dialog('keymap') },
    { id: 'font', label: CMD.font, icon: 'text_font', run: () => h.dialog('font') },
    // Outils
    { id: 'autoClose', label: CMD.autoClose, icon: 'text_font', run: toggle('autoClose'), checked: p.autoClose },
    { id: 'autoComplete', label: CMD.autoComplete, icon: 'text_font', run: toggle('autoComplete'), checked: p.autoComplete },
    { id: 'spell', label: CMD.spell, icon: 'text_proofing_tools', run: toggle('spell'), checked: p.spell },
    { id: 'compare', label: CMD.compare, icon: 'column_double_compare', run: () => h.palette('compare'), disabled: ws.tabs.length < 2 },
    { id: 'stats', label: CMD.stats, icon: 'text_word_count', run: () => h.dialog('stats') },
    { id: 'language', label: CMD.language, icon: 'code', run: () => h.palette('language') },
    { id: 'encoding', label: CMD.encoding, icon: 'text_t', run: () => h.palette('encoding') },
    { id: 'reloadEncoding', label: CMD.reloadEncoding, icon: 'arrow_clockwise', run: () => h.palette('reloadEncoding'), disabled: !tab },
    { id: 'eol', label: CMD.eol, icon: 'arrow_step_in', run: () => h.palette('eol') },
    { id: 'convertDocx', label: CMD.convertDocx, icon: 'document_text', run: h.convertDocx },
    { id: 'checkUpdate', label: CMD.checkUpdate, icon: 'arrow_sync', run: h.checkUpdate, hidden: !h.hasUpdater },
    { id: 'about', label: CMD.about, icon: 'info', run: () => h.dialog('about') },
  ];
  for (const choice of INDENT_CHOICES) {
    const label = choice === 'auto' ? CMD.indentAuto : choice === 'tab' ? CMD.indentTab : CMD.indentN(Number(choice));
    list.push({ id: `indent:${choice}`, label, icon: 'text_indent_increase_ltr', run: () => h.setPrefs({ indent: choice }), checked: p.indent === choice });
  }
  for (const th of [{ id: OFFICE_THEME, name: 'Office 2024' }, ...THEMES]) {
    list.push({ id: `theme:${th.id}`, label: CMD.theme(th.name), icon: 'color', run: () => h.setPrefs({ theme: th.id }), checked: p.theme === th.id });
  }
  LAYOUTS.forEach((l, i) => list.push({ id: `layout:${i}`, label: CMD.layout(l.name), icon: 'slide_layout', run: () => h.applyLayout(i) }));
  for (const code of SPELL_LANGS) {
    list.push({ id: `spellLang:${code}`, label: CMD.spellLang(S.spellLangs[code]), icon: 'translate', run: () => h.setPrefs({ spellLang: code, spell: true }), checked: p.spellLang === code });
  }
  return list;
}

/** Acces par identifiant (le ruban et les menus referencent les commandes par leur id). */
/** Repetitions saisies (0 = jusqu'a la fin du document) ; null si ce n'est pas un entier. */
export function parseTimes(text: string): number | 'end' | null {
  const t = text.trim();
  if (!/^\d{1,6}$/.test(t)) return null;
  return Number(t) === 0 ? 'end' : Number(t);
}

/** Dossier d'un chemin (separateur / ou \). */
export function dirOf(path: string): string {
  return path.replace(/[\\/][^\\/]*$/, '');
}

export function commandMap(list: readonly Command[]): ReadonlyMap<string, Command> {
  return new Map(list.map((c) => [c.id, c]));
}
