import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook, getCell, type Workbook } from '@forgeoffice/xlsx';
import { FormulaError, type Scalar } from '@forgeoffice/formulas';
import { Draft } from '../src/logic/draft.ts';
import { WorkbookEngine } from '../src/logic/engine.ts';
import { commitEntry, editText, parseEntry } from '../src/logic/cells.ts';
import { autoFill, extendSeries } from '../src/logic/fill.ts';
import { captureRange, parseDelimited, parseHtmlTable, pasteClip, pasteTarget, toTsv } from '../src/logic/clipboard.ts';
import { applyAutoFilter, compareValues, removeDuplicates, sortRange } from '../src/logic/data.ts';
import { computePivot } from '../src/logic/pivot.ts';
import { addCell, cellSelection, cycleActive, extendTo, jumpEdge, rangeLabel, selectCols } from '../src/logic/selection.ts';
import { axisIndexAt, axisPos, makeAxis } from '../src/logic/geometry.ts';
import { shiftStructure, renameSheet } from '../src/logic/structure.ts';
import { argumentAt, completions, findRefs } from '../src/logic/formula-ui.ts';

function put(wb: Workbook, entries: Record<string, string>): Workbook {
  const d = new Draft(wb);
  for (const [addr, text] of Object.entries(entries)) {
    const m = addr.match(/^([A-Z]+)(\d+)$/);
    if (!m) throw new Error(addr);
    const col = (m[1] ?? 'A').charCodeAt(0) - 65;
    const e = parseEntry(text);
    if (!e.ok) throw new Error(e.message);
    commitEntry(d, 0, Number(m[2]) - 1, col, e);
  }
  return d.wb;
}

test('saisie francaise et formules liees au moteur', () => {
  let wb = put(createBlankWorkbook(), { A1: '12,5', A2: '7', A3: '=SOMME(A1:A2)', B1: '15 %', C1: '03/11/2026' });
  const eng = new WorkbookEngine();
  eng.sync(wb);
  assert.equal(eng.value('Feuil1', 2, 0), 19.5);
  assert.equal(getCell(wb.sheets[0]!, 2, 0)?.formula, 'SUM(A1:A2)');
  assert.equal(editText(wb, getCell(wb.sheets[0]!, 2, 0)), '=SOMME(A1:A2)');
  assert.equal(editText(wb, getCell(wb.sheets[0]!, 0, 0)), '12,5');
  assert.equal(editText(wb, getCell(wb.sheets[0]!, 0, 1)), '15 %');
  assert.equal(editText(wb, getCell(wb.sheets[0]!, 0, 2)), '03/11/2026');
  const before = wb;
  wb = put(wb, { A2: '10' });
  eng.sync(wb);
  assert.equal(eng.value('Feuil1', 2, 0), 22.5);
  // annuler = revenir a l'etat precedent (intact) puis resynchroniser
  assert.equal(getCell(before.sheets[0]!, 1, 0)?.value, 7);
  eng.sync(before);
  assert.equal(eng.value('Feuil1', 2, 0), 19.5);
  assert.equal(parseEntry('=SOMME(A1').ok, true);
  assert.equal(parseEntry('=1+').ok, false);
});

test('renommer une feuille reecrit les formules', () => {
  const wb = put(createBlankWorkbook(), { A1: '=Feuil1!B1*2', B1: '3' });
  const d = new Draft(wb);
  renameSheet(d, 0, 'Ventes');
  assert.equal(getCell(d.wb.sheets[0]!, 0, 0)?.formula, 'Ventes!B1*2');
  const eng = new WorkbookEngine();
  eng.sync(d.wb);
  assert.equal(eng.value('Ventes', 0, 0), 6);
});

test('insertion de lignes decale cellules et formules', () => {
  const wb = put(createBlankWorkbook(), { A1: '1', A2: '2', A3: '=SOMME(A1:A2)' });
  const d = new Draft(wb);
  shiftStructure(d, 0, 'row', 1, 2);
  assert.equal(getCell(d.wb.sheets[0]!, 3, 0)?.value, 2);
  assert.equal(getCell(d.wb.sheets[0]!, 4, 0)?.formula, 'SUM(A1:A4)');
  assert.equal(getCell(wb.sheets[0]!, 2, 0)?.formula, 'SUM(A1:A2)');
});

test('selection : extension, plages discontinues, Ctrl+fleche, cycle', () => {
  let s = cellSelection(1, 1);
  s = extendTo(s, 3, 2);
  assert.equal(rangeLabel(s.ranges[0]!), 'B2:C4');
  s = addCell(s, 9, 9);
  assert.equal(s.ranges.length, 2);
  assert.equal(rangeLabel(selectCols(0, 2).ranges[0]!), 'A:C');
  const filled = (r: number, c: number): boolean => c === 0 && r >= 2 && r <= 5;
  assert.deepEqual(jumpEdge({ row: 0, col: 0 }, 1, 0, filled, { row: 5, col: 0 }), { row: 2, col: 0 });
  assert.deepEqual(jumpEdge({ row: 2, col: 0 }, 1, 0, filled, { row: 5, col: 0 }), { row: 5, col: 0 });
  let c = extendTo(cellSelection(0, 0), 1, 1);
  c = cycleActive(c, 1, 0);
  assert.deepEqual(c.active, { row: 1, col: 0 });
  c = cycleActive(c, 1, 0);
  assert.deepEqual(c.active, { row: 0, col: 1 });
});

test('geometrie virtualisee avec tailles et masquage', () => {
  const ax = makeAxis(20, 1_048_576, [{ start: 2, end: 2, size: 40 }, { start: 5, end: 9, size: 0 }]);
  assert.equal(axisPos(ax, 3), 80);
  assert.equal(axisPos(ax, 10), 120);
  assert.equal(axisIndexAt(ax, 79), 2);
  assert.equal(axisIndexAt(ax, 120), 10);
  assert.equal(axisIndexAt(ax, 100), 4);
  assert.equal(axisPos(ax, 1_048_575), 1_048_575 * 20 + 20 - 100);
});

test('recopie : nombres, dates, jours et mois francais, texte numerote, formules', () => {
  const series = (vals: (number | string)[], n: number): unknown[] => extendSeries(vals.map((v) => ({ value: v })), n).map((x) => x.cell?.value);
  assert.deepEqual(series([1, 2], 3), [3, 4, 5]);
  assert.deepEqual(series([5], 2), [5, 5]);
  assert.deepEqual(series(['lundi'], 3), ['mardi', 'mercredi', 'jeudi']);
  assert.deepEqual(series(['Janvier'], 2), ['Février', 'Mars']);
  assert.deepEqual(series(['déc.'], 1), ['janv.']);
  assert.deepEqual(series(['Trimestre 1'], 2), ['Trimestre 2', 'Trimestre 3']);
  assert.deepEqual(series([0.1, 0.2], 1), [0.3]);
  const date = extendSeries([{ value: 46000, styleId: 3 }], 2, { isDate: (c) => c.styleId === 3 }).map((x) => x.cell?.value);
  assert.deepEqual(date, [46001, 46002]);
  const wb = put(createBlankWorkbook(), { A1: '1', B1: '=A1*2' });
  const d = new Draft(wb);
  autoFill(d, 0, { r1: 0, c1: 1, r2: 0, c2: 1 }, { r1: 0, c1: 1, r2: 3, c2: 1 });
  assert.equal(getCell(d.wb.sheets[0]!, 3, 1)?.formula, 'A4*2');
});

test('presse-papiers : TSV, HTML Excel, collage translate et transpose', () => {
  assert.equal(toTsv([['a', 'b\tc'], ['1', '']]), 'a\t"b\tc"\r\n1\t\r\n');
  assert.deepEqual(parseDelimited('a\t"x\ny"\r\n1\t2\r\n'), [['a', 'x\ny'], ['1', '2']]);
  const html = '<html><body><table><tr><td>Nom</td><td colspan=2>Total &amp; TVA</td></tr><tr><td>A</td><td>1,5</td><td>2</td></tr></table></body></html>';
  assert.deepEqual(parseHtmlTable(html), [['Nom', 'Total & TVA', ''], ['A', '1,5', '2']]);
  assert.deepEqual(pasteTarget({ rows: 1, cols: 1 }, { r1: 0, c1: 0, r2: 3, c2: 1 }), { r1: 0, c1: 0, r2: 3, c2: 1 });
  const wb = put(createBlankWorkbook(), { A1: '1', B1: '=A1+1', A2: '2' });
  const clip = captureRange(wb, 0, { r1: 0, c1: 0, r2: 1, c2: 1 });
  const d = new Draft(wb);
  pasteClip(d, 0, clip, { r1: 4, c1: 3, r2: 4, c2: 3 });
  assert.equal(getCell(d.wb.sheets[0]!, 4, 4)?.formula, 'D5+1');
  const t = new Draft(wb);
  pasteClip(t, 0, clip, { r1: 10, c1: 0, r2: 10, c2: 0 }, { transpose: true });
  assert.equal(getCell(t.wb.sheets[0]!, 10, 1)?.value, 2);
  assert.equal(getCell(t.wb.sheets[0]!, 11, 0)?.formula, '#REF!+1');
});

test('tri, filtre et doublons', () => {
  const wb = put(createBlankWorkbook(), { A1: 'Nom', B1: 'Qté', A2: 'b', B2: '3', A3: 'A', B3: '1', A4: 'c', B4: '2', A5: 'A', B5: '1' });
  const eng = new WorkbookEngine();
  eng.sync(wb);
  const v = (r: number, c: number): Scalar => eng.value('Feuil1', r, c);
  const d = new Draft(wb);
  sortRange(d, 0, { r1: 0, c1: 0, r2: 4, c2: 1 }, [{ index: 1, descending: true }], true, v);
  assert.deepEqual([1, 2, 3, 4].map((r) => getCell(d.wb.sheets[0]!, r, 0)?.value), ['b', 'c', 'A', 'A']);
  assert.ok(compareValues(2, 'a') < 0 && compareValues('a', true) < 0 && compareValues(true, new FormulaError('#N/A')) < 0);
  const f = new Draft(wb);
  applyAutoFilter(f, 0, { ref: { r1: 0, c1: 0, r2: 4, c2: 1 }, columns: [{ colId: 0, filter: { kind: 'values', values: ['a'] } }] }, v, (r, c) => String(v(r, c) ?? ''));
  assert.deepEqual([1, 2, 3, 4].map((r) => !!f.wb.sheets[0]!.rows.get(r)?.hidden), [true, false, true, false]);
  const u = new Draft(wb);
  assert.equal(removeDuplicates(u, 0, { r1: 0, c1: 0, r2: 4, c2: 1 }, [0, 1], true, v), 1);
});

test('tableau croise dynamique : lignes, colonnes, somme, pourcentage, filtres', () => {
  const data: Scalar[][] = [['Région', 'Produit', 'Ventes'], ['Nord', 'A', 10], ['Sud', 'A', 5], ['Nord', 'B', 7], ['Nord', 'A', 3]];
  const L = { rowLabels: 'Étiquettes de lignes', colLabels: 'Étiquettes de colonnes', grandTotal: 'Total général', blank: '(vide)', all: '(Tous)', values: 'Valeurs', valueName: (_f: string, n: string) => `Somme de ${n}` };
  const base = { sourceSheet: 'Feuil1', source: { r1: 0, c1: 0, r2: 4, c2: 2 }, filters: [] };
  const p = computePivot({ ...base, rows: [0], cols: [1], values: [{ field: 2, fn: 'sum' }] }, data, String, L);
  const text = p.cells.map((r) => r.map((c) => c.value));
  assert.deepEqual(text[1], ['Étiquettes de lignes', 'A', 'B', 'Total général']);
  assert.deepEqual(text[2], ['Nord', 13, 7, 20]);
  assert.deepEqual(text[3], ['Sud', 5, null, 5]);
  assert.deepEqual(text[4], ['Total général', 18, 7, 25]);
  const pct = computePivot({ ...base, rows: [0], cols: [], values: [{ field: 2, fn: 'sum', show: 'percentOfTotal' }], filters: [{ field: 1, hidden: ['B'] }] }, data, String, L);
  const rows = pct.cells.map((r) => r.map((c) => c.value));
  assert.equal(rows.at(-1)?.[1], 1);
  assert.equal(rows.find((r) => r[0] === 'Sud')?.[1], 5 / 18);
});

test('formules : references colorees, completion, argument courant', () => {
  const refs = findRefs('=SOMME(A1:B3;Feuil2!C4;"A9")+A1');
  assert.deepEqual(refs.map((r) => r.text), ['A1:B3', 'Feuil2!C4', 'A1']);
  assert.equal(refs[0]?.color === refs[2]?.color, false);
  assert.ok(completions('RECH').some((f) => f.name === 'RECHERCHEV'));
  assert.deepEqual(argumentAt('=SI(A1>2;SOMME(B1;', 19), { fn: 'SOMME', index: 1 });
});
