// Selection de plage : rectangle, colonnes reordonnees ou masquees, texte tabule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allRange, columnRange, inBox, rangeBox, rangeText, rowRange } from '../src/logic/selection.ts';

test('rectangle entre deux coins, quel que soit le sens', () => {
  const shown = [0, 1, 2, 3];
  const box = rangeBox({ a: { row: 4, col: 2 }, b: { row: 1, col: 0 } }, shown);
  assert.deepEqual(box, { r1: 1, r2: 4, cols: [0, 1, 2] });
  assert.ok(inBox(box, 2, 1));
  assert.ok(!inBox(box, 0, 1));
  assert.ok(!inBox(box, 2, 3));
  assert.ok(!inBox(null, 0, 0));
});

test('l ordre d affichage prime : colonnes reordonnees, masquees', () => {
  const shown = [3, 0, 2]; // champ 3 d abord, champ 1 masque
  assert.deepEqual(rangeBox({ a: { row: 0, col: 3 }, b: { row: 0, col: 2 } }, shown)?.cols, [3, 0, 2]);
  assert.equal(rangeBox({ a: { row: 0, col: 1 }, b: { row: 0, col: 2 } }, shown), null, 'coin masque');
});

test('ligne, colonne et grille entieres', () => {
  const shown = [2, 0, 1];
  assert.deepEqual(rangeBox(rowRange(5, shown), shown), { r1: 5, r2: 5, cols: [2, 0, 1] });
  assert.deepEqual(rangeBox(columnRange(0, 4), shown), { r1: 0, r2: 3, cols: [0] });
  assert.deepEqual(rangeBox(allRange(3, shown), shown), { r1: 0, r2: 2, cols: [2, 0, 1] });
  assert.deepEqual(rangeBox(allRange(0, shown), shown), { r1: 0, r2: 0, cols: [2, 0, 1] });
});

test('texte tabule avec ou sans intitules', () => {
  const box = { r1: 1, r2: 2, cols: [1, 0] };
  const text = (r: number, c: number): string => `${r}${c}`;
  assert.equal(rangeText(box, text), '11\t10\r\n21\t20');
  assert.equal(rangeText(box, text, (c) => `C${c}`), 'C1\tC0\r\n11\t10\r\n21\t20');
});
