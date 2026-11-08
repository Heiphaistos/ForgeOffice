// Filtre avance : criteres et zone de criteres.
import test from 'node:test';
import assert from 'node:assert/strict';
import { advancedFilter, matchesCriterion } from '../src/logic/advanced-filter.ts';

const list = [['Fruit', 'Qte'], ['Pomme', 10], ['Poire', 4], ['Pomme', 4], ['Kiwi', 25], ['Pomme', 10]];

test('criteres : comparateurs, jokers, vide', () => {
  assert.equal(matchesCriterion(5, '>3'), true);
  assert.equal(matchesCriterion(5, '<=4'), false);
  assert.equal(matchesCriterion('Pomme', 'Po*'), true);
  assert.equal(matchesCriterion('Kiwi', '<>Po*'), true);
  assert.equal(matchesCriterion('pomme', 'POMME'), true);
  assert.equal(matchesCriterion(null, '='), true);
  assert.equal(matchesCriterion(7, ''), true);
  assert.equal(matchesCriterion(7, 7), true);
  assert.equal(matchesCriterion('b', '>a'), true);
});

test('zone de criteres : ET entre colonnes, OU entre lignes', () => {
  assert.deepEqual(advancedFilter(list, [['Fruit', 'Qte'], ['Po*', '>5']], { unique: false }), [1, 5]);
  assert.deepEqual(advancedFilter(list, [['Fruit', 'Qte'], ['Kiwi', ''], ['Poire', '']], { unique: false }), [2, 4]);
  assert.deepEqual(advancedFilter(list, [['Qte'], ['4']], { unique: false }), [2, 3]);
});

test('enregistrements uniques et zone de criteres vide', () => {
  assert.deepEqual(advancedFilter(list, [['Fruit'], ['Pomme']], { unique: true }), [1, 3]);
  assert.deepEqual(advancedFilter(list, [['Fruit']], { unique: true }), [1, 2, 3, 4]);
});
