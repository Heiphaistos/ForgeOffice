// Ecriture d'un ChartModel en c:chartSpace (ordre du schema respecte) et de son classeur de donnees incorpore.
import { el, PackageWriter, type XmlElement } from '@forgeoffice/opc';
import type { ChartAxis, ChartDataLabels, ChartModel, ChartPlot, ChartSeries, ChartText, ChartValues } from './chart.ts';
import { writeFill, writeLine, writeRunProps, type DmlWriteContext } from './dml-write.ts';
import type { Fill, Line, RunProps } from './dml.ts';
import { rootNamespaces } from './xmlns.ts';

const SHEET = 'Feuil1';

const v = (name: string, value: string | number | boolean | undefined): XmlElement | undefined =>
  value === undefined ? undefined : el(name, { val: typeof value === 'boolean' ? (value ? '1' : '0') : value });

const compact = (items: Array<XmlElement | undefined>): XmlElement[] => items.filter((x): x is XmlElement => x !== undefined);

function columnName(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Disposition des donnees dans la feuille incorporee : colonne de chaque vecteur. */
interface SeriesColumns {
  name: number;
  x?: number;
  y: number;
  size?: number;
}

interface SheetLayout {
  categories: string[];
  categoryColumn: number | undefined;
  series: Map<ChartSeries, SeriesColumns>;
  rows: number;
}

function layoutSheet(chart: ChartModel): SheetLayout {
  const all = chart.plots.flatMap((p) => p.series.map((s) => ({ plot: p, series: s })));
  const scatterOnly = chart.plots.length > 0 && chart.plots.every((p) => p.type === 'scatter' || p.type === 'bubble');
  const first = all[0]?.series;
  const categories = first ? first.categories.labels : [];
  let col = scatterOnly ? 0 : 1;
  const series = new Map<ChartSeries, SeriesColumns>();
  let rows = categories.length;
  for (const { plot, series: s } of all) {
    const xy = plot.type === 'scatter' || plot.type === 'bubble';
    const cols: SeriesColumns = { name: 0, y: 0 };
    if (xy) cols.x = col++;
    cols.y = col++;
    cols.name = cols.y;
    if (plot.type === 'bubble') cols.size = col++;
    series.set(s, cols);
    rows = Math.max(rows, s.values.values.length, s.xValues?.values.length ?? 0);
  }
  return { categories, categoryColumn: scatterOnly ? undefined : 0, series, rows };
}

const range = (col: number, count: number): string => `${SHEET}!$${columnName(col)}$2:$${columnName(col)}$${Math.max(2, count + 1)}`;

function numData(name: string, data: ChartValues, ref: string): XmlElement {
  const count = data.values.length;
  const points = data.values.map((value, idx) => (value === null ? undefined : el('c:pt', { idx }, [el('c:v', {}, [String(value)])]))).filter((x): x is XmlElement => x !== undefined);
  return el(name, {}, [el('c:numRef', {}, [el('c:f', {}, [ref]), el('c:numCache', {}, [el('c:formatCode', {}, [data.formatCode ?? 'General']), el('c:ptCount', { val: count }), ...points])])]);
}

function strData(name: string, labels: string[], ref: string): XmlElement {
  return el(name, {}, [
    el('c:strRef', {}, [el('c:f', {}, [ref]), el('c:strCache', {}, [el('c:ptCount', { val: labels.length }), ...labels.map((label, idx) => el('c:pt', { idx }, [el('c:v', {}, [label])]))])]),
  ]);
}

function spPr(ctx: DmlWriteContext, fill?: Fill, line?: Line): XmlElement | undefined {
  if (!fill && !line) return undefined;
  return el('c:spPr', {}, compact([writeFill(fill, ctx), line ? writeLine(line, ctx) : undefined]));
}

function txPr(props: RunProps | undefined, ctx: DmlWriteContext): XmlElement | undefined {
  if (!props) return undefined;
  return el('c:txPr', {}, [el('a:bodyPr'), el('a:lstStyle'), el('a:p', {}, [el('a:pPr', {}, [writeRunProps(props, ctx, 'a:defRPr')]), el('a:endParaRPr', { lang: 'fr-FR' })])]);
}

function title(text: ChartText, ctx: DmlWriteContext): XmlElement {
  const kids: XmlElement[] = [];
  if (text.text !== undefined) {
    const paragraphs = text.text.split('\n').map((line) => el('a:p', {}, [el('a:pPr', {}, [writeRunProps(text.props ?? {}, ctx, 'a:defRPr')]), el('a:r', {}, [writeRunProps({ lang: 'fr-FR', ...(text.props ?? {}) }, ctx), el('a:t', {}, [line])])]));
    kids.push(el('c:tx', {}, [el('c:rich', {}, [el('a:bodyPr'), el('a:lstStyle'), ...paragraphs])]));
  }
  kids.push(el('c:overlay', { val: text.overlay ? '1' : '0' }));
  const props = text.text === undefined ? txPr(text.props, ctx) : undefined;
  if (props) kids.push(props);
  return el('c:title', {}, kids);
}

function dataLabels(labels: ChartDataLabels, ctx: DmlWriteContext): XmlElement {
  return el(
    'c:dLbls',
    {},
    compact([
      labels.numberFormat ? el('c:numFmt', { formatCode: labels.numberFormat, sourceLinked: '0' }) : undefined,
      txPr(labels.props, ctx),
      v('c:dLblPos', labels.position),
      v('c:showLegendKey', labels.showLegendKey ?? false),
      v('c:showVal', labels.showValue ?? false),
      v('c:showCatName', labels.showCategory ?? false),
      v('c:showSerName', labels.showSeriesName ?? false),
      v('c:showPercent', labels.showPercent ?? false),
      v('c:showBubbleSize', labels.showBubbleSize ?? false),
      labels.separator ? el('c:separator', {}, [labels.separator]) : undefined,
    ]),
  );
}

function series(plot: ChartPlot, s: ChartSeries, index: number, layout: SheetLayout, ctx: DmlWriteContext): XmlElement {
  const cols = layout.series.get(s) ?? { name: index + 1, y: index + 1 };
  const kids: Array<XmlElement | undefined> = [
    v('c:idx', index),
    v('c:order', index),
    el('c:tx', {}, [el('c:strRef', {}, [el('c:f', {}, [`${SHEET}!$${columnName(cols.name)}$1`]), el('c:strCache', {}, [el('c:ptCount', { val: 1 }), el('c:pt', { idx: 0 }, [el('c:v', {}, [s.name])])])])]),
    spPr(ctx, s.fill, s.line),
  ];
  const type = plot.type;
  if (type === 'bar' || type === 'bubble') kids.push(v('c:invertIfNegative', s.invertIfNegative ?? false));
  if ((type === 'line' || type === 'scatter' || type === 'radar') && s.marker) {
    kids.push(el('c:marker', {}, compact([v('c:symbol', s.marker.symbol), v('c:size', s.marker.size), spPr(ctx, s.marker.fill, s.marker.line)])));
  }
  if ((type === 'pie' || type === 'doughnut' || type === 'ofPie') && s.explosion !== undefined) kids.push(v('c:explosion', s.explosion));
  for (const point of s.points ?? []) {
    kids.push(
      el(
        'c:dPt',
        {},
        compact([
          v('c:idx', point.index),
          type === 'bar' || type === 'bubble' ? v('c:invertIfNegative', point.invertIfNegative ?? false) : undefined,
          type === 'bubble' ? v('c:bubble3D', false) : undefined,
          type === 'pie' || type === 'doughnut' || type === 'ofPie' ? v('c:explosion', point.explosion) : undefined,
          spPr(ctx, point.fill, point.line),
        ]),
      ),
    );
  }
  if (s.dataLabels) kids.push(dataLabels(s.dataLabels, ctx));
  if (type !== 'pie' && type !== 'doughnut' && type !== 'ofPie' && type !== 'radar' && type !== 'surface') {
    for (const trend of s.trendlines ?? []) {
      kids.push(
        el(
          'c:trendline',
          {},
          compact([
            trend.name ? el('c:name', {}, [trend.name]) : undefined,
            spPr(ctx, undefined, trend.line),
            v('c:trendlineType', trend.type),
            trend.type === 'poly' ? v('c:order', trend.order ?? 2) : undefined,
            trend.type === 'movingAvg' ? v('c:period', trend.period ?? 2) : undefined,
            v('c:forward', trend.forward),
            v('c:backward', trend.backward),
            v('c:intercept', trend.intercept),
            v('c:dispRSqr', trend.displayR2 ?? false),
            v('c:dispEq', trend.displayEquation ?? false),
          ]),
        ),
      );
    }
  }
  const rows = layout.rows;
  if (type === 'scatter' || type === 'bubble') {
    const x = s.xValues ?? { values: s.categories.labels.map((_, i) => i + 1) };
    kids.push(numData('c:xVal', x, range(cols.x ?? 0, rows)));
    kids.push(numData('c:yVal', s.values, range(cols.y, rows)));
    if (type === 'bubble') {
      kids.push(numData('c:bubbleSize', s.bubbleSizes ?? { values: s.values.values.map(() => 1) }, range(cols.size ?? cols.y + 1, rows)));
      kids.push(v('c:bubble3D', false));
    }
  } else {
    const catRef = range(layout.categoryColumn ?? 0, rows);
    if (s.categories.numeric) {
      kids.push(numData('c:cat', { values: s.categories.labels.map((l) => (l === '' ? null : Number(l))), formatCode: s.categories.formatCode }, catRef));
    } else {
      kids.push(strData('c:cat', s.categories.labels, catRef));
    }
    kids.push(numData('c:val', s.values, range(cols.y, rows)));
  }
  if (type === 'line' || type === 'scatter') kids.push(v('c:smooth', s.smooth ?? false));
  return el('c:ser', {}, compact(kids));
}

function plotElement(plot: ChartPlot, startIndex: number, layout: SheetLayout, ctx: DmlWriteContext): XmlElement {
  const ser = plot.series.map((s, i) => series(plot, s, startIndex + i, layout, ctx));
  const labels = plot.dataLabels ? dataLabels(plot.dataLabels, ctx) : undefined;
  const axes = plot.axisIds.map((id) => v('c:axId', id));
  const is3D = plot.is3D === true;
  switch (plot.type) {
    case 'bar':
      return el(is3D ? 'c:bar3DChart' : 'c:barChart', {}, compact([
        v('c:barDir', plot.barDirection ?? 'col'),
        v('c:grouping', plot.grouping ?? 'clustered'),
        v('c:varyColors', plot.varyColors ?? false),
        ...ser,
        labels,
        v('c:gapWidth', plot.gapWidth ?? 150),
        is3D ? undefined : v('c:overlap', plot.overlap ?? (plot.grouping === 'stacked' || plot.grouping === 'percentStacked' ? 100 : undefined)),
        is3D ? v('c:shape', plot.shape ?? 'box') : undefined,
        ...axes,
      ]));
    case 'line':
      return el('c:lineChart', {}, compact([
        v('c:grouping', plot.grouping ?? 'standard'),
        v('c:varyColors', plot.varyColors ?? false),
        ...ser,
        labels,
        plot.dropLines ? el('c:dropLines') : undefined,
        plot.highLowLines ? el('c:hiLowLines') : undefined,
        plot.upDownBars ? el('c:upDownBars', {}, [v('c:gapWidth', 150) as XmlElement]) : undefined,
        v('c:marker', plot.showMarkers ?? true),
        ...axes,
      ]));
    case 'area':
      return el(is3D ? 'c:area3DChart' : 'c:areaChart', {}, compact([v('c:grouping', plot.grouping ?? 'standard'), v('c:varyColors', plot.varyColors ?? false), ...ser, labels, plot.dropLines ? el('c:dropLines') : undefined, ...axes]));
    case 'pie':
    case 'doughnut':
      return el(plot.type === 'doughnut' ? 'c:doughnutChart' : is3D ? 'c:pie3DChart' : 'c:pieChart', {}, compact([
        v('c:varyColors', plot.varyColors ?? true),
        ...ser,
        labels,
        is3D && plot.type === 'pie' ? undefined : v('c:firstSliceAng', plot.firstSliceAngle ?? 0),
        plot.type === 'doughnut' ? v('c:holeSize', plot.holeSize ?? 50) : undefined,
      ]));
    case 'ofPie':
      return el('c:ofPieChart', {}, compact([v('c:ofPieType', plot.ofPieType ?? 'pie'), v('c:varyColors', plot.varyColors ?? true), ...ser, labels, v('c:gapWidth', plot.gapWidth ?? 100), el('c:serLines')]));
    case 'scatter':
      return el('c:scatterChart', {}, compact([v('c:scatterStyle', plot.scatterStyle ?? 'lineMarker'), v('c:varyColors', plot.varyColors ?? false), ...ser, labels, ...axes]));
    case 'radar':
      return el('c:radarChart', {}, compact([v('c:radarStyle', plot.radarStyle ?? 'marker'), v('c:varyColors', plot.varyColors ?? false), ...ser, labels, ...axes]));
    case 'bubble':
      return el('c:bubbleChart', {}, compact([
        v('c:varyColors', plot.varyColors ?? false),
        ...ser,
        labels,
        v('c:bubbleScale', plot.bubbleScale ?? 100),
        v('c:showNegBubbles', plot.showNegativeBubbles ?? false),
        ...axes,
      ]));
    case 'stock':
      return el('c:stockChart', {}, compact([...ser, labels, el('c:hiLowLines'), plot.upDownBars ? el('c:upDownBars', {}, [v('c:gapWidth', 150) as XmlElement]) : undefined, ...axes]));
    case 'surface':
      return el(is3D && axes.length >= 3 ? 'c:surface3DChart' : 'c:surfaceChart', {}, compact([v('c:wireframe', false), ...ser, ...axes]));
  }
}

function axisElement(axis: ChartAxis, ctx: DmlWriteContext): XmlElement {
  const name = { cat: 'c:catAx', val: 'c:valAx', date: 'c:dateAx', ser: 'c:serAx' }[axis.type];
  const scaling = el('c:scaling', {}, compact([v('c:logBase', axis.logBase), v('c:orientation', axis.reverse ? 'maxMin' : 'minMax'), v('c:max', axis.max), v('c:min', axis.min)]));
  const crosses = typeof axis.crosses === 'number' ? v('c:crossesAt', axis.crosses) : v('c:crosses', axis.crosses ?? 'autoZero');
  const kids: Array<XmlElement | undefined> = [
    v('c:axId', axis.id),
    scaling,
    v('c:delete', axis.deleted ?? false),
    v('c:axPos', axis.position),
    axis.majorGridlines ? el('c:majorGridlines', {}, compact([spPr(ctx, undefined, axis.majorGridlines.line)])) : undefined,
    axis.minorGridlines ? el('c:minorGridlines', {}, compact([spPr(ctx, undefined, axis.minorGridlines.line)])) : undefined,
    axis.title ? title(axis.title, ctx) : undefined,
    axis.numberFormat ? el('c:numFmt', { formatCode: axis.numberFormat.code, sourceLinked: axis.numberFormat.sourceLinked ? '1' : '0' }) : undefined,
    v('c:majorTickMark', axis.majorTickMark ?? 'out'),
    v('c:minorTickMark', axis.minorTickMark ?? 'none'),
    v('c:tickLblPos', axis.tickLabelPosition ?? 'nextTo'),
    spPr(ctx, undefined, axis.line),
    txPr(axis.textProps, ctx),
    v('c:crossAx', axis.crossAxisId),
    crosses,
  ];
  if (axis.type === 'cat') kids.push(v('c:auto', true), v('c:lblAlgn', 'ctr'), v('c:lblOffset', 100), v('c:noMultiLvlLbl', false));
  if (axis.type === 'val') kids.push(v('c:crossBetween', axis.crossBetween ?? 'between'), v('c:majorUnit', axis.majorUnit), v('c:minorUnit', axis.minorUnit));
  if (axis.type === 'date') kids.push(v('c:auto', true), v('c:lblOffset', 100), v('c:baseTimeUnit', 'days'), v('c:majorUnit', axis.majorUnit), v('c:minorUnit', axis.minorUnit));
  return el(name, {}, compact(kids));
}

/** c:chartSpace complet. `workbookRelId` = relation vers le classeur incorpore (donnees modifiables dans Office). */
export function writeChart(chart: ChartModel, ctx: DmlWriteContext, workbookRelId?: string): XmlElement {
  const layout = layoutSheet(chart);
  let index = 0;
  const plots = chart.plots.map((plot) => {
    const node = plotElement(plot, index, layout, ctx);
    index += plot.series.length;
    return node;
  });
  const usedAxes = new Set(chart.plots.flatMap((p) => p.axisIds));
  const axes = chart.axes.filter((a) => usedAxes.has(a.id)).map((a) => axisElement(a, ctx));
  const view = chart.view3D ?? (chart.plots.some((p) => p.is3D) ? { rotX: 15, rotY: 20, rightAngleAxes: true } : undefined);
  const chartKids = compact([
    chart.title ? title(chart.title, ctx) : undefined,
    v('c:autoTitleDeleted', chart.autoTitleDeleted ?? !chart.title),
    view ? el('c:view3D', {}, compact([v('c:rotX', view.rotX), v('c:rotY', view.rotY), v('c:rAngAx', view.rightAngleAxes), v('c:perspective', view.perspective)])) : undefined,
    el('c:plotArea', {}, compact([el('c:layout'), ...plots, ...axes, chart.dataTable ? el('c:dTable', {}, compact([v('c:showHorzBorder', true), v('c:showVertBorder', true), v('c:showOutline', true), v('c:showKeys', true)])) : undefined, spPr(ctx, chart.plotFill, chart.plotLine)])),
    chart.legend ? el('c:legend', {}, compact([v('c:legendPos', chart.legend.position), el('c:overlay', { val: chart.legend.overlay ? '1' : '0' }), txPr(chart.legend.props, ctx)])) : undefined,
    v('c:plotVisOnly', chart.plotVisibleOnly ?? true),
    v('c:dispBlanksAs', chart.displayBlanksAs ?? 'gap'),
  ]);
  return el('c:chartSpace', rootNamespaces('c', 'a', 'r'), compact([
    v('c:date1904', false),
    v('c:lang', chart.language ?? 'fr-FR'),
    v('c:roundedCorners', chart.roundedCorners ?? false),
    v('c:style', chart.style),
    el('c:chart', {}, chartKids),
    spPr(ctx, chart.chartFill ?? { type: 'none' }, chart.chartLine ?? { fill: { type: 'none' } }),
    txPr(chart.textProps, ctx),
    workbookRelId ? el('c:externalData', { 'r:id': workbookRelId }, [v('c:autoUpdate', false) as XmlElement]) : undefined,
  ]));
}

// ---- Classeur incorpore ----

const SML = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

function cell(col: number, row: number, value: string | number | null | undefined): XmlElement | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const ref = `${columnName(col)}${row}`;
  if (typeof value === 'number') return el('c', { r: ref }, [el('v', {}, [String(value)])]);
  return el('c', { r: ref, t: 'inlineStr' }, [el('is', {}, [el('t', {}, [value])])]);
}

/** Classeur .xlsx minimal (feuille « Feuil1 ») contenant les donnees du graphique, comme Office. */
export async function buildChartWorkbook(chart: ChartModel): Promise<Uint8Array> {
  const layout = layoutSheet(chart);
  const grid = new Map<number, Map<number, string | number | null>>();
  const put = (col: number, row: number, value: string | number | null): void => {
    const line = grid.get(row) ?? new Map<number, string | number | null>();
    line.set(col, value);
    grid.set(row, line);
  };
  if (layout.categoryColumn !== undefined) layout.categories.forEach((label, i) => put(layout.categoryColumn ?? 0, i + 2, label));
  for (const [s, cols] of layout.series) {
    put(cols.name, 1, s.name);
    s.values.values.forEach((value, i) => put(cols.y, i + 2, value));
    if (cols.x !== undefined) (s.xValues?.values ?? s.categories.labels.map((_, i) => i + 1)).forEach((value, i) => put(cols.x ?? 0, i + 2, value));
    if (cols.size !== undefined) (s.bubbleSizes?.values ?? []).forEach((value, i) => put(cols.size ?? 0, i + 2, value));
  }
  const rows = [...grid.keys()].sort((a, b) => a - b).map((row) => {
    const line = grid.get(row) ?? new Map();
    const cells = [...line.keys()].sort((a, b) => a - b).map((col) => cell(col, row, line.get(col))).filter((c): c is XmlElement => c !== undefined);
    return el('row', { r: row }, cells);
  });
  const pw = new PackageWriter();
  pw.addXml('xl/workbook.xml', el('workbook', { xmlns: SML, 'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' }, [el('sheets', {}, [el('sheet', { name: SHEET, sheetId: 1, 'r:id': 'rId1' })])]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml');
  pw.addXml('xl/worksheets/sheet1.xml', el('worksheet', { xmlns: SML }, [el('sheetData', {}, rows)]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');
  pw.addRelationship('', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument', 'xl/workbook.xml');
  pw.addRelationship('xl/workbook.xml', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet', 'xl/worksheets/sheet1.xml');
  return pw.build();
}
