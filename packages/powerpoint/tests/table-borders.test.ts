import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Line, TableShape } from '@forgeoffice/pptx';
import { ALL_SIDES, INSIDE_SIDES, NO_LINE, OUTSIDE_SIDES, applyBorders } from '../src/app/table-borders.ts';

const cell = () => ({ text: { props: {}, paragraphs: [] } });
const table = (): TableShape => ({ kind: 'table', id: 1, name: 't', table: { columns: [1, 1, 1], rows: [0, 1, 2].map(() => ({ height: 1, cells: [cell(), cell(), cell()] })) } }) as unknown as TableShape;
const red: Line = { width: 2, dash: 'dash', fill: { type: 'solid', color: { type: 'rgb', value: 'FF0000' } } };
const b = (t: TableShape, r: number, c: number) => t.table.rows[r]?.cells[c]?.borders ?? {};

test('bordure du haut : la cellule du dessus recoit l arete du bas', () => {
  const t = table();
  applyBorders(t, { r0: 1, c0: 0, r1: 1, c1: 2 }, ['top'], red);
  assert.deepEqual(b(t, 1, 1).top, red);
  assert.deepEqual(b(t, 0, 1).bottom, red);
  assert.equal(b(t, 1, 1).bottom, undefined);
});

test('exterieures + interieures sur une plage 2x2', () => {
  const t = table();
  applyBorders(t, { r0: 0, c0: 0, r1: 1, c1: 1 }, INSIDE_SIDES, red);
  assert.deepEqual(b(t, 0, 0).bottom, red);
  assert.deepEqual(b(t, 1, 0).top, red);
  assert.deepEqual(b(t, 0, 0).right, red);
  assert.equal(b(t, 0, 0).top, undefined);
  applyBorders(t, { r0: 0, c0: 0, r1: 1, c1: 1 }, OUTSIDE_SIDES, red);
  assert.deepEqual(b(t, 0, 0).top, red);
  assert.deepEqual(b(t, 1, 1).right, red);
  assert.deepEqual(b(t, 1, 2).left, red);
});

test('sans bordure sur tout : toutes les aretes passent a aucune', () => {
  const t = table();
  applyBorders(t, { r0: 0, c0: 0, r1: 2, c1: 2 }, ALL_SIDES, NO_LINE);
  assert.deepEqual(b(t, 1, 1).top, NO_LINE);
  assert.deepEqual(b(t, 2, 2).right, NO_LINE);
});
