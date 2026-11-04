// Aides des tests : evaluation d'une formule et comparaison aux valeurs d'Excel.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FormulaError, Matrix, evaluateFormula, type Scalar, type StandaloneOptions, type Value } from '../src/index.ts';

/** Erreur attendue, ex. E('#N/A'). */
export interface ErrExpect {
  err: string;
}
export const E = (code: string): ErrExpect => ({ err: code });

export type Expected = number | string | boolean | null | ErrExpect | Expected[][];

/** Cas : [formule, valeur attendue, tolerance relative facultative]. */
export type Case = [string, Expected] | [string, Expected, number];

/** Jeu de cellules commun : A1:A5 = 1..5, B1:B5 = textes, C1:C5 melange, D1 = "3" (texte). */
export const CELLS: Record<string, Scalar> = {
  A1: 1, A2: 2, A3: 3, A4: 4, A5: 5,
  B1: 'apple', B2: 'banana', B3: 'cherry', B4: 'apricot', B5: 'date',
  C1: 10, C2: 'x', C3: true, C5: -5,
  D1: '3',
};

export function expectValue(actual: Value, expected: Expected, tol = 1e-9, label = ''): void {
  if (Array.isArray(expected)) {
    assert.ok(actual instanceof Matrix, `${label} : matrice attendue, obtenu ${String(actual)}`);
    assert.equal(actual.rows, expected.length, `${label} : lignes`);
    expected.forEach((row, r) => {
      assert.equal(actual.cols, row.length, `${label} : colonnes`);
      row.forEach((v, c) => expectValue(actual.get(r, c), v, tol, `${label}[${r},${c}]`));
    });
    return;
  }
  if (expected !== null && typeof expected === 'object') {
    assert.ok(actual instanceof FormulaError, `${label} : erreur ${expected.err} attendue, obtenu ${String(actual)}`);
    assert.equal(actual.code, expected.err, label);
    return;
  }
  if (typeof expected === 'number') {
    assert.equal(typeof actual, 'number', `${label} : nombre attendu, obtenu ${String(actual)}`);
    const a = actual as number;
    assert.ok(Math.abs(a - expected) <= tol * Math.max(1, Math.abs(expected)), `${label} : ${a} au lieu de ${expected}`);
    return;
  }
  assert.equal(actual, expected, label);
}

/** Un test par cas (formule canonique, region en-US par defaut). */
export function runCases(cases: Case[], options: StandaloneOptions = {}): void {
  for (const [formula, expected, tol] of cases) {
    test(formula, () => {
      const v = evaluateFormula(formula, { cells: CELLS, locale: 'en-US', ...options });
      expectValue(v, expected, tol ?? 1e-9, formula);
    });
  }
}
