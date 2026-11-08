// Elements de graphique : titres d'axes, courbe de tendance, regression lineaire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { axisTitle, hasTrendline, linearFit, setAxisTitle, setTitleText, setTrendline } from '../src/logic/chart-elements.ts';
import type { ChartModel } from '@forgeoffice/xlsx';

const model: ChartModel = {
  plots: [{ type: 'bar', series: [{ idx: 0, order: 0, values: {} }], axisIds: [1, 2] }],
  axes: [{ id: 1, kind: 'category', position: 'b', crossAxisId: 2 }, { id: 2, kind: 'value', position: 'l', crossAxisId: 1 }],
};

test('titres d\'axes : ajout, texte, retrait', () => {
  const a = setAxisTitle(model, 'value', '', 'Titre de l\'axe');
  assert.equal(axisTitle(a, 'value'), 'Titre de l\'axe');
  assert.equal(axisTitle(a, 'category'), undefined);
  assert.equal(axisTitle(setAxisTitle(a, 'value', 'Ventes', 'x'), 'value'), 'Ventes');
  assert.equal(axisTitle(setAxisTitle(a, 'value', null, 'x'), 'value'), undefined);
});

test('titre du graphique et courbe de tendance', () => {
  assert.equal(setTitleText(model, 'Mon titre').title?.text, 'Mon titre');
  assert.equal(hasTrendline(setTrendline(model, true)), true);
  assert.equal(hasTrendline(setTrendline(setTrendline(model, true), false)), false);
});

test('regression lineaire', () => {
  const f = linearFit([1, 3, 5, 7]);
  assert.ok(f && Math.abs(f.slope - 2) < 1e-9 && Math.abs(f.intercept - 1) < 1e-9);
  assert.equal(linearFit([4]), undefined);
  const g = linearFit([1, null, 5]);
  assert.ok(g && Math.abs(g.slope - 2) < 1e-9);
});

test('position des etiquettes de donnees', async () => {
  const { setLabelPosition, labelPositionOf } = await import('../src/logic/chart-elements.ts');
  assert.equal(labelPositionOf(model), 'none');
  assert.equal(labelPositionOf(setLabelPosition(model, 'ctr')), 'ctr');
  assert.equal(labelPositionOf(setLabelPosition(setLabelPosition(model, 'inEnd'), 'none')), 'none');
});
