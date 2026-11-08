// Numerotation des notes (w:footnotePr / w:endnotePr des reglages) : aller-retour .docx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankDocument, readDocx, writeDocx } from '../src/index.ts';
import { para, run } from './helpers.ts';

test('numerotation des notes : format, debut, redemarrage, emplacement', async () => {
  const doc = createBlankDocument();
  doc.body = [para([run('texte'), { type: 'footnoteRef', noteId: 1 }, { type: 'endnoteRef', noteId: 1 }])];
  doc.footnotes = [{ id: 1, blocks: [para('note')] }];
  doc.endnotes = [{ id: 1, blocks: [para('fin')] }];
  doc.settings.footnoteNumbering = { format: 'lowerRoman', start: 3, restart: 'eachPage', position: 'pageBottom' };
  doc.settings.endnoteNumbering = { format: 'upperLetter', start: 2 };
  const { document } = await readDocx(await writeDocx(doc));
  assert.deepEqual(document.settings.footnoteNumbering, { format: 'lowerRoman', start: 3, restart: 'eachPage', position: 'pageBottom' });
  assert.deepEqual(document.settings.endnoteNumbering, { format: 'upperLetter', start: 2 });
});

test('sans numerotation personnalisee : rien n est invente', async () => {
  const { document } = await readDocx(await writeDocx(createBlankDocument()));
  assert.equal(document.settings.footnoteNumbering, undefined);
  assert.equal(document.settings.endnoteNumbering, undefined);
});
