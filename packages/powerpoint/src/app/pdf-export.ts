// Export PDF vectoriel dans le navigateur : mesure du texte a l'ecran et image de repli des elements non vectoriels.
import { createElement } from 'react';
import type { Deck, Shape } from '@forgeoffice/pptx';
import { PageView } from '../canvas/PageView.tsx';
import { boundsOf, type Box } from '../canvas/math.ts';
import { buildVectorPdf, type PdfPageInput, type RasterFallback, type VectorPdfResult } from '../pdf/index.ts';
import { rasterize } from './raster.ts';
import { slidePageProps } from './slide-render.ts';

const PAD = 36;
const SCALE = 3;

/** Largeur a l'ecran d'un texte (canvas 2D) : le PDF reprend ainsi les coupures de ligne de l'editeur. */
export function canvasMeasure(): (text: string, css: string) => number {
  const g = document.createElement('canvas').getContext('2d');
  return (text, css) => {
    if (!g) return text.length * 8;
    g.font = css;
    return g.measureText(text).width;
  };
}

function fallbackFor(deck: Deck, page: PdfPageInput): RasterFallback {
  return async (shape: Shape, box: Box, ctx) => {
    const b = boundsOf(box);
    const x = Math.max(0, b.x - PAD);
    const y = Math.max(0, b.y - PAD);
    const rect = { x, y, width: Math.min(page.width, b.x + b.width + PAD) - x, height: Math.min(page.height, b.y + b.height + PAD) - y };
    if (rect.width <= 0 || rect.height <= 0) return null;
    const placed = { ...shape, xfrm: { x: box.x, y: box.y, width: box.width, height: box.height, rotation: box.rotation, flipH: box.flipH, flipV: box.flipV } } as Shape;
    const view = createElement(PageView, { width: page.width, height: page.height, background: { type: 'none' }, ctx: { ...ctx, resolve: (s: Shape) => s }, shapes: [placed], uid: `fb${shape.id}`, style: { position: 'absolute', left: -rect.x, top: -rect.y, background: 'transparent' } });
    const host = createElement('div', { style: { position: 'relative', width: rect.width, height: rect.height, overflow: 'hidden' } }, view);
    const [blob] = await rasterize([host], deck, { width: rect.width, height: rect.height, scale: SCALE, type: 'image/png', transparent: true });
    return blob ? { png: new Uint8Array(await blob.arrayBuffer()), rect } : null;
  };
}

/** PDF vectoriel des diapositives visibles (ou d'une seule), texte selectionnable. */
export async function vectorPdf(deck: Deck, title: string, only?: number, onProgress?: (done: number) => void): Promise<VectorPdfResult> {
  await document.fonts.ready;
  const slides = deck.slides.filter((s, i) => (only === undefined ? !s.hidden : i === only));
  const pages = slides.map((slide) => slidePageProps(deck, slide, deck.slides.indexOf(slide), `v${slide.id}`));
  const first = pages[0];
  return buildVectorPdf(pages, { title, screen: canvasMeasure(), raster: first ? fallbackFor(deck, first) : undefined, onProgress });
}
