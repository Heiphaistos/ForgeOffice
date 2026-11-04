// Ruban compact (Accueil, Edition, Affichage, Outils) et menus classiques, construits depuis le registre de commandes.
import { FONT_SIZE_OPTIONS, validateFontSize, type MenuItem, type RibbonControl, type RibbonTab } from '@forgeoffice/ui';
import type { Command } from './commands.ts';
import type { NotesPrefs } from './logic/prefs.ts';
import { LAYOUTS, OFFICE_THEME, THEMES } from './logic/themes.ts';
import { S } from './strings.ts';

type Lookup = ReadonlyMap<string, Command>;

function get(map: Lookup, id: string): Command {
  const c = map.get(id);
  if (!c) throw new Error(`Commande inconnue : ${id}`);
  return c;
}

function tip(c: Command) {
  return { title: c.label, shortcut: c.key };
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
  return { id, label: c.label, icon: c.icon, shortcut: c.key, checked: c.checked, disabled: c.disabled, onClick: c.run };
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
        g('notes', S.ribbon.notes, [btn(map, 'openLink', 'large'), tog(map, 'preview', 'large'), tog(map, 'sideBacklinks'), tog(map, 'sideOutline'), btn(map, 'quickOpen')]),
        g('lang', S.ribbon.convert, [btn(map, 'language', 'large', languageName), btn(map, 'convertDocx')]),
      ],
    },
    {
      id: 'edit', label: S.ribbon.edit,
      groups: [
        g('lines', S.ribbon.lines, [btn(map, 'moveUp'), btn(map, 'moveDown'), btn(map, 'duplicate'), btn(map, 'deleteLine'), btn(map, 'join'), btn(map, 'trim')]),
        g('sort', S.ribbon.sort, [btn(map, 'sortAsc', 'large'), btn(map, 'sortDesc'), btn(map, 'dedupe'), btn(map, 'reverse')]),
        g('text', S.ribbon.text, [
          btn(map, 'toggleComment', 'large'),
          menu(map, 'case', S.ribbon.caseMenu, 'text_change_case', ['upper', 'lower', 'titleCase', 'sentenceCase', 'invertCase']),
          btn(map, 'indent'), btn(map, 'outdent'),
          menu(map, 'tabsMenu', S.ribbon.tabsMenu, 'text_indent_increase_ltr', ['tabsToSpaces', 'spacesToTabs']),
        ]),
        g('sel', S.ribbon.selection, [btn(map, 'selectNext', 'large'), btn(map, 'selectAllMatches')]),
        g('marks', S.ribbon.bookmarks, [btn(map, 'bookmarkToggle', 'large'), btn(map, 'bookmarkNext'), btn(map, 'bookmarkPrev'), btn(map, 'bookmarkClear')]),
        g('fold', S.ribbon.fold, [btn(map, 'foldAll'), btn(map, 'unfoldAll')]),
        g('ins', S.ribbon.insert, [btn(map, 'dateTime', 'large')]),
      ],
    },
    {
      id: 'view', label: S.ribbon.view,
      groups: [
        g('show', S.ribbon.show, [tog(map, 'lineNumbers'), tog(map, 'wrap'), tog(map, 'whitespace'), tog(map, 'foldGutter'), tog(map, 'statusBar')]),
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
        g('proof', S.ribbon.proofing, [tog(map, 'spell', 'large'), { kind: 'menu', id: 'spellLang', label: S.ribbon.spellLang, icon: 'translate', items: spellItems(map) }]),
        g('analyse', S.ribbon.analyse, [btn(map, 'stats', 'large'), btn(map, 'compare', 'large')]),
        g('file', S.ribbon.file, [btn(map, 'encoding'), btn(map, 'eol'), btn(map, 'language')]),
        g('nav', S.ribbon.navigate, [btn(map, 'palette', 'large'), btn(map, 'quickOpen'), btn(map, 'findInFiles')]),
        g('conv', S.ribbon.convert, [btn(map, 'convertDocx', 'large'), btn(map, 'openInBrowser'), btn(map, 'checkUpdate'), btn(map, 'about')]),
      ],
    },
  ];
}

/** Menus classiques facon WinNote (Fichier, Edition, Lignes, Format, Affichage, Theme, Disposition, ?). */
export function buildMenus(map: Lookup, recent: MenuItem[], encodingItems: MenuItem[], eolItems: MenuItem[]): { id: string; label: string; items: MenuItem[] }[] {
  return [
    {
      id: 'file', label: S.menus.file,
      items: [
        ...items(map, ['new', 'newWindow', 'open', 'openFolder']),
        { id: 'recent', label: S.menus.recent, icon: 'history', items: recent.length ? recent : [{ id: 'none', label: S.menus.noRecent, disabled: true }] },
        ...items(map, ['reopenClosed', '-1', 'save', 'saveAs', 'saveAll', 'print', 'reload', '-2', 'copyPath', 'openInBrowser', 'convertDocx', '-3', 'close', 'closeOthers', 'closeAll', 'quit']),
      ],
    },
    {
      id: 'edit', label: S.menus.edit,
      items: [
        ...items(map, ['undo', 'redo', '-1', 'cut', 'copy', 'paste', 'del', 'selectAll', '-2', 'find', 'findNext', 'findPrev', 'replace', 'findInFiles', 'gotoLine', '-3', 'selectNext', 'selectAllMatches', 'openLink', 'dateTime', '-4', 'spell']),
        { id: 'spellLang', label: S.menus.spellLang, icon: 'translate', items: spellItems(map) },
      ],
    },
    { id: 'lines', label: S.menus.lines, items: items(map, ['moveUp', 'moveDown', 'duplicate', 'deleteLine', 'join', '-1', 'sortAsc', 'sortDesc', 'dedupe', 'reverse', 'trim', '-2', 'toggleComment', 'upper', 'lower', 'titleCase', 'sentenceCase', 'invertCase', 'tabsToSpaces', 'spacesToTabs', 'indent', 'outdent']) },
    {
      id: 'format', label: S.menus.format,
      items: [
        ...items(map, ['wrap', 'font']),
        { id: 'eol', label: S.menus.eol, items: eolItems },
        { id: 'enc', label: S.menus.encoding, items: encodingItems },
        item(map, 'language'),
      ],
    },
    {
      id: 'view', label: S.menus.view,
      items: items(map, ['zoomIn', 'zoomOut', 'zoomReset', '-1', 'sideFiles', 'sideOutline', 'sideBacklinks', 'preview', 'split', 'lineNumbers', 'foldGutter', 'whitespace', 'statusBar', 'zen', 'topmost', 'readOnly', '-2', 'bookmarkToggle', 'bookmarkNext', 'bookmarkPrev', 'bookmarkClear', 'foldAll', 'unfoldAll', '-3', 'tabNext', 'tabPrev', 'palette', 'quickOpen', 'menus']),
    },
    { id: 'theme', label: S.menus.theme, items: themeItems(map) },
    { id: 'layout', label: S.menus.layout, items: layoutItems(map) },
    { id: 'help', label: S.menus.help, items: items(map, ['stats', 'compare', 'checkUpdate', 'about']) },
  ];
}
