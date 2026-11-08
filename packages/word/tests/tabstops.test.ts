import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextStop, tabWidth, usableStops } from '../src/features/tabstops.ts';

const stops = usableStops([
  { position: 300, align: 'right', leader: 'dot' },
  { position: 100, align: 'left' },
  { position: 50, align: 'clear' },
  { position: 200, align: 'center' },
  { position: 250, align: 'bar' },
]);

test('taquets : effaces et barres ignores, tries', () => {
  assert.deepEqual(stops.map((s) => s.position), [100, 200, 300]);
});

test('prochain taquet : personnalise d abord, puis grille par defaut', () => {
  assert.equal(nextStop(10, stops, 36).position, 100);
  assert.equal(nextStop(100, stops, 36).position, 200);
  assert.equal(nextStop(250, stops, 36).position, 300);
  assert.equal(nextStop(250, stops, 36).leader, 'dot');
  const d = nextStop(310, stops, 36);
  assert.equal(d.position, 324);
  assert.equal(d.align, 'left');
  assert.equal(nextStop(0, [], 36).position, 36);
  assert.equal(nextStop(36, [], 36).position, 72);
});

test('largeur selon l alignement du taquet', () => {
  const left = { position: 100, align: 'left' as const, leader: 'none' as const };
  assert.equal(tabWidth(40, left, 30, 0), 60);
  assert.equal(tabWidth(40, { ...left, align: 'right' }, 30, 0), 30);
  assert.equal(tabWidth(40, { ...left, align: 'center' }, 30, 0), 45);
  assert.equal(tabWidth(40, { ...left, align: 'decimal' }, 30, 12), 48);
  // Texte plus large que la place : jamais negatif.
  assert.equal(tabWidth(40, { ...left, align: 'right' }, 200, 0), 0);
});

test('poser et effacer un taquet', async () => {
  const { setStop, clearStop } = await import('../src/features/tabstops.ts');
  let tabs = setStop(undefined, { position: 200, align: 'right', leader: 'dot' });
  tabs = setStop(tabs, { position: 100, align: 'left' });
  assert.deepEqual(tabs.map((t) => t.position), [100, 200]);
  tabs = setStop(tabs, { position: 100.2, align: 'center' });
  assert.equal(tabs.length, 2);
  assert.equal(tabs[0]?.align, 'center');
  assert.deepEqual(clearStop(tabs, 200).map((t) => t.position), [100.2]);
});
