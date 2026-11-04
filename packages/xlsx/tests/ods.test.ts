import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import {
  cellFont, createBlankWorkbook, getCell, isDateCell, numberFormatCode, putCell, readOds, readWorkbook, setValue,
  SpreadsheetError, styleIdFor, writeOds, writeWorkbook, type Workbook,
} from '../src/index.ts';
import { excelToOdfFormula, odfToExcelFormula } from '../src/ods/ods-common.ts';
import { numberStyleXml } from '../src/ods/ods-write.ts';
import { richWorkbook } from './fixtures.ts';

const corpus = (name: string): Uint8Array => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

function formatOf(wb: Workbook, row: number, col: number, sheet = 0): string {
  const cell = getCell(wb.sheets[sheet]!, row, col);
  return numberFormatCode(wb.styles, wb.styles.cellXfs[cell?.styleId ?? 0]?.numFmtId ?? 0);
}

test('ods produit par un tiers : valeurs, formules, dates, formats, feuilles', async () => {
  const basic = await readOds(corpus('basic.ods'));
  assert.equal(basic.properties.title, 'Basic ODS');
  assert.equal(getCell(basic.sheets[0]!, 1, 1)?.formula, 'B1*2');
  assert.equal(getCell(basic.sheets[0]!, 1, 1)?.value, 84);
  const wb = await readOds(corpus('sheet.ods'));
  assert.deepEqual(wb.sheets.map((s) => s.name), ['Data', 'Second']);
  const s = wb.sheets[0]!;
  assert.ok(isDateCell(wb, getCell(s, 2, 1)));
  assert.equal(getCell(s, 2, 1)?.value, 45366);
  assert.equal(getCell(s, 4, 2)?.formula, 'SUM(C3:C4)');
  assert.equal(getCell(wb.sheets[1]!, 0, 1)?.formula, 'Data!C5*2');
  assert.ok(formatOf(wb, 2, 3).includes('%'));
  assert.equal(cellFont(wb, getCell(s, 0, 0)).bold, true);
});

test('ods : aller-retour ecriture -> lecture du classeur de demonstration', async () => {
  const source = richWorkbook();
  const bytes = await writeOds(source);
  const zip = await JSZip.loadAsync(bytes);
  assert.equal(Object.keys(zip.files)[0], 'mimetype');
  assert.equal(await zip.file('mimetype')?.async('string'), 'application/vnd.oasis.opendocument.spreadsheet');
  const wb = await readOds(bytes);
  assert.equal(wb.sourceFormat, 'ods');
  assert.deepEqual(wb.sheets.map((s) => s.name), source.sheets.map((s) => s.name));
  const s = wb.sheets[0]!;
  assert.equal(getCell(s, 0, 0)?.value, 'Produit');
  assert.equal(getCell(s, 1, 1)?.value, 1.5);
  assert.equal(getCell(s, 1, 3)?.formula, 'B2*C2');
  assert.equal(getCell(s, 6, 3)?.formula, 'SUM(D2:D5)');
  assert.equal(getCell(s, 7, 0)?.value, 45658);
  assert.ok(isDateCell(wb, getCell(s, 7, 0)));
  assert.equal(getCell(s, 7, 1)?.value, true);
  assert.deepEqual(getCell(s, 7, 2)?.value, { error: '#DIV/0!' });
  assert.equal(getCell(s, 9, 0)?.value, 'Ligne 1\nLigne 2');
  assert.equal(wb.styles.cellXfs[getCell(s, 9, 0)?.styleId ?? 0]?.alignment?.wrapText, true);
  const header = cellFont(wb, getCell(s, 0, 0));
  assert.equal(header.bold, true);
  assert.deepEqual(header.color, { rgb: 'FFFFFFFF' });
  const headerXf = wb.styles.cellXfs[getCell(s, 0, 0)?.styleId ?? 0]!;
  assert.deepEqual(wb.styles.fills[headerXf.fillId], { type: 'pattern', pattern: 'solid', fg: { rgb: 'FF107C41' } });
  assert.equal(formatOf(wb, 1, 1), '#,##0.00" €"');
  assert.deepEqual(s.merges, [{ r1: 11, c1: 0, r2: 11, c2: 3 }]);
  assert.equal(Math.round(s.cols.find((c) => c.min === 0)!.width!), 18);
  assert.equal(s.cols.find((c) => c.min === 5)?.hidden, true);
  assert.equal(s.rows.get(9)?.height, 30);
  assert.deepEqual(s.tabColor, { rgb: 'FF107C41' });
  const hidden = wb.sheets.find((x) => x.name === source.sheets.find((y) => y.state !== 'visible')?.name);
  assert.ok(hidden && hidden.state === 'hidden');
});

test('ods : dates et heures, pourcentages, texte avec espaces, noms definis, cellules vides', async () => {
  const wb = createBlankWorkbook();
  const s = wb.sheets[0]!;
  putCell(s, 0, 0, { value: 45658.75, styleId: styleIdFor(wb, { numberFormat: 'dd/mm/yyyy hh:mm' }) });
  putCell(s, 0, 1, { value: 0.256, styleId: styleIdFor(wb, { numberFormat: '0.0%' }) });
  setValue(s, 0, 2, '  deux   espaces\tet tab');
  setValue(s, 5000, 3, 'loin');
  putCell(s, 2, 2, { value: null, styleId: styleIdFor(wb, { font: { italic: true } }) });
  wb.definedNames.push({ name: 'Zone', formula: "'Feuil1'!$A$1:$B$2" }, { name: 'Taux', formula: '0.2*2' });
  const back = await readOds(await writeOds(wb));
  const t = back.sheets[0]!;
  assert.equal(getCell(t, 0, 0)?.value, 45658.75);
  assert.equal(formatOf(back, 0, 0), 'dd/mm/yyyy hh:mm');
  assert.ok(Math.abs((getCell(t, 0, 1)?.value as number) - 0.256) < 1e-12);
  assert.equal(formatOf(back, 0, 1), '0.0%');
  assert.equal(getCell(t, 0, 2)?.value, '  deux   espaces\tet tab');
  assert.equal(getCell(t, 5000, 3)?.value, 'loin');
  assert.equal(cellFont(back, getCell(t, 2, 2)).italic, true);
  assert.deepEqual(back.definedNames.map((d) => d.name), ['Zone', 'Taux']);
  assert.equal(back.definedNames[0]?.formula, 'Feuil1!$A$1:$B$2');
  assert.equal(back.definedNames[1]?.formula, '0.2*2');
});

test('OpenFormula <-> Excel et styles de nombre ODF', () => {
  assert.equal(excelToOdfFormula('SUM(A1:B2,Feuil2!C3)'), 'of:=SUM([.A1:.B2];[$Feuil2.C3])');
  assert.equal(odfToExcelFormula('of:=SUM([.A1:.B2];[$Feuil2.C3])'), 'SUM(A1:B2,Feuil2!C3)');
  assert.equal(odfToExcelFormula(excelToOdfFormula('IF(A1>0,"a;b","c")')), 'IF(A1>0,"a;b","c")');
  assert.equal(odfToExcelFormula("of:=['Ma feuille'.$A$1]"), "'Ma feuille'!$A$1");
  assert.equal(numberStyleXml('N1', 'General'), undefined);
  assert.match(numberStyleXml('N1', '0.00%') ?? '', /percentage-style.*decimal-places="2"/);
  assert.match(numberStyleXml('N1', '#,##0') ?? '', /grouping="true"/);
  assert.match(numberStyleXml('N1', 'dd/mm/yyyy') ?? '', /<number:day number:style="long"\/><number:text>\/<\/number:text><number:month number:style="long"\/>/);
  assert.match(numberStyleXml('N1', 'hh:mm:ss') ?? '', /<number:hours number:style="long"\/><number:text>:<\/number:text><number:minutes number:style="long"\/>/);
  assert.match(numberStyleXml('N1', '@') ?? '', /text-content/);
  assert.match(numberStyleXml('N1', '0.00E+00') ?? '', /scientific-number/);
});

test('ods endommages : erreurs francaises', async () => {
  await assert.rejects(readOds(new Uint8Array([1, 2, 3])), SpreadsheetError);
  const noContent = new JSZip();
  noContent.file('mimetype', 'application/vnd.oasis.opendocument.spreadsheet');
  await assert.rejects(readOds(await noContent.generateAsync({ type: 'uint8array' })), SpreadsheetError);
  const badXml = new JSZip();
  badXml.file('mimetype', 'application/vnd.oasis.opendocument.spreadsheet');
  badXml.file('content.xml', '<office:document-content><office:body><table:table');
  await assert.rejects(readOds(await badXml.generateAsync({ type: 'uint8array' })), SpreadsheetError);
  const empty = new JSZip();
  empty.file('mimetype', 'application/vnd.oasis.opendocument.spreadsheet');
  empty.file('content.xml', '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"><office:body><office:spreadsheet/></office:body></office:document-content>');
  await assert.rejects(readOds(await empty.generateAsync({ type: 'uint8array' })), SpreadsheetError);
  // Repetitions gigantesques bornees (pas de boucle sur 2^31 lignes).
  const huge = new JSZip();
  huge.file('mimetype', 'application/vnd.oasis.opendocument.spreadsheet');
  huge.file('content.xml', '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:spreadsheet><table:table table:name="T"><table:table-row table:number-rows-repeated="2000000000"><table:table-cell table:number-columns-repeated="2000000000"/></table:table-row><table:table-row><table:table-cell office:value-type="string"><text:p>fin</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet></office:body></office:document-content>');
  const wb = await readOds(await huge.generateAsync({ type: 'uint8array' }));
  assert.equal(wb.sheets[0]?.cells.size, 0);
});

test('readWorkbook / writeWorkbook : ods par signature', async () => {
  const bytes = await writeWorkbook(richWorkbook(), 'ods');
  const wb = await readWorkbook(bytes, 'sans-extension');
  assert.equal(wb.sourceFormat, 'ods');
  assert.equal(getCell(wb.sheets[0]!, 0, 0)?.value, 'Produit');
});
