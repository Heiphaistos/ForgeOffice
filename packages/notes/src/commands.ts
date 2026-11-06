// Registre unique des commandes : ruban, menus classiques, palette (Ctrl+Maj+P) et raccourcis clavier.
import { copyLineDown, deleteLine, indentLess, indentMore, moveLineDown, moveLineUp, redo, selectAll, toggleComment, undo } from '@codemirror/commands';
import { foldAll, unfoldAll } from '@codemirror/language';
import { findNext, findPrevious, gotoLine, openSearchPanel, selectNextOccurrence, selectSelectionMatches } from '@codemirror/search';
import type { EditorView } from '@codemirror/view';
import type { IconName } from '@forgeoffice/ui';
import { dedupeLines, joinLines, reverseLines, sortLines, spacesToTabs, tabsToSpaces, trimTrailing, type CaseMode } from './logic/lines.ts';
import { SPELL_LANGS, type NotesPrefs, type SidePanel } from './logic/prefs.ts';
import { LAYOUTS, OFFICE_THEME, THEMES } from './logic/themes.ts';
import { changeSelectionCase, copySelection, deleteSelection, insertDateTime, pasteClipboard, transformLines } from './editor/actions.ts';
import { clearBookmarks, stepBookmark, toggleBookmark } from './editor/marks.ts';
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

export type PaletteMode = 'commands' | 'quick' | 'inFiles' | 'language' | 'encoding' | 'eol' | 'theme' | 'compare';
export type DialogKind = 'stats' | 'font' | 'about';

/** Ce que l'application fournit aux commandes. */
export interface CommandHost {
  ws: Workspace;
  prefs: NotesPrefs;
  setPrefs: (change: Partial<NotesPrefs>) => void;
  applyLayout: (index: number) => void;
  canTopmost: boolean;
  hasUpdater: boolean;
  isWeb: boolean;
  palette: (mode: PaletteMode) => void;
  dialog: (kind: DialogKind) => void;
  closeTabs: (ids: readonly string[]) => void;
  saveAll: () => void;
  openFolder: () => void;
  print: () => void;
  zen: () => void;
  openLinkAtCursor: () => void;
  convertDocx: () => void;
  copyPath: () => void;
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
  const toggle = (key: 'ligatures' | 'wrap' | 'lineNumbers' | 'foldGutter' | 'whitespace' | 'statusBar' | 'preview' | 'split' | 'spell' | 'topmost') => () => h.setPrefs({ [key]: !p[key] });
  const side = (panel: SidePanel) => () => h.setPrefs({ side: p.side === panel ? 'none' : panel });
  const zoom = (z: number) => () => h.setPrefs({ zoom: Math.min(500, Math.max(10, z)) });
  const stepTab = (d: number) => () => {
    const i = ws.tabs.findIndex((t) => t.id === ws.activeId);
    const next = ws.tabs[(i + d + ws.tabs.length) % ws.tabs.length];
    if (next) ws.activate(next.id);
  };
  const others = ws.tabs.filter((t) => t.id !== ws.activeId).map((t) => t.id);

  const list: Command[] = [
    // Fichier
    { id: 'new', label: CMD.new, icon: 'document_add', key: 'Ctrl+N', run: () => ws.newTab() },
    { id: 'newWindow', label: CMD.newWindow, icon: 'window_new', key: 'Ctrl+Maj+N', run: h.newWindow },
    { id: 'open', label: CMD.open, icon: 'folder_open', key: 'Ctrl+O', run: () => void ws.openDialog() },
    { id: 'openFolder', label: CMD.openFolder, icon: 'folder', run: h.openFolder },
    { id: 'reopenClosed', label: CMD.reopenClosed, icon: 'history', key: 'Ctrl+Maj+T', run: () => ws.reopenClosed(), disabled: !ws.canReopen() },
    { id: 'save', label: CMD.save, icon: 'save', key: 'Ctrl+S', run: () => tab && void ws.save(tab.id) },
    { id: 'saveAs', label: CMD.saveAs, icon: 'save_copy', key: 'Ctrl+Maj+S', run: () => tab && void ws.save(tab.id, true) },
    { id: 'saveAll', label: CMD.saveAll, icon: 'save_edit', key: 'Ctrl+Alt+S', run: h.saveAll },
    { id: 'reload', label: CMD.reload, icon: 'arrow_clockwise', run: () => tab && void ws.reload(tab.id), disabled: !tab?.path, hidden: h.isWeb },
    { id: 'print', label: CMD.print, icon: 'print', key: 'Ctrl+P', run: h.print },
    { id: 'copyPath', label: CMD.copyPath, icon: 'copy', run: h.copyPath, disabled: !tab?.path },
    { id: 'reveal', label: CMD.reveal, icon: 'folder_open', run: () => h.notify(S.revealSoon), disabled: true, hint: S.revealSoon },
    { id: 'clearRecent', label: CMD.clearRecent, icon: 'delete', run: h.clearRecent },
    { id: 'openInBrowser', label: CMD.openInBrowser, icon: 'globe', run: h.openInBrowser },
    { id: 'close', label: CMD.close, icon: 'dismiss', key: 'Ctrl+W', run: () => tab && h.closeTabs([tab.id]) },
    { id: 'closeOthers', label: CMD.closeOthers, run: () => h.closeTabs(others), disabled: others.length === 0 },
    { id: 'closeAll', label: CMD.closeAll, run: () => h.closeTabs(ws.tabs.map((t) => t.id)) },
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
    { id: 'findInFiles', label: CMD.findInFiles, icon: 'document_search', key: 'Ctrl+Maj+F', run: () => h.palette('inFiles') },
    { id: 'gotoLine', label: CMD.gotoLine, icon: 'arrow_step_in', key: 'Ctrl+G', run: withView(gotoLine) },
    { id: 'selectNext', label: CMD.selectNext, icon: 'copy_add', key: 'Alt+D', editor: true, run: withView(selectNextOccurrence) },
    { id: 'selectAllMatches', label: CMD.selectAllMatches, icon: 'select_all_on', key: 'Ctrl+Maj+L', editor: true, run: withView(selectSelectionMatches) },
    { id: 'openLink', label: CMD.openLink, icon: 'link', key: 'Ctrl+Entrée', editor: true, run: h.openLinkAtCursor },
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
    { id: 'toggleComment', label: CMD.toggleComment, icon: 'comment', key: 'Ctrl+/', editor: true, run: withView(toggleComment) },
    { id: 'upper', label: CMD.upper, icon: 'text_case_uppercase', key: 'Ctrl+Maj+U', editor: true, run: casing('upper') },
    { id: 'lower', label: CMD.lower, icon: 'text_case_lowercase', key: 'Ctrl+U', editor: true, run: casing('lower') },
    { id: 'titleCase', label: CMD.titleCase, icon: 'text_case_title', run: casing('title') },
    { id: 'sentenceCase', label: CMD.sentenceCase, icon: 'text_change_case', run: casing('sentence') },
    { id: 'invertCase', label: CMD.invertCase, icon: 'text_change_case', run: casing('invert') },
    { id: 'tabsToSpaces', label: CMD.tabsToSpaces, icon: 'text_indent_increase_ltr', run: lines((l) => tabsToSpaces(l, p.tabSize)) },
    { id: 'spacesToTabs', label: CMD.spacesToTabs, icon: 'text_indent_decrease_ltr', run: lines((l) => spacesToTabs(l, p.tabSize)) },
    { id: 'indent', label: CMD.indent, icon: 'text_indent_increase_ltr', key: 'Ctrl+]', nativeKey: true, run: withView(indentMore) },
    { id: 'outdent', label: CMD.outdent, icon: 'text_indent_decrease_ltr', key: 'Ctrl+[', nativeKey: true, run: withView(indentLess) },
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
    { id: 'font', label: CMD.font, icon: 'text_font', run: () => h.dialog('font') },
    // Outils
    { id: 'spell', label: CMD.spell, icon: 'text_proofing_tools', run: toggle('spell'), checked: p.spell },
    { id: 'compare', label: CMD.compare, icon: 'column_double_compare', run: () => h.palette('compare'), disabled: ws.tabs.length < 2 },
    { id: 'stats', label: CMD.stats, icon: 'text_word_count', run: () => h.dialog('stats') },
    { id: 'language', label: CMD.language, icon: 'code', run: () => h.palette('language') },
    { id: 'encoding', label: CMD.encoding, icon: 'text_t', run: () => h.palette('encoding') },
    { id: 'eol', label: CMD.eol, icon: 'arrow_step_in', run: () => h.palette('eol') },
    { id: 'convertDocx', label: CMD.convertDocx, icon: 'document_text', run: h.convertDocx },
    { id: 'checkUpdate', label: CMD.checkUpdate, icon: 'arrow_sync', run: h.checkUpdate, hidden: !h.hasUpdater },
    { id: 'about', label: CMD.about, icon: 'info', run: () => h.dialog('about') },
  ];
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
export function commandMap(list: readonly Command[]): ReadonlyMap<string, Command> {
  return new Map(list.map((c) => [c.id, c]));
}
