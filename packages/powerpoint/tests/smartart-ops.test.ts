import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSmartArt, readSmartArt, type SmartArtItem } from '../src/app/smartart.ts';
import { addItem, moveItem, removeItem, shiftLevel, subtreeEnd } from '../src/app/smartart-ops.ts';

const it = (text: string, level = 0): SmartArtItem => ({ text, level });
const tree = [it('A'), it('A1', 1), it('A1a', 2), it('A2', 1), it('B'), it('B1', 1)];
const names = (items: readonly SmartArtItem[]): string => items.map((i) => `${'-'.repeat(i.level)}${i.text}`).join(' ');

test('sous-arbre, ajout et retrait', () => {
  assert.equal(subtreeEnd(tree, 0), 4);
  assert.equal(subtreeEnd(tree, 1), 3);
  assert.equal(names(addItem(tree, 0)), 'A -A1 --A1a -A2 Nouvel élément B -B1');
  assert.equal(names(addItem(tree)).endsWith('-Nouvel élément'), true);
  assert.equal(names(removeItem(tree, 1)), 'A -A2 B -B1');
});

test('promouvoir et abaisser : sous-arbre entraine, bornes respectees', () => {
  assert.equal(names(shiftLevel(tree, 3, -1)), 'A -A1 --A1a A2 B -B1');
  assert.equal(names(shiftLevel(tree, 4, 1)), 'A -A1 --A1a -A2 -B -B1'.replace('-B -B1', '-B --B1'));
  assert.equal(names(shiftLevel(tree, 0, 1)), names(tree));
  assert.equal(names(shiftLevel(tree, 0, -1)), names(tree));
  assert.equal(names(shiftLevel(tree, 2, 1)), names(tree));
});

test('deplacer : bloc entier avant le frere precedent ou apres le suivant', () => {
  assert.equal(names(moveItem(tree, 4, -1)), 'B -B1 A -A1 --A1a -A2');
  assert.equal(names(moveItem(tree, 0, 1)), 'B -B1 A -A1 --A1a -A2');
  assert.equal(names(moveItem(tree, 3, -1)), 'A -A2 -A1 --A1a B -B1');
  assert.equal(names(moveItem(tree, 0, -1)), names(tree));
  assert.equal(names(moveItem(tree, 4, 1)), names(tree));
});

test('cycle : boites sur un cercle, fleches, couleurs d accentuation et relecture', () => {
  const area = { x: 0, y: 0, width: 600, height: 400 };
  const group = buildSmartArt('cycle', [it('Un'), it('Deux'), it('Trois'), it('Quatre')], area, 10, 3);
  assert.equal(group.title, 'smartart:cycle:a3');
  const boxes = group.children.filter((c) => c.kind === 'shape' && c.geometry.type === 'preset' && c.geometry.preset === 'roundRect');
  const arrows = group.children.filter((c) => c.kind === 'shape' && c.geometry.type === 'preset' && c.geometry.preset === 'rightArrow');
  assert.equal(boxes.length, 4);
  assert.equal(arrows.length, 4);
  const back = readSmartArt(group);
  assert.deepEqual([back?.kind, back?.accent, back?.items.map((i) => i.text)], ['cycle', 3, ['Un', 'Deux', 'Trois', 'Quatre']]);
  const first = boxes[0]?.kind === 'shape' && boxes[0].fill?.type === 'solid' ? boxes[0].fill.color : null;
  assert.deepEqual(first, { type: 'scheme', value: 'accent3' });
  assert.equal(readSmartArt(buildSmartArt('list', [it('x')], area, 1))?.accent, 1);
});
