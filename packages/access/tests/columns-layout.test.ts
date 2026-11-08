// Disposition des colonnes de la feuille de donnees : largeurs, masquage, ordre, figement, copie tabulee.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_LAYOUT, displayOrder, setRowHeight, fitWidth, freezeColumns, hideColumn, moveColumn, resetWidth, setWidth, showAll, showColumn, stickyOffsets, toTsv,
} from '../src/logic/columns-layout.ts';

const N = ['A', 'B', 'C', 'D'];

test('ordre d affichage : masques exclus, ordre choisi puis reste', () => {
  assert.deepEqual(displayOrder(N, EMPTY_LAYOUT), [0, 1, 2, 3]);
  const l = hideColumn(EMPTY_LAYOUT, N, 'B');
  assert.deepEqual(displayOrder(N, l), [0, 2, 3]);
  assert.deepEqual(displayOrder(N, { ...l, order: ['D', 'A', 'inconnu'] }), [3, 0, 2]);
  assert.deepEqual(displayOrder(N, showColumn(l, 'B')), [0, 1, 2, 3]);
  assert.deepEqual(displayOrder(N, showAll(l)), [0, 1, 2, 3]);
});

test('on ne peut pas masquer le dernier champ affiche', () => {
  let l = EMPTY_LAYOUT;
  for (const n of ['A', 'B', 'C', 'D']) l = hideColumn(l, N, n);
  assert.deepEqual(displayOrder(N, l), [3]);
});

test('largeur bornee, puis retour automatique', () => {
  let l = setWidth(EMPTY_LAYOUT, 'A', 5);
  assert.equal(l.widths.A, 40);
  l = setWidth(l, 'A', 5000);
  assert.equal(l.widths.A, 800);
  l = setWidth(l, 'B', 123.4);
  assert.equal(l.widths.B, 123);
  assert.deepEqual(resetWidth(l, 'A').widths, { B: 123 });
});

test('deplacer une colonne devant une autre', () => {
  const names = (l: typeof EMPTY_LAYOUT) => displayOrder(N, l).map((i) => N[i]);
  assert.deepEqual(names(moveColumn(EMPTY_LAYOUT, N, 3, 0)), ['D', 'A', 'B', 'C']);
  assert.deepEqual(names(moveColumn(EMPTY_LAYOUT, N, 0, 4)), ['B', 'C', 'D', 'A']);
  assert.deepEqual(names(moveColumn(EMPTY_LAYOUT, N, 0, 2)), ['B', 'A', 'C', 'D']);
  assert.deepEqual(names(moveColumn(EMPTY_LAYOUT, N, 1, 2)), ['A', 'B', 'C', 'D'], 'sur place');
  const hidden = hideColumn(EMPTY_LAYOUT, N, 'B');
  assert.deepEqual(names(moveColumn(hidden, N, 2, 0)), ['D', 'A', 'C']);
});

test('figement : borne au nombre de colonnes affichees, ajuste au masquage', () => {
  assert.equal(freezeColumns(EMPTY_LAYOUT, N, 2).frozen, 2);
  assert.equal(freezeColumns(EMPTY_LAYOUT, N, 99).frozen, 4);
  assert.equal(freezeColumns(EMPTY_LAYOUT, N, -1).frozen, 0);
  const l = hideColumn(freezeColumns(EMPTY_LAYOUT, N, 4), N, 'A');
  assert.equal(l.frozen, 3);
  assert.deepEqual(stickyOffsets([100, 80, 60], 2, 18), [18, 118]);
});

test('largeur ajustee et copie tabulee', () => {
  assert.equal(fitWidth('N°', ['1', '2']), Math.max(40, (2 + 3) * 7 + 16));
  assert.equal(fitWidth('Nom', ['Atelier Lumière du Nord']), 23 * 7 + 16);
  assert.equal(toTsv([['a', 'b'], ['c"d', 'e\nf']]), 'a\tb\r\n"c""d"\t"e\nf"');
});

test('hauteur de ligne : bornee, retour a la hauteur standard', () => {
  assert.equal(setRowHeight(EMPTY_LAYOUT, 5).rowHeight, 16);
  assert.equal(setRowHeight(EMPTY_LAYOUT, 500).rowHeight, 120);
  assert.equal(setRowHeight(EMPTY_LAYOUT, 33.4).rowHeight, 33);
  assert.equal('rowHeight' in setRowHeight(setRowHeight(EMPTY_LAYOUT, 40), null), false);
});
