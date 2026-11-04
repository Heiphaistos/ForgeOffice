// Contrat du Tableur (suite) : dessins ancres (images, formes), graphiques (ChartModel) et sparklines.
import type { CellAddress, Color } from './model.ts';

// ---------------------------------------------------------------- Dessins (images, formes, graphiques)

export interface AnchorPoint {
  col: number;
  /** Decalage en EMU (914400 par pouce, 9525 par pixel a 96 ppp). */
  colOffset: number;
  row: number;
  rowOffset: number;
}

export type Anchor =
  | { type: 'twoCell'; from: AnchorPoint; to: AnchorPoint; editAs?: 'twoCell' | 'oneCell' | 'absolute' }
  | { type: 'oneCell'; from: AnchorPoint; width: number; height: number }
  | { type: 'absolute'; x: number; y: number; width: number; height: number };

export interface DrawingBase {
  anchor: Anchor;
  name: string;
  /** Texte de remplacement (accessibilite). */
  description?: string;
  title?: string;
  hidden?: boolean;
  /** Rotation en degres. */
  rotation?: number;
  locked?: boolean;
}

export interface ImageObject extends DrawingBase {
  kind: 'image';
  data: Uint8Array;
  /** Type MIME (image/png, image/jpeg...). */
  contentType: string;
  /** Lien hypertexte sur l'image. */
  link?: string;
}

export interface LineProperties {
  color?: string;
  /** Epaisseur en points. */
  width?: number;
  dash?: 'solid' | 'dot' | 'dash' | 'lgDash' | 'dashDot' | 'sysDash' | 'sysDot';
  none?: boolean;
}

/** Remplissage DrawingML simplifie : couleur « RRGGBB » ou aucun. */
export interface ShapeFill {
  color?: string;
  /** Transparence 0..1. */
  transparency?: number;
  none?: boolean;
}

export interface ShapeObject extends DrawingBase {
  kind: 'shape';
  /** Geometrie predefinie DrawingML (rect, roundRect, ellipse, rightArrow, line...). */
  geometry: string;
  text?: string;
  fill?: ShapeFill;
  line?: LineProperties;
  textColor?: string;
  fontSize?: number;
  bold?: boolean;
  horizontalAlign?: 'l' | 'ctr' | 'r' | 'just';
  verticalAlign?: 't' | 'ctr' | 'b';
  /** Connecteur ou trait (pas de texte). */
  connector?: boolean;
}

export interface ChartObject extends DrawingBase {
  kind: 'chart';
  chart: ChartModel;
}

export type DrawingObject = ImageObject | ShapeObject | ChartObject;

// ---------------------------------------------------------------- Graphiques

export type ChartPlotType = 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'radar' | 'bubble';

/** Texte de graphique : litteral ou reference de cellule. */
export interface ChartText {
  text?: string;
  /** Reference sans « = » (« Feuil1!$B$1 »). */
  ref?: string;
  overlay?: boolean;
  bold?: boolean;
  /** Taille en points. */
  size?: number;
  color?: string;
}

export interface ChartDataRef {
  /** Reference sans « = ». */
  ref?: string;
  /** Valeurs en cache (affichage sans recalcul, donnees litterales si pas de reference). */
  cache?: (number | string | null)[];
  formatCode?: string;
}

export interface DataLabels {
  showValue?: boolean;
  showCategory?: boolean;
  showSeriesName?: boolean;
  showPercent?: boolean;
  showLegendKey?: boolean;
  showBubbleSize?: boolean;
  showLeaderLines?: boolean;
  position?: 'ctr' | 'inEnd' | 'inBase' | 'outEnd' | 'bestFit' | 'l' | 'r' | 't' | 'b';
  separator?: string;
  numFmt?: string;
  delete?: boolean;
}

export interface MarkerStyle {
  symbol: 'none' | 'circle' | 'square' | 'diamond' | 'triangle' | 'x' | 'star' | 'dash' | 'dot' | 'plus' | 'auto';
  size?: number;
  color?: string;
}

export interface Trendline {
  type: 'linear' | 'exp' | 'log' | 'movingAvg' | 'poly' | 'power';
  order?: number;
  period?: number;
  name?: string;
  displayEquation?: boolean;
  displayRSquared?: boolean;
  forward?: number;
  backward?: number;
}

export interface ChartSeries {
  idx: number;
  order: number;
  name?: ChartText;
  categories?: ChartDataRef;
  values: ChartDataRef;
  /** Nuages de points et bulles. */
  xValues?: ChartDataRef;
  bubbleSizes?: ChartDataRef;
  /** Couleur de remplissage / trait « RRGGBB ». */
  color?: string;
  line?: LineProperties;
  marker?: MarkerStyle;
  smooth?: boolean;
  dataLabels?: DataLabels;
  invertIfNegative?: boolean;
  /** Eclatement d'un secteur (%). */
  explosion?: number;
  trendlines?: Trendline[];
  /** Couleurs de points individuels (index -> « RRGGBB »). */
  pointColors?: Record<number, string>;
}

export interface ChartPlot {
  type: ChartPlotType;
  /** Barres : « col » = histogramme vertical, « bar » = barres horizontales. */
  barDirection?: 'col' | 'bar';
  grouping?: 'clustered' | 'stacked' | 'percentStacked' | 'standard';
  varyColors?: boolean;
  series: ChartSeries[];
  /** Identifiants des axes utilises (vide pour secteurs et anneaux). */
  axisIds: number[];
  dataLabels?: DataLabels;
  gapWidth?: number;
  overlap?: number;
  /** Secteurs / anneau. */
  firstSliceAngle?: number;
  holeSize?: number;
  scatterStyle?: 'line' | 'lineMarker' | 'marker' | 'smooth' | 'smoothMarker' | 'none';
  radarStyle?: 'standard' | 'marker' | 'filled';
  bubbleScale?: number;
  showNegativeBubbles?: boolean;
  /** Courbes : afficher les marqueurs. */
  markers?: boolean;
}

export interface ChartAxis {
  id: number;
  kind: 'category' | 'value' | 'date' | 'series';
  position: 'b' | 'l' | 'r' | 't';
  crossAxisId: number;
  title?: ChartText;
  deleted?: boolean;
  min?: number;
  max?: number;
  majorUnit?: number;
  minorUnit?: number;
  logBase?: number;
  reverse?: boolean;
  numFmt?: string;
  majorGridlines?: boolean;
  minorGridlines?: boolean;
  crosses?: 'autoZero' | 'min' | 'max';
  crossesAt?: number;
  tickLabelPosition?: 'nextTo' | 'low' | 'high' | 'none';
  majorTickMark?: 'none' | 'in' | 'out' | 'cross';
  minorTickMark?: 'none' | 'in' | 'out' | 'cross';
  crossBetween?: 'between' | 'midCat';
}

export interface ChartLegend {
  position: 'r' | 'l' | 't' | 'b' | 'tr';
  overlay?: boolean;
}

export interface ChartModel {
  title?: ChartText;
  autoTitleDeleted?: boolean;
  /** Plusieurs traces = graphique combine (ex. histogramme + courbe sur axe secondaire). */
  plots: ChartPlot[];
  axes: ChartAxis[];
  legend?: ChartLegend;
  /** Style integre Excel (1..48). */
  style?: number;
  plotVisibleOnly?: boolean;
  displayBlanksAs?: 'gap' | 'span' | 'zero';
  roundedCorners?: boolean;
}

// ---------------------------------------------------------------- Graphiques sparkline

export interface Sparkline {
  /** Plage source sans « = » (« Feuil1!A1:E1 »). */
  source: string;
  /** Cellule d'affichage. */
  location: CellAddress;
}

export interface SparklineGroup {
  type: 'line' | 'column' | 'stacked';
  sparklines: Sparkline[];
  colorSeries?: Color;
  colorNegative?: Color;
  colorAxis?: Color;
  colorMarkers?: Color;
  colorFirst?: Color;
  colorLast?: Color;
  colorHigh?: Color;
  colorLow?: Color;
  markers?: boolean;
  high?: boolean;
  low?: boolean;
  first?: boolean;
  last?: boolean;
  negative?: boolean;
  displayXAxis?: boolean;
  displayHidden?: boolean;
  rightToLeft?: boolean;
  /** Epaisseur du trait en points. */
  lineWeight?: number;
  displayEmptyCellsAs?: 'gap' | 'zero' | 'span';
  minAxisType?: 'individual' | 'group' | 'custom';
  maxAxisType?: 'individual' | 'group' | 'custom';
  manualMin?: number;
  manualMax?: number;
  /** Plage de dates de l'axe, sans « = ». */
  dateAxis?: string;
}

