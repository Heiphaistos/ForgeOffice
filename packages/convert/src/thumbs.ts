// Miniatures de la liste (DOM) : natif `convert_miniatures` pour les fichiers du disque, sinon canvas (images) ou pdf.js (page 1).
// Chargees une a une (file d'attente) et gardees tant que le fichier est dans la liste (WeakMap sur ses octets).
import type { NativeBridge } from '@forgeoffice/core';
import { thumbKind } from './listing.ts';

export const THUMB_SIZE = 40;
const cache = new WeakMap<Uint8Array, string | null>();
let chain: Promise<unknown> = Promise.resolve();

interface ThumbFile {
  ext: string;
  size: number;
  path: string | null;
  bytes: Uint8Array;
}

function mimeFor(ext: string): string {
  return ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
}

function drawContain(source: CanvasImageSource, w: number, h: number): string {
  const px = Math.round(THUMB_SIZE * Math.min(2, window.devicePixelRatio || 1));
  const k = Math.min(px / w, px / h, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

async function fromImage(file: ThumbFile): Promise<string> {
  const url = URL.createObjectURL(new Blob([file.bytes.slice().buffer], { type: mimeFor(file.ext) }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return drawContain(img, img.naturalWidth || THUMB_SIZE, img.naturalHeight || THUMB_SIZE);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fromPdf(file: ThumbFile): Promise<string> {
  const { openPdf, renderPage } = await import('./pdfjs.ts');
  const doc = await openPdf(file.bytes);
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const px = THUMB_SIZE * Math.min(2, window.devicePixelRatio || 1);
    const canvas = await renderPage(page, Math.min(px / base.width, px / base.height));
    return canvas.toDataURL('image/png');
  } finally {
    await doc.cleanup();
  }
}

async function fromNative(native: NativeBridge, path: string): Promise<string | null> {
  const list = await native.invoke<(string | null)[]>('convert_miniatures', { chemins: [path] });
  return list[0] ?? null;
}

async function build(file: ThumbFile, native: NativeBridge | null): Promise<string | null> {
  const kind = thumbKind(file, native !== null);
  if (!kind) return null;
  try {
    if (kind === 'native' && native && file.path) {
      const url = await fromNative(native, file.path).catch(() => null);
      if (url) return url;
    }
    return kind === 'pdf' ? await fromPdf(file) : await fromImage(file);
  } catch {
    return null; // fichier illisible ou protege : l'icone du format reste affichee
  }
}

/** Miniature (data-URL) d'un fichier, ou null (icone). Traitement sequentiel pour ne pas figer l'interface. */
export function thumbnail(file: ThumbFile, native: NativeBridge | null): Promise<string | null> {
  if (cache.has(file.bytes)) return Promise.resolve(cache.get(file.bytes) ?? null);
  const job = chain.then(async () => {
    const url = await build(file, native);
    cache.set(file.bytes, url);
    return url;
  });
  chain = job.catch(() => undefined);
  return job;
}
