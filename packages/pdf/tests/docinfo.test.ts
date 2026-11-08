import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import { describePageSize, formatBytes, readDocInfo, validLang, writeAccess } from '../src/docinfo.ts';

test('format de page lisible', () => {
  assert.equal(describePageSize(595.28, 841.89), 'A4 (210 × 297 mm), portrait');
  assert.equal(describePageSize(841.89, 595.28), 'A4 (297 × 210 mm), paysage');
  assert.equal(describePageSize(612, 792), 'Lettre (216 × 279 mm), portrait');
  assert.equal(describePageSize(300, 300), '106 × 106 mm, carré');
  assert.equal(formatBytes(900), '900 o');
  assert.equal(formatBytes(2048), '2,0 Ko');
  assert.equal(formatBytes(3 * 1048576), '3,00 Mo');
});

test('langue : validation', () => {
  for (const ok of ['', 'fr', 'fr-FR', 'en-GB', 'zh-Hans-CN']) assert.equal(validLang(ok), true, ok);
  for (const bad of ['f', 'français', 'fr_FR', 'fr FR']) assert.equal(validLang(bad), false, bad);
});

test('informations du document, langue et titre affiché écrits puis relus', async () => {
  const pdf = await PDFDocument.create();
  const p = pdf.addPage([595.28, 841.89]);
  p.setRotation(degrees(90));
  pdf.addPage([200, 200]);
  const bytes = await pdf.save();
  const a = await readDocInfo(bytes);
  assert.equal(a.pages, 2);
  assert.equal(a.version, '1.7');
  assert.equal(a.lang, '');
  assert.equal(a.displayTitle, false);
  assert.equal(a.tagged, false);
  assert.ok(Math.abs(a.pageWidth - 841.89) < 0.01 && Math.abs(a.pageHeight - 595.28) < 0.01, 'rotation appliquée');
  const out = await writeAccess(bytes, { lang: 'fr-FR', displayTitle: true });
  const b = await readDocInfo(out);
  assert.equal(b.lang, 'fr-FR');
  assert.equal(b.displayTitle, true);
  assert.equal(b.pages, 2);
  const back = await readDocInfo(await writeAccess(out, { lang: '', displayTitle: false }));
  assert.equal(back.lang, '');
  assert.equal(back.displayTitle, false);
});
