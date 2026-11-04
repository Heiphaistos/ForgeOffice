import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChart, cssColor, office2024Theme, type ChartModel, type ChartType } from '@forgeoffice/pptx';
import { niceScale, renderChart, svgToString, type ChartRenderContext, type SvgNode } from '../src/canvas/chart/index.ts';
import { sliceAngles } from '../src/canvas/chart/pie.ts';

const theme = office2024Theme();
const ctx: ChartRenderContext = { color: (c) => cssColor(c, theme), fontFamily: 'Aptos, sans-serif' };

function walk(node: SvgNode, visit: (n: SvgNode) => void): void {
  visit(node);
  for (const c of node.children) if (typeof c !== 'string') walk(c, visit);
}
const find = (node: SvgNode, pred: (n: SvgNode) => boolean): SvgNode[] => {
  const out: SvgNode[] = [];
  walk(node, (n) => {
    if (pred(n)) out.push(n);
  });
  return out;
};
const texts = (node: SvgNode): string[] => find(node, (n) => n.tag === 'text').map((n) => n.children.join(''));

function assertFinite(node: SvgNode): void {
  walk(node, (n) => {
    for (const [k, v] of Object.entries(n.attrs)) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${n.tag}.${k} = ${v}`);
      else assert.ok(!/NaN|Infinity/.test(v), `${n.tag}.${k} = ${v}`);
    }
  });
  assert.ok(!/NaN|Infinity/.test(svgToString(node)));
}

test('niceScale : graduations rondes a la maniere d Excel', () => {
  assert.deepEqual(niceScale(0, 87), { min: 0, max: 100, step: 20 });
  const neg = niceScale(-35, 87);
  assert.ok(neg.min <= -35 && neg.max >= 87 && neg.step > 0);
  assert.equal(Math.round(neg.min / neg.step) * neg.step, neg.min);
  assert.equal(Math.round(neg.max / neg.step) * neg.step, neg.max);
  const allNeg = niceScale(-87, -10);
  assert.ok(allNeg.min <= -87 && allNeg.max === 0);
  assert.deepEqual(niceScale(0, 0), { min: 0, max: 1, step: 0.2 });
  const flat = niceScale(5, 5);
  assert.ok(flat.min === 0 && flat.max >= 5 && flat.step > 0);
  assert.deepEqual(niceScale(Number.NaN, Number.NaN), { min: 0, max: 1, step: 0.2 });
});

const TYPES: ChartType[] = ['bar', 'line', 'pie', 'doughnut', 'area', 'scatter', 'radar', 'bubble', 'stock', 'surface', 'ofPie'];
const cats = ['T1', 'T2', 'T3', 'T4'];
const series = [
  { name: 'Ventes', values: [12, null, 30, 87], xValues: [1, 2, 3, 4], sizes: [1, 4, 2, 3] },
  { name: 'Couts', values: [-5, 8, 15, 20], xValues: [1, 2, 3, 4], sizes: [2, 1, 3, 1] },
];

test('chaque type cree par createChart produit un SVG sans NaN', () => {
  for (const type of TYPES) {
    for (const grouping of ['clustered', 'stacked', 'percentStacked'] as const) {
      const svg = renderChart(createChart(type, cats, series, { title: 'Titre', grouping }), 480, 300, ctx);
      assert.equal(svg.tag, 'svg', type);
      assert.equal(svg.attrs.width, 480);
      assert.equal(svg.attrs.viewBox, '0 0 480 300');
      assertFinite(svg);
      assert.ok(find(svg, (n) => n.tag === 'path' || n.tag === 'rect' || n.tag === 'circle').length > 1, type);
    }
  }
  // Donnees vides et boite minuscule : aucun plantage.
  for (const type of TYPES) {
    assertFinite(renderChart(createChart(type, [], []), 0, -5, ctx));
    assertFinite(renderChart(createChart(type, ['A'], [{ name: '', values: [null] }]), 20, 10, ctx));
  }
});

test('barres groupees : un rectangle par serie et categorie, hauteurs proportionnelles', () => {
  const chart = createChart('bar', ['A', 'B', 'C'], [
    { name: 'S1', values: [10, 20, 40] },
    { name: 'S2', values: [5, 15, 30] },
  ]);
  const svg = renderChart(chart, 400, 300, ctx);
  const noLegend = renderChart({ ...chart, legend: null }, 400, 300, ctx);
  const accent = (n: number): string => cssColor({ type: 'scheme', value: n === 1 ? 'accent1' : 'accent2' }, theme);
  const bars = find(noLegend, (n) => n.tag === 'rect' && (n.attrs.fill === accent(1) || n.attrs.fill === accent(2)));
  assert.equal(bars.length, 6);
  const h = bars.map((b) => Number(b.attrs.height));
  assert.ok(Math.abs(h[1]! / h[0]! - 2) < 1e-6);
  assert.ok(Math.abs(h[2]! / h[0]! - 4) < 1e-6);
  assert.ok(Math.abs(h[5]! / h[3]! - 6) < 1e-6);
  // Axe de valeurs : 0..45 -> graduations rondes formatees en francais, categories sous l'axe.
  const labels = texts(svg);
  for (const t of ['A', 'B', 'C', 'S1', 'S2', '0']) assert.ok(labels.includes(t), t);
});

test('secteurs : les angles couvrent 360 degres, une part par valeur', () => {
  const angles = sliceAngles([10, null, 30, -60], 90);
  assert.equal(angles[0]![0], 90);
  assert.ok(Math.abs(angles.at(-1)![1] - 450) < 1e-9);
  assert.equal(angles[1]![0], angles[1]![1]);
  const total = angles.reduce((t, [a, b]) => t + b - a, 0);
  assert.ok(Math.abs(total - 360) < 1e-9);
  const svg = renderChart(createChart('pie', ['A', 'B', 'C'], [{ name: 'Parts', values: [1, 2, 3] }]), 300, 300, ctx);
  assert.equal(find(svg, (n) => n.tag === 'path' && String(n.attrs.d).includes('A')).length, 3);
  // Titre automatique : nom de la serie unique, comme Office.
  assert.ok(texts(svg).includes('Parts'));
  // Etiquettes en pourcentage.
  const chart = createChart('pie', ['A', 'B'], [{ name: 'P', values: [1, 3] }]);
  chart.plots[0]!.dataLabels = { showPercent: true };
  assert.ok(texts(renderChart(chart, 300, 300, ctx)).includes('75%'));
});

test('legende presente ou absente', () => {
  const withLegend = renderChart(createChart('line', cats, series), 400, 300, ctx);
  assert.ok(texts(withLegend).includes('Ventes') && texts(withLegend).includes('Couts'));
  const without = renderChart(createChart('line', cats, series, { legend: null }), 400, 300, ctx);
  assert.ok(!texts(without).includes('Ventes'));
  for (const position of ['r', 'l', 't', 'tr'] as const) {
    const svg = renderChart(createChart('bar', cats, series, { legend: position }), 400, 300, ctx);
    assert.ok(texts(svg).includes('Couts'), position);
    assertFinite(svg);
  }
});

test('titre par defaut, valeurs imposees et format de nombre francais', () => {
  const chart: ChartModel = createChart('bar', ['A'], [{ name: 'S', values: [1.5] }, { name: 'T', values: [2] }]);
  chart.title = {};
  chart.axes[1] = { ...chart.axes[1]!, min: 0, max: 3, majorUnit: 0.5 };
  chart.plots[0]!.dataLabels = { showValue: true };
  const labels = texts(renderChart(chart, 400, 300, ctx));
  assert.ok(labels.includes('Titre du graphique'));
  assert.ok(labels.includes('1,5') && labels.includes('3') && labels.includes('2,5'));
});

test('svgToString echappe < & " et ignore les attributs d evenement', () => {
  const xml = svgToString({ tag: 'text', attrs: { x: 1.234, title: 'a"b<c>&', onclick: 'alert(1)' }, children: ['<script>&"'] });
  assert.equal(xml, '<text x="1.23" title="a&quot;b&lt;c&gt;&amp;">&lt;script&gt;&amp;"</text>');
  const chart = createChart('bar', ['<b>&'], [{ name: '"x"<', values: [1] }], { title: '<svg onload=1>' });
  const out = svgToString(renderChart(chart, 300, 200, ctx));
  assert.ok(!out.includes('<b>') && !out.includes('<svg onload'));
  assert.ok(out.includes('&lt;b&gt;&amp;'));
});
