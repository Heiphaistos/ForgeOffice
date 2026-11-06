// Remplissages, contours, extremites de ligne et images du PDF vectoriel.
import type { PDFDocument, PDFImage } from '@cantoo/pdf-lib';
import type { Fill, Line, LineEnd, MediaItem } from '@forgeoffice/pptx';
import type { PageContext } from '../canvas/context.ts';
import type { GeometryPathOut } from '../canvas/geometry/index.ts';
import { DASHES } from '../canvas/render/dashes.ts';
import { mix, paintOf } from './style.ts';
import type { PageWriter } from './writer.ts';

const images = new WeakMap<Uint8Array, PDFImage | null>();

const isPng = (item: MediaItem): boolean => item.contentType === 'image/png' || item.extension === 'png';
const isJpeg = (item: MediaItem): boolean => /^image\/jpe?g$/.test(item.contentType) || item.extension === 'jpg' || item.extension === 'jpeg';

/** Image PNG ou JPEG incorporee (une seule fois par document) ; null pour les autres formats. */
export async function embedImage(pdf: PDFDocument, item: MediaItem | undefined): Promise<PDFImage | null> {
  if (!item) return null;
  const key = item.bytes;
  const known = images.get(key);
  if (known && known.doc === pdf) return known;
  let img: PDFImage | null = null;
  try {
    if (isPng(item)) img = await pdf.embedPng(item.bytes);
    else if (isJpeg(item)) img = await pdf.embedJpg(item.bytes);
  } catch {
    img = null;
  }
  if (img) images.set(key, img);
  return img;
}

/** Peint les chemins (couleur unie, degrade, image, motif). Coordonnees locales de la forme (bw x bh). */
export async function paintFill(w: PageWriter, fill: Fill | undefined, ctx: PageContext, paths: readonly string[], bw: number, bh: number, groupFill?: Fill): Promise<void> {
  if (!fill || fill.type === 'none' || paths.length === 0) return;
  if (fill.type === 'group') {
    if (groupFill && groupFill.type !== 'group') await paintFill(w, groupFill, ctx, paths, bw, bh);
    return;
  }
  if (fill.type === 'solid') {
    const c = paintOf(fill.color, ctx);
    if (!c) return;
    w.save();
    w.alpha(c.alpha);
    w.fillColor(c.rgb);
    for (const d of paths) {
      w.path(d);
      w.fillPath();
    }
    w.restore();
    return;
  }
  if (fill.type === 'pattern') {
    const fg = paintOf(fill.foreground, ctx);
    const bg = paintOf(fill.background, ctx);
    if (!fg || !bg) return;
    w.save();
    w.fillColor(mix(bg.rgb, fg.rgb, 0.3));
    for (const d of paths) {
      w.path(d);
      w.fillPath();
    }
    w.restore();
    return;
  }
  if (fill.type === 'gradient') {
    const stops = fill.stops.map((s) => ({ position: s.position / 100, color: paintOf(s.color, ctx)?.rgb ?? ([0, 0, 0] as [number, number, number]) }));
    for (const d of paths) {
      w.save();
      w.path(d);
      w.clipPath();
      if (fill.kind === 'linear') {
        const a = ((fill.angle ?? 0) * Math.PI) / 180;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        const len = Math.abs(bw * dx) + Math.abs(bh * dy);
        const cx = bw / 2;
        const cy = bh / 2;
        w.shade('axial', [cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2], stops);
      } else {
        const f = fill.focus ?? { left: 50, top: 50, right: 50, bottom: 50 };
        const cx = ((f.left + (100 - f.right)) / 200) * bw;
        const cy = ((f.top + (100 - f.bottom)) / 200) * bh;
        w.shade('radial', [cx, cy, 0, cx, cy, Math.max(bw, bh) * (fill.kind === 'circle' ? 0.71 : 0.75)], stops);
      }
      w.restore();
    }
    return;
  }
  // Image de remplissage (etiree).
  const img = await embedImage(w.pdf, ctx.media(fill.mediaId));
  if (!img) return;
  for (const d of paths) {
    w.save();
    w.path(d);
    w.clipPath();
    if (fill.alpha !== undefined) w.alpha(fill.alpha / 100);
    w.image(img, 0, 0, bw, bh);
    w.restore();
  }
}

export interface PdfStroke {
  width: number;
  color: [number, number, number];
  alpha: number;
  dash?: number[];
  cap: 'butt' | 'round' | 'square';
  join: 'round' | 'bevel' | 'miter';
}

export function strokeOf(line: Line | undefined, ctx: PageContext): PdfStroke | null {
  if (!line?.fill || line.fill.type === 'none') return null;
  const colorOf = line.fill.type === 'solid' ? line.fill.color : line.fill.type === 'gradient' ? line.fill.stops[0]?.color : undefined;
  const c = paintOf(colorOf, ctx);
  if (!c) return null;
  const width = line.width ?? 0.75;
  const pattern = line.customDash?.flatMap((d) => [d.dash / 100, d.space / 100]) ?? (line.dash ? DASHES[line.dash] : undefined);
  return {
    width,
    color: c.rgb,
    alpha: c.alpha,
    dash: pattern?.map((v) => Math.max(0.1, v * width)),
    cap: line.cap === 'rnd' ? 'round' : line.cap === 'sq' ? 'square' : 'butt',
    join: line.join ?? 'round',
  };
}

export function paintStroke(w: PageWriter, st: PdfStroke, paths: readonly string[]): void {
  w.save();
  w.alpha(st.alpha);
  for (const d of paths) {
    w.path(d);
    w.strokePath(st.width, st.color, st.dash, st.cap, st.join);
  }
  w.restore();
}

interface Tip {
  x: number;
  y: number;
  /** Direction unitaire sortante. */
  ux: number;
  uy: number;
}

/** Extremites d'un chemin « M L C Q » : position et direction sortante au debut et a la fin. */
function tips(d: string): { start: Tip; end: Tip } | null {
  const nums = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i] as number, nums[i + 1] as number]);
  if (pts.length < 2) return null;
  const dir = (from: [number, number], to: [number, number]): [number, number] => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    return [dx / len, dy / len];
  };
  const p0 = pts[0] as [number, number];
  const p1 = pts.find((p) => Math.hypot(p[0] - p0[0], p[1] - p0[1]) > 0.01) ?? (pts[1] as [number, number]);
  const pn = pts[pts.length - 1] as [number, number];
  const pm = [...pts].reverse().find((p) => Math.hypot(p[0] - pn[0], p[1] - pn[1]) > 0.01) ?? (pts[pts.length - 2] as [number, number]);
  const [sx, sy] = dir(p1, p0);
  const [ex, ey] = dir(pm, pn);
  return { start: { x: p0[0], y: p0[1], ux: sx, uy: sy }, end: { x: pn[0], y: pn[1], ux: ex, uy: ey } };
}

const END_SIZE: Readonly<Record<string, number>> = { sm: 2, med: 3, lg: 5 };

function head(w: PageWriter, end: LineEnd, tip: Tip, st: PdfStroke): void {
  const scale = Math.max(1, st.width);
  const wd = (END_SIZE[end.width ?? 'med'] ?? 3) * scale;
  const ln = (END_SIZE[end.length ?? 'med'] ?? 3) * scale;
  const px = -tip.uy;
  const py = tip.ux;
  const at = (a: number, b: number): [number, number] => [tip.x + tip.ux * a + px * b, tip.y + tip.uy * a + py * b];
  w.save();
  w.alpha(st.alpha);
  w.fillColor(st.color);
  const poly = (pts: Array<[number, number]>): void => {
    w.path(`M ${pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`);
    w.fillPath();
  };
  switch (end.type) {
    case 'triangle':
    case 'arrow':
      poly([at(ln * 0.1, 0), at(-ln * 0.9, wd / 2), at(-ln * 0.9, -wd / 2)]);
      break;
    case 'stealth':
      poly([at(ln * 0.1, 0), at(-ln * 0.9, wd / 2), at(-ln * 0.55, 0), at(-ln * 0.9, -wd / 2)]);
      break;
    case 'diamond':
      poly([at(ln / 2, 0), at(0, wd / 2), at(-ln / 2, 0), at(0, -wd / 2)]);
      break;
    case 'oval': {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 16; i++) pts.push(at((Math.cos((i / 16) * 2 * Math.PI) * ln) / 2, (Math.sin((i / 16) * 2 * Math.PI) * wd) / 2));
      poly(pts);
      break;
    }
    default:
  }
  w.restore();
}

/** Fleches aux deux bouts du premier chemin. */
export function paintLineEnds(w: PageWriter, line: Line | undefined, st: PdfStroke | null, d: string | undefined): void {
  if (!line || !st || !d) return;
  const t = tips(d);
  if (!t) return;
  if (line.head && line.head.type !== 'none') head(w, line.head, t.start, st);
  if (line.tail && line.tail.type !== 'none') head(w, line.tail, t.end, st);
}
