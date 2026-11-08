// Superpositions d'une série : courbes de tendance (avec équation et R²) et barres d'erreur.
import type { ChartPlot, ChartSeries, Color } from '@forgeoffice/pptx';
import { errorAmounts, fitTrend } from './analysis.ts';
import { seriesOf, valuesOf, xValuesOf } from './data.ts';
import { catPos, valPos } from './geometry.ts';
import type { Roles } from './series.ts';
import { TEXT_COLOR, seriesLook, seriesRank, textNode, type Env, type Out } from './style.ts';
import { el, n2 } from './svg.ts';

type Pt = [number, number];
type Point = (r: Roles, c: number, v: number) => Pt;

/** Types de graphique qui acceptent tendances et barres d'erreur. */
export const hasOverlays = (plot: ChartPlot): boolean => plot.type === 'bar' || plot.type === 'line' || plot.type === 'area' || plot.type === 'scatter';

/** Position sur l'axe des categories d'une abscisse fractionnaire (1 = premiere categorie). */
function catScreen(r: Roles, xv: number): number {
  const i = Math.floor(xv - 1);
  const c0 = catPos(r.x, i);
  return c0 + (catPos(r.x, i + 1) - c0) * (xv - 1 - i);
}

export function drawOverlays(env: Env, r: Roles, point: Point, out: Out): void {
  const scatter = r.plot.type === 'scatter';
  seriesOf(r.plot).forEach((s) => {
    const rank = seriesRank(env, s);
    const look = seriesLook(env.p, r.plot, s, rank);
    const ys = valuesOf(s.values);
    const xs = scatter ? xValuesOf(s, ys.length) : ys.map((_, i) => i + 1);
    const sx = (xv: number): number => (scatter ? valPos(r.x, xv) : catScreen(r, xv));
    trendlines(env, r, s, look.color, xs, ys, sx, point, out);
    errorBars(env, r, s, ys, xs, sx, point, out);
  });
}

function trendlines(env: Env, r: Roles, s: ChartSeries, color: Color, xs: Array<number | null>, ys: Array<number | null>, sx: (x: number) => number, point: Point, out: Out): void {
  for (const t of s.trendlines ?? []) {
    const px: number[] = [];
    const py: number[] = [];
    ys.forEach((y, i) => {
      const x = xs[i];
      if (y !== null && x !== null && x !== undefined) {
        px.push(x);
        py.push(y);
      }
    });
    const fit = fitTrend(t, px, py);
    if (!fit) continue;
    const lo = Math.min(...px) - (t.backward ?? 0);
    const hi = Math.max(...px) + (t.forward ?? 0);
    const sample = t.type === 'movingAvg' ? px : Array.from({ length: 49 }, (_, i) => lo + ((hi - lo) * i) / 48);
    const pts = sample.flatMap((x): Pt[] => {
      const y = fit.at(x);
      return y === null || !Number.isFinite(y) ? [] : [point(r, sx(x), valPos(r.y, y))];
    });
    if (pts.length < 2) continue;
    const stroke = env.p.stroke(t.line, color, 1.5);
    const attrs = t.line?.dash ? stroke : { ...stroke, 'stroke-dasharray': '6 4' };
    out.shapes.push(el('path', { d: `M${pts.map((p) => `${n2(p[0])} ${n2(p[1])}`).join('L')}`, fill: 'none', ...attrs }));
    const text = [t.displayEquation && fit.equation, t.displayR2 && fit.r2 !== null && `R² = ${String(Math.round(fit.r2 * 10000) / 10000).replace('.', ',')}`].filter(Boolean).join('   ');
    const last = pts[pts.length - 1];
    if (text && last) out.labels.push(textNode(last[0], last[1] - 10, text, env.p.text(undefined), 'end'));
  }
}

function errorBars(env: Env, r: Roles, s: ChartSeries, ys: Array<number | null>, xs: Array<number | null>, sx: (x: number) => number, point: Point, out: Out): void {
  for (const eb of s.errorBars ?? []) {
    const amounts = errorAmounts(eb, ys);
    const stroke = env.p.stroke(eb.line, TEXT_COLOR, 1);
    const cap = 4;
    ys.forEach((y, i) => {
      const a = amounts[i];
      const x = xs[i];
      if (y === null || a === null || a === undefined || x === null || x === undefined) return;
      const hi = eb.barType === 'minus' ? y : y + a;
      const lo = eb.barType === 'plus' ? y : y - a;
      const c = sx(x);
      const top = point(r, c, valPos(r.y, hi));
      const bottom = point(r, c, valPos(r.y, lo));
      const parts = [`M${n2(top[0])} ${n2(top[1])}L${n2(bottom[0])} ${n2(bottom[1])}`];
      if (!eb.noEndCap) {
        const horizontal = r.x.horizontal;
        for (const e of [top, bottom]) parts.push(horizontal ? `M${n2(e[0] - cap)} ${n2(e[1])}L${n2(e[0] + cap)} ${n2(e[1])}` : `M${n2(e[0])} ${n2(e[1] - cap)}L${n2(e[0])} ${n2(e[1] + cap)}`);
      }
      out.shapes.push(el('path', { d: parts.join(''), fill: 'none', ...stroke }));
    });
  }
}
