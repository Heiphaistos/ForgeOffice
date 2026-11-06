// Mini-barre flottante de mise en forme (clic droit sur une cellule) : controles de l'onglet Accueil reutilises tels quels.
import type { RibbonControl, RibbonTab } from '@forgeoffice/ui';

function flatten(controls: readonly RibbonControl[]): RibbonControl[] {
  return controls.flatMap((c) => (c.kind === 'row' ? flatten(c.controls) : [c]));
}

/** Identifiants des controles de chaque rangee (onglet Accueil). */
export const MINI_ROWS: readonly (readonly string[])[] = [
  ['fontname', 'fontsize', 'grow', 'shrink', 'sep', 'currency', 'percent', 'comma', 'decInc', 'decDec'],
  ['bold', 'italic', 'underline', 'fill', 'fontcolor', 'borders', 'sep', 'center', 'merge', 'sep', 'painter'],
];

export function miniBarRows(home: RibbonTab): RibbonControl[][] {
  const byId = new Map<string, RibbonControl>();
  for (const g of home.groups) for (const c of flatten(g.controls)) if (!byId.has(c.id)) byId.set(c.id, c);
  return MINI_ROWS.map((ids) => ids.map((id, i) => (id === 'sep' ? ({ kind: 'separator', id: `sep${i}` } as RibbonControl) : byId.get(id))).filter((x): x is RibbonControl => !!x));
}
