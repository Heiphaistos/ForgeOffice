// Contrat du Tableur (suite) : couleurs, polices, remplissages, bordures, formats de cellule, styles et theme.
// Re-exporte par model.ts : importer depuis './model.ts'.
import type { Cell } from './model.ts';

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
