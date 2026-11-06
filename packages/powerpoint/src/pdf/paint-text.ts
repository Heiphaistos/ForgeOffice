// Texte vectoriel d'une forme ou d'une cellule : mise en page puis ecriture des segments dans le PDF.
import type { BodyProps, Paragraph, TextBody } from '@forgeoffice/pptx';
import type { PageContext } from '../canvas/context.ts';
import type { Rect } from '../canvas/math.ts';
import { DEFAULT_INSETS } from '../canvas/render/numbering.ts';
import { layoutEnv } from './style.ts';
import { layoutBody, type Block } from './text-layout.ts';
import type { PageWriter } from './writer.ts';

export interface TextTarget {
  w: PageWriter;
  ctx: PageContext;
  screen?: (text: string, css: string) => number;
  /** Origine de la forme dans la page quand elle n'est ni tournee ni dans un groupe tourne (liens cliquables). */
  origin: { x: number; y: number } | null;
}

/** Corps sans aucun caractere : rien a dessiner. */
export const isBlank = (paragraphs: readonly Paragraph[]): boolean => paragraphs.every((p) => p.runs.every((r) => r.type === 'text' && r.text === ''));

/** Hauteur du texte d'un corps dans une largeur donnee (hauteur de ligne de tableau). */
export function textHeight(target: Omit<TextTarget, 'w' | 'origin'> & { w: PageWriter }, body: TextBody, width: number, props: BodyProps): number {
  const env = layoutEnv(target.w.book, target.ctx, body.paragraphs, target.screen);
  const insets = { ...DEFAULT_INSETS, ...(props.insets ?? {}) };
  const block = layoutBody(body.paragraphs, env, { width: width - insets.left - insets.right, height: 1e6, scale: 1, lineScale: 1, wrap: props.wrap !== false, columns: 1, columnGap: 0 });
  return block.height + insets.top + insets.bottom;
}

/** Dessine un corps de texte dans `rect` (repere courant). Renvoie la hauteur occupee. */
export function paintText(t: TextTarget, body: TextBody, rect: Rect, propsOverride?: BodyProps): number {
  const props = propsOverride ?? body.props;
  const insets = { ...DEFAULT_INSETS, ...(props.insets ?? {}) };
  const innerW = rect.width - insets.left - insets.right;
  const innerH = rect.height - insets.top - insets.bottom;
  if (isBlank(body.paragraphs) || innerW <= 0) return 0;
  const env = layoutEnv(t.w.book, t.ctx, body.paragraphs, t.screen);
  const autofit = props.autofit;
  const fileScale = autofit?.type === 'normal' ? (autofit.fontScale ?? 100) / 100 : 1;
  const lineScale = autofit?.type === 'normal' ? 1 - (autofit.lineSpacingReduction ?? 0) / 100 : 1;
  const columns = props.columns && props.columns > 1 ? props.columns : 1;
  const lay = (scale: number): Block =>
    layoutBody(body.paragraphs, env, { width: innerW, height: innerH, scale, lineScale, wrap: props.wrap !== false, columns, columnGap: props.columnSpacing ?? 0 });
  let scale = fileScale;
  let block = lay(scale);
  if (autofit?.type === 'normal' && columns === 1) {
    for (let i = 0; i < 6 && innerH > 0 && block.height > innerH + 0.5 && scale > 0.25; i++) {
      scale = Math.max(0.25, scale * Math.max(0.5, (innerH / block.height) * 0.97));
      block = lay(scale);
    }
  }
  const free = innerH - block.height;
  const anchor = props.anchor ?? 't';
  const offset = anchor === 'ctr' ? free / 2 : anchor === 'b' ? free : 0;
  const top = rect.y + insets.top + offset;
  const left = rect.x + insets.left;
  for (const line of block.lines) {
    const baseline = top + line.baseline;
    if (line.bullet) t.w.text({ ...line.bullet, x: left + line.bullet.x }, baseline);
    for (const seg of line.segs) {
      const placed = { ...seg, x: left + seg.x };
      t.w.text(placed, baseline);
      if (seg.style.link && t.origin) t.w.link(seg.style.link, t.origin.x + placed.x, t.origin.y + top + line.top, seg.width, line.height);
    }
  }
  return block.height + insets.top + insets.bottom;
}
