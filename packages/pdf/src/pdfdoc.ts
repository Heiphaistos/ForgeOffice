// Acces a pdf.js pour le module PDF (code DOM) : texte positionne, signets, rendu, caviardage sans moteur natif,
// et ecriture des modifications en attente (moteur natif forge-convert d'abord, pdf-lib sinon).
import { PDFDocument } from 'pdf-lib';
import { Util } from 'pdfjs-dist';
import type { NativeBridge } from '@forgeoffice/core';
import { canvasBytes, input, openPdf, outputTarget, renderPage, runBytes, type PDFDocumentProxy, type PDFPageProxy } from '@forgeoffice/convert';
import { applyItems, geomOf } from './apply.ts';
import { toNativeZone, type DocState, type Item, type PageGeom, type TextBox } from './model.ts';

export { openPdf, renderPage, canvasBytes };
export type { PDFDocumentProxy, PDFPageProxy };

/** Boites de texte d'une page, normalisees dans la page affichee (avec son /Rotate). */
export async function textBoxes(page: PDFPageProxy): Promise<TextBox[]> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const out: TextBox[] = [];
  for (const item of content.items) {
    if (!('str' in item) || item.str === '') continue;
    const tx = Util.transform(viewport.transform, item.transform);
    const h = Math.hypot(tx[2] ?? 0, tx[3] ?? 0);
    const left = tx[4] ?? 0;
    const top = (tx[5] ?? 0) - h;
    const w = item.width * viewport.scale;
    out.push({ str: item.str, rect: { x: left / viewport.width, y: top / viewport.height, w: w / viewport.width, h: (h * 1.15) / viewport.height }, size: Math.hypot(item.transform[2] ?? 0, item.transform[3] ?? 0) });
  }
  return out;
}

export interface OutlineNode {
  title: string;
  page: number | null;
  children: OutlineNode[];
}

/** Signets avec leur page de destination (0-based). */
export async function outline(pdf: PDFDocumentProxy): Promise<OutlineNode[]> {
  const raw = (await pdf.getOutline()) ?? [];
  const resolve = async (dest: unknown): Promise<number | null> => {
    try {
      const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
      const ref = Array.isArray(explicit) ? explicit[0] : null;
      if (typeof ref === 'number') return ref;
      if (ref && typeof ref === 'object') return await pdf.getPageIndex(ref as Parameters<PDFDocumentProxy['getPageIndex']>[0]);
      return null;
    } catch {
      return null; // destination cassee : le signet reste affiche sans lien
    }
  };
  type Raw = { title: string; dest: unknown; items: Raw[] };
  const walk = async (list: readonly Raw[]): Promise<OutlineNode[]> => Promise.all(list.map(async (o) => ({ title: o.title, page: await resolve(o.dest), children: await walk(o.items) })));
  return walk(raw as unknown as Raw[]);
}

/** Geometrie de chaque page (boite et /Rotate) lue par pdf-lib. */
export async function geometries(bytes: Uint8Array): Promise<PageGeom[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  return doc.getPages().map(geomOf);
}

/** Caviardage sans moteur natif : chaque page touchee est remplacee par son image avec les zones noircies. */
async function rasterRedact(bytes: Uint8Array, zones: readonly Extract<Item, { kind: 'redact' }>[]): Promise<Uint8Array> {
  const pdf = await openPdf(bytes);
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  try {
    for (const index of [...new Set(zones.map((z) => z.page))]) {
      const page = await pdf.getPage(index + 1);
      const canvas = await renderPage(page, 200 / 72);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#000';
      for (const z of zones.filter((z) => z.page === index)) ctx.fillRect(z.rect.x * canvas.width, z.rect.y * canvas.height, z.rect.w * canvas.width, z.rect.h * canvas.height);
      const png = await doc.embedPng(await canvasBytes(canvas, 'image/png'));
      const visible = page.getViewport({ scale: 1 });
      const fresh = doc.insertPage(index, [visible.width, visible.height]);
      fresh.drawImage(png, { x: 0, y: 0, width: visible.width, height: visible.height });
      doc.removePage(index + 1);
    }
    return await doc.save({ useObjectStreams: true });
  } finally {
    await pdf.loadingTask.destroy();
  }
}

export interface CommitResult {
  bytes: Uint8Array;
  /** Avertissements (repli sans moteur natif). */
  notes: string[];
}

/** Ecrit tous les elements en attente dans les octets du document. */
export async function commitPending(state: DocState, native: NativeBridge | null, flatten = false, warn: { cover: string; raster: string }): Promise<CommitResult> {
  const notes: string[] = [];
  const geoms = await geometries(state.bytes);
  const edits = state.items.filter((i): i is Extract<Item, { kind: 'textedit' }> => i.kind === 'textedit');
  const redacts = state.items.filter((i): i is Extract<Item, { kind: 'redact' }> => i.kind === 'redact');
  let bytes = await applyItems(state.bytes, state, { coverTextEdits: native === null, flatten });
  if (native === null && edits.length > 0) notes.push(warn.cover);
  const zone = (i: Item & { rect: { x: number; y: number; w: number; h: number } }) => {
    const g = geoms[i.page];
    return g ? toNativeZone(i.rect, i.page, g) : null;
  };
  if (native && (edits.length > 0 || redacts.length > 0)) {
    const actions: Record<string, unknown>[] = [];
    if (edits.length > 0) actions.push({ action: 'corriger_texte', correctifs: edits.map((e) => ({ zone: zone(e), texte: e.text, taille: e.size })).filter((c) => c.zone) });
    if (redacts.length > 0) actions.push({ action: 'caviarder', zones: redacts.map(zone).filter((z) => z !== null) });
    const res = await runBytes(native, { op: 'pdf', entree: input(0), actions, sortie: outputTarget('document.pdf') }, [{ name: 'document.pdf', bytes }]);
    const out = res.files[0];
    if (out) bytes = out.bytes;
  } else if (redacts.length > 0) {
    bytes = await rasterRedact(bytes, redacts);
    notes.push(warn.raster);
  }
  return { bytes, notes };
}

/** Texte de toutes les pages (separees par un saut de page). */
export async function allText(pdf: PDFDocumentProxy): Promise<string[]> {
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    let text = '';
    for (const item of content.items) if ('str' in item) text += item.str + (item.hasEOL ? '\n' : '');
    pages.push(text);
  }
  return pages;
}
