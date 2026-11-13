// Disposition des onglets du profil OnlyOffice : chaque groupe est decrit comme dans OnlyOffice Desktop Editors 10.0 (ordre, grand/petit bouton,
// rangees) avec NOS commandes (retrouvees par identifiant). Un bouton d'OnlyOffice que nous n'avons pas est present mais grise (infobulle honnete) ;
// une commande de la suite absente de la description est conservee dans un groupe « Autres » de l'onglet (jamais supprimee).
import type { IconName } from '../icons/generated.ts';
import type { ButtonControl, RibbonControl, RibbonGroup, RibbonTab } from '../ribbon-types.ts';

/** Un emplacement : identifiant d'une de nos commandes (« groupe:id » pour lever une ambiguite), objet pour forcer taille/libelle, tableau = une rangee. */
export type Slot = string | SlotObject | readonly Slot[];

export interface SlotObject {
  /** Notre commande. */
  id?: string;
  /** Bouton d'OnlyOffice absent chez nous : libelle du bouton grise. */
  ph?: string;
  /** Avec `ph` : commande de chez nous qui prend la place du bouton grise quand elle existe (profil OnlyOffice seulement). */
  use?: string;
  label?: string;
  size?: 'large' | 'small';
  icon?: IconName;
  /** Garde l'intitule affiche dans une rangee (sinon icone seule). */
  caption?: boolean;
}

export interface OoGroupSpec {
  id: string;
  slots: readonly Slot[];
}

/** Titres francais des groupes decrits (sections du panneau Parametres, infobulles). */
export const GROUP_LABELS: Readonly<Record<string, string>> = {
  clip: 'Presse-papiers', font: 'Police', para: 'Paragraphe', styles: 'Styles', edit: 'Édition', pages: 'Pages', tables: 'Tableau', illus: 'Illustrations',
  links: 'Liens', hf: 'En-tête et pied de page', text: 'Texte', symbols: 'Symboles', page: 'Mise en page', indent: 'Retrait et espacement', arrange: 'Organiser',
  bg: 'Arrière-plan', toc: 'Table des matières', notes: 'Notes', caption: 'Légendes', comments: 'Commentaires', track: 'Suivi des modifications',
  changes: 'Modifications', compare: 'Comparer', zoom: 'Zoom', show: 'Afficher', align: 'Alignement', number: 'Nombre', cells: 'Cellules', sum: 'Calcul',
  sort: 'Tri', fmt: 'Format', draw: 'Dessin', shapes: 'Formes', slides: 'Diapositives', ins: 'Insertion', gallery: 'Transitions', timing: 'Minutage',
};

export const MISSING_TIP = "Non disponible";

type Sized = Extract<RibbonControl, { size?: 'large' | 'small' }>;

function flatten(controls: readonly RibbonControl[]): RibbonControl[] {
  return controls.flatMap((c) => (c.kind === 'row' ? flatten(c.controls) : [c]));
}

/** Index de toutes nos commandes : par identifiant, et par « groupe:identifiant ». */
export function indexControls(tabs: readonly RibbonTab[]): Map<string, RibbonControl> {
  const map = new Map<string, RibbonControl>();
  for (const t of tabs) {
    for (const g of t.groups) {
      for (const c of flatten(g.controls)) {
        if (c.kind === 'separator') continue;
        if (!map.has(c.id)) map.set(c.id, c);
        map.set(`${g.id}:${c.id}`, c);
        map.set(`${t.id}.${g.id}:${c.id}`, c);
      }
    }
  }
  return map;
}

function withSize(c: RibbonControl, size: 'large' | 'small' | undefined, label: string | undefined, caption?: boolean): RibbonControl {
  let out: RibbonControl = c;
  if (label !== undefined && 'label' in c) out = { ...out, label } as RibbonControl;
  if (caption && 'label' in c) out = { ...out, caption: true } as RibbonControl;
  if (size && ['button', 'toggle', 'menu', 'split', 'color'].includes(c.kind)) {
    const sized = { ...out } as Sized;
    if (size === 'large') sized.size = 'large';
    else delete sized.size;
    out = sized as RibbonControl;
  }
  return out;
}

function placeholder(o: SlotObject, key: string): ButtonControl {
  const label = o.ph ?? '';
  return {
    kind: 'button', id: `oo-missing-${key}`, label, icon: o.icon ?? 'document', disabled: true, caption: o.caption, size: o.size === 'small' ? undefined : o.size ?? 'large',
    tooltip: { title: label || o.icon || 'OnlyOffice', description: MISSING_TIP }, onClick: () => undefined,
  };
}

/** Construit les groupes d'un onglet. `used` recueille les commandes placees. */
export function buildGroups(spec: readonly OoGroupSpec[], index: ReadonlyMap<string, RibbonControl>, used: Set<RibbonControl>, tabId: string): RibbonGroup[] {
  let n = 0;
  const one = (s: Slot): RibbonControl | null => {
    if (Array.isArray(s)) {
      const controls = (s as readonly Slot[]).map(one).filter((c): c is RibbonControl => c !== null);
      return controls.length ? { kind: 'row', id: `oo-row-${tabId}-${n++}`, controls } : null;
    }
    const o: SlotObject = typeof s === 'string' ? { id: s } : (s as SlotObject);
    const real = o.use ? index.get(o.use) : undefined;
    if (o.ph !== undefined && !real) return placeholder(o, `${tabId}-${n++}`);
    if (real) {
      used.add(real);
      return withSize(real, o.size ?? 'large', o.label ?? o.ph);
    }
    const c = o.id ? index.get(o.id) : undefined;
    if (!c) return null;
    used.add(c);
    return withSize(c, o.size, o.label, o.caption);
  };
  return spec.map((g): RibbonGroup => ({ id: g.id, label: GROUP_LABELS[g.id] ?? g.id, controls: g.slots.map(one).filter((c): c is RibbonControl => c !== null) })).filter((g) => g.controls.length > 0);
}

/** Groupe « Autres » : commandes (et boites de dialogue des lanceurs) des groupes d'origine que la description ne place nulle part. */
export function leftovers(sources: readonly RibbonGroup[], used: ReadonlySet<RibbonControl>, tabId: string): RibbonGroup | null {
  const controls: RibbonControl[] = [];
  for (const g of sources) {
    for (const c of flatten(g.controls)) if (c.kind !== 'separator' && !used.has(c)) controls.push(c.kind === 'button' || c.kind === 'toggle' || c.kind === 'menu' || c.kind === 'split' || c.kind === 'color' ? withSize(c, 'small', undefined) : c);
    if (g.launcher) {
      const l = g.launcher;
      controls.push({ kind: 'button', id: `oo-launcher-${tabId}-${g.id}`, label: l.label, icon: 'more_horizontal', onClick: l.onClick, tooltip: { title: l.label } });
    }
  }
  return controls.length ? { id: 'oo-more', label: 'Plus', icon: 'more_horizontal', controls } : null;
}
