// Impression du PDF (ou des seules pages choisies, cf. printpages.ts) par la boîte d'impression du système.
import { pdfOps } from '@forgeoffice/convert';

/** Ouvre la boîte d'impression du système sur `bytes` (cadre invisible retiré après une minute). */
export async function printBytes(bytes: Uint8Array, pages: readonly number[] | null): Promise<void> {
  const out = pages ? await pdfOps.extract(bytes, [...pages]) : bytes;
  const url = URL.createObjectURL(new Blob([out.slice()], { type: 'application/pdf' }));
  const frame = document.createElement('iframe');
  frame.className = 'pdf-printframe';
  frame.src = url;
  frame.onload = () => {
    frame.contentWindow?.print();
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  document.body.appendChild(frame);
}
