// Impression du PDF (ou des seules pages choisies, cf. printpages.ts) par la boîte d'impression du système.
// Les pages sont rendues en images dans un conteneur dédié, seul visible à l'impression : un cadre sur une URL blob:
// ne marche pas (le lecteur PDF du moteur web est une origine tierce, `print()` y est refusé).
import { canvasBytes, openPdf, pdfOps, renderPage } from '@forgeoffice/convert';
import { printCss } from './printpages.ts';

const DPI = 200;

/** Ouvre la boîte d'impression du système sur `bytes` (via `print`, ex. `services.print`). */
export async function printBytes(bytes: Uint8Array, pages: readonly number[] | null, print: () => void, password?: string): Promise<void> {
  const out = pages ? await pdfOps.extract(bytes, [...pages]) : bytes;
  const pdf = await openPdf(out, password);
  const urls: string[] = [];
  const sizes: Array<{ w: number; h: number }> = [];
  const root = document.createElement('div');
  root.className = 'pdf-print';
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 1, rotation: page.rotate % 360 });
      const png = await canvasBytes(await renderPage(page, DPI / 72), 'image/png');
      const url = URL.createObjectURL(new Blob([png.slice()], { type: 'image/png' }));
      urls.push(url);
      sizes.push({ w: vp.width, h: vp.height });
      const holder = document.createElement('div');
      holder.className = 'pdf-print__page';
      const img = document.createElement('img');
      img.src = url;
      await img.decode();
      holder.append(img);
      root.append(holder);
    }
  } finally {
    await pdf.loadingTask.destroy();
  }
  for (const old of document.querySelectorAll('.pdf-print, style[data-pdf-print]')) old.remove();
  const style = document.createElement('style');
  style.dataset.pdfPrint = '';
  style.textContent = printCss(sizes);
  document.body.append(root, style);
  window.addEventListener('afterprint', () => {
    root.remove();
    style.remove();
    for (const u of urls) URL.revokeObjectURL(u);
  }, { once: true });
  print();
}
