// Options de recopie incrementee : copier, serie, formats seuls, sans formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook, styleIdFor } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { applyFillMode, snapshotFill } from '../src/logic/fill-options.ts';

function setup(): { d: Draft; style: number } {
  const d = new Draft(createBlankWorkbook());
  const e = parseEntry('1', false);
  if (e.ok) commitEntry(d, 0, 0, 0, e);
  const style = styleIdFor(d.wb, { numberFormat: '0.00' });
  const e2 = parseEntry('2', false);
  if (e2.ok) commitEntry(d, 0, 1, 0, e2);
  for (const r of [0, 1]) {
    const c = d.get(0, r, 0);
    if (c) d.set(0, r, 0, { ...c, styleId: style });
  }
  return { d, style };
}
const src = { r1: 0, c1: 0, r2: 1, c2: 0 };
const target = { r1: 0, c1: 0, r2: 3, c2: 0 };

test('modes : serie, copie, formats seuls, sans formats', () => {
  const { d, style } = setup();
  const before = snapshotFill(d, 0, src, target);
  assert.equal(before.length, 2);
  const at = (r: number) => d.get(0, r, 0);
  assert.equal(applyFillMode(d, 0, src, target, 'copy', before), true);
  assert.deepEqual([at(2)?.value, at(3)?.value], [1, 2]);
  // Refaire en serie : A3 = 3, A4 = 4 (la zone est remise a zero avant)
  applyFillMode(d, 0, src, target, 'series', before);
  assert.deepEqual([at(2)?.value, at(3)?.value, at(2)?.styleId], [3, 4, style]);
  applyFillMode(d, 0, src, target, 'formats', before);
  assert.equal(at(2)?.value, null, 'formats seuls : pas de valeur');
  assert.equal(at(2)?.styleId, style);
  applyFillMode(d, 0, src, target, 'noFormats', before);
  assert.deepEqual([at(2)?.value, at(3)?.value, at(2)?.styleId], [3, 4, undefined]);
});
