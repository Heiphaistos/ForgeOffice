// Caviardage de repli (sans moteur natif) : reconstruction du PDF dans un NOUVEAU document.
// Les pages touchees ne gardent que leur image noircie ; aucun ancien flux de contenu, aucune metadonnee ne survit.
import { PDFDocument } from 'pdf-lib';

/** Page rastérisée (zones noircies) remplacant la page d'origine ; dimensions en points. */
export interface RasterPage {
  png: Uint8Array;
  width: number;
  height: number;
}

/** Copie les pages non touchees (copyPages), remplace les autres par leur image ; Info et XMP vides. */
export async function rebuildWithRasterPages(source: PDFDocument, replaced: ReadonlyMap<number, RasterPage>): Promise<Uint8Array> {
  const out = await PDFDocument.create({ updateMetadata: false });
  for (let i = 0; i < source.getPageCount(); i++) {
    const raster = replaced.get(i);
    if (!raster) {
      const [page] = await out.copyPages(source, [i]);
      if (page) out.addPage(page);
      continue;
    }
    const image = await out.embedPng(raster.png);
    out.addPage([raster.width, raster.height]).drawImage(image, { x: 0, y: 0, width: raster.width, height: raster.height });
  }
  return out.save({ useObjectStreams: true });
}
