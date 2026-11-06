import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSheet, createBlankWorkbook, dateToSerial, setValue, styleIdFor, writeXlsx } from '@forgeoffice/xlsx';
import { isWorkbookName, openMergeBook, pickFields } from '../src/merge-xlsx.ts';
import { fillFields } from '../src/merge.ts';

async function sampleBook(): Promise<Uint8Array> {
  const wb = createBlankWorkbook();
  const s = wb.sheets[0]!;
  s.name = 'Clients';
  const money = styleIdFor(wb, { numberFormat: '#,##0.00 "€"' });
  const day = styleIdFor(wb, { numberFormat: 'dd/mm/yyyy' });
  ['Nom', 'Ville', 'Solde', 'Depuis'].forEach((h, c) => setValue(s, 0, c, h));
  setValue(s, 1, 0, 'Dupont; Jean');
  setValue(s, 1, 1, 'Lyon');
  setValue(s, 1, 2, 1234.5).styleId = money;
  setValue(s, 1, 3, dateToSerial(new Date(Date.UTC(2026, 10, 4)))).styleId = day;
  setValue(s, 2, 0, 'Martin "Léa"');
  setValue(s, 2, 1, 'Paris');
  setValue(s, 2, 2, 7).styleId = money;
  setValue(s, 2, 3, true);
  const second = addSheet(wb, 'Fournisseurs');
  ['Société', 'Pays'].forEach((h, c) => setValue(second, 0, c, h));
  setValue(second, 1, 0, 'Acme');
  setValue(second, 1, 1, 'France');
  const hidden = addSheet(wb, 'Brouillon');
  hidden.state = 'hidden';
  setValue(hidden, 0, 0, 'secret');
  return writeXlsx(wb);
}

test('publipostage xlsx : feuilles visibles, champs de la premiere ligne, valeurs mises en forme comme dans le Tableur', async () => {
  const book = await openMergeBook(await sampleBook(), 'clients.xlsx');
  assert.deepEqual(book.sheets, ['Clients', 'Fournisseurs'], 'la feuille masquee est ignoree');
  const src = book.read(0);
  assert.deepEqual(src.fields, ['Nom', 'Ville', 'Solde', 'Depuis']);
  assert.equal(src.records.length, 2);
  assert.deepEqual(src.records[0]?.slice(0, 2), ['Dupont; Jean', 'Lyon']);
  assert.match(src.records[0]?.[2] ?? '', /^1\s?234,50\s?€$/, `solde : ${src.records[0]?.[2]}`);
  assert.equal(src.records[0]?.[3], '04/11/2026');
  assert.equal(src.records[1]?.[0], 'Martin "Léa"');
  assert.equal(src.records[1]?.[3], 'VRAI');
  assert.match(src.name, /clients\.xlsx.*Clients/);
  // Les champs se glissent dans le texte comme ceux d'un CSV.
  assert.equal(fillFields('Bonjour «Nom» de «Ville» («Solde»)', src.fields, src.records[0] ?? []).replace(/\s/g, ' '), `Bonjour Dupont; Jean de Lyon (${src.records[0]?.[2]})`.replace(/\s/g, ' '));
});

test('publipostage xlsx : autre feuille, choix des champs', async () => {
  const book = await openMergeBook(await sampleBook(), 'clients.xlsx');
  const second = book.read(1);
  assert.deepEqual(second.fields, ['Société', 'Pays']);
  assert.deepEqual(second.records, [['Acme', 'France']]);
  assert.equal(book.read(9).fields.length, 0, 'feuille inconnue : source vide');
  const picked = pickFields(book.read(0), new Set(['Ville', 'Nom']));
  assert.deepEqual(picked.fields, ['Nom', 'Ville'], 'ordre d origine');
  assert.deepEqual(picked.records[1], ['Martin "Léa"', 'Paris']);
  assert.deepEqual(pickFields(second, new Set()).records, [[]]);
});

test('publipostage xlsx : fichier qui n est pas un classeur refuse, extensions reconnues', async () => {
  await assert.rejects(() => openMergeBook(new TextEncoder().encode('Nom;Ville\nA;B\n'), 'liste.csv'));
  assert.ok(isWorkbookName('Liste.XLSX') && isWorkbookName('a.xlsm') && !isWorkbookName('a.csv') && !isWorkbookName('a.xls'));
});
