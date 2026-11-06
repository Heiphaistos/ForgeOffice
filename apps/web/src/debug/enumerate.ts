// Aplatit le schema declaratif du ruban en liste plate de commandes testables (sans DOM : testee par node:test).
import type { MenuItem, RibbonControl, RibbonTab } from '@forgeoffice/ui';

export type CommandType =
  | 'button' | 'toggle' | 'checkbox' | 'launcher' | 'split' | 'menu' | 'menu-item' | 'gallery' | 'gallery-item'
  | 'color' | 'color-pick' | 'combo' | 'combo-option' | 'font' | 'font-option' | 'number' | 'custom' | 'custom-item';

export interface CommandInfo {
  /** Identifiant stable : onglet.groupe.controle[#element[/sous-element]]. */
  id: string;
  tab: string;
  group: string;
  control: string;
  /** Element de menu / galerie / liste (absent pour le controle lui-meme). */
  item?: string;
  /** Identifiant du controle ou menu conteneur. */
  parent?: string;
  label: string;
  type: CommandType;
  /** Onglet > Groupe > Controle > Element (libelles). */
  path: string[];
  disabled: boolean;
  /** Etat de bascule / de coche au moment de l'enumeration. */
  pressed?: boolean;
  /** Onglet masque dans ce contexte (onglet contextuel absent). */
  tabHidden: boolean;
  contextual?: string;
  /** Element sans action associee (defaut statique du schema). */
  noHandler?: boolean;
  /** Valeur proposee pour une saisie (liste, nombre, couleur). */
  value?: string;
}

export interface CommandEntry extends CommandInfo {
  /** Execute la commande comme le ferait un clic, sans souris. */
  run: (arg?: string) => void;
}

export interface EnumerateOptions {
  /** Couleurs proposees pour tester les selecteurs de couleur : [libelle, valeur]. */
  colors?: readonly (readonly [string, string])[];
  fonts?: readonly string[];
  /** Nombre maximal d'options echantillonnees par liste. */
  maxOptions?: number;
}

const DEFAULTS: Required<EnumerateOptions> = { colors: [['Rouge', '#FF0000'], ['Bleu', '#0070C0']], fonts: ['Arial', 'Courier New'], maxOptions: 8 };

/** Echantillon regulier de n elements dont le premier et le dernier. */
export function sample<T>(list: readonly T[], n: number): T[] {
  if (list.length <= n) return [...list];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(list[Math.round((i * (list.length - 1)) / (n - 1))] as T);
  return [...new Set(out)];
}

interface Ctx {
  tab: RibbonTab;
  groupId: string;
  groupLabel: string;
  out: CommandEntry[];
  opts: Required<EnumerateOptions>;
}

function menuItems(ctx: Ctx, base: CommandInfo, items: readonly MenuItem[], prefix: string, labels: string[]): void {
  for (const it of items) {
    if (it.kind === 'separator' || it.kind === 'header') continue;
    const label = it.label ?? it.id;
    const id = `${prefix}${prefix.includes('#') ? '/' : '#'}${it.id}`;
    const path = [...labels, label];
    if (it.items) {
      ctx.out.push({ ...base, id, item: it.id, label, type: 'menu-item', path, disabled: Boolean(it.disabled), pressed: it.checked, noHandler: false, run: () => undefined, value: 'submenu' });
      menuItems(ctx, base, it.items, id, path);
      continue;
    }
    ctx.out.push({ ...base, id, item: it.id, label, type: 'menu-item', path, disabled: Boolean(it.disabled), pressed: it.checked, noHandler: !it.onClick, run: () => it.onClick?.() });
  }
}

function control(ctx: Ctx, c: RibbonControl): void {
  if (c.kind === 'separator') return;
  if (c.kind === 'row') {
    for (const k of c.controls) control(ctx, k);
    return;
  }
  if (c.hidden) return;
  const id = `${ctx.tab.id}.${ctx.groupId}.${c.id}`;
  const path = [ctx.tab.label, ctx.groupLabel, c.label];
  const base: CommandInfo = {
    id, tab: ctx.tab.id, group: ctx.groupId, control: c.id, label: c.label, type: 'button', path, disabled: Boolean(c.disabled),
    tabHidden: Boolean(ctx.tab.hidden), contextual: ctx.tab.contextual?.set,
  };
  const push = (e: CommandEntry): void => void ctx.out.push(e);
  const child = (suffix: string, label: string, type: CommandType, run: (arg?: string) => void, extra: Partial<CommandInfo> = {}): void =>
    push({ ...base, id: `${id}#${suffix}`, parent: id, item: suffix, label, type, path: [...path, label], run, ...extra });
  switch (c.kind) {
    case 'button':
      push({ ...base, run: () => c.onClick() });
      return;
    case 'toggle':
      push({ ...base, type: 'toggle', pressed: c.pressed, run: () => c.onToggle(!c.pressed) });
      return;
    case 'checkbox':
      push({ ...base, type: 'checkbox', pressed: c.checked, run: () => c.onChange(!c.checked) });
      return;
    case 'split':
      push({ ...base, type: 'split', run: () => c.onClick() });
      menuItems(ctx, { ...base, parent: id }, c.items, id, path);
      return;
    case 'menu':
      push({ ...base, type: 'menu', run: () => undefined });
      menuItems(ctx, { ...base, parent: id }, c.items, id, path);
      return;
    case 'gallery':
      push({ ...base, type: 'gallery', run: () => undefined });
      for (const it of c.items) child(it.id, it.label, 'gallery-item', () => c.onSelect(it.id), { pressed: c.selectedId === it.id });
      if (c.footer) menuItems(ctx, { ...base, parent: id }, c.footer, id, path);
      return;
    case 'color':
      push({ ...base, type: 'color', value: c.value ?? '', run: () => c.onChange(c.value) });
      child('auto', c.emptyMode === 'none' ? 'Aucune couleur' : 'Automatique', 'color-pick', () => c.onChange(null));
      for (const [label, value] of ctx.opts.colors) child(`color:${label}`, label, 'color-pick', () => c.onChange(value), { value });
      return;
    case 'combo': {
      push({ ...base, type: 'combo', value: c.value, run: () => undefined });
      for (const o of sample(c.options, ctx.opts.maxOptions)) child(o.value, o.label ?? o.value, 'combo-option', () => c.onChange(o.value), { value: o.value, pressed: c.value === o.value });
      return;
    }
    case 'font':
      push({ ...base, type: 'font', value: c.value, run: () => undefined });
      for (const f of ctx.opts.fonts) child(f, f, 'font-option', () => c.onChange(f), { value: f, pressed: c.value === f });
      return;
    case 'number':
      push({ ...base, type: 'number', value: String(c.value), run: (arg) => c.onChange(Number(arg ?? c.value + (c.step ?? 1))) });
      return;
    case 'custom':
      push({ ...base, type: 'custom', run: () => undefined });
      child('pick', `${c.label} : choix`, 'custom-item', () => undefined);
      return;
  }
}

/** Toutes les commandes du ruban, onglets masques compris (marques `tabHidden`). */
export function enumerateCommands(tabs: readonly RibbonTab[], options: EnumerateOptions = {}): CommandEntry[] {
  const opts = { ...DEFAULTS, ...options };
  const out: CommandEntry[] = [];
  for (const tab of tabs) {
    for (const g of tab.groups) {
      if (g.hidden) continue;
      const ctx: Ctx = { tab, groupId: g.id, groupLabel: g.label, out, opts };
      for (const c of g.controls) control(ctx, c);
      if (g.launcher) {
        const l = g.launcher;
        out.push({ id: `${tab.id}.${g.id}.${g.id}:launcher`, tab: tab.id, group: g.id, control: `${g.id}:launcher`, label: l.label, type: 'launcher', path: [tab.label, g.label, l.label], disabled: false, tabHidden: Boolean(tab.hidden), contextual: tab.contextual?.set, run: () => l.onClick() });
      }
    }
  }
  return out;
}

/** Version serialisable (sans la fonction run). */
export function toInfo(e: CommandEntry): CommandInfo {
  const { run: _run, ...info } = e;
  return info;
}
