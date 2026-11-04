// Graphique en radar (standard, avec marqueurs, rempli).
import type { ChartPlot } from '@forgeoffice/pptx';
import { categoryLabel, pointCount, seriesOf, valuesOf } from './data.ts';
import { axisScale, formatNumber, textWidth, ticks, truncate } from './format.ts';
import type { Rect } from './geometry.ts';
import { pathD, pointLabels } from './series.ts';
import { GRID_COLOR, markerFor, markerNode, markerPaint, seriesLook, seriesRank, textNode, type Env, type Out } from './style.ts';
import { el, n2, type SvgNode } from './svg.ts';

export function renderRadar(env: Env, plot: ChartPlot, rect: Rect, out: Out): void {
  const series = seriesOf(plot);
  const n = pointCount(series);
  if (!n) return;
  const catAxis = env.chart.axes.find((a) => a.id === plot.axisIds[0]);
  const valAxis = env.chart.axes.find((a) => a.id === plot.axisIds[1]);
  const cst = env.p.text(catAxis?.textProps);
  const vst = env.p.text(valAxis?.textProps);
  const showCat = !catAxis?.deleted && catAxis?.tickLabelPosition !== 'none';
  const showVal = !valAxis?.deleted && valAxis?.tickLabelPosition !== 'none';
  const labels = Array.from({ length: n }, (_, i) => truncate(categoryLabel(series[0], i), rect.w * 0.25, cst.size));
  const labelW = showCat ? labels.reduce((m, l) => Math.max(m, textWidth(l, cst.size)), 0) : 0;
  const R = Math.max(1, Math.min(rect.w / 2 - labelW - 6, rect.h / 2 - cst.size * 1.6));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const rows = series.map((s) => valuesOf(s.values));
  const all = rows.flat().filter((v): v is number => v !== null);
  const lo = all.reduce((m, v) => Math.min(m, v), Infinity);
  const hi = all.reduce((m, v) => Math.max(m, v), -Infinity);
  const sc = axisScale(lo, hi, valAxis, Math.max(2, Math.min(10, Math.floor(R / (vst.size * 2)))), false);
  const at = (i: number, v: number): [number, number] => {
    const r = ((Math.min(sc.max, Math.max(sc.min, v)) - sc.min) / (sc.max - sc.min)) * R;
    const a = (i / n) * 2 * Math.PI;
    return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  };
  const nodes: SvgNode[] = [];
  const tickValues = ticks(sc);
  if (valAxis?.majorGridlines) {
    const stroke = env.p.stroke(valAxis.majorGridlines.line, GRID_COLOR, 0.75);
    const d = tickValues.filter((t) => t > sc.min).map((t) => `${pathD(Array.from({ length: n }, (_, i) => at(i, t)), false)}Z`).join('');
    if (d) nodes.push(el('path', { d, fill: 'none', ...stroke }));
  }
  if (!catAxis?.deleted) {
    const stroke = env.p.stroke(catAxis?.majorGridlines?.line ?? catAxis?.line, GRID_COLOR, 0.75);
    const d = Array.from({ length: n }, (_, i) => `M${n2(cx)} ${n2(cy)}L${at(i, sc.max).map(n2).join(' ')}`).join('');
    if (stroke.stroke !== 'none') nodes.push(el('path', { d, fill: 'none', ...stroke }));
  }
  if (showCat) {
    labels.forEach((l, i) => {
      const a = (i / n) * 2 * Math.PI;
      const sin = Math.sin(a);
      const anchor = sin > 0.1 ? 'start' : sin < -0.1 ? 'end' : 'middle';
      nodes.push(textNode(cx + (R + 6) * sin, cy - (R + cst.size * 0.8) * Math.cos(a), l, cst, anchor));
    });
  }
  if (showVal) {
    const nf = valAxis?.numberFormat;
    const code = nf && !nf.sourceLinked ? nf.code : (series[0]?.values.formatCode ?? nf?.code);
    for (const t of tickValues) nodes.push(textNode(cx - 4, at(0, t)[1], formatNumber(t, code), vst, 'end'));
  }
  out.shapes.push(...nodes);
  series.forEach((s, si) => {
    const look = seriesLook(env.p, plot, s, seriesRank(env, s));
    const row = rows[si] ?? [];
    const pts = Array.from({ length: n }, (_, i) => at(i, row[i] ?? sc.min));
    out.shapes.push(el('path', { d: `${pathD(pts, false)}Z`, fill: look.fill, ...look.stroke }));
    const m = markerFor(plot, s);
    if (m) {
      const { fill, stroke } = markerPaint(env.p, s, look);
      for (const p of pts) out.shapes.push(markerNode(m, p[0], p[1], fill, stroke));
    }
    pointLabels(env, plot, s, pts, row, 'r', out);
  });
}
