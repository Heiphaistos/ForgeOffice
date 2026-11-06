// Mode de calcul (automatique, manuel, iteratif), Maj+F9 et audit des formules (antecedents / dependants).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FormulaEngine } from '../src/index.ts';

function book(options: ConstructorParameters<typeof FormulaEngine>[0] = {}): FormulaEngine {
  const e = new FormulaEngine({ locale: 'en-US', ...options });
  e.addSheet('S1');
  e.addSheet('S2');
  return e;
}

describe('mode manuel', () => {
  test('une cellule saisie se calcule, ses dependants restent obsoletes jusqu au calcul', () => {
    const e = book();
    e.setCell('S1', 'A1', 1);
    e.setFormula('S1', 'B1', 'A1*2');
    e.setFormula('S1', 'C1', 'B1+1');
    assert.equal(e.getValue('S1', 'C1'), 3);
    e.setCalcSettings({ mode: 'manual' });
    e.setCell('S1', 'A1', 10);
    assert.equal(e.getValue('S1', 'B1'), 2, 'B1 obsolete');
    assert.equal(e.getValue('S1', 'C1'), 3, 'C1 obsolete');
    assert.equal(e.pendingCalculation, true);
    e.setFormula('S1', 'D1', 'A1+1');
    assert.equal(e.getValue('S1', 'D1'), 11, 'une formule saisie est calculee');
    assert.equal(e.getValue('S1', 'B1'), 2);
    e.recalculate();
    assert.equal(e.getValue('S1', 'B1'), 20);
    assert.equal(e.getValue('S1', 'C1'), 21);
    assert.equal(e.pendingCalculation, false);
  });

  test('les fonctions volatiles ne bougent qu au calcul', () => {
    let n = 0;
    const e = book({ random: () => ++n / 1000 });
    e.setFormula('S1', 'A1', 'RAND()');
    const first = e.getValue('S1', 'A1');
    e.setCalcSettings({ mode: 'manual' });
    e.setCell('S1', 'B1', 5);
    assert.equal(e.getValue('S1', 'A1'), first);
    e.recalculate();
    assert.notEqual(e.getValue('S1', 'A1'), first);
  });

  test('revenir en automatique calcule ce qui attendait', () => {
    const e = book();
    e.setCell('S1', 'A1', 1);
    e.setFormula('S1', 'B1', 'A1+1');
    e.setCalcSettings({ mode: 'manual' });
    e.setCell('S1', 'A1', 7);
    assert.equal(e.getValue('S1', 'B1'), 2);
    e.setCalcSettings({ mode: 'auto' });
    assert.equal(e.getValue('S1', 'B1'), 8);
    e.setCell('S1', 'A1', 9);
    assert.equal(e.getValue('S1', 'B1'), 10, 'de nouveau automatique');
  });

  test('Maj+F9 ne calcule que la feuille', () => {
    const e = book();
    e.setCell('S1', 'A1', 1);
    e.setFormula('S1', 'B1', 'A1+1');
    e.setFormula('S2', 'A1', 'S1!A1+100');
    e.setCalcSettings({ mode: 'manual' });
    e.setCell('S1', 'A1', 5);
    e.calculateSheet('S1');
    assert.equal(e.getValue('S1', 'B1'), 6);
    assert.equal(e.getValue('S2', 'A1'), 101, 'l autre feuille reste en attente');
    assert.equal(e.pendingCalculation, true);
    e.calculateSheet('S2');
    assert.equal(e.getValue('S2', 'A1'), 105);
    assert.equal(e.pendingCalculation, false);
  });

  test('mode automatique sauf tables : calcul normal', () => {
    const e = book({ calcMode: 'autoNoTable' });
    e.setCell('S1', 'A1', 1);
    e.setFormula('S1', 'B1', 'A1+1');
    e.setCell('S1', 'A1', 4);
    assert.equal(e.getValue('S1', 'B1'), 5);
  });
});

describe('calcul iteratif', () => {
  test('reference circulaire : 0 sans iteration, convergence avec iteration', () => {
    const e = book();
    e.setCell('S1', 'A1', 100);
    e.setFormula('S1', 'B1', 'A1+C1*0.5');
    e.setFormula('S1', 'C1', 'B1*0.5');
    assert.equal(e.getValue('S1', 'B1'), 0);
    assert.equal(e.circularReferences().length > 0, true);
    e.setCalcSettings({ iterative: true, maxIterations: 200, maxChange: 1e-9 });
    // B = 100 + C/2, C = B/2  ->  B = 100 / (1 - 1/4) = 133.33...
    assert.ok(Math.abs(Number(e.getValue('S1', 'B1')) - 133.3333333) < 1e-4);
    e.setCalcSettings({ iterative: false });
    assert.equal(e.getValue('S1', 'B1'), 0);
  });

  test('le nombre d iterations est respecte', () => {
    const e = book({ iterative: true, maxIterations: 3, maxChange: 0 });
    e.setFormula('S1', 'A1', 'A1+1');
    assert.ok(Number(e.getValue('S1', 'A1')) <= 3);
  });
});

describe('audit des formules', () => {
  test('antecedents : cellules, zones et autres feuilles', () => {
    const e = book();
    e.setCell('S1', 'A1', 1);
    e.setCell('S2', 'B2', 2);
    e.setFormula('S1', 'C1', 'SUM(A1:A3)+S2!B2+A1');
    const p = e.precedentsOf('S1', 'C1');
    assert.ok(p.some((a) => a.sheet === 'S1' && a.r1 === 0 && a.c1 === 0 && a.r2 === 2 && a.c2 === 0), 'zone A1:A3');
    assert.ok(p.some((a) => a.sheet === 'S2' && a.r1 === 1 && a.c1 === 1 && a.r2 === 1 && a.c2 === 1), 'cellule S2!B2');
    assert.deepEqual(e.precedentsOf('S1', 'A1'), []);
  });

  test('dependants directs, y compris sur une autre feuille', () => {
    const e = book();
    e.setCell('S1', 'A1', 1);
    e.setFormula('S1', 'B1', 'A1+1');
    e.setFormula('S2', 'A1', 'SUM(S1!A1:A5)');
    const d = e.dependentsOf('S1', 'A1');
    assert.equal(d.length, 2);
    assert.ok(d.some((x) => x.sheet === 'S1' && x.row === 0 && x.col === 1));
    assert.ok(d.some((x) => x.sheet === 'S2' && x.row === 0 && x.col === 0));
    assert.deepEqual(e.dependentsOf('S2', 'A1'), []);
  });
});
