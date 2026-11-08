// Alignement vertical des pages : decalage par page, pages suivantes inchangees.
import test from 'node:test';
import assert from 'node:assert/strict';
import { alignPages } from '../src/layout/valign.ts';
import { paginate, type FlowBlock } from '../src/layout/paginate.ts';

const block = (i: number, top: number, bottom: number): FlowBlock => ({ pos: i * 10, top, bottom });
const geom = { contentHeight: 100, stride: 140, top: 20 };

test('centre : le contenu de chaque page descend de la moitie de l espace libre', () => {
  // 2 pages : 3 blocs de 30 (90 px) sur la page 1, 1 bloc de 30 sur la page 2.
  const blocks = [block(0, 0, 30), block(1, 30, 60), block(2, 60, 90), block(3, 90, 120)];
  const res = paginate(blocks.map((b) => ({ ...b })), geom);
  assert.equal(res.pageCount, 2);
  const none = alignPages(blocks, res, [100, 100], ['top', 'top']);
  assert.equal(none, res.gaps);
  const gaps = alignPages(blocks, res, [100, 100], ['center', 'center']);
  // page 1 : libre 10 -> +5 ; page 2 : libre 70 -> +35 ; espace avant page 2 : +35 - 5.
  assert.equal(gaps[0]!.pos, 0);
  assert.equal(gaps[0]!.height, 5);
  assert.equal(gaps[1]!.height, res.gaps[0]!.height + 30);
});

test('bas : tout l espace libre ; les pages suivantes gardent leur position', () => {
  const blocks = [block(0, 0, 30), block(1, 30, 60), block(2, 60, 90), block(3, 90, 120)];
  const res = paginate(blocks.map((b) => ({ ...b })), geom);
  const gaps = alignPages(blocks, res, [100, 100], ['bottom', 'bottom']);
  assert.equal(gaps[0]!.height, 10);
  assert.equal(gaps[1]!.height, res.gaps[0]!.height + 70 - 10);
  // La somme des decalages avant la page 2 reste celle de la page 2 : 10 + gap' = gap + 70.
  assert.equal(gaps[0]!.height + gaps[1]!.height, res.gaps[0]!.height + 70);
});

test('page unique centree et mix haut / centre', () => {
  const blocks = [block(0, 0, 40)];
  const res = paginate(blocks.map((b) => ({ ...b })), geom);
  assert.equal(alignPages(blocks, res, [100], ['center'])[0]!.height, 30);
  const two = [block(0, 0, 90), block(1, 90, 120)];
  const r2 = paginate(two.map((b) => ({ ...b })), geom);
  const g = alignPages(two, r2, [100, 100], ['top', 'center']);
  assert.equal(g.length, 1);
  assert.equal(g[0]!.height, r2.gaps[0]!.height + 35);
});
