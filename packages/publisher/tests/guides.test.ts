import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveGuideTo, removeGuideAt } from '../src/guides.ts';

test('removeGuideAt : supprime un seul repère de l axe, sans toucher à l autre axe', () => {
  const g = { x: [10, 20, 30], y: [5] };
  assert.deepEqual(removeGuideAt(g, 'x', 1), { x: [10, 30], y: [5] });
  assert.deepEqual(removeGuideAt(g, 'y', 0), { x: [10, 20, 30], y: [] });
  assert.deepEqual(removeGuideAt(g, 'x', 9), g);
  assert.deepEqual(g.x, [10, 20, 30]);
});

test('moveGuideTo : déplace un repère ; indice ou valeur invalide = inchangé', () => {
  const g = { x: [10, 20], y: [] as number[] };
  assert.deepEqual(moveGuideTo(g, 'x', 0, 99), { x: [99, 20], y: [] });
  assert.equal(moveGuideTo(g, 'x', 5, 1), g);
  assert.equal(moveGuideTo(g, 'x', -1, 1), g);
  assert.equal(moveGuideTo(g, 'x', 0, Number.NaN), g);
  assert.equal(moveGuideTo(g, 'y', 0, 1), g);
});
