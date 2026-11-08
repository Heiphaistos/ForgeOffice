// Analyse rapide : menu de mise en forme, graphiques, totaux et tableau pour la plage selectionnee (bouton et Ctrl+Q).
import type { MenuItem } from '@forgeoffice/ui';
import type { ChartKind } from '../logic/charts.ts';
import type { Commands } from './commands.ts';
import { S } from '../strings/index.ts';

/** Evenement declenche par Ctrl+Q : la grille ouvre le menu a cote de la selection. */
export const QUICK_ANALYSIS_EVENT = 'fo-quick-analysis';

export function quickAnalysisItems(cmd: Commands, insertChart: (k: ChartKind) => void, createTable: () => void): MenuItem[] {
  const Q = S.quick;
  return [
    { id: 'format', label: Q.format, items: [
      { id: 'bars', label: Q.dataBars, onClick: () => cmd.dataBar('638EC6', true) },
      { id: 'scale', label: Q.colorScale, onClick: () => cmd.colorScale(['F8696B', 'FFEB84', '63BE7B']) },
      { id: 'icons', label: Q.iconSet, onClick: () => cmd.iconSet('3Arrows') },
      { id: 'dup', label: Q.duplicates, onClick: () => cmd.addCf({ type: 'duplicateValues' }, { font: { color: { rgb: 'FF9C0006' } }, fill: { type: 'pattern', pattern: 'solid', bg: { rgb: 'FFFFC7CE' } } }) },
    ] },
    { id: 'charts', label: Q.charts, items: [
      { id: 'col', label: S.chart.types.col ?? '', onClick: () => insertChart('col') },
      { id: 'line', label: S.chart.types.line ?? '', onClick: () => insertChart('line') },
      { id: 'pie', label: S.chart.types.pie ?? '', onClick: () => insertChart('pie') },
    ] },
    { id: 'totals', label: Q.totals, items: [
      { id: 'sum', label: Q.sum, onClick: () => cmd.autoSum('SUM') },
      { id: 'avg', label: Q.average, onClick: () => cmd.autoSum('AVERAGE') },
      { id: 'cnt', label: Q.count, onClick: () => cmd.autoSum('COUNT') },
    ] },
    { id: 'tables', label: Q.tables, items: [{ id: 'table', label: Q.table, onClick: createTable }] },
  ];
}
