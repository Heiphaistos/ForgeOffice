// Recherche de commandes (« Rechercher (Alt+Q) ») : aplatit le ruban en commandes executables.
import type { IconName } from '../icons/generated.ts';
import type { MenuItem, RibbonControl, RibbonTab } from '../ribbon-types.ts';
import { matchScore } from './text.ts';

export interface CommandEntry {
  id: string;
  label: string;
  /** Chemin affiche sous le libelle : « Accueil > Police ». */
  path: string;
  icon?: IconName;
  shortcut?: string;
  keywords?: readonly string[];
  disabled?: boolean;
  run: () => void;
}

function fromMenu(items: readonly MenuItem[], path: string, out: CommandEntry[]): void {
  for (const item of items) {
    if (item.kind === 'separator' || item.kind === 'header') continue;
    if (item.items) fromMenu(item.items, `${path} > ${item.label ?? ''}`, out);
    const run = item.onClick;
    if (!run || !item.label) continue;
    out.push({ id: item.id, label: item.label, path, icon: item.icon, shortcut: item.shortcut, disabled: item.disabled, run });
  }
}

function fromControl(control: RibbonControl, path: string, out: CommandEntry[]): void {
  if (control.hidden) return;
  switch (control.kind) {
    case 'separator':
    case 'custom':
    case 'combo':
    case 'font':
    case 'number':
      return;
    case 'row':
      for (const c of control.controls) fromControl(c, path, out);
      return;
    case 'button':
    case 'split': {
      const { id, label, icon, disabled, keywords, onClick } = control;
      out.push({ id, label, path, icon, disabled, keywords, shortcut: control.tooltip?.shortcut, run: onClick });
      if (control.kind === 'split') fromMenu(control.items, `${path} > ${label}`, out);
      return;
    }
    case 'toggle': {
      const { id, label, icon, disabled, keywords, pressed, onToggle } = control;
      out.push({ id, label, path, icon, disabled, keywords, shortcut: control.tooltip?.shortcut, run: () => onToggle(!pressed) });
      return;
    }
    case 'checkbox': {
      const { id, label, disabled, keywords, checked, onChange } = control;
      out.push({ id, label, path, icon: checked ? 'checkbox_checked' : 'checkbox_unchecked', disabled, keywords, run: () => onChange(!checked) });
      return;
    }
    case 'menu':
      fromMenu(control.items, `${path} > ${control.label}`, out);
      return;
    case 'gallery':
      for (const item of control.items) {
        out.push({ id: `${control.id}:${item.id}`, label: item.label, path: `${path} > ${control.label}`, icon: item.icon ?? control.icon, disabled: control.disabled, run: () => control.onSelect(item.id) });
      }
      if (control.footer) fromMenu(control.footer, `${path} > ${control.label}`, out);
      return;
    case 'color':
      out.push({ id: control.id, label: control.label, path, icon: control.icon, disabled: control.disabled, keywords: control.keywords, run: () => control.onChange(control.value) });
      return;
  }
}

/** Toutes les commandes executables du ruban (onglets visibles). */
export function collectCommands(tabs: readonly RibbonTab[]): CommandEntry[] {
  const out: CommandEntry[] = [];
  for (const tab of tabs) {
    if (tab.hidden) continue;
    for (const group of tab.groups) {
      if (group.hidden) continue;
      const path = `${tab.label} > ${group.label}`;
      for (const control of group.controls) fromControl(control, path, out);
      if (group.launcher) {
        out.push({ id: `${group.id}:launcher`, label: group.launcher.label, path, run: group.launcher.onClick });
      }
    }
  }
  return out;
}

/** Commandes correspondant a la requete, les plus pertinentes d'abord, sans doublon de libelle+chemin. */
export function searchCommands(commands: readonly CommandEntry[], query: string, limit = 12): CommandEntry[] {
  const seen = new Set<string>();
  const scored: { entry: CommandEntry; score: number }[] = [];
  for (const entry of commands) {
    const key = `${entry.label}|${entry.path}`;
    if (seen.has(key)) continue;
    const own = matchScore(entry.label, query);
    const extra = Math.max(
      matchScore(`${entry.label} ${(entry.keywords ?? []).join(' ')}`, query) - 1,
      matchScore(`${entry.label} ${entry.path}`, query) - 2,
      0,
    );
    const score = Math.max(own * 2, extra);
    if (score <= 0) continue;
    seen.add(key);
    scored.push({ entry, score: entry.disabled ? score - 0.5 : score });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label, 'fr'));
  return scored.slice(0, limit).map((s) => s.entry);
}

/** Un onglet (ou certains de ses groupes) en entrees de menu : un sous-menu par groupe, toutes les commandes du groupe (menu contextuel complet). */
export function groupsToMenu(tab: RibbonTab, groupIds?: readonly string[]): MenuItem[] {
  const out: MenuItem[] = [];
  for (const group of tab.groups) {
    if (group.hidden || (groupIds && !groupIds.includes(group.id))) continue;
    const entries = collectCommands([{ ...tab, groups: [group] }]);
    if (entries.length === 0) continue;
    out.push({
      id: `grp:${tab.id}:${group.id}`,
      label: group.label,
      items: entries.map((e, i): MenuItem => ({ id: `${e.id}#${i}`, label: e.label, icon: e.icon, disabled: e.disabled, shortcut: e.shortcut, onClick: e.run })),
    });
  }
  return out;
}
