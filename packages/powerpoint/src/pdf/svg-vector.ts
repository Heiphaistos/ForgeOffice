// Graphiques en PDF vectoriel : l'arbre SVG neutre du rendu (rect, path, circle, text, degrades) est reecrit en operateurs PDF.
import type { ChartModel } from '@forgeoffice/pptx';
import { fontFamily, type PageContext } from '../canvas/context.ts';
import { renderChart, type SvgNode } from '../canvas/chart/index.ts';
import { css } from '../canvas/context.ts';
import { familyOf } from './fonts.ts';
import { hexToRgb } from './style.ts';
import type { Rgb, Seg, SegStyle } from './text-layout.ts';
import type { GradientStop, PageWriter } from './writer.ts';

interface Gradient {
  kind: 'axial' | 'radial';
  attrs: Record<string, string | number>;
  stops: GradientStop[];
}

interface Paint {
  rgb: Rgb;
  alpha: number;
}

function parseColor(value: string | number | undefined): Paint | null {
  if (typeof value !== 'string' || value === 'none') return null;
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return { rgb: hexToRgb(hex[1] as string), alpha: 1 };
  const short = value.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) return { rgb: hexToRgb(`${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`), alpha: 1 };
  const fn = value.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const [r = 0, g = 0, b = 0, a = 1] = (fn[1] as string).split(',').map((s) => Number(s.trim()));
    return { rgb: [r / 255, g / 255, b / 255], alpha: a };
  }
  return null;
}

const num = (v: string | number | undefined, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function arcToCurves(x0: number, y0: number, rx: number, ry: number, rot: number, large: number, sweep: number, x: number, y: number): string[] {
  if (rx === 0 || ry === 0) return [`L ${x} ${y}`];
  const phi = (rot * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const sign = large === sweep ? -1 : 1;
  const num2 = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const coef = sign * Math.sqrt(Math.max(0, num2 / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
  const cx1 = (coef * rx * y1) / ry;
  const cy1 = (-coef * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (x0 + x) / 2;
  const cy = sin * cx1 + cos * cy1 + (y0 + y) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number): number => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = t1 + step * i;
    const b = a + step;
    const p = (ang2: number, r: number): [number, number] => {
      const ex = rx * Math.cos(ang2);
      const ey = ry * Math.sin(ang2);
      return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy];
    };
    const d = (ang2: number): [number, number] => {
      const ex = -rx * Math.sin(ang2);
      const ey = ry * Math.cos(ang2);
      return [cos * ex - sin * ey, sin * ex + cos * ey];
    };
    const [ax, ay] = p(a, 0);
    const [bx, by] = p(b, 0);
    const [dax, day] = d(a);
    const [dbx, dby] = d(b);
    out.push(`C ${ax + k * dax} ${ay + k * day} ${bx - k * dbx} ${by - k * dby} ${bx} ${by}`);
  }
  return out;
}

/** Donnees de chemin SVG (absolues ou relatives, arcs compris) vers le format « M L C Z » du redacteur. */
export function normalizeSvgPath(d: string): string {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const out: string[] = [];
  let i = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const n = (): number => Number(tokens[i++] ?? 0);
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i] as string)) cmd = tokens[i++] as string;
    const rel = cmd === cmd.toLowerCase() && cmd.toLowerCase() !== 'z';
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    switch (cmd.toUpperCase()) {
      case 'M':
        cx = sx = n() + ox;
        cy = sy = n() + oy;
        out.push(`M ${cx} ${cy}`);
        cmd = rel ? 'l' : 'L';
        break;
      case 'L':
        cx = n() + ox;
        cy = n() + oy;
        out.push(`L ${cx} ${cy}`);
        break;
      case 'H':
        cx = n() + ox;
        out.push(`L ${cx} ${cy}`);
        break;
      case 'V':
        cy = n() + oy;
        out.push(`L ${cx} ${cy}`);
        break;
      case 'C': {
        const [a, b, c, e, f, g] = [n() + ox, n() + oy, n() + ox, n() + oy, n() + ox, n() + oy] as [number, number, number, number, number, number];
        out.push(`C ${a} ${b} ${c} ${e} ${f} ${g}`);
        cx = f;
        cy = g;
        break;
      }
      case 'Q': {
        const [a, b, c, e] = [n() + ox, n() + oy, n() + ox, n() + oy] as [number, number, number, number];
        out.push(`Q ${a} ${b} ${c} ${e}`);
        cx = c;
        cy = e;
        break;
      }
      case 'A': {
        const [rx, ry, rot, large, sweep] = [n(), n(), n(), n(), n()] as [number, number, number, number, number];
        const x = n() + ox;
        const y = n() + oy;
        out.push(...arcToCurves(cx, cy, rx, ry, rot, large, sweep, x, y));
        cx = x;
        cy = y;
        break;
      }
      case 'Z':
        out.push('Z');
        cx = sx;
        cy = sy;
        break;
      default:
        i++;
    }
  }
  return out.join(' ');
}

const circlePath = (cx: number, cy: number, rx: number, ry: number): string => {
  const k = 0.5522847498;
  return `M ${cx + rx} ${cy} C ${cx + rx} ${cy + k * ry} ${cx + k * rx} ${cy + ry} ${cx} ${cy + ry} C ${cx - k * rx} ${cy + ry} ${cx - rx} ${cy + k * ry} ${cx - rx} ${cy} C ${cx - rx} ${cy - k * ry} ${cx - k * rx} ${cy - ry} ${cx} ${cy - ry} C ${cx + k * rx} ${cy - ry} ${cx + rx} ${cy - k * ry} ${cx + rx} ${cy} Z`;
};

interface State {
  w: PageWriter;
  gradients: Map<string, Gradient>;
  screen?: (text: string, css: string) => number;
  fontCss: string;
}

function collectGradients(node: SvgNode, out: Map<string, Gradient>): void {
  if (node.tag === 'linearGradient' || node.tag === 'radialGradient') {
    const stops: GradientStop[] = [];
    for (const c of node.children) {
      if (typeof c === 'string' || c.tag !== 'stop') continue;
      const p = parseColor(c.attrs['stop-color']);
      const off = String(c.attrs.offset ?? '0');
      if (p) stops.push({ position: off.endsWith('%') ? Number(off.slice(0, -1)) / 100 : Number(off), color: p.rgb });
    }
    out.set(String(node.attrs.id), { kind: node.tag === 'linearGradient' ? 'axial' : 'radial', attrs: node.attrs, stops });
  }
  for (const c of node.children) if (typeof c !== 'string') collectGradients(c, out);
}

function paintShape(st: State, node: SvgNode, d: string, bbox: { x: number; y: number; w: number; h: number }): void {
  const { w } = st;
  const fillAttr = node.attrs.fill;
  const opacity = num(node.attrs.opacity, 1);
  if (typeof fillAttr === 'string' && fillAttr.startsWith('url(#')) {
    const g = st.gradients.get(fillAttr.slice(5, -1));
    if (g && g.stops.length) {
      w.save();
      w.path(d);
      w.clipPath();
      const a = g.attrs;
      if (g.kind === 'axial') w.shade('axial', [bbox.x + num(a.x1) * bbox.w, bbox.y + num(a.y1) * bbox.h, bbox.x + num(a.x2, 1) * bbox.w, bbox.y + num(a.y2) * bbox.h], g.stops);
      else w.shade('radial', [bbox.x + num(a.cx, 0.5) * bbox.w, bbox.y + num(a.cy, 0.5) * bbox.h, 0, bbox.x + num(a.fx ?? a.cx, 0.5) * bbox.w, bbox.y + num(a.fy ?? a.cy, 0.5) * bbox.h, num(a.r, 0.5) * Math.max(bbox.w, bbox.h)], g.stops);
      w.restore();
    }
  } else {
    const f = fillAttr === undefined ? { rgb: [0, 0, 0] as Rgb, alpha: 1 } : parseColor(fillAttr);
    if (f) {
      w.save();
      w.alpha(f.alpha * opacity);
      w.fillColor(f.rgb);
      w.path(d);
      w.fillPath();
      w.restore();
    }
  }
  const s = parseColor(node.attrs.stroke);
  if (s) {
    const dash = typeof node.attrs['stroke-dasharray'] === 'string' ? String(node.attrs['stroke-dasharray']).split(/[\s,]+/).map(Number).filter((v) => Number.isFinite(v)) : undefined;
    const cap = node.attrs['stroke-linecap'];
    const join = node.attrs['stroke-linejoin'];
    w.save();
    w.alpha(s.alpha * opacity);
    w.path(d);
    w.strokePath(num(node.attrs['stroke-width'], 1), s.rgb, dash, cap === 'round' ? 'round' : cap === 'square' ? 'square' : 'butt', join === 'bevel' ? 'bevel' : join === 'miter' ? 'miter' : 'round');
    w.restore();
  }
}

function paintText(st: State, node: SvgNode): void {
  const text = node.children.filter((c): c is string => typeof c === 'string').join('');
  if (!text) return;
  const size = num(node.attrs['font-size'], 10);
  const bold = node.attrs['font-weight'] === 'bold';
  const italic = node.attrs['font-style'] === 'italic';
  const fill = parseColor(node.attrs.fill) ?? { rgb: [0, 0, 0] as Rgb, alpha: 1 };
  const family = String(node.attrs['font-family'] ?? st.fontCss);
  const style: SegStyle = { font: { family: familyOf(family), bold, italic }, size, color: fill.rgb, alpha: fill.alpha, underline: false, strike: false, rise: 0, spacing: 0, css: `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${size}px ${family}` };
  const natural = st.w.book.width(text, style.font, size);
  const width = st.screen ? st.screen(text, style.css) : natural;
  const anchor = node.attrs['text-anchor'];
  const x = num(node.attrs.x) - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
  const seg: Seg = { text, style, x, width, natural, wordSpace: 0 };
  const rot = String(node.attrs.transform ?? '').match(/rotate\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\)/);
  st.w.save();
  if (rot) {
    const a = (Number(rot[1]) * Math.PI) / 180;
    const [px, py] = [Number(rot[2]), Number(rot[3])];
    st.w.cm(1, 0, 0, 1, px, py);
    st.w.cm(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0);
    st.w.cm(1, 0, 0, 1, -px, -py);
  }
  st.w.text(seg, num(node.attrs.y));
  st.w.restore();
}

function walk(st: State, node: SvgNode): void {
  switch (node.tag) {
    case 'rect': {
      const [x, y, rw, rh] = [num(node.attrs.x), num(node.attrs.y), num(node.attrs.width), num(node.attrs.height)];
      const r = Math.min(num(node.attrs.rx), rw / 2, rh / 2);
      const d = r > 0 ? `M ${x + r} ${y} L ${x + rw - r} ${y} Q ${x + rw} ${y} ${x + rw} ${y + r} L ${x + rw} ${y + rh - r} Q ${x + rw} ${y + rh} ${x + rw - r} ${y + rh} L ${x + r} ${y + rh} Q ${x} ${y + rh} ${x} ${y + rh - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z` : `M ${x} ${y} L ${x + rw} ${y} L ${x + rw} ${y + rh} L ${x} ${y + rh} Z`;
      paintShape(st, node, d, { x, y, w: rw, h: rh });
      return;
    }
    case 'circle': {
      const [cx, cy, r] = [num(node.attrs.cx), num(node.attrs.cy), num(node.attrs.r)];
      paintShape(st, node, circlePath(cx, cy, r, r), { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r });
      return;
    }
    case 'path': {
      const d = normalizeSvgPath(String(node.attrs.d ?? ''));
      const nums = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []).map(Number);
      const xs = nums.filter((_, i) => i % 2 === 0);
      const ys = nums.filter((_, i) => i % 2 === 1);
      const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
      paintShape(st, node, d, { x: x0, y: y0, w: Math.max(...xs) - x0 || 1, h: Math.max(...ys) - y0 || 1 });
      return;
    }
    case 'text':
      paintText(st, node);
      return;
    case 'svg':
    case 'g':
      for (const c of node.children) if (typeof c !== 'string') walk(st, c);
      return;
    default:
  }
}

/** Ecrit un graphique en vecteur dans le repere courant (0,0 = coin de la forme). */
export function chartToVector(w: PageWriter, chart: ChartModel, width: number, height: number, ctx: PageContext, screen?: (text: string, css: string) => number): boolean {
  const tree = renderChart(chart, width, height, { color: (c) => css(ctx, c) ?? '#000000', fontFamily: fontFamily(ctx, undefined) });
  const gradients = new Map<string, Gradient>();
  collectGradients(tree, gradients);
  walk({ w, gradients, screen, fontCss: fontFamily(ctx, undefined) }, tree);
  return true;
}
