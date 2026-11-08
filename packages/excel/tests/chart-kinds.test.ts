// Types de graphique a barres : groupe, empile, 100 %, horizontal ou vertical, aller-retour withKind / kindOf.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withKind, kindOf, CHART_KINDS } from '../src/logic/charts.ts';

test('kindOf relit chaque type de barres construit par withKind', () => {
  for (const k of ['col', 'colStacked', 'colPercent', 'bar', 'barStacked', 'barPercent', 'line', 'lineStacked', 'area', 'areaStacked', 'radar', 'radarFilled', 'lineSmooth'] as const) {
    assert.equal(kindOf(withKind({ plots: [], axes: [] }, k, [{ idx: 0, order: 0, values: {} }])), k);
    assert.ok(CHART_KINDS.includes(k));
  }
  const m = withKind({ plots: [], axes: [] }, 'barPercent', []);
  assert.equal(m.plots[0]?.grouping, 'percentStacked');
  assert.equal(m.axes[0]?.position, 'l', 'barres horizontales : categories a gauche');
});

test('nuage de points : avec ou sans lignes', () => {
  assert.equal(kindOf(withKind({ plots: [], axes: [] }, 'scatter', [])), 'scatter');
  const s = [{ idx: 0, order: 0, values: {} }];
  assert.equal(kindOf(withKind({ plots: [], axes: [] }, 'scatter', [{ ...s[0]!, line: { none: true } }])), 'scatter');
  assert.equal(kindOf(withKind({ plots: [], axes: [] }, 'scatterLines', s)), 'scatterLines');
});
