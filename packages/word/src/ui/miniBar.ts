// Mini-barre flottante : controles du ruban (onglet Accueil) reutilises tels quels, en deux rangees comme Word.
import type { RibbonControl } from '@forgeoffice/ui';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';
import { homeTab } from '../ribbon/home.ts';
import { styleGallery } from '../ribbon/shared.ts';

function flatten(controls: readonly RibbonControl[]): RibbonControl[] {
  return controls.flatMap((c) => (c.kind === 'row' ? flatten(c.controls) : [c]));
}

/** Identifiants des controles de chaque rangee ; `styles` est remplace par un menu de styles. */
export const MINI_ROWS: readonly (readonly string[])[] = [
  ['fontname', 'fontsize', 'grow', 'shrink', 'styles'],
  ['bold', 'italic', 'underline', 'highlight', 'fontcolor', 'sep', 'bullets', 'numbering', 'outdent', 'indent', 'sep', 'painter', 'clear'],
];

/** Au doigt, une rangee presse-papiers en tete (pas de Ctrl+C/V ni de clic droit pour couper, copier, coller). */
function touchClipboardRow(c: Ctl): RibbonControl[] {
  const cmd = T.cmd;
  return [
    { kind: 'button', id: 'mini-cut', label: cmd.cut, icon: 'cut', iconOnly: true, size: 'small', onClick: c.act.cut },
    { kind: 'button', id: 'mini-copy', label: cmd.copy, icon: 'copy', iconOnly: true, size: 'small', onClick: c.act.copy },
    { kind: 'button', id: 'mini-paste', label: cmd.paste, icon: 'clipboard_paste', iconOnly: true, size: 'small', onClick: () => void c.act.paste('keep') },
  ];
}

export function miniBarRows(c: Ctl, touch = false): RibbonControl[][] {
  const home = homeTab(c);
  const byId = new Map<string, RibbonControl>();
  for (const g of home.groups) for (const ctl of flatten(g.controls)) if (!byId.has(ctl.id) || g.id === 'font') byId.set(ctl.id, ctl);
  const styles: RibbonControl = {
    kind: 'menu', id: 'ministyles', label: T.groups.styles, icon: 'text_font',
    items: styleGallery(c.meta).slice(0, 14).map((s) => ({ id: s.id, label: s.label, onClick: () => c.act.applyStyle(s.id) })),
  };
  const rows = MINI_ROWS.map((ids) => ids.map((id, i) => (id === 'sep' ? ({ kind: 'separator', id: `sep${i}` } as RibbonControl) : id === 'styles' ? styles : byId.get(id))).filter((x): x is RibbonControl => !!x));
  return touch ? [touchClipboardRow(c), ...rows] : rows;
}
