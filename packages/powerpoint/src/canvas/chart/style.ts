// Peinture des graphiques : couleurs par defaut d'Office 2024, remplissages, contours, texte et marqueurs.
import { scheme, type ChartModel, type ChartPlot, type ChartSeries, type Color, type ColorMod, type Fill, type Line, type RunProps, type SchemeColorName } from '@forgeoffice/pptx';
import { clamp } from './format.ts';
import { el, n2, type SvgNode } from './svg.ts';

export interface ChartRenderContext {
  /** Couleur DrawingML -> couleur CSS (#RRGGBB ou rgba) : fournie par l'appelant (theme du document). */
  color: (c: Color) => string;
  /** Pile de polices CSS du texte (police mineure du theme). */
  fontFamily: string;
}

export type Attrs = Record<string, string | number>;

export interface TextStyle {
  size: number;
  color: string;
  font: string;
  bold: boolean;
  italic: boolean;
}

/** Formes produites par un trace : formes d'abord, etiquettes par-dessus. */
export interface Out {
  shapes: SvgNode[];
  labels: SvgNode[];
}

export interface Env {
  p: Paint;
  chart: ChartModel;
  /** Rang global de chaque serie (couleur par defaut). */
  index: Map<ChartSeries, number>;
}

export const seriesRank = (env: Env, s: ChartSeries): number => env.index.get(s) ?? 0;

const tx1 = (lumMod: number, lumOff: number): Color => scheme('tx1', [{ name: 'lumMod', val: lumMod }, { name: 'lumOff', val: lumOff }]);
export const TEXT_COLOR = tx1(65000, 35000);
export const GRID_COLOR = tx1(15000, 85000);
export const MINOR_GRID_COLOR = tx1(5000, 95000);
export const BACKGROUND = scheme('bg1');

const ACCENTS: SchemeColorName[] = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
const VARIANTS: ColorMod[][] = [[], [{ name: 'lumMod', val: 60000 }], [{ name: 'lumMod', val: 80000 }, { name: 'lumOff', val: 20000 }]];

/** Couleur automatique d'Office : accent1..6, puis assombries, puis eclaircies. */
export function paletteColor(i: number): Color {
  const mods = VARIANTS[Math.floor(i / 6) % VARIANTS.length] ?? [];
  return scheme(ACCENTS[i % 6] ?? 'accent1', mods.length ? mods : undefined);
}

// Tirets predefinis en multiples de l'epaisseur (Map : une cle hostile comme « constructor » ne trouve rien).
const DASHES = new Map<string, number[]>([
  ['dot', [1, 1]],
  ['dash', [4, 3]],
  ['lgDash', [8, 3]],
  ['dashDot', [4, 3, 1, 3]],
  ['lgDashDot', [8, 3, 1, 3]],
  ['lgDashDotDot', [8, 3, 1, 3, 1, 3]],
  ['sysDash', [3, 1]],
  ['sysDot', [1, 1]],
  ['sysDashDot', [3, 1, 1, 1]],
  ['sysDashDotDot', [3, 1, 1, 1, 1, 1]],
]);

let chartSeq = 0;

export class Paint {
  readonly ctx: ChartRenderContext;
  readonly chart: ChartModel;
  /** Degrades a placer dans <defs>. */
  readonly defs: SvgNode[] = [];
  private readonly prefix: string;

  constructor(ctx: ChartRenderContext, chart: ChartModel) {
    this.ctx = ctx;
    this.chart = chart;
    chartSeq += 1;
    this.prefix = `fo-chart-${chartSeq}`;
  }

  color(c: Color): string {
    return this.ctx.color(c);
  }

  /** Valeur de l'attribut fill ; `fallback` = couleur automatique (null = aucun remplissage). */
  fill(fill: Fill | undefined, fallback: Color | null): string {
    const auto = fallback ? this.color(fallback) : 'none';
    if (!fill) return auto;
    if (fill.type === 'none') return 'none';
    if (fill.type === 'solid') return this.color(fill.color);
    if (fill.type === 'gradient') return this.gradient(fill) ?? auto;
    if (fill.type === 'pattern') return this.color(fill.foreground);
    return auto;
  }

  /** Attributs de contour ; `fallback` = couleur automatique (null = pas de contour). */
  stroke(line: Line | undefined, fallback: Color | null, width: number): Attrs {
    const f = line?.fill;
    let color = fallback ? this.color(fallback) : 'none';
    if (f?.type === 'none') color = 'none';
    else if (f?.type === 'solid') color = this.color(f.color);
    else if (f?.type === 'gradient' && f.stops[0]) color = this.color(f.stops[0].color);
    else if (f?.type === 'pattern') color = this.color(f.foreground);
    if (color === 'none') return { stroke: 'none' };
    const w = Math.max(0.25, clamp(line?.width ?? width, 0, 50, width));
    const attrs: Attrs = { stroke: color, 'stroke-width': w };
    const dash = line?.customDash?.length
      ? line.customDash
          .slice(0, 8)
          .map((d) => `${n2((clamp(d.dash, 0, 1e4) / 100) * w)} ${n2((clamp(d.space, 0, 1e4) / 100) * w)}`)
          .join(' ')
      : DASHES.get(line?.dash ?? '')
          ?.map((v) => n2(v * w))
          .join(' ');
    if (dash) attrs['stroke-dasharray'] = dash;
    if (line?.cap === 'rnd') attrs['stroke-linecap'] = 'round';
    else if (line?.cap === 'sq') attrs['stroke-linecap'] = 'square';
    if (line?.join === 'round') attrs['stroke-linejoin'] = 'round';
    else if (line?.join === 'bevel') attrs['stroke-linejoin'] = 'bevel';
    return attrs;
  }

  /** Style de texte : `props`, puis texte du graphique, puis aspect Office (9 pt, gris 65 %). */
  text(props?: RunProps, size?: number): TextStyle {
    const base = this.chart.textProps;
    const font = props?.font ?? base?.font;
    const name = font && !font.startsWith('+') ? font.replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 64) : '';
    return {
      size: clamp(props?.size ?? size ?? base?.size ?? 9, 1, 200, 9),
      color: this.color(props?.color ?? base?.color ?? TEXT_COLOR),
      font: name ? `'${name}', ${this.ctx.fontFamily}` : this.ctx.fontFamily,
      bold: props?.bold ?? base?.bold ?? false,
      italic: props?.italic ?? base?.italic ?? false,
    };
  }

  private gradient(fill: Extract<Fill, { type: 'gradient' }>): string | undefined {
    const stops = [...fill.stops].sort((a, b) => a.position - b.position).slice(0, 16);
    if (!stops.length) return undefined;
    const id = `${this.prefix}-g${this.defs.length}`;
    const children = stops.map((s) => el('stop', { offset: `${clamp(s.position, 0, 100)}%`, 'stop-color': this.color(s.color) }));
    if (fill.kind === 'linear') {
      const a = (clamp(fill.angle ?? 0, -3600, 3600, 0) * Math.PI) / 180;
      const dx = Math.cos(a) / 2;
      const dy = Math.sin(a) / 2;
      this.defs.push(el('linearGradient', { id, x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy }, children));
    } else this.defs.push(el('radialGradient', { id, cx: 0.5, cy: 0.5, r: 0.7 }, children));
    return `url(#${id})`;
  }
}

/** Texte centre verticalement sur cy (ligne de base estimee, sans dominant-baseline pour l'export PDF). */
export function textNode(x: number, cy: number, s: string, st: TextStyle, anchor: 'start' | 'middle' | 'end' = 'middle', extra: Attrs = {}): SvgNode {
  const attrs: Attrs = { x, y: cy + st.size * 0.35, 'font-family': st.font, 'font-size': st.size, fill: st.color, 'text-anchor': anchor, ...extra };
  if (st.bold) attrs['font-weight'] = 'bold';
  if (st.italic) attrs['font-style'] = 'italic';
  return el('text', attrs, [s.slice(0, 255)]);
}

/** Etiquette placee autour d'un point (t, b, l, r, ctr). */
export function placeLabel(x: number, y: number, s: string, st: TextStyle, pos: string): SvgNode {
  const d = st.size * 0.9;
  if (pos === 't') return textNode(x, y - d, s, st);
  if (pos === 'b') return textNode(x, y + d, s, st);
  if (pos === 'l') return textNode(x - 5, y, s, st, 'end');
  if (pos === 'ctr') return textNode(x, y, s, st);
  return textNode(x + 5, y, s, st, 'start');
}

const PIE_TYPES = new Set(['pie', 'doughnut', 'ofPie']);
export const isPieLike = (plot: ChartPlot): boolean => PIE_TYPES.has(plot.type);

/** Series tracees par un trait (courbes, nuages, radar non rempli, stock, surface). */
export const isLinear = (plot: ChartPlot): boolean =>
  plot.type === 'line' || plot.type === 'scatter' || plot.type === 'stock' || plot.type === 'surface' || (plot.type === 'radar' && plot.radarStyle !== 'filled');

/** Couleur par point (varyColors) : secteurs, ou barres/bulles a serie unique comme Office. */
export const varies = (plot: ChartPlot): boolean =>
  !!plot.varyColors && (isPieLike(plot) || (plot.series.length === 1 && (plot.type === 'bar' || plot.type === 'bubble')));

export interface Look {
  color: Color;
  fill: string;
  stroke: Attrs;
}

/** Aspect d'une serie (ou d'un point) : mise en forme du fichier, sinon aspect Office 2024. */
export function seriesLook(p: Paint, plot: ChartPlot, s: ChartSeries, rank: number, point?: number): Look {
  const color = paletteColor(point !== undefined && varies(plot) ? point : rank);
  const pt = point === undefined ? undefined : s.points?.find((q) => q.index === point);
  if (isLinear(plot)) {
    return { color, fill: 'none', stroke: { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...p.stroke(pt?.line ?? s.line, color, 2.25) } };
  }
  const pie = isPieLike(plot);
  return { color, fill: p.fill(pt?.fill ?? s.fill, color), stroke: p.stroke(pt?.line ?? s.line, pie ? BACKGROUND : null, pie ? 1.5 : 0.75) };
}

export interface Marker {
  symbol: string;
  size: number;
}

/** Marqueur affiche par la serie, ou null. */
export function markerFor(plot: ChartPlot, s: ChartSeries): Marker | null {
  const symbol = s.marker?.symbol ?? 'auto';
  if (symbol === 'none') return null;
  const style = plot.type === 'scatter' ? (plot.scatterStyle ?? 'lineMarker') : '';
  const auto =
    (plot.type === 'line' && plot.showMarkers !== false) ||
    style === 'marker' ||
    style === 'lineMarker' ||
    style === 'smoothMarker' ||
    (plot.type === 'radar' && plot.radarStyle === 'marker');
  if (!auto && symbol === 'auto') return null;
  return { symbol: symbol === 'auto' ? 'circle' : symbol, size: clamp(s.marker?.size ?? 5, 2, 72, 5) };
}

/** Remplissage et contour d'un marqueur (couleur de la serie par defaut). */
export function markerPaint(p: Paint, s: ChartSeries, look: Look): { fill: string; stroke: Attrs } {
  return { fill: p.fill(s.marker?.fill, look.color), stroke: p.stroke(s.marker?.line, look.color, 0.75) };
}

export function markerNode(m: Marker, x: number, y: number, fill: string, stroke: Attrs): SvgNode {
  const r = m.size / 2;
  const P = (pts: Array<[number, number]>): string => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${n2(x + a * r)} ${n2(y + b * r)}`).join('');
  const shape = (d: string): SvgNode => el('path', { d, fill, ...stroke });
  // Croix et plus : traces au trait, dans la couleur du remplissage si le contour est absent.
  const cross = (d: string): SvgNode => el('path', { d, fill: 'none', ...(stroke.stroke === 'none' ? { stroke: fill, 'stroke-width': 1 } : stroke) });
  const diag = P([[-1, -1], [1, 1]]) + P([[1, -1], [-1, 1]]);
  const plus = P([[-1, 0], [1, 0]]) + P([[0, -1], [0, 1]]);
  switch (m.symbol) {
    case 'square':
      return el('rect', { x: x - r, y: y - r, width: m.size, height: m.size, fill, ...stroke });
    case 'diamond':
      return shape(`${P([[0, -1], [1, 0], [0, 1], [-1, 0]])}Z`);
    case 'triangle':
      return shape(`${P([[0, -1], [1, 1], [-1, 1]])}Z`);
    case 'dash':
      return el('rect', { x: x - r, y: y - r / 4, width: m.size, height: r / 2, fill, ...stroke });
    case 'x':
      return cross(diag);
    case 'plus':
      return cross(plus);
    case 'star':
      return cross(diag + plus);
    case 'dot':
      return el('circle', { cx: x, cy: y, r: r / 2, fill, ...stroke });
    default:
      return el('circle', { cx: x, cy: y, r, fill, ...stroke });
  }
}
