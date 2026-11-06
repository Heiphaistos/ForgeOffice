import { test } from 'node:test';
import assert from 'node:assert/strict';
import { miniToolbarVisible, placeMiniToolbar } from '../src/logic/miniToolbar.ts';

const view = { width: 1000, height: 700 };
const bar = { width: 300, height: 60 };

test('placement : au-dessus, centree, dans la fenetre', () => {
  const p = placeMiniToolbar({ left: 400, top: 300, width: 100, height: 20 }, bar, view);
  assert.equal(p.below, false);
  assert.equal(p.left, 300);
  assert.equal(p.top, 300 - 60 - 8);
});

test('placement : dessous si le haut manque, bord gauche et droit bornes', () => {
  const top = placeMiniToolbar({ left: 0, top: 20, width: 40, height: 20 }, bar, view);
  assert.equal(top.below, true);
  assert.equal(top.top, 20 + 20 + 8);
  assert.equal(top.left, 8);
  const right = placeMiniToolbar({ left: 960, top: 300, width: 30, height: 20 }, bar, view);
  assert.equal(right.left, 1000 - 300 - 8);
});

test('visibilite : selection, pointeur relache, non fermee, active', () => {
  const base = { enabled: true, hasSelection: true, pointerDown: false, dismissed: false, focusInside: true };
  assert.equal(miniToolbarVisible(base), true);
  assert.equal(miniToolbarVisible({ ...base, enabled: false }), false);
  assert.equal(miniToolbarVisible({ ...base, hasSelection: false }), false);
  assert.equal(miniToolbarVisible({ ...base, pointerDown: true }), false);
  assert.equal(miniToolbarVisible({ ...base, dismissed: true }), false);
  assert.equal(miniToolbarVisible({ ...base, focusInside: false }), false);
});
