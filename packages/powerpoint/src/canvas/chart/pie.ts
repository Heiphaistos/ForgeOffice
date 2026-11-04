// Secteurs, anneaux et secteurs de secteur (rendus comme secteurs).
import type { ChartPlot } from '@forgeoffice/pptx';
import { categoryLabel, labelsOf, labelText, seriesName, seriesOf, valuesOf } from './data.ts';
import { clamp } from './format.ts';
import type { Rect } from './geometry.ts';
import { seriesLook, seriesRank, textNode, type Env, type Out } from './style.ts';
import { el, n2 } from './svg.ts';

/** Angles [debut, fin] en degres (sens horaire depuis midi) de chaque part ; valeurs absolues, trous = 0. */
export function sliceAngles(values: Array<number | null>, firstSliceAngle = 0): Array<[number, number]> {
  const vals = values.map((v) => Math.abs(v ?? 0));
  const total = vals.reduce((a, b) => a + b, 0);
  let a = clamp(firstSliceAngle, 0, 360, 0);
  return vals.map((v): [number, number] => {
    const a0 = a;
    a += total > 0 ? (v / total) * 360 : 0;
    return [a0, a];
  });
}

/** Chemin d'une part (r0 = 0) ou d'un morceau d'anneau ; un tour complet devient deux cercles (regle evenodd). */
export function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const pt = (r: number, a: number): string => {
    const t = (a * Math.PI) / 180;
    return `${n2(cx + r * Math.sin(t))} ${n2(cy - r * Math.cos(t))}`;
  };
  const arc = (r: number, large: number, sweep: number, a: number): string => `A${n2(r)} ${n2(r)} 0 ${large} ${sweep} ${pt(r, a)}`;
  if (a1 - a0 >= 359.99) {
    const ring = (r: number): string => (r > 0 ? `M${pt(r, 0)}${arc(r, 1, 1, 180)}${arc(r, 1, 1, 360)}Z` : '');
    return ring(r1) + ring(r0);
  }
  const large = a1 - a0 > 180 ? 1 : 0;
  const outer = `M${pt(r1, a0)}${arc(r1, large, 1, a1)}`;
  return r0 > 0 ? `${outer}L${pt(r0, a1)}${arc(r0, large, 0, a0)}Z` : `${outer}L${n2(cx)} ${n2(cy)}Z`;
}

export function renderPie(env: Env, plot: ChartPlot, rect: Rect, out: Out): void {
  const all = seriesOf(plot);
  const doughnut = plot.type === 'doughnut';
  const rings = doughnut ? all : all.slice(0, 1);
  if (!rings.length) return;
  const outside = rings.some((s) => labelsOf(plot, s)?.position === 'outEnd');
  const explosion = (s: (typeof rings)[number], i: number): number => clamp(s.points?.find((q) => q.index === i)?.explosion ?? s.explosion ?? 0, 0, 400, 0) / 100;
  const maxExplosion = rings.reduce((m, s) => Math.max(m, ...valuesOf(s.values).map((_, i) => explosion(s, i))), 0);
  const R = Math.max(1, Math.min(rect.w, rect.h) / 2 - (outside ? env.p.text(undefined).size * 2 : 2)) / (1 + maxExplosion);
  const hole = doughnut ? (R * clamp(plot.holeSize ?? 50, 10, 90, 50)) / 100 : 0;
  const thickness = (R - hole) / rings.length;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  rings.forEach((s, k) => {
    const values = valuesOf(s.values);
    const total = values.reduce((t: number, v) => t + Math.abs(v ?? 0), 0);
    if (!(total > 0)) return;
    const rank = seriesRank(env, s);
    const r0 = hole + k * thickness;
    const r1 = r0 + thickness;
    const dl = labelsOf(plot, s);
    const st = dl ? env.p.text(dl.props) : undefined;
    sliceAngles(values, plot.firstSliceAngle).forEach(([a0, a1], i) => {
      if (a1 <= a0) return;
      const mid = (((a0 + a1) / 2) * Math.PI) / 180;
      const e = explosion(s, i) * R;
      const ox = cx + e * Math.sin(mid);
      const oy = cy - e * Math.cos(mid);
      const look = seriesLook(env.p, plot, s, rank, i);
      out.shapes.push(el('path', { d: sector(ox, oy, r0, r1, a0, a1), fill: look.fill, 'fill-rule': 'evenodd', ...look.stroke }));
      if (!dl || !st) return;
      const value = values[i] ?? 0;
      const text = labelText(dl, { name: seriesName(s, rank), category: categoryLabel(s, i), value, format: s.values.formatCode, percent: Math.abs(value) / total });
      const pos = dl.position ?? 'bestFit';
      const out1 = pos === 'outEnd' && !doughnut;
      const rr = doughnut ? (r0 + r1) / 2 : out1 ? r1 + 4 : pos === 'inEnd' ? r1 * 0.8 : pos === 'ctr' ? r1 * 0.5 : r1 * 0.65;
      const sin = Math.sin(mid);
      const anchor = out1 && sin > 0.1 ? 'start' : out1 && sin < -0.1 ? 'end' : 'middle';
      out.labels.push(textNode(ox + rr * sin, oy - rr * Math.cos(mid), text, st, anchor));
    });
  });
}
