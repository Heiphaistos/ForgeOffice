// Ligne Total d'un tableau : fonction par colonne.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { makeTable, setTotalFunction } from '../src/logic/tables.ts';

test('fonction de total : Moyenne puis Aucun', () => {
  const d = new Draft(createBlankWorkbook());
  const t = { ...makeTable(d.wb, { r1: 0, c1: 0, r2: 4, c2: 1 }, true, 'TableStyleMedium2', () => 'h', (i) => `Col${i}`), totalsRowCount: 1, ref: { r1: 0, c1: 0, r2: 4, c2: 1 } };
  d.sheet(0).tables = [t];
  const a = setTotalFunction(d, 0, t, 1, 'average');
  assert.equal(d.get(0, 4, 1)?.formula, 'SUBTOTAL(101,B2:B4)');
  assert.equal(a.columns[1]?.totalsRowFunction, 'average');
  const b = setTotalFunction(d, 0, a, 1, 'none');
  assert.equal(d.get(0, 4, 1), undefined);
  assert.equal(b.columns[1]?.totalsRowFunction, 'none');
  assert.equal(d.sheet(0).tables[0], b);
});
