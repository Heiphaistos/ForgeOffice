// Pack and Go : un ZIP pour l'imprimeur (PDF imprimeur, fichier source .fopub, images, LISEZ-MOI avec polices et dimensions).
import JSZip from 'jszip';
import { writeFopub } from '../fopub.ts';
import { fontsUsed, packReadme } from '../packgo.ts';
import { usedSpots } from '../spots.ts';
import { S } from '../strings.ts';
import type { Editor } from './editor.ts';
import { baseName, makePdf } from './export.ts';

export async function packAndGo(ed: Editor): Promise<void> {
  try {
    ed.notify(S.file.exporting, 'info');
    const doc = ed.doc;
    const base = baseName(ed.file.name);
    const zip = new JSZip();
    const pdfName = `${base} - imprimeur.pdf`;
    const fopubName = `${base}.fopub`;
    zip.file(pdfName, await makePdf(ed, true, doc));
    zip.file(fopubName, await writeFopub(doc));
    const images = Object.values(doc.deck.media).filter((m) => m.contentType.startsWith('image/')).map((m, i) => ({ name: `image${i + 1}.${m.extension}`, bytes: m.bytes }));
    for (const img of images) zip.file(`Images/${img.name}`, img.bytes);
    zip.file('LISEZ-MOI.txt', packReadme({
      title: doc.deck.properties.title || base, pages: doc.deck.slides.length, size: doc.deck.size, bleed: doc.pub.bleed,
      fonts: fontsUsed(doc.deck), images: images.map((i) => i.name), files: [pdfName, fopubName, 'Images/', 'LISEZ-MOI.txt'],
      spots: usedSpots(doc.deck, doc.pub.spots).map((s) => `${s.name} : C ${s.cmyk[0]} M ${s.cmyk[1]} J ${s.cmyk[2]} N ${s.cmyk[3]}`),
    }));
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const saved = await ed.services.saveFile(bytes, `${base} - Pack and Go.zip`, [{ name: 'Dossier ZIP', extensions: ['zip'] }], null);
    if (saved) ed.notify(S.file.exported(saved.name), 'success');
  } catch (err) {
    ed.notify(`${S.file.exportFailed} ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}
