import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from '@cantoo/pdf-lib';
import { inspectHidden, sanitize, type HiddenKind } from '../src/sanitize.ts';

const N = PDFName.of;

async function fixture(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.setTitle('Secret');
  pdf.setAuthor('Jean Dupont');
  const page = pdf.addPage([300, 300]);
  await pdf.attach(new TextEncoder().encode('piece jointe'), 'notes.txt', { mimeType: 'text/plain' });
  const ctx = pdf.context;
  // JavaScript : arbre de noms + OpenAction
  const js = ctx.obj({ S: 'JavaScript', JS: PDFString.of('app.alert(1)') });
  const names = ctx.obj({}) as PDFDict;
  pdf.catalog.set(N('Names'), names);
  names.set(N('JavaScript'), ctx.obj({ Names: [PDFString.of('boot'), ctx.register(js)] }));
  pdf.catalog.set(N('OpenAction'), ctx.register(js));
  // métadonnées XMP
  pdf.catalog.set(N('Metadata'), ctx.register(ctx.stream('<x:xmpmeta/>', { Type: 'Metadata', Subtype: 'XML' })));
  // signets
  const item = ctx.register(ctx.obj({ Title: PDFString.of('Chapitre'), Dest: [page.ref, 'Fit'] }));
  const outlines = ctx.register(ctx.obj({ Type: 'Outlines', First: item, Last: item, Count: 1 }));
  ctx.lookup(item, PDFDict).set(N('Parent'), outlines);
  pdf.catalog.set(N('Outlines'), outlines);
  // annotations : note, surlignage, lien (à garder), pièce jointe
  const annot = (o: Record<string, unknown>) => ctx.register(ctx.obj({ Type: 'Annot', Rect: [10, 10, 50, 30], ...o }));
  const link = annot({ Subtype: 'Link', A: { S: 'URI', URI: PDFString.of('https://exemple.fr') } });
  const widgetJs = annot({ Subtype: 'Link', A: ctx.register(js) });
  page.node.set(N('Annots'), ctx.obj([annot({ Subtype: 'Text', Contents: PDFString.of('note') }), annot({ Subtype: 'Highlight', QuadPoints: [0, 0, 1, 0, 0, 1, 1, 1] }), link, annot({ Subtype: 'FileAttachment', Name: 'Paperclip' }), widgetJs]));
  return pdf.save({ useObjectStreams: false });
}

const all = new Set<HiddenKind>(['metadata', 'scripts', 'attachments', 'comments', 'bookmarks']);

test('inspection : ce qui est masqué dans le document', async () => {
  const r = await inspectHidden(await fixture());
  assert.ok(r.metadata >= 3, `métadonnées ${r.metadata}`);
  assert.equal(r.scripts, 3, 'JavaScript nommé + OpenAction + action de lien');
  assert.equal(r.attachments, 2, 'fichier incorporé + annotation fichier joint');
  assert.equal(r.comments, 2);
  assert.equal(r.bookmarks, 1);
});

test('assainissement complet : plus rien de masqué, liens et pages conservés', async () => {
  const out = await sanitize(await fixture(), all);
  const r = await inspectHidden(out);
  assert.deepEqual({ ...r }, { metadata: 0, scripts: 0, attachments: 0, comments: 0, bookmarks: 0 });
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 1);
  const annots = doc.getPage(0).node.lookup(N('Annots'), PDFArray);
  assert.equal(annots.size(), 2, 'les deux liens restent');
  const text = Buffer.from(out).toString('latin1');
  for (const secret of ['Jean Dupont', 'app.alert', 'x:xmpmeta', 'piece jointe']) assert.ok(!text.includes(secret), `${secret} encore dans le fichier`);
});

test('assainissement partiel : seules les catégories choisies disparaissent', async () => {
  const out = await sanitize(await fixture(), new Set<HiddenKind>(['comments']));
  const r = await inspectHidden(out);
  assert.equal(r.comments, 0);
  assert.equal(r.bookmarks, 1);
  assert.equal(r.attachments, 2);
  assert.equal(r.scripts, 3);
  assert.ok(r.metadata >= 3);
});
