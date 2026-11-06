// Contrat du classeur du Tableur : modele independant du format (xlsx, xls, ods, csv).
// Conventions : lignes et colonnes indexees a partir de 0 ; formules canoniques en syntaxe Excel
// anglaise SANS « = » initial ; couleurs « AARRGGBB » ; dimensions en unites Excel (largeur de colonne
// en caracteres, hauteur de ligne en points, marges en pouces, ancrages en EMU).

export * from './model-drawing.ts';
export * from './model-styles.ts';
export * from './model-features.ts';
export * from './model-page.ts';
export * from './model-pivot.ts';

import type { DrawingObject, SparklineGroup } from './model-drawing.ts';
import type { AutoFilter, ConditionalFormat, DataValidation, SortState, Table } from './model-features.ts';
import type { Hyperlink, Note, PageSetup, ProtectedRange, SheetProtection, ThreadedComment } from './model-page.ts';
import type { PivotCache, PivotTable } from './model-pivot.ts';
import type { Color, RichRun, Styles, Theme } from './model-styles.ts';

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
  /** Caches de donnees des tableaux croises dynamiques. */
  pivotCaches?: PivotCache[];
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
  /** Tableaux croises dynamiques places sur la feuille (les cellules resultat sont dans `cells`). */
  pivotTables?: PivotTable[];
  pageSetup: PageSetup;
  protection?: SheetProtection;
  protectedRanges: ProtectedRange[];
  /** Feuille graphique (onglet sans grille) : le premier dessin est le graphique. */
  isChartSheet?: boolean;
  /** Code de la feuille (nom VBA). */
  codeName?: string;
}
