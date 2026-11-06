// Socle d'extension du Tableur : trois registres ou les lots s'enregistrent sans toucher App.tsx.
//  - dialogues  : id -> composant (+ titre), ouverture par id ;
//  - menus      : contexte (cellule, onglet de feuille, graphique...) -> fournisseurs d'entrees ;
//  - raccourcis : table declarative touche -> commande, avec priorite et contexte.
// Fichier sans DOM ni React a l'execution (types seulement) : teste par node --test.
import type { ReactNode } from 'react';
import type { MenuItem } from '@forgeoffice/ui';
import type { NoticeKind } from '@forgeoffice/core';
import type { UiFlags } from '../ribbon/env.ts';
import type { Commands, Ctx } from './commands.ts';
import type { EntryKeyApi, GridKeyApi } from './keys-types.ts';
import type { ContextHandlers } from './menus-grid.ts';

// =============================================================== Dialogues

type NoProps = Record<never, never>;

/**
 * Proprietes de chaque dialogue, par identifiant. Un lot ajoute les siens par fusion de declaration :
 * `declare module './registry.ts' { interface DialogMap { monDialogue: { cible: number } } }`.
 */
export interface DialogMap {
  pasteSpecial: NoProps;
  find: { replace: boolean };
  goto: NoProps;
  names: NoProps;
  fnWizard: { fn?: string };
  evaluate: NoProps;
  validation: NoProps;
  sort: NoProps;
  removeDup: NoProps;
  textToCols: NoProps;
  subtotal: NoProps;
  cfRule: { preset?: string };
  cfManage: NoProps;
  pivotCreate: NoProps;
  link: NoProps;
  symbol: NoProps;
  size: { axis: 'row' | 'col' };
  series: NoProps;
  formatCells: { tab?: string; category?: string };
  protect: { target: 'sheet' | 'book' };
  sparkline: { type: 'line' | 'column' | 'stacked' };
  unhideSheet: NoProps;
  note: NoProps;
  newComment: NoProps;
  zoom: NoProps;
}

export type DialogId = keyof DialogMap;
/** Etat d'un dialogue ouvert : `{ kind: id, ...proprietes }` ; l'etat « ferme » est `null` dans l'application. */
export type DialogState = { [K in DialogId]: { kind: K } & DialogMap[K] }[DialogId];
export type DialogOf<K extends DialogId> = Extract<DialogState, { kind: K }>;

/** Contexte donne a chaque dialogue : celui des commandes, plus fermeture et commandes de l'application. */
export interface DialogEnv extends Ctx {
  cmd: Commands;
  close: () => void;
}

/** Services de l'application utiles aux dialogues (en plus de `DialogEnv`). */
export interface DialogHostApi {
  zoom: number;
  setZoom: (z: number) => void;
  createPivot: (source: string, newSheet: boolean) => void;
  insertFormula: (formula: string) => void;
  setUi: (patch: Partial<UiFlags>) => void;
  /** Insere du texte (un nom...) a la position du curseur de la saisie en cours, ou demarre une saisie « = » + texte. */
  insertAtCaret: (text: string) => void;
}

export interface DialogDef<K extends DialogId = DialogId> {
  id: K;
  /** Titre de la boite (palette de commandes, nom accessible) ; une fonction quand il depend des proprietes. */
  title: string | ((dialog: DialogOf<K>) => string);
  render: (dialog: DialogOf<K>, x: DialogEnv, host: DialogHostApi) => ReactNode;
}

type AnyDialogDef = { [K in DialogId]: DialogDef<K> }[DialogId];
const dialogs = new Map<string, AnyDialogDef>();

/** Enregistre un dialogue ; renvoie la fonction qui le retire. Un identifiant deja pris est une erreur (deux lots en conflit). */
export function registerDialog<K extends DialogId>(def: DialogDef<K>): () => void {
  if (dialogs.has(def.id)) throw new Error(`dialogue deja enregistre : ${def.id}`);
  dialogs.set(def.id, def as unknown as AnyDialogDef);
  return () => void dialogs.delete(def.id);
}

export const dialogIds = (): string[] => [...dialogs.keys()];
export function dialogTitle(state: DialogState): string | undefined {
  const t = dialogs.get(state.kind)?.title;
  return typeof t === 'function' ? (t as (d: DialogState) => string)(state) : t;
}

/** Ouvre un dialogue par identifiant : `open` est le setter de l'etat de l'application. */
export function openDialog<K extends DialogId>(open: (d: DialogState) => void, id: K, props?: DialogMap[K]): void {
  if (!dialogs.has(id)) throw new Error(`dialogue inconnu : ${id}`);
  open({ kind: id, ...props } as unknown as DialogState);
}

/** Rendu du dialogue ouvert (null si l'identifiant n'est pas enregistre). */
export function renderDialog(state: DialogState, x: DialogEnv, host: DialogHostApi): ReactNode {
  const def = dialogs.get(state.kind);
  return def ? (def.render as (d: DialogState, x: DialogEnv, h: DialogHostApi) => ReactNode)(state, x, host) : null;
}

// =============================================================== Menus contextuels

/** Contexte des menus de la grille : tout ce qu'une entree peut declencher. Les lots y ajoutent des champs par fusion de declaration. */
export interface MenuEnv extends ContextHandlers {
  notify?: (message: string, kind?: NoticeKind) => void;
}

/** Environnement du menu d'un onglet de feuille (fourni par SheetTabs). */
export interface SheetTabMenuEnv {
  visibleCount: number;
  sheetCount: number;
  hiddenCount: number;
  sheetName: (i: number) => string;
  onAdd: () => void;
  onDelete: (i: number) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (i: number) => void;
  onColor: (i: number, rgb: string | null) => void;
  onHide: (i: number) => void;
  onUnhide: () => void;
  onProtect: () => void;
  startRename: (i: number) => void;
}

/**
 * Contextes de menu et environnement de chacun. `cell`/`row`/`col`/`corner` sont branches sur la grille ; les autres sont declares
 * pour que les lots y enregistrent leurs entrees puis ouvrent le menu avec `buildMenu` (ou `useExcelServices().openMenu`).
 */
export interface MenuContexts {
  cell: MenuEnv;
  row: MenuEnv;
  col: MenuEnv;
  corner: MenuEnv;
  sheetTab: SheetTabMenuEnv;
  chart: MenuEnv;
  object: MenuEnv;
  pivot: MenuEnv;
  formulaBar: MenuEnv;
  statusBar: MenuEnv;
  fillHandle: MenuEnv;
}

export type MenuContextId = keyof MenuContexts;

/** Cible du clic droit (onglet, objet, cellule...). */
export interface MenuTarget {
  sheetIndex?: number;
  drawingIndex?: number;
  row?: number;
  col?: number;
}

export interface MenuProvider<C extends MenuContextId = MenuContextId> {
  id: string;
  context: C | readonly C[];
  /** Position du segment dans le menu (croissant ; 500 par defaut). Un trait separe deux segments non vides. */
  order?: number;
  items: (env: MenuContexts[C], target: MenuTarget) => MenuItem[];
}

const menus: { provider: MenuProvider; seq: number }[] = [];
let menuSeq = 0;

export function registerMenu<C extends MenuContextId>(provider: MenuProvider<C>): () => void {
  if (menus.some((m) => m.provider.id === provider.id)) throw new Error(`fournisseur de menu deja enregistre : ${provider.id}`);
  const entry = { provider: provider as unknown as MenuProvider, seq: menuSeq++ };
  menus.push(entry);
  return () => void menus.splice(menus.indexOf(entry), 1);
}

const contextsOf = (p: MenuProvider): readonly MenuContextId[] => (Array.isArray(p.context) ? p.context : [p.context as MenuContextId]);

export const menuProviderIds = (context: MenuContextId): string[] => menuEntries(context).map((m) => m.provider.id);

function menuEntries(context: MenuContextId): { provider: MenuProvider; seq: number }[] {
  return menus.filter((m) => contextsOf(m.provider).includes(context)).sort((a, b) => (a.provider.order ?? 500) - (b.provider.order ?? 500) || a.seq - b.seq);
}

/** Construit le menu d'un contexte : segments des fournisseurs par ordre, un trait entre deux segments non vides, sans trait en tete, en queue ni double. */
export function buildMenu<C extends MenuContextId>(context: C, env: MenuContexts[C], target: MenuTarget = {}): MenuItem[] {
  const out: MenuItem[] = [];
  let n = 0;
  for (const { provider } of menuEntries(context)) {
    const items = (provider as unknown as MenuProvider<C>).items(env, target).filter((it) => it.kind !== 'separator' || out.length > 0);
    const last = items[items.length - 1];
    if (last?.kind === 'separator') items.pop();
    if (!items.length) continue;
    if (out.length && out[out.length - 1]?.kind !== 'separator' && items[0]?.kind !== 'separator') out.push({ id: `sep-${n++}`, kind: 'separator' });
    out.push(...items);
  }
  while (out[out.length - 1]?.kind === 'separator') out.pop();
  return out;
}

// =============================================================== Raccourcis clavier

export type ShortcutContext = 'grid' | 'entry';

/** API donnee a `run` selon le contexte : `grid` = grille hors saisie, `entry` = saisie dans une cellule ou la barre de formule. */
export interface ShortcutApis {
  grid: GridKeyApi;
  entry: EntryKeyApi;
}

/** Evenement clavier minimal (un KeyboardEvent React ou DOM convient). */
export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  /** Touche physique (`Digit9`...) : les chiffres AZERTY sont des symboles non majuscules, la touche physique permet de les reconnaitre. */
  code?: string;
}

export interface ShortcutDef<C extends ShortcutContext = ShortcutContext> {
  id: string;
  context: C;
  /**
   * Combinaison : `Ctrl+Maj+L` en anglais (`Ctrl`, `Alt`, `Shift`, puis la touche : `F12`, `Enter`, `ArrowUp`, `Space`, `a`, `%`...).
   * Un modificateur absent doit etre relache ; prefixe par `~` (`~Shift`), il est indifferent. `Ctrl` accepte aussi la touche Meta (macOS).
   */
  combo?: string;
  /** Test libre a la place de `combo` (ex. toute touche imprimable). */
  test?: (e: KeyLike) => boolean;
  /** Plus grand = essaye en premier (0 par defaut) ; a priorite egale, premier enregistre d'abord. */
  priority?: number;
  /** Commande declenchee (libelle pour l'aide et la palette). */
  label?: string;
  when?: (api: ShortcutApis[C], e: KeyLike) => boolean;
  /** `false` = non traite : la definition suivante est essayee. Tout autre retour = traite (l'appelant fait preventDefault). */
  run: (api: ShortcutApis[C], e: KeyLike) => boolean | void;
}

type Tri = boolean | 'any';
interface Combo {
  key: string;
  ctrl: Tri;
  alt: Tri;
  shift: Tri;
}

const KEY_ALIASES: Readonly<Record<string, string>> = { Space: ' ', Plus: '+' };

export function parseCombo(combo: string): Combo {
  const plus = combo.endsWith('++') || combo === '+';
  const key0 = plus ? '+' : combo.slice(combo.lastIndexOf('+') + 1);
  const mods = (plus ? combo.slice(0, -2) : combo.slice(0, Math.max(0, combo.lastIndexOf('+')))).split('+').filter(Boolean);
  const out: Combo = { key: KEY_ALIASES[key0] ?? key0, ctrl: false, alt: false, shift: false };
  if (out.key.length === 1) out.key = out.key.toLowerCase();
  for (const m of mods) {
    const any = m.startsWith('~');
    const name = (any ? m.slice(1) : m).toLowerCase();
    if (name !== 'ctrl' && name !== 'alt' && name !== 'shift') throw new Error(`modificateur inconnu : ${m} dans ${combo}`);
    out[name] = any ? 'any' : true;
  }
  return out;
}

const triOk = (want: Tri, have: boolean): boolean => want === 'any' || want === have;

export function matchCombo(c: Combo, e: KeyLike): boolean {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return key === c.key && triOk(c.ctrl, e.ctrlKey || e.metaKey) && triOk(c.alt, e.altKey) && triOk(c.shift, e.shiftKey);
}

const shortcuts: { def: ShortcutDef; seq: number; combo: Combo | null }[] = [];
let shortcutSeq = 0;
let ordered: Map<ShortcutContext, typeof shortcuts> | null = null;

export function registerShortcut<C extends ShortcutContext>(def: ShortcutDef<C>): () => void {
  if (!def.combo && !def.test) throw new Error(`raccourci sans touche : ${def.id}`);
  if (shortcuts.some((s) => s.def.id === def.id)) throw new Error(`raccourci deja enregistre : ${def.id}`);
  const entry = { def: def as unknown as ShortcutDef, seq: shortcutSeq++, combo: def.combo ? parseCombo(def.combo) : null };
  shortcuts.push(entry);
  ordered = null;
  return () => {
    shortcuts.splice(shortcuts.indexOf(entry), 1);
    ordered = null;
  };
}

function inOrder(context: ShortcutContext): typeof shortcuts {
  ordered ??= new Map();
  let list = ordered.get(context);
  if (!list) {
    list = shortcuts.filter((s) => s.def.context === context).sort((a, b) => (b.def.priority ?? 0) - (a.def.priority ?? 0) || a.seq - b.seq);
    ordered.set(context, list);
  }
  return list;
}

/** Raccourcis d'un contexte dans l'ordre d'essai (aide, palette de commandes, tests). */
export const shortcutsOf = (context: ShortcutContext): ShortcutDef[] => inOrder(context).map((s) => s.def);

/** Comme `dispatchKey`, mais renvoie l'identifiant du raccourci qui a traite la touche (null si aucun) : tests et aide. */
export function dispatchKeyId<C extends ShortcutContext>(context: C, e: KeyLike, api: ShortcutApis[C]): string | null {
  for (const s of inOrder(context)) {
    if (s.combo ? !matchCombo(s.combo, e) : !s.def.test?.(e)) continue;
    const d = s.def as unknown as ShortcutDef<C>;
    if (d.when && !d.when(api, e)) continue;
    if (d.run(api, e) !== false) return d.id;
  }
  return null;
}

/** Essaie les raccourcis du contexte par priorite ; renvoie vrai si l'un d'eux a traite la touche (l'appelant fait alors preventDefault). */
export const dispatchKey = <C extends ShortcutContext>(context: C, e: KeyLike, api: ShortcutApis[C]): boolean => dispatchKeyId(context, e, api) !== null;

/** Declare un lot de raccourcis d'un contexte. */
export function registerShortcuts<C extends ShortcutContext>(defs: readonly ShortcutDef<C>[]): void {
  for (const d of defs) registerShortcut(d);
}
