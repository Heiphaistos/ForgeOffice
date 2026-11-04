// Series sur axes : barres et histogrammes, courbes, aires, nuages de points, bulles (stock et surface en repli courbes).
import type { ChartPlot, ChartSeries } from '@forgeoffice/pptx';
import { categoryLabel, isStacked, labelsOf, labelText, seriesName, seriesOf, stack, valuesOf, xValuesOf } from './data.ts';
import { clamp } from './format.ts';
import { band, catPos, crossValue, valPos, type AxisInfo, type Rect } from './geometry.ts';
import { BACKGROUND, TEXT_COLOR, markerFor, markerNode, markerPaint, placeLabel, seriesLook, seriesRank, textNode, type Attrs, type Env, type Look, type Out } from './style.ts';
import { el, n2 } from './svg.ts';

export interface Roles {
  plot: ChartPlot;
  /** Axe des categories (ou des X pour les nuages). */
  x: AxisInfo;
  /** Axe des valeurs. */
  y: AxisInfo;
}

type Pt = [number, number];

/** Point ecran : la categorie suit l'axe x (horizontal sauf barres horizontales). */
const point = (r: Roles, c: number, v: number): Pt => (r.x.horizontal ? [c, v] : [v, c]);

/** Chemin d'une ligne brisee ou lissee (Bezier type Catmull-Rom, proche du lissage d'Office). */
export function pathD(pts: Pt[], smooth: boolean): string {
  const at = (i: number): Pt => pts[Math.max(0, Math.min(pts.length - 1, i))] ?? [0, 0];
  return pts
    .map(([x, y], i) => {
      if (i === 0) return `M${n2(x)} ${n2(y)}`;
      if (!smooth) return `L${n2(x)} ${n2(y)}`;
      const [p0, p1, p3] = [at(i - 2), at(i - 1), at(i + 1)];
      const c1 = `${n2(p1[0] + (x - p0[0]) / 6)} ${n2(p1[1] + (y - p0[1]) / 6)}`;
      const c2 = `${n2(x - (p3[0] - p1[0]) / 6)} ${n2(y - (p3[1] - p1[1]) / 6)}`;
      return `C${c1} ${c2} ${n2(x)} ${n2(y)}`;
    })
    .join('');
}

/** Trait d'une serie : les valeurs manquantes coupent la ligne, sauf « span ». */
function polyline(pts: Array<Pt | null>, smooth: boolean, span: boolean, stroke: Attrs, out: Out): void {
  const segments: Pt[][] = [[]];
  for (const p of pts) {
    if (p) segments[segments.length - 1]?.push(p);
    else if (!span) segments.push([]);
  }
  const d = segments.map((s) => pathD(s, smooth)).join('');
  if (d && stroke.stroke !== 'none') out.shapes.push(el('path', { d, fill: 'none', ...stroke }));
}

function markers(env: Env, plot: ChartPlot, s: ChartSeries, look: Look, pts: Array<Pt | null>, out: Out): void {
  const m = markerFor(plot, s);
  if (!m) return;
  const { fill, stroke } = markerPaint(env.p, s, look);
  for (const p of pts) if (p) out.shapes.push(markerNode(m, p[0], p[1], fill, stroke));
}

/** Etiquettes de donnees autour des points (courbes, aires, nuages, radar). */
export function pointLabels(env: Env, plot: ChartPlot, s: ChartSeries, pts: Array<Pt | null>, values: Array<number | null>, fallback: string, out: Out, xs?: Array<number | null>): void {
  const dl = labelsOf(plot, s);
  if (!dl) return;
  const st = env.p.text(dl.props);
  const name = seriesName(s, seriesRank(env, s));
  pts.forEach((p, i) => {
    const v = values[i];
    if (!p || v === null || v === undefined) return;
    const x = xs?.[i];
    const category = x === undefined || x === null ? categoryLabel(s, i) : String(x);
    const text = labelText(dl, { name, category, value: v, format: s.values.formatCode });
    out.labels.push(placeLabel(p[0], p[1], text, st, dl.position ?? fallback));
  });
}

function drawBars(env: Env, r: Roles, out: Out): void {
  const { plot, x, y } = r;
  const series = seriesOf(plot);
  const n = x.count;
  if (!n || !series.length) return;
  const rows = series.map((s) => valuesOf(s.values));
  const spans = stack(plot, rows, n, crossValue(x.axis.crosses, y), true);
  const stacked = isStacked(plot);
  const k = stacked ? 1 : series.length;
  const gap = clamp(plot.gapWidth ?? 150, 0, 500, 150) / 100;
  const overlap = stacked ? 1 : clamp(plot.overlap ?? 0, -100, 100, 0) / 100;
  const b = band(x);
  const dir = x.end >= x.start ? 1 : -1;
  const w = b / (k - (k - 1) * overlap + gap);
  const stepW = w * (1 - overlap);
  const lead = (b - (w + (k - 1) * stepW)) / 2;
  series.forEach((s, si) => {
    const rank = seriesRank(env, s);
    const dl = labelsOf(plot, s);
    const st = dl ? env.p.text(dl.props) : undefined;
    spans[si]?.forEach((span, i) => {
      if (!span) return;
      const c0 = x.start + dir * (i * b + lead + (stacked ? 0 : si) * stepW);
      const c1 = c0 + dir * w;
      const vb = valPos(y, span[0]);
      const ve = valPos(y, span[1]);
      const [ax, ay] = point(r, c0, vb);
      const [bx, by] = point(r, c1, ve);
      const look = seriesLook(env.p, plot, s, rank, i);
      const raw = rows[si]?.[i] ?? 0;
      const invert = raw < 0 && (s.points?.find((q) => q.index === i)?.invertIfNegative ?? s.invertIfNegative);
      const fill = invert ? env.p.color(BACKGROUND) : look.fill;
      out.shapes.push(el('rect', { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay), fill, ...look.stroke }));
      if (!dl || !st) return;
      const text = labelText(dl, { name: seriesName(s, rank), category: categoryLabel(s, i), value: raw, format: s.values.formatCode });
      const pos = dl.position ?? (stacked ? 'ctr' : 'outEnd');
      const cc = (c0 + c1) / 2;
      const sgn = Math.sign(ve - vb) || (x.horizontal ? -1 : 1);
      if (x.horizontal) {
        const d = st.size * 0.8;
        const at = pos === 'ctr' ? (vb + ve) / 2 : pos === 'inEnd' ? ve - sgn * d : pos === 'inBase' ? vb + sgn * d : ve + sgn * d;
        out.labels.push(textNode(cc, at, text, st));
      } else {
        const at = pos === 'ctr' ? (vb + ve) / 2 : pos === 'inEnd' ? ve - sgn * 3 : pos === 'inBase' ? vb + sgn * 3 : ve + sgn * 3;
        const anchor = pos === 'ctr' ? 'middle' : (pos === 'inEnd') === sgn > 0 ? 'end' : 'start';
        out.labels.push(textNode(at, cc, text, st, anchor));
      }
    });
  });
}

function drawLines(env: Env, r: Roles, out: Out): void {
  const { plot, x, y } = r;
  const series = seriesOf(plot);
  const n = x.count;
  const blanks = env.chart.displayBlanksAs ?? 'gap';
  const rows = series.map((s) => {
    const v = valuesOf(s.values);
    return blanks === 'zero' ? Array.from({ length: n }, (_, i) => v[i] ?? 0) : v;
  });
  const spans = stack(plot, rows, n, 0, false);
  if (plot.type === 'stock' && plot.highLowLines) {
    const stroke = env.p.stroke(undefined, TEXT_COLOR, 0.75);
    for (let i = 0; i < n; i++) {
      const vals = rows.map((row) => row[i]).filter((v): v is number => v !== null && v !== undefined);
      if (vals.length < 2) continue;
      const [a, b] = [point(r, catPos(x, i), valPos(y, Math.min(...vals))), point(r, catPos(x, i), valPos(y, Math.max(...vals)))];
      out.shapes.push(el('path', { d: `M${n2(a[0])} ${n2(a[1])}L${n2(b[0])} ${n2(b[1])}`, fill: 'none', ...stroke }));
    }
  }
  series.forEach((s, si) => {
    const look = seriesLook(env.p, plot, s, seriesRank(env, s));
    const pts = (spans[si] ?? []).map((sp, i): Pt | null => (sp ? point(r, catPos(x, i), valPos(y, sp[1])) : null));
    polyline(pts, s.smooth ?? false, blanks === 'span', look.stroke, out);
    markers(env, plot, s, look, pts, out);
    pointLabels(env, plot, s, pts, rows[si] ?? [], 'r', out);
  });
}

function drawArea(env: Env, r: Roles, out: Out): void {
  const { plot, x, y } = r;
  const series = seriesOf(plot);
  const n = x.count;
  const rows = series.map((s) => {
    const v = valuesOf(s.values);
    return Array.from({ length: n }, (_, i) => v[i] ?? 0);
  });
  const spans = stack(plot, rows, n, crossValue(x.axis.crosses, y), false);
  series.forEach((s, si) => {
    const look = seriesLook(env.p, plot, s, seriesRank(env, s));
    const row = spans[si] ?? [];
    const top = row.map((sp, i) => point(r, catPos(x, i), valPos(y, sp?.[1] ?? 0)));
    const base = row.map((sp, i) => point(r, catPos(x, i), valPos(y, sp?.[0] ?? 0))).reverse();
    if (!top.length) return;
    out.shapes.push(el('path', { d: `${pathD([...top, ...base], false)}Z`, fill: look.fill, ...look.stroke }));
    pointLabels(env, plot, s, top, rows[si] ?? [], 'ctr', out);
  });
}

function drawScatter(env: Env, r: Roles, inner: Rect, out: Out): void {
  const { plot, x, y } = r;
  const series = seriesOf(plot);
  const bubble = plot.type === 'bubble';
  const style = plot.scatterStyle ?? 'lineMarker';
  const blanks = env.chart.displayBlanksAs ?? 'gap';
  const sizes = series.map((s) => (s.bubbleSizes ? valuesOf(s.bubbleSizes) : []));
  const maxSize = sizes.flat().reduce((m: number, v) => Math.max(m, Math.abs(v ?? 0)), 0) || 1;
  // Office : la plus grosse bulle mesure 25 % du petit cote de la zone de tracage (bubbleScale en %).
  const rMax = (Math.min(inner.w, inner.h) / 8) * (clamp(plot.bubbleScale ?? 100, 0, 300, 100) / 100);
  series.forEach((s, si) => {
    const rank = seriesRank(env, s);
    const ys = valuesOf(s.values);
    const xs = xValuesOf(s, ys.length);
    const pts = ys.map((v, i): Pt | null => {
      const xv = xs[i];
      return v === null || xv === null || xv === undefined ? null : point(r, valPos(x, xv), valPos(y, v));
    });
    if (bubble) {
      pts.forEach((p, i) => {
        const size = s.bubbleSizes ? (sizes[si]?.[i] ?? null) : 1;
        if (!p || size === null || (size < 0 && !plot.showNegativeBubbles)) return;
        const look = seriesLook(env.p, plot, s, rank, i);
        const fill = size < 0 ? env.p.color(BACKGROUND) : look.fill;
        out.shapes.push(el('circle', { cx: p[0], cy: p[1], r: rMax * Math.sqrt(Math.abs(size) / maxSize), fill, ...look.stroke }));
      });
    } else {
      const look = seriesLook(env.p, plot, s, rank);
      if (style !== 'marker' && style !== 'none') polyline(pts, s.smooth ?? style.startsWith('smooth'), blanks === 'span', look.stroke, out);
      markers(env, plot, s, look, pts, out);
    }
    pointLabels(env, plot, s, pts, ys, bubble ? 'ctr' : 'r', out, xs);
  });
}

export function drawPlot(env: Env, r: Roles, inner: Rect, out: Out): void {
  if (r.plot.type === 'bar') drawBars(env, r, out);
  else if (r.plot.type === 'area') drawArea(env, r, out);
  else if (r.plot.type === 'scatter' || r.plot.type === 'bubble') drawScatter(env, r, inner, out);
  else drawLines(env, r, out);
}
