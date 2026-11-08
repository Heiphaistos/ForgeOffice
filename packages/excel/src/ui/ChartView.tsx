// Rendu SVG d'un graphique (ChartModel) : histogrammes et barres (groupes, empiles), courbes, aires,
// secteurs, anneau, nuages de points et graphiques combines ; titre, legende, axes, quadrillage, etiquettes.
import type { ReactNode } from 'react';
import type { ChartModel, ChartPlot } from '@forgeoffice/xlsx';
import { linearFit } from '../logic/chart-elements.ts';
import { niceScale, type ResolvedChart, type ResolvedSeries } from '../logic/charts.ts';

export interface ChartViewProps {
  model: ChartModel;
  data: ResolvedChart;
  width: number;
  height: number;
  /** Nombre -> texte francais. */
  num: (v: number) => string;
}

/** Cles d'etiquettes uniques meme quand les elements de plusieurs series ou graphiques combines sont assembles (un graphique mixte repetait `l7`). */
let labelSeq = 0;
const labelKey = (): string => `l${labelSeq++}`;

const FONT = '"Aptos", "Segoe UI", system-ui, sans-serif';
const TEXT = '#595959';

function lighten(hex: string, t: number): string {
  const c = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `#${c.map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

export function ChartView({ model, data, width, height, num }: ChartViewProps) {
  const title = data.title;
  const legendPos = model.legend?.position;
  const titleH = title ? 30 : 8;
  const radar = model.plots.length > 0 && model.plots.every((p) => p.type === 'radar');
  const pie = model.plots.every((p) => p.type === 'pie' || p.type === 'doughnut') && model.plots.length > 0;
  const legendItems: { name: string; color: string; line: boolean }[] = pie
    ? data.categories.map((c, i) => ({ name: c, color: data.series[0]?.series.pointColors?.[i] ?? paletteAt(data, i), line: false }))
    : data.series.map((s) => ({ name: s.name, color: s.color, line: s.plot.type === 'line' || s.plot.type === 'scatter' }));
  const legendH = legendPos === 'b' || legendPos === 't' ? 24 : 0;
  const legendW = legendPos === 'r' || legendPos === 'l' || legendPos === 'tr' ? Math.min(140, width * 0.3) : 0;
  const axisText = (pos: 'l' | 'b'): string | undefined => (pie ? undefined : model.axes.find((a) => a.position === pos && a.title?.text)?.title?.text);
  const leftTitle = axisText('l');
  const bottomTitle = axisText('b');
  const titleSpace = 18;
  const plot = {
    x: 12 + (legendPos === 'l' ? legendW : 0) + (leftTitle ? titleSpace : 0),
    y: titleH + (legendPos === 't' ? legendH : 0) + 6,
    w: width - 24 - legendW - (leftTitle ? titleSpace : 0),
    h: height - titleH - legendH - 18 - (bottomTitle ? titleSpace : 0),
  };
  return (
    <svg className="xl-chart-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title ?? undefined} fontFamily={FONT}>
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill="#FFFFFF" stroke="#D9D9D9" />
      {title && <text data-chart-text="title" x={width / 2} y={22} textAnchor="middle" fontSize={14} fill={TEXT}>{title}</text>}
      {leftTitle && <text data-chart-text="left" transform={`rotate(-90 ${12 + (legendPos === 'l' ? legendW : 0) + 6} ${plot.y + plot.h / 2})`} x={12 + (legendPos === 'l' ? legendW : 0) + 6} y={plot.y + plot.h / 2} textAnchor="middle" fontSize={11} fontWeight={600} fill={TEXT}>{leftTitle}</text>}
      {bottomTitle && <text data-chart-text="bottom" x={plot.x + plot.w / 2} y={plot.y + plot.h + 14} textAnchor="middle" fontSize={11} fontWeight={600} fill={TEXT}>{bottomTitle}</text>}
      {radar ? <Radar data={data} model={model} box={plot} num={num} /> : pie ? <Pies data={data} model={model} box={plot} num={num} /> : <Cartesian data={data} model={model} box={plot} num={num} />}
      {legendPos && legendItems.length > 0 && <Legend items={legendItems} pos={legendPos} width={width} height={height} legendW={legendW} titleH={titleH} />}
    </svg>
  );
}

function paletteAt(data: ResolvedChart, i: number): string {
  const colors = ['156082', 'E97132', '196B24', '0F9ED5', 'A02B93', '4EA72E', '467886', 'F4A6B5'];
  return data.series[i]?.color ?? colors[i % colors.length] ?? '156082';
}

function Legend({ items, pos, width, height, legendW, titleH }: { items: { name: string; color: string; line: boolean }[]; pos: string; width: number; height: number; legendW: number; titleH: number }) {
  const horizontal = pos === 'b' || pos === 't';
  const out: ReactNode[] = [];
  if (horizontal) {
    const widths = items.map((it) => 18 + it.name.length * 6.2 + 12);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = Math.max(8, (width - total) / 2);
    const y = pos === 'b' ? height - 14 : titleH + 10;
    items.forEach((it, i) => {
      out.push(<Swatch key={`s${i}`} x={x} y={y - 5} color={it.color} line={it.line} />);
      out.push(<text key={`t${i}`} x={x + 14} y={y + 4} fontSize={11} fill={TEXT}>{it.name}</text>);
      x += widths[i] ?? 0;
    });
  } else {
    const x = pos === 'l' ? 10 : width - legendW + 4;
    let y = Math.max(titleH + 10, height / 2 - (items.length * 18) / 2);
    items.forEach((it, i) => {
      out.push(<Swatch key={`s${i}`} x={x} y={y - 5} color={it.color} line={it.line} />);
      out.push(<text key={`t${i}`} x={x + 14} y={y + 4} fontSize={11} fill={TEXT}>{it.name}</text>);
      y += 18;
    });
  }
  return <g>{out}</g>;
}

function Swatch({ x, y, color, line }: { x: number; y: number; color: string; line: boolean }) {
  return line ? <line x1={x - 2} x2={x + 10} y1={y + 4} y2={y + 4} stroke={`#${color}`} strokeWidth={2.5} /> : <rect x={x} y={y} width={9} height={9} fill={`#${color}`} />;
}

interface Box { x: number; y: number; w: number; h: number }

/** Radar : un axe par categorie, anneaux de graduation, un polygone par serie. */
function Radar({ data, model, box, num }: { data: ResolvedChart; model: ChartModel; box: Box; num: (v: number) => string }) {
  const filled = model.plots[0]?.radarStyle === 'filled';
  const n = Math.max(3, data.categories.length);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = Math.max(20, Math.min(box.w, box.h) / 2 - 22);
  const all = data.series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const scale = niceScale(0, Math.max(1, ...all));
  const at = (i: number, value: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const k = (value - scale.min) / (scale.max - scale.min || 1);
    return [cx + r * k * Math.cos(a), cy + r * k * Math.sin(a)];
  };
  const out: ReactNode[] = [];
  for (let v = scale.min + scale.step; v <= scale.max + scale.step / 2; v += scale.step) {
    out.push(<polygon key={`g${v}`} points={Array.from({ length: n }, (_, i) => at(i, v).join(',')).join(' ')} fill="none" stroke="#D9D9D9" />);
    out.push(<text key={`t${v}`} x={cx + 3} y={at(0, v)[1] - 2} fontSize={9} fill={TEXT}>{num(Number(v.toPrecision(12)))}</text>);
  }
  data.categories.forEach((c, i) => {
    const [x, y] = at(i, scale.max);
    out.push(<line key={`a${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="#D9D9D9" />);
    const [lx, ly] = at(i, scale.max * 1.12);
    out.push(<text key={`c${i}`} x={lx} y={ly + 3} textAnchor={Math.abs(lx - cx) < 4 ? 'middle' : lx > cx ? 'start' : 'end'} fontSize={10} fill={TEXT}>{c.length > 12 ? `${c.slice(0, 11)}…` : c}</text>);
  });
  data.series.forEach((s, k) => {
    const pts = Array.from({ length: n }, (_, i) => at(i, s.values[i] ?? 0));
    out.push(<polygon key={`s${k}`} points={pts.map((p) => p.join(',')).join(' ')} fill={filled ? `#${s.color}` : 'none'} fillOpacity={filled ? 0.35 : undefined} stroke={`#${s.color}`} strokeWidth={2.25} strokeLinejoin="round" />);
    if (!filled) pts.forEach((p, i) => out.push(<circle key={`m${k}-${i}`} cx={p[0]} cy={p[1]} r={3.5} fill={`#${s.color}`} stroke="#FFFFFF" strokeWidth={1} />));
  });
  return <g>{out}</g>;
}

function Pies({ data, model, box, num }: { data: ResolvedChart; model: ChartModel; box: Box; num: (v: number) => string }) {
  const plot = model.plots[0];
  const doughnut = plot?.type === 'doughnut';
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = Math.max(10, Math.min(box.w, box.h) / 2 - 6);
  const rings = doughnut ? data.series : data.series.slice(0, 1);
  const hole = doughnut ? ((plot?.holeSize ?? 50) / 100) * r : 0;
  const ringW = (r - hole) / Math.max(1, rings.length);
  const labels = model.plots[0]?.dataLabels ?? rings[0]?.series.dataLabels;
  const out: ReactNode[] = [];
  rings.forEach((s, ri) => {
    const vals = s.values.map((v) => (v !== null && v > 0 ? v : 0));
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    let a0 = (((plot?.firstSliceAngle ?? 0) - 90) * Math.PI) / 180;
    const outer = r - ri * ringW;
    const inner = Math.max(0, outer - ringW);
    vals.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const color = s.series.pointColors?.[i] ?? paletteAt(data, i);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad: number, a: number): string => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
      const d = v >= total - 1e-9
        ? `M${cx - outer},${cy}a${outer},${outer} 0 1,0 ${outer * 2},0a${outer},${outer} 0 1,0 ${-outer * 2},0${inner ? `M${cx - inner},${cy}a${inner},${inner} 0 1,1 ${inner * 2},0a${inner},${inner} 0 1,1 ${-inner * 2},0` : ''}`
        : inner > 0
          ? `M${p(outer, a0)}A${outer},${outer} 0 ${large},1 ${p(outer, a1)}L${p(inner, a1)}A${inner},${inner} 0 ${large},0 ${p(inner, a0)}Z`
          : `M${cx},${cy}L${p(outer, a0)}A${outer},${outer} 0 ${large},1 ${p(outer, a1)}Z`;
      out.push(<path key={`${ri}-${i}`} d={d} fill={`#${color}`} stroke="#FFFFFF" strokeWidth={1.5} fillRule="evenodd" />);
      if (labels?.showValue || labels?.showPercent) {
        const mid = (a0 + a1) / 2;
        const lr = inner ? (inner + outer) / 2 : outer * 0.65;
        const txt = labels.showPercent ? `${Math.round((v / total) * 100)} %` : num(v);
        if (v > 0) out.push(<text key={labelKey()} x={cx + lr * Math.cos(mid)} y={cy + lr * Math.sin(mid) + 4} textAnchor="middle" fontSize={11} fill="#FFFFFF">{txt}</text>);
      }
      a0 = a1;
    });
  });
  return <g>{out}</g>;
}

/** Graphiques empiles a 100 % : chaque categorie est ramenee a un total de 100. */
function normalized(data: ResolvedChart): ResolvedChart {
  const percent = data.series.filter((s) => s.plot.grouping === 'percentStacked');
  const totals = data.categories.map((_, i) => percent.reduce((t, s) => t + Math.abs(s.values[i] ?? 0), 0));
  // Courbes et aires empilees : chaque serie est cumulee sur les precedentes du meme trace.
  const running = new Map<ChartPlot, (number | null)[]>();
  const series = data.series.map((s) => {
    if (s.plot.grouping === 'percentStacked') return { ...s, values: s.values.map((v, i) => (v === null ? null : (v / (totals[i] || 1)) * 100)) };
    if (s.plot.grouping !== 'stacked' || (s.plot.type !== 'line' && s.plot.type !== 'area')) return s;
    const prev = running.get(s.plot) ?? s.values.map(() => 0);
    const values = s.values.map((v, i) => (v === null ? null : (prev[i] ?? 0) + v));
    running.set(s.plot, values.map((v, i) => v ?? prev[i] ?? 0));
    return { ...s, values, base: prev };
  });
  return { ...data, series };
}

function Cartesian({ data: raw, model, box, num }: { data: ResolvedChart; model: ChartModel; box: Box; num: (v: number) => string }) {
  const data = normalized(raw);
  const horizontal = model.plots.some((p) => p.type === 'bar' && p.barDirection === 'bar');
  const n = data.categories.length;
  // Echelle : valeurs cumulees pour les empilements.
  let lo = Infinity;
  let hi = -Infinity;
  for (const plot of model.plots) {
    const ser = data.series.filter((s) => s.plot === plot);
    if (plot.type === 'bar' && (plot.grouping === 'stacked' || plot.grouping === 'percentStacked')) {
      for (let i = 0; i < n; i++) {
        let pos = 0;
        let neg = 0;
        for (const s of ser) {
          const v = s.values[i] ?? 0;
          if (v >= 0) pos += v;
          else neg += v;
        }
        hi = Math.max(hi, pos);
        lo = Math.min(lo, neg);
      }
    } else for (const s of ser) for (const v of s.values) if (v !== null) {
      hi = Math.max(hi, v);
      lo = Math.min(lo, v);
    }
  }
  if (!Number.isFinite(lo)) {
    lo = 0;
    hi = 1;
  }
  const valAxis = model.axes.find((a) => a.kind === 'value');
  const percent = model.plots.every((p) => p.grouping === 'percentStacked');
  const scale = niceScale(valAxis?.min ?? (percent ? 0 : lo), valAxis?.max ?? (percent ? 100 : hi));
  const labelW = Math.max(28, Math.max(num(scale.max).length, num(scale.min).length) * 6.5 + 8);
  const catLabelH = 18;
  const area = horizontal
    ? { x: box.x + Math.min(120, Math.max(...data.categories.map((c) => c.length), 1) * 6.5 + 8), y: box.y, w: 0, h: box.h - catLabelH }
    : { x: box.x + labelW, y: box.y, w: box.w - labelW, h: box.h - catLabelH };
  if (horizontal) area.w = box.x + box.w - area.x;
  const V = (v: number): number => horizontal
    ? area.x + ((v - scale.min) / (scale.max - scale.min)) * area.w
    : area.y + area.h - ((v - scale.min) / (scale.max - scale.min)) * area.h;
  const out: ReactNode[] = [];
  // Quadrillage et etiquettes de valeurs
  for (let v = scale.min; v <= scale.max + scale.step / 2; v += scale.step) {
    const p = V(v);
    if (horizontal) {
      if (valAxis?.majorGridlines !== false) out.push(<line key={`g${v}`} x1={p} x2={p} y1={area.y} y2={area.y + area.h} stroke="#D9D9D9" />);
      out.push(<text key={`v${v}`} x={p} y={area.y + area.h + 13} textAnchor="middle" fontSize={10} fill={TEXT}>{num(Number(v.toPrecision(12)))}</text>);
    } else {
      if (valAxis?.majorGridlines !== false) out.push(<line key={`g${v}`} x1={area.x} x2={area.x + area.w} y1={p} y2={p} stroke="#D9D9D9" />);
      out.push(<text key={`v${v}`} x={area.x - 6} y={p + 3.5} textAnchor="end" fontSize={10} fill={TEXT}>{num(Number(v.toPrecision(12)))}</text>);
    }
  }
  const scatter = model.plots.some((p) => p.type === 'scatter');
  const slot = (horizontal ? area.h : area.w) / Math.max(1, n);
  const C = (i: number): number => (horizontal ? area.y + slot * (i + 0.5) : area.x + slot * (i + 0.5));
  // Etiquettes de categories
  if (!scatter) {
    const every = Math.max(1, Math.ceil((n * 40) / Math.max(1, horizontal ? area.h * 2 : area.w)));
    data.categories.forEach((c, i) => {
      if (i % every !== 0) return;
      out.push(horizontal
        ? <text key={`c${i}`} x={area.x - 6} y={C(i) + 3.5} textAnchor="end" fontSize={10} fill={TEXT}>{c}</text>
        : <text key={`c${i}`} x={C(i)} y={area.y + area.h + 13} textAnchor="middle" fontSize={10} fill={TEXT}>{c.length > 14 ? `${c.slice(0, 13)}…` : c}</text>);
    });
  }
  const zero = V(Math.max(scale.min, Math.min(scale.max, 0)));
  out.push(horizontal
    ? <line key="axis" x1={zero} x2={zero} y1={area.y} y2={area.y + area.h} stroke="#BFBFBF" />
    : <line key="axis" x1={area.x} x2={area.x + area.w} y1={zero} y2={zero} stroke="#BFBFBF" />);
  for (const plot of model.plots) {
    const ser = data.series.filter((s) => s.plot === plot);
    if (plot.type === 'bar') out.push(...bars(ser, plot.grouping ?? 'clustered', n, slot, C, V, zero, horizontal, plot.gapWidth ?? 150, num));
    else if (plot.type === 'line' || plot.type === 'area' || plot.type === 'radar') out.push(...lines(ser, plot.type === 'area', C, V, zero, num));
    else if (plot.type === 'scatter' || plot.type === 'bubble') out.push(...points(ser, area, V));
    if (!horizontal && (plot.type === 'bar' || plot.type === 'line' || plot.type === 'area')) {
      ser.forEach((s, k) => {
        const fit = s.series.trendlines?.length ? linearFit(s.values) : undefined;
        if (fit && n > 1) out.push(<line key={`t${plot.axisIds.join('-')}-${k}`} x1={C(0)} x2={C(n - 1)} y1={V(fit.intercept)} y2={V(fit.intercept + fit.slope * (n - 1))} stroke={`#${s.color}`} strokeWidth={1.75} strokeDasharray="6 4" />);
      });
    }
  }
  return <g>{out}</g>;
}

function bars(ser: ResolvedSeries[], grouping: string, n: number, slot: number, C: (i: number) => number, V: (v: number) => number, zero: number, horizontal: boolean, gap: number, num: (v: number) => string): ReactNode[] {
  const out: ReactNode[] = [];
  const stacked = grouping === 'stacked' || grouping === 'percentStacked';
  // Largeur d'intervalle d'Excel : pourcentage de la largeur d'une barre.
  const n0 = stacked ? 1 : Math.max(1, ser.length);
  const barW = slot / (n0 + gap / 100);
  const groupW = barW * n0;
  for (let i = 0; i < n; i++) {
    let pos = 0;
    let neg = 0;
    ser.forEach((s, k) => {
      const v = s.values[i];
      if (v === null || v === undefined) return;
      const base = stacked ? (v >= 0 ? pos : neg) : 0;
      const top = base + v;
      if (stacked) {
        if (v >= 0) pos = top;
        else neg = top;
      }
      const a = V(base === 0 ? 0 : base);
      const b = V(top);
      const offset = C(i) - groupW / 2 + (stacked ? 0 : k * barW);
      const color = `#${s.series.pointColors?.[i] ?? s.color}`;
      const lo = Math.min(a, stacked ? a : zero, b);
      const len = Math.abs(b - (stacked ? a : zero));
      out.push(horizontal
        ? <rect key={`${k}-${i}`} x={Math.min(stacked ? a : zero, b)} y={offset} width={len} height={Math.max(1, barW - 1)} fill={color} />
        : <rect key={`${k}-${i}`} x={offset} y={lo} width={Math.max(1, barW - 1)} height={len} fill={color} />);
      if (s.series.dataLabels?.showValue || s.plot.dataLabels?.showValue) {
        const pos = s.series.dataLabels?.position ?? s.plot.dataLabels?.position;
        const base0 = stacked ? a : zero;
        const inside = pos === 'ctr' || pos === 'inEnd';
        const along = pos === 'ctr' ? (base0 + b) / 2 : pos === 'inEnd' ? b + (b >= base0 ? -4 : 4) : b + (b >= base0 ? 4 : -4);
        const anchor = pos === 'ctr' ? 'middle' : (b >= base0) === inside ? 'end' : 'start';
        out.push(horizontal
          ? <text key={labelKey()} x={along} y={offset + barW / 2 + 3.5} textAnchor={anchor} fontSize={10} fill={inside ? '#FFFFFF' : TEXT}>{num(v)}</text>
          : <text key={labelKey()} x={offset + barW / 2} y={pos === 'ctr' ? (base0 + b) / 2 + 3.5 : inside ? b + (b <= base0 ? 13 : -4) : b - 4} textAnchor="middle" fontSize={10} fill={inside ? '#FFFFFF' : TEXT}>{num(v)}</text>);
      }
    });
  }
  return out;
}

/** Trace lisse (Catmull-Rom converti en courbes de Bezier) passant par les points. */
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function lines(ser: ResolvedSeries[], area: boolean, C: (i: number) => number, V: (v: number) => number, zero: number, num: (v: number) => string): ReactNode[] {
  const out: ReactNode[] = [];
  ser.forEach((s, k) => {
    const pts = s.values.map((v, i) => (v === null ? null : [C(i), V(v)] as const));
    const color = `#${s.color}`;
    const segs: string[] = [];
    let cur = '';
    pts.forEach((p) => {
      if (!p) {
        if (cur) segs.push(cur);
        cur = '';
        return;
      }
      cur += `${cur ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    });
    if (cur) segs.push(cur);
    if (area) {
      const valid = pts.filter((p): p is readonly [number, number] => p !== null);
      const first = valid[0];
      const last = valid[valid.length - 1];
      if (first && last) {
        const back = s.base ? s.base.map((b, i) => `L${C(i).toFixed(1)},${V(b ?? 0).toFixed(1)}`).reverse().join('') : `L${last[0]},${zero}L${first[0]},${zero}`;
        out.push(<path key={`a${k}`} d={`${segs.join('')}${back}Z`} fill={lighten(s.color, 0.15)} fillOpacity={0.85} stroke={color} strokeWidth={1} />);
      }
    } else out.push(<path key={`p${k}`} d={s.series.smooth && !pts.includes(null) ? smoothPath(pts as readonly (readonly [number, number])[]) : segs.join('')} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />);
    const marker = s.series.marker && s.series.marker.symbol !== 'none';
    if (marker) pts.forEach((p, i) => p && out.push(<circle key={`m${k}-${i}`} cx={p[0]} cy={p[1]} r={3.5} fill={color} stroke="#FFFFFF" strokeWidth={1} />));
    if (s.series.dataLabels?.showValue || s.plot.dataLabels?.showValue) {
      pts.forEach((p, i) => p && out.push(<text key={labelKey()} x={p[0]} y={p[1] - 7} textAnchor="middle" fontSize={10} fill={TEXT}>{num(s.values[i] ?? 0)}</text>));
    }
  });
  return out;
}

function points(ser: ResolvedSeries[], area: Box, V: (v: number) => number): ReactNode[] {
  const out: ReactNode[] = [];
  // X non numeriques (categories texte) : Excel utilise 1, 2, 3...
  const xOf = (s: ResolvedSeries, i: number): number | null | undefined => (s.x.some((v) => v !== null) ? s.x[i] : i + 1);
  const xs = ser.flatMap((s) => s.values.map((_, i) => xOf(s, i))).filter((x): x is number => x !== null);
  const xmin = Math.min(0, ...xs);
  const xmax = Math.max(1, ...xs);
  const X = (x: number): number => area.x + ((x - xmin) / (xmax - xmin || 1)) * area.w;
  ser.forEach((s, k) => {
    if (s.plot.type === 'scatter' && s.series.line && !s.series.line.none) {
      const pts = s.values.map((v, i) => ({ x: xOf(s, i), v })).filter((p): p is { x: number; v: number } => p.x !== null && p.x !== undefined && p.v !== null).sort((a, b) => a.x - b.x);
      if (pts.length > 1) out.push(<path key={`l${k}`} d={pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${V(p.v).toFixed(1)}`).join('')} fill="none" stroke={`#${s.color}`} strokeWidth={2} strokeLinejoin="round" />);
    }
    s.values.forEach((v, i) => {
      const x = xOf(s, i);
      if (v === null || x === null || x === undefined) return;
      out.push(<circle key={`${k}-${i}`} cx={X(x)} cy={V(v)} r={4} fill={`#${s.color}`} />);
    });
  });
  return out;
}
