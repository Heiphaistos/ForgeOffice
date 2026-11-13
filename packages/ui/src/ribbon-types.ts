// Schema declaratif du ruban : onglets -> groupes -> controles.
// Les modules decrivent leur ruban avec ces types ; le composant <Ribbon> fait le rendu,
// la reduction adaptative, les Info-touches et la recherche de commandes (collectCommands).
import type { CSSProperties, ReactNode } from 'react';
import type { IconName } from './icons/generated.ts';

/** Contenu d'une info-bulle riche : titre en gras, description, raccourci. */
export interface TooltipContent {
  title: string;
  description?: string;
  shortcut?: string;
}

/** Element de menu (menus deroulants, boutons partages, menus contextuels). */
export interface MenuItem {
  id: string;
  /** 'item' par defaut. 'header' = intitule de section, 'separator' = trait. */
  kind?: 'item' | 'header' | 'separator';
  label?: string;
  description?: string;
  icon?: IconName;
  shortcut?: string;
  disabled?: boolean;
  /** Coche (true/false) ; undefined = pas de coche. */
  checked?: boolean;
  /** Sous-menu. */
  items?: readonly MenuItem[];
  onClick?: () => void;
  /** Contenu personnalise a la place de l'icone (ex. pastille de couleur). */
  adornment?: ReactNode;
  /** Lettre d'acces soulignee dans le libelle (menus LibreOffice / OpenOffice). */
  mnemonic?: string;
  /** Info-bulle (ex. commande de la suite imitee sans equivalent). */
  tooltip?: string;
  /** Profil OnlyOffice : l'entree est une case d'une grille (bibliotheque de puces) ; le libelle sert d'infobulle. */
  cell?: boolean;
  /** Profil OnlyOffice : petite case de 24 px d'une grille de formes (avec `cell`) ; `adornment` est le glyphe. */
  mini?: boolean;
  /** Profil OnlyOffice : grande case (bibliotheque de numerotations) ; `adornment` est son apercu. */
  tile?: boolean;
}

interface ControlBase {
  id: string;
  label: string;
  icon?: IconName;
  tooltip?: TooltipContent;
  disabled?: boolean;
  hidden?: boolean;
  /** Info-touche imposee (1 ou 2 lettres). Sinon attribuee automatiquement. */
  keytip?: string;
  /** Mots supplementaires pour la recherche (Alt+Q). */
  keywords?: readonly string[];
  /** Profil OnlyOffice : l'intitule reste affiche meme dans une rangee ou un groupe replie (champ ou bouton). */
  caption?: boolean;
}

/** large = icone 32 + libelle dessous ; small = icone 16 (+ libelle selon la place). */
export type ControlSize = 'large' | 'small';

export interface ButtonControl extends ControlBase {
  kind: 'button';
  size?: ControlSize;
  /** Masque le libelle en taille small (icone seule). */
  iconOnly?: boolean;
  onClick: () => void;
}

export interface SplitButtonControl extends ControlBase {
  kind: 'split';
  size?: ControlSize;
  iconOnly?: boolean;
  onClick: () => void;
  items: readonly MenuItem[];
}

export interface ToggleControl extends ControlBase {
  kind: 'toggle';
  size?: ControlSize;
  iconOnly?: boolean;
  pressed: boolean;
  onToggle: (pressed: boolean) => void;
}

export interface MenuControl extends ControlBase {
  kind: 'menu';
  size?: ControlSize;
  iconOnly?: boolean;
  items: readonly MenuItem[];
}

export interface ComboOption {
  value: string;
  label?: string;
  /** Style d'apercu de l'option (ex. police). */
  style?: CSSProperties;
  group?: string;
}

export interface ComboControl extends ControlBase {
  kind: 'combo';
  value: string;
  options: readonly ComboOption[];
  /** Saisie libre autorisee (police, taille). */
  editable?: boolean;
  /** Largeur en pixels du champ. */
  width?: number;
  /** Valide une saisie libre : renvoie la valeur normalisee ou null si refusee. */
  validate?: (text: string) => string | null;
  onChange: (value: string) => void;
}

/** Selecteur de police complet (sections Theme / Recentes / Toutes, apercu dans la police). */
export interface FontControl extends ControlBase {
  kind: 'font';
  value: string;
  width?: number;
  onChange: (font: string) => void;
}

export interface GalleryItem {
  id: string;
  label: string;
  /** Texte d'apercu (ex. « AaBbCcDd ») affiche avec `style`. */
  sample?: string;
  style?: CSSProperties;
  /** Rendu entierement personnalise de la vignette. */
  render?: () => ReactNode;
  icon?: IconName;
}

export interface GalleryControl extends ControlBase {
  kind: 'gallery';
  items: readonly GalleryItem[];
  selectedId?: string | null;
  /** Largeur d'une vignette (defaut 72). */
  itemWidth?: number;
  /** Nombre de colonnes dans la galerie depliee (defaut 6). */
  columns?: number;
  onSelect: (id: string) => void;
  /** Apercu en direct au survol. */
  onPreview?: (id: string) => void;
  onPreviewEnd?: () => void;
  /** Commandes sous la galerie depliee (ex. « Creer un style »). */
  footer?: readonly MenuItem[];
}

export interface ColorControl extends ControlBase {
  kind: 'color';
  size?: ControlSize;
  iconOnly?: boolean;
  /** Couleur courante appliquee par le bouton principal ; null = aucune / automatique. */
  value: string | null;
  onChange: (color: string | null) => void;
  /** Libelle de l'entree « vide » : Automatique (texte) ou Aucune couleur (remplissage). */
  emptyMode?: 'automatic' | 'none';
  /** Couleurs du theme du document (10) ; defaut : theme Office. */
  themeColors?: readonly string[];
  /** 'highlight' : profil OnlyOffice = grille de 16 couleurs de surlignage + « Aucun remplissage ». */
  palette?: 'highlight';
}

export interface CheckboxControl extends ControlBase {
  kind: 'checkbox';
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export interface NumberControl extends ControlBase {
  kind: 'number';
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Unite affichee apres la valeur (« cm », « pt », « % »). */
  unit?: string;
  width?: number;
  onChange: (value: number) => void;
}

export interface SeparatorControl {
  kind: 'separator';
  id: string;
  hidden?: boolean;
}

/** Plusieurs petits controles colles (ex. Gras/Italique/Souligne) sur une ligne. */
export interface RowControl {
  kind: 'row';
  id: string;
  controls: readonly RibbonControl[];
  hidden?: boolean;
}

/** Rendu libre (dernier recours). */
export interface CustomControl extends ControlBase {
  kind: 'custom';
  render: () => ReactNode;
  /** Commande equivalente, exposee aux menus des dispositions LibreOffice / OpenOffice (ex. ouvrir la boite). */
  run?: () => void;
  /** Commandes supplementaires (adresse `groupe.controle#id`) exposees aux dispositions LibreOffice / OpenOffice, sans rendu propre. */
  commands?: readonly MenuItem[];
  /** Atteint une cellule / plage (« B3 », « Feuil2!A1 ») : alimente le panneau Navigateur des dispositions LibreOffice. */
  go?: (ref: string) => void;
}

export type RibbonControl =
  | ButtonControl
  | SplitButtonControl
  | ToggleControl
  | MenuControl
  | ComboControl
  | FontControl
  | GalleryControl
  | ColorControl
  | CheckboxControl
  | NumberControl
  | SeparatorControl
  | RowControl
  | CustomControl;

export interface RibbonGroup {
  id: string;
  label: string;
  /** Icone affichee quand le groupe est replie en un seul bouton. */
  icon?: IconName;
  controls: readonly RibbonControl[];
  /** Lanceur de boite de dialogue (petite fleche en bas a droite du groupe). */
  launcher?: { label: string; onClick: () => void };
  keytip?: string;
  hidden?: boolean;
}

export interface RibbonTab {
  id: string;
  label: string;
  groups: readonly RibbonGroup[];
  keytip?: string;
  hidden?: boolean;
  /** Onglet contextuel (ex. « Création de tableau ») : nom de l'ensemble + couleur. */
  contextual?: { set: string; color: string };
}

/** Niveau de reduction d'un groupe : 0 normal, 1 boutons moyens, 2 icones seules, 3 replie. */
export type GroupLevel = 0 | 1 | 2 | 3;

export type RibbonLayout = 'classic' | 'simplified';
