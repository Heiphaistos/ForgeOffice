// Deplacer / copier une plage en glissant la bordure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { movedRange, moveRangeCells, onRectBorder } from '../src/logic/move-range.ts';

function setup(): Draft {
  const d = new Draft(createBlankWorkbook());
  for (const [r, c, t] of [[0, 0, '1'], [1, 0, '2'], [0, 1, '=A1*2']] as const) {
    const e = parseEntry(t, false);
    if (e.ok) commitEntry(d, 0, r, c, e);
  }
  return d;
}

test('bordure : detecte le bord, pas l\'interieur ni la poignee', () => {
  const rect = { x: 100, y: 100, w: 80, h: 40 };
  assert.equal(onRectBorder(rect, 100, 120), true);
  assert.equal(onRectBorder(rect, 140, 101), true);
  assert.equal(onRectBorder(rect, 140, 120), false);
  assert.equal(onRectBorder(rect, 180, 140), false, 'poignee de recopie');
  assert.equal(onRectBorder(rect, 300, 300), false);
});

test('destination bornee a la feuille', () => {
  assert.deepEqual(movedRange({ r1: 1, c1: 1, r2: 2, c2: 2 }, -5, 3), { r1: 0, c1: 4, r2: 1, c2: 5 });
});

test('deplacer : la source est videe, les formules gardent leurs references', () => {
  const d = setup();
  const out = moveRangeCells(d, 0, { r1: 0, c1: 0, r2: 1, c2: 1 }, { r1: 5, c1: 3, r2: 6, c2: 4 }, false);
  assert.deepEqual(out, { r1: 5, c1: 3, r2: 6, c2: 4 });
  assert.equal(d.get(0, 0, 0), undefined);
  assert.equal(d.get(0, 5, 3)?.value, 1);
  assert.equal(d.get(0, 6, 3)?.value, 2);
  assert.equal(d.get(0, 5, 4)?.formula, 'A1*2');
});

test('copier : la source est conservee et la formule est translatee', () => {
  const d = setup();
  moveRangeCells(d, 0, { r1: 0, c1: 0, r2: 1, c2: 1 }, { r1: 5, c1: 3, r2: 6, c2: 4 }, true);
  assert.equal(d.get(0, 0, 0)?.value, 1);
  assert.equal(d.get(0, 5, 4)?.formula, 'D6*2');
});
