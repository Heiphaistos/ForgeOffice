import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Workspace } from '../src/workspace.ts';
import { buildCommands } from '../src/commands.ts';
import { DEFAULT_PREFS } from '../src/logic/prefs.ts';
import { fake, makeHost } from './fake.ts';
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

test('fermer : un onglet epingle n est pas ferme par la commande (grisee)', () => {
  const ws = new Workspace(fake().services, DEFAULT_PREFS);
  const a = ws.add({ name: 'a.txt', text: '' });
  const b = ws.add({ name: 'b.txt', text: '' });
  ws.setPinned(a, true);
  const closed: string[][] = [];
  const list = () => buildCommands(makeHost(ws, { closeTabs: (ids) => void closed.push([...ids]) }));
  ws.activate(a);
  const close = list().find((c) => c.id === 'close');
  assert.equal(close?.disabled, true);
  close?.run();
  assert.deepEqual(closed, []);
  ws.activate(b);
  list().find((c) => c.id === 'close')?.run();
  assert.deepEqual(closed, [[b]]);
});
