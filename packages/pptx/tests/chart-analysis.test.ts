import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChart, addSlide, createBlankDeck, readPptx, writePptx } from '../src/index.ts';

test('courbes de tendance et barres d erreur : aller-retour .pptx', async () => {
  const deck = createBlankDeck('widescreen');
  const slide = addSlide(deck, deck.masters[0]?.layouts[1]?.id ?? '');
  const shape = addChart(slide, 'bar', ['T1', 'T2', 'T3'], [{ name: 'Ventes', values: [10, 20, 15] }], { x: 50, y: 50, width: 400, height: 300 });
  const series = shape.chart.plots[0]?.series[0];
  assert.ok(series);
  series.trendlines = [{ type: 'poly', order: 3, displayEquation: true, displayR2: true, forward: 1 }];
  series.errorBars = [{ barType: 'plus', valueType: 'percentage', value: 7, noEndCap: true }, { direction: 'y', barType: 'both', valueType: 'stdErr' }];
  const back = await readPptx(await writePptx(deck));
  const chart = back.slides.at(-1)?.shapes.find((s) => s.kind === 'chart');
  assert.ok(chart && chart.kind === 'chart');
  const s = chart.chart.plots[0]?.series[0];
  assert.equal(s?.trendlines?.[0]?.type, 'poly');
  assert.equal(s?.trendlines?.[0]?.order, 3);
  assert.equal(s?.trendlines?.[0]?.displayR2, true);
  assert.deepEqual(s?.errorBars?.map((e) => [e.barType, e.valueType, e.value, e.noEndCap ?? false]), [['plus', 'percentage', 7, true], ['both', 'stdErr', undefined, false]]);
});
