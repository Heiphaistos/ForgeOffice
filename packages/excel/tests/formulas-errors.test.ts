// Verification des erreurs : regles d'Excel (erreur de formule, nombre texte, formule incoherente, cellules omises, non verrouillee).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBlankWorkbook, type Workbook } from '@forgeoffice/xlsx';
import type { Scalar } from '@forgeoffice/formulas';
import { Draft } from '../src/logic/draft.ts';
import { WorkbookEngine } from '../src/logic/engine.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { DEFAULT_ERROR_RULES, checkCell, findNextError, fixesFor, ignoreKey, type CheckEnv } from '../src/logic/formulas/errors.ts';

function env(rows: string[][], textCells: [number, number, string][] = [], rules = DEFAULT_ERROR_RULES): CheckEnv {
  const d = new Draft(createBlankWorkbook());
  rows.forEach((line, r) => line.forEach((text, c) => {
    if (!text) return;
    const e = parseEntry(text);
    if (e.ok) commitEntry(d, 0, r, c, e);
  }));
  for (const [r, c, t] of textCells) d.set(0, r, c, { value: t });
  const wb: Workbook = d.wb;
  const eng = new WorkbookEngine();
  eng.sync(wb);
  const sheet = wb.sheets[0];
  if (!sheet) throw new Error('feuille');
  return { sheet, value: (r, c): Scalar => eng.value(sheet.name, r, c), isLocked: () => true, rules };
}

test('formule en erreur', () => {
  const e = env([['1', '0', '=A1/B1']]);
  assert.deepEqual(checkCell(e, 0, 2), { rule: 'formulaError', row: 0, col: 2, detail: '#DIV/0!' });
  assert.equal(checkCell(e, 0, 0), null);
});

test('nombre au format texte, et sa conversion', () => {
  const e = env([], [[0, 0, '123'], [1, 0, 'abc'], [2, 0, '12,5']]);
  assert.equal(checkCell(e, 0, 0)?.rule, 'textNumber');
  assert.equal(checkCell(e, 1, 0), null);
  assert.equal(checkCell(e, 2, 0)?.rule, 'textNumber');
  assert.deepEqual(fixesFor(e, { rule: 'textNumber', row: 2, col: 0 }), [{ kind: 'toNumber', number: 12.5 }]);
});

test('formule incoherente avec ses voisines (gauche et droite, ou haut et bas)', () => {
  const rows = [['1', '2', '3'], ['=A1*2', '=B1*2', '=C1*2'], ['=A1*2', '=B1+5', '=C1*2']];
  const e = env(rows);
  assert.equal(checkCell(e, 1, 1), null, 'coherente');
  const bad = checkCell(e, 2, 1);
  assert.equal(bad?.rule, 'inconsistent');
  const fixes = fixesFor(e, bad ?? { rule: 'inconsistent', row: 2, col: 1 });
  const left = fixes.find((f) => f.kind === 'copyLeft');
  assert.equal(left?.formula, 'B1*2', 'la formule de gauche decalee a la colonne B');
  assert.equal(checkCell(e, 2, 0), null);
});

test('cellules omises par une somme', () => {
  const e = env([['1'], ['2'], ['3'], ['4'], ['=SOMME(A1:A3)']]);
  const f = checkCell(e, 4, 0);
  assert.equal(f?.rule, 'omitted');
  assert.deepEqual(fixesFor(e, f ?? { rule: 'omitted', row: 4, col: 0 }), [{ kind: 'includeCells', formula: 'SUM(A1:A4)' }]);
  const ok = env([['1'], ['2'], ['3'], ['=SOMME(A1:A3)']]);
  assert.equal(checkCell(ok, 3, 0), null, 'la cellule du total ne compte pas');
});

test('cellule non verrouillee contenant une formule ; regles desactivables', () => {
  const e = env([['1', '=A1+1']]);
  const open = { ...e, isLocked: () => false };
  assert.equal(checkCell(open, 0, 1)?.rule, 'unlocked');
  assert.equal(checkCell({ ...open, rules: { ...DEFAULT_ERROR_RULES, unlocked: false } }, 0, 1), null);
});

test('reference a une cellule vide (regle optionnelle)', () => {
  const rows = [['1', '=A1+Z9']];
  assert.equal(checkCell(env(rows), 0, 1), null);
  assert.equal(checkCell(env(rows, [], { ...DEFAULT_ERROR_RULES, emptyRef: true }), 0, 1)?.rule, 'emptyRef');
});

test('erreur suivante : ordre de lecture, bouclage, erreurs ignorees', () => {
  const e = env([['=1/0', '', '=2/0'], ['', '=3/0']]);
  const first = findNextError(e, { row: -1, col: -1 }, new Set());
  assert.deepEqual([first?.row, first?.col], [0, 0]);
  const second = findNextError(e, { row: 0, col: 0 }, new Set());
  assert.deepEqual([second?.row, second?.col], [0, 2]);
  const wrap = findNextError(e, { row: 1, col: 1 }, new Set());
  assert.deepEqual([wrap?.row, wrap?.col], [0, 0]);
  const ignored = new Set([ignoreKey('Feuil1', { rule: 'formulaError', row: 0, col: 0 })]);
  const skip = findNextError(e, { row: -1, col: -1 }, ignored);
  assert.deepEqual([skip?.row, skip?.col], [0, 2]);
  assert.equal(findNextError(env([['1']]), { row: 0, col: 0 }, new Set()), null);
});

test('erreur precedente : ordre inverse et bouclage', async () => {
  const { findPreviousError } = await import('../src/logic/formulas/errors.ts');
  const e = env([['=1/0', '', '=2/0'], ['', '=3/0']]);
  assert.deepEqual([findPreviousError(e, { row: 0, col: 2 }, new Set())?.row, findPreviousError(e, { row: 0, col: 2 }, new Set())?.col], [0, 0]);
  assert.deepEqual([findPreviousError(e, { row: 0, col: 0 }, new Set())?.row, findPreviousError(e, { row: 0, col: 0 }, new Set())?.col], [1, 1]);
});
