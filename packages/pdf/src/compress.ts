// Compression de repli sans moteur natif : reecriture avec flux d'objets compresses (structure seulement, images conservees).
import { PDFDocument } from '@cantoo/pdf-lib';

export interface Compressed {
  bytes: Uint8Array;
  before: number;
  after: number;
}

/** Reecrit le PDF ; ne renvoie jamais un fichier plus gros que l'original. */
export async function compressStructure(bytes: Uint8Array): Promise<Compressed> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const out = await doc.save({ useObjectStreams: true });
  const better = out.length < bytes.length;
  return { bytes: better ? out : bytes, before: bytes.length, after: better ? out.length : bytes.length };
}
