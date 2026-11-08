// Formes : creation, noms uniques, zone de texte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, newShape, shapeName } from '../src/logic/shapes.ts';

test('forme : remplissage, ancrage et nom unique', () => {
  const s = newShape('rect', { row: 2, col: 3 }, shapeName('Rectangle', [{ name: 'Rectangle 1' }]));
  assert.equal(s.name, 'Rectangle 2');
  assert.equal(s.geometry, 'rect');
  assert.equal(s.fill?.color, '156082');
  assert.equal(s.anchor.type === 'oneCell' && s.anchor.from.row, 2);
});

test('zone de texte : sans remplissage ni contour ; ligne : connecteur', () => {
  const t = newShape('rect', { row: 0, col: 0 }, 'Zone de texte 1', true);
  assert.deepEqual([t.fill?.none, t.line?.none, t.text], [true, true, '']);
  const l = newShape('line', { row: 0, col: 0 }, 'Ligne 1');
  assert.equal(l.connector, true);
  assert.ok(SHAPES.every((s) => s.id !== 'triangle' || s.points));
});

test('ordre d\'empilement', async () => {
  const { arrangeDrawing } = await import('../src/logic/shapes.ts');
  const l = ['a', 'b', 'c'].map((name) => newShape('rect', { row: 0, col: 0 }, name));
  const names = (x: { name: string }[]): string => x.map((d) => d.name).join('');
  assert.equal(names(arrangeDrawing(l, 0, 'front')), 'bca');
  assert.equal(names(arrangeDrawing(l, 2, 'back')), 'cab');
  assert.equal(names(arrangeDrawing(l, 0, 'forward')), 'bac');
  assert.equal(names(arrangeDrawing(l, 2, 'backward')), 'acb');
});

test('redimensionnement par les 8 poignees : bord oppose fixe, taille minimale', async () => {
  const { resizeBox } = await import('../src/logic/shapes.ts');
  const b = { x: 100, y: 100, w: 80, h: 40 };
  assert.deepEqual(resizeBox(b, 'se', 10, 20), { x: 100, y: 100, w: 90, h: 60 });
  assert.deepEqual(resizeBox(b, 'nw', 10, 10), { x: 110, y: 110, w: 70, h: 30 });
  assert.deepEqual(resizeBox(b, 'w', -20, 99), { x: 80, y: 100, w: 100, h: 40 });
  assert.deepEqual(resizeBox(b, 'n', 5, -30), { x: 100, y: 70, w: 80, h: 70 });
  assert.deepEqual(resizeBox(b, 'nw', 500, 500), { x: 156, y: 124, w: 24, h: 16 }, 'taille minimale, coin oppose fixe');
});

test('rotation libre : angle depuis le centre, pas de 15 degres', async () => {
  const { rotationFrom } = await import('../src/logic/shapes.ts');
  const c = { x: 100, y: 100 };
  assert.equal(rotationFrom(c, { x: 100, y: 50 }), 0);
  assert.equal(rotationFrom(c, { x: 150, y: 100 }), 90);
  assert.equal(rotationFrom(c, { x: 100, y: 150 }), 180);
  assert.equal(rotationFrom(c, { x: 50, y: 100 }), 270);
  assert.equal(rotationFrom(c, { x: 140, y: 55 }, 15), 45);
});
