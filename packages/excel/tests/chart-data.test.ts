// Selectionner des donnees : lignes de series, validation, reconstruction.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChartModel } from '@forgeoffice/xlsx';
import { applySeries, invalidRows, seriesRows } from '../src/logic/chart-data.ts';

const model: ChartModel = {
  plots: [{ type: 'bar', axisIds: [1, 2], series: [{ idx: 0, order: 0, name: { text: 'Ventes' }, values: { ref: 'Feuil1!$B$2:$B$5' }, categories: { ref: 'Feuil1!$A$2:$A$5' }, color: 'FF0000' }] }],
  axes: [],
};

test('lignes de series et validation', () => {
  const rows = seriesRows(model);
  assert.deepEqual(rows, [{ name: 'Ventes', values: 'Feuil1!$B$2:$B$5', categories: 'Feuil1!$A$2:$A$5' }]);
  assert.deepEqual(invalidRows(rows), []);
  assert.deepEqual(invalidRows([{ name: '', values: 'abc', categories: '' }, { name: '', values: 'B2:B5', categories: 'zz' }]), [0, 1]);
});

test('reconstruction : modification, ajout (nom en reference) et suppression', () => {
  const grown = applySeries(model, [
    { name: 'Ventes', values: 'C2:C5', categories: 'A2:A5' },
    { name: 'Feuil1!$D$1', values: 'D2:D5', categories: '' },
  ]);
  const s = grown.plots[0]!.series;
  assert.equal(s.length, 2);
  assert.equal(s[0]?.values.ref, 'C2:C5');
  assert.equal(s[0]?.color, 'FF0000', 'la couleur de la serie est conservee');
  assert.deepEqual(s[1]?.name, { ref: 'Feuil1!$D$1' });
  assert.equal(s[1]?.categories, undefined);
  assert.equal(applySeries(grown, [{ name: 'x', values: 'B2:B3', categories: '' }]).plots[0]?.series.length, 1);
});

test('graphique combine : les series existantes gardent leur trace, l\'ajout va dans le premier', () => {
  const combo: ChartModel = {
    plots: [
      { type: 'bar', axisIds: [1, 2], series: [{ idx: 0, order: 0, values: { ref: 'B2:B3' } }] },
      { type: 'line', axisIds: [1, 2], series: [{ idx: 1, order: 1, values: { ref: 'C2:C3' } }] },
    ],
    axes: [],
  };
  const r = applySeries(combo, [{ name: '', values: 'D2:D3', categories: '' }, { name: '', values: 'E2:E3', categories: '' }, { name: '', values: 'F2:F3', categories: '' }]);
  assert.deepEqual(r.plots.map((p) => p.series.map((s) => s.values.ref)), [['D2:D3', 'F2:F3'], ['E2:E3']]);
});
