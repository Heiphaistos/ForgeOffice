// Tri par couleur de cellule : les cellules de la couleur choisie passent en premier (ordre relatif conserve).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook, styleIdFor } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { cellColor, distinctColors, sortRange } from '../src/logic/data.ts';

function setup(): Draft {
  const d = new Draft(createBlankWorkbook());
  const red = styleIdFor(d.wb, { fill: { type: 'pattern', pattern: 'solid', fg: { rgb: 'FFFF0000' } } });
  const blue = styleIdFor(d.wb, { fill: { type: 'pattern', pattern: 'solid', fg: { rgb: 'FF0000FF' } } });
  ['t', 'a', 'b', 'c', 'd'].forEach((v, r) => {
    const e = parseEntry(v, false);
    if (e.ok) commitEntry(d, 0, r, 0, e);
  });
  for (const [r, style] of [[2, red], [4, red], [3, blue]] as const) {
    const c = d.get(0, r, 0);
    if (c) d.set(0, r, 0, { ...c, styleId: style });
  }
  return d;
}

test('tri par couleur : rouge d\'abord, ordre relatif conserve', () => {
  const d = setup();
  const range = { r1: 0, c1: 0, r2: 4, c2: 0 };
  assert.deepEqual(distinctColors(d.wb, 0, range, 0, true, 'fill'), ['FF0000', '0000FF']);
  const value = (r: number, c: number): string | number | boolean | null => {
    const v = d.get(0, r, c)?.value ?? null;
    return typeof v === 'object' && v !== null ? null : v;
  };
  sortRange(d, 0, range, [{ index: 0, descending: false, byColor: { rgb: 'FF0000', kind: 'fill' } }], true, value);
  assert.deepEqual([1, 2, 3, 4].map((r) => d.get(0, r, 0)?.value), ['b', 'd', 'a', 'c']);
  assert.equal(cellColor(d.wb, d.get(0, 1, 0), 'fill'), 'FF0000');
});
