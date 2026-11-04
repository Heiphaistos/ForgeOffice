// Contrat du classeur du Tableur : modele independant du format (xlsx, xls, ods, csv).
// Conventions : lignes et colonnes indexees a partir de 0 ; formules canoniques en syntaxe Excel
// anglaise SANS « = » initial ; couleurs « AARRGGBB » ; dimensions en unites Excel (largeur de colonne
// en caracteres, hauteur de ligne en points, marges en pouces, ancrages en EMU).

// ---------------------------------------------------------------- Adresses

export interface CellAddress {
  row: number;
  col: number;
}

/** Plage rectangulaire inclusive (r1 <= r2, c1 <= c2). */
export interface CellRange {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

/** Limites d'une feuille Excel 2007+. */
export const MAX_ROWS = 1_048_576;
export const MAX_COLS = 16_384;

// ---------------------------------------------------------------- Valeurs

export type ErrorCode =
  | '#NULL!' | '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#NUM!' | '#N/A' | '#GETTING_DATA'
  | '#SPILL!' | '#CALC!' | '#FIELD!' | '#BLOCKED!' | '#CONNECT!' | '#BUSY!' | '#UNKNOWN!';

export interface CellError {
  error: ErrorCode;
}

/** null = cellule vide (qui peut tout de meme porter un style). */
export type CellValue = number | string | boolean | CellError | null;

// ---------------------------------------------------------------- Couleurs et texte enrichi

/** Couleur Office : RVB explicite, couleur de theme (+ teinte -1..1), index de palette ou automatique. */
export interface Color {
  rgb?: string;
  theme?: number;
  tint?: number;
  indexed?: number;
  auto?: boolean;
}

export type UnderlineStyle = 'single' | 'double' | 'singleAccounting' | 'doubleAccounting';

export interface Font {
  name: string;
  /** Taille en points. */
  size: number;
  bold?: boolean;
  italic?: boolean;
  underline?: UnderlineStyle;
  strike?: boolean;
  color?: Color;
  vertAlign?: 'superscript' | 'subscript';
  /** Famille de police (1 roman, 2 swiss, 3 modern...). */
  family?: number;
  charset?: number;
  /** Police du theme : « minor » (corps) ou « major » (titres). */
  scheme?: 'major' | 'minor';
  outline?: boolean;
  shadow?: boolean;
  condense?: boolean;
  extend?: boolean;
}

/** Segment de texte enrichi : `font` partielle (heritee de la police de la cellule sinon). */
export interface RichRun {
  text: string;
  font?: Partial<Font>;
}

// ---------------------------------------------------------------- Styles normalises

export type PatternType =
  | 'none' | 'solid' | 'mediumGray' | 'darkGray' | 'lightGray' | 'darkHorizontal' | 'darkVertical' | 'darkDown'
  | 'darkUp' | 'darkGrid' | 'darkTrellis' | 'lightHorizontal' | 'lightVertical' | 'lightDown' | 'lightUp'
  | 'lightGrid' | 'lightTrellis' | 'gray125' | 'gray0625';

export interface PatternFill {
  type: 'pattern';
  pattern: PatternType;
  /** Couleur du motif (couleur de remplissage pour « solid »). */
  fg?: Color;
  bg?: Color;
}

export interface GradientStop {
  /** Position 0..1. */
  position: number;
  color: Color;
}

export interface GradientFill {
  type: 'gradient';
  gradient: 'linear' | 'path';
  degree?: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  stops: GradientStop[];
}

export type Fill = PatternFill | GradientFill;

export type BorderStyle =
  | 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted' | 'double' | 'hair' | 'mediumDashed' | 'dashDot'
  | 'mediumDashDot' | 'dashDotDot' | 'mediumDashDotDot' | 'slantDashDot';

export interface BorderEdge {
  style: BorderStyle;
  color?: Color;
}

export interface Border {
  left?: BorderEdge;
  right?: BorderEdge;
  top?: BorderEdge;
  bottom?: BorderEdge;
  diagonal?: BorderEdge;
  diagonalUp?: boolean;
  diagonalDown?: boolean;
  /** Bordures interieures (formats differentiels des tableaux). */
  vertical?: BorderEdge;
  horizontal?: BorderEdge;
  outline?: boolean;
}

export interface NumberFormat {
  /** Identifiant : < 164 = format integre, >= 164 = personnalise. */
  id: number;
  code: string;
}

export type HorizontalAlignment =
  | 'general' | 'left' | 'center' | 'right' | 'fill' | 'justify' | 'centerContinuous' | 'distributed';
export type VerticalAlignment = 'top' | 'center' | 'bottom' | 'justify' | 'distributed';

export interface Alignment {
  horizontal?: HorizontalAlignment;
  vertical?: VerticalAlignment;
  wrapText?: boolean;
  shrinkToFit?: boolean;
  indent?: number;
  /** 0..180 (91..180 = vers le bas), 255 = texte vertical empile. */
  textRotation?: number;
  /** 0 contexte, 1 gauche a droite, 2 droite a gauche. */
  readingOrder?: number;
  justifyLastLine?: boolean;
}

export interface Protection {
  locked?: boolean;
  hidden?: boolean;
}

/** Format de cellule (« xf ») : renvoie vers les tables normalisees. */
export interface CellFormat {
  numFmtId: number;
  fontId: number;
  fillId: number;
  borderId: number;
  /** Index dans `cellStyleXfs` (style de cellule nomme parent). Absent dans `cellStyleXfs` eux-memes. */
  xfId?: number;
  alignment?: Alignment;
  protection?: Protection;
  quotePrefix?: boolean;
}

/** Style de cellule nomme (« Normal », « Titre 1 », « Satisfaisant »...). */
export interface NamedCellStyle {
  name: string;
  /** Index dans `cellStyleXfs`. */
  xfId: number;
  /** Identifiant de style integre Excel (0 = Normal, 3 = Milliers...). */
  builtinId?: number;
  customBuiltin?: boolean;
  hidden?: boolean;
  outlineLevel?: number;
}

/** Format differentiel (mises en forme conditionnelles, tableaux, filtres par couleur). */
export interface DifferentialFormat {
  font?: Partial<Font>;
  fill?: Fill;
  border?: Border;
  numFmt?: NumberFormat;
  alignment?: Alignment;
  protection?: Protection;
}

export type TableStyleElementType =
  | 'wholeTable' | 'headerRow' | 'totalRow' | 'firstColumn' | 'lastColumn' | 'firstRowStripe' | 'secondRowStripe'
  | 'firstColumnStripe' | 'secondColumnStripe' | 'firstHeaderCell' | 'lastHeaderCell' | 'firstTotalCell'
  | 'lastTotalCell' | 'firstSubtotalColumn' | 'secondSubtotalColumn' | 'thirdSubtotalColumn' | 'firstSubtotalRow'
  | 'secondSubtotalRow' | 'thirdSubtotalRow' | 'blankRow' | 'firstColumnSubheading' | 'secondColumnSubheading'
  | 'thirdColumnSubheading' | 'firstRowSubheading' | 'secondRowSubheading' | 'thirdRowSubheading' | 'pageFieldLabels'
  | 'pageFieldValues';

/** Style de tableau personnalise : elements -> format differentiel. */
export interface CustomTableStyle {
  name: string;
  pivot?: boolean;
  table?: boolean;
  elements: { type: TableStyleElementType; dxfId: number; size?: number }[];
}

export interface Styles {
  /** Formats personnalises seulement (les integres sont dans BUILTIN_NUMBER_FORMATS). */
  numFmts: NumberFormat[];
  fonts: Font[];
  /** Les deux premiers sont reserves par Excel : « none » puis « gray125 ». */
  fills: Fill[];
  borders: Border[];
  /** Formats maitres des styles nommes. */
  cellStyleXfs: CellFormat[];
  /** Formats de cellule : `Cell.styleId` est un index de ce tableau (0 = Normal). */
  cellXfs: CellFormat[];
  cellStyles: NamedCellStyle[];
  dxfs: DifferentialFormat[];
  tableStyles: CustomTableStyle[];
  defaultTableStyle?: string;
  defaultPivotStyle?: string;
  /** Palette indexee personnalisee (64 couleurs AARRGGBB) ; absente = palette Excel par defaut. */
  indexedColors?: string[];
  /** Couleurs recentes du selecteur. */
  mruColors?: Color[];
}

// ---------------------------------------------------------------- Theme

export interface ThemeColors {
  dk1: string;
  lt1: string;
  dk2: string;
  lt2: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;
  accent6: string;
  hlink: string;
  folHlink: string;
}

export interface ThemeFonts {
  latin: string;
  eastAsian?: string;
  complexScript?: string;
}

export interface Theme {
  name: string;
  /** Couleurs en « RRGGBB ». */
  colors: ThemeColors;
  colorSchemeName: string;
  majorFont: ThemeFonts;
  minorFont: ThemeFonts;
  fontSchemeName: string;
  /** XML d'origine conserve tel quel pour l'aller-retour (effets, remplissages de format). */
  xml?: string;
}

// ---------------------------------------------------------------- Classeur

export interface DocumentProperties {
  title?: string;
  subject?: string;
  creator?: string;
  keywords?: string;
  description?: string;
  lastModifiedBy?: string;
  category?: string;
  contentStatus?: string;
  /** Dates ISO 8601. */
  created?: string;
  modified?: string;
  company?: string;
  manager?: string;
  application?: string;
  appVersion?: string;
  /** Proprietes personnalisees (Fichier > Informations > Proprietes avancees). */
  custom?: Record<string, string | number | boolean>;
}

export interface DefinedName {
  name: string;
  /** Formule sans « = » (ex. « Feuil1!$A$1:$B$4 »). */
  formula: string;
  /** Index de la feuille si le nom est local a une feuille. */
  localSheet?: number;
  hidden?: boolean;
  comment?: string;
}

export interface CalcOptions {
  mode: 'auto' | 'manual' | 'autoNoTable';
  fullCalcOnLoad?: boolean;
  iterate?: boolean;
  iterateCount?: number;
  iterateDelta?: number;
  fullPrecision?: boolean;
  calcId?: number;
}

/** Empreinte de mot de passe (ECMA-376 agile : algo + sel + tours) ou empreinte 16 bits historique. */
export interface PasswordHash {
  algorithmName?: string;
  hashValue?: string;
  saltValue?: string;
  spinCount?: number;
  /** Empreinte 16 bits en hexadecimal (format historique). */
  legacy?: string;
}

export interface WorkbookProtection {
  lockStructure?: boolean;
  lockWindows?: boolean;
  password?: PasswordHash;
}

export type WorkbookFormat = 'xlsx' | 'xlsm' | 'xltx' | 'xltm' | 'xls' | 'ods' | 'csv';

export interface Person {
  id: string;
  displayName: string;
  userId?: string;
  providerId?: string;
}

export interface Workbook {
  properties: DocumentProperties;
  theme: Theme;
  styles: Styles;
  definedNames: DefinedName[];
  sheets: Sheet[];
  /** Systeme de dates 1904 (Mac historique) ; sinon 1900. */
  date1904: boolean;
  calc: CalcOptions;
  /** Index de la feuille active. */
  activeSheet: number;
  firstVisibleTab?: number;
  protection?: WorkbookProtection;
  /** Projet VBA brut (xlsm) conserve pour l'aller-retour ; jamais execute. */
  vbaProject?: Uint8Array;
  /** Auteurs des commentaires modernes (fils de discussion). */
  persons: Person[];
  /** Format d'origine (choisit l'extension par defaut a l'enregistrement). */
  sourceFormat?: WorkbookFormat;
}

// ---------------------------------------------------------------- Cellules

export interface SharedFormulaRef {
  /** Identifiant du groupe (attribut « si »). */
  index: number;
  /** Plage du groupe : presente seulement sur la cellule maitre (qui porte aussi `formula`). */
  ref?: CellRange;
}

export interface ArrayFormulaRef {
  /** Plage couverte : la cellule maitre porte `formula`. */
  ref: CellRange;
  /** Matrice dynamique (Excel 365, propagation). */
  dynamic?: boolean;
}

export interface Cell {
  value: CellValue;
  /** Formule canonique sans « = » ; la valeur est alors le dernier resultat calcule. */
  formula?: string;
  shared?: SharedFormulaRef;
  array?: ArrayFormulaRef;
  /** Index dans `styles.cellXfs` ; absent = 0. */
  styleId?: number;
  /** Texte enrichi : `value` contient alors le texte brut concatene. */
  rich?: RichRun[];
}

/** Stockage epars : ligne -> colonne -> cellule. Seules les cellules existantes occupent de la memoire. */
export type CellStore = Map<number, Map<number, Cell>>;

// ---------------------------------------------------------------- Lignes, colonnes, vues

export interface ColumnInfo {
  /** Premiere et derniere colonne couvertes (inclusives). */
  min: number;
  max: number;
  /** Largeur en caracteres (unites Excel). */
  width?: number;
  hidden?: boolean;
  styleId?: number;
  outlineLevel?: number;
  collapsed?: boolean;
  bestFit?: boolean;
}

export interface RowInfo {
  /** Hauteur en points. */
  height?: number;
  hidden?: boolean;
  styleId?: number;
  outlineLevel?: number;
  collapsed?: boolean;
  thickTop?: boolean;
  thickBottom?: boolean;
}

export interface OutlineSettings {
  summaryBelow: boolean;
  summaryRight: boolean;
  showSymbols: boolean;
}

export interface SheetView {
  /** Volets figes : nombre de lignes et colonnes figees en haut / a gauche. */
  frozen?: { rows: number; cols: number };
  /** Fractionnement non fige (unites 1/20 de point). */
  split?: { x: number; y: number };
  topLeftCell?: CellAddress;
  /** Zoom en pourcentage (10..400). */
  zoom: number;
  view: 'normal' | 'pageBreakPreview' | 'pageLayout';
  showGridLines: boolean;
  showHeaders: boolean;
  showZeros: boolean;
  showFormulas?: boolean;
  rightToLeft?: boolean;
  tabSelected?: boolean;
  activeCell?: CellAddress;
  selection?: CellRange[];
  gridColor?: Color;
}

// ---------------------------------------------------------------- Mises en forme conditionnelles

export interface Cfvo {
  type: 'num' | 'percent' | 'max' | 'min' | 'formula' | 'percentile' | 'autoMin' | 'autoMax';
  value?: string;
  /** Superieur ou egal (jeux d'icones). */
  gte?: boolean;
}

export type CfOperator =
  | 'lessThan' | 'lessThanOrEqual' | 'equal' | 'notEqual' | 'greaterThanOrEqual' | 'greaterThan' | 'between'
  | 'notBetween' | 'containsText' | 'notContains' | 'beginsWith' | 'endsWith';

export type IconSetName =
  | '3Arrows' | '3ArrowsGray' | '3Flags' | '3TrafficLights1' | '3TrafficLights2' | '3Signs' | '3Symbols'
  | '3Symbols2' | '4Arrows' | '4ArrowsGray' | '4RedToBlack' | '4Rating' | '4TrafficLights' | '5Arrows'
  | '5ArrowsGray' | '5Rating' | '5Quarters' | '3Stars' | '3Triangles' | '5Boxes';

export type TimePeriod =
  | 'today' | 'yesterday' | 'tomorrow' | 'last7Days' | 'thisMonth' | 'lastMonth' | 'nextMonth' | 'thisWeek'
  | 'lastWeek' | 'nextWeek';

export type CfRuleType =
  | 'cellIs' | 'expression' | 'colorScale' | 'dataBar' | 'iconSet' | 'top10' | 'duplicateValues'
  | 'uniqueValues' | 'aboveAverage' | 'containsText' | 'notContainsText' | 'beginsWith' | 'endsWith'
  | 'containsBlanks' | 'notContainsBlanks' | 'containsErrors' | 'notContainsErrors' | 'timePeriod';

export interface ColorScale {
  /** 2 ou 3 seuils, autant de couleurs. */
  cfvos: Cfvo[];
  colors: Color[];
}

export interface DataBar {
  cfvos: [Cfvo, Cfvo];
  color: Color;
  minLength?: number;
  maxLength?: number;
  showValue?: boolean;
  /** Extensions Excel 2010 (barre pleine, couleur negative, axe, direction). */
  gradient?: boolean;
  negativeColor?: Color;
  borderColor?: Color;
  axisColor?: Color;
  axisPosition?: 'automatic' | 'middle' | 'none';
  direction?: 'context' | 'leftToRight' | 'rightToLeft';
}

export interface IconSet {
  iconSet: IconSetName;
  cfvos: Cfvo[];
  reverse?: boolean;
  showValue?: boolean;
  percent?: boolean;
}

export interface CfRule {
  type: CfRuleType;
  /** Ordre d'evaluation (1 = prioritaire). */
  priority: number;
  stopIfTrue?: boolean;
  /** Format applique (index dans `styles.dxfs`). */
  dxfId?: number;
  operator?: CfOperator;
  /** Formules sans « = » (1 ou 2 pour cellIs, 1 pour expression). */
  formulas?: string[];
  text?: string;
  timePeriod?: TimePeriod;
  /** top10 : rang, pourcentage, valeurs du bas. */
  rank?: number;
  percent?: boolean;
  bottom?: boolean;
  /** aboveAverage. */
  aboveAverage?: boolean;
  equalAverage?: boolean;
  stdDev?: number;
  colorScale?: ColorScale;
  dataBar?: DataBar;
  iconSet?: IconSet;
}

export interface ConditionalFormat {
  ranges: CellRange[];
  rules: CfRule[];
  pivot?: boolean;
}

// ---------------------------------------------------------------- Validation des donnees

export interface DataValidation {
  ranges: CellRange[];
  type: 'none' | 'whole' | 'decimal' | 'list' | 'date' | 'time' | 'textLength' | 'custom';
  operator?: 'between' | 'notBetween' | 'equal' | 'notEqual' | 'lessThan' | 'lessThanOrEqual' | 'greaterThan' | 'greaterThanOrEqual';
  /** Formules sans « = » ; pour une liste explicite : « "Oui,Non" ». */
  formula1?: string;
  formula2?: string;
  allowBlank?: boolean;
  /** Affiche la fleche de liste deroulante (inverse de l'attribut OOXML « showDropDown »). */
  inCellDropdown?: boolean;
  showInputMessage?: boolean;
  showErrorMessage?: boolean;
  errorStyle?: 'stop' | 'warning' | 'information';
  errorTitle?: string;
  error?: string;
  promptTitle?: string;
  prompt?: string;
}

// ---------------------------------------------------------------- Filtres et tris

export type CustomFilterOperator = 'equal' | 'lessThan' | 'lessThanOrEqual' | 'notEqual' | 'greaterThanOrEqual' | 'greaterThan';

export interface DateGroupItem {
  grouping: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';
  year: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
}

export type ColumnFilter =
  | { kind: 'values'; values: string[]; blank?: boolean; dateGroups?: DateGroupItem[] }
  | { kind: 'custom'; and?: boolean; conditions: { operator: CustomFilterOperator; value: string }[] }
  | { kind: 'top10'; top: boolean; percent: boolean; value: number; filterValue?: number }
  | { kind: 'dynamic'; type: string; value?: number; maxValue?: number }
  | { kind: 'color'; dxfId?: number; cellColor: boolean }
  | { kind: 'icon'; iconSet: IconSetName; iconId?: number };

export interface FilterColumn {
  /** Index relatif a la premiere colonne de la plage filtree. */
  colId: number;
  hiddenButton?: boolean;
  showButton?: boolean;
  filter?: ColumnFilter;
}

export interface SortCondition {
  ref: CellRange;
  descending?: boolean;
  sortBy?: 'value' | 'cellColor' | 'fontColor' | 'icon';
  dxfId?: number;
  customList?: string;
  iconSet?: IconSetName;
  iconId?: number;
}

export interface SortState {
  ref: CellRange;
  caseSensitive?: boolean;
  columnSort?: boolean;
  conditions: SortCondition[];
}

export interface AutoFilter {
  ref: CellRange;
  columns: FilterColumn[];
  sort?: SortState;
}

// ---------------------------------------------------------------- Tableaux (ListObjects)

export type TotalsRowFunction = 'none' | 'sum' | 'min' | 'max' | 'average' | 'count' | 'countNums' | 'stdDev' | 'var' | 'custom';

export interface TableColumn {
  id: number;
  name: string;
  totalsRowFunction?: TotalsRowFunction;
  totalsRowLabel?: string;
  /** Formule de la ligne Total (fonction « custom »), sans « = ». */
  totalsRowFormula?: string;
  /** Colonne calculee : formule sans « = ». */
  calculatedFormula?: string;
  dataDxfId?: number;
}

export interface TableStyleInfo {
  /** « TableStyleMedium2 » (style par defaut d'Office)... */
  name: string;
  showFirstColumn: boolean;
  showLastColumn: boolean;
  showRowStripes: boolean;
  showColumnStripes: boolean;
}

export interface Table {
  id: number;
  name: string;
  displayName: string;
  ref: CellRange;
  /** Nombre de lignes d'en-tete (0 ou 1). */
  headerRowCount: number;
  totalsRowShown: boolean;
  totalsRowCount: number;
  columns: TableColumn[];
  style?: TableStyleInfo;
  autoFilter?: AutoFilter;
  sort?: SortState;
  comment?: string;
}

// ---------------------------------------------------------------- Liens, notes, commentaires

export interface Hyperlink {
  ref: CellRange;
  /** URL externe (http, https, mailto, fichier). Jamais « javascript: » (refuse a la lecture). */
  target?: string;
  /** Destination interne (« Feuil2!A1 », nom defini). */
  location?: string;
  tooltip?: string;
  display?: string;
}

/** Note (commentaire historique, bulle jaune). */
export interface Note {
  ref: CellAddress;
  author: string;
  text: string;
  rich?: RichRun[];
  /** Note toujours affichee. */
  visible?: boolean;
  /** Taille de la bulle en pixels. */
  width?: number;
  height?: number;
}

export interface ThreadedCommentReply {
  id: string;
  personId: string;
  text: string;
  /** Date ISO 8601. */
  date?: string;
}

/** Commentaire moderne (fil de discussion Microsoft 365). */
export interface ThreadedComment {
  id: string;
  ref: CellAddress;
  personId: string;
  text: string;
  date?: string;
  done?: boolean;
  replies: ThreadedCommentReply[];
  /** Personnes mentionnees (identifiants). */
  mentions?: string[];
}

// ---------------------------------------------------------------- Dessins (images, formes, graphiques)

export interface AnchorPoint {
  col: number;
  /** Decalage en EMU (914400 par pouce, 9525 par pixel a 96 ppp). */
  colOffset: number;
  row: number;
  rowOffset: number;
}

export type Anchor =
  | { type: 'twoCell'; from: AnchorPoint; to: AnchorPoint; editAs?: 'twoCell' | 'oneCell' | 'absolute' }
  | { type: 'oneCell'; from: AnchorPoint; width: number; height: number }
  | { type: 'absolute'; x: number; y: number; width: number; height: number };

export interface DrawingBase {
  anchor: Anchor;
  name: string;
  /** Texte de remplacement (accessibilite). */
  description?: string;
  title?: string;
  hidden?: boolean;
  /** Rotation en degres. */
  rotation?: number;
  locked?: boolean;
}

export interface ImageObject extends DrawingBase {
  kind: 'image';
  data: Uint8Array;
  /** Type MIME (image/png, image/jpeg...). */
  contentType: string;
  /** Lien hypertexte sur l'image. */
  link?: string;
}

export interface LineProperties {
  color?: string;
  /** Epaisseur en points. */
  width?: number;
  dash?: 'solid' | 'dot' | 'dash' | 'lgDash' | 'dashDot' | 'sysDash' | 'sysDot';
  none?: boolean;
}

/** Remplissage DrawingML simplifie : couleur « RRGGBB » ou aucun. */
export interface ShapeFill {
  color?: string;
  /** Transparence 0..1. */
  transparency?: number;
  none?: boolean;
}

export interface ShapeObject extends DrawingBase {
  kind: 'shape';
  /** Geometrie predefinie DrawingML (rect, roundRect, ellipse, rightArrow, line...). */
  geometry: string;
  text?: string;
  fill?: ShapeFill;
  line?: LineProperties;
  textColor?: string;
  fontSize?: number;
  bold?: boolean;
  horizontalAlign?: 'l' | 'ctr' | 'r' | 'just';
  verticalAlign?: 't' | 'ctr' | 'b';
  /** Connecteur ou trait (pas de texte). */
  connector?: boolean;
}

export interface ChartObject extends DrawingBase {
  kind: 'chart';
  chart: ChartModel;
}

export type DrawingObject = ImageObject | ShapeObject | ChartObject;

// ---------------------------------------------------------------- Graphiques

export type ChartPlotType = 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'radar' | 'bubble';

/** Texte de graphique : litteral ou reference de cellule. */
export interface ChartText {
  text?: string;
  /** Reference sans « = » (« Feuil1!$B$1 »). */
  ref?: string;
  overlay?: boolean;
  bold?: boolean;
  /** Taille en points. */
  size?: number;
  color?: string;
}

export interface ChartDataRef {
  /** Reference sans « = ». */
  ref?: string;
  /** Valeurs en cache (affichage sans recalcul, donnees litterales si pas de reference). */
  cache?: (number | string | null)[];
  formatCode?: string;
}

export interface DataLabels {
  showValue?: boolean;
  showCategory?: boolean;
  showSeriesName?: boolean;
  showPercent?: boolean;
  showLegendKey?: boolean;
  showBubbleSize?: boolean;
  showLeaderLines?: boolean;
  position?: 'ctr' | 'inEnd' | 'inBase' | 'outEnd' | 'bestFit' | 'l' | 'r' | 't' | 'b';
  separator?: string;
  numFmt?: string;
  delete?: boolean;
}

export interface MarkerStyle {
  symbol: 'none' | 'circle' | 'square' | 'diamond' | 'triangle' | 'x' | 'star' | 'dash' | 'dot' | 'plus' | 'auto';
  size?: number;
  color?: string;
}

export interface Trendline {
  type: 'linear' | 'exp' | 'log' | 'movingAvg' | 'poly' | 'power';
  order?: number;
  period?: number;
  name?: string;
  displayEquation?: boolean;
  displayRSquared?: boolean;
  forward?: number;
  backward?: number;
}

export interface ChartSeries {
  idx: number;
  order: number;
  name?: ChartText;
  categories?: ChartDataRef;
  values: ChartDataRef;
  /** Nuages de points et bulles. */
  xValues?: ChartDataRef;
  bubbleSizes?: ChartDataRef;
  /** Couleur de remplissage / trait « RRGGBB ». */
  color?: string;
  line?: LineProperties;
  marker?: MarkerStyle;
  smooth?: boolean;
  dataLabels?: DataLabels;
  invertIfNegative?: boolean;
  /** Eclatement d'un secteur (%). */
  explosion?: number;
  trendlines?: Trendline[];
  /** Couleurs de points individuels (index -> « RRGGBB »). */
  pointColors?: Record<number, string>;
}

export interface ChartPlot {
  type: ChartPlotType;
  /** Barres : « col » = histogramme vertical, « bar » = barres horizontales. */
  barDirection?: 'col' | 'bar';
  grouping?: 'clustered' | 'stacked' | 'percentStacked' | 'standard';
  varyColors?: boolean;
  series: ChartSeries[];
  /** Identifiants des axes utilises (vide pour secteurs et anneaux). */
  axisIds: number[];
  dataLabels?: DataLabels;
  gapWidth?: number;
  overlap?: number;
  /** Secteurs / anneau. */
  firstSliceAngle?: number;
  holeSize?: number;
  scatterStyle?: 'line' | 'lineMarker' | 'marker' | 'smooth' | 'smoothMarker' | 'none';
  radarStyle?: 'standard' | 'marker' | 'filled';
  bubbleScale?: number;
  showNegativeBubbles?: boolean;
  /** Courbes : afficher les marqueurs. */
  markers?: boolean;
}

export interface ChartAxis {
  id: number;
  kind: 'category' | 'value' | 'date' | 'series';
  position: 'b' | 'l' | 'r' | 't';
  crossAxisId: number;
  title?: ChartText;
  deleted?: boolean;
  min?: number;
  max?: number;
  majorUnit?: number;
  minorUnit?: number;
  logBase?: number;
  reverse?: boolean;
  numFmt?: string;
  majorGridlines?: boolean;
  minorGridlines?: boolean;
  crosses?: 'autoZero' | 'min' | 'max';
  crossesAt?: number;
  tickLabelPosition?: 'nextTo' | 'low' | 'high' | 'none';
  majorTickMark?: 'none' | 'in' | 'out' | 'cross';
  minorTickMark?: 'none' | 'in' | 'out' | 'cross';
  crossBetween?: 'between' | 'midCat';
}

export interface ChartLegend {
  position: 'r' | 'l' | 't' | 'b' | 'tr';
  overlay?: boolean;
}

export interface ChartModel {
  title?: ChartText;
  autoTitleDeleted?: boolean;
  /** Plusieurs traces = graphique combine (ex. histogramme + courbe sur axe secondaire). */
  plots: ChartPlot[];
  axes: ChartAxis[];
  legend?: ChartLegend;
  /** Style integre Excel (1..48). */
  style?: number;
  plotVisibleOnly?: boolean;
  displayBlanksAs?: 'gap' | 'span' | 'zero';
  roundedCorners?: boolean;
}

// ---------------------------------------------------------------- Graphiques sparkline

export interface Sparkline {
  /** Plage source sans « = » (« Feuil1!A1:E1 »). */
  source: string;
  /** Cellule d'affichage. */
  location: CellAddress;
}

export interface SparklineGroup {
  type: 'line' | 'column' | 'stacked';
  sparklines: Sparkline[];
  colorSeries?: Color;
  colorNegative?: Color;
  colorAxis?: Color;
  colorMarkers?: Color;
  colorFirst?: Color;
  colorLast?: Color;
  colorHigh?: Color;
  colorLow?: Color;
  markers?: boolean;
  high?: boolean;
  low?: boolean;
  first?: boolean;
  last?: boolean;
  negative?: boolean;
  displayXAxis?: boolean;
  displayHidden?: boolean;
  rightToLeft?: boolean;
  /** Epaisseur du trait en points. */
  lineWeight?: number;
  displayEmptyCellsAs?: 'gap' | 'zero' | 'span';
  minAxisType?: 'individual' | 'group' | 'custom';
  maxAxisType?: 'individual' | 'group' | 'custom';
  manualMin?: number;
  manualMax?: number;
  /** Plage de dates de l'axe, sans « = ». */
  dateAxis?: string;
}

// ---------------------------------------------------------------- Mise en page

export interface PageMargins {
  /** Pouces. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  header: number;
  footer: number;
}

export interface HeaderFooter {
  /** Codes Excel (&L, &C, &R, &P, &N, &D, &T, &F, &A...). */
  oddHeader?: string;
  oddFooter?: string;
  evenHeader?: string;
  evenFooter?: string;
  firstHeader?: string;
  firstFooter?: string;
  differentOddEven?: boolean;
  differentFirst?: boolean;
  scaleWithDoc?: boolean;
  alignWithMargins?: boolean;
}

export interface PageSetup {
  /** Zone d'impression (enregistree dans le nom defini « _xlnm.Print_Area »). */
  printArea?: CellRange[];
  /** Lignes / colonnes a repeter (« _xlnm.Print_Titles »). */
  printTitleRows?: { first: number; last: number };
  printTitleCols?: { first: number; last: number };
  margins: PageMargins;
  orientation?: 'portrait' | 'landscape';
  /** Code de papier Excel (9 = A4, 1 = Lettre). */
  paperSize?: number;
  /** Echelle en % (10..400). */
  scale?: number;
  /** Ajuster a N pages en largeur / hauteur (0 = automatique) ; actif si `fitToPage`. */
  fitToPage?: boolean;
  fitToWidth?: number;
  fitToHeight?: number;
  firstPageNumber?: number;
  pageOrder?: 'downThenOver' | 'overThenDown';
  blackAndWhite?: boolean;
  draft?: boolean;
  cellComments?: 'none' | 'asDisplayed' | 'atEnd';
  errors?: 'displayed' | 'blank' | 'dash' | 'NA';
  horizontalCentered?: boolean;
  verticalCentered?: boolean;
  printGridLines?: boolean;
  printHeadings?: boolean;
  headerFooter?: HeaderFooter;
  /** Sauts de page manuels : index de la ligne / colonne APRES laquelle couper. */
  rowBreaks: number[];
  colBreaks: number[];
}

// ---------------------------------------------------------------- Protection de feuille

export interface SheetProtection {
  sheet: boolean;
  password?: PasswordHash;
  objects?: boolean;
  scenarios?: boolean;
  /** true = action AUTORISEE malgre la protection (inverse des attributs OOXML). */
  allow: {
    formatCells?: boolean;
    formatColumns?: boolean;
    formatRows?: boolean;
    insertColumns?: boolean;
    insertRows?: boolean;
    insertHyperlinks?: boolean;
    deleteColumns?: boolean;
    deleteRows?: boolean;
    selectLockedCells?: boolean;
    selectUnlockedCells?: boolean;
    sort?: boolean;
    autoFilter?: boolean;
    pivotTables?: boolean;
  };
}

/** Plage modifiable malgre la protection (Revision > Autoriser la modification des plages). */
export interface ProtectedRange {
  name: string;
  ranges: CellRange[];
  password?: PasswordHash;
}

// ---------------------------------------------------------------- Feuille

export interface Sheet {
  name: string;
  state: 'visible' | 'hidden' | 'veryHidden';
  tabColor?: Color;
  cells: CellStore;
  /** Hauteur de ligne par defaut en points. */
  defaultRowHeight: number;
  /** Largeur de colonne par defaut en caracteres (absente = deduite de la police). */
  defaultColWidth?: number;
  baseColWidth?: number;
  cols: ColumnInfo[];
  rows: Map<number, RowInfo>;
  outline: OutlineSettings;
  merges: CellRange[];
  view: SheetView;
  conditionalFormats: ConditionalFormat[];
  dataValidations: DataValidation[];
  autoFilter?: AutoFilter;
  sort?: SortState;
  tables: Table[];
  hyperlinks: Hyperlink[];
  notes: Note[];
  threadedComments: ThreadedComment[];
  drawings: DrawingObject[];
  sparklineGroups: SparklineGroup[];
  pageSetup: PageSetup;
  protection?: SheetProtection;
  protectedRanges: ProtectedRange[];
  /** Feuille graphique (onglet sans grille) : le premier dessin est le graphique. */
  isChartSheet?: boolean;
  /** Code de la feuille (nom VBA). */
  codeName?: string;
}
