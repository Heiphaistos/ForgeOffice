// Execution d'une conversion : paquets de la suite (TypeScript), navigateur (canvas, pdf.js, pdf-lib)
// ou moteur natif forge-convert. Les paquets lourds sont charges a la demande.
import type { NativeBridge } from '@forgeoffice/core';
import { extensionOf, mimeOf, type Engine } from './formats.ts';
import { input, outputTarget, runBytes, type NamedBytes } from './native.ts';
import { imagesToPdf, type ImageKind } from './pdf-ops.ts';
import { S } from './strings.ts';

export interface ConvertOptions {
  /** Qualite JPEG/WebP 1..100. */
  quality: number;
  width: number | null;
  height: number | null;
  rotation: 0 | 90 | 180 | 270;
  highFidelity: boolean;
}

export const DEFAULT_OPTIONS: ConvertOptions = { quality: 90, width: null, height: null, rotation: 0, highFidelity: false };

const stem = (name: string): string => name.replace(/\.[^.]+$/, '') || 'fichier';

async function viaSuite(engine: 'texte' | 'tableur' | 'presentation', file: NamedBytes, target: string): Promise<Uint8Array> {
  if (engine === 'texte') {
    const docx = await import('@forgeoffice/docx');
    const { document } = await docx.readDocument(file.bytes, file.name);
    return docx.writeDocument(document, target as Exclude<import('@forgeoffice/docx').DocumentFormat, 'doc'>);
  }
  if (engine === 'tableur') {
    const xlsx = await import('@forgeoffice/xlsx');
    // Texte commencant par = + - @ neutralise en CSV/TSV (injection de formules chez le destinataire).
    return xlsx.writeWorkbook(await xlsx.readWorkbook(file.bytes, file.name), target as import('@forgeoffice/xlsx').SpreadsheetFormat, { csv: { escapeFormulas: true } });
  }
  const pptx = await import('@forgeoffice/pptx');
  return pptx.writePptx(await pptx.openPresentation(file.bytes), { format: target as import('@forgeoffice/pptx').DeckFormat });
}

/** Decode une image (y compris SVG) avec le navigateur. */
async function decodeImage(file: NamedBytes): Promise<HTMLImageElement> {
  const type = extensionOf(file.name) === 'svg' ? 'image/svg+xml' : mimeOf(extensionOf(file.name));
  const url = URL.createObjectURL(new Blob([file.bytes.slice()], { type }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error(S.errors.canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function viaCanvas(file: NamedBytes, target: string, o: ConvertOptions): Promise<Uint8Array> {
  const { canvasBytes } = await import('./pdfjs.ts');
  const img = await decodeImage(file);
  const w0 = img.naturalWidth || 1024;
  const h0 = img.naturalHeight || 1024;
  // Redimension : une seule dimension donnee = proportions conservees.
  const w = o.width ?? (o.height ? Math.round((w0 * o.height) / h0) : w0);
  const h = o.height ?? (o.width ? Math.round((h0 * o.width) / w0) : h0);
  const quarter = o.rotation === 90 || o.rotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = quarter ? h : w;
  canvas.height = quarter ? w : h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(S.errors.canvas);
  if (target === 'jpg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((o.rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return canvasBytes(canvas, mimeOf(target), o.quality / 100);
}

async function pdfPages(file: NamedBytes, target: 'png' | 'jpg', o: ConvertOptions): Promise<NamedBytes[]> {
  const { openPdf, renderPage, canvasBytes } = await import('./pdfjs.ts');
  const pdf = await openPdf(file.bytes);
  const out: NamedBytes[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const canvas = await renderPage(await pdf.getPage(i), 150 / 72, o.rotation);
      out.push({ name: `${stem(file.name)}-page-${i}.${target}`, bytes: await canvasBytes(canvas, mimeOf(target), o.quality / 100) });
    }
  } finally {
    await pdf.loadingTask.destroy();
  }
  return out;
}

async function pdfText(file: NamedBytes): Promise<Uint8Array> {
  const { openPdf, pageText } = await import('./pdfjs.ts');
  const pdf = await openPdf(file.bytes);
  try {
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) parts.push(await pageText(await pdf.getPage(i)));
    return new TextEncoder().encode(parts.join('\n\f'));
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/** Image en PNG ou JPEG embarquable par pdf-lib (les autres formats passent par le canvas). */
async function embeddable(file: NamedBytes, o: ConvertOptions): Promise<{ bytes: Uint8Array; kind: ImageKind }> {
  const ext = extensionOf(file.name);
  const plain = o.width === null && o.height === null && o.rotation === 0;
  if (plain && ext === 'png') return { bytes: file.bytes, kind: 'png' };
  if (plain && (ext === 'jpg' || ext === 'jpeg')) return { bytes: file.bytes, kind: 'jpg' };
  return { bytes: await viaCanvas(file, 'png', o), kind: 'png' };
}

/** Plusieurs images dans un seul PDF (une image par page). */
export async function imagesToOnePdf(files: readonly NamedBytes[], o: ConvertOptions = DEFAULT_OPTIONS): Promise<Uint8Array> {
  const list = [];
  for (const f of files) list.push(await embeddable(f, o));
  return imagesToPdf(list);
}

/** Convertit un fichier ; renvoie un ou plusieurs fichiers produits (PDF en images : une image par page). */
export async function convertFile(
  file: NamedBytes, target: string, engine: Engine, outName: string, native: NativeBridge | null, o: ConvertOptions,
): Promise<NamedBytes[]> {
  switch (engine) {
    case 'texte':
    case 'tableur':
    case 'presentation':
      return [{ name: outName, bytes: await viaSuite(engine, file, target) }];
    case 'canvas':
      return [{ name: outName, bytes: await viaCanvas(file, target, o) }];
    case 'images-pdf':
      return [{ name: outName, bytes: await imagesToOnePdf([file], o) }];
    case 'pdf-images':
      return pdfPages(file, target === 'jpg' ? 'jpg' : 'png', o);
    case 'pdf-texte':
      return [{ name: outName, bytes: await pdfText(file) }];
    case 'native': {
      if (!native) throw new Error(S.needDesktop);
      const options = {
        qualite: o.quality, largeur: o.width, hauteur: o.height, rotation: o.rotation || null, haute_fidelite: o.highFidelity,
      };
      const op = { op: 'convertir', entree: input(0), vers: target, options, sortie: outputTarget(outName) };
      return (await runBytes(native, op, [file])).files;
    }
  }
}
