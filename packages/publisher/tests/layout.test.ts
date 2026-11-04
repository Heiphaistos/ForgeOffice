import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baselines, layoutGuides, marginBox, snapRect, snapValue, spreadOf, spreads } from '../src/guides.ts';
import { bleedSheet, bookletOrder, cardGrid, cropMarks } from '../src/imposition.ts';
import { defaultSettings } from '../src/model.ts';
import { mm } from '../src/build.ts';
import { monthGrid } from '../src/calendar.ts';

const A4 = { width: mm(210), height: mm(297) };

test('marges en miroir sur les pages de gauche en vis-a-vis', () => {
  const pub = defaultSettings('newsletter', { facing: true, margins: { top: 40, bottom: 40, inside: 50, outside: 30 } });
  assert.equal(marginBox(A4, pub, 0).x, 50);
  assert.equal(marginBox(A4, pub, 1).x, 30);
  assert.ok(Math.abs(marginBox(A4, pub, 1).x + marginBox(A4, pub, 1).width - (A4.width - 50)) < 1e-9);
  assert.equal(marginBox(A4, { ...pub, facing: false }, 1).x, 50);
});

test('reperes de colonnes et de lignes : bords de chaque piste, goutiere comprise', () => {
  const pub = defaultSettings('trifold', { margins: { top: 0, bottom: 0, inside: 0, outside: 0 }, columns: { count: 3, gap: 30 }, rows: { count: 2, gap: 0 } });
  const g = layoutGuides({ width: 330, height: 200 }, pub, 0);
  assert.deepEqual(g.marginX, [0, 330]);
  assert.deepEqual(g.gridX, [90, 120, 210, 240]);
  assert.deepEqual(g.gridY, [100]);
  const lines = baselines({ width: 100, height: 100 }, { margins: { top: 10, bottom: 10, inside: 0, outside: 0 }, baseline: { spacing: 20, offset: 5 } });
  assert.deepEqual(lines, [15, 35, 55, 75]);
});

test('magnetisme : valeur et rectangle aimantes au repere le plus proche dans le seuil', () => {
  assert.equal(snapValue(103, [100, 200], 5), 100);
  assert.equal(snapValue(110, [100, 200], 5), 110);
  assert.deepEqual(snapRect({ x: 52, y: 10, width: 40, height: 40 }, [50], [100], 4), { dx: -2, dy: 0 });
  // Centre aimante (72 -> 70) plutot que le bord droit trop loin.
  assert.deepEqual(snapRect({ x: 52, y: 0, width: 40, height: 10 }, [70], [], 4), { dx: -2, dy: 0 });
});

test('planches en vis-a-vis : page 1 seule puis 2-3, 4-5', () => {
  assert.deepEqual(spreadOf(0, 4, true), [0]);
  assert.deepEqual(spreadOf(2, 4, true), [1, 2]);
  assert.deepEqual(spreadOf(3, 4, true), [3]);
  assert.deepEqual(spreads(5, true), [[0], [1, 2], [3, 4]]);
  assert.deepEqual(spreads(3, false), [[0], [1], [2]]);
});

test('imposition : 10 cartes de visite 85 x 55 mm sur A4, centrees', () => {
  const grid = cardGrid({ width: mm(85), height: mm(55) }, A4);
  assert.equal(grid.cols, 2);
  assert.equal(grid.rows, 5);
  assert.equal(grid.cells.length, 10);
  const first = grid.cells[0];
  const last = grid.cells[9];
  assert.ok(first && last);
  assert.ok(Math.abs(first.x - (A4.width - last.x - last.width)) < 1e-6);
  assert.ok(Math.abs(first.y - (A4.height - last.y - last.height)) < 1e-6);
  // Etiquettes 70 x 37 mm imposees en 3 x 8.
  assert.equal(cardGrid({ width: mm(70), height: mm(37) }, A4, 0, 0, 0, 3, 8).cells.length, 24);
});

test('traits de coupe : un trait par ligne de coupe de chaque cote, hors de la zone imprimee', () => {
  const marks = cropMarks([{ x: 10, y: 10, width: 50, height: 30 }, { x: 60, y: 10, width: 50, height: 30 }], 5, 10);
  // 3 lignes de coupe verticales (10, 60, 110) x 2 + 2 horizontales (10, 40) x 2.
  assert.equal(marks.length, 10);
  for (const m of marks) assert.ok(m.y2 <= 5 || m.y1 >= 45 || m.x2 <= 5 || m.x1 >= 115);
  const sheet = bleedSheet({ width: 100, height: 50 }, 9, true);
  assert.equal(sheet.pageX, 34);
  assert.equal(sheet.width, 168);
});

test('livret : ordre de pliage des pages (4 et 8 pages)', () => {
  assert.deepEqual(bookletOrder(4), [[3, 0], [1, 2]]);
  assert.deepEqual(bookletOrder(8), [[7, 0], [1, 6], [5, 2], [3, 4]]);
  assert.deepEqual(bookletOrder(3), [[null, 0], [1, 2]]);
});

test('calendrier : semaines du lundi au dimanche', () => {
  const nov = monthGrid(2026, 10);
  assert.deepEqual(nov[0], [null, null, null, null, null, null, 1]);
  assert.equal(nov.flat().filter((d) => d !== null).length, 30);
  assert.equal(nov.length, 6);
});
