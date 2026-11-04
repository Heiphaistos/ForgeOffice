import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AutoShape, GroupShape, Shape } from '@forgeoffice/pptx';
import {
  alignShapes, childToParent, deleteShapes, distributeShapes, duplicateShapes, flipShapes, groupShapes, locate, moveShapes, pageBox, parentToChild, reorder, setPageBox, ungroup,
} from '../src/canvas/ops.ts';

const rect = (id: number, x: number, y: number, width = 100, height = 50, rotation?: number): AutoShape => ({
  kind: 'shape', id, name: `R${id}`, geometry: { type: 'preset', preset: 'rect' }, xfrm: rotation ? { x, y, width, height, rotation } : { x, y, width, height },
});

const ids = (shapes: Shape[]): number[] => shapes.map((s) => s.id);
const near = (a: number, b: number, eps = 1e-3): void => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('ordre : premier plan, arriere-plan, avancer, reculer', () => {
  const shapes: Shape[] = [rect(2, 0, 0), rect(3, 0, 0), rect(4, 0, 0), rect(5, 0, 0)];
  reorder(shapes, [3], 'front');
  assert.deepEqual(ids(shapes), [2, 4, 5, 3]);
  reorder(shapes, [3], 'back');
  assert.deepEqual(ids(shapes), [3, 2, 4, 5]);
  reorder(shapes, [3], 'forward');
  assert.deepEqual(ids(shapes), [2, 3, 4, 5]);
  reorder(shapes, [4, 5], 'backward');
  assert.deepEqual(ids(shapes), [2, 4, 5, 3]);
});

test('grouper puis dissocier conserve les positions dans la page', () => {
  const shapes: Shape[] = [rect(2, 10, 10), rect(3, 200, 100, 50, 50, 45), rect(4, 500, 500)];
  const g = groupShapes(shapes, [2, 3], 'Groupe');
  assert.equal(g, 5);
  assert.deepEqual(ids(shapes), [5, 4]);
  const group = shapes[0] as GroupShape;
  assert.equal(group.children.length, 2);
  const before = pageBox(locate(shapes, 3) as never);
  near(before?.x ?? NaN, 200);
  near(before?.rotation ?? NaN, 45);
  moveShapes(shapes, [5], 100, 0);
  const moved = pageBox(locate(shapes, 3) as never);
  near(moved?.x ?? NaN, 300);
  const children = ungroup(shapes, 5);
  assert.deepEqual(children, [2, 3]);
  assert.deepEqual(ids(shapes), [2, 3, 4]);
  near(shapes[1]?.xfrm?.x ?? NaN, 300);
  near(shapes[1]?.xfrm?.rotation ?? NaN, 45);
});

test('repere de groupe : aller-retour avec echelle, rotation et miroir', () => {
  const g: GroupShape = { kind: 'group', id: 9, name: 'G', xfrm: { x: 100, y: 50, width: 400, height: 200, rotation: 30, flipH: true }, childOffset: { x: 0, y: 0 }, childExtent: { width: 200, height: 100 }, children: [] };
  const box = { x: 20, y: 10, width: 40, height: 30, rotation: 10 };
  const page = childToParent(g, box);
  near(page.width, 80);
  near(page.height, 60);
  const back = parentToChild(g, page);
  near(back.x, 20);
  near(back.y, 10);
  near(back.rotation ?? 0, 10);
  assert.equal(back.flipH ?? false, false);
});

test('deplacement d un enfant de groupe et reajustement du groupe', () => {
  const shapes: Shape[] = [rect(2, 0, 0), rect(3, 100, 0)];
  groupShapes(shapes, [2, 3], 'Groupe');
  const found = locate(shapes, 3);
  assert.ok(found);
  setPageBox(found, { x: 300, y: 0, width: 100, height: 50 });
  const group = shapes[0] as GroupShape;
  near(group.xfrm?.width ?? NaN, 400);
  near(pageBox(locate(shapes, 3) as never)?.x ?? NaN, 300);
  near(pageBox(locate(shapes, 2) as never)?.x ?? NaN, 0);
});

test('alignement, distribution, duplication, suppression, retournement', () => {
  const shapes: Shape[] = [rect(2, 0, 0, 10, 10), rect(3, 50, 30, 10, 10), rect(4, 200, 60, 10, 10)];
  alignShapes(shapes, [2, 3, 4], 'top');
  assert.deepEqual(shapes.map((s) => s.xfrm?.y), [0, 0, 0]);
  distributeShapes(shapes, [2, 3, 4], 'h');
  assert.deepEqual(shapes.map((s) => s.xfrm?.x), [0, 100, 200]);
  alignShapes(shapes, [3], 'center', { width: 960, height: 540 });
  assert.equal(shapes[1]?.xfrm?.x, 475);
  const copies = duplicateShapes(shapes, [2], { x: 10, y: 10 });
  assert.deepEqual(copies, [5]);
  assert.equal(shapes[3]?.xfrm?.x, 10);
  flipShapes(shapes, [5], 'h');
  assert.equal(shapes[3]?.xfrm?.flipH, true);
  deleteShapes(shapes, [5, 3]);
  assert.deepEqual(ids(shapes), [2, 4]);
});
