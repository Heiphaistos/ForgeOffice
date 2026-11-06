// Contexte fourni aux onglets du ruban par l'application.
import type { ChartObject, IconSetName, Sheet, Table, Workbook } from '@forgeoffice/xlsx';
import type { ChartKind } from '../logic/charts.ts';
import type { PasteWhat } from '../logic/clipboard.ts';
import type { Selection } from '../logic/selection.ts';
import type { Commands, Ctx } from '../ui/commands.ts';

export interface UiFlags {
  showFormulas: boolean;
  formulaBar: boolean;
  commentsPane: boolean;
  pivotPane: boolean;
  calcManual: boolean;
  arrows: boolean;
  /** Mini-barre de mise en forme au clic droit. */
  miniBar: boolean;
}

export interface RibbonEnv {
  cmd: Commands;
  ctx: Ctx;
  wb: Workbook;
  sheet: Sheet;
  si: number;
  sel: Selection;
  ui: UiFlags;
  setUi: (patch: Partial<UiFlags>) => void;
  paste: (what?: PasteWhat | 'transpose') => void;
  cut: () => void;
  copy: () => void;
  painter: { active: boolean; start: () => void };
  insertChart: (kind: ChartKind) => void;
  insertImage: () => void;
  insertPivot: () => void;
  insertComment: () => void;
  importCsv: () => void;
  /** F9 (sans argument), Maj+F9 ('sheet') ou Ctrl+Alt+F9 ('all'). */
  recalc: (scope?: 'sheet' | 'all') => void;
  trace: (dir: 'precedents' | 'dependents' | 'clear' | 'clearPrecedents' | 'clearDependents') => void;
  newWindow: () => void;
  setZoom: (zoom: number) => void;
  zoomToSelection: () => void;
  autofit: (axis: 'row' | 'col') => void;
  renameSheet: () => void;
  addSheet: () => void;
  deleteSheet: () => void;
  outline: (axis: 'row' | 'col', delta: 1 | -1) => void;
  showDetail: (show: boolean) => void;
  insertFunction: (name?: string) => void;
  themeColors: (name: string) => void;
  printArea: (set: boolean | 'add') => void;
  pageBreak: (op: 'insert' | 'remove' | 'reset') => void;
  table: Table | undefined;
  tableOption: (patch: Partial<NonNullable<Table['style']>> & { total?: boolean; header?: boolean; filter?: boolean; name?: string; styleName?: string }) => void;
  tableToRange: () => void;
  chart: ChartObject | undefined;
  chartKind: (kind: ChartKind) => void;
  chartSwitch: () => void;
  chartLegend: (pos: 'r' | 'b' | 't' | 'l' | 'none') => void;
  chartLabels: (show: boolean) => void;
  chartTitle: (show: boolean) => void;
  chartGrid: (show: boolean) => void;
  chartPalette: (index: number) => void;
  chartDelete: () => void;
  pivotActive: boolean;
  pivotRefresh: () => void;
  iconSet: (set: IconSetName) => void;
  flashFill: () => void;
  protectToggle: (target: 'sheet' | 'book') => void;
}
