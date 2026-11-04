// Rendu SVG d'un graphique (ChartModel) : histogrammes et barres (groupes, empiles), courbes, aires,
// secteurs, anneau, nuages de points et graphiques combines ; titre, legende, axes, quadrillage, etiquettes.
import type { ReactNode } from 'react';
import type { ChartModel } from '@forgeoffice/xlsx';
import { niceScale, type ResolvedChart, type ResolvedSeries } from '../logic/charts.ts';

export interface ChartViewProps {
  model: ChartModel;
  data: ResolvedChart;
  width: number;
  height: number;
  /** Nombre -> texte francais. */
  num: (v: number) => string;
}

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
  const pie = model.plots.every((p) => p.type === 'pie' || p.type === 'doughnut') && model.plots.length > 0;
  const legendItems: { name: string; color: string; line: boolean }[] = pie
    ? data.categories.map((c, i) => ({ name: c, color: data.series[0]?.series.pointColors?.[i] ?? paletteAt(data, i), line: false }))
    : data.series.map((s) => ({ name: s.name, color: s.color, line: s.plot.type === 'line' || s.plot.type === 'scatter' }));
  const legendH = legendPos === 'b' || legendPos === 't' ? 24 : 0;
  const legendW = legendPos === 'r' || legendPos === 'l' || legendPos === 'tr' ? Math.min(140, width * 0.3) : 0;
  const plot = {
    x: 12 + (legendPos === 'l' ? legendW : 0),
    y: titleH + (legendPos === 't' ? legendH : 0) + 6,
    w: width - 24 - legendW,
    h: height - titleH - legendH - 18,
  };
  return (
    <svg className="xl-chart-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title ?? undefined} fontFamily={FONT}>
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill="#FFFFFF" stroke="#D9D9D9" />
      {title && <text x={width / 2} y={22} textAnchor="middle" fontSize={14} fill={TEXT}>{title}</text>}
      {pie ? <Pies data={data} model={model} box={plot} num={num} /> : <Cartesian data={data} model={model} box={plot} num={num} />}
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
        if (v > 0) out.push(<text key={`l${ri}-${i}`} x={cx + lr * Math.cos(mid)} y={cy + lr * Math.sin(mid) + 4} textAnchor="middle" fontSize={11} fill="#FFFFFF">{txt}</text>);
      }
      a0 = a1;
    });
  });
  return <g>{out}</g>;
}

function Cartesian({ data, model, box, num }: { data: ResolvedChart; model: ChartModel; box: Box; num: (v: number) => string }) {
  const horizontal = model.plots.some((p) => p.type === 'bar' && p.barDirection === 'bar');
  const n = data.categories.length;
  // Echelle : valeurs cumulees pour les empilements.
  let lo = Infinity;
  let hi = -Infinity;
  for (const plot of model.plots) {
    const ser = data.series.filter((s) => s.plot === plot);
    if (plot.grouping === 'stacked' || plot.grouping === 'percentStacked') {
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
  const scale = niceScale(valAxis?.min ?? lo, valAxis?.max ?? hi);
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
        out.push(horizontal
          ? <text key={`l${k}-${i}`} x={b + 4} y={offset + barW / 2 + 3.5} fontSize={10} fill={TEXT}>{num(v)}</text>
          : <text key={`l${k}-${i}`} x={offset + barW / 2} y={b - 4} textAnchor="middle" fontSize={10} fill={TEXT}>{num(v)}</text>);
      }
    });
  }
  return out;
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
      if (first && last) out.push(<path key={`a${k}`} d={`${segs.join('')}L${last[0]},${zero}L${first[0]},${zero}Z`} fill={lighten(s.color, 0.15)} fillOpacity={0.85} stroke={color} strokeWidth={1} />);
    } else out.push(<path key={`p${k}`} d={segs.join('')} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />);
    const marker = s.series.marker && s.series.marker.symbol !== 'none';
    if (marker) pts.forEach((p, i) => p && out.push(<circle key={`m${k}-${i}`} cx={p[0]} cy={p[1]} r={3.5} fill={color} stroke="#FFFFFF" strokeWidth={1} />));
    if (s.series.dataLabels?.showValue || s.plot.dataLabels?.showValue) {
      pts.forEach((p, i) => p && out.push(<text key={`l${k}-${i}`} x={p[0]} y={p[1] - 7} textAnchor="middle" fontSize={10} fill={TEXT}>{num(s.values[i] ?? 0)}</text>));
    }
  });
  return out;
}

function points(ser: ResolvedSeries[], area: Box, V: (v: number) => number): ReactNode[] {
  const out: ReactNode[] = [];
  const xs = ser.flatMap((s) => (s.x.length ? s.x : s.values.map((_, i) => i + 1))).filter((x): x is number => x !== null);
  const xmin = Math.min(0, ...xs);
  const xmax = Math.max(1, ...xs);
  const X = (x: number): number => area.x + ((x - xmin) / (xmax - xmin || 1)) * area.w;
  ser.forEach((s, k) => {
    s.values.forEach((v, i) => {
      const x = s.x.length ? s.x[i] : i + 1;
      if (v === null || x === null || x === undefined) return;
      out.push(<circle key={`${k}-${i}`} cx={X(x)} cy={V(v)} r={4} fill={`#${s.color}`} />);
    });
  });
  return out;
}
