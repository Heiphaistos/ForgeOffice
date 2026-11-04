// Caviardage de repli : le texte caviarde ne doit survivre dans AUCUN objet du fichier (flux decodes, Info, XMP).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFRawStream, StandardFonts, decodePDFRawStream } from 'pdf-lib';
import { rebuildWithRasterPages } from '../src/redact.ts';

const SECRET = 'SECRETCODE4242';
const OTHER = 'PAGEDEUXVISIBLE';
const CONTENT = 'CONTENUSEULEMENT77'; // present uniquement dans le flux de contenu de la page 1
// PNG 1x1 blanc.
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

async function source(): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const first = doc.addPage([600, 800]);
  first.drawText(SECRET, { x: 50, y: 700, size: 20, font });
  first.drawText(CONTENT, { x: 50, y: 650, size: 20, font });
  doc.addPage([600, 800]).drawText(OTHER, { x: 50, y: 700, size: 20, font });
  doc.setTitle(`Titre ${SECRET}`);
  doc.setAuthor(`Auteur ${SECRET}`);
  doc.setSubject(SECRET);
  doc.setKeywords([SECRET]);
  const xmp = doc.context.stream(`<x:xmpmeta>${SECRET}</x:xmpmeta>`, { Type: 'Metadata', Subtype: 'XML' });
  doc.catalog.set(PDFName.of('Metadata'), doc.context.register(xmp));
  // Reload : comme l'application, on part des octets enregistres.
  return PDFDocument.load(await doc.save(), { updateMetadata: false });
}

/** pdf-lib ecrit le texte des polices standard en hexadecimal : on cherche les deux formes. */
function contains(all: string, text: string): boolean {
  return all.includes(text) || all.toUpperCase().includes(Buffer.from(text, 'latin1').toString('hex').toUpperCase());
}

/** Tous les objets du fichier, flux decodes, concatenes en latin1 (+ octets bruts). */
async function everything(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  let all = Buffer.from(bytes).toString('latin1');
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    all += '\n' + (obj instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(obj).decode()).toString('latin1') : obj.toString());
  }
  return all;
}

test('caviardage de repli : le texte caviarde est absent de tout le fichier', async () => {
  const src = await source();
  // Temoin : la methode de recherche trouve bien le texte dans le fichier d'origine (flux compresses, Info, XMP).
  const original = await everything(await src.save());
  assert.ok(contains(original, SECRET));
  assert.ok(contains(original, CONTENT));

  const out = await rebuildWithRasterPages(src, new Map([[0, { png: PNG, width: 600, height: 800 }]]));
  const text = await everything(out);
  assert.ok(!contains(text, SECRET), 'le texte caviarde survit dans le fichier');
  assert.ok(!contains(text, CONTENT), 'le flux de contenu de la page caviardee survit');
  assert.ok(contains(text, OTHER), 'la page non touchee doit rester intacte (copyPages)');

  const back = await PDFDocument.load(out, { updateMetadata: false });
  assert.equal(back.getPageCount(), 2);
  assert.equal(back.getTitle(), undefined);
  assert.equal(back.getAuthor(), undefined);
  assert.equal(back.catalog.has(PDFName.of('Metadata')), false);
  assert.deepEqual(back.getPage(0).getSize(), { width: 600, height: 800 });
});
