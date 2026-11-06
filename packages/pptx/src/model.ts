// CONTRAT du modele de presentation (editeur Presentation et module Publication).
// Positions et tailles en points, angles en degres, durees en millisecondes.
import type { XmlElement } from '@forgeoffice/opc';
import type { ChartModel } from './chart.ts';
import type {
  Color,
  Effects,
  Fill,
  Geometry,
  Hyperlink,
  Insets,
  Line,
  ListStyle,
  Paragraph,
  SchemeColorName,
  ShapeStyle,
  TextBody,
  Transform,
} from './dml.ts';
import type { SlideSize } from './units.ts';

export type * from './dml.ts';
export type { SlideSize } from './units.ts';

// ---- Conservation de ce que le modele ne represente pas ----

/** Relation d'une partie conservee : vers une autre partie conservee ou une cible externe. */
export interface PreservedRel {
  id: string;
  type: string;
  part?: PreservedPart;
  external?: string;
}

/** Partie du paquet conservee octet pour octet (SmartArt, objets OLE, encre, classeur d'un graphique...). */
export interface PreservedPart {
  /** Chemin d'origine (indicatif : le chemin ecrit peut changer). */
  path: string;
  contentType: string;
  bytes: Uint8Array;
  rels: PreservedRel[];
}

/** Fragment XML conserve avec les relations qu'il reference (attributs r:*). */
export interface RawXml {
  xml: XmlElement;
  rels: PreservedRel[];
}

/** XML d'origine reecrit tel quel tant que le modele correspondant n'a pas change (empreinte identique). */
export interface PreservedSource {
  xml: XmlElement;
  rels: PreservedRel[];
  fingerprint: string;
}

// ---- Theme ----

export interface ThemeColors {
  name: string;
  dk1: Color;
  lt1: Color;
  dk2: Color;
  lt2: Color;
  accent1: Color;
  accent2: Color;
  accent3: Color;
  accent4: Color;
  accent5: Color;
  accent6: Color;
  hlink: Color;
  folHlink: Color;
}

export type ThemeColorSlot = keyof Omit<ThemeColors, 'name'>;

export interface FontSet {
  latin: string;
  eastAsian: string;
  complex: string;
  /** Polices par ecriture (Jpan, Hang, Hans, Arab...). */
  scripts?: Record<string, string>;
}

export interface ThemeFonts {
  name: string;
  major: FontSet;
  minor: FontSet;
}

export interface FormatScheme {
  name: string;
  /** 3 remplissages (subtil, modere, intense) ; phClr = couleur de la reference. */
  fills: Fill[];
  lines: Line[];
  effects: Effects[];
  backgroundFills: Fill[];
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  formatScheme: FormatScheme;
  /** Polices de repli quand une police du theme manque (« Aptos » -> Segoe UI, Calibri...). */
  fontFallbacks?: Record<string, string[]>;
}

/** Correspondance des couleurs logiques (bg1, tx1...) vers les couleurs du theme. */
export type ColorMap = Record<'bg1' | 'tx1' | 'bg2' | 'tx2' | 'accent1' | 'accent2' | 'accent3' | 'accent4' | 'accent5' | 'accent6' | 'hlink' | 'folHlink', SchemeColorName>;

// ---- Formes ----

export type PlaceholderType =
  | 'title'
  | 'body'
  | 'ctrTitle'
  | 'subTitle'
  | 'dt'
  | 'sldNum'
  | 'ftr'
  | 'hdr'
  | 'obj'
  | 'chart'
  | 'tbl'
  | 'clipArt'
  | 'dgm'
  | 'media'
  | 'sldImg'
  | 'pic';

export interface Placeholder {
  type: PlaceholderType;
  index?: number;
  orientation?: 'horz' | 'vert';
  size?: 'full' | 'half' | 'quarter';
  hasCustomPrompt?: boolean;
}

export interface ShapeBase {
  /** Identifiant unique dans la diapositive (cNvPr id). */
  id: number;
  name: string;
  /** Texte de remplacement (accessibilite). */
  description?: string;
  title?: string;
  hidden?: boolean;
  /** Absent pour un espace reserve qui herite de sa position. */
  xfrm?: Transform;
  placeholder?: Placeholder;
  /** Verrous : noGrp, noRot, noMove, noResize, noTextEdit, noChangeAspect... */
  locks?: Record<string, boolean>;
  click?: Hyperlink;
  hover?: Hyperlink;
}

export interface AutoShape extends ShapeBase {
  kind: 'shape';
  geometry: Geometry;
  fill?: Fill;
  line?: Line;
  effects?: Effects;
  text?: TextBody;
  style?: ShapeStyle;
  textBox?: boolean;
}

export interface ImageEffects {
  /** Opacite en %. */
  alpha?: number;
  grayscale?: boolean;
  /** Luminosite et contraste en % (-100..100). */
  brightness?: number;
  contrast?: number;
  duotone?: [Color, Color];
  /** Autres effets d'image (a:blip) conserves. */
  extra?: XmlElement[];
}

export interface Picture extends ShapeBase {
  kind: 'picture';
  mediaId: string;
  /** Version vectorielle SVG (Office 2019+), l'image matricielle restant le repli. */
  svgMediaId?: string;
  /** Recadrage en % depuis chaque bord. */
  crop?: Insets;
  fillMode: 'stretch' | 'tile';
  geometry: Geometry;
  line?: Line;
  effects?: Effects;
  imageEffects?: ImageEffects;
  style?: ShapeStyle;
}

export interface MediaShape extends ShapeBase {
  kind: 'media';
  mediaType: 'video' | 'audio';
  /** Media incorpore. */
  mediaId?: string;
  /** Media lie (URL ou chemin externe). */
  link?: string;
  /** Image d'affiche. */
  posterMediaId?: string;
  geometry: Geometry;
  line?: Line;
  effects?: Effects;
  /** Decoupage en ms. */
  trim?: { start?: number; end?: number };
  fadeIn?: number;
  fadeOut?: number;
}

export interface TableBorders {
  left?: Line;
  right?: Line;
  top?: Line;
  bottom?: Line;
  diagonalDown?: Line;
  diagonalUp?: Line;
}

export interface TableCell {
  text: TextBody;
  gridSpan?: number;
  rowSpan?: number;
  /** Cellule couverte par une fusion horizontale / verticale. */
  hMerge?: boolean;
  vMerge?: boolean;
  fill?: Fill;
  borders?: TableBorders;
  margins?: Partial<Insets>;
  anchor?: 't' | 'ctr' | 'b';
  anchorCenter?: boolean;
  vertical?: string;
}

export interface TableRow {
  height: number;
  cells: TableCell[];
}

export interface Table {
  /** Largeurs de colonnes en points. */
  columns: number[];
  rows: TableRow[];
  /** GUID du style de tableau ({5C22544A-...} = Style moyen 2 - Accentuation 1). */
  styleId?: string;
  firstRow?: boolean;
  firstCol?: boolean;
  lastRow?: boolean;
  lastCol?: boolean;
  bandRow?: boolean;
  bandCol?: boolean;
  rtl?: boolean;
  fill?: Fill;
  effects?: Effects;
}

export interface TableShape extends ShapeBase {
  kind: 'table';
  table: Table;
}

export interface ChartShape extends ShapeBase {
  kind: 'chart';
  chart: ChartModel;
  /** Graphique d'origine (couleurs fines, classeur incorpore) reecrit tant que `chart` n'a pas change. */
  source?: PreservedSource;
}

export interface GroupShape extends ShapeBase {
  kind: 'group';
  children: Shape[];
  /** Repere interne du groupe (chOff / chExt). */
  childOffset: { x: number; y: number };
  childExtent: { width: number; height: number };
  fill?: Fill;
  effects?: Effects;
}

export interface ConnectionPoint {
  shapeId: number;
  /** Indice du site de connexion de la forme. */
  site: number;
}

export interface Connector extends ShapeBase {
  kind: 'connector';
  geometry: Geometry;
  line?: Line;
  effects?: Effects;
  style?: ShapeStyle;
  start?: ConnectionPoint;
  end?: ConnectionPoint;
}

/** Noeud de texte d'un SmartArt (graphe de donnees dgm). */
export interface SmartArtNode {
  /** modelId du point dgm:pt. */
  id: string;
  /** Texte, paragraphes separes par 
. */
  text: string;
  /** Noeud parent (absent pour les noeuds de premier niveau). */
  parentId?: string;
}

export interface SmartArtShape extends ShapeBase {
  kind: 'smartart';
  /** Noeuds de texte editables (voir setSmartArtNodeText) ; la mise en page reste celle du rendu de repli. */
  nodes?: SmartArtNode[];
  /** Rendu de repli (formes du dessin precalcule par Office). */
  fallback: Shape[];
  /** graphicFrame et parties dgm conserves. */
  raw: RawXml;
}

/** Element non modelise (objet OLE, encre, equation...) conserve tel quel, avec son rendu de repli. */
export interface RawShape extends ShapeBase {
  kind: 'raw';
  raw: RawXml;
  fallback: Shape[];
}

export type Shape = AutoShape | Picture | MediaShape | TableShape | ChartShape | GroupShape | Connector | SmartArtShape | RawShape;
export type ShapeKind = Shape['kind'];

// ---- Diapositives ----

export type Background =
  | { type: 'fill'; fill: Fill; shadeToTitle?: boolean }
  /** Reference a un remplissage d'arriere-plan du theme (1001..1003). */
  | { type: 'ref'; index: number; color: Color };

export interface TransitionSound {
  name: string;
  mediaId: string;
  loop?: boolean;
}

export interface Transition {
  /** fade, push, wipe, split, cover, pull, randomBar, cut, zoom, dissolve, vortex, morph, prstTrans... */
  type: string;
  /** Attributs de l'effet (dir, orient, thruBlk, prst, invX...). */
  params?: Record<string, string>;
  /** Duree en ms. */
  duration?: number;
  speed?: 'slow' | 'med' | 'fast';
  advanceOnClick?: boolean;
  /** Passage automatique apres ce delai (ms). */
  advanceAfter?: number;
  sound?: TransitionSound;
  stopSound?: boolean;
}

export type AnimationClass = 'entr' | 'emph' | 'exit' | 'path' | 'verb' | 'mediacall';
export type AnimationTrigger = 'onClick' | 'withPrevious' | 'afterPrevious';

export interface Animation {
  shapeId: number;
  class: AnimationClass;
  /** Identifiant de l'effet predefini PowerPoint (10 = Fondu, 2 = Balayage entrant...). */
  presetId: number;
  presetSubtype?: number;
  trigger: AnimationTrigger;
  delay: number;
  duration: number;
  /** Trajectoire (classe path) : syntaxe PowerPoint « M 0 0 L 0.25 0.1 E », coordonnees relatives a la diapositive. */
  path?: string;
  repeat?: number | 'indefinite';
  autoReverse?: boolean;
  /** Animation par paragraphe (plage de paragraphes). */
  paragraphs?: { start: number; end: number };
  /** Declencheur interactif : clic sur cette forme. */
  triggerShapeId?: number;
}

export interface Comment {
  author: string;
  initials?: string;
  /** Date ISO 8601. */
  date?: string;
  text: string;
  /** Position de l'ancre en points. */
  position?: { x: number; y: number };
  replies?: Comment[];
  resolved?: boolean;
}

export interface Slide {
  /** Identifiant stable (p:sldId id, 256 et plus). */
  id: number;
  layoutId: string;
  name?: string;
  background?: Background;
  shapes: Shape[];
  /** Notes du presentateur. */
  notes?: Paragraph[];
  transition?: Transition;
  animations: Animation[];
  /** Minutage d'origine (p:timing) reecrit tant que `animations` n'a pas change. */
  timing?: PreservedSource;
  hidden?: boolean;
  comments: Comment[];
  showMasterShapes?: boolean;
  colorMapOverride?: ColorMap;
}

export type LayoutType =
  | 'title'
  | 'obj'
  | 'secHead'
  | 'twoObj'
  | 'twoTxTwoObj'
  | 'titleOnly'
  | 'blank'
  | 'objTx'
  | 'picTx'
  | 'vertTx'
  | 'vertTitleAndTx'
  | 'cust'
  | 'tx'
  | 'twoColTx'
  | 'tbl'
  | 'chart'
  | 'txAndChart'
  | 'chartAndTx'
  | 'dgm'
  | 'clipArtAndTx'
  | 'txAndObj'
  | 'objOnly'
  | 'objOverTx'
  | 'txOverObj'
  | 'fourObj'
  | 'mediaAndTx'
  | 'txAndMedia'
  | 'objAndTwoObj'
  | 'twoObjAndObj'
  | 'twoObjAndTx'
  | 'twoObjOverTx'
  | 'txAndTwoObj'
  | 'txAndClipArt'
  | 'clipArtAndVertTx'
  | 'vertTitleAndTxOverChart'
  | 'objAndTx'
  | 'titleAndTx';

export interface Layout {
  id: string;
  name: string;
  type: LayoutType;
  background?: Background;
  shapes: Shape[];
  showMasterShapes?: boolean;
  colorMapOverride?: ColorMap;
  preserve?: boolean;
  userDrawn?: boolean;
  transition?: Transition;
}

export interface MasterTextStyles {
  title: ListStyle;
  body: ListStyle;
  other: ListStyle;
}

export interface Master {
  id: string;
  name?: string;
  theme: Theme;
  background: Background;
  shapes: Shape[];
  colorMap: ColorMap;
  textStyles: MasterTextStyles;
  layouts: Layout[];
  preserve?: boolean;
  transition?: Transition;
  /** Affichage par defaut de l'en-tete et du pied (p:hf). */
  headerFooter?: { slideNumber?: boolean; header?: boolean; footer?: boolean; date?: boolean };
}

// ---- Document ----

export interface DocProperties {
  title?: string;
  subject?: string;
  creator?: string;
  keywords?: string;
  description?: string;
  lastModifiedBy?: string;
  revision?: string;
  created?: string;
  modified?: string;
  category?: string;
  contentStatus?: string;
  language?: string;
  company?: string;
  manager?: string;
  application?: string;
  appVersion?: string;
  /** Proprietes personnalisees (texte). */
  custom?: Record<string, string>;
}

export interface MediaItem {
  id: string;
  contentType: string;
  /** Extension sans point (png, jpeg, mp4...). */
  extension: string;
  bytes: Uint8Array;
  /** Rendu affichable (SVG) d'un metafichier EMF / WMF que les navigateurs ne savent pas afficher ; jamais ecrit. */
  preview?: { contentType: string; bytes: Uint8Array };
}

export interface Section {
  name: string;
  /** GUID de section ({...}). */
  id: string;
  slideIds: number[];
}

/** Format d'enregistrement OOXML : presentation, avec macros, modele, diaporama. */
export type DeckFormat = 'pptx' | 'pptm' | 'potx' | 'potm' | 'ppsx' | 'ppsm';

export interface Deck {
  properties: DocProperties;
  size: SlideSize;
  notesSize: SlideSize;
  /** Masques (chacun porte son theme et ses dispositions). Le theme principal est celui du premier masque. */
  masters: Master[];
  slides: Slide[];
  media: Record<string, MediaItem>;
  /** Style de texte par defaut des formes hors espaces reserves. */
  defaultTextStyle: ListStyle;
  sections: Section[];
  format: DeckFormat;
  /** Projet VBA (vbaProject.bin) conserve pour .pptm/.potm/.ppsm. */
  macros?: Uint8Array;
  firstSlideNumber?: number;
  rtl?: boolean;
  /** Parties de reglages conservees (presProps, viewProps, tableStyles). */
  preserved: {
    presProps?: XmlElement;
    viewProps?: XmlElement;
    tableStyles?: XmlElement;
  };
}

/** Theme principal (premier masque). */
export function deckTheme(deck: Deck): Theme {
  const master = deck.masters[0];
  if (!master) throw new Error('Presentation sans masque');
  return master.theme;
}

/** Ou se trouve une disposition (masque + disposition) d'apres son identifiant. */
export function findLayout(deck: Deck, layoutId: string): { master: Master; layout: Layout } | undefined {
  for (const master of deck.masters) {
    const layout = master.layouts.find((l) => l.id === layoutId);
    if (layout) return { master, layout };
  }
  return undefined;
}
