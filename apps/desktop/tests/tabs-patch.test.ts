// Onglets : une mise a jour sans effet ne doit pas produire un nouvel etat (boucle de rendu infinie sinon).
import test from 'node:test';
import assert from 'node:assert/strict';
import { patchTab } from '../../web/src/tabs/patch.ts';

const tabs = [
  { id: 't1', title: 'A', modified: false },
  { id: 't2', title: 'B', modified: false },
];

test('meme titre, meme etat : la liste est rendue telle quelle', () => {
  assert.equal(patchTab(tabs, 't1', { title: 'A' }), tabs);
  assert.equal(patchTab(tabs, 't2', { title: 'B', modified: false }), tabs);
  assert.equal(patchTab(tabs, 'absent', { title: 'X' }), tabs);
});

test('un vrai changement ne touche que l\'onglet vise', () => {
  const next = patchTab(tabs, 't1', { title: 'A2' });
  assert.notEqual(next, tabs);
  assert.deepEqual(next, [{ id: 't1', title: 'A2', modified: false }, tabs[1]]);
  assert.equal(next[1], tabs[1]);
});
