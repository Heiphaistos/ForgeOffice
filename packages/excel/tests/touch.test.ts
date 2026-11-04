import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectionHandles, isDoubleTap, momentumStep } from '../src/logic/touch.ts';

test('poignees de selection : debut et fin decales vers l exterieur, recopie au milieu du bord bas', () => {
  const h = selectionHandles({ x1: 100, y1: 50, x2: 200, y2: 90 });
  assert.deepEqual(h.map((x) => x.id), ['tl', 'br', 'fill']);
  assert.deepEqual(h[0], { id: 'tl', x: 90, y: 40 });
  assert.deepEqual(h[1], { id: 'br', x: 210, y: 100 });
  assert.deepEqual(h[2], { id: 'fill', x: 150, y: 90 });
});

test('poignee de recopie d une cellule etroite : reste dans la plage', () => {
  const h = selectionHandles({ x1: 10, y1: 10, x2: 20, y2: 30 });
  const fill = h.find((x) => x.id === 'fill');
  assert.ok(fill && fill.x >= 10 && fill.x <= 20);
});

test('double toucher : delai et distance', () => {
  const a = { t: 1000, x: 50, y: 50 };
  assert.equal(isDoubleTap(a, { t: 1200, x: 55, y: 52 }), true);
  assert.equal(isDoubleTap(a, { t: 1500, x: 50, y: 50 }), false);
  assert.equal(isDoubleTap(a, { t: 1100, x: 120, y: 50 }), false);
  assert.equal(isDoubleTap(null, a), false);
});

test('inertie : la vitesse decroit jusqu a l arret et le deplacement suit le signe', () => {
  let v = 2;
  let total = 0;
  for (let i = 0; i < 400 && v !== 0; i++) {
    const s = momentumStep(v, 16);
    assert.ok(Math.abs(s.v) <= Math.abs(v));
    total += s.dist;
    v = s.v;
  }
  assert.equal(v, 0);
  assert.ok(total > 0);
  assert.ok(momentumStep(-1, 16).dist < 0);
});
