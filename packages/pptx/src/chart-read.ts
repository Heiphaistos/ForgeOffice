// Lecture d'une partie graphique (c:chartSpace) vers ChartModel.
import { attr, child, children, numAttr, textOf, type XmlElement } from '@forgeoffice/opc';
import type { ChartAxis, ChartCategories, ChartDataLabels, ChartModel, ChartPlot, ChartSeries, ChartText, ChartTrendline, ChartType, ChartValues } from './chart.ts';
import { readFill, readLine, readRunProps, type DmlReadContext } from './dml-read.ts';
import type { RunProps } from './dml.ts';

/** Nombre maximal de points lus par serie (fichiers hostiles). */
const MAX_POINTS = 100_000;

const val = (node: XmlElement | undefined, name: string): string | undefined => attr(child(node, name), 'val');
const numVal = (node: XmlElement | undefined, name: string): number | undefined => numAttr(child(node, name), 'val');
const boolVal = (node: XmlElement | undefined, name: string): boolean | undefined => {
  const element = child(node, name);
  if (!element) return undefined;
  const raw = attr(element, 'val');
  return raw === undefined || raw === '1' || raw === 'true';
};

const TYPES: Readonly<Record<string, { type: ChartType; is3D?: boolean }>> = {
  'c:barChart': { type: 'bar' },
  'c:bar3DChart': { type: 'bar', is3D: true },
  'c:lineChart': { type: 'line' },
  'c:line3DChart': { type: 'line', is3D: true },
  'c:pieChart': { type: 'pie' },
  'c:pie3DChart': { type: 'pie', is3D: true },
  'c:doughnutChart': { type: 'doughnut' },
  'c:areaChart': { type: 'area' },
  'c:area3DChart': { type: 'area', is3D: true },
  'c:scatterChart': { type: 'scatter' },
  'c:radarChart': { type: 'radar' },
  'c:bubbleChart': { type: 'bubble' },
  'c:stockChart': { type: 'stock' },
  'c:surfaceChart': { type: 'surface' },
  'c:surface3DChart': { type: 'surface', is3D: true },
  'c:ofPieChart': { type: 'ofPie' },
};

function cachePoints(cache: XmlElement | undefined): Map<number, string> {
  const points = new Map<number, string>();
  for (const pt of children(cache, 'c:pt')) {
    const idx = numAttr(pt, 'idx') ?? points.size;
    if (idx >= 0 && idx < MAX_POINTS) points.set(idx, textOf(child(pt, 'c:v')));
  }
  return points;
}

function pointCount(cache: XmlElement | undefined, points: Map<number, string>): number {
  const declared = numVal(cache, 'c:ptCount');
  const max = points.size ? Math.max(...points.keys()) + 1 : 0;
  return Math.min(MAX_POINTS, Math.max(declared ?? 0, max));
}

function readValues(node: XmlElement | undefined): ChartValues {
  const ref = child(node, 'c:numRef') ?? child(node, 'c:numLit');
  const cache = child(ref, 'c:numCache') ?? (ref?.name === 'c:numLit' ? ref : undefined);
  const points = cachePoints(cache);
  const values: Array<number | null> = [];
  for (let i = 0; i < pointCount(cache, points); i++) {
    const raw = points.get(i);
    const n = raw === undefined || raw === '' ? Number.NaN : Number(raw);
    values.push(Number.isFinite(n) ? n : null);
  }
  const out: ChartValues = { values };
  const f = textOf(child(ref, 'c:f'));
  if (f) out.ref = f;
  const format = textOf(child(cache, 'c:formatCode'));
  if (format) out.formatCode = format;
  return out;
}

function readCategories(node: XmlElement | undefined): ChartCategories {
  if (!node) return { labels: [] };
  const numeric = child(node, 'c:numRef') ?? child(node, 'c:numLit');
  if (numeric) {
    const values = readValues(node);
    const out: ChartCategories = { labels: values.values.map((v) => (v === null ? '' : String(v))), numeric: true };
    if (values.ref) out.ref = values.ref;
    if (values.formatCode) out.formatCode = values.formatCode;
    return out;
  }
  const ref = child(node, 'c:strRef') ?? child(node, 'c:strLit') ?? child(node, 'c:multiLvlStrRef');
  const cache = child(ref, 'c:strCache') ?? child(ref, 'c:multiLvlStrCache') ?? (ref?.name === 'c:strLit' ? ref : undefined);
  // Categories a plusieurs niveaux : on garde le niveau le plus fin.
  const level = cache?.name === 'c:multiLvlStrCache' ? child(cache, 'c:lvl') : cache;
  const points = cachePoints(level);
  const count = Math.min(MAX_POINTS, Math.max(numVal(cache, 'c:ptCount') ?? 0, points.size ? Math.max(...points.keys()) + 1 : 0));
  const out: ChartCategories = { labels: Array.from({ length: count }, (_, i) => points.get(i) ?? '') };
  const f = textOf(child(ref, 'c:f'));
  if (f) out.ref = f;
  return out;
}

function firstRun(txPr: XmlElement | undefined, ctx: DmlReadContext): RunProps | undefined {
  const defRPr = child(child(child(txPr, 'a:p'), 'a:pPr'), 'a:defRPr');
  if (!defRPr) return undefined;
  const props = readRunProps(defRPr, ctx);
  return Object.keys(props).length ? props : undefined;
}

function readText(node: XmlElement | undefined, ctx: DmlReadContext): ChartText | undefined {
  if (!node) return undefined;
  const out: ChartText = {};
  const tx = child(node, 'c:tx');
  const rich = child(tx, 'c:rich');
  if (rich) {
    out.text = children(rich, 'a:p').map((p) => children(p, 'a:r').map((r) => textOf(child(r, 'a:t'))).join('')).join('\n');
    const firstRunProps = child(child(child(rich, 'a:p'), 'a:r'), 'a:rPr');
    const props = firstRunProps ? readRunProps(firstRunProps, ctx) : firstRun(rich, ctx);
    if (props && Object.keys(props).length) out.props = props;
  } else if (tx) {
    out.text = children(child(child(tx, 'c:strRef'), 'c:strCache'), 'c:pt').map((pt) => textOf(child(pt, 'c:v'))).join(' ');
  }
  const txProps = firstRun(child(node, 'c:txPr'), ctx);
  if (txProps && !out.props) out.props = txProps;
  const overlay = boolVal(node, 'c:overlay');
  if (overlay !== undefined) out.overlay = overlay;
  return out;
}

function readLabels(node: XmlElement | undefined, ctx: DmlReadContext): ChartDataLabels | undefined {
  if (!node || boolVal(node, 'c:delete')) return undefined;
  const labels: ChartDataLabels = {};
  const flags: Array<[keyof ChartDataLabels, string]> = [
    ['showValue', 'c:showVal'],
    ['showCategory', 'c:showCatName'],
    ['showSeriesName', 'c:showSerName'],
    ['showPercent', 'c:showPercent'],
    ['showLegendKey', 'c:showLegendKey'],
    ['showBubbleSize', 'c:showBubbleSize'],
  ];
  for (const [key, tag] of flags) {
    const value = boolVal(node, tag);
    if (value !== undefined) (labels as Record<string, unknown>)[key] = value;
  }
  const position = val(node, 'c:dLblPos');
  if (position) labels.position = position;
  const separator = textOf(child(node, 'c:separator'));
  if (separator) labels.separator = separator;
  const format = attr(child(node, 'c:numFmt'), 'formatCode');
  if (format) labels.numberFormat = format;
  const props = firstRun(child(node, 'c:txPr'), ctx);
  if (props) labels.props = props;
  return labels;
}

function readTrendline(node: XmlElement, ctx: DmlReadContext): ChartTrendline {
  const trend: ChartTrendline = { type: val(node, 'c:trendlineType') ?? 'linear' };
  const name = textOf(child(node, 'c:name'));
  if (name) trend.name = name;
  const numeric: Array<[keyof ChartTrendline, string]> = [['order', 'c:order'], ['period', 'c:period'], ['forward', 'c:forward'], ['backward', 'c:backward'], ['intercept', 'c:intercept']];
  for (const [key, tag] of numeric) {
    const value = numVal(node, tag);
    if (value !== undefined) (trend as unknown as Record<string, unknown>)[key] = value;
  }
  const eq = boolVal(node, 'c:dispEq');
  if (eq !== undefined) trend.displayEquation = eq;
  const r2 = boolVal(node, 'c:dispRSqr');
  if (r2 !== undefined) trend.displayR2 = r2;
  const line = readLine(child(child(node, 'c:spPr'), 'a:ln'), ctx);
  if (line) trend.line = line;
  return trend;
}

function readSeries(node: XmlElement, ctx: DmlReadContext): ChartSeries {
  const tx = child(node, 'c:tx');
  const nameRef = child(tx, 'c:strRef');
  const name = nameRef ? children(child(nameRef, 'c:strCache'), 'c:pt').map((pt) => textOf(child(pt, 'c:v'))).join(' ') : textOf(child(tx, 'c:v'));
  const xVal = child(node, 'c:xVal');
  const yVal = child(node, 'c:yVal');
  const series: ChartSeries = {
    name,
    categories: readCategories(child(node, 'c:cat') ?? xVal),
    values: readValues(child(node, 'c:val') ?? yVal),
  };
  const f = textOf(child(nameRef, 'c:f'));
  if (f) series.nameRef = f;
  if (xVal) series.xValues = readValues(xVal);
  const sizes = child(node, 'c:bubbleSize');
  if (sizes) series.bubbleSizes = readValues(sizes);
  const spPr = child(node, 'c:spPr');
  const fill = readFill(spPr, ctx);
  if (fill) series.fill = fill;
  const line = readLine(child(spPr, 'a:ln'), ctx);
  if (line) series.line = line;
  const marker = child(node, 'c:marker');
  if (marker) {
    series.marker = { symbol: val(marker, 'c:symbol') ?? 'auto' };
    const size = numVal(marker, 'c:size');
    if (size !== undefined) series.marker.size = size;
    const markerFill = readFill(child(marker, 'c:spPr'), ctx);
    if (markerFill) series.marker.fill = markerFill;
    const markerLine = readLine(child(child(marker, 'c:spPr'), 'a:ln'), ctx);
    if (markerLine) series.marker.line = markerLine;
  }
  const labels = readLabels(child(node, 'c:dLbls'), ctx);
  if (labels) series.dataLabels = labels;
  const smooth = boolVal(node, 'c:smooth');
  if (smooth !== undefined) series.smooth = smooth;
  const explosion = numVal(node, 'c:explosion');
  if (explosion !== undefined) series.explosion = explosion;
  const invert = boolVal(node, 'c:invertIfNegative');
  if (invert !== undefined) series.invertIfNegative = invert;
  const points = children(node, 'c:dPt').map((dPt) => {
    const point: NonNullable<ChartSeries['points']>[number] = { index: numVal(dPt, 'c:idx') ?? 0 };
    const pointFill = readFill(child(dPt, 'c:spPr'), ctx);
    if (pointFill) point.fill = pointFill;
    const pointLine = readLine(child(child(dPt, 'c:spPr'), 'a:ln'), ctx);
    if (pointLine) point.line = pointLine;
    const pointExplosion = numVal(dPt, 'c:explosion');
    if (pointExplosion !== undefined) point.explosion = pointExplosion;
    return point;
  });
  if (points.length) series.points = points;
  const trendlines = children(node, 'c:trendline').map((t) => readTrendline(t, ctx));
  if (trendlines.length) series.trendlines = trendlines;
  return series;
}

function readPlot(node: XmlElement, ctx: DmlReadContext): ChartPlot | undefined {
  const kind = TYPES[node.name];
  if (!kind) return undefined;
  const plot: ChartPlot = {
    type: kind.type,
    series: children(node, 'c:ser').map((s) => readSeries(s, ctx)),
    axisIds: children(node, 'c:axId').map((a) => numAttr(a, 'val') ?? 0),
  };
  if (kind.is3D) plot.is3D = true;
  const barDir = val(node, 'c:barDir');
  if (barDir) plot.barDirection = barDir as 'bar' | 'col';
  const grouping = val(node, 'c:grouping');
  if (grouping) plot.grouping = grouping as ChartPlot['grouping'];
  const vary = boolVal(node, 'c:varyColors');
  if (vary !== undefined) plot.varyColors = vary;
  const numeric: Array<[keyof ChartPlot, string]> = [['gapWidth', 'c:gapWidth'], ['overlap', 'c:overlap'], ['holeSize', 'c:holeSize'], ['firstSliceAngle', 'c:firstSliceAng'], ['bubbleScale', 'c:bubbleScale']];
  for (const [key, tag] of numeric) {
    const value = numVal(node, tag);
    if (value !== undefined) (plot as unknown as Record<string, unknown>)[key] = value;
  }
  const scatter = val(node, 'c:scatterStyle');
  if (scatter) plot.scatterStyle = scatter;
  const radar = val(node, 'c:radarStyle');
  if (radar) plot.radarStyle = radar;
  const marker = boolVal(node, 'c:marker');
  if (marker !== undefined) plot.showMarkers = marker;
  const shape = val(node, 'c:shape');
  if (shape) plot.shape = shape;
  const ofPie = val(node, 'c:ofPieType');
  if (ofPie) plot.ofPieType = ofPie as 'pie' | 'bar';
  const negative = boolVal(node, 'c:showNegBubbles');
  if (negative !== undefined) plot.showNegativeBubbles = negative;
  if (child(node, 'c:dropLines')) plot.dropLines = true;
  if (child(node, 'c:hiLowLines')) plot.highLowLines = true;
  if (child(node, 'c:upDownBars')) plot.upDownBars = true;
  const labels = readLabels(child(node, 'c:dLbls'), ctx);
  if (labels) plot.dataLabels = labels;
  return plot;
}

const AXIS_TYPES: Readonly<Record<string, ChartAxis['type']>> = { 'c:catAx': 'cat', 'c:valAx': 'val', 'c:dateAx': 'date', 'c:serAx': 'ser' };

function readAxis(node: XmlElement, ctx: DmlReadContext): ChartAxis | undefined {
  const type = AXIS_TYPES[node.name];
  if (!type) return undefined;
  const axis: ChartAxis = {
    id: numVal(node, 'c:axId') ?? 0,
    type,
    position: (val(node, 'c:axPos') ?? 'b') as ChartAxis['position'],
    crossAxisId: numVal(node, 'c:crossAx') ?? 0,
  };
  const scaling = child(node, 'c:scaling');
  const min = numVal(scaling, 'c:min');
  if (min !== undefined) axis.min = min;
  const max = numVal(scaling, 'c:max');
  if (max !== undefined) axis.max = max;
  const logBase = numVal(scaling, 'c:logBase');
  if (logBase !== undefined) axis.logBase = logBase;
  if (val(scaling, 'c:orientation') === 'maxMin') axis.reverse = true;
  const deleted = boolVal(node, 'c:delete');
  if (deleted !== undefined) axis.deleted = deleted;
  const major = child(node, 'c:majorGridlines');
  if (major) {
    const line = readLine(child(child(major, 'c:spPr'), 'a:ln'), ctx);
    axis.majorGridlines = line ? { line } : {};
  }
  const minor = child(node, 'c:minorGridlines');
  if (minor) {
    const line = readLine(child(child(minor, 'c:spPr'), 'a:ln'), ctx);
    axis.minorGridlines = line ? { line } : {};
  }
  const title = readText(child(node, 'c:title'), ctx);
  if (title) axis.title = title;
  const numFmt = child(node, 'c:numFmt');
  if (numFmt) axis.numberFormat = { code: attr(numFmt, 'formatCode') ?? 'General', sourceLinked: attr(numFmt, 'sourceLinked') === '1' };
  const majorTick = val(node, 'c:majorTickMark');
  if (majorTick) axis.majorTickMark = majorTick as ChartAxis['majorTickMark'];
  const minorTick = val(node, 'c:minorTickMark');
  if (minorTick) axis.minorTickMark = minorTick as ChartAxis['minorTickMark'];
  const tickPos = val(node, 'c:tickLblPos');
  if (tickPos) axis.tickLabelPosition = tickPos as ChartAxis['tickLabelPosition'];
  const crosses = val(node, 'c:crosses');
  const crossesAt = numVal(node, 'c:crossesAt');
  if (crosses) axis.crosses = crosses as 'autoZero' | 'min' | 'max';
  else if (crossesAt !== undefined) axis.crosses = crossesAt;
  const between = val(node, 'c:crossBetween');
  if (between) axis.crossBetween = between as 'between' | 'midCat';
  const majorUnit = numVal(node, 'c:majorUnit');
  if (majorUnit !== undefined) axis.majorUnit = majorUnit;
  const minorUnit = numVal(node, 'c:minorUnit');
  if (minorUnit !== undefined) axis.minorUnit = minorUnit;
  const line = readLine(child(child(node, 'c:spPr'), 'a:ln'), ctx);
  if (line) axis.line = line;
  const props = firstRun(child(node, 'c:txPr'), ctx);
  if (props) axis.textProps = props;
  return axis;
}

/** Lit c:chartSpace. */
export function readChart(root: XmlElement, ctx: DmlReadContext): ChartModel {
  const chart = child(root, 'c:chart');
  const plotArea = child(chart, 'c:plotArea');
  const model: ChartModel = {
    plots: children(plotArea).map((n) => readPlot(n, ctx)).filter((p): p is ChartPlot => p !== undefined),
    axes: children(plotArea).map((n) => readAxis(n, ctx)).filter((a): a is ChartAxis => a !== undefined),
  };
  const titleNode = child(chart, 'c:title');
  if (titleNode) model.title = readText(titleNode, ctx) ?? {};
  const autoDeleted = boolVal(chart, 'c:autoTitleDeleted');
  if (autoDeleted !== undefined) model.autoTitleDeleted = autoDeleted;
  const legend = child(chart, 'c:legend');
  if (legend) {
    model.legend = { position: (val(legend, 'c:legendPos') ?? 'r') as 'r' | 'l' | 't' | 'b' | 'tr' };
    const overlay = boolVal(legend, 'c:overlay');
    if (overlay !== undefined) model.legend.overlay = overlay;
    const props = firstRun(child(legend, 'c:txPr'), ctx);
    if (props) model.legend.props = props;
  } else {
    model.legend = null;
  }
  const style = numVal(root, 'c:style');
  if (style !== undefined) model.style = style;
  const rounded = boolVal(root, 'c:roundedCorners');
  if (rounded !== undefined) model.roundedCorners = rounded;
  const visible = boolVal(chart, 'c:plotVisOnly');
  if (visible !== undefined) model.plotVisibleOnly = visible;
  const blanks = val(chart, 'c:dispBlanksAs');
  if (blanks) model.displayBlanksAs = blanks as 'gap' | 'zero' | 'span';
  const lang = val(root, 'c:lang');
  if (lang) model.language = lang;
  const spPr = child(root, 'c:spPr');
  const chartFill = readFill(spPr, ctx);
  if (chartFill) model.chartFill = chartFill;
  const chartLine = readLine(child(spPr, 'a:ln'), ctx);
  if (chartLine) model.chartLine = chartLine;
  const plotSpPr = child(plotArea, 'c:spPr');
  const plotFill = readFill(plotSpPr, ctx);
  if (plotFill) model.plotFill = plotFill;
  const plotLine = readLine(child(plotSpPr, 'a:ln'), ctx);
  if (plotLine) model.plotLine = plotLine;
  const textProps = firstRun(child(root, 'c:txPr'), ctx);
  if (textProps) model.textProps = textProps;
  const view = child(chart, 'c:view3D');
  if (view) {
    model.view3D = {};
    const rotX = numVal(view, 'c:rotX');
    if (rotX !== undefined) model.view3D.rotX = rotX;
    const rotY = numVal(view, 'c:rotY');
    if (rotY !== undefined) model.view3D.rotY = rotY;
    const perspective = numVal(view, 'c:perspective');
    if (perspective !== undefined) model.view3D.perspective = perspective;
    const right = boolVal(view, 'c:rAngAx');
    if (right !== undefined) model.view3D.rightAngleAxes = right;
  }
  if (child(plotArea, 'c:dTable')) model.dataTable = true;
  return model;
}
