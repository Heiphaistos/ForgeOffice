import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flatten, parseSvgPath, type SubPath } from '../src/canvas/path-edit/model.ts';
import { deleteNode, insertNode, moveHandle, moveNode, nearestOnPath, nodeKind, setClosed, setNodeKind, setSegmentKind } from '../src/canvas/path-edit/ops.ts';

const arc: SubPath[] = parseSvgPath('M0 0 C0 40 60 40 60 0');
const square: SubPath[] = parseSvgPath('M0 0 L10 0 L10 10 L0 10 Z');

test('analyse : courbe cubique et contour ferme', () => {
  assert.equal(arc[0]?.nodes.length, 2);
  assert.ok(arc[0]?.nodes[0]?.outH && arc[0]?.nodes[1]?.inH);
  assert.equal(square[0]?.closed, true);
  assert.equal(square[0]?.nodes.length, 4);
});

test('inserer un noeud sur une courbe ne change pas sa forme', () => {
  const before = flatten(arc[0] as SubPath, 0.05);
  const after = flatten(insertNode(arc, 0, 0, 0.5)[0] as SubPath, 0.05);
  const maxDist = Math.max(...before.map((p) => Math.min(...after.map((q) => Math.hypot(p.x - q.x, p.y - q.y)))));
  assert.ok(maxDist < 1.5, String(maxDist));
  assert.equal(insertNode(arc, 0, 0, 0.5)[0]?.nodes.length, 3);
});

test('inserer sur un segment droit coupe au point demande', () => {
  const r = insertNode(square, 0, 0, 0.25);
  assert.deepEqual([r[0]?.nodes[1]?.x, r[0]?.nodes[1]?.y], [2.5, 0]);
});

test('deplacer un noeud emporte ses poignees', () => {
  const r = moveNode(arc, 0, 0, 5, 7);
  assert.deepEqual([r[0]?.nodes[0]?.x, r[0]?.nodes[0]?.outH?.x, r[0]?.nodes[0]?.outH?.y], [5, 5, 47]);
  assert.equal(arc[0]?.nodes[0]?.x, 0);
});

test('poignee d un noeud lisse : l autre poignee reste alignee', () => {
  const smooth = setNodeKind(insertNode(arc, 0, 0, 0.5), 0, 1, 'smooth');
  assert.notEqual(nodeKind(smooth[0]?.nodes[1] as never), 'corner');
  const moved = moveHandle(smooth, 0, 1, 'outH', { x: 50, y: 60 }, 'smooth');
  assert.equal(nodeKind(moved[0]?.nodes[1] as never), 'smooth');
  const sym = moveHandle(setNodeKind(smooth, 0, 1, 'symmetric'), 0, 1, 'outH', { x: 40, y: 60 }, 'symmetric');
  const n = sym[0]?.nodes[1];
  assert.equal(nodeKind(n as never), 'symmetric');
});

test('point d angle : poignees retirees ; segment droit puis courbe', () => {
  const corner = setNodeKind(arc, 0, 0, 'corner');
  assert.equal(corner[0]?.nodes[0]?.outH, undefined);
  const line = setSegmentKind(arc, 0, 0, 'line');
  assert.ok(!line[0]?.nodes[0]?.outH && !line[0]?.nodes[1]?.inH);
  assert.ok(setSegmentKind(line, 0, 0, 'curve')[0]?.nodes[0]?.outH);
});

test('supprimer un noeud, un contour trop court disparait, ouvrir un contour ferme', () => {
  assert.equal(deleteNode(square, 0, 2)[0]?.nodes.length, 3);
  assert.equal(deleteNode(deleteNode(arc, 0, 0), 0, 0).length, 0);
  assert.equal(setClosed(square, 0, false)[0]?.closed, false);
});

test('point le plus proche du contour', () => {
  const near = nearestOnPath(square, { x: 5, y: -2 });
  assert.ok(near && near.seg === 0 && Math.abs(near.t - 0.5) < 0.01 && Math.abs(near.distance - 2) < 1e-6);
});
