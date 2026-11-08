// Options : deplacement apres Entree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { enterDelta } from '../src/logic/options.ts';

test('deplacement apres Entree selon le sens, Maj inverse', () => {
  assert.deepEqual(enterDelta('down', false), [1, 0]);
  assert.deepEqual(enterDelta('down', true), [-1, 0]);
  assert.deepEqual(enterDelta('right', false), [0, 1]);
  assert.deepEqual(enterDelta('up', false), [-1, 0]);
  assert.deepEqual(enterDelta('left', true), [0, 1]);
  assert.deepEqual(enterDelta('none', true), [0, 0]);
});

test('decimales fixes : entiers uniquement', async () => {
  const { applyFixedDecimals } = await import('../src/logic/options.ts');
  assert.equal(applyFixedDecimals('350', 2), '3,50');
  assert.equal(applyFixedDecimals('5', 2), '0,05');
  assert.equal(applyFixedDecimals('-1234', 2), '-12,34');
  assert.equal(applyFixedDecimals('3,5', 2), '3,5');
  assert.equal(applyFixedDecimals('abc', 2), 'abc');
  assert.equal(applyFixedDecimals('=1+2', 2), '=1+2');
  assert.equal(applyFixedDecimals('350', 0), '350');
});
