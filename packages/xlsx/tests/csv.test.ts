import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlankWorkbook, decodeText, detectSeparator, encodeText, getCell, inspectCsv, isDateCell, numberFormatCode,
  parseCsvRows, parseLocaleNumber, putCell, readCsv, readWorkbook, serialToDate, setFormula, setValue, styleIdFor, writeCsv,
  writeWorkbook, type Workbook,
} from '../src/index.ts';

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const value = (wb: Workbook, row: number, col: number): unknown => getCell(wb.sheets[0]!, row, col)?.value;

test('csv : detection du separateur et analyse RFC 4180', () => {
  assert.equal(detectSeparator('a;b;c\n1;2;3\n'), ';');
  assert.equal(detectSeparator('a,b,c\n1,2,3\n'), ',');
  assert.equal(detectSeparator('a\tb\tc\n1\t2\t3\n'), '\t');
  assert.equal(detectSeparator('a|b|c\n1|2|3\n'), '|');
  assert.equal(detectSeparator('"x;y",b\n"z;w",c\n'), ',');
  assert.deepEqual(parseCsvRows('a;"b;c";"d ""e"""\r\n"multi\nligne";;f', ';'), [['a', 'b;c', 'd "e"'], ['multi\nligne', '', 'f']]);
  assert.deepEqual(parseCsvRows('', ';'), []);
  assert.deepEqual(parseCsvRows('seul', ';'), [['seul']]);
  assert.deepEqual(parseCsvRows('a;b\n', ';'), [['a', 'b']]);
});

test('csv : nombres francais et anglais, milliers, pourcentages, euros', () => {
  assert.equal(parseLocaleNumber('1 234,5', ','), 1234.5);
  assert.equal(parseLocaleNumber('1 234,5', ','), 1234.5);
  assert.equal(parseLocaleNumber('1.234,5', ','), 1234.5);
  assert.equal(parseLocaleNumber('1,234.5', '.'), 1234.5);
  assert.equal(parseLocaleNumber('-3,25e2', ','), -325);
  assert.equal(parseLocaleNumber('abc', ','), undefined);
  const wb = readCsv('Nom;Prix;Remise;Montant\nPommes;1,5;10 %;12,30 €\nPoires;2;5,5%;-4 €\n');
  assert.equal(value(wb, 1, 1), 1.5);
  assert.equal(value(wb, 1, 2), 0.1);
  assert.equal(value(wb, 2, 2), 0.055);
  assert.equal(value(wb, 1, 3), 12.3);
  assert.equal(value(wb, 2, 3), -4);
  const s = wb.sheets[0]!;
  assert.equal(numberFormatCode(wb.styles, wb.styles.cellXfs[getCell(s, 1, 2)?.styleId ?? 0]!.numFmtId), '0%');
  assert.equal(numberFormatCode(wb.styles, wb.styles.cellXfs[getCell(s, 2, 2)?.styleId ?? 0]!.numFmtId), '0.00%');
  const en = readCsv('a,b\n"1,234.5",2.75\n');
  assert.equal(value(en, 1, 0), 1234.5);
  assert.equal(value(en, 1, 1), 2.75);
});

test('csv : dates, booleens, erreurs, zeros initiaux, formules refusees par defaut', () => {
  const wb = readCsv('d;b;e;z;f\n25/12/2024;VRAI;#N/A;00123;=1+1\n2024-03-01 08:30;false;#DIV/0!;0;=SUM(A1)\n');
  const s = wb.sheets[0]!;
  assert.ok(isDateCell(wb, getCell(s, 1, 0)));
  assert.equal(serialToDate(value(wb, 1, 0) as number).toISOString().slice(0, 10), '2024-12-25');
  const withTime = serialToDate(value(wb, 2, 0) as number);
  assert.equal(withTime.toISOString().slice(0, 16), '2024-03-01T08:30');
  assert.equal(value(wb, 1, 1), true);
  assert.equal(value(wb, 2, 1), false);
  assert.deepEqual(value(wb, 1, 2), { error: '#N/A' });
  assert.equal(value(wb, 1, 3), '00123');
  assert.equal(value(wb, 2, 3), 0);
  assert.equal(value(wb, 1, 4), '=1+1');
  assert.equal(getCell(s, 1, 4)?.formula, undefined);
  const withFormulas = readCsv('=1+1;x\n', { formulas: true });
  assert.equal(getCell(withFormulas.sheets[0]!, 0, 0)?.formula, '1+1');
  const us = readCsv('03/04/2024\n', { dateOrder: 'MDY' });
  assert.equal(serialToDate(value(us, 0, 0) as number).toISOString().slice(0, 10), '2024-03-04');
  assert.equal(value(readCsv('31/02/2024\n'), 0, 0), '31/02/2024');
  const raw = readCsv('1,5;VRAI\n', { detectTypes: false });
  assert.equal(value(raw, 0, 0), '1,5');
});

test('csv : encodages UTF-8 (BOM), UTF-16, Windows-1252', () => {
  const utf8 = Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('é;€\n')]);
  assert.deepEqual(inspectCsv(utf8).info, { encoding: 'utf-8', bom: true, separator: ';', decimal: ',' });
  assert.equal(value(readCsv(utf8), 0, 1), '€');
  const cp1252 = Uint8Array.from([0x63, 0x61, 0x66, 0xe9, 0x3b, 0x80, 0x0a]);
  const decoded = decodeText(cp1252);
  assert.equal(decoded.encoding, 'windows-1252');
  assert.equal(decoded.text, 'café;€\n');
  assert.deepEqual([...encodeText('café;€', 'windows-1252', false)], [0x63, 0x61, 0x66, 0xe9, 0x3b, 0x80]);
  const le = encodeText('Ω;b\n', 'utf-16le', true);
  assert.equal(decodeText(le).encoding, 'utf-16le');
  assert.equal(value(readCsv(le), 0, 0), 'Ω');
  const be = encodeText('x;y\n', 'utf-16be', true);
  assert.equal(decodeText(be).text, 'x;y\n');
});

test('csv : ecriture francaise, guillemets, dates, injection, TSV', async () => {
  const wb = createBlankWorkbook();
  const s = wb.sheets[0]!;
  setValue(s, 0, 0, 'Texte; avec "guillemets"');
  setValue(s, 0, 1, 1234.5);
  setValue(s, 0, 2, true);
  putCell(s, 0, 3, { value: 45658, styleId: styleIdFor(wb, { numberFormat: 'dd/mm/yyyy' }) });
  setValue(s, 1, 0, '=HYPERLINK("http://x")');
  setFormula(s, 1, 1, 'B1*2', 2469);
  putCell(s, 1, 2, { value: { error: '#REF!' } });
  setValue(s, 2, 4, ' bord ');
  const fr = text(writeCsv(wb, s, { bom: false, escapeFormulas: true }));
  assert.equal(fr, '"Texte; avec ""guillemets""";1234,5;VRAI;01/01/2025;\r\n"\'=HYPERLINK(""http://x"")";2469;#REF!;;\r\n;;;;" bord "\r\n');
  const withBom = writeCsv(wb, s);
  assert.deepEqual([...withBom.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const en = text(writeCsv(wb, s, { separator: ',', decimal: '.', locale: 'en', lineEnding: '\n', bom: false, writeFormulas: true }));
  assert.equal(en.split('\n')[0], '"Texte; avec ""guillemets""",1234.5,TRUE,01/01/2025,');
  assert.equal(en.split('\n')[1], '"=HYPERLINK(""http://x"")",=B1*2,#REF!,,');
  const tsv = text(await writeWorkbook(wb, 'tsv', { csv: { bom: false } }));
  assert.ok(tsv.startsWith('"Texte; avec ""guillemets"""\t1234,5\tVRAI'), tsv);
  const back = await readWorkbook(new TextEncoder().encode(tsv), 'export.tsv');
  assert.equal(value(back, 0, 0), 'Texte; avec "guillemets"');
  assert.equal(value(back, 0, 1), 1234.5);
  // Feuille vide : seulement le BOM UTF-8.
  assert.equal(writeCsv(createBlankWorkbook(), createBlankWorkbook().sheets[0]!).length, 3);
});

test('csv : aller-retour d’un gros fichier (50 000 lignes, 200 000 cellules) rapide', () => {
  const lines = ['id;nom;montant;date'];
  for (let i = 0; i < 50_000; i++) lines.push(`${i};Client ${i % 97};${(i * 1.25).toFixed(2).replace('.', ',')};0${(i % 9) + 1}/0${(i % 9) + 1}/2024`);
  const start = performance.now();
  const wb = readCsv(lines.join('\r\n'));
  const out = writeCsv(wb, wb.sheets[0]!);
  const elapsed = performance.now() - start;
  assert.equal(wb.sheets[0]!.cells.size, 50_001);
  assert.equal(value(wb, 50_000, 2), 49_999 * 1.25);
  assert.ok(out.length > 1_500_000);
  assert.ok(elapsed < 5000, `${Math.round(elapsed)} ms`);
});
