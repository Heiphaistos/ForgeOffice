import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  alignOffsets, boundsOf, distributeOffsets, fitZoom, handlePoint, hitBox, resizeBox, rotatePoint, rotationFromPoint, snapMove, snapPoint, toLocal,
} from '../src/canvas/math.ts';

const near = (a: number, b: number, eps = 1e-6): void => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('rotation de point et rectangle englobant', () => {
  const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
  near(p.x, 0);
  near(p.y, 10);
  const b = boundsOf({ x: 0, y: 0, width: 100, height: 20, rotation: 90 });
  near(b.x, 40);
  near(b.y, -40);
  near(b.width, 20);
  near(b.height, 100);
});

test('test de clic dans une boite tournee', () => {
  const box = { x: 0, y: 0, width: 100, height: 20, rotation: 90 };
  assert.equal(hitBox(box, { x: 50, y: -30 }), true);
  assert.equal(hitBox(box, { x: 5, y: 10 }), false);
  assert.equal(hitBox(box, { x: 50, y: -41 }, 2), true);
  assert.equal(hitBox(box, { x: 50, y: -45 }, 2), false);
  const local = toLocal(box, { x: 50, y: -40 });
  near(local.x, 0);
  near(local.y, 10);
});

test('redimensionnement sans rotation : coin oppose fixe, proportions, centre', () => {
  const box = { x: 10, y: 10, width: 100, height: 50 };
  const r = resizeBox(box, 'se', { x: 210, y: 110 });
  assert.deepEqual([r.x, r.y, r.width, r.height], [10, 10, 200, 100]);
  const k = resizeBox(box, 'se', { x: 310, y: 70 }, { keepAspect: true });
  near(k.width / k.height, 2);
  near(k.width, 300);
  const c = resizeBox(box, 'e', { x: 160, y: 0 }, { fromCenter: true });
  near(c.x, -40);
  near(c.width, 200);
  const w = resizeBox(box, 'w', { x: 0, y: 30 });
  near(w.x, 0);
  near(w.width, 110);
});

test('redimensionnement avec rotation : le coin oppose ne bouge pas dans la page', () => {
  const box = { x: 100, y: 100, width: 200, height: 100, rotation: 30 };
  const anchor = handlePoint(box, 'nw');
  const a = (30 * Math.PI) / 180;
  const target = { x: anchor.x + 260 * Math.cos(a) - 140 * Math.sin(a), y: anchor.y + 260 * Math.sin(a) + 140 * Math.cos(a) };
  const r = resizeBox(box, 'se', target);
  near(r.width, 260, 1e-6);
  near(r.height, 140, 1e-6);
  const after = handlePoint(r, 'nw');
  near(after.x, anchor.x);
  near(after.y, anchor.y);
  assert.equal(r.rotation, 30);
});

test('redimensionnement au-dela du cote oppose : retournement', () => {
  const r = resizeBox({ x: 0, y: 0, width: 100, height: 100 }, 'e', { x: -50, y: 50 });
  assert.equal(r.flipH, true);
  near(r.x, -50);
  near(r.width, 50);
});

test('rotation depuis la poignee, avec pas de 15 degres', () => {
  const box = { x: 0, y: 0, width: 100, height: 100 };
  near(rotationFromPoint(box, { x: 50, y: -100 }), 0);
  near(rotationFromPoint(box, { x: 200, y: 50 }), 90);
  near(rotationFromPoint(box, { x: 200, y: 60 }, 15), 90);
  near(rotationFromPoint(box, { x: -100, y: 50 }), 270);
});

test('magnetisme : bord, centre de page et reperes', () => {
  const targets = { shapes: [{ x: 300, y: 0, width: 100, height: 100 }], page: { width: 960, height: 540 } };
  const left = snapMove({ x: 296, y: 200, width: 50, height: 50 }, targets, 6);
  near(left.dx, 4);
  assert.ok(left.guides.some((g) => g.orientation === 'v' && g.at === 300));
  const mid = snapMove({ x: 452, y: 400, width: 60, height: 40 }, targets, 6);
  near(mid.dx, -2);
  const none = snapMove({ x: 600, y: 300, width: 10, height: 10 }, targets, 3);
  assert.equal(none.guides.length, 0);
  const grid = snapMove({ x: 603, y: 303, width: 10, height: 10 }, { ...targets, grid: 10 }, 1);
  near(grid.dx, -3);
  const pt = snapPoint({ x: 478, y: 10 }, targets, 4);
  near(pt.point.x, 480);
});

test('magnetisme : espacement egal entre deux voisins', () => {
  const targets = { shapes: [{ x: 0, y: 0, width: 100, height: 50 }, { x: 300, y: 0, width: 100, height: 50 }], page: { width: 2000, height: 2000 } };
  const r = snapMove({ x: 172, y: 10, width: 50, height: 30 }, targets, 4);
  near(172 + r.dx, 175);
  assert.ok(r.guides.some((g) => g.spacing));
});

test('alignement et distribution', () => {
  const rects = [{ x: 10, y: 0, width: 10, height: 10 }, { x: 50, y: 20, width: 30, height: 10 }];
  const left = alignOffsets(rects, 'left', { x: 10, y: 0, width: 70, height: 30 });
  assert.deepEqual(left, [{ x: 0, y: 0 }, { x: -40, y: 0 }]);
  const middle = alignOffsets(rects, 'middle', { x: 0, y: 0, width: 100, height: 100 });
  assert.deepEqual(middle, [{ x: 0, y: 45 }, { x: 0, y: 25 }]);
  const three = [{ x: 0, y: 0, width: 10, height: 1 }, { x: 15, y: 0, width: 10, height: 1 }, { x: 90, y: 0, width: 10, height: 1 }];
  const d = distributeOffsets(three, 'h');
  assert.deepEqual(d.map((p) => p.x), [0, 30, 0]);
  const page = distributeOffsets([{ x: 0, y: 0, width: 10, height: 10 }], 'v', { x: 0, y: 0, width: 100, height: 100 });
  near(page[0]?.y ?? NaN, 45);
});

test('zoom ajuste a la fenetre', () => {
  assert.equal(fitZoom({ width: 960, height: 540 }, { width: 1328, height: 768 }, 24), 100);
});
