// Entrees du menu « Ajouter un élément de graphique » : titres d'axes, axes, quadrillage, étiquettes de données.
import type { ChartModel } from '@forgeoffice/pptx';
import type { MenuItem } from '@forgeoffice/ui';
import { axisVisible, errorKind, hasAxisTitle, hasGrid, labelMode, setAxisTitle, setErrorBars, setTrend, supportsOverlays, trendKind, setAxisVisible, setGrid, setLabelPosition, setLabels, type AxisOrient, type ErrorKind, type LabelMode, type LabelPosition, type TrendKind } from './chart-elements.ts';
import { S3 } from './strings-text.ts';

type Edit = (recipe: (c: ChartModel) => void, group?: string) => void;

export function chartElementItems(chart: ChartModel, edit: Edit): MenuItem[] {
  const C = S3.chart;
  const orients: ReadonlyArray<[AxisOrient, string]> = [['h', C.horizontal], ['v', C.vertical]];
  const modes: ReadonlyArray<[LabelMode, string]> = [['none', C.labelNone], ['value', C.labelValue], ['category', C.labelCategory], ['valueCategory', C.labelBoth], ['percent', C.labelPercent]];
  const positions: ReadonlyArray<[LabelPosition, string]> = [['ctr', C.posCenter], ['inEnd', C.posInside], ['outEnd', C.posOutside], ['inBase', C.posBase]];
  const current = labelMode(chart.plots[0]?.dataLabels);
  const labelsOn = current !== 'none';
  return [
    {
      id: 'axisTitles', label: C.axisTitles,
      items: orients.map(([o, label]) => ({ id: `t${o}`, label, checked: hasAxisTitle(chart, o), onClick: () => edit((c) => setAxisTitle(c, o, hasAxisTitle(c, o) ? null : C.axisTitleDefault), 'chart-axis-title') })),
    },
    {
      id: 'axes', label: C.axes,
      items: orients.map(([o, label]) => ({ id: `a${o}`, label, checked: axisVisible(chart, o), onClick: () => edit((c) => setAxisVisible(c, o, !axisVisible(c, o)), 'chart-axis') })),
    },
    {
      id: 'labels', label: S3.chart.dataLabels,
      items: [
        ...modes.map(([m, label]) => ({ id: `l${m}`, label, checked: current === m, onClick: () => edit((c) => setLabels(c, m), 'chart-labels') })),
        { id: 'lsep', kind: 'separator' as const },
        ...positions.map(([p, label]) => ({ id: `p${p}`, label, disabled: !labelsOn, checked: chart.plots[0]?.dataLabels?.position === p, onClick: () => edit((c) => setLabelPosition(c, p), 'chart-labels') })),
      ],
    },
    {
      id: 'trend', label: C.trendline, disabled: !supportsOverlays(chart),
      items: (Object.keys(C.trendNames) as TrendKind[]).map((k) => ({ id: `tr${k}`, label: C.trendNames[k], checked: trendKind(chart) === k, onClick: () => edit((c) => setTrend(c, k), 'chart-trend') })),
    },
    {
      id: 'errorBars', label: C.errorBars, disabled: !supportsOverlays(chart),
      items: (Object.keys(C.errorNames) as ErrorKind[]).map((k) => ({ id: `eb${k}`, label: C.errorNames[k], checked: errorKind(chart) === k, onClick: () => edit((c) => setErrorBars(c, k), 'chart-errors') })),
    },
    {
      id: 'grid', label: C.gridlines,
      items: [
        { id: 'gHM', label: C.gridHMajor, checked: hasGrid(chart, 'h', 'major'), onClick: () => edit((c) => setGrid(c, 'h', 'major', !hasGrid(c, 'h', 'major')), 'chart-grid') },
        { id: 'gVM', label: C.gridVMajor, checked: hasGrid(chart, 'v', 'major'), onClick: () => edit((c) => setGrid(c, 'v', 'major', !hasGrid(c, 'v', 'major')), 'chart-grid') },
        { id: 'gHm', label: C.gridHMinor, checked: hasGrid(chart, 'h', 'minor'), onClick: () => edit((c) => setGrid(c, 'h', 'minor', !hasGrid(c, 'h', 'minor')), 'chart-grid') },
        { id: 'gVm', label: C.gridVMinor, checked: hasGrid(chart, 'v', 'minor'), onClick: () => edit((c) => setGrid(c, 'v', 'minor', !hasGrid(c, 'v', 'minor')), 'chart-grid') },
      ],
    },
  ];
}
