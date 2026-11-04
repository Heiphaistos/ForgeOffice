// Modele de graphique generique (DrawingML Chart, c:chartSpace), partage par la presentation,
// et reutilisable par le tableur et le traitement de texte.
import type { Fill, Line, RunProps } from './dml.ts';

export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'doughnut'
  | 'area'
  | 'scatter'
  | 'radar'
  | 'bubble'
  | 'stock'
  | 'surface'
  | 'ofPie';

export type ChartGrouping = 'clustered' | 'stacked' | 'percentStacked' | 'standard';

export interface ChartText {
  /** Texte simple (les titres riches sont ramenes a leur texte). */
  text?: string;
  /** Mise en forme du texte. */
  props?: RunProps;
  overlay?: boolean;
}

export interface ChartCategories {
  /** Reference de feuille (Feuil1!$A$2:$A$5) si connue. */
  ref?: string;
  labels: string[];
  /** Vrai si les categories sont des nombres (ou des dates). */
  numeric?: boolean;
  formatCode?: string;
}

export interface ChartValues {
  ref?: string;
  values: Array<number | null>;
  formatCode?: string;
}

export interface ChartMarker {
  /** auto, none, circle, square, diamond, triangle, x, star, dot, dash, plus, picture. */
  symbol: string;
  size?: number;
  fill?: Fill;
  line?: Line;
}

export interface ChartDataLabels {
  showValue?: boolean;
  showCategory?: boolean;
  showSeriesName?: boolean;
  showPercent?: boolean;
  showLegendKey?: boolean;
  showBubbleSize?: boolean;
  /** ctr, inEnd, inBase, outEnd, bestFit, l, r, t, b. */
  position?: string;
  separator?: string;
  numberFormat?: string;
  props?: RunProps;
}

export interface ChartPoint {
  index: number;
  fill?: Fill;
  line?: Line;
  explosion?: number;
  invertIfNegative?: boolean;
}

export interface ChartTrendline {
  /** linear, exp, log, movingAvg, poly, power. */
  type: string;
  name?: string;
  order?: number;
  period?: number;
  forward?: number;
  backward?: number;
  intercept?: number;
  displayEquation?: boolean;
  displayR2?: boolean;
  line?: Line;
}

export interface ChartSeries {
  name: string;
  nameRef?: string;
  categories: ChartCategories;
  values: ChartValues;
  /** Abscisses (nuage de points, bulles). */
  xValues?: ChartValues;
  bubbleSizes?: ChartValues;
  fill?: Fill;
  line?: Line;
  marker?: ChartMarker;
  dataLabels?: ChartDataLabels;
  smooth?: boolean;
  explosion?: number;
  invertIfNegative?: boolean;
  points?: ChartPoint[];
  trendlines?: ChartTrendline[];
}

export interface ChartPlot {
  type: ChartType;
  /** Barres horizontales (bar) ou histogramme (col). */
  barDirection?: 'bar' | 'col';
  grouping?: ChartGrouping;
  varyColors?: boolean;
  series: ChartSeries[];
  /** Axes utilises (aucun pour secteurs et anneaux). */
  axisIds: number[];
  is3D?: boolean;
  gapWidth?: number;
  overlap?: number;
  holeSize?: number;
  firstSliceAngle?: number;
  /** lineMarker, line, marker, smooth, smoothMarker, none. */
  scatterStyle?: string;
  /** standard, marker, filled. */
  radarStyle?: string;
  /** Marqueurs actives sur un graphique en courbes. */
  showMarkers?: boolean;
  /** cone, coneToMax, box, cylinder, pyramid, pyramidToMax. */
  shape?: string;
  dataLabels?: ChartDataLabels;
  bubbleScale?: number;
  showNegativeBubbles?: boolean;
  /** pie ou bar (secteurs de secteur, barres de secteur). */
  ofPieType?: 'pie' | 'bar';
  dropLines?: boolean;
  highLowLines?: boolean;
  upDownBars?: boolean;
}

export interface ChartGridlines {
  line?: Line;
}

export interface ChartAxis {
  id: number;
  type: 'cat' | 'val' | 'date' | 'ser';
  position: 'b' | 'l' | 'r' | 't';
  crossAxisId: number;
  deleted?: boolean;
  title?: ChartText;
  numberFormat?: { code: string; sourceLinked: boolean };
  majorGridlines?: ChartGridlines;
  minorGridlines?: ChartGridlines;
  min?: number;
  max?: number;
  majorUnit?: number;
  minorUnit?: number;
  logBase?: number;
  /** Ordre inverse des valeurs ou categories. */
  reverse?: boolean;
  /** autoZero, min, max ou valeur numerique. */
  crosses?: 'autoZero' | 'min' | 'max' | number;
  /** between ou midCat (axe de valeurs). */
  crossBetween?: 'between' | 'midCat';
  majorTickMark?: 'none' | 'in' | 'out' | 'cross';
  minorTickMark?: 'none' | 'in' | 'out' | 'cross';
  tickLabelPosition?: 'nextTo' | 'low' | 'high' | 'none';
  line?: Line;
  textProps?: RunProps;
}

export interface ChartLegend {
  position: 'r' | 'l' | 't' | 'b' | 'tr';
  overlay?: boolean;
  props?: RunProps;
}

export interface ChartModel {
  /** null = titre supprime ; undefined = pas de titre. */
  title?: ChartText | null;
  autoTitleDeleted?: boolean;
  plots: ChartPlot[];
  axes: ChartAxis[];
  legend?: ChartLegend | null;
  /** Style de graphique Office 1..48 (c:style). */
  style?: number;
  roundedCorners?: boolean;
  plotVisibleOnly?: boolean;
  displayBlanksAs?: 'gap' | 'zero' | 'span';
  chartFill?: Fill;
  chartLine?: Line;
  plotFill?: Fill;
  plotLine?: Line;
  /** Mise en forme par defaut du texte du graphique. */
  textProps?: RunProps;
  view3D?: { rotX?: number; rotY?: number; perspective?: number; rightAngleAxes?: boolean };
  dataTable?: boolean;
  language?: string;
}

export interface SimpleSeries {
  name: string;
  values: Array<number | null>;
  xValues?: number[];
  sizes?: number[];
}

export interface ChartOptions {
  title?: string;
  barDirection?: 'bar' | 'col';
  grouping?: ChartGrouping;
  legend?: ChartLegend['position'] | null;
  is3D?: boolean;
}

const CATEGORY_AXIS_ID = 500000001;
const VALUE_AXIS_ID = 500000002;

/** Cree un graphique complet a partir de donnees simples (categories + series). */
export function createChart(type: ChartType, categories: string[], series: SimpleSeries[], options: ChartOptions = {}): ChartModel {
  const noAxes = type === 'pie' || type === 'doughnut' || type === 'ofPie';
  const scatterLike = type === 'scatter' || type === 'bubble';
  const plot: ChartPlot = {
    type,
    series: series.map((s) => ({
      name: s.name,
      categories: { labels: [...categories] },
      values: { values: [...s.values] },
      xValues: s.xValues ? { values: [...s.xValues] } : undefined,
      bubbleSizes: s.sizes ? { values: [...s.sizes] } : undefined,
    })),
    axisIds: noAxes ? [] : [CATEGORY_AXIS_ID, VALUE_AXIS_ID],
    varyColors: noAxes,
  };
  if (type === 'bar') {
    plot.barDirection = options.barDirection ?? 'col';
    plot.grouping = options.grouping ?? 'clustered';
    plot.gapWidth = 219;
    plot.overlap = plot.grouping === 'clustered' ? -27 : 100;
  } else if (type === 'line' || type === 'area') {
    plot.grouping = options.grouping ?? 'standard';
    if (type === 'line') plot.showMarkers = true;
  } else if (type === 'doughnut') {
    plot.holeSize = 75;
    plot.firstSliceAngle = 0;
  } else if (type === 'pie') {
    plot.firstSliceAngle = 0;
  } else if (type === 'scatter') {
    plot.scatterStyle = 'lineMarker';
  } else if (type === 'radar') {
    plot.radarStyle = 'marker';
  } else if (type === 'ofPie') {
    plot.ofPieType = 'pie';
  }
  if (options.is3D) plot.is3D = true;
  const horizontal = plot.barDirection === 'bar';
  const axes: ChartAxis[] = noAxes
    ? []
    : [
        {
          id: CATEGORY_AXIS_ID,
          type: scatterLike ? 'val' : 'cat',
          position: horizontal ? 'l' : 'b',
          crossAxisId: VALUE_AXIS_ID,
          majorTickMark: 'none',
          tickLabelPosition: 'nextTo',
          crosses: 'autoZero',
        },
        {
          id: VALUE_AXIS_ID,
          type: 'val',
          position: horizontal ? 'b' : 'l',
          crossAxisId: CATEGORY_AXIS_ID,
          majorGridlines: {},
          numberFormat: { code: 'General', sourceLinked: true },
          majorTickMark: 'none',
          tickLabelPosition: 'nextTo',
          crosses: 'autoZero',
          crossBetween: type === 'area' ? 'midCat' : 'between',
        },
      ];
  const legendPosition = options.legend === undefined ? 'b' : options.legend;
  return {
    title: options.title === undefined ? undefined : { text: options.title, overlay: false },
    autoTitleDeleted: options.title === undefined && series.length > 1,
    plots: [plot],
    axes,
    legend: legendPosition === null ? null : { position: legendPosition, overlay: false },
    plotVisibleOnly: true,
    displayBlanksAs: 'gap',
  };
}

/** Toutes les series de toutes les sous-parties du graphique. */
export function chartSeries(chart: ChartModel): ChartSeries[] {
  return chart.plots.flatMap((plot) => plot.series);
}
