import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsTabLayout, pickStop, splitAtTabs, tabWidth } from '../src/canvas/render/tab-layout.ts';

test('tabulations simples : un taquet gauche ou aucun passent par tab-size', () => {
  assert.equal(needsTabLayout({}), false);
  assert.equal(needsTabLayout({ tabs: [{ position: 72, align: 'l' }] }), false);
  assert.equal(needsTabLayout({ tabs: [{ position: 72, align: 'r' }] }), true);
  assert.equal(needsTabLayout({ tabs: [{ position: 36, align: 'l' }, { position: 90, align: 'l' }] }), true);
});

test('decoupe aux tabulations', () => {
  assert.deepEqual(splitAtTabs('A\tBC\t\tD'), [{ text: 'A', tab: false }, { text: '\t', tab: true }, { text: 'BC', tab: false }, { text: '\t', tab: true }, { text: '\t', tab: true }, { text: 'D', tab: false }]);
  assert.deepEqual(splitAtTabs(''), []);
});

test('taquet suivant : le premier apres la position, sinon multiple de l intervalle', () => {
  const stops = [{ pos: 100, align: 'ctr' as const }, { pos: 50, align: 'l' as const }];
  assert.deepEqual(pickStop(stops, 10, 72), { pos: 50, align: 'l' });
  assert.deepEqual(pickStop(stops, 60, 72), { pos: 100, align: 'ctr' });
  assert.deepEqual(pickStop(stops, 150, 72), { pos: 216, align: 'l' });
});

test('largeur selon l alignement : gauche, centre, droite, decimal', () => {
  const x = 20;
  assert.equal(tabWidth({ pos: 100, align: 'l' }, x, 40, 25), 80);
  assert.equal(tabWidth({ pos: 100, align: 'ctr' }, x, 40, 25), 60);
  assert.equal(tabWidth({ pos: 100, align: 'r' }, x, 40, 25), 40);
  assert.equal(tabWidth({ pos: 100, align: 'dec' }, x, 40, 25), 55);
  assert.equal(tabWidth({ pos: 30, align: 'r' }, x, 40, 25), 0);
});
