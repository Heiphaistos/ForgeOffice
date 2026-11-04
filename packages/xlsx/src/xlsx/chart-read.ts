// Lecture d'un graphique DrawingML (chartN.xml) vers ChartModel.
import { isElement, textOf, type XmlElement } from '@forgeoffice/opc';
import type {
  ChartAxis, ChartDataRef, ChartLegend, ChartModel, ChartPlot, ChartPlotType, ChartSeries, ChartText, DataLabels,
  LineProperties, MarkerStyle, Trendline,
} from '../model.ts';
import { fromFileFormula } from './formula-names.ts';
import { int, kid, kids, localName, num, str, val } from './xml-util.ts';

const PLOT_TYPES: Readonly<Record<string, ChartPlotType>> = {
  barChart: 'bar', bar3DChart: 'bar', lineChart: 'line', line3DChart: 'line', stockChart: 'line', pieChart: 'pie',
  pie3DChart: 'pie', ofPieChart: 'pie', doughnutChart: 'doughnut', areaChart: 'area', area3DChart: 'area',
  scatterChart: 'scatter', radarChart: 'radar', bubbleChart: 'bubble',
};

function flagVal(parent: XmlElement | undefined, name: string): boolean | undefined {
  const node = kid(parent, name);
  if (!node) return undefined;
  const v = str(node, 'val');
  return v === undefined || v === '1' || v === 'true';
}

/** Couleur « RRGGBB » d'un remplissage plein DrawingML (couleurs explicites seulement). */
export function solidColor(parent: XmlElement | undefined): string | undefined {
  const fill = kid(parent, 'solidFill');
  const rgb = kid(fill, 'srgbClr');
  return rgb ? str(rgb, 'val')?.toUpperCase() : undefined;
}

export function readLine(ln: XmlElement | undefined): LineProperties | undefined {
  if (!ln) return undefined;
  const line: LineProperties = {};
  if (kid(ln, 'noFill')) line.none = true;
  const color = solidColor(ln);
  if (color) line.color = color;
  const width = num(ln, 'w');
  if (width !== undefined) line.width = Math.round((width / 12700) * 100) / 100;
  const dash = val(ln, 'prstDash');
  if (dash) line.dash = dash as LineProperties['dash'];
  return Object.keys(line).length ? line : undefined;
}

function richText(tx: XmlElement | undefined): string {
  const rich = kid(tx, 'rich');
  if (!rich) return '';
  return kids(rich, 'p').map((p) => kids(p, 'r').map((r) => textOf(kid(r, 't'))).join('') + kids(p, 'fld').map((f) => textOf(kid(f, 't'))).join('')).join('\n');
}

function readChartText(node: XmlElement | undefined): ChartText | undefined {
  if (!node) return undefined;
  const tx = kid(node, 'tx');
  const out: ChartText = {};
  const strRef = kid(tx, 'strRef');
  if (strRef) {
    out.ref = fromFileFormula(textOf(kid(strRef, 'f')));
    const cached = kid(kid(strRef, 'strCache'), 'pt');
    if (cached) out.text = textOf(kid(cached, 'v'));
  } else if (kid(tx, 'rich')) {
    out.text = richText(tx);
  } else if (kid(tx, 'v')) {
    out.text = textOf(kid(tx, 'v'));
  }
  const overlay = flagVal(node, 'overlay');
  if (overlay) out.overlay = true;
  const firstRun = kid(kid(kid(kid(tx, 'rich'), 'p'), 'r'), 'rPr') ?? kid(kid(kid(kid(tx, 'rich'), 'p'), 'pPr'), 'defRPr');
  if (firstRun) {
    if (str(firstRun, 'b') === '1') out.bold = true;
    const size = num(firstRun, 'sz');
    if (size) out.size = size / 100;
    const color = solidColor(firstRun);
    if (color) out.color = color;
  }
  return out;
}

/** Valeurs en cache ; `countHolder` porte « ptCount » quand il differe (cache multi-niveaux). */
function readCache(cache: XmlElement | undefined, numeric: boolean, countHolder?: XmlElement): (number | string | null)[] {
  if (!cache) return [];
  const count = Math.min(int(kid(countHolder ?? cache, 'ptCount'), 'val') ?? 0, 1_000_000);
  const values: (number | string | null)[] = new Array<number | string | null>(count).fill(null);
  for (const pt of kids(cache, 'pt')) {
    const idx = int(pt, 'idx') ?? 0;
    if (idx < 0 || idx >= 1_000_000) continue;
    const raw = textOf(kid(pt, 'v'));
    const n = Number(raw);
    values[idx] = numeric && raw !== '' && Number.isFinite(n) ? n : raw;
  }
  return values;
}

function readDataRef(node: XmlElement | undefined): ChartDataRef | undefined {
  if (!node) return undefined;
  const numRef = kid(node, 'numRef');
  const strRef = kid(node, 'strRef') ?? kid(node, 'multiLvlStrRef');
  const numLit = kid(node, 'numLit');
  const strLit = kid(node, 'strLit');
  const out: ChartDataRef = {};
  if (numRef) {
    out.ref = fromFileFormula(textOf(kid(numRef, 'f')));
    const cache = kid(numRef, 'numCache');
    out.cache = readCache(cache, true);
    const fmt = textOf(kid(cache, 'formatCode'));
    if (fmt) out.formatCode = fmt;
  } else if (strRef) {
    out.ref = fromFileFormula(textOf(kid(strRef, 'f')));
    const multi = kid(strRef, 'multiLvlStrCache');
    out.cache = multi ? readCache(kid(multi, 'lvl'), false, multi) : readCache(kid(strRef, 'strCache'), false);
  } else if (numLit) {
    out.cache = readCache(numLit, true);
  } else if (strLit) {
    out.cache = readCache(strLit, false);
  }
  return out;
}

export function readDataLabels(node: XmlElement | undefined): DataLabels | undefined {
  if (!node) return undefined;
  const labels: DataLabels = {};
  if (flagVal(node, 'delete')) return { delete: true };
  const map: [keyof DataLabels, string][] = [
    ['showValue', 'showVal'], ['showCategory', 'showCatName'], ['showSeriesName', 'showSerName'], ['showPercent', 'showPercent'],
    ['showLegendKey', 'showLegendKey'], ['showBubbleSize', 'showBubbleSize'], ['showLeaderLines', 'showLeaderLines'],
  ];
  for (const [key, tag] of map) {
    const value = flagVal(node, tag);
    if (value) (labels as Record<string, boolean>)[key] = true;
  }
  const pos = val(node, 'dLblPos');
  if (pos) labels.position = pos as DataLabels['position'];
  const sep = textOf(kid(node, 'separator'));
  if (sep) labels.separator = sep;
  const fmt = str(kid(node, 'numFmt'), 'formatCode');
  if (fmt) labels.numFmt = fmt;
  return labels;
}

function readMarker(node: XmlElement | undefined): MarkerStyle | undefined {
  if (!node) return undefined;
  const marker: MarkerStyle = { symbol: (val(node, 'symbol') ?? 'auto') as MarkerStyle['symbol'] };
  const size = int(kid(node, 'size'), 'val');
  if (size !== undefined) marker.size = size;
  const color = solidColor(kid(node, 'spPr'));
  if (color) marker.color = color;
  return marker;
}

function readTrendline(node: XmlElement): Trendline {
  const trend: Trendline = { type: (val(node, 'trendlineType') ?? 'linear') as Trendline['type'] };
  const order = int(kid(node, 'order'), 'val');
  if (order !== undefined) trend.order = order;
  const period = int(kid(node, 'period'), 'val');
  if (period !== undefined) trend.period = period;
  const name = textOf(kid(node, 'name'));
  if (name) trend.name = name;
  if (flagVal(node, 'dispEq')) trend.displayEquation = true;
  if (flagVal(node, 'dispRSqr')) trend.displayRSquared = true;
  const forward = num(kid(node, 'forward'), 'val');
  if (forward) trend.forward = forward;
  const backward = num(kid(node, 'backward'), 'val');
  if (backward) trend.backward = backward;
  return trend;
}

function readSeries(node: XmlElement, index: number): ChartSeries {
  const series: ChartSeries = {
    idx: int(kid(node, 'idx'), 'val') ?? index,
    order: int(kid(node, 'order'), 'val') ?? index,
    values: readDataRef(kid(node, 'val') ?? kid(node, 'yVal')) ?? {},
  };
  const name = readChartText(node);
  if (name && (name.text !== undefined || name.ref)) series.name = name;
  const cat = readDataRef(kid(node, 'cat'));
  if (cat) series.categories = cat;
  const x = readDataRef(kid(node, 'xVal'));
  if (x) series.xValues = x;
  const bubbles = readDataRef(kid(node, 'bubbleSize'));
  if (bubbles) series.bubbleSizes = bubbles;
  const sp = kid(node, 'spPr');
  const color = solidColor(sp) ?? solidColor(kid(sp, 'ln'));
  if (color) series.color = color;
  const line = readLine(kid(sp, 'ln'));
  if (line) series.line = line;
  const marker = readMarker(kid(node, 'marker'));
  if (marker) series.marker = marker;
  const smooth = flagVal(node, 'smooth');
  if (smooth) series.smooth = true;
  const labels = readDataLabels(kid(node, 'dLbls'));
  if (labels) series.dataLabels = labels;
  if (flagVal(node, 'invertIfNegative')) series.invertIfNegative = true;
  const explosion = int(kid(node, 'explosion'), 'val');
  if (explosion) series.explosion = explosion;
  const trends = kids(node, 'trendline').map(readTrendline);
  if (trends.length) series.trendlines = trends;
  const points: Record<number, string> = {};
  for (const dPt of kids(node, 'dPt')) {
    const idx = int(kid(dPt, 'idx'), 'val');
    const pointColor = solidColor(kid(dPt, 'spPr'));
    if (idx !== undefined && pointColor) points[idx] = pointColor;
  }
  if (Object.keys(points).length) series.pointColors = points;
  return series;
}

function readPlot(node: XmlElement, type: ChartPlotType): ChartPlot {
  const plot: ChartPlot = {
    type,
    series: kids(node, 'ser').map(readSeries),
    axisIds: kids(node, 'axId').map((a) => int(a, 'val') ?? 0),
  };
  const dir = val(node, 'barDir');
  if (type === 'bar') plot.barDirection = dir === 'bar' ? 'bar' : 'col';
  const grouping = val(node, 'grouping');
  if (grouping) plot.grouping = grouping as ChartPlot['grouping'];
  const vary = flagVal(node, 'varyColors');
  if (vary !== undefined) plot.varyColors = vary;
  const labels = readDataLabels(kid(node, 'dLbls'));
  if (labels) plot.dataLabels = labels;
  const gap = int(kid(node, 'gapWidth'), 'val');
  if (gap !== undefined) plot.gapWidth = gap;
  const overlap = int(kid(node, 'overlap'), 'val');
  if (overlap !== undefined) plot.overlap = overlap;
  const angle = int(kid(node, 'firstSliceAng'), 'val');
  if (angle !== undefined) plot.firstSliceAngle = angle;
  const hole = int(kid(node, 'holeSize'), 'val');
  if (hole !== undefined) plot.holeSize = hole;
  const scatter = val(node, 'scatterStyle');
  if (scatter) plot.scatterStyle = scatter as ChartPlot['scatterStyle'];
  const radar = val(node, 'radarStyle');
  if (radar) plot.radarStyle = radar as ChartPlot['radarStyle'];
  const scale = int(kid(node, 'bubbleScale'), 'val');
  if (scale !== undefined) plot.bubbleScale = scale;
  if (flagVal(node, 'showNegBubbles')) plot.showNegativeBubbles = true;
  const markers = flagVal(node, 'marker');
  if (markers !== undefined) plot.markers = markers;
  return plot;
}

function readAxis(node: XmlElement): ChartAxis {
  const tag = localName(node.name);
  const axis: ChartAxis = {
    id: int(kid(node, 'axId'), 'val') ?? 0,
    kind: tag === 'valAx' ? 'value' : tag === 'dateAx' ? 'date' : tag === 'serAx' ? 'series' : 'category',
    position: (val(node, 'axPos') ?? 'b') as ChartAxis['position'],
    crossAxisId: int(kid(node, 'crossAx'), 'val') ?? 0,
  };
  const title = readChartText(kid(node, 'title'));
  if (title) axis.title = title;
  if (flagVal(node, 'delete')) axis.deleted = true;
  const scaling = kid(node, 'scaling');
  const min = num(kid(scaling, 'min'), 'val');
  if (min !== undefined) axis.min = min;
  const max = num(kid(scaling, 'max'), 'val');
  if (max !== undefined) axis.max = max;
  const log = num(kid(scaling, 'logBase'), 'val');
  if (log !== undefined) axis.logBase = log;
  if (val(scaling, 'orientation') === 'maxMin') axis.reverse = true;
  const major = num(kid(node, 'majorUnit'), 'val');
  if (major !== undefined) axis.majorUnit = major;
  const minor = num(kid(node, 'minorUnit'), 'val');
  if (minor !== undefined) axis.minorUnit = minor;
  const fmt = str(kid(node, 'numFmt'), 'formatCode');
  if (fmt && str(kid(node, 'numFmt'), 'sourceLinked') !== '1') axis.numFmt = fmt;
  if (kid(node, 'majorGridlines')) axis.majorGridlines = true;
  if (kid(node, 'minorGridlines')) axis.minorGridlines = true;
  const crosses = val(node, 'crosses');
  if (crosses) axis.crosses = crosses as ChartAxis['crosses'];
  const at = num(kid(node, 'crossesAt'), 'val');
  if (at !== undefined) axis.crossesAt = at;
  const tick = val(node, 'tickLblPos');
  if (tick) axis.tickLabelPosition = tick as ChartAxis['tickLabelPosition'];
  const majorTick = val(node, 'majorTickMark');
  if (majorTick) axis.majorTickMark = majorTick as ChartAxis['majorTickMark'];
  const minorTick = val(node, 'minorTickMark');
  if (minorTick) axis.minorTickMark = minorTick as ChartAxis['minorTickMark'];
  const between = val(node, 'crossBetween');
  if (between) axis.crossBetween = between as ChartAxis['crossBetween'];
  return axis;
}

export function readChart(root: XmlElement): ChartModel {
  const chart = kid(root, 'chart');
  const plotArea = kid(chart, 'plotArea');
  const model: ChartModel = { plots: [], axes: [] };
  for (const node of plotArea?.children ?? []) {
    if (!isElement(node)) continue;
    const tag = localName(node.name);
    const type = PLOT_TYPES[tag];
    if (type) model.plots.push(readPlot(node, type));
    else if (tag === 'catAx' || tag === 'valAx' || tag === 'dateAx' || tag === 'serAx') model.axes.push(readAxis(node));
  }
  const title = readChartText(kid(chart, 'title'));
  if (title) model.title = title;
  if (flagVal(chart, 'autoTitleDeleted')) model.autoTitleDeleted = true;
  const legendNode = kid(chart, 'legend');
  if (legendNode) {
    const legend: ChartLegend = { position: (val(legendNode, 'legendPos') ?? 'r') as ChartLegend['position'] };
    if (flagVal(legendNode, 'overlay')) legend.overlay = true;
    model.legend = legend;
  }
  const style = int(kid(root, 'style'), 'val');
  if (style !== undefined) model.style = style;
  const visible = flagVal(chart, 'plotVisOnly');
  if (visible !== undefined) model.plotVisibleOnly = visible;
  const blanks = val(chart, 'dispBlanksAs');
  if (blanks === 'gap' || blanks === 'span' || blanks === 'zero') model.displayBlanksAs = blanks;
  const rounded = flagVal(root, 'roundedCorners');
  if (rounded !== undefined) model.roundedCorners = rounded;
  return model;
}

/** Type principal affichable d'un graphique (« combo » si plusieurs traces de types differents). */
export function chartKind(chart: ChartModel): ChartPlotType | 'combo' {
  const types = new Set(chart.plots.map((p) => p.type));
  if (types.size > 1) return 'combo';
  return chart.plots[0]?.type ?? 'bar';
}
