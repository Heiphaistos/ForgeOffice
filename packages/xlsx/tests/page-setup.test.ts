// Mise en page : aller-retour xlsx complet (marges, en-tetes/pieds, titres, zones multiples, sauts, options de feuille).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpcPackage } from '@forgeoffice/opc';
import { addSheet, createBlankWorkbook, readXlsx, writeXlsx, type PageSetup } from '../src/index.ts';

const FULL: Partial<PageSetup> = {
  orientation: 'landscape', paperSize: 8, scale: 70, firstPageNumber: 5, dpi: 600, pageOrder: 'overThenDown',
  blackAndWhite: true, draft: true, cellComments: 'atEnd', errors: 'dash', horizontalCentered: true, verticalCentered: true,
  printGridLines: true, printHeadings: true,
  printArea: [{ r1: 0, c1: 0, r2: 9, c2: 3 }, { r1: 20, c1: 0, r2: 29, c2: 3 }],
  printTitleRows: { first: 0, last: 1 }, printTitleCols: { first: 0, last: 0 },
  margins: { left: 0.5, right: 0.6, top: 0.9, bottom: 1.1, header: 0.4, footer: 0.45 },
  headerFooter: {
    oddHeader: '&L&"Arial,Gras"Titre&C&D&RPage &P/&N', oddFooter: '&C&F', evenHeader: '&CPair', evenFooter: '&CPair pied',
    firstHeader: '&CPremiere', firstFooter: '&CPremier pied', differentOddEven: true, differentFirst: true, scaleWithDoc: false, alignWithMargins: false,
  },
  rowBreaks: [9, 19], colBreaks: [3],
};

test('mise en page : tous les champs survivent a un aller-retour xlsx', async () => {
  const wb = createBlankWorkbook();
  Object.assign(wb.sheets[0]?.pageSetup ?? {}, FULL);
  const back = await readXlsx(await writeXlsx(wb));
  const ps = back.sheets[0]?.pageSetup;
  for (const key of Object.keys(FULL) as (keyof PageSetup)[]) assert.deepEqual(ps?.[key], FULL[key], key);
});

test('mise en page : ajuster a N pages x M pages, valeurs 0 (automatique) conservees, feuilles independantes', async () => {
  const wb = createBlankWorkbook();
  const a = wb.sheets[0];
  const b = addSheet(wb, 'Deux');
  if (!a) throw new Error('feuille');
  Object.assign(a.pageSetup, { fitToPage: true, fitToWidth: 3, fitToHeight: 0 });
  Object.assign(b.pageSetup, { fitToPage: true, fitToWidth: 0, fitToHeight: 2, printTitleRows: { first: 4, last: 4 } });
  const back = await readXlsx(await writeXlsx(wb));
  assert.deepEqual([back.sheets[0]?.pageSetup.fitToPage, back.sheets[0]?.pageSetup.fitToWidth, back.sheets[0]?.pageSetup.fitToHeight], [true, 3, 0]);
  assert.deepEqual([back.sheets[1]?.pageSetup.fitToWidth, back.sheets[1]?.pageSetup.fitToHeight], [0, 2]);
  assert.deepEqual(back.sheets[1]?.pageSetup.printTitleRows, { first: 4, last: 4 });
  assert.equal(back.sheets[0]?.pageSetup.printTitleRows, undefined);
});

test('mise en page : XML ecrit conforme (ordre des elements, saut de ligne apres la ligne 10, noms definis)', async () => {
  const wb = createBlankWorkbook();
  const ps = wb.sheets[0]?.pageSetup;
  if (!ps) throw new Error('feuille');
  Object.assign(ps, { rowBreaks: [9], printTitleRows: { first: 0, last: 0 }, headerFooter: { oddFooter: '&CPage &P' } });
  const pkg = await OpcPackage.open(await writeXlsx(wb));
  const sheet = await pkg.readText('xl/worksheets/sheet1.xml');
  const order = ['<pageMargins', '<pageSetup', '<headerFooter', '<rowBreaks'].map((t) => sheet.indexOf(t));
  assert.ok(order.every((i) => i > 0) && order.every((v, k) => k === 0 || (order[k - 1] ?? 0) < v), `ordre ${order.join(',')}`);
  assert.match(sheet, /<brk id="10" max="\d+" man="1"\/>/);
  const book = await pkg.readText('xl/workbook.xml');
  assert.match(book, /_xlnm\.Print_Titles[^>]*>[^<]*\$1:\$1</);
});
