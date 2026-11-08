// Plan de lignes : groupes, repli/depli, boutons de niveau.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { RowInfo, Sheet } from '@forgeoffice/xlsx';
import { maxLevel, rowGroups, setGroupCollapsed, showLevel } from '../src/logic/outline.ts';

// lignes 1-2 niveau 1 ; lignes 4-5 niveau 1 dont 5 niveau 2 (sous-groupe)
const make = (): Map<number, RowInfo> => new Map([[1, { outlineLevel: 1 }], [2, { outlineLevel: 1 }], [4, { outlineLevel: 1 }], [5, { outlineLevel: 2 }]]);

test('groupes par niveau et ligne de synthese', () => {
  const g = rowGroups(make());
  assert.deepEqual(g.map((x) => [x.start, x.end, x.level, x.summary]), [[1, 2, 1, 3], [4, 5, 1, 6], [5, 5, 2, 6]]);
  assert.equal(maxLevel(make()), 2);
});

test('replier / deplier un groupe, sous-groupe replie conserve', () => {
  const rows = make();
  const outer = rowGroups(rows)[1]!;
  setGroupCollapsed(rows, rowGroups(rows)[2]!, true);
  assert.equal(rows.get(5)?.hidden, true);
  setGroupCollapsed(rows, outer, true);
  assert.deepEqual([rows.get(4)?.hidden, rows.get(5)?.hidden, rows.get(6)?.collapsed], [true, true, true]);
  setGroupCollapsed(rows, rowGroups(rows)[1]!, false);
  assert.deepEqual([rows.get(4)?.hidden, rows.get(5)?.hidden], [false, true], 'la ligne 5 reste masquee (sous-groupe replie)');
});

test('boutons de niveau', () => {
  const rows = make();
  showLevel(rows, 1);
  assert.deepEqual([1, 2, 4, 5].map((i) => rows.get(i)?.hidden), [true, true, true, true]);
  showLevel(rows, 2);
  assert.deepEqual([1, 2, 4, 5].map((i) => rows.get(i)?.hidden), [false, false, false, true]);
  showLevel(rows, 3);
  assert.deepEqual([1, 2, 4, 5].map((i) => rows.get(i)?.hidden), [false, false, false, false]);
});

test('colonnes : groupes lus depuis les plages, repli reporte dans la liste', async () => {
  const { colsAsRows, writeColsBack } = await import('../src/logic/outline.ts');
  const cols: Sheet['cols'] = [{ min: 1, max: 2, outlineLevel: 1 }, { min: 3, max: 3, width: 12 }];
  const m = colsAsRows(cols);
  const [g] = rowGroups(m);
  assert.deepEqual([g?.start, g?.end, g?.summary], [1, 2, 3]);
  setGroupCollapsed(m, g!, true);
  writeColsBack(cols, m);
  assert.equal(cols.find((c) => c.min === 1)?.hidden, true);
  assert.equal(cols.find((c) => c.min === 2)?.hidden, true);
  assert.equal(cols.find((c) => c.min === 3)?.collapsed, true);
  assert.equal(cols.find((c) => c.min === 3)?.width, 12, 'la largeur de la colonne de synthese est conservee');
});

test('plan automatique : lignes sommees juste au-dessus d\'une ligne de total', async () => {
  const { autoOutlineRows } = await import('../src/logic/outline.ts');
  const cell = (formula?: string) => (formula ? { value: null, formula } : { value: 1 });
  const cells = new Map([
    [0, new Map([[0, cell()]])], [1, new Map([[0, cell()]])], [2, new Map([[0, cell('SUM(A1:A2)')]])],
    [3, new Map([[0, cell()]])], [4, new Map([[0, cell('SUBTOTAL(9,A4:A4)')]])],
    [5, new Map([[0, cell('SUM(A1:A2,A4:A5)')]])],
  ]);
  const rows = new Map<number, RowInfo>();
  const n = autoOutlineRows({ cells, rows });
  assert.equal(n, 1, 'seule la somme A1:A2 (ligne 3) est juste au-dessus de sa synthese');
  assert.deepEqual([0, 1, 2, 3].map((i) => rows.get(i)?.outlineLevel ?? 0), [1, 1, 0, 0]);
});
