// Modele de document Texte : CONTRAT partage entre les lecteurs/ecrivains de formats (.docx, .rtf, .odt,
// .html, .md, .txt, .doc) et le futur editeur Texte.
//
// Principes :
// - Toutes les longueurs sont en points (pt, 1/72 de pouce). Les conversions OOXML (twips, demi-points,
//   huitiemes de point, EMU) sont faites par les lecteurs/ecrivains (voir units.ts).
// - Les couleurs sont des chaines hexadecimales « RRGGBB » en majuscules, ou « auto ».
// - Les proprietes absentes (undefined) sont heritees : style de paragraphe -> style lie / basedOn ->
//   valeurs par defaut du document (docDefaults). Voir resolve.ts pour le calcul des valeurs effectives.
// - Ce que le modele ne represente pas finement est conserve tel quel (XML brut, parties inconnues) pour
//   que l'aller-retour lecture -> ecriture ne perde rien.
import type { XmlElement } from '@forgeoffice/opc';

/** Longueur en points typographiques. */
export type Pt = number;

/** « RRGGBB » ou « auto ». */
export type Hex = string;

// ---------------------------------------------------------------------------------------------------
// Proprietes du document, theme, reglages
// ---------------------------------------------------------------------------------------------------

export interface DocumentProperties {
  title?: string;
  subject?: string;
  /** Auteur. */
  creator?: string;
  keywords?: string;
  description?: string;
  category?: string;
  contentStatus?: string;
  lastModifiedBy?: string;
  revision?: number;
  /** Dates ISO 8601. */
  created?: string;
  modified?: string;
  lastPrinted?: string;
  language?: string;
  company?: string;
  manager?: string;
  /** Application d'origine (« ForgeOffice Texte », « Microsoft Office Word »...). */
  application?: string;
  template?: string;
  /** Statistiques enregistrees par l'application d'origine (docProps/app.xml). */
  pages?: number;
  words?: number;
  characters?: number;
  /** Proprietes personnalisees (docProps/custom.xml), valeurs converties en texte. */
  custom: Record<string, string>;
}

export type ThemeColorName =
  | 'dk1' | 'lt1' | 'dk2' | 'lt2'
  | 'accent1' | 'accent2' | 'accent3' | 'accent4' | 'accent5' | 'accent6'
  | 'hlink' | 'folHlink';

/** Noms de couleurs de theme acceptes dans les proprietes de texte (w:themeColor). */
export type ThemeColorRef =
  | ThemeColorName
  | 'text1' | 'text2' | 'background1' | 'background2'
  | 'hyperlink' | 'followedHyperlink' | 'dark1' | 'dark2' | 'light1' | 'light2';

export interface Theme {
  name: string;
  /** Police des titres (« Aptos Display »). */
  majorFont: string;
  /** Police du corps (« Aptos »). */
  minorFont: string;
  majorEastAsia?: string;
  minorEastAsia?: string;
  colors: Record<ThemeColorName, Hex>;
  /** XML d'origine du theme, reecrit tel quel pour la fidelite (null = theme genere). */
  rawXml: string | null;
}

export interface DocumentSettings {
  defaultTabStop: Pt;
  evenAndOddHeaders: boolean;
  mirrorMargins: boolean;
  /** Suivi des modifications actif. */
  trackRevisions: boolean;
  autoHyphenation: boolean;
  /** Pourcentage de zoom enregistre. */
  zoom: number;
  /** Demande la mise a jour des champs a l'ouverture (table des matieres...). */
  updateFields: boolean;
  /** Mode de compatibilite Word (15 = Word 2013 et suivants). */
  compatibilityMode: number;
  /** Langue par defaut du texte (« fr-FR »). */
  language?: string;
  /** Protection du document (lecture seule, commentaires...) conservee telle quelle. */
  protection?: { kind: string; enforced: boolean };
}

// ---------------------------------------------------------------------------------------------------
// Proprietes de caracteres et de paragraphes
// ---------------------------------------------------------------------------------------------------

export interface Color {
  /** « RRGGBB » ou « auto ». */
  rgb: Hex;
  theme?: ThemeColorRef;
  /** Eclaircissement / assombrissement 0..255 (w:themeTint / w:themeShade). */
  tint?: number;
  shade?: number;
}

export type UnderlineType =
  | 'single' | 'words' | 'double' | 'thick' | 'dotted' | 'dottedHeavy' | 'dash' | 'dashedHeavy'
  | 'dashLong' | 'dashLongHeavy' | 'dotDash' | 'dashDotHeavy' | 'dotDotDash' | 'dashDotDotHeavy'
  | 'wave' | 'wavyHeavy' | 'wavyDouble' | 'none';

/** Couleurs de surlignage Word. */
export type HighlightColor =
  | 'yellow' | 'green' | 'cyan' | 'magenta' | 'blue' | 'red' | 'darkBlue' | 'darkCyan' | 'darkGreen'
  | 'darkMagenta' | 'darkRed' | 'darkYellow' | 'darkGray' | 'lightGray' | 'black' | 'white' | 'none';

export interface Shading {
  /** Couleur de fond « RRGGBB » ou « auto ». */
  fill: Hex;
  /** Motif (« clear », « solid », « pct10 »...). */
  pattern?: string;
  /** Couleur du motif. */
  color?: Hex;
  themeFill?: ThemeColorRef;
}

export type BorderStyle =
  | 'none' | 'single' | 'thick' | 'double' | 'dotted' | 'dashed' | 'dotDash' | 'dotDotDash' | 'triple'
  | 'wave' | 'doubleWave' | 'threeDEmboss' | 'threeDEngrave' | 'outset' | 'inset'
  | 'thinThickSmallGap' | 'thickThinSmallGap' | 'thinThickMediumGap' | 'thickThinMediumGap';

export interface Border {
  style: BorderStyle;
  /** Epaisseur du trait. */
  width: Pt;
  color: Hex;
  /** Distance au texte. */
  space: Pt;
  themeColor?: ThemeColorRef;
}

export interface RunProps {
  bold?: boolean;
  italic?: boolean;
  /** Gras / italique des ecritures complexes (arabe, hebreu...). */
  boldCs?: boolean;
  italicCs?: boolean;
  underline?: UnderlineType;
  underlineColor?: Hex;
  strike?: boolean;
  doubleStrike?: boolean;
  /** Tout en majuscules (affichage). */
  caps?: boolean;
  smallCaps?: boolean;
  /** Police latine (ascii / hAnsi). */
  font?: string;
  fontEastAsia?: string;
  fontComplex?: string;
  /** Police du theme (titres = major, corps = minor), prioritaire sur `font` si definie. */
  fontTheme?: 'major' | 'minor';
  /** Taille en points (11, 10.5...). */
  size?: Pt;
  sizeComplex?: Pt;
  color?: Color;
  highlight?: HighlightColor;
  shading?: Shading;
  vertAlign?: 'baseline' | 'superscript' | 'subscript';
  /** Espacement des caracteres (positif = etendu, negatif = condense). */
  spacing?: Pt;
  /** Echelle horizontale en pourcentage (100 = normale). */
  scale?: number;
  /** Crenage a partir de cette taille. */
  kerning?: Pt;
  /** Position verticale (positif = eleve). */
  position?: Pt;
  /** Langue BCP 47 (« fr-FR »). */
  lang?: string;
  langEastAsia?: string;
  langComplex?: string;
  /** Texte masque. */
  hidden?: boolean;
  emboss?: boolean;
  imprint?: boolean;
  outline?: boolean;
  shadow?: boolean;
  rtl?: boolean;
  /** Ne pas verifier l'orthographe. */
  noProof?: boolean;
  border?: Border;
  /** Effets de texte non modelises (w14:glow...) conserves en XML. */
  extra?: XmlElement[];
}

export type Alignment = 'left' | 'center' | 'right' | 'justify' | 'distribute';

export interface TabStop {
  position: Pt;
  align: 'left' | 'center' | 'right' | 'decimal' | 'bar' | 'clear';
  leader?: 'none' | 'dot' | 'hyphen' | 'underscore' | 'heavy' | 'middleDot';
}

export interface LineSpacing {
  /** auto : `value` est un multiple (1, 1.08, 1.5, 2) ; exact / atLeast : `value` en points. */
  rule: 'auto' | 'exact' | 'atLeast';
  value: number;
}

export interface ParagraphBorders {
  top?: Border;
  bottom?: Border;
  left?: Border;
  right?: Border;
  /** Entre paragraphes ayant les memes bordures. */
  between?: Border;
  bar?: Border;
}

export interface ParagraphProps {
  alignment?: Alignment;
  indentLeft?: Pt;
  indentRight?: Pt;
  /** Retrait de premiere ligne : positif = alinea, negatif = suspendu. */
  indentFirstLine?: Pt;
  spacingBefore?: Pt;
  spacingAfter?: Pt;
  beforeAutospacing?: boolean;
  afterAutospacing?: boolean;
  lineSpacing?: LineSpacing;
  /** Ne pas ajouter d'espace entre paragraphes du meme style. */
  contextualSpacing?: boolean;
  tabs?: TabStop[];
  borders?: ParagraphBorders;
  shading?: Shading;
  /** Liste : instance de numerotation et niveau 0..8. numId 0 = retire la liste heritee. */
  numbering?: { numId: number; level: number };
  /** Niveau hierarchique 0..8 (Titre 1 = 0) ; 9 = corps de texte. */
  outlineLevel?: number;
  keepNext?: boolean;
  keepLines?: boolean;
  pageBreakBefore?: boolean;
  /** Eviter veuves et orphelines. */
  widowControl?: boolean;
  suppressLineNumbers?: boolean;
  suppressAutoHyphens?: boolean;
  /** Paragraphe de droite a gauche. */
  bidi?: boolean;
  textDirection?: string;
  /** Lettrine (drop cap) : nombre de lignes et type. */
  dropCap?: { kind: 'drop' | 'margin'; lines: number };
  /** Proprietes non modelisees (cadre w:framePr...) conservees en XML. */
  extra?: XmlElement[];
}

// ---------------------------------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------------------------------

export type StyleType = 'paragraph' | 'character' | 'table' | 'numbering';

export type TableRegion =
  | 'wholeTable' | 'firstRow' | 'lastRow' | 'firstCol' | 'lastCol' | 'band1Vert' | 'band2Vert'
  | 'band1Horz' | 'band2Horz' | 'neCell' | 'nwCell' | 'seCell' | 'swCell';

export interface TableConditionalFormat {
  region: TableRegion;
  paragraph?: ParagraphProps;
  run?: RunProps;
  table?: TableProps;
  cell?: TableCellProps;
}

export interface Style {
  id: string;
  type: StyleType;
  /** Nom interne (« heading 1 », « Normal », « Mon style »). Voir styleDisplayName() pour le nom francais. */
  name: string;
  basedOn?: string;
  /** Style du paragraphe suivant (Entree a la fin d'un titre -> Normal). */
  next?: string;
  /** Style lie (paragraphe <-> caractere). */
  link?: string;
  /** Style par defaut de son type. */
  isDefault?: boolean;
  /** Style cree par l'utilisateur (non integre). */
  custom?: boolean;
  uiPriority?: number;
  hidden?: boolean;
  semiHidden?: boolean;
  unhideWhenUsed?: boolean;
  /** Affiche dans la galerie Styles du ruban. */
  quickFormat?: boolean;
  paragraph?: ParagraphProps;
  run?: RunProps;
  table?: TableProps;
  tableCell?: TableCellProps;
  tableConditional?: TableConditionalFormat[];
}

export interface StyleSheet {
  docDefaults: { run: RunProps; paragraph: ParagraphProps };
  styles: Style[];
  /** Liste des styles latents (w:latentStyles) conservee telle quelle. */
  latentStyles?: XmlElement;
}

// ---------------------------------------------------------------------------------------------------
// Numerotation (listes)
// ---------------------------------------------------------------------------------------------------

export type NumberFormat =
  | 'decimal' | 'decimalZero' | 'lowerLetter' | 'upperLetter' | 'lowerRoman' | 'upperRoman'
  | 'bullet' | 'ordinal' | 'cardinalText' | 'ordinalText' | 'decimalEnclosedCircle' | 'none';

export interface NumberingLevel {
  /** 0..8. */
  level: number;
  format: NumberFormat;
  /** Gabarit du texte : « %1. », « %1.%2. », « • ». */
  text: string;
  start: number;
  alignment: 'left' | 'center' | 'right';
  /** Separateur entre le numero et le texte. */
  suffix: 'tab' | 'space' | 'nothing';
  /** Recommence apres ce niveau (0 = jamais ; absent = apres tout niveau superieur). */
  restartAfter?: number;
  /** Numerotation legale (1.1.1 en chiffres arabes). */
  isLegal?: boolean;
  /** Style de paragraphe associe (« Titre 1 » dans une liste hierarchisee). */
  styleId?: string;
  paragraph?: ParagraphProps;
  run?: RunProps;
}

export interface AbstractNumbering {
  id: number;
  name?: string;
  multiLevelType?: 'singleLevel' | 'multilevel' | 'hybridMultilevel';
  levels: NumberingLevel[];
  styleLink?: string;
  numStyleLink?: string;
}

export interface NumberingOverride {
  level: number;
  /** Redemarrage de la numerotation a cette valeur. */
  startOverride?: number;
  /** Niveau completement redefini. */
  definition?: NumberingLevel;
}

export interface NumberingInstance {
  id: number;
  abstractId: number;
  overrides: NumberingOverride[];
}

export interface Numbering {
  abstracts: AbstractNumbering[];
  instances: NumberingInstance[];
}

// ---------------------------------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------------------------------

export interface PageMargins {
  top: Pt;
  right: Pt;
  bottom: Pt;
  left: Pt;
  header: Pt;
  footer: Pt;
  gutter: Pt;
}

export interface Columns {
  count: number;
  /** Espace entre colonnes egales. */
  space: Pt;
  equalWidth: boolean;
  /** Trait vertical entre les colonnes. */
  separator: boolean;
  /** Largeurs explicites quand equalWidth est faux. */
  widths?: { width: Pt; space: Pt }[];
}

/** Identifiants d'en-tetes/pieds (cles de Document.headersFooters) par type de page. */
export interface HeaderFooterRefs {
  default?: string;
  first?: string;
  even?: string;
}

export type SectionBreakType = 'nextPage' | 'continuous' | 'evenPage' | 'oddPage' | 'nextColumn';

export interface Section {
  pageWidth: Pt;
  pageHeight: Pt;
  orientation: 'portrait' | 'landscape';
  margins: PageMargins;
  columns: Columns;
  headers: HeaderFooterRefs;
  footers: HeaderFooterRefs;
  /** Premiere page differente. */
  titlePage: boolean;
  /** Type de saut qui commence cette section. */
  breakType: SectionBreakType;
  pageNumbering?: { start?: number; format?: NumberFormat; chapterStyle?: number };
  verticalAlign?: 'top' | 'center' | 'bottom' | 'both';
  lineNumbering?: { countBy: number; start: number; restart: 'newPage' | 'newSection' | 'continuous'; distance?: Pt };
  pageBorders?: ParagraphBorders & { offsetFrom?: 'page' | 'text' };
  /** Grille de document, notes de section... conservees en XML. */
  extra?: XmlElement[];
}

export interface HeaderFooter {
  id: string;
  kind: 'header' | 'footer';
  blocks: Block[];
}

// ---------------------------------------------------------------------------------------------------
// Corps : blocs
// ---------------------------------------------------------------------------------------------------

/** Suivi des modifications : insertion / suppression / deplacement. */
export interface Revision {
  kind: 'insert' | 'delete' | 'moveFrom' | 'moveTo';
  id: number;
  author: string;
  /** ISO 8601. */
  date?: string;
}

/** Modification de mise en forme suivie : proprietes d'avant. */
export interface FormatChange<P> {
  id: number;
  author: string;
  date?: string;
  previous: P;
}

export interface Paragraph {
  type: 'paragraph';
  styleId?: string;
  props: ParagraphProps;
  /** Proprietes de la marque de paragraphe (pilcrow) : appliquees aux numeros de liste. */
  markProps?: RunProps;
  /** Marque de paragraphe inseree / supprimee (fusion de paragraphes suivie). */
  markRevision?: Revision;
  formatChange?: FormatChange<ParagraphProps>;
  inlines: Inline[];
  /** Fin de section : ce paragraphe termine une section dont voici les proprietes. */
  sectionBreak?: Section;
  /** Identifiant w14:paraId (ancre des commentaires). */
  paraId?: string;
}

export type WidthType = 'pt' | 'pct' | 'auto' | 'nil';

export interface Width {
  /** Points si type = pt ; pourcentage 0..100 si type = pct. */
  value: number;
  type: WidthType;
}

export interface CellMargins {
  top?: Pt;
  right?: Pt;
  bottom?: Pt;
  left?: Pt;
}

export interface TableBorders {
  top?: Border;
  bottom?: Border;
  left?: Border;
  right?: Border;
  insideH?: Border;
  insideV?: Border;
}

export interface TableLook {
  firstRow: boolean;
  lastRow: boolean;
  firstColumn: boolean;
  lastColumn: boolean;
  noHBand: boolean;
  noVBand: boolean;
}

export interface TableProps {
  width?: Width;
  alignment?: 'left' | 'center' | 'right';
  indent?: Pt;
  borders?: TableBorders;
  cellMargins?: CellMargins;
  layout?: 'fixed' | 'autofit';
  look?: TableLook;
  shading?: Shading;
  cellSpacing?: Pt;
  /** Titre et description (texte de remplacement du tableau). */
  caption?: string;
  description?: string;
  /** Tableau flottant (w:tblpPr) conserve en XML. */
  floating?: XmlElement;
  bidi?: boolean;
}

export interface TableRowProps {
  height?: { value: Pt; rule: 'atLeast' | 'exact' | 'auto' };
  /** Ligne d'en-tete repetee sur chaque page. */
  header?: boolean;
  /** Ne pas couper la ligne entre deux pages. */
  cantSplit?: boolean;
  revision?: Revision;
}

export interface TableCellProps {
  width?: Width;
  /** Fusion horizontale : nombre de colonnes de la grille couvertes. */
  gridSpan?: number;
  /** Fusion verticale : debut ou suite. */
  vMerge?: 'restart' | 'continue';
  borders?: TableBorders & { tl2br?: Border; tr2bl?: Border };
  shading?: Shading;
  verticalAlign?: 'top' | 'center' | 'bottom';
  margins?: CellMargins;
  textDirection?: string;
  noWrap?: boolean;
}

export interface TableCell {
  props: TableCellProps;
  blocks: Block[];
}

export interface TableRow {
  props: TableRowProps;
  cells: TableCell[];
}

export interface Table {
  type: 'table';
  styleId?: string;
  props: TableProps;
  /** Largeur des colonnes de la grille. */
  grid: Pt[];
  rows: TableRow[];
}

export type ContentControlKind =
  | 'richText' | 'plainText' | 'checkbox' | 'dropDown' | 'comboBox' | 'date' | 'picture' | 'group'
  | 'docPart' | 'citation' | 'bibliography' | 'repeatingSection';

export interface ContentControlProps {
  kind: ContentControlKind;
  id?: number;
  tag?: string;
  /** Titre affiche. */
  alias?: string;
  /** Case cochee (checkbox). */
  checked?: boolean;
  /** Elements de liste (dropDown / comboBox). */
  items?: { display: string; value: string }[];
  /** Format d'affichage (date) : « dd/MM/yyyy ». */
  dateFormat?: string;
  /** Galerie de blocs de construction (docPart). */
  docPartGallery?: string;
  /** Verrouillage : contenu / controle. */
  lock?: 'sdtLocked' | 'contentLocked' | 'sdtContentLocked' | 'unlocked';
  /** Le contenu affiche est le texte d'espace reserve. */
  showingPlaceholder?: boolean;
}

/** Controle de contenu de niveau bloc (w:sdt autour de paragraphes / tableaux). */
export interface ContentControl {
  type: 'contentControl';
  props: ContentControlProps;
  blocks: Block[];
}

/** Table des matieres (controle de contenu de type « Table of Contents » ou champ TOC). */
export interface TableOfContents {
  type: 'toc';
  /** Instruction du champ (« TOC \o "1-3" \h \z \u »). */
  instruction: string;
  /** Contenu calcule (paragraphes « TM 1 », « TM 2 »... avec numeros de page). */
  blocks: Block[];
  /** Identifiant du controle de contenu d'origine. */
  id?: number;
}

/** Bloc non modelise (w:customXml, w:altChunk...) conserve tel quel. */
export interface RawBlock {
  type: 'raw';
  xml: XmlElement;
  rels?: Record<string, StoredRel>;
}

export type Block = Paragraph | Table | ContentControl | TableOfContents | RawBlock;

// ---------------------------------------------------------------------------------------------------
// Corps : elements en ligne
// ---------------------------------------------------------------------------------------------------

interface InlineBase {
  /** Insertion / suppression suivie. */
  revision?: Revision;
}

export interface TextRun extends InlineBase {
  type: 'text';
  /** Texte brut. Les traits d'union conditionnels sont U+00AD, insecables U+2011. */
  text: string;
  /** Style de caractere. */
  styleId?: string;
  props: RunProps;
  formatChange?: FormatChange<RunProps>;
}

export interface Break extends InlineBase {
  type: 'break';
  kind: 'line' | 'page' | 'column';
  /** Saut de ligne qui degage les objets flottants. */
  clear?: 'left' | 'right' | 'all';
  props?: RunProps;
}

export interface Tab extends InlineBase {
  type: 'tab';
  props?: RunProps;
}

/** Caractere de police symbole (w:sym). */
export interface SymbolChar extends InlineBase {
  type: 'symbol';
  font: string;
  /** Code hexadecimal (« F0E0 »). */
  char: string;
  props?: RunProps;
}

export type WrapType = 'square' | 'tight' | 'through' | 'topAndBottom' | 'none';

export interface FloatPosition {
  relativeTo: 'margin' | 'page' | 'column' | 'character' | 'paragraph' | 'line' | 'insideMargin'
    | 'outsideMargin' | 'leftMargin' | 'rightMargin' | 'topMargin' | 'bottomMargin';
  /** Alignement (left, center, right, top, bottom, inside, outside) ou decalage en points. */
  align?: string;
  offset?: Pt;
}

/** Ancrage flottant d'une image ou d'une forme. */
export interface Floating {
  horizontal: FloatPosition;
  vertical: FloatPosition;
  wrap: WrapType;
  /** Cote d'habillage (square, tight, through). */
  wrapSide?: 'bothSides' | 'left' | 'right' | 'largest';
  /** Derriere le texte (wrap none + behindDoc) ou devant le texte (wrap none). */
  behindText: boolean;
  /** Distance au texte. */
  distance: { top: Pt; right: Pt; bottom: Pt; left: Pt };
  allowOverlap: boolean;
  lockAnchor?: boolean;
  /** Ordre d'empilement. */
  zIndex: number;
}

export interface ImageInline extends InlineBase {
  type: 'image';
  /** Cle dans Document.media. */
  mediaId: string;
  width: Pt;
  height: Pt;
  /** Texte de remplacement. */
  alt?: string;
  title?: string;
  name?: string;
  /** Image decorative (pas de texte de remplacement attendu). */
  decorative?: boolean;
  /** Recadrage en fractions 0..1 de chaque bord. */
  crop?: { top: number; right: number; bottom: number; left: number };
  /** Rotation en degres. */
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  /** Absent = image dans le texte. */
  floating?: Floating;
  /** Lien hypertexte sur l'image. */
  link?: string;
  props?: RunProps;
}

export interface Hyperlink extends InlineBase {
  type: 'hyperlink';
  /** URL externe (http, https, mailto, file...). Les URL javascript:, vbscript:, data: sont refusees. */
  url?: string;
  /** Signet interne. */
  anchor?: string;
  tooltip?: string;
  inlines: Inline[];
}

/** Champ (PAGE, NUMPAGES, DATE, TOC, REF, HYPERLINK...) avec son dernier resultat calcule. */
export interface Field extends InlineBase {
  type: 'field';
  /** Instruction complete (« PAGE \* MERGEFORMAT »). */
  instruction: string;
  /** Code du champ en majuscules (« PAGE »). */
  code: string;
  result: Inline[];
  locked?: boolean;
  /** A recalculer a l'ouverture. */
  dirty?: boolean;
  props?: RunProps;
}

/** Bornes d'un champ qui traverse plusieurs paragraphes (table des matieres, index). */
export interface FieldChar extends InlineBase {
  type: 'fieldChar';
  kind: 'begin' | 'separate' | 'end';
  /** Instruction, portee par la borne « begin ». */
  instruction?: string;
  props?: RunProps;
}

export interface BookmarkStart {
  type: 'bookmarkStart';
  id: number;
  name: string;
}

export interface BookmarkEnd {
  type: 'bookmarkEnd';
  id: number;
}

/** Appel de note dans le texte. */
export interface NoteReference extends InlineBase {
  type: 'footnoteRef' | 'endnoteRef';
  /** Cle dans Document.footnotes / endnotes. */
  noteId: number;
  /** Marque personnalisee (au lieu du numero automatique). */
  customMark?: string;
  props?: RunProps;
}

/** Numero de la note, en tete du texte de la note elle-meme. */
export interface NoteMark {
  type: 'noteMark';
  kind: 'footnote' | 'endnote';
  props?: RunProps;
}

export interface CommentAnchor {
  type: 'commentStart' | 'commentEnd' | 'commentRef';
  /** Cle dans Document.comments. */
  commentId: number;
}

export interface ShapeInline extends InlineBase {
  type: 'shape';
  /** Geometrie predefinie DrawingML (« rect », « ellipse », « roundRect »...). */
  geometry: string;
  width: Pt;
  height: Pt;
  fill?: Hex;
  line?: { color: Hex; width: Pt };
  /** Contenu de la zone de texte. */
  text?: Block[];
  floating?: Floating;
  name?: string;
  alt?: string;
}

/** Equation (OMML conserve). */
export interface Equation {
  type: 'equation';
  /** m:oMath ou m:oMathPara. */
  omml: XmlElement;
  /** Equation affichee (bloc) plutot qu'en ligne. */
  display: boolean;
  /** Forme lineaire lisible (« x=(-b±√(b^2-4ac))/2a »). */
  text: string;
}

/** Controle de contenu en ligne. */
export interface InlineContentControl {
  type: 'inlineControl';
  props: ContentControlProps;
  inlines: Inline[];
}

/** Partie de paquet conservee telle quelle, avec ses propres relations (identifiants d'origine). */
export interface StoredPart {
  path: string;
  contentType: string;
  bytes: Uint8Array;
  rels: StoredRel[];
}

export interface StoredRel {
  id: string;
  type: string;
  /** URL si externe, sinon chemin de la partie cible. */
  target: string;
  external: boolean;
  part?: StoredPart;
}

/** Element en ligne non modelise conserve tel quel (avec les relations qu'il reference). */
export interface RawInline {
  type: 'raw';
  xml: XmlElement;
  rels?: Record<string, StoredRel>;
}

export type Inline =
  | TextRun | Break | Tab | SymbolChar | ImageInline | Hyperlink | Field | FieldChar
  | BookmarkStart | BookmarkEnd | NoteReference | NoteMark | CommentAnchor | ShapeInline
  | Equation | InlineContentControl | RawInline;

// ---------------------------------------------------------------------------------------------------
// Notes, commentaires, medias, document
// ---------------------------------------------------------------------------------------------------

export interface Note {
  id: number;
  /** Separateurs Word (notes -1 / 0) : conserves mais non affiches comme notes. */
  special?: 'separator' | 'continuationSeparator' | 'continuationNotice';
  blocks: Block[];
}

export interface Comment {
  id: number;
  author: string;
  initials?: string;
  date?: string;
  blocks: Block[];
  /** Reponse a ce commentaire (fil de discussion). */
  parentId?: number;
  /** Commentaire resolu. */
  done?: boolean;
}

export interface MediaItem {
  id: string;
  /** Nom de fichier suggere (« image1.png »). */
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}

/** Relation non modelisee (customXml, macros VBA, glossaire...) conservee pour l'aller-retour. */
export interface PreservedRel {
  /** Depuis le paquet (_rels/.rels) ou depuis le document principal. */
  source: 'package' | 'document';
  rel: StoredRel;
}

/** Variante de fichier Word. */
export type WordFileKind = 'docx' | 'docm' | 'dotx' | 'dotm';

export interface WordDocument {
  kind: WordFileKind;
  properties: DocumentProperties;
  theme: Theme;
  settings: DocumentSettings;
  styles: StyleSheet;
  numbering: Numbering;
  /** Corps du document. Les fins de section sont marquees par Paragraph.sectionBreak. */
  body: Block[];
  /** Proprietes de la derniere section (w:body/w:sectPr). */
  finalSection: Section;
  headersFooters: Record<string, HeaderFooter>;
  footnotes: Note[];
  endnotes: Note[];
  comments: Comment[];
  media: Record<string, MediaItem>;
  /** Polices declarees (w:fonts) : nom -> famille generique. */
  fonts: Record<string, { family?: string; altName?: string }>;
  preserved: PreservedRel[];
}

/** Avertissement de lecture (fichier abime, element ignore, lien refuse...). */
export interface ReadWarning {
  code: string;
  message: string;
}

export interface ReadResult {
  document: WordDocument;
  warnings: ReadWarning[];
}
