// Legende (positions r, l, t, b, tr) : une entree par serie, ou par categorie quand les couleurs varient par point.
import type { ChartLegend, ChartPlot, ChartSeries } from '@forgeoffice/pptx';
import { MAX_POINTS, categoryLabel, seriesName, seriesOf } from './data.ts';
import { fit, type Rect } from './geometry.ts';
import { textWidth, truncate } from './format.ts';
import { isLinear, markerFor, markerNode, markerPaint, seriesLook, seriesRank, textNode, varies, type Env } from './style.ts';
import { el, n2, type SvgNode } from './svg.ts';

const MAX_ENTRIES = 100;
const GAP = 10;
const KEY_GAP = 4;

interface Entry {
  text: string;
  keyW: number;
  key: (x: number, cy: number) => SvgNode[];
}

function entry(env: Env, plot: ChartPlot, s: ChartSeries, text: string, point?: number): Entry {
  const look = seriesLook(env.p, plot, s, seriesRank(env, s), point);
  if (!isLinear(plot)) return { text, keyW: 6, key: (x, cy) => [el('rect', { x, y: cy - 3, width: 6, height: 6, fill: look.fill, ...look.stroke })] };
  const m = markerFor(plot, s);
  return {
    text,
    keyW: 14,
    key: (x, cy) => {
      const nodes = [el('path', { d: `M${n2(x)} ${n2(cy)}H${n2(x + 14)}`, fill: 'none', ...look.stroke })];
      if (m) {
        const { fill, stroke } = markerPaint(env.p, s, look);
        nodes.push(markerNode(m, x + 7, cy, fill, stroke));
      }
      return nodes;
    },
  };
}

function entries(env: Env): Entry[] {
  const out: Entry[] = [];
  for (const plot of env.chart.plots) {
    const series = seriesOf(plot);
    const first = series[0];
    if (varies(plot) && first) {
      const n = Math.min(MAX_ENTRIES, MAX_POINTS, Math.max(first.categories?.labels?.length ?? 0, first.values?.values?.length ?? 0));
      for (let i = 0; i < n; i++) out.push(entry(env, plot, first, categoryLabel(first, i), i));
    } else for (const s of series) out.push(entry(env, plot, s, seriesName(s, seriesRank(env, s))));
    if (out.length >= MAX_ENTRIES) break;
  }
  return out.slice(0, MAX_ENTRIES);
}

/** Dessine la legende dans r et rend la place restante (inchangee si la legende se superpose). */
export function renderLegend(env: Env, legend: ChartLegend, r: Rect, nodes: SvgNode[]): Rect {
  const st = env.p.text(legend.props);
  const rowH = st.size * 1.5;
  const items = entries(env).map((e) => ({ ...e, w: e.keyW + KEY_GAP + textWidth(e.text, st.size) }));
  if (!items.length) return r;
  const draw = (it: (typeof items)[number], x: number, cy: number, w: number): void => {
    nodes.push(...it.key(x, cy), textNode(x + it.keyW + KEY_GAP, cy, truncate(it.text, w - it.keyW - KEY_GAP, st.size), st, 'start'));
  };
  const pos = legend.position;
  if (pos === 'b' || pos === 't') {
    const rows: Array<typeof items> = [[]];
    let used = 0;
    for (const it of items) {
      const w = Math.min(it.w, r.w);
      const row = rows[rows.length - 1] ?? [];
      if (row.length && used + GAP + w > r.w) {
        rows.push([it]);
        used = w;
      } else {
        row.push(it);
        used += (row.length > 1 ? GAP : 0) + w;
      }
    }
    const shown = rows.slice(0, Math.max(1, Math.floor((r.h * 0.4) / rowH)));
    const h = shown.length * rowH;
    const top = pos === 'b' ? r.y + r.h - h : r.y;
    shown.forEach((row, k) => {
      const total = row.reduce((t, it) => t + Math.min(it.w, r.w), 0) + GAP * (row.length - 1);
      let x = r.x + (r.w - total) / 2;
      for (const it of row) {
        const w = Math.min(it.w, r.w);
        draw(it, x, top + k * rowH + rowH / 2, w);
        x += w + GAP;
      }
    });
    if (legend.overlay) return r;
    return fit(pos === 'b' ? { ...r, h: r.h - h - 6 } : { ...r, y: r.y + h + 6, h: r.h - h - 6 });
  }
  const colW = Math.min(items.reduce((m, it) => Math.max(m, it.w), 0), r.w * 0.4);
  const shown = items.slice(0, Math.max(1, Math.floor(r.h / rowH)));
  const h = shown.length * rowH;
  const x = pos === 'l' ? r.x : r.x + r.w - colW;
  const top = pos === 'tr' ? r.y : r.y + (r.h - h) / 2;
  shown.forEach((it, k) => draw(it, x, top + k * rowH + rowH / 2, colW));
  if (legend.overlay) return r;
  return fit(pos === 'l' ? { ...r, x: r.x + colW + 8, w: r.w - colW - 8 } : { ...r, w: r.w - colW - 8 });
}
