// Graphiques : creation d'un ChartModel (modele du fichier .xlsx) a partir d'une plage, changement de type,
// inversion lignes/colonnes, et resolution des series (valeurs lues dans le moteur) pour le rendu SVG.
import type { Scalar } from '@forgeoffice/formulas';
import { columnName, quoteSheetName, type CellRange, type ChartModel, type ChartPlot, type ChartSeries } from '@forgeoffice/xlsx';

export type ChartKind = 'col' | 'colStacked' | 'bar' | 'line' | 'lineMarkers' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'combo';

export const CHART_KINDS: readonly ChartKind[] = ['col', 'colStacked', 'bar', 'line', 'lineMarkers', 'pie', 'doughnut', 'area', 'scatter', 'combo'];

/** Couleurs par defaut des series (accents du theme Office 2023+). */
export const SERIES_COLORS = ['156082', 'E97132', '196B24', '0F9ED5', 'A02B93', '4EA72E', '467886', 'F4A6B5'];

/** Palettes « Modifier les couleurs ». */
export const CHART_PALETTES: readonly (readonly string[])[] = [
  SERIES_COLORS,
  ['4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47'],
  ['107C41', '33A35F', '5CC27F', '8DD9A5', 'BDEDCB', '0B5A2F'],
  ['185ABD', '2B7CD3', '41A5EE', '8CC8F8', 'C3E1FB', '0E3E85'],
  ['C43E1C', 'E36C3F', 'F3A47F', 'FAD3BF', '8A2B13', 'F0C33C'],
  ['404040', '7F7F7F', 'A5A5A5', 'BFBFBF', 'D9D9D9', '262626'],
];

function ref(sheet: string, r1: number, c1: number, r2: number, c2: number): string {
  const a = `$${columnName(c1)}$${r1 + 1}`;
  const b = `$${columnName(c2)}$${r2 + 1}`;
  return `${quoteSheetName(sheet)}!${a === b ? a : `${a}:${b}`}`;
}

/** Disposition deduite d'une plage : premiere ligne d'en-tetes, premiere colonne de categories (texte). */
export function analyzeRange(range: CellRange, valueAt: (r: number, c: number) => Scalar): { header: boolean; catCol: boolean } {
  const first = valueAt(range.r1, range.c1);
  let header = false;
  for (let c = range.c1 + 1; c <= range.c2; c++) if (typeof valueAt(range.r1, c) === 'string') header = true;
  if (range.r1 === range.r2) header = false;
  let catCol = false;
  for (let r = range.r1 + (header ? 1 : 0); r <= range.r2; r++) if (typeof valueAt(r, range.c1) === 'string') catCol = true;
  if (first === null && range.c2 > range.c1 && range.r2 > range.r1) {
    header = true;
    catCol = true;
  }
  if (range.c1 === range.c2) catCol = false;
  return { header, catCol };
}

/** Graphique construit depuis une plage : une serie par colonne (ou par ligne si `byRows`). */
export function buildChart(kind: ChartKind, sheet: string, range: CellRange, valueAt: (r: number, c: number) => Scalar, title: string, byRows = false): ChartModel {
  const { header, catCol } = analyzeRange(range, valueAt);
  const dataR1 = range.r1 + (header ? 1 : 0);
  const dataC1 = range.c1 + (catCol ? 1 : 0);
  const series: ChartSeries[] = [];
  if (!byRows) {
    for (let c = dataC1; c <= range.c2; c++) {
      const s: ChartSeries = { idx: series.length, order: series.length, values: { ref: ref(sheet, dataR1, c, range.r2, c) } };
      if (header) s.name = { ref: ref(sheet, range.r1, c, range.r1, c) };
      if (catCol) s.categories = { ref: ref(sheet, dataR1, range.c1, range.r2, range.c1) };
      else if (header && kind === 'scatter') s.categories = undefined;
      series.push(s);
    }
  } else {
    for (let r = dataR1; r <= range.r2; r++) {
      const s: ChartSeries = { idx: series.length, order: series.length, values: { ref: ref(sheet, r, dataC1, r, range.c2) } };
      if (catCol) s.name = { ref: ref(sheet, r, range.c1, r, range.c1) };
      if (header) s.categories = { ref: ref(sheet, range.r1, dataC1, range.r1, range.c2) };
      series.push(s);
    }
  }
  const t = valueAt(range.r1, range.c1);
  const chartTitle = series.length === 1 && series[0]?.name ? { ref: series[0].name.ref } : { text: typeof t === 'string' && t && !catCol ? t : title };
  return { ...withKind({ plots: [], axes: [] }, kind, series), title: chartTitle, legend: { position: 'b' }, plotVisibleOnly: true };
}

/** Change le type d'un graphique en conservant ses series. */
export function withKind(model: ChartModel, kind: ChartKind, series?: ChartSeries[]): ChartModel {
  const all = series ?? model.plots.flatMap((p) => p.series);
  const axes = [
    { id: 1, kind: 'category' as const, position: kind === 'bar' ? 'l' as const : 'b' as const, crossAxisId: 2 },
    { id: 2, kind: 'value' as const, position: kind === 'bar' ? 'b' as const : 'l' as const, crossAxisId: 1, majorGridlines: true },
  ];
  const plot = (p: Omit<ChartPlot, 'axisIds'>): ChartPlot => ({ ...p, axisIds: [1, 2] });
  let plots: ChartPlot[];
  switch (kind) {
    case 'col': plots = [plot({ type: 'bar', barDirection: 'col', grouping: 'clustered', series: all, gapWidth: 219, overlap: -27 })]; break;
    case 'colStacked': plots = [plot({ type: 'bar', barDirection: 'col', grouping: 'stacked', series: all, gapWidth: 150, overlap: 100 })]; break;
    case 'bar': plots = [plot({ type: 'bar', barDirection: 'bar', grouping: 'clustered', series: all, gapWidth: 182 })]; break;
    case 'line': plots = [plot({ type: 'line', grouping: 'standard', series: all.map((s) => ({ ...s, marker: { symbol: 'none' } })) })]; break;
    case 'lineMarkers': plots = [plot({ type: 'line', grouping: 'standard', markers: true, series: all.map((s) => ({ ...s, marker: { symbol: 'circle', size: 5 } })) })]; break;
    case 'area': plots = [plot({ type: 'area', grouping: 'standard', series: all })]; break;
    case 'scatter': plots = [plot({ type: 'scatter', scatterStyle: 'lineMarker', series: all.map((s) => ({ ...s, xValues: s.categories, marker: { symbol: 'circle', size: 6 }, line: { none: true } })) })]; break;
    case 'pie': return { ...model, plots: [{ type: 'pie', varyColors: true, series: all.slice(0, 1), axisIds: [], firstSliceAngle: 0 }], axes: [], legend: model.legend ?? { position: 'b' } };
    case 'doughnut': return { ...model, plots: [{ type: 'doughnut', varyColors: true, series: all, axisIds: [], holeSize: 50, firstSliceAngle: 0 }], axes: [], legend: model.legend ?? { position: 'b' } };
    case 'combo': {
      const [first, ...rest] = all;
      plots = [plot({ type: 'bar', barDirection: 'col', grouping: 'clustered', series: first ? [first] : [], gapWidth: 219 })];
      if (rest.length) plots.push({ type: 'line', grouping: 'standard', markers: true, series: rest.map((s) => ({ ...s, marker: { symbol: 'circle', size: 5 } })), axisIds: [1, 2] });
      break;
    }
  }
  return { ...model, plots, axes };
}

/** Type d'un modele existant (pour la galerie « Modifier le type »). */
export function kindOf(model: ChartModel): ChartKind {
  const p = model.plots[0];
  if (!p) return 'col';
  if (model.plots.length > 1) return 'combo';
  switch (p.type) {
    case 'bar': return p.barDirection === 'bar' ? 'bar' : p.grouping === 'stacked' || p.grouping === 'percentStacked' ? 'colStacked' : 'col';
    case 'line': return p.markers || p.series.some((s) => s.marker && s.marker.symbol !== 'none') ? 'lineMarkers' : 'line';
    case 'pie': return 'pie';
    case 'doughnut': return 'doughnut';
    case 'area': return 'area';
    case 'scatter':
    case 'bubble': return 'scatter';
    default: return 'col';
  }
}

export interface ResolvedSeries {
  name: string;
  values: (number | null)[];
  x: (number | null)[];
  color: string;
  plot: ChartPlot;
  series: ChartSeries;
}

export interface ResolvedChart {
  title: string | null;
  categories: string[];
  series: ResolvedSeries[];
}

/** Lit les valeurs d'une reference (la fonction de lecture renvoie la plage en lignes). */
export type ReadRef = (ref: string) => Scalar[][];

function flat(rows: Scalar[][]): Scalar[] {
  return rows.length === 1 ? rows[0] ?? [] : rows.map((r) => r[0] ?? null);
}

/** Resout titres, categories et valeurs (references lues, sinon cache du fichier). */
export function resolveChart(model: ChartModel, read: ReadRef, text: (v: Scalar) => string, palette: readonly string[] = SERIES_COLORS): ResolvedChart {
  const series: ResolvedSeries[] = [];
  let categories: string[] = [];
  let i = 0;
  for (const plot of model.plots) {
    for (const s of plot.series) {
      const vals = s.values.ref ? flat(read(s.values.ref)) : (s.values.cache ?? []);
      const cats = s.categories?.ref ? flat(read(s.categories.ref)) : (s.categories?.cache ?? []);
      if (cats.length && !categories.length) categories = cats.map((c) => text(c ?? null));
      const xs = s.xValues?.ref ? flat(read(s.xValues.ref)) : (s.xValues?.cache ?? []);
      const name = s.name?.ref ? text(flat(read(s.name.ref))[0] ?? null) : (s.name?.text ?? '');
      series.push({
        name: name || `Série${i + 1}`,
        values: vals.map((v) => (typeof v === 'number' ? v : null)),
        x: xs.map((v) => (typeof v === 'number' ? v : null)),
        color: s.color ?? palette[i % palette.length] ?? '156082',
        plot,
        series: s,
      });
      i++;
    }
  }
  const len = Math.max(0, ...series.map((s) => s.values.length));
  if (!categories.length) categories = Array.from({ length: len }, (_, k) => String(k + 1));
  let title: string | null = null;
  if (model.title && !model.autoTitleDeleted) title = model.title.ref ? text(flat(read(model.title.ref))[0] ?? null) : (model.title.text ?? null);
  return { title, categories, series };
}

/** Graduations « rondes » d'un axe de valeurs (1, 2, 5 x 10^n). */
export function niceScale(min: number, max: number, ticks = 6): { min: number; max: number; step: number } {
  let lo = Math.min(0, min);
  let hi = Math.max(0, max);
  if (lo === hi) hi = lo + 1;
  const raw = (hi - lo) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  return { min: lo, max: hi, step };
}
