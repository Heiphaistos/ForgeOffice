import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChartModel } from '@forgeoffice/pptx';
import { axisOf, axisVisible, hasAxisTitle, hasGrid, labelMode, setAxisTitle, setAxisVisible, setGrid, setLabelPosition, setLabels } from '../src/app/chart-elements.ts';

const chart = (): ChartModel => ({
  plots: [{ type: 'bar', barDirection: 'col', series: [], axisIds: [1, 2] }],
  axes: [{ id: 1, type: 'cat', position: 'b', crossAxisId: 2 }, { id: 2, type: 'val', position: 'l', crossAxisId: 1 }],
});

test('axes horizontal et vertical d apres leur position', () => {
  const c = chart();
  assert.equal(axisOf(c, 'h')?.type, 'cat');
  assert.equal(axisOf(c, 'v')?.type, 'val');
  const bars = chart();
  bars.axes = [{ id: 1, type: 'cat', position: 'l', crossAxisId: 2 }, { id: 2, type: 'val', position: 'b', crossAxisId: 1 }];
  assert.equal(axisOf(bars, 'h')?.type, 'val');
});

test('titre d axe : ajout, relecture, retrait ; axe masque puis affiche', () => {
  const c = chart();
  setAxisTitle(c, 'v', 'Ventes');
  assert.equal(hasAxisTitle(c, 'v'), true);
  assert.equal(axisOf(c, 'v')?.title?.text, 'Ventes');
  setAxisTitle(c, 'v', null);
  assert.equal(hasAxisTitle(c, 'v'), false);
  setAxisVisible(c, 'h', false);
  assert.equal(axisVisible(c, 'h'), false);
  setAxisVisible(c, 'h', true);
  assert.ok(axisVisible(c, 'h') && axisOf(c, 'h')?.deleted === undefined);
});

test('quadrillage : horizontal = axe des valeurs, mineur plus fin, retrait propre', () => {
  const c = chart();
  setGrid(c, 'h', 'major', true);
  setGrid(c, 'h', 'minor', true);
  setGrid(c, 'v', 'major', true);
  assert.ok(hasGrid(c, 'h', 'major') && hasGrid(c, 'h', 'minor') && hasGrid(c, 'v', 'major'));
  assert.equal(axisOf(c, 'v')?.minorGridlines?.line?.width, 0.5);
  assert.equal(c.axes.find((a) => a.type === 'val')?.minorGridlines?.line?.width, 0.5);
  setGrid(c, 'h', 'major', false);
  assert.equal(hasGrid(c, 'h', 'major'), false);
  assert.ok(!('majorGridlines' in (c.axes.find((a) => a.type === 'val') ?? {})));
});

test('etiquettes : modes, position conservee, retrait', () => {
  const c = chart();
  setLabels(c, 'valueCategory');
  assert.equal(labelMode(c.plots[0]?.dataLabels), 'valueCategory');
  setLabelPosition(c, 'outEnd');
  setLabels(c, 'category');
  assert.deepEqual(c.plots[0]?.dataLabels, { showCategory: true, position: 'outEnd' });
  setLabels(c, 'percent');
  assert.equal(labelMode(c.plots[0]?.dataLabels), 'percent');
  setLabels(c, 'none');
  assert.equal(c.plots[0]?.dataLabels, undefined);
});

test('tendances et barres d erreur : appliquees a toutes les series, retirees proprement', async () => {
  const { errorKind, setErrorBars, setTrend, supportsOverlays, trendKind } = await import('../src/app/chart-elements.ts');
  const c = chart();
  const s = (n: string) => ({ name: n, categories: { labels: ['a', 'b'] }, values: { values: [1, 2] } });
  c.plots[0]!.series = [s('A'), s('B')];
  assert.equal(supportsOverlays(c), true);
  setTrend(c, 'poly');
  assert.deepEqual(c.plots[0]?.series.map((x) => x.trendlines?.[0]), [{ type: 'poly', order: 2 }, { type: 'poly', order: 2 }]);
  assert.equal(trendKind(c), 'poly');
  setTrend(c, 'none');
  assert.equal(trendKind(c), 'none');
  setErrorBars(c, 'percentage');
  assert.deepEqual(c.plots[0]?.series[1]?.errorBars, [{ barType: 'both', valueType: 'percentage', value: 5 }]);
  assert.equal(errorKind(c), 'percentage');
  setErrorBars(c, 'stdErr');
  assert.deepEqual(c.plots[0]?.series[0]?.errorBars, [{ barType: 'both', valueType: 'stdErr' }]);
  setErrorBars(c, 'none');
  assert.equal(errorKind(c), 'none');
  c.plots[0]!.type = 'pie';
  assert.equal(supportsOverlays(c), false);
});
