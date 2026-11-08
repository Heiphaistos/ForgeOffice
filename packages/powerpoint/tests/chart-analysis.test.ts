import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorAmounts, fitTrend } from '../src/canvas/chart/analysis.ts';

const close = (a: number | null | undefined, b: number, eps = 1e-6): boolean => a !== null && a !== undefined && Math.abs(a - b) < eps;

test('tendance lineaire : droite exacte, equation et R2 = 1', () => {
  const f = fitTrend({ type: 'linear' }, [1, 2, 3, 4], [3, 5, 7, 9]);
  assert.ok(f && close(f.at(10), 21) && close(f.r2, 1));
  assert.equal(f?.equation, 'y = 2x + 1');
});

test('polynomiale de degre 2, exponentielle, logarithmique, puissance', () => {
  const xs = [1, 2, 3, 4, 5];
  const poly = fitTrend({ type: 'poly', order: 2 }, xs, xs.map((x) => x * x - 2 * x + 3));
  assert.ok(poly && close(poly.at(6), 27, 1e-5) && close(poly.r2, 1, 1e-9));
  const exp = fitTrend({ type: 'exp' }, xs, xs.map((x) => 2 * Math.exp(0.5 * x)));
  assert.ok(exp && close(exp.at(3), 2 * Math.exp(1.5), 1e-6));
  const log = fitTrend({ type: 'log' }, xs, xs.map((x) => 4 + 3 * Math.log(x)));
  assert.ok(log && close(log.at(7), 4 + 3 * Math.log(7), 1e-6) && log.at(-1) === null);
  const pow = fitTrend({ type: 'power' }, xs, xs.map((x) => 3 * x ** 2));
  assert.ok(pow && close(pow.at(4), 48, 1e-6));
});

test('modeles impossibles ou trop peu de points : aucune tendance', () => {
  assert.equal(fitTrend({ type: 'exp' }, [1, 2], [1, -1]), null);
  assert.equal(fitTrend({ type: 'log' }, [0, 1, 2], [1, 2, 3]), null);
  assert.equal(fitTrend({ type: 'linear' }, [1], [1]), null);
  assert.equal(fitTrend({ type: 'inconnu' }, [1, 2], [1, 2]), null);
});

test('moyenne mobile : nulle avant la periode, moyenne ensuite', () => {
  const f = fitTrend({ type: 'movingAvg', period: 3 }, [1, 2, 3, 4], [3, 6, 9, 12]);
  assert.ok(f && f.at(2) === null && close(f.at(3), 6) && close(f.at(4), 9));
});

test('barres d erreur : fixe, pourcentage, ecart type, erreur standard', () => {
  const v = [2, 4, 4, 4, 5, 5, 7, 9];
  assert.deepEqual(errorAmounts({ valueType: 'fixed', value: 2 }, [1, null, 3]), [2, null, 2]);
  assert.deepEqual(errorAmounts({ valueType: 'percentage', value: 10 }, [50, -20]), [5, 2]);
  const sd = errorAmounts({ valueType: 'stdDev', value: 1 }, v)[0] as number;
  assert.ok(close(sd, Math.sqrt(32 / 7), 1e-9));
  assert.ok(close(errorAmounts({ valueType: 'stdErr' }, v)[0], Math.sqrt(32 / 7) / Math.sqrt(8), 1e-9));
});
