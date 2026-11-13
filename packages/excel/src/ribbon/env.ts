// Contexte fourni aux onglets du ruban par l'application.
import type { ReactNode } from 'react';
import type { ChartObject, IconSetName, Sheet, ShapeObject, Table, Workbook } from '@forgeoffice/xlsx';
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
  /** Plan automatique des lignes (groupes deduits des formules SOMME / SOUS.TOTAL). */
  outlineAuto: () => void;
  /** Revision : commentaire/note precedent(e) ou suivant(e), suppression de la note de la cellule active, notes toujours visibles. */
  reviewNav: (dir: 1 | -1) => void;
  deleteNote: () => void;
  toggleAllNotes: (visible: boolean) => void;
  allNotesVisible: boolean;
  insertShape: (geometry: string, textBox?: boolean) => void;
  insertPivot: () => void;
  /** Formulaire des champs du tableau croise (panneau Parametres du profil OnlyOffice). */
  pivotForm?: () => ReactNode;
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
  /** Zone Nom : atteint une plage ou une feuille (« B2 », « 'Feuil2'!A1 »). */
  navigate: (ref: string) => void;
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
  /** Forme selectionnee (onglet Format de forme) et modification de ses proprietes. */
  shapeObj: ShapeObject | undefined;
  shapeEdit: (patch: Partial<ShapeObject>) => void;
  chartKind: (kind: ChartKind) => void;
  chartSwitch: () => void;
  chartLegend: (pos: 'r' | 'b' | 't' | 'l' | 'none') => void;
  chartLabels: (show: boolean) => void;
  chartTitle: (show: boolean) => void;
  chartAxisTitle: (target: 'category' | 'value', show: boolean) => void;
  chartTrend: (on: boolean) => void;
  chartLabelPos: (pos: 'none' | 'ctr' | 'inEnd' | 'outEnd') => void;
  /** Index du dessin selectionne (graphique) pour les boites de saisie de texte. */
  chartIndex: number | null;
  chartGrid: (show: boolean) => void;
  chartPalette: (index: number) => void;
  chartDelete: () => void;
  pivotActive: boolean;
  pivotRefresh: () => void;
  iconSet: (set: IconSetName) => void;
  flashFill: () => void;
  protectToggle: (target: 'sheet' | 'book') => void;
}
