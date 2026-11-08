// Proprietes du document : enregistrees et relues dans le fichier xlsx.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook, readWorkbook, writeWorkbook } from '@forgeoffice/xlsx';

test('proprietes : titre, auteur, sujet, mots cles, categorie, societe', async () => {
  const wb = createBlankWorkbook();
  wb.properties = { ...wb.properties, title: 'Budget', creator: 'Momo', subject: 'Annee', keywords: 'a; b', category: 'Finance', company: 'Forge' };
  const back = await readWorkbook(await writeWorkbook(wb, 'xlsx'));
  assert.deepEqual([back.properties.title, back.properties.creator, back.properties.subject, back.properties.keywords, back.properties.category, back.properties.company], ['Budget', 'Momo', 'Annee', 'a; b', 'Finance', 'Forge']);
});
