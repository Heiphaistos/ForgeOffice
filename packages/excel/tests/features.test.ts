import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook, getCell, readWorkbook, writeWorkbook, type Workbook } from '@forgeoffice/xlsx';
import type { Scalar } from '@forgeoffice/formulas';
import { Draft } from '../src/logic/draft.ts';
import { WorkbookEngine, rangeValues, withCachedValues } from '../src/logic/engine.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { CfEvaluator } from '../src/logic/condfmt.ts';
import { buildChart, kindOf, niceScale, resolveChart, withKind } from '../src/logic/charts.ts';
import { isValid, listItems } from '../src/logic/validation.ts';
import { computePivot, writePivot } from '../src/logic/pivot.ts';
import { layout, rowAt, colAt, scrollToShow, type Viewport } from '../src/logic/viewport.ts';
import { colAxis, rowAxis } from '../src/logic/geometry.ts';
import { applyBorders, applyPatch, fontOf, mergeCells } from '../src/logic/styles.ts';
import { makeTable, tableLook, tableStyleParts } from '../src/logic/tables.ts';

function book(rows: string[][]): Workbook {
  const d = new Draft(createBlankWorkbook());
  rows.forEach((line, r) => line.forEach((text, c) => {
    const e = parseEntry(text);
    if (e.ok) commitEntry(d, 0, r, c, e);
  }));
  return d.wb;
}

test('mise en forme conditionnelle : valeur, doublons, echelle, barres, icones', () => {
  const wb = book([['10'], ['20'], ['30'], ['20']]);
  const eng = new WorkbookEngine();
  eng.sync(wb);
  const valueAt = (r: number, c: number): Scalar => eng.value('Feuil1', r, c);
  const range = { r1: 0, c1: 0, r2: 3, c2: 0 };
  wb.styles.dxfs.push({ fill: { type: 'pattern', pattern: 'solid', bg: { rgb: 'FFFFC7CE' } } });
  const ev = new CfEvaluator([
    { ranges: [range], rules: [{ type: 'cellIs', operator: 'greaterThan', formulas: ['15'], priority: 1, dxfId: 0 }] },
    { ranges: [range], rules: [{ type: 'colorScale', priority: 2, colorScale: { cfvos: [{ type: 'min' }, { type: 'max' }], colors: [{ rgb: 'FFFFFFFF' }, { rgb: 'FF000000' }] } }] },
    { ranges: [range], rules: [{ type: 'dataBar', priority: 3, dataBar: { cfvos: [{ type: 'min' }, { type: 'max' }], color: { rgb: 'FF638EC6' } } }] },
    { ranges: [range], rules: [{ type: 'iconSet', priority: 4, iconSet: { iconSet: '3Arrows', cfvos: [{ type: 'percent', value: '0' }, { type: 'percent', value: '33' }, { type: 'percent', value: '67' }] } }] },
  ], { wb, valueAt, evaluate: (f) => { const v = eng.engine.evaluate(f, 'Feuil1'); return typeof v === 'object' && v !== null && 'rows' in v ? null : v; }, color: (c) => c?.rgb?.slice(-6), used: range, today: 0 });
  assert.equal(ev.at(0, 0)?.fill, 'FFFFFF');
  assert.equal(ev.at(1, 0)?.fill, 'FFC7CE');
  assert.equal(ev.at(2, 0)?.bar?.ratio, 1);
  assert.equal(ev.at(2, 0)?.icon?.index, 2);
  assert.equal(ev.at(0, 0)?.icon?.index, 0);
  const dup = new CfEvaluator([{ ranges: [range], rules: [{ type: 'duplicateValues', priority: 1, dxfId: 0 }] }], { wb, valueAt, evaluate: () => null, color: (c) => c?.rgb?.slice(-6), used: range, today: 0 });
  assert.equal(dup.at(1, 0)?.fill, 'FFC7CE');
  assert.equal(dup.at(0, 0), null);
});

test('graphiques : construction depuis une plage, type, resolution des series', () => {
  const wb = book([['Mois', 'Ventes', 'Coûts'], ['janv.', '10', '7'], ['févr.', '12', '8']]);
  const eng = new WorkbookEngine();
  eng.sync(wb);
  const valueAt = (r: number, c: number): Scalar => eng.value('Feuil1', r, c);
  const m = buildChart('col', 'Feuil1', { r1: 0, c1: 0, r2: 2, c2: 2 }, valueAt, 'Titre');
  assert.equal(m.plots[0]?.series.length, 2);
  assert.equal(m.plots[0]?.series[0]?.values.ref, 'Feuil1!$B$2:$B$3');
  assert.equal(kindOf(withKind(m, 'pie')), 'pie');
  assert.equal(kindOf(withKind(m, 'combo')), 'combo');
  const res = resolveChart(m, (ref) => rangeValues(eng, ref, 'Feuil1'), (v) => String(v ?? ''));
  assert.deepEqual(res.categories, ['janv.', 'févr.']);
  assert.deepEqual(res.series.map((s) => s.name), ['Ventes', 'Coûts']);
  assert.deepEqual(res.series[1]?.values, [7, 8]);
  assert.deepEqual(niceScale(0, 23), { min: 0, max: 25, step: 5 });
});

test('validation des donnees : liste, nombres entiers, longueur', () => {
  const list = { ranges: [], type: 'list' as const, formula1: '"Oui,Non"' };
  assert.deepEqual(listItems(list, () => []), ['Oui', 'Non']);
  assert.equal(isValid(list, 'oui', () => null, () => ['Oui', 'Non']), true);
  assert.equal(isValid(list, 'Peut-être', () => null, () => ['Oui', 'Non']), false);
  const whole = { ranges: [], type: 'whole' as const, operator: 'between' as const, formula1: '1', formula2: '10' };
  const ev = (f: string): Scalar => Number(f);
  assert.equal(isValid(whole, 5, ev, () => []), true);
  assert.equal(isValid(whole, 5.5, ev, () => []), false);
  assert.equal(isValid(whole, 11, ev, () => []), false);
  assert.equal(isValid({ ranges: [], type: 'textLength', operator: 'lessThanOrEqual', formula1: '3' }, 'abcd', ev, () => []), false);
});

test('tableau croise ecrit dans la feuille avec styles', () => {
  const data: Scalar[][] = [['Rég', 'V'], ['N', 1], ['S', 2], ['N', 3]];
  const L = { rowLabels: 'Étiquettes de lignes', colLabels: 'C', grandTotal: 'Total général', blank: '(vide)', all: '(Tous)', values: 'Valeurs', valueName: (_f: string, n: string) => `Somme de ${n}` };
  const res = computePivot({ sourceSheet: 'Feuil1', source: { r1: 0, c1: 0, r2: 3, c2: 1 }, rows: [0], cols: [], values: [{ field: 1, fn: 'sum' }], filters: [] }, data, String, L);
  const d = new Draft(createBlankWorkbook());
  const area = writePivot(d, 0, { row: 2, col: 0 }, res, null);
  assert.deepEqual(area, { r1: 2, c1: 0, r2: 5, c2: 1 });
  assert.equal(getCell(d.wb.sheets[0]!, 3, 1)?.value, 4);
  assert.equal(getCell(d.wb.sheets[0]!, 5, 1)?.value, 6);
  assert.equal(fontOf(d.wb, getCell(d.wb.sheets[0]!, 5, 0)?.styleId).bold, true);
});

test('fenetre de la grille : volets figes, conversions et defilement', () => {
  const wb = createBlankWorkbook();
  const sh = wb.sheets[0]!;
  const v: Viewport = { rows: rowAxis(sh), cols: colAxis(sh), zoom: 1, width: 800, height: 400, headerW: 40, headerH: 20, frozenRows: 1, frozenCols: 0, scrollX: 0, scrollY: 190 };
  const L = layout(v);
  assert.equal(L.rows[0]?.index, 0);
  assert.equal(L.rows[1]?.index, 11);
  assert.equal(rowAt(v, 25), 0);
  assert.equal(rowAt(v, 45), 11);
  assert.equal(colAt(v, 40 + 64 * 2 + 5), 2);
  assert.equal(scrollToShow({ ...v, scrollY: 0 }, 100, 0)?.scrollY !== undefined, true);
});

test('styles : gras, bordures exterieures, fusion et centrage, styles de tableau', () => {
  const wb = book([['a', 'b'], ['1', '2']]);
  const d = new Draft(wb);
  applyPatch(d, 0, [{ r1: 0, c1: 0, r2: 0, c2: 1 }], { font: { bold: true } });
  assert.equal(fontOf(d.wb, getCell(d.wb.sheets[0]!, 0, 1)?.styleId).bold, true);
  applyBorders(d, 0, [{ r1: 0, c1: 0, r2: 1, c2: 1 }], 'outside');
  const b = d.wb.styles.borders[d.wb.styles.cellXfs[getCell(d.wb.sheets[0]!, 1, 1)?.styleId ?? 0]?.borderId ?? 0];
  assert.ok(b?.bottom && b.right && !b.top && !b.left);
  const lost = mergeCells(d, 0, [{ r1: 0, c1: 0, r2: 0, c2: 1 }], 'center');
  assert.equal(lost, true);
  assert.equal(d.wb.sheets[0]!.merges.length, 1);
  assert.equal(getCell(d.wb.sheets[0]!, 0, 1)?.value ?? null, null);
  const eng = new WorkbookEngine();
  eng.sync(d.wb);
  const t = makeTable(d.wb, { r1: 0, c1: 0, r2: 1, c2: 1 }, true, 'TableStyleMedium2', (r, c) => eng.value('Feuil1', r, c), (i) => `Colonne${i}`);
  assert.equal(t.name, 'Tableau1');
  const look = tableLook(t, 0, 0, tableStyleParts(d.wb, 'TableStyleMedium2'));
  assert.equal(look.bold, true);
  assert.ok(look.fill);
});

test('aller-retour xlsx : formules francaises, valeurs en cache, styles', async () => {
  const wb = book([['Qté', 'Prix'], ['2', '3,5'], ['=A2*B2', '=SOMME(A2:B2)']]);
  const eng = new WorkbookEngine();
  eng.sync(wb);
  const bytes = await writeWorkbook(withCachedValues(wb, eng), 'xlsx');
  const back = await readWorkbook(bytes, 'test.xlsx');
  assert.equal(getCell(back.sheets[0]!, 2, 0)?.formula, 'A2*B2');
  assert.equal(getCell(back.sheets[0]!, 2, 0)?.value, 7);
  assert.equal(getCell(back.sheets[0]!, 2, 1)?.value, 5.5);
});
