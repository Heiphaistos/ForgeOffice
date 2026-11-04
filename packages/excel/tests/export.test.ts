// Fabrique un classeur complet avec la logique du Tableur et l'enregistre en .xlsx (verifie ensuite dans Excel).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createBlankWorkbook, getCell, readWorkbook } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { applyBorders, applyPatch, mergeCells, solidFill } from '../src/logic/styles.ts';
import { makeTable } from '../src/logic/tables.ts';
import { buildChart } from '../src/logic/charts.ts';
import { WorkbookEngine } from '../src/logic/engine.ts';
import { serialize } from '../src/ui/io.ts';

test('classeur complet enregistre en xlsx puis relu', async () => {
  const d = new Draft(createBlankWorkbook());
  const rows = [
    ['Mois', 'Ventes', 'Coûts', 'Marge', 'Taux'],
    ['janvier', '12500', '8200', '=B3-C3', '=D3/B3'],
    ['février', '14200', '9100', '=B4-C4', '=D4/B4'],
    ['mars', '13800', '8700', '=B5-C5', '=D5/B5'],
    ['Total', '=SOMME(B3:B5)', '=SOMME(C3:C5)', '=SOMME(D3:D5)', '=SI(B6>0;D6/B6;0)'],
  ];
  rows.forEach((line, r) => line.forEach((t, c) => {
    const e = parseEntry(t);
    if (!e.ok) throw new Error(e.message);
    commitEntry(d, 0, r + 1, c, e);
  }));
  const t1 = parseEntry('Rapport trimestriel');
  if (t1.ok) commitEntry(d, 0, 0, 0, t1);
  mergeCells(d, 0, [{ r1: 0, c1: 0, r2: 0, c2: 4 }], 'center');
  applyPatch(d, 0, [{ r1: 0, c1: 0, r2: 0, c2: 4 }], { font: { bold: true, size: 14 } });
  applyPatch(d, 0, [{ r1: 2, c1: 4, r2: 5, c2: 4 }], { numberFormat: '0.0%' });
  applyPatch(d, 0, [{ r1: 5, c1: 0, r2: 5, c2: 4 }], { font: { bold: true }, fill: solidFill('E2EFDA') });
  applyBorders(d, 0, [{ r1: 5, c1: 0, r2: 5, c2: 4 }], 'topBottomDouble');
  const sh = d.sheet(0);
  sh.view = { ...sh.view, frozen: { rows: 2, cols: 0 } };
  sh.conditionalFormats = [{ ranges: [{ r1: 2, c1: 1, r2: 4, c2: 1 }], rules: [{ type: 'dataBar', priority: 1, dataBar: { cfvos: [{ type: 'min' }, { type: 'max' }], color: { rgb: 'FF638EC6' } } }] }];
  sh.dataValidations = [{ ranges: [{ r1: 7, c1: 0, r2: 7, c2: 0 }], type: 'list', formula1: '"Oui,Non"', allowBlank: true, inCellDropdown: true }];
  const eng = new WorkbookEngine();
  eng.sync(d.wb);
  const valueAt = (r: number, c: number) => eng.value('Feuil1', r, c);
  const table = makeTable(d.wb, { r1: 1, c1: 0, r2: 4, c2: 4 }, true, 'TableStyleMedium2', valueAt, (i) => `Colonne${i}`);
  sh.tables = [table];
  sh.drawings = [{ kind: 'chart', name: 'Graphique 1', anchor: { type: 'twoCell', from: { col: 6, colOffset: 0, row: 1, rowOffset: 0 }, to: { col: 13, colOffset: 0, row: 16, rowOffset: 0 } }, chart: buildChart('col', 'Feuil1', { r1: 1, c1: 0, r2: 4, c2: 2 }, valueAt, 'Ventes et coûts') }];
  eng.sync(d.wb);
  assert.equal(eng.value('Feuil1', 5, 3), 14500);
  const bytes = await serialize(d.wb, eng, 'xlsx', 0);
  const out = process.env.XL_EXPORT;
  if (out) writeFileSync(out, bytes);
  const back = await readWorkbook(bytes, 'rapport.xlsx');
  const s = back.sheets[0];
  assert.ok(s);
  assert.equal(getCell(s, 5, 1)?.formula, 'SUM(B3:B5)');
  assert.equal(getCell(s, 5, 1)?.value, 40500);
  assert.equal(s.merges.length, 1);
  assert.equal(s.tables.length, 1);
  assert.equal(s.drawings[0]?.kind, 'chart');
  assert.deepEqual(s.view.frozen, { rows: 2, cols: 0 });
});
