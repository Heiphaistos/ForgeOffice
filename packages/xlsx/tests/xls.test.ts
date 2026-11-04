import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cellFont, getCell, isDateCell, numberFormatCode, readWorkbook, readXls, readXlsx, SpreadsheetError, strings, writeXlsx,
  type Workbook,
} from '../src/index.ts';
import { bof, buildCfb, buildXls, EOF, f64, latin, rec, u16, u32, utf16 } from './biff-builder.ts';

const fixture = (): Uint8Array => readFileSync(new URL('./fixtures/excel2024.xls', import.meta.url));

function formatOf(wb: Workbook, sheet: number, row: number, col: number): string {
  const cell = getCell(wb.sheets[sheet]!, row, col);
  return numberFormatCode(wb.styles, wb.styles.cellXfs[cell?.styleId ?? 0]?.numFmtId ?? 0);
}

test('xls enregistre par Excel 365 : feuilles, valeurs, chaines, formules', () => {
  const wb = readXls(fixture());
  assert.equal(wb.sourceFormat, 'xls');
  assert.deepEqual(wb.sheets.map((s) => [s.name, s.state]), [['Ventes', 'visible'], ['Donnees 2024', 'visible'], ['Cachee', 'hidden']]);
  const s = wb.sheets[0]!;
  assert.equal(getCell(s, 0, 0)?.value, 'Produit');
  assert.equal(getCell(s, 1, 1)?.value, 10);
  assert.equal(getCell(s, 1, 2)?.value, 1.5);
  assert.equal(getCell(s, 3, 5)?.value, 123456789);
  assert.equal(getCell(s, 4, 5)?.value, -0.125);
  assert.equal(getCell(s, 2, 5)?.value, 'Texte "cite" et accents : éèàç €');
  assert.deepEqual(getCell(s, 1, 3), { value: 15, formula: 'B2*C2', styleId: getCell(s, 1, 3)?.styleId });
  assert.equal(getCell(s, 5, 3)?.formula, 'SUM(D2:D5)');
  assert.equal(getCell(s, 5, 3)?.value, 350);
  assert.equal(getCell(s, 1, 4)?.formula, 'IF(B2>15,"grand","petit")');
  assert.equal(getCell(s, 1, 4)?.value, 'petit');
  assert.equal(getCell(s, 2, 4)?.formula, "'Donnees 2024'!A1*2");
  assert.equal(getCell(s, 2, 4)?.value, 42);
  assert.equal(getCell(s, 3, 4)?.formula, 'VLOOKUP("Kiwis",A2:C5,3,FALSE)');
  assert.deepEqual(getCell(s, 4, 4)?.value, { error: '#DIV/0!' });
  assert.equal(getCell(s, 5, 4)?.value, true);
  assert.equal(getCell(s, 1, 6)?.formula, 'B2:B3*2');
  assert.deepEqual(getCell(s, 1, 6)?.array, { ref: { r1: 1, c1: 6, r2: 2, c2: 6 } });
  assert.equal(getCell(s, 2, 6)?.formula, undefined);
  const d = wb.sheets[1]!;
  assert.equal(getCell(d, 0, 1)?.formula, 'SUM(Ventes!B2:B5)+Quantites');
  assert.equal(getCell(d, 1, 1)?.formula, 'IFERROR(1/0,"erreur")');
  assert.equal(getCell(d, 1, 1)?.value, 'erreur');
  assert.equal(getCell(d, 2, 1)?.formula, 'CONCATENATE("a","b")&TEXT(A1,"0.0")');
  assert.equal(getCell(d, 1, 0)?.value, true);
  // Formule partagee D1:D40 developpee cellule par cellule.
  assert.equal(getCell(d, 0, 3)?.formula, 'C1+$A$1');
  assert.equal(getCell(d, 39, 3)?.formula, 'C40+$A$1');
  assert.equal(getCell(wb.sheets[2]!, 0, 0)?.value, 'secret');
  assert.deepEqual(wb.definedNames, [{ name: 'Quantites', formula: 'Ventes!$B$2:$B$5' }]);
});

test('xls : styles, formats, texte enrichi, mise en page', () => {
  const wb = readXls(fixture());
  const s = wb.sheets[0]!;
  const a1 = cellFont(wb, getCell(s, 0, 0));
  assert.equal(a1.name, 'Aptos Narrow');
  assert.equal(a1.size, 11);
  assert.equal(a1.bold, true);
  assert.equal(a1.italic, true);
  assert.deepEqual(cellFont(wb, getCell(s, 1, 0)).color, { indexed: 10 });
  const xf = wb.styles.cellXfs[getCell(s, 0, 1)?.styleId ?? 0]!;
  assert.deepEqual(wb.styles.fills[xf.fillId], { type: 'pattern', pattern: 'solid', fg: { indexed: 13 } });
  assert.equal(wb.styles.borders[xf.borderId]?.bottom?.style, 'medium');
  assert.equal(formatOf(wb, 0, 4, 5), '0.00%');
  assert.ok(isDateCell(wb, getCell(s, 1, 5)));
  assert.equal(wb.styles.cellXfs[getCell(s, 0, 7)?.styleId ?? 0]?.alignment?.horizontal, 'center');
  assert.deepEqual(s.merges, [{ r1: 0, r2: 0, c1: 7, c2: 8 }]);
  assert.equal(Math.round(s.cols[0]!.width! * 100) / 100, 20.71);
  assert.equal(s.rows.get(0)?.height, 30);
  assert.equal(s.rows.get(7)?.hidden, true);
  assert.deepEqual(s.view.frozen, { rows: 1, cols: 0 });
  assert.equal(s.view.zoom, 120);
  assert.equal(s.pageSetup.orientation, 'landscape');
  assert.equal(wb.activeSheet, 0);
  const rich = getCell(wb.sheets[1]!, 0, 4)!;
  assert.equal(rich.value, 'Gras normal');
  assert.equal(rich.rich?.[0]?.text, 'Gras');
  assert.equal(rich.rich?.[1]?.font?.bold, undefined);
  assert.equal(cellFont(wb, rich).bold, true);
});

test('xls -> xlsx : conversion conservee a l’aller-retour', async () => {
  const wb = await readWorkbook(fixture(), 'ancien.xls');
  const back = await readXlsx(await writeXlsx(wb));
  assert.equal(back.sheets.length, 3);
  assert.equal(getCell(back.sheets[0]!, 3, 4)?.formula, 'VLOOKUP("Kiwis",A2:C5,3,FALSE)');
  assert.equal(getCell(back.sheets[1]!, 39, 3)?.formula, 'C40+$A$1');
  assert.equal(back.sheets[2]!.state, 'hidden');
  assert.equal(cellFont(back, getCell(back.sheets[0]!, 0, 0)).bold, true);
});

test('xls synthetique : RK, MULRK, SST sur CONTINUE, chaine de resultat, formules partagees', () => {
  const sst = [
    ...rec(0x00fc, [...u32(3), ...u32(3),
      ...u16(5), 0, ...latin('Alpha'),
      // « Été long » : debut 8 bits puis suite en UTF-16 apres CONTINUE.
      ...u16(8), 0, ...latin('Ét')]),
    ...rec(0x003c, [1, ...utf16('é long'), ...u16(3), 1, ...utf16('Ωmg')]),
  ];
  const rk = (n: number): number[] => u32(((n << 2) | 2) >>> 0);
  const sheet = [
    rec(0x027e, [...u16(0), ...u16(0), ...u16(0), ...rk(42)]),
    rec(0x027e, [...u16(0), ...u16(1), ...u16(0), ...u32((((1234 << 2) | 3)) >>> 0)]),
    rec(0x00bd, [...u16(1), ...u16(0), ...u16(0), ...rk(-7), ...u16(0), ...rk(8), ...u16(1)]),
    rec(0x00fd, [...u16(2), ...u16(0), ...u16(0), ...u32(1)]),
    rec(0x00fd, [...u16(2), ...u16(1), ...u16(0), ...u32(2)]),
    rec(0x0203, [...u16(3), ...u16(0), ...u16(0), ...f64(Math.PI)]),
    rec(0x0205, [...u16(3), ...u16(1), ...u16(0), 0x2a, 1]),
    // A5 = SUM(A1:B1) ; resultat texte via STRING.
    rec(0x0006, [...u16(4), ...u16(0), ...u16(0), 0, 0, 0, 0, 0, 0, 0xff, 0xff, ...u16(0), ...u32(0), ...u16(13),
      0x25, ...u16(0), ...u16(0), ...u16(0xc000), ...u16(0xc001), 0x42, 1, ...u16(4)]),
    rec(0x0207, [...u16(2), 0, ...latin('ok')]),
    // C2:C3 = formule partagee « B2+1 » (references relatives ptgRefN).
    rec(0x0006, [...u16(1), ...u16(2), ...u16(0), ...f64(2), ...u16(8), ...u32(0), ...u16(5), 0x01, ...u16(1), ...u16(2)]),
    rec(0x04bc, [...u16(1), ...u16(2), 2, 2, 0, 2, ...u16(9), 0x2c, ...u16(0), ...u16(0xc0ff), 0x1e, ...u16(1), 0x03]),
    rec(0x0006, [...u16(2), ...u16(2), ...u16(0), ...f64(3), ...u16(8), ...u32(0), ...u16(5), 0x01, ...u16(1), ...u16(2)]),
    rec(0x00e5, [...u16(1), ...u16(5), ...u16(6), ...u16(0), ...u16(2)]),
    rec(0x0055, u16(10)),
  ];
  const wb = readXls(buildXls([[...rec(0x0022, u16(1))], sst], [{ name: 'Donnees', body: sheet }, { name: 'Vide', body: [], hidden: true }]));
  const s = wb.sheets[0]!;
  assert.equal(wb.date1904, true);
  assert.equal(getCell(s, 0, 0)?.value, 42);
  assert.equal(getCell(s, 0, 1)?.value, 12.34);
  assert.equal(getCell(s, 1, 0)?.value, -7);
  assert.equal(getCell(s, 1, 1)?.value, 8);
  assert.equal(getCell(s, 2, 0)?.value, 'Été long');
  assert.equal(getCell(s, 2, 1)?.value, 'Ωmg');
  assert.equal(getCell(s, 3, 0)?.value, Math.PI);
  assert.deepEqual(getCell(s, 3, 1)?.value, { error: '#N/A' });
  assert.equal(getCell(s, 4, 0)?.formula, 'SUM(A1:B1)');
  assert.equal(getCell(s, 4, 0)?.value, 'ok');
  assert.equal(getCell(s, 1, 2)?.formula, 'B2+1');
  assert.equal(getCell(s, 2, 2)?.formula, 'B3+1');
  assert.deepEqual(s.merges, [{ r1: 5, r2: 6, c1: 0, c2: 2 }]);
  assert.equal(s.baseColWidth, 10);
  assert.equal(wb.sheets[1]!.state, 'hidden');
});

test('xls endommages ou non pris en charge : erreurs francaises, jamais de plantage', async () => {
  const reject = (bytes: Uint8Array, message?: string): void => {
    assert.throws(() => readXls(bytes), (error: unknown) => error instanceof SpreadsheetError && (!message || error.message.startsWith(message)));
  };
  const good = fixture();
  reject(good.slice(0, 600), strings.cfbInvalid);
  reject(Uint8Array.from([...good.slice(0, 512), ...new Uint8Array(512).fill(0xff)]));
  // Chaines de secteurs bouclees : chaque entree de la FAT pointe sur elle-meme.
  const loop = good.slice();
  const lv = new DataView(loop.buffer);
  const fatAt = (lv.getUint32(0x4c, true) + 1) * 512;
  for (let i = 0; i < 128; i++) if (lv.getUint32(fatAt + i * 4, true) < 0xfffffffa) lv.setUint32(fatAt + i * 4, i, true);
  reject(loop, strings.cfbInvalid);
  reject(buildCfb('Workbook', Uint8Array.from([...bof(0x0005), ...rec(0x002f, [0, 0]), ...EOF])), strings.xlsEncrypted);
  reject(buildCfb('Book', Uint8Array.from([...bof(0x0005, 0x0500), ...EOF])), strings.xlsTooOld);
  reject(buildCfb('Workbook', Uint8Array.from([...bof(0x0005, 0x0500), ...EOF])), strings.xlsTooOld);
  reject(buildCfb('Workbook', Uint8Array.from(rec(0x0009, [0, 0, 0, 0]))), strings.xlsTooOld);
  reject(buildCfb('Autre', new Uint8Array(10)), strings.xlsInvalid);
  reject(buildCfb('EncryptedPackage', new Uint8Array(10)), strings.xlsEncrypted);
  reject(buildXls([], []), strings.noSheets);
  // Enregistrements tronques : lecture partielle sans exception non controlee.
  const truncated = buildXls([], [{ name: 'A', body: [rec(0x0203, [...u16(0), ...u16(0), ...u16(0), 1, 2]), rec(0x00fd, [1])] }]);
  assert.equal(readXls(truncated).sheets[0]?.cells.size, 0);
  await assert.rejects(readWorkbook(good.slice(0, 2000), 'x.xls'), SpreadsheetError);
});
