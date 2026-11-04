// Rendu SVG des graphiques (modele ChartModel de @forgeoffice/pptx) avec l'aspect par defaut d'Office 2024.
import type { ChartModel, ChartSeries } from '@forgeoffice/pptx';
import { renderAxes } from './axes.ts';
import { seriesOf } from './data.ts';
import { wrapText } from './format.ts';
import { fit, type Rect } from './geometry.ts';
import { renderLegend } from './legend.ts';
import { renderPie } from './pie.ts';
import { renderRadar } from './radar.ts';
import { BACKGROUND, Paint, isPieLike, textNode, type ChartRenderContext, type Env, type Out } from './style.ts';
import { CHART_STRINGS } from './strings.ts';
import { el, n2, type SvgNode } from './svg.ts';

export type { SvgNode } from './svg.ts';
export type { ChartRenderContext } from './style.ts';
export { svgToString } from './svg.ts';
export { niceScale } from './format.ts';

/** Marge interieure du graphique (points). */
const PAD = 10;
const MAX_PLOTS = 16;

const dim = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.min(v, 1e5) : 1);

/** Titre affiche : texte, nom de la serie unique (titre automatique d'Office), ou « Titre du graphique ». */
function titleText(chart: ChartModel, series: ChartSeries[]): string | undefined {
  if (chart.title === null) return undefined;
  const single = series.length === 1 ? String(series[0]?.name ?? '').trim() || undefined : undefined;
  if (chart.title) return chart.title.text?.trim() || single || CHART_STRINGS.defaultTitle;
  return chart.autoTitleDeleted ? undefined : single;
}

function drawTitle(env: Env, series: ChartSeries[], r: Rect, nodes: SvgNode[]): Rect {
  const text = titleText(env.chart, series);
  if (!text) return r;
  const st = env.p.text(env.chart.title?.props, 14);
  const lh = st.size * 1.2;
  const lines = wrapText(text, r.w, st.size, 3);
  lines.forEach((l, k) => nodes.push(textNode(r.x + r.w / 2, r.y + lh / 2 + k * lh, l, st)));
  if (env.chart.title?.overlay) return r;
  return fit({ ...r, y: r.y + lines.length * lh + 6, h: r.h - lines.length * lh - 6 });
}

/** Graphique complet (zone de graphique, titre, legende, zone de tracage, axes, series, etiquettes) dans une boite width x height en points, origine 0,0. */
export function renderChart(chart: ChartModel, width: number, height: number, ctx: ChartRenderContext): SvgNode {
  const W = dim(width);
  const H = dim(height);
  const p = new Paint(ctx, chart);
  const plots = (chart.plots ?? []).slice(0, MAX_PLOTS);
  const series = plots.flatMap(seriesOf);
  const env: Env = { p, chart: { ...chart, plots, axes: chart.axes ?? [] }, index: new Map(series.map((s, i) => [s, i])) };
  const nodes: SvgNode[] = [
    el('rect', { x: 0, y: 0, width: W, height: H, fill: p.fill(chart.chartFill, BACKGROUND), ...p.stroke(chart.chartLine, null, 0.75), ...(chart.roundedCorners ? { rx: 8 } : {}) }),
  ];
  let r = drawTitle(env, series, fit({ x: PAD, y: PAD, w: W - 2 * PAD, h: H - 2 * PAD }), nodes);
  if (chart.legend) r = renderLegend(env, chart.legend, r, nodes);
  const axisPlots = plots.filter((pl) => !isPieLike(pl) && pl.type !== 'radar');
  if (axisPlots.length) nodes.push(...renderAxes(env, axisPlots, r));
  else if (chart.plotFill || chart.plotLine) {
    nodes.push(el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, fill: p.fill(chart.plotFill, null), ...p.stroke(chart.plotLine, null, 0.75) }));
  }
  const out: Out = { shapes: [], labels: [] };
  for (const pl of plots) {
    if (pl.type === 'radar') renderRadar(env, pl, r, out);
    else if (isPieLike(pl)) renderPie(env, pl, r, out);
  }
  nodes.push(...out.shapes, ...out.labels);
  const defs = p.defs.length ? [el('defs', {}, p.defs)] : [];
  return el('svg', { xmlns: 'http://www.w3.org/2000/svg', width: W, height: H, viewBox: `0 0 ${n2(W)} ${n2(H)}` }, [...defs, ...nodes]);
}
