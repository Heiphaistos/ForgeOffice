// Reperage des antecedents et dependants : niveaux successifs, autres feuilles, suppression par niveau.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FormulaEngine } from '@forgeoffice/formulas';
import { removeLevel, traceLevel, traceStep, type TraceArrow } from '../src/logic/formulas/audit.ts';

function book(): FormulaEngine {
  const e = new FormulaEngine({ locale: 'en-US' });
  e.addSheet('S1');
  e.addSheet('S2');
  e.setCell('S1', 'A1', 1);
  e.setCell('S1', 'A2', 2);
  e.setFormula('S1', 'B1', 'SUM(A1:A2)');
  e.setFormula('S1', 'C1', 'B1*2+S2!A1');
  e.setFormula('S1', 'D1', 'C1+1');
  e.setCell('S2', 'A1', 10);
  e.setFormula('S2', 'B1', 'S1!B1+1');
  return e;
}
const at = (row: number, col: number) => ({ row, col });

test('antecedents : niveau 1 puis niveau 2', () => {
  const e = book();
  const first = traceStep([], 'prec', at(0, 2), 'S1', e);
  assert.equal(first.added, 2, 'B1 et S2!A1');
  assert.equal(first.external, true);
  const local = first.arrows.find((a) => !a.external);
  assert.deepEqual(local?.from, { r1: 0, c1: 1, r2: 0, c2: 1 });
  assert.deepEqual(local?.to, at(0, 2));
  assert.equal(traceLevel(first.arrows, 'prec', at(0, 2)), 1);
  const second = traceStep(first.arrows, 'prec', at(0, 2), 'S1', e);
  assert.equal(second.added, 1, 'A1:A2 vers B1');
  assert.deepEqual(second.arrows.at(-1)?.from, { r1: 0, c1: 0, r2: 1, c2: 0 });
  assert.equal(second.arrows.at(-1)?.level, 2);
  const third = traceStep(second.arrows, 'prec', at(0, 2), 'S1', e);
  assert.equal(third.added, 0, 'A1:A2 sont des constantes');
});

test('dependants : directs puis suivants, avec une autre feuille', () => {
  const e = book();
  const first = traceStep([], 'dep', at(0, 1), 'S1', e);
  assert.equal(first.added, 2, 'C1 sur la feuille, S2!B1 ailleurs');
  assert.equal(first.arrows.filter((a) => a.external).length, 1);
  const second = traceStep(first.arrows, 'dep', at(0, 1), 'S1', e);
  assert.equal(second.added, 1, 'D1 depend de C1');
  assert.deepEqual(second.arrows.at(-1)?.to, at(0, 3));
});

test('un deuxieme clic identique ne duplique pas les fleches', () => {
  const e = book();
  const a = traceStep([], 'prec', at(0, 3), 'S1', e);
  assert.equal(a.added, 1);
  const b = traceStep(a.arrows, 'prec', at(0, 3), 'S1', e);
  assert.equal(b.arrows.filter((x) => x.level === 1).length, 1);
});

test('suppression : niveau le plus eloigne, par direction', () => {
  const e = book();
  let arrows: TraceArrow[] = traceStep([], 'prec', at(0, 3), 'S1', e).arrows;
  arrows = traceStep(arrows, 'prec', at(0, 3), 'S1', e).arrows;
  arrows = traceStep(arrows, 'dep', at(0, 3), 'S1', e).arrows;
  assert.equal(traceLevel(arrows, 'prec', at(0, 3)), 2);
  const less = removeLevel(arrows, 'prec', at(0, 3));
  assert.equal(traceLevel(less, 'prec', at(0, 3)), 1);
  assert.equal(traceLevel(less, 'dep', at(0, 3)), traceLevel(arrows, 'dep', at(0, 3)));
  assert.equal(removeLevel(removeLevel(less, 'prec', at(0, 3)), 'prec', at(0, 3)).some((a) => a.dir === 'prec'), false);
});

test('les niveaux se comptent par cellule : une autre cellule repart au niveau 1', () => {
  const e = book();
  const a = traceStep([], 'prec', at(0, 3), 'S1', e);
  const b = traceStep(a.arrows, 'prec', at(0, 2), 'S1', e);
  assert.equal(b.added, 2, 'C1 a deux antecedents (B1 et S2!A1), indifferents des fleches de D1');
  assert.equal(traceLevel(b.arrows, 'prec', at(0, 2)), 1);
  assert.equal(traceLevel(b.arrows, 'prec', at(0, 3)), 1);
  assert.equal(removeLevel(b.arrows, 'prec', at(0, 2)).filter((x) => x.origin.col === 3).length, 1, 'les fleches de D1 restent');
});
