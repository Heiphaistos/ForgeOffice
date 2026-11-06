// Recalcul partiel apres changement structurel : le resultat doit etre identique au recalcul complet.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FormulaEngine, type Scalar } from '../src/index.ts';

function snapshot(e: FormulaEngine, rows: number, cols: number): string[] {
  const out: string[] = [];
  for (const sh of e.sheetNames()) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) out.push(`${sh}!${r},${c}=${String((e.getValue(sh, { row: r, col: c }) as Scalar) ?? '')}`);
    }
  }
  return out;
}

function build(): FormulaEngine {
  const e = new FormulaEngine({ locale: 'en-US' });
  for (const n of ['Un', 'Deux', 'Trois']) e.addSheet(n);
  e.batch(() => {
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 3; c++) {
        e.setCell('Un', { row: r, col: c }, r * 3 + c + 1);
        e.setCell('Deux', { row: r, col: c }, (r + 1) * 10 + c);
      }
    }
    e.setFormula('Un', 'E1', 'SUM(A:A)');
    e.setFormula('Un', 'E2', 'SUM(Deux!A2:B5)');
    e.setFormula('Un', 'E3', 'INDEX(Deux!A1:C12,MATCH(23,Deux!A1:A12,0)+1,2)');
    e.setFormula('Un', 'E4', 'ROW()+COLUMN()');
    e.setFormula('Un', 'E5', 'SUM(OFFSET(A1,2,1,3,1))');
    e.setFormula('Un', 'E6', 'INDIRECT("Deux!B3")');
    e.setFormula('Un', 'E7', 'SUM(Un:Trois!A1)');
    e.setFormula('Un', 'E8', 'Total+1');
    e.setFormula('Un', 'G1', 'SEQUENCE(3,2)');
    e.setFormula('Un', 'E9', 'SUM(G1:H3)');
    e.setFormula('Deux', 'E1', 'Un!E1*2');
    e.setFormula('Deux', 'E2', 'COUNTA(Un!1:12)');
    e.setFormula('Trois', 'A1', 'Deux!E1+Un!E2');
    e.setFormula('Trois', 'A2', 'SUM(Trois!A1:A1)+SHEETS()');
    e.defineName('Total', 'SUM(Un!A1:A6)');
    e.defineName('Zone', 'Deux!B2:B5');
    e.setFormula('Trois', 'A3', 'SUM(Zone)');
  });
  return e;
}

describe('recalcul partiel', () => {
  test('insertions, suppressions, feuilles et noms : memes valeurs que le recalcul complet', () => {
    let seed = 7;
    const rnd = (n: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    for (let round = 0; round < 150; round++) {
      const e = build();
      const ops: string[] = [];
      for (let step = 0; step < 5; step++) {
        const sheets = e.sheetNames();
        const sh = sheets[rnd(sheets.length)] ?? 'Un';
        const op = rnd(9);
        ops.push(`${op}:${sh}`);
        if (op === 0) e.insertRows(sh, rnd(10), 1 + rnd(2));
        else if (op === 1) e.deleteRows(sh, rnd(10), 1 + rnd(2));
        else if (op === 2) e.insertColumns(sh, rnd(3), 1);
        else if (op === 3) e.deleteColumns(sh, rnd(3), 1);
        else if (op === 4) e.addSheet(`Neuf${round}${step}`);
        else if (op === 5 && sheets.length > 2) e.removeSheet(sh);
        else if (op === 6) e.renameSheet(sh, `R${round}${step}`);
        else if (op === 7) e.defineName('Total', `SUM(${sheets[0] ?? 'Un'}!B1:B3)`);
        else e.setCell(sh, { row: rnd(12), col: rnd(3) }, rnd(100));
      }
      const partial = snapshot(e, 14, 10);
      e.recalculateAll();
      const full = snapshot(e, 14, 10);
      assert.deepEqual(partial, full, `tour ${round} ${ops.join(' ')}`);
    }
  });

  test('une feuille sans lien avec la feuille modifiee garde ses valeurs sans etre recalculee', () => {
    let calls = 0;
    const e = new FormulaEngine({ locale: 'en-US', random: () => (calls++, 0.5) });
    e.addSheet('Source');
    e.addSheet('Autre');
    e.setCell('Autre', 'A1', 4);
    e.setFormula('Autre', 'B1', 'A1*2');
    e.setFormula('Source', 'A1', 'SUM(A2:A4)');
    e.setFormula('Autre', 'C1', 'B1+1');
    e.insertRows('Source', 0, 3);
    assert.equal(e.getValue('Autre', 'C1'), 9);
    assert.equal(e.getFormula('Source', 'A4'), '=SUM(A5:A7)');
    e.addSheet('Nouvelle');
    e.setFormula('Autre', 'D1', 'Nouvelle!A1');
    e.setCell('Nouvelle', 'A1', 12);
    assert.equal(e.getValue('Autre', 'D1'), 12);
  });
});
