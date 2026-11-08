// Éléments de graphique : titres d'axes, axes, quadrillage, étiquettes de données (opérations pures sur le modèle de graphique).
import type { ChartAxis, ChartDataLabels, ChartModel, Line } from '@forgeoffice/pptx';

export type AxisOrient = 'h' | 'v';
export type GridKind = 'major' | 'minor';
export type LabelMode = 'none' | 'value' | 'category' | 'valueCategory' | 'percent';
export type LabelPosition = 'ctr' | 'inEnd' | 'inBase' | 'outEnd';

const horizontal = (a: ChartAxis): boolean => a.position === 'b' || a.position === 't';

/** Premier axe horizontal ou vertical (d'apres sa position : un histogramme barres a ses categories a gauche). */
export function axisOf(c: ChartModel, o: AxisOrient): ChartAxis | undefined {
  return c.axes.find((a) => horizontal(a) === (o === 'h'));
}

export const hasAxisTitle = (c: ChartModel, o: AxisOrient): boolean => !!axisOf(c, o)?.title;

/** Ajoute (texte `text`) ou retire le titre d'un axe. */
export function setAxisTitle(c: ChartModel, o: AxisOrient, text: string | null): void {
  const a = axisOf(c, o);
  if (!a) return;
  if (text === null) delete a.title;
  else a.title = { text, props: { size: 10 } };
}

export const axisVisible = (c: ChartModel, o: AxisOrient): boolean => !!axisOf(c, o) && !axisOf(c, o)?.deleted;

export function setAxisVisible(c: ChartModel, o: AxisOrient, on: boolean): void {
  const a = axisOf(c, o);
  if (!a) return;
  if (on) delete a.deleted;
  else a.deleted = true;
}

const GRID: Line = { width: 0.75, fill: { type: 'solid', color: { type: 'rgb', value: 'D9D9D9' } } };

/** Axe porteur du quadrillage « horizontal » (lignes) = axe des valeurs ; « vertical » = axe des categories. */
function gridAxis(c: ChartModel, o: AxisOrient): ChartAxis | undefined {
  const horizontalLines = o === 'h';
  return c.axes.find((a) => (horizontalLines ? a.type === 'val' : a.type !== 'val'));
}

export function hasGrid(c: ChartModel, o: AxisOrient, kind: GridKind): boolean {
  const a = gridAxis(c, o);
  return !!(kind === 'major' ? a?.majorGridlines : a?.minorGridlines);
}

export function setGrid(c: ChartModel, o: AxisOrient, kind: GridKind, on: boolean): void {
  const a = gridAxis(c, o);
  if (!a) return;
  const value = on ? { line: { ...GRID, ...(kind === 'minor' ? { width: 0.5 } : {}) } } : undefined;
  if (kind === 'major') a.majorGridlines = value;
  else a.minorGridlines = value;
  if (!value) delete a[kind === 'major' ? 'majorGridlines' : 'minorGridlines'];
}

export function labelMode(l: ChartDataLabels | undefined): LabelMode {
  if (!l) return 'none';
  if (l.showPercent) return 'percent';
  if (l.showValue && l.showCategory) return 'valueCategory';
  if (l.showCategory) return 'category';
  return l.showValue ? 'value' : 'none';
}

/** Etiquettes de donnees du premier trace ; la position choisie est conservee. */
export function setLabels(c: ChartModel, mode: LabelMode): void {
  const p = c.plots[0];
  if (!p) return;
  if (mode === 'none') {
    delete p.dataLabels;
    return;
  }
  const position = p.dataLabels?.position;
  p.dataLabels = {
    ...(mode === 'value' || mode === 'valueCategory' ? { showValue: true } : {}),
    ...(mode === 'category' || mode === 'valueCategory' ? { showCategory: true } : {}),
    ...(mode === 'percent' ? { showPercent: true } : {}),
    ...(position ? { position } : {}),
  };
}

export function setLabelPosition(c: ChartModel, position: LabelPosition): void {
  const p = c.plots[0];
  if (p?.dataLabels) p.dataLabels = { ...p.dataLabels, position };
}

// ---- Courbes de tendance et barres d'erreur (toutes les series du premier trace) ----

export type TrendKind = 'none' | 'linear' | 'exp' | 'log' | 'poly' | 'power' | 'movingAvg';
export type ErrorKind = 'none' | 'stdErr' | 'percentage' | 'stdDev' | 'fixed';

/** Types de trace qui acceptent ces superpositions. */
export const supportsOverlays = (c: ChartModel): boolean => ['bar', 'line', 'area', 'scatter'].includes(c.plots[0]?.type ?? '');

export function trendKind(c: ChartModel): TrendKind {
  const t = c.plots[0]?.series[0]?.trendlines?.[0]?.type;
  return t === 'linear' || t === 'exp' || t === 'log' || t === 'poly' || t === 'power' || t === 'movingAvg' ? t : 'none';
}

export function setTrend(c: ChartModel, kind: TrendKind): void {
  for (const s of c.plots[0]?.series ?? []) {
    if (kind === 'none') delete s.trendlines;
    else s.trendlines = [{ type: kind, ...(kind === 'poly' ? { order: 2 } : {}), ...(kind === 'movingAvg' ? { period: 2 } : {}) }];
  }
}

export function errorKind(c: ChartModel): ErrorKind {
  const e = c.plots[0]?.series[0]?.errorBars?.[0];
  return e ? (e.valueType === 'fixed' ? 'fixed' : e.valueType) : 'none';
}

const ERROR_VALUES: Readonly<Record<Exclude<ErrorKind, 'none'>, number | undefined>> = { stdErr: undefined, percentage: 5, stdDev: 1, fixed: 1 };

export function setErrorBars(c: ChartModel, kind: ErrorKind): void {
  for (const s of c.plots[0]?.series ?? []) {
    if (kind === 'none') delete s.errorBars;
    else s.errorBars = [{ barType: 'both', valueType: kind, ...(ERROR_VALUES[kind] === undefined ? {} : { value: ERROR_VALUES[kind] }) }];
  }
}
