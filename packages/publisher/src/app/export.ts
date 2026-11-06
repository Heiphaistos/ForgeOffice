// Sorties : feuilles a imprimer ou a exporter (une page par feuille, fond perdu et traits de coupe, cartes et etiquettes
// imposees, carte pliee et livret), rendu en images (PNG, PDF), .pptx pour PowerPoint, enregistrement .fopub.
import { createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MODULES } from '@forgeoffice/core';
import type { Deck, Slide } from '@forgeoffice/pptx';
import { buildPptx, pptxLosses } from '../pptx-export.ts';
import { backgroundCss, mediaUrl, PageView } from '@forgeoffice/powerpoint/canvas';
import { writeFopub } from '../fopub.ts';
import { bleedSheet, bookletOrder, cardGrid, cropMarks, type Segment } from '../imposition.ts';
import type { PubSettings } from '../model.ts';
import { pageClass, pageCss } from '../pagecss.ts';
import { S } from '../strings.ts';
import { pageProps, type Doc, type Editor } from './editor.ts';

export type ImposeMode = 'none' | 'cards' | 'fold' | 'booklet';

export interface SheetOptions {
  impose: ImposeMode;
  /** Fond perdu et traits de coupe autour de chaque page (impression professionnelle). */
  marks: boolean;
  /** Indices des pages (toutes par defaut). */
  pages?: number[];
}

export interface Sheets {
  width: number;
  height: number;
  nodes: ReactNode[];
}

const h = createElement;

/** Une page de la publication rendue a sa taille (1 px = 1 pt), habillage et lettrines compris. */
function pageNode(deck: Deck, pub: PubSettings, slide: Slide, index: number, bleed: number): ReactNode {
  const props = pageProps(deck, slide, index, pub);
  return h(PageView, {
    key: `${slide.id}-${index}`, width: deck.size.width, height: deck.size.height, ...props, uid: `x${slide.id}_${index}`, className: pageClass(slide.id),
    style: bleed ? { overflow: 'visible', background: 'transparent' } : undefined,
  }, h('style', null, pageCss(slide, pub, '#077568')));
}

function marksNode(segments: readonly Segment[], width: number, height: number): ReactNode {
  return h('svg', { key: 'marks', width, height, style: { position: 'absolute', left: 0, top: 0 } },
    segments.map((m, i) => h('line', { key: i, x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, stroke: '#000', strokeWidth: 0.5 })));
}

const placed = (key: string | number, x: number, y: number, w: number, hgt: number, child: ReactNode, clip = true): ReactNode =>
  h('div', { key, style: { position: 'absolute', left: x, top: y, width: w, height: hgt, overflow: clip ? 'hidden' : 'visible' } }, child);

/** Feuilles de sortie selon l'imposition demandee. */
export function buildSheets(doc: Doc, options: SheetOptions): Sheets {
  const { deck, pub } = doc;
  const page = deck.size;
  const indices = options.pages ?? deck.slides.map((_, i) => i);
  const slides = indices.map((i) => ({ slide: deck.slides[i], index: i })).filter((x): x is { slide: Slide; index: number } => !!x.slide);
  const imp = pub.imposition;
  if (options.impose === 'cards' && imp) {
    const grid = cardGrid(page, imp.sheet, imp.gapX, imp.gapY, 0, imp.cols, imp.rows);
    const per = grid.cells.length;
    const copies = slides.length === 1 ? Array.from({ length: per }, () => slides[0] as { slide: Slide; index: number }) : slides;
    const nodes: ReactNode[] = [];
    for (let k = 0; k < copies.length; k += per) {
      const chunk = copies.slice(k, k + per);
      nodes.push(h('div', { key: k, style: { position: 'relative', width: imp.sheet.width, height: imp.sheet.height, background: '#fff', overflow: 'hidden' } },
        chunk.map((c, i) => {
          const cell = grid.cells[i];
          return cell ? placed(i, cell.x, cell.y, cell.width, cell.height, pageNode(deck, pub, c.slide, c.index, 0)) : null;
        }),
        options.marks ? marksNode(cropMarks(grid.cells.slice(0, chunk.length), 6, 14), imp.sheet.width, imp.sheet.height) : null));
    }
    return { width: imp.sheet.width, height: imp.sheet.height, nodes };
  }
  if (options.impose === 'fold' || options.impose === 'booklet') {
    const width = page.width * 2;
    const nodes = bookletOrder(slides.length).map(([l, r], k) => h('div', { key: k, style: { position: 'relative', width, height: page.height, background: '#fff', overflow: 'hidden' } },
      [l, r].map((i, side) => {
        const item = i === null ? undefined : slides[i];
        return item ? placed(side, side * page.width, 0, page.width, page.height, pageNode(deck, pub, item.slide, item.index, 0)) : null;
      }),
      options.marks ? h('div', { key: 'fold', style: { position: 'absolute', left: page.width, top: 0, height: 12, borderLeft: '0.5px dashed #000' } }) : null));
    return { width, height: page.height, nodes };
  }
  if (!options.marks) return { width: page.width, height: page.height, nodes: slides.map((x) => pageNode(deck, pub, x.slide, x.index, 0)) };
  const sheet = bleedSheet(page, pub.bleed, true);
  const pageRect = { x: sheet.pageX, y: sheet.pageY, width: page.width, height: page.height };
  const marks = cropMarks([pageRect], sheet.markOffset, 18);
  const nodes = slides.map((x) => {
    const props = pageProps(deck, x.slide, x.index, pub);
    const b = pub.bleed;
    return h('div', { key: x.slide.id, style: { position: 'relative', width: sheet.width, height: sheet.height, background: '#fff', overflow: 'hidden' } },
      // Zone de fond perdu : l'arriere-plan de la page s'y prolonge, les objets qui depassent du bord y restent visibles.
      h('div', { style: { position: 'absolute', left: sheet.pageX - b, top: sheet.pageY - b, width: page.width + 2 * b, height: page.height + 2 * b, overflow: 'hidden', ...backgroundCss(props.background, props.ctx) } },
        placed('p', b, b, page.width, page.height, pageNode(deck, pub, x.slide, x.index, b), false)),
      marksNode(marks, sheet.width, sheet.height));
  });
  return { width: sheet.width, height: sheet.height, nodes };
}

// ---- Rendu en images ----

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('rendu de page impossible'));
    img.src = src;
  });
}

/** Rend chaque feuille en image (rendu React hors ecran, SVG foreignObject, medias incorpores en data:). */
export async function rasterize(sheets: Sheets, deck: Deck, dpi: number, type: 'image/png' | 'image/jpeg'): Promise<Blob[]> {
  const scale = Math.min(dpi / 72, 12000 / Math.max(sheets.width, sheets.height));
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${sheets.width}px;height:${sheets.height}px;overflow:hidden;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  const out: Blob[] = [];
  try {
    for (const node of sheets.nodes) {
      flushSync(() => root.render(node));
      await nextFrame();
      await nextFrame();
      await document.fonts.ready;
      const el = host.firstElementChild;
      if (!el) continue;
      let markup = new XMLSerializer().serializeToString(el);
      for (const item of Object.values(deck.media)) {
        const url = mediaUrl(item);
        if (url && markup.includes(url)) markup = markup.split(url).join(`data:${item.contentType};base64,${toBase64(item.bytes)}`);
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheets.width}" height="${sheets.height}"><foreignObject x="0" y="0" width="100%" height="100%">${markup}</foreignObject></svg>`;
      const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(sheets.width * scale);
      canvas.height = Math.round(sheets.height * scale);
      const g = canvas.getContext('2d');
      if (!g) throw new Error('canvas indisponible');
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.scale(scale, scale);
      g.drawImage(img, 0, 0, sheets.width, sheets.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.93));
      if (blob) out.push(blob);
    }
  } finally {
    root.unmount();
    host.remove();
  }
  return out;
}

/** PDF : une page par feuille ; en mode imprimeur, zone de coupe (TrimBox) et fond perdu (BleedBox) renseignes. */
export async function sheetsToPdf(images: readonly Blob[], sheets: Sheets, title: string, trim?: { x: number; y: number; width: number; height: number; bleed: number }): Promise<Uint8Array> {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator(`ForgeOffice ${MODULES.publisher.name}`);
  pdf.setProducer('ForgeOffice');
  for (const blob of images) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const image = blob.type === 'image/jpeg' ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    const page = pdf.addPage([sheets.width, sheets.height]);
    page.drawImage(image, { x: 0, y: 0, width: sheets.width, height: sheets.height });
    if (trim) {
      const y = sheets.height - trim.y - trim.height;
      page.setTrimBox(trim.x, y, trim.width, trim.height);
      page.setBleedBox(trim.x - trim.bleed, y - trim.bleed, trim.width + 2 * trim.bleed, trim.height + 2 * trim.bleed);
    }
  }
  return pdf.save();
}

export const baseName = (name: string): string => name.replace(/\.[^.]+$/, '');
const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Imposition proposee par defaut pour la composition. */
export function defaultImpose(pub: PubSettings): ImposeMode {
  return pub.imposition?.kind === 'cards' ? 'cards' : pub.imposition?.kind === 'fold' ? 'fold' : 'none';
}

export async function exportPdf(ed: Editor, printer: boolean, doc: Doc = ed.doc, suffix = ''): Promise<void> {
  try {
    ed.notify(S.file.exporting, 'info');
    const impose = defaultImpose(doc.pub);
    const sheets = buildSheets(doc, { impose, marks: printer });
    const images = await rasterize(sheets, doc.deck, printer ? 300 : 150, 'image/jpeg');
    const trim = printer && impose === 'none' ? (() => {
      const s = bleedSheet(doc.deck.size, doc.pub.bleed, true);
      return { x: s.pageX, y: s.pageY, width: doc.deck.size.width, height: doc.deck.size.height, bleed: doc.pub.bleed };
    })() : undefined;
    const pdf = await sheetsToPdf(images, sheets, doc.deck.properties.title || baseName(ed.file.name), trim);
    const saved = await ed.services.saveFile(pdf, `${baseName(ed.file.name)}${suffix}${printer ? ' - imprimeur' : ''}.pdf`, [{ name: S.file.formats.pdf, extensions: ['pdf'] }], null);
    if (saved) ed.notify(S.file.exported(saved.name), 'success');
  } catch (err) {
    ed.notify(`${S.file.exportFailed} ${errorText(err)}`, 'error');
  }
}

export async function exportPng(ed: Editor): Promise<void> {
  try {
    ed.notify(S.file.exporting, 'info');
    const images = await rasterize(buildSheets(ed.doc, { impose: 'none', marks: false }), ed.deck, 200, 'image/png');
    for (let i = 0; i < images.length; i++) {
      const bytes = new Uint8Array(await (images[i] as Blob).arrayBuffer());
      await ed.services.saveFile(bytes, `${baseName(ed.file.name)} - ${S.file.pageWord} ${i + 1}.png`, [{ name: S.file.formats.png, extensions: ['png'] }], null);
    }
    ed.notify(S.file.exported(`${images.length} ${S.file.images}`), 'success');
  } catch (err) {
    ed.notify(`${S.file.exportFailed} ${errorText(err)}`, 'error');
  }
}

/** Export .pptx : si la publication contient des elements que PowerPoint ne garde pas, le dialogue les liste d'abord. */
export function requestPptxExport(ed: Editor): void {
  if (pptxLosses(ed.deck, ed.pub).length) ed.setUi({ dialog: 'pptxExport' });
  else void exportPptx(ed);
}

export async function exportPptx(ed: Editor): Promise<void> {
  try {
    const out = await buildPptx(ed.deck, ed.pub);
    const saved = await ed.services.saveFile(out.bytes, `${baseName(ed.file.name)}.pptx`, [{ name: S.file.formats.pptx, extensions: ['pptx'] }], null);
    if (saved) ed.notify(`${S.file.exported(saved.name)}${out.guides ? ` ${S.pptx.guidesKept(out.guides)}` : ''}${out.lost.length ? ` ${S.pptx.lostShort(out.lost.length)}` : ''}`, out.lost.length ? 'info' : 'success');
  } catch (err) {
    ed.notify(`${S.file.exportFailed} ${errorText(err)}`, 'error');
  }
}

export const FOPUB_FILTER = { name: S.file.formats.fopub, extensions: ['fopub'] } as const;

/** Enregistrer (meme fichier .fopub) ou Enregistrer sous (nouveau chemin). */
export async function saveDoc(ed: Editor, saveAs = false): Promise<boolean> {
  const name = `${baseName(ed.file.name)}.fopub`;
  try {
    const deck = { ...ed.deck, properties: { ...ed.deck.properties, modified: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') } };
    const bytes = await writeFopub({ deck, pub: ed.pub });
    const sameFile = !saveAs && /\.fopub$/i.test(ed.file.name);
    const saved = await ed.services.saveFile(bytes, name, [FOPUB_FILTER], sameFile ? ed.file.path : null);
    if (!saved) return false;
    ed.setFile({ name: saved.name, path: saved.path });
    ed.markSaved();
    ed.services.setTitle(`${saved.name} - ${MODULES.publisher.name}`);
    if (saved.path) await ed.services.addRecent({ app: 'publisher', name: saved.name, path: saved.path });
    ed.notify(S.file.saved(saved.name), 'success');
    return true;
  } catch (err) {
    ed.notify(`${S.file.saveFailed} ${errorText(err)}`, 'error');
    return false;
  }
}
