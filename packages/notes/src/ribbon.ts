// Ruban compact (Accueil, Edition, Affichage, Outils) et menus classiques, construits depuis le registre de commandes.
import { FONT_SIZE_OPTIONS, validateFontSize, type MenuItem, type RibbonControl, type RibbonTab } from '@forgeoffice/ui';
import type { Command } from './commands.ts';
import { INDENT_CHOICES } from './logic/indent.ts';
import type { NotesPrefs } from './logic/prefs.ts';
import { LAYOUTS, OFFICE_THEME, THEMES } from './logic/themes.ts';
import { CMD, S } from './strings.ts';

type Lookup = ReadonlyMap<string, Command>;
const INDENT_IDS = INDENT_CHOICES.map((c) => `indent:${c}`);

function get(map: Lookup, id: string): Command {
  const c = map.get(id);
  if (!c) throw new Error(`Commande inconnue : ${id}`);
  return c;
}

function tip(c: Command) {
  return { title: c.label, shortcut: c.key, description: c.hint };
}

function btn(map: Lookup, id: string, size: 'large' | 'small' = 'small', label?: string): RibbonControl {
  const c = get(map, id);
  return { kind: 'button', id, label: label ?? c.label.replace(/…$/, ''), icon: c.icon, size, tooltip: tip(c), onClick: c.run, disabled: c.disabled, hidden: c.hidden };
}

function tog(map: Lookup, id: string, size: 'large' | 'small' = 'small'): RibbonControl {
  const c = get(map, id);
  return { kind: 'toggle', id, label: c.label, icon: c.icon, size, tooltip: tip(c), pressed: c.checked ?? false, onToggle: c.run, disabled: c.disabled, hidden: c.hidden };
}

/** Element de menu depuis une commande. */
export function item(map: Lookup, id: string): MenuItem {
  const c = get(map, id);
  return { id, label: c.label, icon: c.icon, shortcut: c.key, checked: c.checked, disabled: c.disabled, description: c.hint, onClick: c.run };
}

const sep = (id: string): MenuItem => ({ id, kind: 'separator' });

function items(map: Lookup, ids: readonly string[]): MenuItem[] {
  return ids.filter((id) => id.startsWith('-') || !map.get(id)?.hidden).map((id) => (id.startsWith('-') ? sep(id) : item(map, id)));
}

function menu(map: Lookup, id: string, label: string, icon: Command['icon'], ids: readonly string[], size: 'large' | 'small' = 'small'): RibbonControl {
  return { kind: 'menu', id, label, icon, size, items: items(map, ids) };
}

export const themeItems = (map: Lookup): MenuItem[] => [OFFICE_THEME, ...THEMES.map((t) => t.id)].map((id) => {
  const c = get(map, `theme:${id}`);
  return { id: c.id, label: c.label.replace(/^Thème : /, ''), checked: c.checked, onClick: c.run };
});
export const layoutItems = (map: Lookup): MenuItem[] => LAYOUTS.map((_, i) => {
  const c = get(map, `layout:${i}`);
  return { id: c.id, label: c.label.replace(/^Disposition : /, ''), onClick: c.run };
});
const spellItems = (map: Lookup): MenuItem[] => ['fr', 'en', 'es', 'de', 'it'].map((code) => {
  const c = get(map, `spellLang:${code}`);
  return { id: c.id, label: c.label.replace(/^.*: /, ''), checked: c.checked, onClick: c.run };
});

export interface RibbonHost {
  map: Lookup;
  prefs: NotesPrefs;
  setPrefs: (p: Partial<NotesPrefs>) => void;
  languageName: string;
}

export function buildRibbon({ map, prefs, setPrefs, languageName }: RibbonHost): RibbonTab[] {
  const g = (id: string, label: string, controls: RibbonControl[]) => ({ id, label, controls });
  return [
    {
      id: 'home', label: S.ribbon.home,
      groups: [
        g('clip', S.ribbon.clipboard, [btn(map, 'paste', 'large'), btn(map, 'cut'), btn(map, 'copy'), btn(map, 'selectAll')]),
        g('hist', S.ribbon.history, [btn(map, 'undo'), btn(map, 'redo'), btn(map, 'reopenClosed')]),
        g('find', S.ribbon.find, [btn(map, 'find', 'large'), btn(map, 'replace'), btn(map, 'gotoLine'), btn(map, 'findInFiles')]),
        g('font', S.ribbon.font, [
          { kind: 'font', id: 'fontFamily', label: S.dialogs.fontFamily, value: prefs.font, width: 140, onChange: (font) => setPrefs({ font }) },
          {
            kind: 'combo', id: 'fontSize', label: S.ribbon.fontSize, value: String(prefs.fontSize), options: FONT_SIZE_OPTIONS, editable: true, width: 56,
            validate: validateFontSize, onChange: (v) => setPrefs({ fontSize: Number(v) }),
          },
          btn(map, 'font'),
        ]),
        g('notes', S.ribbon.notes, [btn(map, 'openLink', 'large'), btn(map, 'dailyNote'), tog(map, 'preview', 'large'), tog(map, 'sideBacklinks'), tog(map, 'sideOutline'), btn(map, 'quickOpen')]),
        g('lang', S.ribbon.convert, [btn(map, 'language', 'large', languageName), btn(map, 'convertDocx')]),
      ],
    },
    {
      id: 'edit', label: S.ribbon.edit,
      groups: [
        g('lines', S.ribbon.lines, [btn(map, 'moveUp'), btn(map, 'moveDown'), btn(map, 'duplicate'), btn(map, 'deleteLine'), btn(map, 'join'), btn(map, 'trim')]),
        g('sort', S.ribbon.sort, [btn(map, 'sortAsc', 'large'), btn(map, 'sortDesc'), btn(map, 'dedupe'), btn(map, 'reverse'),
          menu(map, 'moreLines', S.ribbon.moreLines, 'text_sort_ascending', ['removeEmpty', 'dedupeAdjacent', 'sortNumeric', 'sortNumericDesc', 'sortLength', 'shuffle', 'numberLines', 'trimLeading', 'trimBoth', 'lineAbove', 'lineBelow'])]),
        g('text', S.ribbon.text, [
          btn(map, 'toggleComment', 'large'), btn(map, 'blockComment'),
          menu(map, 'case', S.ribbon.caseMenu, 'text_change_case', ['upper', 'lower', 'titleCase', 'sentenceCase', 'invertCase', 'camelCase', 'pascalCase', 'snakeCase', 'kebabCase']),
          btn(map, 'indent'), btn(map, 'outdent'),
          menu(map, 'tabsMenu', S.ribbon.tabsMenu, 'text_indent_increase_ltr', ['tabsToSpaces', 'spacesToTabs', '-i', ...INDENT_IDS]),
        ]),
        g('md', S.ribbon.markdown, [
          btn(map, 'mdBold'), btn(map, 'mdItalic'), btn(map, 'mdStrike'), btn(map, 'mdCode'), btn(map, 'mdLink'),
          menu(map, 'mdHeadings', S.ribbon.mdHeadings, 'text_header_1', ['mdH1', 'mdH2', 'mdH3']),
          menu(map, 'mdLists', S.ribbon.mdLists, 'text_bullet_list_ltr', ['mdBullet', 'mdNumber', 'mdTask', 'mdQuote']),
        ]),
        g('sel', S.ribbon.selection, [btn(map, 'selectNext', 'large'), btn(map, 'selectAllMatches')]),
        g('marks', S.ribbon.bookmarks, [btn(map, 'bookmarkToggle', 'large'), btn(map, 'bookmarkNext'), btn(map, 'bookmarkPrev'), btn(map, 'bookmarkClear')]),
        g('macros', S.ribbon.macros, [btn(map, 'macroRecord', 'large'), btn(map, 'macroPlay'), btn(map, 'macroPlayTimes'), btn(map, 'macroToEnd')]),
        g('fold', S.ribbon.fold, [btn(map, 'foldAll'), btn(map, 'unfoldAll')]),
        g('ins', S.ribbon.insert, [btn(map, 'dateTime', 'large'), btn(map, 'columnInsert')]),
      ],
    },
    {
      id: 'view', label: S.ribbon.view,
      groups: [
        g('show', S.ribbon.show, [tog(map, 'lineNumbers'), tog(map, 'wrap'), tog(map, 'whitespace'), tog(map, 'ligatures'), tog(map, 'foldGutter'), tog(map, 'guides'), tog(map, 'eolMarks'), tog(map, 'smart'), tog(map, 'changeHistory'), tog(map, 'statusBar')]),
        g('panes', S.ribbon.panes, [tog(map, 'sideFiles', 'large'), tog(map, 'sideOutline'), tog(map, 'sideBacklinks'), tog(map, 'preview'), tog(map, 'split')]),
        g('zoom', S.ribbon.zoom, [btn(map, 'zoomIn', 'large'), btn(map, 'zoomOut'), btn(map, 'zoomReset')]),
        g('win', S.ribbon.window, [btn(map, 'zen', 'large'), btn(map, 'newWindow'), tog(map, 'readOnly'), tog(map, 'topmost'), tog(map, 'menus')]),
        g('look', S.ribbon.appearance, [
          { kind: 'menu', id: 'themeMenu', label: S.ribbon.theme, icon: 'color', size: 'large', items: themeItems(map) },
          { kind: 'menu', id: 'layoutMenu', label: S.ribbon.layout, icon: 'slide_layout', size: 'large', items: layoutItems(map) },
        ]),
      ],
    },
    {
      id: 'tools', label: S.ribbon.tools,
      groups: [
        g('proof', S.ribbon.proofing, [tog(map, 'spell', 'large'), tog(map, 'autoClose'), tog(map, 'autoComplete'), { kind: 'menu', id: 'spellLang', label: S.ribbon.spellLang, icon: 'translate', items: spellItems(map) }]),
        g('analyse', S.ribbon.analyse, [btn(map, 'stats', 'large'), btn(map, 'compare', 'large')]),
        g('file', S.ribbon.file, [btn(map, 'encoding'), btn(map, 'reloadEncoding'), btn(map, 'eol'), btn(map, 'language')]),
        g('watch', S.ribbon.watch, [tog(map, 'follow'), tog(map, 'autoReload'), btn(map, 'reveal')]),
        g('path', S.ribbon.path, [btn(map, 'copyPath'), btn(map, 'copyName'), btn(map, 'copyDir'), tog(map, 'favToggle'), btn(map, 'saveCopy')]),
        g('docx', S.ribbon.document, [btn(map, 'props', 'large'), btn(map, 'printSetup'), btn(map, 'recover')]),
        g('folder', S.ribbon.folder, [
          btn(map, 'newFile', 'large'), btn(map, 'newDir'), btn(map, 'refreshFolder'),
          menu(map, 'folderMore', S.ribbon.folderMore, 'folder_open', ['renameEntry', 'duplicateEntry', 'moveEntry', 'deleteEntry']),
        ]),
        g('nav', S.ribbon.navigate, [btn(map, 'palette', 'large'), btn(map, 'quickOpen'), btn(map, 'findInFiles'), btn(map, 'tags'), btn(map, 'symbols'), btn(map, 'favs'), btn(map, 'keymap')]),
        g('conv', S.ribbon.convert, [btn(map, 'convertDocx', 'large'), btn(map, 'openInBrowser'), btn(map, 'checkUpdate'), btn(map, 'about')]),
      ],
    },
  ];
}

/** Menus classiques facon WinNote (Fichier, Edition, Lignes, Format, Affichage, Theme, Disposition, ?). */
export function buildMenus(map: Lookup, recent: MenuItem[], encodingItems: MenuItem[], eolItems: MenuItem[], reloadItems: MenuItem[]): { id: string; label: string; items: MenuItem[] }[] {
  return [
    {
      id: 'file', label: S.menus.file,
      items: [
        ...items(map, ['new', 'newWindow', 'open', 'openFolder']),
        { id: 'recent', label: S.menus.recent, icon: 'history', items: recent.length ? [...recent, sep('rs'), item(map, 'clearRecent')] : [{ id: 'none', label: S.menus.noRecent, disabled: true }] },
        ...items(map, ['reopenClosed', '-1', 'save', 'saveAs', 'saveCopy', 'saveAll', 'print', 'printSetup', 'reload', 'follow', 'autoReload', '-2', 'newFile', 'newDir', 'renameEntry', 'duplicateEntry', 'moveEntry', 'deleteEntry', 'refreshFolder', '-2b', 'copyPath', 'copyName', 'copyDir', 'favToggle', 'favs', 'recover', 'dailyNote', 'reveal', 'openInBrowser', 'convertDocx', '-3', 'close', 'closeOthers', 'closeLeft', 'closeRight', 'closeUnchanged', 'closeAll', 'pinTab', 'quit']),
      ],
    },
    {
      id: 'edit', label: S.menus.edit,
      items: [
        ...items(map, ['undo', 'redo', '-1', 'cut', 'copy', 'paste', 'del', 'selectAll', '-2', 'find', 'findNext', 'findPrev', 'replace', 'findInFiles', 'tags', 'props', 'symbols', 'gotoLine', '-3', 'selectNext', 'selectAllMatches', 'openLink', 'dateTime', 'columnInsert', 'macroRecord', 'macroPlay', 'macroPlayTimes', 'macroToEnd', '-4', 'spell', 'autoClose', 'autoComplete']),
        { id: 'spellLang', label: S.menus.spellLang, icon: 'translate', items: spellItems(map) },
      ],
    },
    { id: 'lines', label: S.menus.lines, items: items(map, ['moveUp', 'moveDown', 'duplicate', 'deleteLine', 'join', '-1', 'sortAsc', 'sortDesc', 'dedupe', 'reverse', 'trim', 'trimLeading', 'trimBoth', 'removeEmpty', 'dedupeAdjacent', 'sortNumeric', 'sortNumericDesc', 'sortLength', 'shuffle', 'numberLines', 'lineAbove', 'lineBelow', '-2', 'toggleComment', 'blockComment', 'upper', 'lower', 'titleCase', 'sentenceCase', 'invertCase', 'camelCase', 'pascalCase', 'snakeCase', 'kebabCase', '-md', 'mdBold', 'mdItalic', 'mdStrike', 'mdCode', 'mdLink', 'mdH1', 'mdH2', 'mdH3', 'mdBullet', 'mdNumber', 'mdTask', 'mdQuote', 'expandSelection', 'tabsToSpaces', 'spacesToTabs', 'indent', 'outdent']) },
    {
      id: 'format', label: S.menus.format,
      items: [
        ...items(map, ['wrap', 'font', 'keymap', '-i', ...INDENT_IDS]),
        { id: 'eol', label: S.menus.eol, items: eolItems },
        { id: 'enc', label: S.menus.encoding, items: encodingItems },
        { id: 'reloadEnc', label: CMD.reloadEncoding.replace('…', ''), icon: 'arrow_clockwise', items: reloadItems },
        item(map, 'language'),
      ],
    },
    {
      id: 'view', label: S.menus.view,
      items: items(map, ['zoomIn', 'zoomOut', 'zoomReset', '-1', 'sideFiles', 'sideOutline', 'sideBacklinks', 'preview', 'split', 'lineNumbers', 'foldGutter', 'whitespace', 'ligatures', 'guides', 'eolMarks', 'smart', 'changeHistory', 'statusBar', 'zen', 'topmost', 'readOnly', '-2', 'bookmarkToggle', 'bookmarkNext', 'bookmarkPrev', 'bookmarkClear', 'foldAll', 'unfoldAll', '-3', 'tabNext', 'tabPrev', 'palette', 'quickOpen', 'menus']),
    },
    { id: 'theme', label: S.menus.theme, items: themeItems(map) },
    { id: 'layout', label: S.menus.layout, items: layoutItems(map) },
    { id: 'help', label: S.menus.help, items: items(map, ['stats', 'compare', 'checkUpdate', 'about']) },
  ];
}
