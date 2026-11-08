// Consolider : par position et par etiquettes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidate } from '../src/logic/consolidate.ts';

const a = [['', 'T1', 'T2'], ['Pommes', 1, 2], ['Poires', 3, 4]];
const b = [['', 'T2', 'T3'], ['Poires', 10, 20], ['Kiwis', 5, 6]];

test('par position : somme cellule a cellule', () => {
  assert.deepEqual(consolidate([[[1, 2], [3, 4]], [[10, 20], [30, 40]]], { fn: 'sum', topRow: false, leftCol: false }), [[11, 22], [33, 44]]);
});

test('par etiquettes : alignement des lignes et des colonnes', () => {
  const r = consolidate([a, b], { fn: 'sum', topRow: true, leftCol: true });
  assert.deepEqual(r[0], [null, 'T1', 'T2', 'T3']);
  assert.deepEqual(r.find((l) => l[0] === 'Poires'), ['Poires', 3, 14, 20]);
  assert.deepEqual(r.find((l) => l[0] === 'Pommes'), ['Pommes', 1, 2, null]);
  assert.deepEqual(r.find((l) => l[0] === 'Kiwis'), ['Kiwis', null, 5, 6]);
});

test('fonctions Moyenne, Nombre, Max', () => {
  const src = [[[2]], [[4]], [[9]]];
  assert.deepEqual([consolidate(src, { fn: 'average', topRow: false, leftCol: false })[0]?.[0], consolidate(src, { fn: 'count', topRow: false, leftCol: false })[0]?.[0], consolidate(src, { fn: 'max', topRow: false, leftCol: false })[0]?.[0]], [5, 3, 9]);
});
