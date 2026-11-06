// CELLULE (format, parentheses, couleur, prefixe, largeur, protection, nomfichier) et INFORMATIONS : valeurs relevees dans Excel 365.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FormulaEngine, type CellStyleInfo } from '../src/index.ts';
import { cellFormatInfo } from '../src/functions/cell-format.ts';

describe('CELLULE("format")', () => {
  // [format canonique, code anglais, code francais releve dans Excel 365, parentheses, couleur]
  const table: [string, string, string, number, number][] = [
    ['General', 'G', 'S', 0, 0],
    ['0', 'F0', 'F0', 0, 0],
    ['0.0', 'F1', 'F1', 0, 0],
    ['0.00', 'F2', 'F2', 0, 0],
    ['#,##0', ',0', 'P0', 0, 0],
    ['#,##0.00', ',2', 'P2', 0, 0],
    ['0%', 'P0', '%0', 0, 0],
    ['0.00%', 'P2', '%2', 0, 0],
    ['0.0%', 'P1', '%1', 0, 0],
    ['0.00E+00', 'S2', 'S2', 0, 0],
    ['0E+00', 'S0', 'S0', 0, 0],
    ['@', 'G', 'S', 0, 0],
    ['#,##0\\ "€"_);(#,##0\\ "€")', 'C0', 'M0', 0, 0],
    ['#,##0\\ "€"_);[Red](#,##0\\ "€")', 'C0-', 'M0-', 0, 1],
    ['#,##0.00\\ "€"_);(#,##0.00\\ "€")', 'C2', 'M2', 0, 0],
    ['$#,##0.00_);[Red]($#,##0.00)', 'C2-', 'M2-', 0, 1],
    ['0;[Red]0', 'F0-', 'F0-', 0, 1],
    ['0.00;[Red]-0.00', 'F2-', 'F2-', 0, 1],
    ['0_);(0)', 'F0', 'F0', 0, 0],
    ['(0)', 'F0', 'F0', 1, 0],
    ['d-mmm-yy', 'D1', 'D1', 0, 0],
    ['d-mmm', 'D2', 'D2', 0, 0],
    ['mmm-yy', 'D3', 'D3', 0, 0],
    ['dd/mm/yy', 'D1', 'D1', 0, 0],
    ['dd/mm/yyyy', 'D1', 'D1', 0, 0],
    ['mm/dd/yy', 'D4', 'D4', 0, 0],
    ['m/d/yy h:mm', 'D4', 'D4', 0, 0],
    ['dd/mm', 'D2', 'D2', 0, 0],
    ['mm/dd', 'D5', 'D5', 0, 0],
    ['hh:mm:ss AM/PM', 'D6', 'H1', 0, 0],
    ['h:mm AM/PM', 'D7', 'H2', 0, 0],
    ['hh:mm:ss', 'D8', 'H3', 0, 0],
    ['hh:mm', 'D9', 'H4', 0, 0],
    ['h:mm', 'D9', 'H4', 0, 0],
    ['yyyy-mm-dd', 'G', 'S', 0, 0],
    ['[h]:mm:ss', 'G', 'S', 0, 0],
    ['mm:ss', 'G', 'S', 0, 0],
    ['mmmm', 'G', 'S', 0, 0],
    ['dddd', 'G', 'S', 0, 0],
    ['0 "kg"', 'F0', 'F0', 0, 0],
    ['000000', 'F0', 'F0', 0, 0],
  ];
  for (const [fmt, en, fr, par, col] of table) {
    test(fmt, () => {
      assert.deepEqual(cellFormatInfo(fmt, false), { code: en, parentheses: par, color: col });
      assert.deepEqual(cellFormatInfo(fmt, true), { code: fr, parentheses: par, color: col });
    });
  }
});

describe('CELLULE et INFORMATIONS dans le classeur', () => {
  const styles = new Map<string, CellStyleInfo>([
    ['Feuil1!0,0', { numFmt: '#,##0.00', locked: false, align: 'right' }],
    ['Feuil1!1,0', { numFmt: '0;[Red]0' }],
    ['Feuil1!2,0', { align: 'center' }],
    ['Feuil1!3,0', { align: 'fill' }],
    ['Feuil1!4,0', { align: 'left' }],
  ]);
  function book(locale: 'en-US' | 'fr-FR'): FormulaEngine {
    const e = new FormulaEngine({
      locale,
      host: {
        fileName: 'C:\\Docs\\Budget.xlsx',
        directory: 'C:\\Docs\\',
        cellStyle: (sh, r, c) => styles.get(`${sh}!${r},${c}`),
        columnWidth: (_sh, c) => (c === 0 ? 20 : c === 1 ? 12.7 : undefined),
      },
    });
    e.addSheet('Feuil1');
    for (let r = 0; r < 5; r++) e.setCell('Feuil1', { row: r, col: 0 }, 'texte');
    return e;
  }
  const ev = (e: FormulaEngine, f: string): unknown => e.evaluate(f, 'Feuil1');

  test('format, parentheses, couleur, protection, prefixe, largeur', () => {
    const e = book('en-US');
    assert.equal(ev(e, 'CELL("format",A1)'), ',2');
    assert.equal(ev(e, 'CELL("format",A2)'), 'F0-');
    assert.equal(ev(e, 'CELL("color",A2)'), 1);
    assert.equal(ev(e, 'CELL("parentheses",A2)'), 0);
    assert.equal(ev(e, 'CELL("format",B9)'), 'G');
    assert.equal(ev(e, 'CELL("protect",A1)'), 0);
    assert.equal(ev(e, 'CELL("protect",A2)'), 1);
    assert.deepEqual(
      [ev(e, 'CELL("prefix",A1)'), ev(e, 'CELL("prefix",A3)'), ev(e, 'CELL("prefix",A4)'), ev(e, 'CELL("prefix",A5)'), ev(e, 'CELL("prefix",A2)')],
      ['"', '^', '\\', "'", "'"],
    );
    assert.equal(ev(e, 'CELL("prefix",B9)'), '');
    assert.equal(ev(e, 'CELL("width",A1)'), 20);
    assert.equal(ev(e, 'CELL("width",B1)'), 13);
    assert.equal(ev(e, 'CELL("width",C1)'), 8);
    assert.equal(ev(e, 'CELL("type",Z9)'), 'b');
  });

  test('syntaxe francaise : codes et noms francais', () => {
    const e = book('fr-FR');
    assert.equal(e.evaluate('CELLULE("format";A1)', 'Feuil1', 'fr'), 'P2');
    assert.equal(e.evaluate('CELLULE("couleur";A2)', 'Feuil1', 'fr'), 1);
    assert.equal(e.evaluate('CELLULE("type";Z9)', 'Feuil1', 'fr'), 'i');
    assert.equal(e.evaluate('CELLULE("protege";A1)', 'Feuil1', 'fr'), 0);
  });

  test('nom de fichier, plage de plusieurs cellules, valeurs inconnues', () => {
    const e = book('en-US');
    assert.equal(ev(e, 'CELL("filename",A1)'), 'C:\\Docs\\[Budget.xlsx]Feuil1');
    assert.equal(ev(e, 'CELL("row",B3:C9)'), 3);
    assert.equal(ev(e, 'CELL("col",B3:C9)'), 2);
    assert.equal(String(ev(e, 'CELL("nimporte",A1)')), '#VALUE!');
    const plain = new FormulaEngine({ locale: 'en-US' });
    plain.addSheet('S');
    assert.equal(plain.evaluate('CELL("filename",A1)', 'S'), '');
    assert.equal(plain.evaluate('CELL("format",A1)', 'S'), 'G');
  });

  test('INFORMATIONS', () => {
    const e = book('en-US');
    assert.equal(ev(e, 'INFO("directory")'), 'C:\\Docs\\');
    assert.equal(ev(e, 'INFO("numfile")'), 1);
    assert.equal(ev(e, 'INFO("origin")'), '$A:$A$1');
    assert.equal(ev(e, 'INFO("osversion")'), 'Windows (64-bit) NT 10.00');
    assert.equal(ev(e, 'INFO("release")'), '16.0');
    assert.equal(ev(e, 'INFO("system")'), 'pcdos');
    assert.equal(ev(e, 'INFO("recalc")'), 'Automatic');
    assert.equal(String(ev(e, 'INFO("memavail")')), '#N/A');
  });

  test('CELLULE suit le style fourni par l hote a chaque recalcul', () => {
    const e = book('en-US');
    e.setFormula('Feuil1', 'D1', 'CELL("format",A1)');
    assert.equal(e.getValue('Feuil1', 'D1'), ',2');
    styles.set('Feuil1!0,0', { numFmt: '0%' });
    e.recalculate();
    assert.equal(e.getValue('Feuil1', 'D1'), 'P0');
  });
});
