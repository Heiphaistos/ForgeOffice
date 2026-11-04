// Contrat du Tableur (suite) : mises en forme conditionnelles, validation des donnees, filtres et tris, tableaux.
// Re-exporte par model.ts : importer depuis './model.ts'.
import type { Color } from './model-styles.ts';
import type { CellRange } from './model.ts';

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
