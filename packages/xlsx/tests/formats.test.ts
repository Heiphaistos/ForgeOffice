import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  cellFont, createBlankWorkbook, detectFormat, getCell, isDateCell, numberFormatCode, readWorkbook, readXlsx, setValue,
  SpreadsheetError, writeWorkbook, writeXlsx,
} from '../src/index.ts';

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Classeur xlsx minimal ecrit a la main (parties XML d'Excel), sheet1 personnalisable. */
async function handXlsx(sheetXml: string, extra: Record<string, string> = {}): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PKG_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${MAIN}" xmlns:r="${REL}"><workbookPr date1904="1"/><sheets><sheet name="Main ecrite" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="Taux">0.2</definedName><definedName name="_xlnm.Print_Area" localSheetId="0">'Main ecrite'!$A$1:$C$4</definedName></definedNames></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PKG_REL}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="${REL}/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${MAIN}" count="2" uniqueCount="2"><si><t>Partagee</t></si><si><r><rPr><b/><sz val="12"/><rFont val="Arial"/></rPr><t>Gras</t></r><r><t xml:space="preserve"> puis normal</t></r></si></sst>`);
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${MAIN}"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FFFF0000"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`);
  zip.file('xl/worksheets/sheet1.xml', sheetXml);
  for (const [path, content] of Object.entries(extra)) zip.file(path, content);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

const SHEET = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${MAIN}" xmlns:r="${REL}"><sheetViews><sheetView workbookViewId="0" zoomScale="85"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="2" max="3" width="15.5" customWidth="1"/></cols><sheetData>
<row r="1" ht="20" customHeight="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s" s="2"><v>1</v></c><c r="C1" t="inlineStr"><is><t>En ligne</t></is></c></row>
<row r="2"><c r="A2" s="1"><v>1462</v></c><c r="B2" t="b"><v>1</v></c><c r="C2" t="e"><v>#N/A</v></c><c r="D2"><f>_xlfn.XLOOKUP(1,A1:A3,B1:B3)</f><v>3</v></c></row>
<row r="3"><c r="A3"><f t="shared" ref="A3:A5" si="0">B3*2</f><v>2</v></c><c r="B3"><v>1</v></c></row>
<row r="4"><c r="A4"><f t="shared" si="0"/><v>4</v></c><c r="B4"><v>2</v></c></row>
<row r="5" hidden="1"><c r="A5"><f t="shared" si="0"/><v>6</v></c><c r="B5"><v>3</v></c><c r="C5" t="str"><f>"x"&amp;"y"</f><v>xy</v></c></row>
</sheetData><mergeCells count="1"><mergeCell ref="E1:F2"/></mergeCells><conditionalFormatting sqref="B3:B5"><cfRule type="cellIs" priority="1" operator="greaterThan"><formula>1</formula></cfRule></conditionalFormatting><dataValidations count="1"><dataValidation type="list" sqref="G1"><formula1>"a,b"</formula1></dataValidation></dataValidations></worksheet>`;

test('xlsx ecrit a la main : chaines partagees et en ligne, styles, formules, regles', async () => {
  const wb = await readXlsx(await handXlsx(SHEET));
  assert.equal(wb.date1904, true);
  const s = wb.sheets[0]!;
  assert.equal(s.name, 'Main ecrite');
  assert.equal(getCell(s, 0, 0)?.value, 'Partagee');
  assert.equal(getCell(s, 0, 1)?.value, 'Gras puis normal');
  assert.equal(getCell(s, 0, 1)?.rich?.[0]?.font?.bold, true);
  assert.equal(getCell(s, 0, 1)?.rich?.[0]?.font?.name, 'Arial');
  assert.equal(cellFont(wb, getCell(s, 0, 1)).size, 14);
  assert.equal(getCell(s, 0, 2)?.value, 'En ligne');
  assert.ok(isDateCell(wb, getCell(s, 1, 0)));
  assert.equal(numberFormatCode(wb.styles, wb.styles.cellXfs[getCell(s, 1, 0)?.styleId ?? 0]!.numFmtId), 'dd/mm/yyyy');
  assert.equal(getCell(s, 1, 1)?.value, true);
  assert.deepEqual(getCell(s, 1, 2)?.value, { error: '#N/A' });
  assert.equal(getCell(s, 1, 3)?.formula, 'XLOOKUP(1,A1:A3,B1:B3)');
  assert.equal(getCell(s, 2, 0)?.formula, 'B3*2');
  assert.deepEqual(getCell(s, 2, 0)?.shared, { index: 0, ref: { r1: 2, c1: 0, r2: 4, c2: 0 } });
  assert.deepEqual(getCell(s, 3, 0)?.shared, { index: 0 });
  assert.equal(getCell(s, 4, 2)?.value, 'xy');
  assert.equal(getCell(s, 4, 2)?.formula, '"x"&"y"');
  assert.equal(s.rows.get(0)?.height, 20);
  assert.equal(s.rows.get(4)?.hidden, true);
  assert.equal(s.cols[0]?.width, 15.5);
  assert.deepEqual(s.merges, [{ r1: 0, c1: 4, r2: 1, c2: 5 }]);
  assert.deepEqual(s.view.frozen, { rows: 1, cols: 0 });
  assert.equal(s.view.zoom, 85);
  assert.equal(s.conditionalFormats[0]?.rules[0]?.operator, 'greaterThan');
  assert.equal(s.dataValidations[0]?.formula1, '"a,b"');
  assert.deepEqual(s.pageSetup.printArea, [{ r1: 0, c1: 0, r2: 3, c2: 2 }]);
  assert.deepEqual(wb.definedNames, [{ name: 'Taux', formula: '0.2' }]);
});

test('detection du format par signature puis extension', async () => {
  const xlsx = await writeXlsx(createBlankWorkbook());
  assert.equal(detectFormat(xlsx), 'xlsx');
  assert.equal(detectFormat(xlsx, 'Modele.XLTX'), 'xltx');
  assert.equal(detectFormat(await writeWorkbook(createBlankWorkbook(), 'ods'), 'trompeur.xlsx'), 'ods');
  assert.equal(detectFormat(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Uint8Array(504)]), 'a.csv'), 'xls');
  assert.equal(detectFormat(new TextEncoder().encode('a;b'), 'donnees.tsv'), 'tsv');
  assert.equal(detectFormat(new TextEncoder().encode('a;b'), 'donnees.txt'), 'csv');
  const wb = createBlankWorkbook();
  setValue(wb.sheets[0]!, 0, 0, 'xlsm');
  const xlsm = await readWorkbook(await writeWorkbook(wb, 'xlsm'), 'macro.xlsm');
  assert.equal(xlsm.sourceFormat, 'xlsm');
  assert.equal(getCell(xlsm.sheets[0]!, 0, 0)?.value, 'xlsm');
  const csv = await readWorkbook(new TextEncoder().encode('x;1,5\n'), 'f.csv');
  assert.equal(getCell(csv.sheets[0]!, 0, 1)?.value, 1.5);
});

test('xlsx endommages : zip illisible, partie manquante, XML invalide, DOCTYPE, bombe zip', async () => {
  const fails = async (bytes: Uint8Array, name = 'f.xlsx'): Promise<void> => {
    await assert.rejects(readWorkbook(bytes, name), (error: unknown) => error instanceof SpreadsheetError && error.message.length > 0);
  };
  await fails(new Uint8Array(0));
  await fails(Uint8Array.from([0x50, 0x4b, 3, 4, 1, 2, 3]));
  const good = await handXlsx(SHEET);
  await fails(good.slice(0, Math.floor(good.length / 2)));
  const noWorkbook = new JSZip();
  noWorkbook.file('[Content_Types].xml', '<Types/>');
  await fails(await noWorkbook.generateAsync({ type: 'uint8array' }));
  await fails(await handXlsx('<worksheet><sheetData><row r="1"><c r="A1"'));
  await fails(await handXlsx(`<?xml version="1.0"?><!DOCTYPE lol [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]><worksheet xmlns="${MAIN}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&b;</t></is></c></row></sheetData></worksheet>`));
  // Bombe zip : 4 Mo de zeros compresses, refuses au-dela de 1 Mo par entree.
  const bomb = await handXlsx(SHEET, { 'xl/media/bombe.bin': '\0'.repeat(4 * 1024 * 1024) });
  assert.ok(bomb.length < 100_000);
  const bombWithSheet = await handXlsx(`<worksheet xmlns="${MAIN}"><sheetData/>${' '.repeat(2 * 1024 * 1024)}</worksheet>`);
  await assert.rejects(readXlsx(bombWithSheet, { limits: { maxEntries: 100, maxEntryBytes: 1024 * 1024, maxTotalBytes: 8 * 1024 * 1024 } }), SpreadsheetError);
  // Chemins zip hostiles et references hors limites ignores sans plantage.
  const odd = await readXlsx(await handXlsx(`<worksheet xmlns="${MAIN}"><sheetData><row r="99999999"><c r="ZZZZ1"><v>1</v></c></row><row r="2"><c r="A2"><v>abc</v></c><c r="B2" t="n"><v>NaN</v></c></row></sheetData></worksheet>`));
  assert.ok(odd.sheets[0]!.cells.size <= 1);
});

test('corruption aleatoire (xls, xlsx, ods) : seule SpreadsheetError peut sortir', async () => {
  const { readFileSync } = await import('node:fs');
  let seed = 12345;
  const rand = (n: number): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };
  const sources: [string, Uint8Array][] = [
    ['a.xls', readFileSync(new URL('./fixtures/excel2024.xls', import.meta.url))],
    ['a.xlsx', await handXlsx(SHEET)],
    ['a.ods', await writeWorkbook(createBlankWorkbook(), 'ods')],
  ];
  let opened = 0;
  for (let i = 0; i < 240; i++) {
    const [name, source] = sources[i % sources.length]!;
    const bytes = source.slice();
    for (let k = 0, n = 1 + rand(20); k < n; k++) bytes[rand(bytes.length)] = rand(256);
    try {
      await readWorkbook(bytes, name);
      opened++;
    } catch (error) {
      assert.ok(error instanceof SpreadsheetError, `${name} #${i} : ${String(error)}`);
    }
  }
  assert.ok(opened > 0);
});
