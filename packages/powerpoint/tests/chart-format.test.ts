import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChartModel, Fill, Line } from '@forgeoffice/pptx';
import { elementsOf, fillOf, hasFill, hasLine, hasText, lineOf, setFill, setLine, setText, textOf } from '../src/app/chart-format.ts';

const s = (name: string) => ({ name, categories: { labels: ['a'] }, values: { values: [1] } });
const chart = (): ChartModel => ({
  title: { text: 'T' },
  legend: { position: 'r' },
  plots: [{ type: 'bar', barDirection: 'col', series: [s('A'), s('B')], axisIds: [1, 2] }],
  axes: [{ id: 1, type: 'cat', position: 'b', crossAxisId: 2 }, { id: 2, type: 'val', position: 'l', crossAxisId: 1 }],
});
const red: Fill = { type: 'solid', color: { type: 'rgb', value: 'FF0000' } };
const line: Line = { width: 2, fill: red };

test('elements presents : zones, titre et legende si presents, axes, series', () => {
  assert.deepEqual(elementsOf(chart()), ['chartArea', 'plotArea', 'title', 'legend', 'axisH', 'axisV', 'series0', 'series1']);
  const c = chart();
  c.title = null;
  c.legend = null;
  assert.deepEqual(elementsOf(c), ['chartArea', 'plotArea', 'axisH', 'axisV', 'series0', 'series1']);
  const auto = chart();
  delete auto.title;
  assert.equal(elementsOf(auto).includes('title'), false);
  auto.plots[0]!.series = [s('Seule')];
  assert.equal(elementsOf(auto).includes('title'), true);
  setText(auto, 'title', { size: 18 });
  assert.deepEqual(auto.title, { props: { size: 18 } });
});

test('remplissage et contour : zones, series, axes ; retrait par null', () => {
  const c = chart();
  setFill(c, 'chartArea', red);
  setFill(c, 'series1', red);
  setLine(c, 'plotArea', line);
  setLine(c, 'axisV', line);
  assert.equal(fillOf(c, 'chartArea'), red);
  assert.equal(fillOf(c, 'series1'), red);
  assert.equal(fillOf(c, 'series0'), undefined);
  assert.equal(lineOf(c, 'plotArea'), line);
  assert.equal(c.axes.find((a) => a.type === 'val')?.line, line);
  setFill(c, 'series1', null);
  assert.ok(!('fill' in (c.plots[0]?.series[1] ?? {})));
  setLine(c, 'axisV', null);
  assert.equal(lineOf(c, 'axisV'), undefined);
});

test('texte : titre, legende, axe et texte general ; valeurs retirees', () => {
  const c = chart();
  setText(c, 'title', { size: 20, bold: true });
  setText(c, 'legend', { size: 9 });
  setText(c, 'axisH', { color: { type: 'rgb', value: '0000FF' } });
  setText(c, 'chartArea', { size: 11 });
  assert.deepEqual(textOf(c, 'title'), { size: 20, bold: true });
  assert.equal(textOf(c, 'legend')?.size, 9);
  assert.equal(textOf(c, 'axisH')?.color?.type, 'rgb');
  assert.equal(c.textProps?.size, 11);
  setText(c, 'title', { bold: false, size: undefined });
  assert.deepEqual(textOf(c, 'title'), {});
});

test('proprietes disponibles selon l element', () => {
  assert.deepEqual(['chartArea', 'series0', 'axisH', 'title'].map((e) => [hasFill(e as 'title'), hasLine(e as 'title'), hasText(e as 'title')]), [[true, true, true], [true, true, false], [false, true, true], [false, false, true]]);
});
