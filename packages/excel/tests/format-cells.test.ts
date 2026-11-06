import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook, type Workbook } from '@forgeoffice/xlsx';
import { formatValue } from '@forgeoffice/formulas';
import { Draft } from '../src/logic/draft.ts';
import { applyPatch, borderOf, cellFormat, fontOf, mergeAt, styleAt } from '../src/logic/styles.ts';
import { applyEdits, degreesToRotation, editsToPatch, readFormat, rotationToDegrees } from '../src/logic/format-edits.ts';
import { readBorders } from '../src/logic/border-spec.ts';
import { DATE_TYPES, FRACTION_TYPES, NUM_CATEGORIES, SPECIAL_TYPES, TIME_TYPES, buildFormat, buildNumber, parseNumFmt, typesOf, usesOption } from '../src/logic/numfmt-ui.ts';

const rng = (r1: number, c1: number, r2: number, c2: number) => ({ r1, c1, r2, c2 });
const cellStyle = (wb: Workbook, row: number, col: number): number => styleAt(wb.sheets[0]!, row, col);

/** A1 gras 14 pt, B1 italique 8 pt : selection heterogene. */
function hetero(): Workbook {
  const d = new Draft(createBlankWorkbook());
  d.set(0, 0, 0, { value: 'a' });
  d.set(0, 0, 1, { value: 'b' });
  applyPatch(d, 0, [rng(0, 0, 0, 0)], { font: { bold: true, size: 14 } });
  applyPatch(d, 0, [rng(0, 1, 0, 1)], { font: { italic: true, size: 8 }, numberFormat: '0.00' });
  return d.wb;
}

test('X-02 : une modification de couleur ne reecrit ni gras, ni italique, ni taille des autres cellules', () => {
  const wb0 = hetero();
  const st = readFormat(wb0, 0, [rng(0, 0, 0, 1)], { row: 0, col: 0 });
  assert.ok(st.mixed.has('bold') && st.mixed.has('italic') && st.mixed.has('size') && st.mixed.has('numFmt'));
  assert.ok(!st.mixed.has('underline'));
  const d = new Draft(wb0);
  applyEdits(d, 0, [rng(0, 0, 0, 1)], { color: { rgb: 'FFFF0000' } });
  const a = fontOf(d.wb, cellStyle(d.wb, 0, 0));
  const b = fontOf(d.wb, cellStyle(d.wb, 0, 1));
  assert.deepEqual([a.bold, a.size, a.color?.rgb], [true, 14, 'FFFF0000']);
  assert.deepEqual([b.italic, b.size, b.color?.rgb], [true, 8, 'FFFF0000']);
  assert.equal(fontOf(d.wb, cellStyle(d.wb, 0, 1)).bold ?? false, false);
  assert.equal(cellFormat(d.wb, cellStyle(d.wb, 0, 0)).numFmtId, 0, 'A1 garde son format Standard');
});

test('rien de modifie = correctif vide ; une cle = un champ', () => {
  assert.deepEqual(editsToPatch({}), {});
  assert.deepEqual(editsToPatch({ bold: true }), { font: { bold: true } });
  assert.deepEqual(editsToPatch({ h: 'center', wrap: true }), { alignment: { horizontal: 'center', wrapText: true } });
  assert.deepEqual(editsToPatch({ locked: false }), { protection: { locked: false } });
  assert.equal(editsToPatch({ numFmt: '0%' }).numberFormat, '0%');
});

test('police : nom, soulignement, barre, indice, retour a automatique', () => {
  const d = new Draft(hetero());
  applyEdits(d, 0, [rng(0, 0, 0, 1)], { fontName: 'Arial', underline: 'double', strike: true, vertAlign: 'subscript' });
  const f = fontOf(d.wb, cellStyle(d.wb, 0, 0));
  assert.deepEqual([f.name, f.underline, f.strike, f.vertAlign, f.scheme, f.bold, f.size], ['Arial', 'double', true, 'subscript', undefined, true, 14]);
  applyEdits(d, 0, [rng(0, 0, 0, 0)], { underline: null, vertAlign: null, color: null });
  const g = fontOf(d.wb, cellStyle(d.wb, 0, 0));
  assert.deepEqual([g.underline, g.vertAlign, g.color], [undefined, undefined, undefined]);
  assert.equal(fontOf(d.wb, cellStyle(d.wb, 0, 1)).underline, 'double', 'B1 non touchee');
});

test('alignement : retrait, orientation, ajuster, renvoi', () => {
  const d = new Draft(hetero());
  applyEdits(d, 0, [rng(0, 0, 0, 1)], { h: 'left', indent: 3, rotation: degreesToRotation(-45), shrink: true, v: 'top' });
  const al = cellFormat(d.wb, cellStyle(d.wb, 0, 1)).alignment;
  assert.deepEqual([al?.horizontal, al?.indent, al?.textRotation, al?.shrinkToFit, al?.vertical], ['left', 3, 135, true, 'top']);
  assert.equal(fontOf(d.wb, cellStyle(d.wb, 0, 1)).size, 8);
  assert.deepEqual([rotationToDegrees(135), rotationToDegrees(30), rotationToDegrees(255), rotationToDegrees(0), degreesToRotation(90), degreesToRotation(-90), degreesToRotation(200)], [-45, 30, null, 0, 90, 180, 90]);
});

test('fusion et annulation de fusion par la boite', () => {
  const d = new Draft(hetero());
  applyEdits(d, 0, [rng(0, 0, 0, 1)], { merged: true });
  assert.ok(mergeAt(d.wb.sheets[0]!.merges, 0, 1));
  assert.equal(readFormat(d.wb, 0, [rng(0, 0, 0, 1)], { row: 0, col: 0 }).view.merged, true);
  applyEdits(d, 0, [rng(0, 0, 0, 1)], { merged: false });
  assert.equal(mergeAt(d.wb.sheets[0]!.merges, 0, 1), undefined);
});

test('bordures : contour, interieur, suppression d un seul bord, voisins alignes', () => {
  const d = new Draft(createBlankWorkbook());
  const thin = { style: 'thin' as const, color: { rgb: 'FF0000FF' } };
  const dbl = { style: 'double' as const };
  applyEdits(d, 0, [rng(2, 2, 3, 3)], { border: { top: thin, bottom: thin, left: thin, right: thin, innerH: dbl, innerV: null } });
  const b = (r: number, c: number) => borderOf(d.wb, cellStyle(d.wb, r, c));
  assert.deepEqual(b(2, 2).top, thin);
  assert.deepEqual(b(2, 2).bottom, dbl);
  assert.deepEqual(b(3, 2).top, dbl);
  assert.deepEqual(b(3, 3).bottom, thin);
  assert.equal(b(2, 2).right, undefined, 'innerV null : aucun trait vertical interieur');
  assert.deepEqual(b(1, 2).bottom, thin, 'la cellule du dessus partage le trait');
  assert.deepEqual(b(2, 4).left, thin, 'la cellule de droite partage le trait');
  assert.deepEqual(b(2, 3).right, thin);
  // Un seul bord retire : les autres restent.
  applyEdits(d, 0, [rng(2, 2, 3, 3)], { border: { left: null } });
  assert.equal(b(2, 2).left, undefined);
  assert.deepEqual(b(2, 2).top, thin);
  const read = readBorders(d.wb, d.wb.sheets[0]!, rng(2, 2, 3, 3));
  assert.deepEqual([read.top, read.left, read.innerH], [thin, null, dbl]);
  // Diagonale
  applyEdits(d, 0, [rng(5, 5, 5, 5)], { border: { diagUp: thin } });
  assert.deepEqual([b(5, 5).diagonal, b(5, 5).diagonalUp, b(5, 5).diagonalDown ?? false], [thin, true, false]);
  applyEdits(d, 0, [rng(5, 5, 5, 5)], { border: { diagUp: null } });
  assert.equal(b(5, 5).diagonal, undefined);
});

test('remplissage et protection', () => {
  const d = new Draft(hetero());
  applyEdits(d, 0, [rng(0, 0, 0, 1)], { fill: { type: 'pattern', pattern: 'darkGrid', fg: { rgb: 'FF112233' }, bg: { rgb: 'FFFFFF00' } }, locked: false, hidden: true });
  const f = d.wb.styles.fills[cellFormat(d.wb, cellStyle(d.wb, 0, 1)).fillId];
  assert.equal(f?.type === 'pattern' ? f.pattern : '', 'darkGrid');
  const p = cellFormat(d.wb, cellStyle(d.wb, 0, 0)).protection;
  assert.deepEqual([p?.locked, p?.hidden], [false, true]);
});

test('formats de nombre : categories, analyse inverse et rendu', () => {
  assert.equal(NUM_CATEGORIES.length, 12);
  for (const code of ['General', '0.00', '#,##0', '0.00_);(0.00)', '0.00;[Red]0.00', '#,##0.00 [$€-40C]', '[$$-409]#,##0.00;[Red][$$-409]#,##0.00', '0%', '0.000%', '0.00E+00', '@', 'dd/mm/yyyy', 'h:mm AM/PM', '# ??/16', '00000']) {
    const p = parseNumFmt(code);
    const back = buildFormat(p.category, p.options, p.type);
    assert.equal(back, code, `${code} -> ${p.category}`);
  }
  assert.equal(parseNumFmt('0.0,"k"').category, 'custom');
  assert.equal(parseNumFmt('_-* #,##0.00 [$€-40C]_-;-* #,##0.00 [$€-40C]_-;_-* "-"?? [$€-40C]_-;_-@_-').category, 'accounting');
  assert.equal(parseNumFmt('#,##0.00 [$€-40C]').options.symbol, 'eur');
  assert.equal(parseNumFmt('0.0000').options.decimals, 4);
  assert.equal(buildNumber({ decimals: 1, thousands: true, negative: 3 }), '#,##0.0_);[Red](#,##0.0)');
  assert.ok(usesOption('currency', 'symbol') && !usesOption('number', 'symbol') && usesOption('number', 'thousands'));
  assert.equal(typesOf('date'), DATE_TYPES);
  // Chaque type affiche quelque chose (pas d'erreur du moteur) sur une date / un nombre.
  const sample = 40982.5631;
  for (const t of [...DATE_TYPES, ...TIME_TYPES]) assert.notEqual(formatValue(sample, t.code, 'fr-FR'), '', t.code);
  for (const t of [...FRACTION_TYPES, ...SPECIAL_TYPES]) assert.notEqual(formatValue(3.25, t.code, 'fr-FR'), '', t.code);
  assert.equal(formatValue(-1234.1, buildNumber({ decimals: 2, thousands: true, negative: 2 }), 'fr-FR').replace(/\s/g, ' '), '(1 234,10)');
  assert.equal(formatValue(75008, SPECIAL_TYPES[0]!.code, 'fr-FR'), '75008');
  assert.equal(formatValue(612345678, SPECIAL_TYPES[2]!.code, 'fr-FR'), '06 12 34 56 78');
});
