// Reglages du Bloc-notes (services.settings, cle « notes.prefs »), verifies a la lecture.
import type { CaretPrefs } from '@forgeoffice/ui';
import { LAYOUTS, OFFICE_THEME, themeById, type Layout } from './themes.ts';

export const PREFS_KEY = 'notes.prefs';

export type SidePanel = 'none' | 'files' | 'outline' | 'backlinks';
export type SpellLang = 'fr' | 'en' | 'es' | 'de' | 'it';
export type MenuStyle = 'ribbon' | 'classic';

export const SPELL_LANGS: readonly SpellLang[] = ['fr', 'en', 'es', 'de', 'it'];
export const SIDE_PANELS: readonly SidePanel[] = ['none', 'files', 'outline', 'backlinks'];

export interface NotesPrefs {
  theme: string;
  font: string;
  fontSize: number;
  /** Zoom de l'editeur en % (10-500). */
  zoom: number;
  wrap: boolean;
  lineNumbers: boolean;
  whitespace: boolean;
  foldGutter: boolean;
  spell: boolean;
  spellLang: SpellLang;
  statusBar: boolean;
  menus: MenuStyle;
  margin: number;
  spacing: number;
  side: SidePanel;
  sideWidth: number;
  preview: boolean;
  previewWidth: number;
  split: boolean;
  topmost: boolean;
  tabSize: number;
  /** Ligatures de la police (=> ->) ; equivalent adapte du « rendu DirectWrite » de WinNote. */
  ligatures: boolean;
  /** Point d'insertion : epaisseur, couleur, clignotement. */
  caret: CaretPrefs;
}

export const DEFAULT_PREFS: NotesPrefs = {
  theme: OFFICE_THEME,
  font: 'Consolas',
  fontSize: 11,
  zoom: 100,
  wrap: true,
  lineNumbers: true,
  whitespace: false,
  foldGutter: true,
  spell: false,
  spellLang: 'fr',
  statusBar: true,
  menus: 'ribbon',
  margin: 6,
  spacing: 0,
  side: 'none',
  sideWidth: 260,
  preview: false,
  previewWidth: 480,
  split: false,
  topmost: false,
  tabSize: 4,
  ligatures: true,
  caret: { width: 2, color: 'auto', blink: true },
};

const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

export function parsePrefs(raw: unknown): NotesPrefs {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_PREFS;
  const theme = typeof o.theme === 'string' && (o.theme === OFFICE_THEME || themeById(o.theme)) ? o.theme : d.theme;
  const font = typeof o.font === 'string' && o.font.trim() && o.font.length <= 64 ? o.font.trim() : d.font;
  return {
    theme,
    font,
    fontSize: num(o.fontSize, 6, 72, d.fontSize),
    zoom: num(o.zoom, 10, 500, d.zoom),
    wrap: bool(o.wrap, d.wrap),
    lineNumbers: bool(o.lineNumbers, d.lineNumbers),
    whitespace: bool(o.whitespace, d.whitespace),
    foldGutter: bool(o.foldGutter, d.foldGutter),
    spell: bool(o.spell, d.spell),
    spellLang: oneOf(o.spellLang, SPELL_LANGS, d.spellLang),
    statusBar: bool(o.statusBar, d.statusBar),
    menus: oneOf(o.menus, ['ribbon', 'classic'] as const, d.menus),
    margin: num(o.margin, 0, 400, d.margin),
    spacing: num(o.spacing, 0, 20, d.spacing),
    side: oneOf(o.side, SIDE_PANELS, d.side),
    sideWidth: num(o.sideWidth, 160, 640, d.sideWidth),
    preview: bool(o.preview, d.preview),
    previewWidth: num(o.previewWidth, 200, 1200, d.previewWidth),
    split: bool(o.split, d.split),
    topmost: bool(o.topmost, d.topmost),
    tabSize: num(o.tabSize, 1, 16, d.tabSize),
    ligatures: bool(o.ligatures, d.ligatures),
    caret: readCaret(o.caret, d.caret),
  };
}

/** Applique une disposition de WinNote (police, marges, volets, theme eventuel). */
export function applyLayout(p: NotesPrefs, index: number): NotesPrefs {
  const layout: Layout | undefined = LAYOUTS[index];
  if (!layout) return p;
  return {
    ...p,
    font: layout.font,
    fontSize: layout.fontSize,
    wrap: layout.wrap,
    lineNumbers: layout.lineNumbers,
    margin: layout.margin,
    spacing: layout.spacing,
    theme: layout.theme ?? p.theme,
    side: layout.side,
    preview: layout.preview,
    foldGutter: layout.foldGutter,
    zoom: 100,
  };
}

/** Lecture tolerante du reglage du curseur (valeurs hors liste -> valeurs par defaut). */
function readCaret(raw: unknown, d: CaretPrefs): CaretPrefs {
  if (typeof raw !== 'object' || raw === null) return d;
  const o = raw as Record<string, unknown>;
  const color = o.color === 'accent' || o.color === 'black' || o.color === 'white' || o.color === 'auto' ? o.color : d.color;
  return { width: o.width === 1 || o.width === 2 || o.width === 3 ? o.width : d.width, color, blink: typeof o.blink === 'boolean' ? o.blink : d.blink };
}
