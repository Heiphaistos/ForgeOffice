import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastCol, rangeFromText } from '../src/logic/rangeText.ts';

test('rangeFromText : cellule, plage, plage inversee, texte invalide', () => {
  assert.deepEqual(rangeFromText('B2'), { r1: 1, c1: 1, r2: 1, c2: 1 });
  assert.deepEqual(rangeFromText('A1:C3'), { r1: 0, c1: 0, r2: 2, c2: 2 });
  assert.deepEqual(rangeFromText('C3:A1'), { r1: 0, c1: 0, r2: 2, c2: 2 });
  assert.deepEqual(rangeFromText('AA10'), { r1: 9, c1: 26, r2: 9, c2: 26 });
  assert.equal(rangeFromText('zz'), undefined);
});

test('lastCol : derniere colonne utilisee', () => {
  assert.equal(lastCol({ cells: new Map() }), 0);
  assert.equal(lastCol({ cells: new Map([[0, new Map([[2, 1]])], [5, new Map([[7, 1], [3, 1]])]]) }), 7);
});
