import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressureWidth } from '../src/model.ts';

test('trait au stylet : epaisseur proportionnelle a la pression moyenne', () => {
  assert.equal(pressureWidth(2, [0.1, 0.1], 'pen'), 1.4);
  assert.equal(pressureWidth(2, [1, 1], 'pen'), 2.8);
  assert.ok(pressureWidth(2, [0.5], 'pen') > pressureWidth(2, [0.2], 'pen'));
});

test('doigt, souris ou capteur absent : epaisseur de base', () => {
  assert.equal(pressureWidth(2, [0.9, 0.9], 'touch'), 2);
  assert.equal(pressureWidth(2, [0.9], 'mouse'), 2);
  assert.equal(pressureWidth(2, [0, 0], 'pen'), 2);
  assert.equal(pressureWidth(2, [], 'pen'), 2);
});
