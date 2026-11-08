// Mini-barre flottante : contrôles du ruban choisis selon l'objet (texte, forme, image, tableau, graphique).
import type { RibbonControl, RibbonTab } from '@forgeoffice/ui';
import type { Shape } from '@forgeoffice/pptx';

export type MiniKind = 'text' | 'shape' | 'picture' | 'table' | 'chart';

interface RowSpec {
  tab: string;
  ids: readonly string[];
}

/** Rangees de la mini-barre par type : identifiants de controles pris dans les onglets du ruban. */
export const MINI_ROWS: Readonly<Record<MiniKind, readonly RowSpec[]>> = {
  text: [
    { tab: 'home', ids: ['font', 'size', 'grow', 'shrink', 'painter'] },
    { tab: 'home', ids: ['bold', 'italic', 'underline', 'color', 'highlight', 'bullets', 'numbering', 'alignLeft', 'alignCenter', 'alignRight'] },
  ],
  shape: [{ tab: 'home', ids: ['quick', 'fill', 'outline', 'effects'] }],
  picture: [{ tab: 'pictureFormat', ids: ['pictureStyles', 'crop', 'border', 'change'] }],
  table: [
    { tab: 'tableDesign', ids: ['tableStyles', 'shading', 'borders'] },
    { tab: 'tableLayout', ids: ['above', 'below', 'left', 'right', 'delete'] },
  ],
  chart: [{ tab: 'chartDesign', ids: ['changeType', 'edit'] }],
};

/** Type de mini-barre pour une forme selectionnee (hors edition de texte). */
export function miniKindOf(shape: Pick<Shape, 'kind'> | undefined): MiniKind | null {
  if (!shape) return null;
  switch (shape.kind) {
    case 'picture': return 'picture';
    case 'table': return 'table';
    case 'chart': return 'chart';
    case 'shape': case 'group': case 'connector': return 'shape';
    default: return null;
  }
}

/** Controles d'action a plat (les rangees sont depliees). */
function flatten(controls: readonly RibbonControl[]): RibbonControl[] {
  return controls.flatMap((c) => (c.kind === 'row' ? flatten(c.controls) : c.kind === 'separator' || c.hidden ? [] : [c]));
}

/** Une galerie inline est trop large pour la mini-barre : elle devient un menu deroulant (meme liste, meme selection). */
function compact(c: RibbonControl): RibbonControl {
  if (c.kind !== 'gallery') return c;
  return { kind: 'menu', id: c.id, label: c.label, icon: c.icon ?? 'design_ideas', disabled: c.disabled, items: c.items.map((i) => ({ id: i.id, label: i.label, checked: c.selectedId === i.id ? true : undefined, onClick: () => c.onSelect(i.id) })) };
}

/** Controles du ruban reutilises par la mini-barre, dans l'ordre demande ; ceux qui n'existent pas sont ignores. */
export function miniRows(kind: MiniKind, tabs: readonly RibbonTab[]): RibbonControl[][] {
  return MINI_ROWS[kind]
    .map(({ tab, ids }) => {
      const all = new Map(tabs.filter((t) => t.id === tab).flatMap((t) => t.groups.flatMap((g) => flatten(g.controls))).map((c) => [c.id, c] as const));
      return ids.map((id) => all.get(id)).filter((c): c is NonNullable<typeof c> => !!c).map(compact);
    })
    .filter((row) => row.length > 0);
}
