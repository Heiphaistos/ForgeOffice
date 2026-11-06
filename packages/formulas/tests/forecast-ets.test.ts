// PREVISION.ETS et variantes. Series exactes : memes valeurs qu'Excel 365 ; series bruitees : ecart relatif borne (optimiseur propre).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FormulaEngine, type Scalar } from '../src/index.ts';

function book(cols: Record<string, Scalar[]>): FormulaEngine {
  const e = new FormulaEngine({ locale: 'en-US' });
  e.addSheet('S');
  e.batch(() => {
    for (const [col, vals] of Object.entries(cols)) vals.forEach((v, i) => e.setCell('S', `${col}${i + 1}`, v));
  });
  return e;
}
const ev = (e: FormulaEngine, f: string): unknown => {
  const v = e.evaluate(f, 'S');
  return typeof v === 'object' && v !== null && 'code' in v ? (v as { code: string }).code : v;
};
const near = (a: unknown, b: number, rel = 1e-9): void =>
  assert.ok(typeof a === 'number' && Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${String(a)} vs ${b}`);
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

const SEAS = [10, 20, 30, 40, 12, 22, 32, 42, 14, 24, 34, 44, 16, 26, 36, 46, 18, 28, 38, 48];
const NOISY = [12, 15, 14, 18, 21, 19, 24, 27, 26, 30, 33, 31, 36, 38, 40, 43];
const SEASNOISE = [10, 22, 29, 41, 13, 21, 34, 40, 15, 26, 33, 47, 16, 27, 38, 44, 19, 30, 37, 49];

describe('PREVISION.ETS', () => {
  test('series exactes : valeurs d Excel', () => {
    const lin = book({ A: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19], B: range(10) });
    for (const [t, want] of [[11, 21], [12, 23], [13, 25], [15, 29], [3, 5]] as const) near(ev(lin, `FORECAST.ETS(${t},A1:A10,B1:B10,1)`), want);
    near(ev(lin, 'FORECAST.ETS(11.5,A1:A10,B1:B10,1)'), 22);
    const seas = book({ A: SEAS, B: range(20) });
    for (const [t, want] of [[21, 20], [22, 30], [23, 40], [25, 22], [3, 30]] as const) near(ev(seas, `FORECAST.ETS(${t},A1:A20,B1:B20,1)`), want);
    assert.equal(ev(seas, 'FORECAST.ETS.SEASONALITY(A1:A20,B1:B20)'), 4);
    assert.equal(ev(lin, 'FORECAST.ETS.SEASONALITY(A1:A10,B1:B10)'), 0);
    const flat = book({ A: [5, 5, 5, 5, 5, 5, 5, 5], B: range(8) });
    near(ev(flat, 'FORECAST.ETS(13,A1:A8,B1:B8)'), 5);
  });

  test('series exactes : statistiques d erreur nulles, pas detecte, intervalle nul', () => {
    const lin = book({ A: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19], B: range(10) });
    for (const s of [4, 5, 6, 7]) near(ev(lin, `FORECAST.ETS.STAT(A1:A10,B1:B10,${s})`), 0, 1e-9);
    assert.equal(ev(lin, 'FORECAST.ETS.STAT(A1:A10,B1:B10,8)'), 1);
    near(ev(lin, 'FORECAST.ETS.CONFINT(11,A1:A10,B1:B10)'), 0, 1e-9);
    assert.equal(ev(lin, 'FORECAST.ETS.STAT(A1:A10,B1:B10,9)'), '#NUM!');
    assert.equal(ev(lin, 'FORECAST.ETS.STAT(A1:A10,B1:B10,0)'), '#NUM!');
  });

  test('series bruitees : proche d Excel (moins de 2 %)', () => {
    const noisy = book({ A: NOISY, B: range(16) });
    near(ev(noisy, 'FORECAST.ETS(17,A1:A16,B1:B16)'), 43.9375046376413, 0.02);
    near(ev(noisy, 'FORECAST.ETS(18,A1:A16,B1:B16)'), 45.9533541242529, 0.02);
    near(ev(noisy, 'FORECAST.ETS(21,A1:A16,B1:B16)'), 52.0009025840877, 0.02);
    near(ev(noisy, 'FORECAST.ETS.CONFINT(17,A1:A16,B1:B16)'), 2.8258824623104, 0.05);
    assert.equal(ev(noisy, 'FORECAST.ETS.SEASONALITY(A1:A16,B1:B16)'), 0);
    const sn = book({ A: SEASNOISE, B: range(20) });
    near(ev(sn, 'FORECAST.ETS(21,A1:A20,B1:B20,1)'), 20.7080898395656, 0.02);
    near(ev(sn, 'FORECAST.ETS(23,A1:A20,B1:B20,1)'), 40.1583313426587, 0.02);
    near(ev(sn, 'FORECAST.ETS(25,A1:A20,B1:B20,1)'), 22.7745094612007, 0.03);
    assert.equal(ev(sn, 'FORECAST.ETS.SEASONALITY(A1:A20,B1:B20)'), 4);
    near(ev(sn, 'FORECAST.ETS(21,A1:A20,B1:B20,0)'), 38.5213786301651, 0.03);
    near(ev(sn, 'FORECAST.ETS.CONFINT(21,A1:A20,B1:B20)'), 2.93120265709119, 0.06);
    const mae = Number(ev(sn, 'FORECAST.ETS.STAT(A1:A20,B1:B20,6)'));
    assert.ok(mae > 0.8 && mae < 1.5, String(mae));
  });

  test('erreurs, trous, doublons, dates mensuelles (comme Excel)', () => {
    const e = book({
      A: [2, 4, 6, 8, 10, 12, 14, 16], B: range(8),
      D: [2, 4, 8, 10, 14, 16], E: [1, 2, 4, 5, 7, 8],
      G: [2, 4, 6, 6, 8, 10, 12], H: [1, 2, 3, 3, 4, 5, 6],
    });
    near(ev(e, 'FORECAST.ETS(9,A1:A8,B1:B8)'), 18);
    assert.equal(ev(e, 'FORECAST.ETS(0,A1:A8,B1:B8)'), '#NUM!');
    assert.equal(ev(e, 'FORECAST.ETS(9,A1:A7,B1:B8)'), '#N/A');
    assert.equal(ev(e, 'FORECAST.ETS(9,A1:A8,B1:B8,-1)'), '#NUM!');
    assert.equal(ev(e, 'FORECAST.ETS(9,A1:A8,B1:B8,1,5)'), '#NUM!');
    assert.equal(ev(e, 'FORECAST.ETS(9,A1:A8,B1:B8,1,1,8)'), '#NUM!');
    assert.equal(ev(e, 'FORECAST.ETS(9,A1:A8,B1:B8,"x")'), '#VALUE!');
    near(ev(e, 'FORECAST.ETS(9.5,A1:A8,B1:B8)'), 19);
    near(ev(e, 'FORECAST.ETS(5,A1:A8,B1:B8)'), 10);
    near(ev(e, 'FORECAST.ETS(9,A1:A2,B1:B2)'), 18);
    near(ev(e, 'FORECAST.ETS(9,D1:D6,E1:E6)'), 18);
    near(ev(e, 'FORECAST.ETS(9,D1:D6,E1:E6,1,0)'), 16.2084792, 0.12);
    assert.equal(ev(e, 'FORECAST.ETS.STAT(D1:D6,E1:E6,8)'), 1);
    near(ev(e, 'FORECAST.ETS(7,G1:G7,H1:H7)'), 14);
    near(ev(e, 'FORECAST.ETS(7,G1:G7,H1:H7,1,1,7)'), 13.5827558, 0.12);
    assert.equal(ev(e, 'FORECAST.ETS.CONFINT(9,A1:A8,B1:B8,1.5)'), '#NUM!');
    near(ev(e, 'FORECAST.ETS.CONFINT(9,A1:A8,B1:B8,0.5)'), 0, 1e-9);
  });

  test('chronologie mensuelle : pas de 31 jours, cible au mois pres', () => {
    const dates = Array.from({ length: 12 }, (_, i) => Math.round(Date.UTC(2020, i, 15) / 86400000) + 25569);
    const e = book({ J: Array.from({ length: 12 }, (_, i) => 100 + 5 * i), K: dates });
    const next = Math.round(Date.UTC(2021, 0, 15) / 86400000) + 25569;
    near(ev(e, `FORECAST.ETS(${next},J1:J12,K1:K12)`), 160);
    near(ev(e, `FORECAST.ETS(${next + 61},J1:J12,K1:K12)`), 170);
    assert.equal(ev(e, 'FORECAST.ETS.STAT(J1:J12,K1:K12,8)'), 31);
  });
});
