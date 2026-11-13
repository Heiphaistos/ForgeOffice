// Catalogue des commandes du ruban par « reference » (onglet.groupe.controle[#element]) : la meme adresse que docs/conformite/<module>.json.
import type { IconName } from '../../icons/generated.ts';
import type { MenuItem, RibbonControl, RibbonTab } from '../../ribbon-types.ts';

export interface Cmd {
  ref: string;
  label: string;
  icon?: IconName;
  shortcut?: string;
  disabled?: boolean;
  /** Etat coche / enfonce (bascule). */
  checked?: boolean;
  /** Controle d'origine quand il se rend tel quel en barre d'outils (police, couleur, bascule...). */
  control?: RibbonControl;
  /** Sous-elements (menu, galerie) : rendus en sous-menu quand la commande de la suite n'a pas de sous-menu propre. */
  items?: readonly MenuItem[];
  run: () => void;
}

function fromItems(items: readonly MenuItem[], prefix: string, out: Cmd[]): void {
  for (const item of items) {
    if (item.kind === 'separator' || item.kind === 'header') continue;
    if (item.items) fromItems(item.items, prefix, out);
    if (item.onClick && item.label) out.push({ ref: `${prefix}#${item.id}`, label: item.label, icon: item.icon, shortcut: item.shortcut, disabled: item.disabled, checked: item.checked, run: item.onClick });
  }
}

function fromControl(c: RibbonControl, base: string, out: Cmd[]): void {
  // Un controle cache sans rendu garde ses commandes (zooms fixes, feuilles) : les menus des dispositions LibreOffice / OpenOffice les utilisent.
  if (c.hidden && c.kind !== 'custom') return;
  const ref = `${base}.${c.id}`;
  switch (c.kind) {
    case 'custom': if (c.run && !c.hidden) out.push({ ref, label: c.label, disabled: c.disabled, run: c.run }); if (c.commands) fromItems(c.commands, ref, out); return;
    case 'separator': return;
    case 'row': for (const k of c.controls) fromControl(k, base, out); return;
    case 'button': out.push({ ref, label: c.label, icon: c.icon, shortcut: c.tooltip?.shortcut, disabled: c.disabled, run: c.onClick }); return;
    case 'split': out.push({ ref, label: c.label, icon: c.icon, shortcut: c.tooltip?.shortcut, disabled: c.disabled, control: c, items: c.items, run: c.onClick }); fromItems(c.items, ref, out); return;
    case 'toggle': out.push({ ref, label: c.label, icon: c.icon, shortcut: c.tooltip?.shortcut, disabled: c.disabled, checked: c.pressed, control: c, run: () => c.onToggle(!c.pressed) }); return;
    case 'checkbox': out.push({ ref, label: c.label, disabled: c.disabled, checked: c.checked, run: () => c.onChange(!c.checked) }); return;
    case 'menu': out.push({ ref, label: c.label, icon: c.icon, disabled: c.disabled, control: c, items: c.items, run: () => undefined }); fromItems(c.items, ref, out); return;
    case 'gallery':
      out.push({ ref, label: c.label, icon: c.icon, disabled: c.disabled, control: c, items: c.items.map((it): MenuItem => ({ id: it.id, label: it.label, icon: it.icon, onClick: () => c.onSelect(it.id) })), run: () => undefined });
      for (const it of c.items) out.push({ ref: `${ref}#${it.id}`, label: it.label, icon: it.icon ?? c.icon, disabled: c.disabled, run: () => c.onSelect(it.id) });
      if (c.footer) fromItems(c.footer, ref, out);
      return;
    case 'color': out.push({ ref, label: c.label, icon: c.icon, disabled: c.disabled, control: c, run: () => c.onChange(c.value) }); return;
    case 'font': case 'combo': case 'number': out.push({ ref, label: c.label, disabled: c.disabled, control: c, run: () => undefined }); return;
  }
}

/** Toutes les commandes des onglets visibles (y compris contextuels), dans l'ordre du ruban. */
export function buildCatalog(tabs: readonly RibbonTab[]): Cmd[] {
  const out: Cmd[] = [];
  for (const tab of tabs) {
    if (tab.hidden) continue;
    for (const g of tab.groups) {
      if (g.hidden) continue;
      for (const c of g.controls) fromControl(c, `${tab.id}.${g.id}`, out);
      if (g.launcher) out.push({ ref: `${tab.id}.${g.id}.${g.id}:launcher`, label: g.launcher.label, run: g.launcher.onClick });
    }
  }
  return out;
}
