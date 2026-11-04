// Ecriture d'un graphique DrawingML (chartN.xml) depuis ChartModel, dans l'ordre exige par le schema.
import { el, type XmlElement } from '@forgeoffice/opc';
import type {
  ChartAxis, ChartDataRef, ChartModel, ChartPlot, ChartSeries, ChartText, DataLabels, LineProperties, MarkerStyle, Trendline,
} from '../model.ts';
import { toFileFormula } from './formula-names.ts';
import { NS_A, NS_C, NS_R } from './ns.ts';

const v = (name: string, value: string | number | boolean | undefined): XmlElement[] =>
  value === undefined ? [] : [el(name, { val: typeof value === 'boolean' ? (value ? '1' : '0') : value })];

function solidFill(color: string): XmlElement {
  return el('a:solidFill', {}, [el('a:srgbClr', { val: color })]);
}

export function lineEl(line: LineProperties | undefined, color?: string): XmlElement[] {
  if (!line && !color) return [];
  const kids: XmlElement[] = [];
  if (line?.none) kids.push(el('a:noFill'));
  else if (line?.color ?? color) kids.push(solidFill(line?.color ?? color ?? '000000'));
  if (line?.dash) kids.push(el('a:prstDash', { val: line.dash }));
  return [el('a:ln', { w: line?.width !== undefined ? Math.round(line.width * 12700) : undefined }, kids)];
}

function spPr(fill: string | undefined, line: LineProperties | undefined, lineOnly = false): XmlElement[] {
  if (!fill && !line) return [];
  const kids: XmlElement[] = [];
  if (fill && !lineOnly) kids.push(solidFill(fill));
  kids.push(...lineEl(line, lineOnly ? fill : undefined));
  return [el('c:spPr', {}, kids)];
}

function richTx(text: ChartText): XmlElement {
  const paragraphs = (text.text ?? '').split('\n');
  const rPr = el('a:rPr', {
    lang: 'fr-FR',
    b: text.bold === undefined ? undefined : text.bold ? '1' : '0',
    sz: text.size !== undefined ? Math.round(text.size * 100) : undefined,
  }, text.color ? [solidFill(text.color)] : []);
  return el('c:tx', {}, [el('c:rich', {}, [
    el('a:bodyPr'),
    el('a:lstStyle'),
    ...paragraphs.map((p) => el('a:p', {}, [el('a:pPr', {}, [el('a:defRPr', { b: text.bold ? '1' : undefined })]), el('a:r', {}, [rPr, el('a:t', {}, [p])])])),
  ])]);
}

function strRefTx(ref: string, cached: string | undefined): XmlElement {
  return el('c:tx', {}, [el('c:strRef', {}, [
    el('c:f', {}, [toFileFormula(ref)]),
    ...(cached !== undefined ? [el('c:strCache', {}, [el('c:ptCount', { val: 1 }), el('c:pt', { idx: 0 }, [el('c:v', {}, [cached])])])] : []),
  ])]);
}

function titleEl(title: ChartText): XmlElement {
  return el('c:title', {}, [
    title.ref ? strRefTx(title.ref, title.text) : richTx(title),
    el('c:overlay', { val: title.overlay ? '1' : '0' }),
  ]);
}

function seriesTx(name: ChartText | undefined): XmlElement[] {
  if (!name) return [];
  if (name.ref) return [strRefTx(name.ref, name.text)];
  return [el('c:tx', {}, [el('c:v', {}, [name.text ?? ''])])];
}

function cacheEls(values: (number | string | null)[], tag: 'c:numCache' | 'c:strCache' | 'c:numLit' | 'c:strLit', formatCode?: string): XmlElement {
  const kids: XmlElement[] = [];
  if (tag === 'c:numCache' || tag === 'c:numLit') kids.push(el('c:formatCode', {}, [formatCode ?? 'General']));
  kids.push(el('c:ptCount', { val: values.length }));
  values.forEach((value, idx) => {
    if (value !== null && value !== '') kids.push(el('c:pt', { idx }, [el('c:v', {}, [String(value)])]));
  });
  return el(tag, {}, kids);
}

function isNumeric(ref: ChartDataRef): boolean {
  return (ref.cache ?? []).every((value) => value === null || typeof value === 'number');
}

/** `numeric` force le type ; sinon deduit du cache. */
function dataRefEl(tag: string, ref: ChartDataRef | undefined, numeric?: boolean): XmlElement[] {
  if (!ref) return [];
  const asNumber = numeric ?? isNumeric(ref);
  const cache = ref.cache ?? [];
  if (ref.ref) {
    return [el(tag, {}, [asNumber
      ? el('c:numRef', {}, [el('c:f', {}, [toFileFormula(ref.ref)]), cacheEls(cache, 'c:numCache', ref.formatCode)])
      : el('c:strRef', {}, [el('c:f', {}, [toFileFormula(ref.ref)]), cacheEls(cache, 'c:strCache')])])];
  }
  return [el(tag, {}, [cacheEls(cache, asNumber ? 'c:numLit' : 'c:strLit', ref.formatCode)])];
}

export function dataLabelsEl(labels: DataLabels | undefined): XmlElement[] {
  if (!labels) return [];
  if (labels.delete) return [el('c:dLbls', {}, [el('c:delete', { val: '1' })])];
  return [el('c:dLbls', {}, [
    ...(labels.numFmt ? [el('c:numFmt', { formatCode: labels.numFmt, sourceLinked: '0' })] : []),
    ...v('c:dLblPos', labels.position),
    el('c:showLegendKey', { val: labels.showLegendKey ? '1' : '0' }),
    el('c:showVal', { val: labels.showValue ? '1' : '0' }),
    el('c:showCatName', { val: labels.showCategory ? '1' : '0' }),
    el('c:showSerName', { val: labels.showSeriesName ? '1' : '0' }),
    el('c:showPercent', { val: labels.showPercent ? '1' : '0' }),
    el('c:showBubbleSize', { val: labels.showBubbleSize ? '1' : '0' }),
    ...(labels.separator !== undefined ? [el('c:separator', {}, [labels.separator])] : []),
    ...(labels.showLeaderLines !== undefined ? v('c:showLeaderLines', labels.showLeaderLines) : []),
  ])];
}

function markerEl(marker: MarkerStyle | undefined): XmlElement[] {
  if (!marker) return [];
  return [el('c:marker', {}, [
    el('c:symbol', { val: marker.symbol }),
    ...v('c:size', marker.size),
    ...(marker.color ? [el('c:spPr', {}, [solidFill(marker.color)])] : []),
  ])];
}

function trendlineEl(trend: Trendline): XmlElement {
  return el('c:trendline', {}, [
    ...(trend.name ? [el('c:name', {}, [trend.name])] : []),
    el('c:trendlineType', { val: trend.type }),
    ...v('c:order', trend.type === 'poly' ? (trend.order ?? 2) : undefined),
    ...v('c:period', trend.type === 'movingAvg' ? (trend.period ?? 2) : undefined),
    ...v('c:forward', trend.forward),
    ...v('c:backward', trend.backward),
    el('c:dispRSqr', { val: trend.displayRSquared ? '1' : '0' }),
    el('c:dispEq', { val: trend.displayEquation ? '1' : '0' }),
  ]);
}

function pointEls(series: ChartSeries, plot: ChartPlot): XmlElement[] {
  return Object.entries(series.pointColors ?? {}).map(([idx, color]) => el('c:dPt', {}, [
    el('c:idx', { val: idx }),
    ...(plot.type === 'bar' ? [el('c:invertIfNegative', { val: '0' })] : []),
    el('c:bubble3D', { val: '0' }),
    el('c:spPr', {}, [solidFill(color)]),
  ]));
}

function seriesEl(series: ChartSeries, plot: ChartPlot): XmlElement {
  const head = [el('c:idx', { val: series.idx }), el('c:order', { val: series.order }), ...seriesTx(series.name)];
  const lineLike = plot.type === 'line' || plot.type === 'scatter' || (plot.type === 'radar' && plot.radarStyle !== 'filled');
  const shape = spPr(series.color, series.line, lineLike);
  const labels = dataLabelsEl(series.dataLabels);
  const trends = (series.trendlines ?? []).map(trendlineEl);
  const points = pointEls(series, plot);
  switch (plot.type) {
    case 'bar':
      return el('c:ser', {}, [...head, ...shape, el('c:invertIfNegative', { val: series.invertIfNegative ? '1' : '0' }), ...points, ...labels, ...trends,
        ...dataRefEl('c:cat', series.categories), ...dataRefEl('c:val', series.values, true)]);
    case 'line':
      return el('c:ser', {}, [...head, ...shape, ...markerEl(series.marker), ...points, ...labels, ...trends,
        ...dataRefEl('c:cat', series.categories), ...dataRefEl('c:val', series.values, true), el('c:smooth', { val: series.smooth ? '1' : '0' })]);
    case 'pie':
    case 'doughnut':
      return el('c:ser', {}, [...head, ...shape, ...v('c:explosion', series.explosion), ...points, ...labels,
        ...dataRefEl('c:cat', series.categories), ...dataRefEl('c:val', series.values, true)]);
    case 'area':
      return el('c:ser', {}, [...head, ...shape, ...points, ...labels, ...trends,
        ...dataRefEl('c:cat', series.categories), ...dataRefEl('c:val', series.values, true)]);
    case 'radar':
      return el('c:ser', {}, [...head, ...shape, ...markerEl(series.marker), ...points, ...labels,
        ...dataRefEl('c:cat', series.categories), ...dataRefEl('c:val', series.values, true)]);
    case 'scatter':
      return el('c:ser', {}, [...head, ...shape, ...markerEl(series.marker), ...points, ...labels, ...trends,
        ...dataRefEl('c:xVal', series.xValues ?? series.categories), ...dataRefEl('c:yVal', series.values, true),
        el('c:smooth', { val: series.smooth ? '1' : '0' })]);
    case 'bubble':
      return el('c:ser', {}, [...head, ...shape, el('c:invertIfNegative', { val: '0' }), ...points, ...labels, ...trends,
        ...dataRefEl('c:xVal', series.xValues ?? series.categories), ...dataRefEl('c:yVal', series.values, true),
        ...dataRefEl('c:bubbleSize', series.bubbleSizes ?? { cache: series.values.cache?.map(() => 1) ?? [] }, true),
        el('c:bubble3D', { val: '0' })]);
  }
}

function axisIdEls(plot: ChartPlot): XmlElement[] {
  return plot.axisIds.map((id) => el('c:axId', { val: id }));
}

function plotEl(plot: ChartPlot): XmlElement {
  const series = plot.series.map((s) => seriesEl(s, plot));
  const labels = dataLabelsEl(plot.dataLabels);
  const vary = el('c:varyColors', { val: (plot.varyColors ?? (plot.type === 'pie' || plot.type === 'doughnut')) ? '1' : '0' });
  switch (plot.type) {
    case 'bar': {
      const grouping = plot.grouping ?? 'clustered';
      const stacked = grouping === 'stacked' || grouping === 'percentStacked';
      return el('c:barChart', {}, [
        el('c:barDir', { val: plot.barDirection ?? 'col' }),
        el('c:grouping', { val: grouping === 'standard' ? 'clustered' : grouping }),
        vary, ...series, ...labels,
        el('c:gapWidth', { val: plot.gapWidth ?? 219 }),
        ...v('c:overlap', plot.overlap ?? (stacked ? 100 : -27)),
        ...axisIdEls(plot),
      ]);
    }
    case 'line':
      return el('c:lineChart', {}, [el('c:grouping', { val: plot.grouping ?? 'standard' }), vary, ...series, ...labels,
        el('c:marker', { val: plot.markers === false ? '0' : '1' }), ...axisIdEls(plot)]);
    case 'pie':
      return el('c:pieChart', {}, [vary, ...series, ...labels, el('c:firstSliceAng', { val: plot.firstSliceAngle ?? 0 })]);
    case 'doughnut':
      return el('c:doughnutChart', {}, [vary, ...series, ...labels, el('c:firstSliceAng', { val: plot.firstSliceAngle ?? 0 }),
        el('c:holeSize', { val: plot.holeSize ?? 75 })]);
    case 'area':
      return el('c:areaChart', {}, [el('c:grouping', { val: plot.grouping ?? 'standard' }), vary, ...series, ...labels, ...axisIdEls(plot)]);
    case 'scatter':
      return el('c:scatterChart', {}, [el('c:scatterStyle', { val: plot.scatterStyle ?? 'lineMarker' }), vary, ...series, ...labels, ...axisIdEls(plot)]);
    case 'radar':
      return el('c:radarChart', {}, [el('c:radarStyle', { val: plot.radarStyle ?? 'marker' }), vary, ...series, ...labels, ...axisIdEls(plot)]);
    case 'bubble':
      return el('c:bubbleChart', {}, [vary, ...series, ...labels, el('c:bubbleScale', { val: plot.bubbleScale ?? 100 }),
        el('c:showNegBubbles', { val: plot.showNegativeBubbles ? '1' : '0' }), ...axisIdEls(plot)]);
  }
}

const GRID_LINE = el('c:spPr', {}, [el('a:ln', { w: 9525, cap: 'flat', cmpd: 'sng', algn: 'ctr' }, [
  el('a:solidFill', {}, [el('a:schemeClr', { val: 'tx1' }, [el('a:lumMod', { val: 15000 }), el('a:lumOff', { val: 85000 })])]),
  el('a:round'),
])]);

function axisEl(axis: ChartAxis): XmlElement {
  const tag = axis.kind === 'value' ? 'c:valAx' : axis.kind === 'date' ? 'c:dateAx' : axis.kind === 'series' ? 'c:serAx' : 'c:catAx';
  const scaling = el('c:scaling', {}, [
    ...v('c:logBase', axis.logBase),
    el('c:orientation', { val: axis.reverse ? 'maxMin' : 'minMax' }),
    ...v('c:max', axis.max),
    ...v('c:min', axis.min),
  ]);
  const common: XmlElement[] = [
    el('c:axId', { val: axis.id }),
    scaling,
    el('c:delete', { val: axis.deleted ? '1' : '0' }),
    el('c:axPos', { val: axis.position }),
    ...(axis.majorGridlines ? [el('c:majorGridlines', {}, [GRID_LINE])] : []),
    ...(axis.minorGridlines ? [el('c:minorGridlines')] : []),
    ...(axis.title ? [titleEl(axis.title)] : []),
    el('c:numFmt', { formatCode: axis.numFmt ?? 'General', sourceLinked: axis.numFmt ? '0' : '1' }),
    el('c:majorTickMark', { val: axis.majorTickMark ?? (axis.kind === 'value' ? 'none' : 'out') }),
    el('c:minorTickMark', { val: axis.minorTickMark ?? 'none' }),
    el('c:tickLblPos', { val: axis.tickLabelPosition ?? 'nextTo' }),
    el('c:crossAx', { val: axis.crossAxisId }),
    ...(axis.crossesAt !== undefined ? v('c:crossesAt', axis.crossesAt) : [el('c:crosses', { val: axis.crosses ?? 'autoZero' })]),
  ];
  if (axis.kind === 'value') {
    return el(tag, {}, [...common, el('c:crossBetween', { val: axis.crossBetween ?? 'between' }), ...v('c:majorUnit', axis.majorUnit), ...v('c:minorUnit', axis.minorUnit)]);
  }
  if (axis.kind === 'date') {
    return el(tag, {}, [...common, el('c:auto', { val: '1' }), el('c:lblOffset', { val: 100 }), el('c:baseTimeUnit', { val: 'days' }),
      ...v('c:majorUnit', axis.majorUnit), ...v('c:minorUnit', axis.minorUnit)]);
  }
  if (axis.kind === 'series') return el(tag, {}, common);
  return el(tag, {}, [...common, el('c:auto', { val: '1' }), el('c:lblAlgn', { val: 'ctr' }), el('c:lblOffset', { val: 100 }), el('c:noMultiLvlLbl', { val: '0' })]);
}

/** Complete les axes manquants (graphiques construits a la main) : categorie + valeur par trace. */
export function ensureAxes(chart: ChartModel): ChartModel {
  const axes = [...chart.axes];
  const plots = chart.plots.map((plot) => {
    if (plot.type === 'pie' || plot.type === 'doughnut') return { ...plot, axisIds: [] };
    if (plot.axisIds.length >= 2 && plot.axisIds.every((id) => axes.some((a) => a.id === id))) return plot;
    const base = 500000000 + axes.length * 10;
    const xKind = plot.type === 'scatter' || plot.type === 'bubble' ? 'value' : 'category';
    const horizontal = plot.type === 'bar' && plot.barDirection === 'bar';
    axes.push(
      { id: base + 1, kind: xKind, position: horizontal ? 'l' : 'b', crossAxisId: base + 2 },
      { id: base + 2, kind: 'value', position: horizontal ? 'b' : 'l', crossAxisId: base + 1, majorGridlines: true },
    );
    return { ...plot, axisIds: [base + 1, base + 2] };
  });
  return { ...chart, plots, axes };
}

export function writeChart(source: ChartModel): XmlElement {
  const chart = ensureAxes(source);
  const usedAxes = new Set(chart.plots.flatMap((p) => p.axisIds));
  const chartKids: XmlElement[] = [];
  if (chart.title) chartKids.push(titleEl(chart.title));
  chartKids.push(el('c:autoTitleDeleted', { val: chart.autoTitleDeleted || !chart.title ? '1' : '0' }));
  chartKids.push(el('c:plotArea', {}, [
    el('c:layout'),
    ...chart.plots.map(plotEl),
    ...chart.axes.filter((a) => usedAxes.has(a.id)).map(axisEl),
  ]));
  if (chart.legend) {
    chartKids.push(el('c:legend', {}, [el('c:legendPos', { val: chart.legend.position }), el('c:overlay', { val: chart.legend.overlay ? '1' : '0' })]));
  }
  chartKids.push(el('c:plotVisOnly', { val: chart.plotVisibleOnly === false ? '0' : '1' }));
  chartKids.push(el('c:dispBlanksAs', { val: chart.displayBlanksAs ?? 'gap' }));
  return el('c:chartSpace', { 'xmlns:c': NS_C, 'xmlns:a': NS_A, 'xmlns:r': NS_R }, [
    el('c:date1904', { val: '0' }),
    el('c:lang', { val: 'fr-FR' }),
    el('c:roundedCorners', { val: chart.roundedCorners ? '1' : '0' }),
    ...v('c:style', chart.style),
    el('c:chart', {}, chartKids),
  ]);
}
