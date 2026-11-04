// Graphiques a axes : calcul des axes, mise en page de la zone de tracage, quadrillages, axes et series.
import type { ChartAxis, ChartGridlines, ChartPlot } from '@forgeoffice/pptx';
import { categoryLabel, pointCount, seriesOf, stack, valuesOf, xValuesOf } from './data.ts';
import { axisScale, formatNumber, textWidth, ticks, truncate } from './format.ts';
import { band, catPos, catTicks, crossValue, fit, valPos, type AxisInfo, type Rect, type Side } from './geometry.ts';
import { drawPlot, type Roles } from './series.ts';
import { GRID_COLOR, MINOR_GRID_COLOR, textNode, type Env, type Out, type TextStyle } from './style.ts';
import { CHART_STRINGS } from './strings.ts';
import { el, n2, type SvgNode } from './svg.ts';

const OPPOSITE: Record<Side, Side> = { b: 't', t: 'b', l: 'r', r: 'l' };

function makeInfo(axis: ChartAxis, kind: 'cat' | 'val', horizontal: boolean): AxisInfo {
  const side: Side = horizontal ? (axis.position === 't' ? 't' : 'b') : axis.position === 'r' ? 'r' : 'l';
  return {
    axis,
    kind,
    horizontal,
    side: axis.tickLabelPosition === 'high' ? OPPOSITE[side] : side,
    visible: !axis.deleted,
    lo: Infinity,
    hi: -Infinity,
    includeZero: false,
    percent: false,
    count: 0,
    labels: [],
    between: false,
    min: 0,
    max: 1,
    step: 0.2,
    ticks: [],
    start: 0,
    end: 0,
  };
}

/** Accumule les donnees d'une sous-partie sur ses axes (etendue, categories, empilement). */
function accumulate(env: Env, plot: ChartPlot, x: AxisInfo, y: AxisInfo): void {
  const series = seriesOf(plot);
  const n = pointCount(series);
  const zero = plot.type === 'area' || env.chart.displayBlanksAs === 'zero';
  const rows = series.map((s) => {
    const v = valuesOf(s.values);
    return Array.from({ length: n }, (_, i) => v[i] ?? (zero ? 0 : null));
  });
  if (x.kind === 'cat') {
    x.count = Math.max(x.count, n);
    if (x.labels.length < n) x.labels = Array.from({ length: n }, (_, i) => categoryLabel(series[0], i));
    x.between ||= plot.type === 'bar' || y.axis.crossBetween !== 'midCat';
  } else {
    for (const s of series) {
      for (const v of xValuesOf(s, n)) {
        if (v === null) continue;
        x.lo = Math.min(x.lo, v);
        x.hi = Math.max(x.hi, v);
      }
    }
    x.format ??= series[0]?.xValues?.formatCode;
  }
  const filled = plot.type === 'bar' || plot.type === 'area';
  y.includeZero ||= filled;
  if (plot.grouping === 'percentStacked') y.percent = true;
  for (const row of stack(plot, rows, n, 0, plot.type === 'bar')) {
    for (const span of row) {
      if (!span) continue;
      const lo = filled ? Math.min(span[0], span[1]) : span[1];
      const hi = filled ? Math.max(span[0], span[1]) : span[1];
      y.lo = Math.min(y.lo, lo);
      y.hi = Math.max(y.hi, hi);
    }
  }
  y.format ??= series[0]?.values?.formatCode;
}

/** Associe chaque sous-partie a ses axes (axes absents du fichier : axes par defaut). */
function buildAxes(env: Env, plots: ChartPlot[]): { roles: Roles[]; partner: Map<AxisInfo, AxisInfo> } {
  const infos = new Map<number, AxisInfo>();
  const partner = new Map<AxisInfo, AxisInfo>();
  const roles = plots.map((plot, k): Roles => {
    const scatter = plot.type === 'scatter' || plot.type === 'bubble';
    const find = (id: number | undefined, fallback: ChartAxis): ChartAxis => env.chart.axes.find((a) => a.id === id) ?? fallback;
    const a0 = find(plot.axisIds[0], { id: -1 - 2 * k, type: scatter ? 'val' : 'cat', position: 'b', crossAxisId: -2 - 2 * k });
    const a1 = find(plot.axisIds[1], { id: -2 - 2 * k, type: 'val', position: 'l', crossAxisId: -1 - 2 * k });
    const [xa, ya] = scatter || a0.type !== 'val' || a1.type === 'val' ? [a0, a1] : [a1, a0];
    const horizontalBars = plot.type === 'bar' && plot.barDirection === 'bar';
    const get = (a: ChartAxis, kind: 'cat' | 'val', horizontal: boolean): AxisInfo => {
      const found = infos.get(a.id) ?? makeInfo(a, kind, horizontal);
      infos.set(a.id, found);
      return found;
    };
    const x = get(xa, scatter ? 'val' : 'cat', !horizontalBars);
    const y = get(ya, 'val', horizontalBars);
    if (!partner.has(x)) partner.set(x, y);
    if (!partner.has(y)) partner.set(y, x);
    accumulate(env, plot, x, y);
    return { plot, x, y };
  });
  return { roles, partner };
}

interface Placed {
  a: AxisInfo;
  st: TextStyle;
  texts: string[];
  maxW: number;
  labelExt: number;
  title?: string;
  titleSt: TextStyle;
  titleExt: number;
  offset: number;
  rotate: boolean;
  every: number;
}

function axisTexts(a: AxisInfo): string[] {
  if (a.kind === 'cat') return a.labels.slice(0, a.count);
  const nf = a.axis.numberFormat;
  const code = nf && !nf.sourceLinked ? nf.code : a.percent ? '0%' : (a.format ?? nf?.code);
  return a.ticks.map((t) => formatNumber(t, code));
}

function place(env: Env, a: AxisInfo, rect: Rect): Placed {
  const st = env.p.text(a.axis.textProps);
  const show = a.visible && a.axis.tickLabelPosition !== 'none';
  let texts = show ? axisTexts(a) : [];
  let maxW = texts.reduce((m, t) => Math.max(m, textWidth(t, st.size)), 0);
  if (!a.horizontal && maxW > rect.w * 0.35) {
    maxW = rect.w * 0.35;
    texts = texts.map((t) => truncate(t, maxW, st.size));
  }
  const labelExt = !texts.length ? 0 : a.horizontal ? st.size * 1.2 + 5 : maxW + 6;
  const titleSt = env.p.text(a.axis.title?.props, 10);
  const title = a.visible && a.axis.title ? a.axis.title.text?.trim() || CHART_STRINGS.axisTitle : undefined;
  return { a, st, texts, maxW, labelExt, title, titleSt, titleExt: title ? titleSt.size * 1.6 : 0, offset: 0, rotate: false, every: 1 };
}

/** Etiquettes de categories horizontales : rotation a -45 degres et saut d'etiquettes si elles ne tiennent pas. */
function fitHorizontal(q: Placed, innerW: number, rectH: number): void {
  if (q.a.kind !== 'cat' || !q.texts.length) return;
  const b = innerW / Math.max(1, q.a.between ? q.a.count : q.a.count - 1);
  if (q.maxW <= b * 0.95) return;
  q.rotate = true;
  const ext = Math.min(q.maxW * 0.71 + q.st.size, rectH * 0.35);
  q.texts = q.texts.map((t) => truncate(t, (ext - q.st.size) / 0.71, q.st.size));
  q.labelExt = ext + 5;
  q.every = Math.max(1, Math.ceil((q.st.size * 1.4) / b));
}

function gridPath(a: AxisInfo, positions: number[], inner: Rect): string {
  return positions
    .map((v) => (a.horizontal ? `M${n2(v)} ${n2(inner.y)}V${n2(inner.y + inner.h)}` : `M${n2(inner.x)} ${n2(v)}H${n2(inner.x + inner.w)}`))
    .join('');
}

function gridlines(env: Env, a: AxisInfo, inner: Rect, nodes: SvgNode[]): void {
  const draw = (g: ChartGridlines | undefined, color: typeof GRID_COLOR, positions: number[]): void => {
    if (!g || !positions.length) return;
    const stroke = env.p.stroke(g.line, color, 0.75);
    if (stroke.stroke !== 'none') nodes.push(el('path', { d: gridPath(a, positions, inner), fill: 'none', ...stroke }));
  };
  if (a.kind === 'cat') {
    draw(a.axis.majorGridlines, GRID_COLOR, catTicks(a));
    return;
  }
  const minor = a.axis.minorUnit !== undefined && a.axis.minorUnit > 0 && (a.max - a.min) / a.axis.minorUnit <= 1000 ? a.axis.minorUnit : a.step / 5;
  draw(a.axis.minorGridlines, MINOR_GRID_COLOR, ticks(a, minor).map((t) => valPos(a, t)));
  draw(a.axis.majorGridlines, GRID_COLOR, a.ticks.map((t) => valPos(a, t)));
}

/** Coordonnee (perpendiculaire) du trait d'axe : la ou il coupe l'axe partenaire. */
function crossing(a: AxisInfo, other: AxisInfo | undefined, inner: Rect): number {
  if (!other) return a.side === 'b' ? inner.y + inner.h : a.side === 't' ? inner.y : a.side === 'l' ? inner.x : inner.x + inner.w;
  if (other.kind === 'val') return valPos(other, crossValue(a.axis.crosses, other));
  return a.axis.crosses === 'max' ? other.end : other.start;
}

function drawAxis(env: Env, q: Placed, other: AxisInfo | undefined, inner: Rect, nodes: SvgNode[]): void {
  const { a, st } = q;
  const positions = a.kind === 'cat' ? catTicks(a) : a.ticks.map((t) => valPos(a, t));
  if (a.visible) {
    const stroke = env.p.stroke(a.axis.line, a.kind === 'cat' ? GRID_COLOR : null, 0.75);
    const c = crossing(a, other, inner);
    if (stroke.stroke !== 'none') {
      const d = a.horizontal ? `M${n2(inner.x)} ${n2(c)}H${n2(inner.x + inner.w)}` : `M${n2(c)} ${n2(inner.y)}V${n2(inner.y + inner.h)}`;
      nodes.push(el('path', { d, fill: 'none', ...stroke }));
      const mark = a.axis.majorTickMark;
      if (mark === 'out' || mark === 'in' || mark === 'cross') {
        const out = a.side === 'b' || a.side === 'r' ? 1 : -1;
        const [from, to] = [mark === 'out' ? 0 : -4 * out, mark === 'in' ? 0 : 4 * out];
        const d2 = positions.map((v) => (a.horizontal ? `M${n2(v)} ${n2(c + from)}V${n2(c + to)}` : `M${n2(c + from)} ${n2(v)}H${n2(c + to)}`)).join('');
        nodes.push(el('path', { d: d2, fill: 'none', ...stroke }));
      }
    }
  }
  // ponytail: etiquettes toujours au bord de la zone de tracage (comme « low ») ; « nextTo » sur l'axe du zero si besoin.
  const labelAt = (i: number): number => (a.kind === 'cat' ? catPos(a, i) : (positions[i] ?? 0));
  const edge = a.side === 'b' ? inner.y + inner.h + q.offset : a.side === 't' ? inner.y - q.offset : a.side === 'l' ? inner.x - q.offset : inner.x + inner.w + q.offset;
  const sign = a.side === 'b' || a.side === 'r' ? 1 : -1;
  q.texts.forEach((t, i) => {
    if (i % q.every) return;
    const v = labelAt(i);
    if (!a.horizontal) nodes.push(textNode(edge + sign * 4, v, t, st, sign > 0 ? 'start' : 'end'));
    else if (!q.rotate) nodes.push(textNode(v, edge + sign * (3 + st.size * 0.6), t, st));
    else {
      const cy = edge + sign * (4 + st.size * 0.3);
      nodes.push(textNode(v + st.size * 0.3, cy, t, st, 'end', { transform: `rotate(-45 ${n2(v)} ${n2(cy)})` }));
    }
  });
  if (!q.title) return;
  const tc = edge + sign * (q.labelExt + q.titleExt / 2);
  if (a.horizontal) nodes.push(textNode(inner.x + inner.w / 2, tc, q.title, q.titleSt));
  else {
    const cy = inner.y + inner.h / 2;
    nodes.push(textNode(tc, cy, q.title, q.titleSt, 'middle', { transform: `rotate(-90 ${n2(tc)} ${n2(cy)})` }));
  }
}

/** Zone de tracage, quadrillages, series, axes et etiquettes des sous-parties a axes. */
export function renderAxes(env: Env, plots: ChartPlot[], rect: Rect): SvgNode[] {
  const { roles, partner } = buildAxes(env, plots);
  const axes = [...new Set(roles.flatMap((r) => [r.x, r.y]))];
  for (const a of axes) {
    if (a.kind === 'cat') continue;
    const size = env.p.text(a.axis.textProps).size;
    const len = a.horizontal ? rect.w * 0.85 : rect.h * 0.85;
    const maxTicks = Math.max(2, Math.min(10, Math.floor(len / (size * (a.horizontal ? 5 : 2.4)))));
    Object.assign(a, axisScale(a.lo, a.hi, a.axis, maxTicks, a.includeZero, a.percent ? { min: a.lo < 0 ? -1 : 0, max: 1 } : undefined));
    a.ticks = ticks(a);
  }
  const placed = axes.map((a) => place(env, a, rect));
  const res: Record<Side, number> = { l: 0, r: 0, t: 0, b: 0 };
  const reserve = (q: Placed): void => {
    q.offset = res[q.a.side];
    res[q.a.side] += q.labelExt + q.titleExt;
  };
  placed.filter((q) => !q.a.horizontal).forEach(reserve);
  // Categories sur les graduations (aires) : la moitie de la premiere et de la derniere etiquette deborde.
  const overhang = placed.reduce((m, q) => (q.a.horizontal && q.a.kind === 'cat' && !q.a.between ? Math.max(m, Math.min(q.maxW / 2, rect.w * 0.15)) : m), 0);
  const left = Math.max(res.l, overhang);
  const innerW = rect.w - left - Math.max(res.r, 8, overhang);
  for (const q of placed.filter((q) => q.a.horizontal)) {
    fitHorizontal(q, innerW, rect.h);
    reserve(q);
  }
  const top = Math.max(res.t, 6);
  const inner = fit({ x: rect.x + left, y: rect.y + top, w: innerW, h: rect.h - top - res.b });
  for (const a of axes) {
    const [s, e] = a.horizontal ? [inner.x, inner.x + inner.w] : [inner.y + inner.h, inner.y];
    a.start = a.axis.reverse ? e : s;
    a.end = a.axis.reverse ? s : e;
  }
  for (const q of placed) if (!q.a.horizontal && q.a.kind === 'cat') q.every = Math.max(1, Math.ceil((q.st.size * 1.2) / band(q.a)));

  const nodes: SvgNode[] = [];
  const plotFill = env.p.fill(env.chart.plotFill, null);
  const plotLine = env.p.stroke(env.chart.plotLine, null, 0.75);
  if (plotFill !== 'none' || plotLine.stroke !== 'none') nodes.push(el('rect', { x: inner.x, y: inner.y, width: inner.w, height: inner.h, fill: plotFill, ...plotLine }));
  for (const a of axes) gridlines(env, a, inner, nodes);
  const out: Out = { shapes: [], labels: [] };
  for (const r of roles) drawPlot(env, r, inner, out);
  nodes.push(...out.shapes);
  for (const q of placed) drawAxis(env, q, partner.get(q.a), inner, nodes);
  nodes.push(...out.labels);
  return nodes;
}
