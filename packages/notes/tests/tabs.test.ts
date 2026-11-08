import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampMove, pinTarget, tabsToClose, type TabLike } from '../src/logic/tabs.ts';

const t = (id: string, pinned = false, dirty = false): TabLike => ({ id, pinned, dirty });
const tabs = [t('a', true), t('b'), t('c', false, true), t('d'), t('e', true)];

test('fermetures groupées : les onglets épinglés restent', () => {
  assert.deepEqual(tabsToClose(tabs, 'c', 'left'), ['b']);
  assert.deepEqual(tabsToClose(tabs, 'c', 'right'), ['d']);
  assert.deepEqual(tabsToClose(tabs, 'c', 'others'), ['b', 'd']);
  assert.deepEqual(tabsToClose(tabs, 'c', 'unchanged'), ['b', 'd']);
  assert.deepEqual(tabsToClose(tabs, 'c', 'all'), ['b', 'c', 'd']);
  assert.deepEqual(tabsToClose(tabs, 'zz', 'left'), []);
});

test('déplacement : épinglés à gauche, autres à droite', () => {
  const ordered = [t('p1', true), t('p2', true), t('x'), t('y')];
  assert.equal(clampMove(ordered, 'x', 0), 2);
  assert.equal(clampMove(ordered, 'x', 3), 3);
  assert.equal(clampMove(ordered, 'p1', 3), 1);
  assert.equal(clampMove(ordered, 'p2', 0), 0);
});

test('épinglage : juste après les onglets déjà épinglés', () => {
  const ordered = [t('p1', true), t('x'), t('y'), t('z')];
  assert.equal(pinTarget(ordered, 'z'), 1);
  assert.equal(pinTarget(ordered, 'p1'), 0);
});
