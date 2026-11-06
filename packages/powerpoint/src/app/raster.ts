// Rasterisation des pages (export PNG / JPEG / PDF) : rendu React hors ecran, serialisation en SVG foreignObject,
// images incorporees en data:, dessin dans un canvas.
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { displayMedia, type Deck } from '@forgeoffice/pptx';
import { mediaUrl } from '../canvas/context.ts';

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

/** Remplace les adresses blob: des medias par des data: (une image SVG ne charge aucune ressource externe). */
function inlineMedia(markup: string, deck: Deck): string {
  let out = markup;
  for (const item of Object.values(deck.media)) {
    const url = mediaUrl(item);
    const shown = displayMedia(item);
    if (url && shown && out.includes(url)) out = out.split(url).join(`data:${shown.contentType};base64,${toBase64(shown.bytes)}`);
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('rendu de page impossible'));
    img.src = src;
  });
}

export interface RasterOptions {
  width: number;
  height: number;
  /** Pixels par point (2 = 144 ppp). */
  scale: number;
  type: 'image/png' | 'image/jpeg';
  /** Fond transparent (PNG) au lieu du blanc : elements de repli du PDF vectoriel. */
  transparent?: boolean;
}

/** Rend chaque noeud (une page de `width` x `height` points) en image. */
export async function rasterize(pages: readonly ReactNode[], deck: Deck, options: RasterOptions, onProgress?: (done: number) => void): Promise<Blob[]> {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${options.width}px;height:${options.height}px;overflow:hidden;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  const out: Blob[] = [];
  try {
    for (let i = 0; i < pages.length; i++) {
      flushSync(() => root.render(pages[i]));
      await nextFrame();
      await nextFrame();
      await document.fonts.ready;
      const page = host.firstElementChild;
      if (!page) continue;
      const markup = inlineMedia(new XMLSerializer().serializeToString(page), deck);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}"><foreignObject x="0" y="0" width="100%" height="100%">${markup}</foreignObject></svg>`;
      const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(options.width * options.scale);
      canvas.height = Math.round(options.height * options.scale);
      const g = canvas.getContext('2d');
      if (!g) throw new Error('canvas indisponible');
      if (!options.transparent) {
        g.fillStyle = '#FFFFFF';
        g.fillRect(0, 0, canvas.width, canvas.height);
      }
      g.scale(options.scale, options.scale);
      g.drawImage(img, 0, 0, options.width, options.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, options.type, 0.92));
      if (blob) out.push(blob);
      onProgress?.(i + 1);
    }
  } finally {
    root.unmount();
    host.remove();
  }
  return out;
}

/** PDF : une page par image, a la taille de la page en points. */
export async function imagesToPdf(images: readonly Blob[], width: number, height: number, title: string): Promise<Uint8Array> {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator('ForgeOffice Présentation');
  pdf.setProducer('ForgeOffice');
  for (const blob of images) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const image = blob.type === 'image/jpeg' ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    const page = pdf.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }
  return pdf.save();
}
