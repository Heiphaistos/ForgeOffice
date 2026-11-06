// Export PDF vectoriel : texte reel (polices standard du PDF), formes, images, degrades et tableaux en vecteur ;
// repli sur une image pour les elements que le PDF ne sait pas rendre (effets, formats d'image, texte deforme).
import { PDFDocument } from '@cantoo/pdf-lib';
import { FontBook } from './fonts.ts';
import { paintPage, type PdfPageInput, type PdfServices, type RasterFallback } from './paint-shapes.ts';
import { PageWriter } from './writer.ts';

export type { PdfPageInput, RasterFallback } from './paint-shapes.ts';

export interface VectorPdfOptions {
  title?: string;
  creator?: string;
  /** Largeur a l'ecran d'un texte dans une police CSS : la ligne du PDF reprend alors exactement les coupures de l'ecran. */
  screen?: (text: string, css: string) => number;
  /** Rendu de repli (image PNG) d'un element non gere. */
  raster?: RasterFallback;
  onProgress?: (done: number) => void;
}

export interface VectorPdfResult {
  bytes: Uint8Array;
  pages: number;
  /** Elements ecrits en vecteur / en image de repli / ignores. */
  stats: PdfServices['stats'];
  /** Vrai si des caracteres hors des polices standard ont ete remplaces. */
  lossyText: boolean;
}

/** Construit un PDF dont chaque page a les dimensions de la diapositive (points). */
export async function buildVectorPdf(pages: readonly PdfPageInput[], options: VectorPdfOptions = {}): Promise<VectorPdfResult> {
  const pdf = await PDFDocument.create();
  if (options.title) pdf.setTitle(options.title);
  pdf.setCreator(options.creator ?? 'ForgeOffice Présentation');
  pdf.setProducer('ForgeOffice');
  const book = await FontBook.create(pdf);
  const stats = { vector: 0, raster: 0, skipped: 0 };
  const svc: PdfServices = { pdf, book, screen: options.screen, raster: options.raster, stats };
  let done = 0;
  for (const input of pages) {
    const page = pdf.addPage([input.width, input.height]);
    const writer = new PageWriter(pdf, page, book, input.height);
    await paintPage(writer, input, svc);
    writer.finish();
    options.onProgress?.(++done);
  }
  const bytes = await pdf.save();
  return { bytes, pages: pages.length, stats, lossyText: book.lossy };
}
