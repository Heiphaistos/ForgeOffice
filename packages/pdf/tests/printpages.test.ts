import assert from 'node:assert/strict';
import { test } from 'node:test';
import { printPages } from '../src/printpages.ts';

test('pages à imprimer', () => {
  assert.equal(printPages('all', '', 5, 0, []), null);
  assert.deepEqual(printPages('current', '', 5, 3, []), [3]);
  assert.deepEqual(printPages('selected', '', 5, 0, [3, 1]), [1, 3]);
  assert.equal(printPages('selected', '', 3, 0, [0, 1, 2]), null);
  assert.deepEqual(printPages('range', '1-2, 5', 5, 0, []), [0, 1, 4]);
  assert.equal(printPages('range', '1-5', 5, 0, []), null);
  assert.throws(() => printPages('range', '9', 5, 0, []), /hors limites/);
  assert.throws(() => printPages('range', '', 5, 0, []), /Aucune page/);
});
