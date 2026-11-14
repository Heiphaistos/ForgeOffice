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
  /** Grand bouton sans intitule (icone seule, comme les vues du Tableur) ; l'infobulle garde le nom. */
  iconOnly?: boolean;
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

/** Retours a la ligne des intitules de grands boutons, releves sur OnlyOffice 10.0 (l'application coupe a la main, pas par largeur). « | » = saut. */
const BREAKS = ['Tableau croisé|dynamique', 'Graphique|recommandé', 'Graphique|sparkline', 'Zone de|texte', 'En-tête/Pied|de page', 'En-tête et|pied de page', 'Zone|d’impression', "Zone|d'impression",
  'Sauts de|page', 'Mettre à|l’échelle', "Mettre à|l'échelle", 'Titres à|imprimer', 'Feuille de|droite à gauche', "Déplacer vers|l'avant", "Envoyer vers|l'arrière", 'Combiner les|formes',
  'Somme|automatique', 'Récemment|utilisés', 'Texte et|données', 'Date et|heure', 'Recherche et|référence', 'Maths et|trigonométrie', 'Plus de|fonctions', 'Plages|nommées', 'Fenêtre|Espions',
  'Obtenir les|données', 'Liens|externes', 'Tri|personnalisé', 'Texte en|colonnes', 'Supprimer les|doublons', 'Validation des|données', 'Valeur|cible', 'Ajouter un|commentaire',
  'Protéger le|classeur', 'Protéger la|feuille de calcul', 'Protéger le|document', 'Numéro de|page', 'Text|Art', 'Texte à|partir d’un fichier', "Texte à|partir d'un fichier", 'Contrôles de|contenu',
  'Numéros de|ligne', 'Coupure de|mots', 'Table des|matières', 'Note de|bas de page', 'Suivi des|modifications', 'Mode|d’affichage', "Mode|d'affichage", 'Thème|d’interface', "Thème|d'interface",
  'Basculer du|fond du document', 'Gestionnaire de|Plugins', 'Plugins|d’arrière-plan', 'Photo|Editor', 'Code en|surbrillance', 'Chat|IA', 'Ajouter une|diapositive', 'Taille de|la diapositive',
  'Numéro de|diapositive', 'Volet|Animation', 'Ajouter une|animation', 'Date &|heure', 'Page|vide'];
const BREAK_MAP = new Map(BREAKS.map((b) => [b.replace('|', ' ').toLowerCase(), b.replace('|', '\n')]));

function withBreak(c: RibbonControl): RibbonControl {
  if (!('label' in c) || (c as Sized).size !== 'large') return c;
  const hit = BREAK_MAP.get(c.label.replace(/\s+/g, ' ').toLowerCase());
  if (!hit) return c;
  const tip = (c as { tooltip?: unknown }).tooltip ?? { title: c.label };
  return { ...c, label: hit, tooltip: tip } as RibbonControl;
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
  return withBreak(out);
}

function placeholder(o: SlotObject, key: string): RibbonControl {
  const label = o.iconOnly ? '' : o.ph ?? '';
  return withBreak({
    kind: 'button', id: `oo-missing-${key}`, label, icon: o.icon ?? 'document', disabled: true, caption: o.caption, iconOnly: o.iconOnly, size: o.size === 'small' ? undefined : o.size ?? 'large',
    tooltip: { title: o.ph || o.icon || 'OnlyOffice', description: MISSING_TIP }, onClick: () => undefined,
  });
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
      return withSize(real.kind === 'separator' ? real : { ...real, hidden: false }, o.size ?? 'large', o.label ?? o.ph);
    }
    const c = o.id ? index.get(o.id) : undefined;
    if (!c) return null;
    used.add(c);
    const out = withSize(c, o.size, o.label, o.caption);
    // Grand bouton sans intitule : le moteur de ruban n'honore `iconOnly` qu'en petit, on vide donc l'intitule et on garde le nom en infobulle.
    return o.iconOnly && 'label' in out ? ({ ...out, label: '', tooltip: (out as { tooltip?: unknown }).tooltip ?? { title: (out as { label: string }).label } } as RibbonControl) : out;
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
