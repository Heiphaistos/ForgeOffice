// Parcours d'une page et peinture vectorielle de ses formes : formes, images, tableaux, groupes, repli sur image.
import type { PDFDocument } from '@cantoo/pdf-lib';
import type { Fill, Geometry, GroupShape, Picture, Shape, TableShape } from '@forgeoffice/pptx';
import { cellLook } from '../canvas/table-style.ts';
import type { PageLayer, PageViewProps } from '../canvas/PageView.tsx';
import type { PageContext } from '../canvas/context.ts';
import { buildGeometry, LINE_PRESETS } from '../canvas/geometry/index.ts';
import { boundsOf, type Box, type Rect } from '../canvas/math.ts';
import { boxOfXfrm, childToParent } from '../canvas/ops.ts';
import { embedImage, paintFill, paintLineEnds, paintStroke, strokeOf } from './paint-fill.ts';
import { isBlank, paintText, textHeight, type TextTarget } from './paint-text.ts';
import { chartToVector } from './svg-vector.ts';
import { paintOf } from './style.ts';
import type { FontBook } from './fonts.ts';
import type { PageWriter } from './writer.ts';

/** Page a ecrire : memes donnees que `PageView` (sans le DOM). */
export type PdfPageInput = Pick<PageViewProps, 'width' | 'height' | 'background' | 'ctx' | 'shapes' | 'underlay'>;

/** Image de repli d'un element non gere (effets, formats d'image non PDF) : PNG transparent et zone couverte en points. */
export type RasterFallback = (shape: Shape, box: Box, ctx: PageContext) => Promise<{ png: Uint8Array; rect: Rect } | null>;

export interface PdfServices {
  pdf: PDFDocument;
  book: FontBook;
  screen?: (text: string, css: string) => number;
  raster?: RasterFallback;
  stats: { vector: number; raster: number; skipped: number };
}

interface Walk {
  w: PageWriter;
  svc: PdfServices;
  ctx: PageContext;
}

const PAD = 4;

/** Effets que le PDF vectoriel ne sait pas rendre (l'ombre portee est approchee). */
function hasHardEffects(shape: Shape): boolean {
  if (!('effects' in shape) || !shape.effects) return false;
  const e = shape.effects;
  return !!(e.glow || e.reflection || e.softEdge || e.blur || e.innerShadow || e.extra?.length);
}

function needsRaster(shape: Shape): boolean {
  if (hasHardEffects(shape)) return true;
  if (shape.kind === 'shape') {
    const t = shape.text?.props;
    if (t?.warp || (t?.vertical && t.vertical !== 'horz')) return !isBlank(shape.text?.paragraphs ?? []);
  }
  if (shape.kind === 'picture') {
    const fx = shape.imageEffects;
    return !!(fx && (fx.grayscale || fx.brightness || fx.contrast || fx.duotone || fx.extra?.length));
  }
  return false;
}

async function rasterize(walk: Walk, shape: Shape, box: Box): Promise<boolean> {
  const { svc, w } = walk;
  if (!svc.raster) return false;
  const out = await svc.raster(shape, box, walk.ctx);
  if (!out) return false;
  const img = await embedImage(svc.pdf, { id: 'r', contentType: 'image/png', extension: 'png', bytes: out.png });
  if (!img) return false;
  w.image(img, out.rect.x, out.rect.y, out.rect.width, out.rect.height);
  svc.stats.raster++;
  return true;
}

/** Place le repere sur la forme : origine en haut a gauche, rotation autour du centre. */
function enter(w: PageWriter, box: Box): void {
  w.save();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  w.cm(1, 0, 0, 1, cx, cy);
  if (box.rotation) {
    const a = (box.rotation * Math.PI) / 180;
    w.cm(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0);
  }
  w.cm(1, 0, 0, 1, -box.width / 2, -box.height / 2);
}

function flip(w: PageWriter, box: Box): void {
  if (!box.flipH && !box.flipV) return;
  w.cm(box.flipH ? -1 : 1, 0, 0, box.flipV ? -1 : 1, box.flipH ? box.width : 0, box.flipV ? box.height : 0);
}

async function paintGeometry(walk: Walk, shape: Shape & { geometry: Geometry }, box: Box, groupFill: Fill | undefined): Promise<void> {
  const { w, ctx } = walk;
  const geo = buildGeometry(shape.geometry, box.width, box.height);
  const isLine = shape.geometry.type === 'preset' && LINE_PRESETS.has(shape.geometry.preset);
  const fill = shape.kind === 'shape' && !isLine ? shape.fill : undefined;
  const line = 'line' in shape ? shape.line : undefined;
  const st = strokeOf(line, ctx);
  const filled = geo.paths.filter((p) => p.fill !== 'none').map((p) => p.d);
  // Ombre portee : copie decalee (le flou n'est pas rendu).
  const fx = 'effects' in shape ? shape.effects : undefined;
  const shadow = fx?.outerShadow ?? (fx?.presetShadow ? { color: fx.presetShadow.color, distance: fx.presetShadow.distance, direction: fx.presetShadow.direction, blur: 4 } : undefined);
  if (shadow && fill && fill.type !== 'none') {
    const c = paintOf(shadow.color, ctx);
    const a = (shadow.direction * Math.PI) / 180;
    if (c) {
      w.save();
      w.cm(1, 0, 0, 1, Math.cos(a) * shadow.distance, Math.sin(a) * shadow.distance);
      w.alpha(c.alpha * (shadow.blur > 6 ? 0.6 : 0.85));
      w.fillColor(c.rgb);
      for (const d of filled) {
        w.path(d);
        w.fillPath();
      }
      w.restore();
    }
  }
  if (filled.length && fill) await paintFill(w, fill, ctx, filled, box.width, box.height, groupFill);
  const shade: Record<string, number> = { darken: 0.4, darkenLess: 0.2, lighten: -0.4, lightenLess: -0.2 };
  if (fill && fill.type !== 'none') {
    for (const p of geo.paths) {
      const tone = shade[p.fill];
      if (tone === undefined) continue;
      w.save();
      w.alpha(Math.abs(tone));
      w.fillColor(tone > 0 ? [0, 0, 0] : [1, 1, 1]);
      w.path(p.d);
      w.fillPath();
      w.restore();
    }
  }
  if (st) {
    paintStroke(w, st, geo.paths.filter((p) => p.stroke).map((p) => p.d));
    paintLineEnds(w, line, st, geo.paths[0]?.d);
  }
}

async function paintPicture(walk: Walk, shape: Picture, box: Box): Promise<boolean> {
  const { w, ctx, svc } = walk;
  const item = ctx.media(shape.mediaId);
  const img = await embedImage(svc.pdf, item);
  if (!img) return false;
  const geo = buildGeometry(shape.geometry, box.width, box.height);
  const crop = shape.crop ?? { left: 0, top: 0, right: 0, bottom: 0 };
  const fw = 1 - (crop.left + crop.right) / 100 || 1;
  const fh = 1 - (crop.top + crop.bottom) / 100 || 1;
  const iw = box.width / fw;
  const ih = box.height / fh;
  w.save();
  for (const p of geo.paths) w.path(p.d);
  w.clipPath();
  if (shape.imageEffects?.alpha !== undefined) w.alpha(shape.imageEffects.alpha / 100);
  flip(w, box);
  w.image(img, (-crop.left / 100) * iw, (-crop.top / 100) * ih, iw, ih);
  w.restore();
  const st = strokeOf(shape.line, ctx);
  if (st) paintStroke(w, st, geo.paths.map((p) => p.d));
  return true;
}

function cellParagraphs(cell: TableShape['table']['rows'][number]['cells'][number], look: ReturnType<typeof cellLook>) {
  return cell.text.paragraphs.map((p) => ({
    ...p,
    runs: p.runs.map((run) => ({ ...run, props: { size: 18, ...(look.color ? { color: look.color } : {}), ...(look.bold ? { bold: true } : {}), ...run.props } })),
    endProps: { size: 18, ...(look.color ? { color: look.color } : {}), ...(look.bold ? { bold: true } : {}), ...(p.endProps ?? {}) },
  }));
}

async function paintTable(walk: Walk, shape: TableShape, box: Box): Promise<void> {
  const { w, ctx, svc } = walk;
  const t = shape.table;
  const total = t.columns.reduce((a, b) => a + b, 0) || 1;
  const sx = box.width / total;
  const colX: number[] = [0];
  for (const c of t.columns) colX.push((colX[colX.length - 1] as number) + c * sx);
  const target = { w, ctx, screen: svc.screen };
  // Hauteurs : celles du modele, agrandies si le texte de la ligne ne tient pas.
  const heights = t.rows.map((row, r) => {
    let h = row.height;
    row.cells.forEach((cell, c) => {
      if (cell.hMerge || cell.vMerge || (cell.rowSpan ?? 1) > 1) return;
      const look = cellLook(t, r, c);
      const m = { left: 7.2, right: 7.2, top: 3.6, bottom: 3.6, ...(cell.margins ?? {}) };
      const width = (colX[c + (cell.gridSpan ?? 1)] ?? box.width) - (colX[c] as number);
      h = Math.max(h, textHeight(target, { props: cell.text.props, paragraphs: cellParagraphs(cell, look) }, width, { insets: m }));
    });
    return h;
  });
  const rowY: number[] = [0];
  for (const h of heights) rowY.push((rowY[rowY.length - 1] as number) + h);
  for (let r = 0; r < t.rows.length; r++) {
    const row = t.rows[r];
    for (let c = 0; c < (row?.cells.length ?? 0); c++) {
      const cell = row?.cells[c];
      if (!cell || cell.hMerge || cell.vMerge) continue;
      const look = cellLook(t, r, c);
      const x0 = colX[c] as number;
      const x1 = colX[Math.min(c + (cell.gridSpan ?? 1), t.columns.length)] as number;
      const y0 = rowY[r] as number;
      const y1 = rowY[Math.min(r + (cell.rowSpan ?? 1), t.rows.length)] as number;
      const fill = cell.fill ?? look.fill;
      if (fill && fill.type !== 'none') {
        const d = `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
        await paintFill(w, fill, ctx, [d], x1 - x0, y1 - y0);
      }
      const b = cell.borders ?? {};
      const edges: Array<[typeof look.top, string]> = [
        [b.top ?? look.top, `M ${x0} ${y0} L ${x1} ${y0}`],
        [b.bottom ?? look.bottom, `M ${x0} ${y1} L ${x1} ${y1}`],
        [b.left ?? look.left, `M ${x0} ${y0} L ${x0} ${y1}`],
        [b.right ?? look.right, `M ${x1} ${y0} L ${x1} ${y1}`],
      ];
      for (const [line, d] of edges) {
        const st = strokeOf(line, ctx);
        if (st) paintStroke(w, st, [d]);
      }
      const m = { left: 7.2, right: 7.2, top: 3.6, bottom: 3.6, ...(cell.margins ?? {}) };
      paintText({ ...target, origin: null }, { props: cell.text.props, paragraphs: cellParagraphs(cell, look) }, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, { ...cell.text.props, insets: m, anchor: cell.anchor ?? 't' });
    }
  }
}

async function paintLeaf(walk: Walk, shape: Shape, box: Box, groupFill: Fill | undefined): Promise<void> {
  const { w, svc, ctx } = walk;
  if (needsRaster(shape) && (await rasterize(walk, shape, box))) return;
  const rotated = !!box.rotation;
  const origin = rotated ? null : { x: box.x, y: box.y };
  enter(w, box);
  try {
    switch (shape.kind) {
      case 'shape':
      case 'connector':
        flip(w, box);
        await paintGeometry(walk, shape, box, groupFill);
        // Le texte n'est pas retourne.
        if (shape.kind === 'shape' && shape.text) {
          // flip() est annule en sortant du bloc : on repart d'un repere sain.
        }
        break;
      case 'picture':
        if (!(await paintPicture(walk, shape, box))) {
          w.restore();
          w.save();
          if (!(await rasterize(walk, shape, box))) svc.stats.skipped++;
        }
        break;
      case 'table':
        await paintTable(walk, shape, box);
        break;
      case 'chart':
        if (!chartToVector(w, shape.chart, box.width, box.height, ctx, svc.screen)) {
          if (!(await rasterize(walk, shape, box))) svc.stats.skipped++;
        }
        break;
      case 'media': {
        const poster = shape.posterMediaId ? await embedImage(svc.pdf, ctx.media(shape.posterMediaId)) : null;
        if (poster) w.image(poster, 0, 0, box.width, box.height);
        else if (shape.mediaType === 'video') {
          w.fillColor([0.12, 0.12, 0.12]);
          w.rectPath(0, 0, box.width, box.height);
          w.fillPath();
        }
        break;
      }
      default:
    }
  } finally {
    w.restore();
  }
  if (shape.kind === 'shape' && shape.text && !isBlank(shape.text.paragraphs)) {
    enter(w, box);
    const geo = buildGeometry(shape.geometry, box.width, box.height);
    paintText({ w, ctx, screen: svc.screen, origin }, shape.text, geo.textRect);
    w.restore();
  }
  svc.stats.vector++;
}

async function paintList(walk: Walk, shapes: readonly Shape[], frames: GroupShape[], groupFill: Fill | undefined): Promise<void> {
  for (const raw of shapes) {
    if (raw.hidden) continue;
    const shape = walk.ctx.resolve(raw);
    if (!shape.xfrm && shape.kind !== 'smartart' && shape.kind !== 'raw') continue;
    let box: Box | null = shape.xfrm ? boxOfXfrm(shape.xfrm) : null;
    for (const g of frames) if (box) box = childToParent(g, box);
    if (shape.kind === 'group') {
      await paintList(walk, shape.children, [shape, ...frames], shape.fill ?? groupFill);
      continue;
    }
    if (shape.kind === 'smartart' || shape.kind === 'raw') {
      await paintList(walk, shape.fallback, frames, groupFill);
      continue;
    }
    if (box) await paintLeaf(walk, shape, box, groupFill);
  }
}

/** Peint une page complete : arriere-plan, formes du masque et de la disposition, formes de la page. */
export async function paintPage(w: PageWriter, page: PdfPageInput, svc: PdfServices): Promise<void> {
  const box = { x: 0, y: 0, width: page.width, height: page.height };
  const bg = page.background && page.background.type !== 'none' && page.background.type !== 'group' ? page.background : ({ type: 'solid', color: { type: 'rgb', value: 'FFFFFF' } } as Fill);
  await paintFill(w, bg, page.ctx, [`M 0 0 L ${box.width} 0 L ${box.width} ${box.height} L 0 ${box.height} Z`], box.width, box.height);
  for (const layer of page.underlay ?? ([] as readonly PageLayer[])) await paintList({ w, svc, ctx: layer.ctx }, layer.shapes, [], undefined);
  await paintList({ w, svc, ctx: page.ctx }, page.shapes, [], undefined);
}

export { boundsOf, PAD };
