// Collage special : « Tout sauf la bordure », formats de nombres, largeurs de colonnes, commentaires et notes, validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook, styleIdFor, type Workbook } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { captureRange, pasteClip } from '../src/logic/clipboard.ts';
import { borderOf, numFmtOf } from '../src/logic/styles.ts';

const edge = { style: 'thin' as const, color: { rgb: 'FF000000' } };

function setup(): Workbook {
  const wb = createBlankWorkbook();
  const d = new Draft(wb);
  const put = (r: number, c: number, text: string): void => {
    const e = parseEntry(text, false);
    if (e.ok) commitEntry(d, 0, r, c, e);
  };
  put(0, 0, '12,5');
  put(0, 2, '7');
  // Source A1 : format 0,00 € + bordure ; destination C1 : fond sans bordure
  const src = styleIdFor(d.wb, { numberFormat: '0.00 "€"', border: { left: edge, right: edge, top: edge, bottom: edge } });
  const a1 = d.get(0, 0, 0);
  if (a1) d.set(0, 0, 0, { ...a1, styleId: src });
  const dst = styleIdFor(d.wb, { numberFormat: '0%' });
  const c1 = d.get(0, 0, 2);
  if (c1) d.set(0, 0, 2, { ...c1, styleId: dst });
  return d.wb;
}

test('collage special : « Tout sauf la bordure » garde la bordure d\'arrivee', () => {
  const wb = setup();
  const clip = captureRange(wb, 0, { r1: 0, c1: 0, r2: 0, c2: 0 });
  const d = new Draft(wb);
  pasteClip(d, 0, clip, { r1: 0, c1: 2, r2: 0, c2: 2 }, { what: 'noBorders' });
  const cell = d.get(0, 0, 2);
  assert.equal(cell?.value, 12.5);
  assert.equal(numFmtOf(d.wb, cell?.styleId), '0.00 "€"', 'le format de nombre de la source est pris');
  assert.deepEqual(borderOf(d.wb, cell?.styleId), borderOf(d.wb, undefined), 'aucune bordure : celle de la cellule d\'arrivee');
  const all = new Draft(wb);
  pasteClip(all, 0, clip, { r1: 0, c1: 2, r2: 0, c2: 2 }, { what: 'all' });
  assert.notDeepEqual(borderOf(all.wb, all.get(0, 0, 2)?.styleId), {}, '« Tout » apporte la bordure de la source');
});

test('collage special : valeurs et formats de nombres / formules et formats de nombres', () => {
  const wb = setup();
  const clip = captureRange(wb, 0, { r1: 0, c1: 0, r2: 0, c2: 0 });
  const d = new Draft(wb);
  pasteClip(d, 0, clip, { r1: 0, c1: 2, r2: 0, c2: 2 }, { what: 'valuesAndFormats' });
  assert.equal(numFmtOf(d.wb, d.get(0, 0, 2)?.styleId), '0.00 "€"');
  assert.deepEqual(borderOf(d.wb, d.get(0, 0, 2)?.styleId), {}, 'seul le format de nombre est pris');
  const f = new Draft(wb);
  commitEntry(f, 0, 1, 0, { ok: true, value: 3, formula: 'A1*2' });
  const clipF = captureRange(f.wb, 0, { r1: 1, c1: 0, r2: 1, c2: 0 });
  pasteClip(f, 0, clipF, { r1: 3, c1: 0, r2: 3, c2: 0 }, { what: 'formulasAndNumFmt' });
  assert.equal(f.get(0, 3, 0)?.formula, 'A3*2', 'la formule est translatee de deux lignes');
});

test('collage special : largeurs de colonnes, commentaires et notes, validation', () => {
  const wb = setup();
  const sh = wb.sheets[0]!;
  sh.cols = [{ min: 0, max: 0, width: 30 }];
  sh.notes = [{ ref: { row: 0, col: 0 }, author: 'Banc', text: 'Une note' }];
  sh.dataValidations = [{ ranges: [{ r1: 0, c1: 0, r2: 0, c2: 0 }], type: 'list', formula1: '"Oui,Non"' }];
  const clip = captureRange(wb, 0, { r1: 0, c1: 0, r2: 0, c2: 0 });
  const widths = new Draft(wb);
  pasteClip(widths, 0, clip, { r1: 0, c1: 2, r2: 0, c2: 2 }, { what: 'colWidths' });
  assert.equal(widths.wb.sheets[0]!.cols.find((c) => c.min <= 2 && c.max >= 2)?.width, 30);
  assert.equal(widths.get(0, 0, 2)?.value, 7, 'les valeurs ne changent pas');
  const notes = new Draft(wb);
  pasteClip(notes, 0, clip, { r1: 5, c1: 3, r2: 5, c2: 3 }, { what: 'comments' });
  assert.deepEqual(notes.wb.sheets[0]!.notes.map((n) => [n.ref.row, n.ref.col, n.text]), [[0, 0, 'Une note'], [5, 3, 'Une note']]);
  const valid = new Draft(wb);
  pasteClip(valid, 0, clip, { r1: 7, c1: 1, r2: 7, c2: 1 }, { what: 'validation' });
  assert.equal(valid.wb.sheets[0]!.dataValidations.length, 2);
  assert.deepEqual(valid.wb.sheets[0]!.dataValidations[1]!.ranges, [{ r1: 7, c1: 1, r2: 7, c2: 1 }]);
});
