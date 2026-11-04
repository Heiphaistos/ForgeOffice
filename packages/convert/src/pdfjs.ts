// Chargement de pdf.js (lecture, rendu, texte des PDF) avec son travailleur servi par Vite.
// Partage par le Convertisseur et le module PDF.
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy, PDFPageProxy };

/** Ouvre un PDF (copie des octets : pdf.js transfere son tampon au travailleur). Formulaires XFA desactives. */
export function openPdf(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  return getDocument({ data: bytes.slice(), password, enableXfa: false }).promise;
}

/** Texte d'une page (lignes reconstituees d'apres les fins de ligne de pdf.js). */
export async function pageText(page: PDFPageProxy): Promise<string> {
  const content = await page.getTextContent();
  let out = '';
  for (const item of content.items) {
    if ('str' in item) out += item.str + (item.hasEOL ? '\n' : '');
  }
  return out;
}

/** Rend une page dans un canevas a l'echelle donnee (1 = 72 ppp). */
export async function renderPage(page: PDFPageProxy, scale: number, rotation = 0): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas, viewport }).promise;
  return canvas;
}

export function canvasBytes(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Image impossible à produire.'));
        return;
      }
      blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject);
    }, mime, quality);
  });
}
