// Section « Format de l'élément de graphique » : choix de l'élément (zones, titre, légende, axes, séries), remplissage, contour, texte.
import { useState } from 'react';
import { Checkbox, NumberField } from '@forgeoffice/ui';
import { chartSeries, type ChartModel, type Color } from '@forgeoffice/pptx';
import { S } from '../../strings.ts';
import { S3 } from '../strings-text.ts';
import type { Editor } from '../editor.ts';
import { elementsOf, fillOf, hasFill, hasLine, hasText, lineOf, seriesIndex, setFill, setLine, setText, textOf, type ChartElement } from '../chart-format.ts';
import { ColorField, Section } from './PaneSection.tsx';

const ACCENT: Color = { type: 'scheme', value: 'accent1' };
const TEXT: Color = { type: 'scheme', value: 'tx1' };

export function ChartFormatSection({ ed, chart }: { ed: Editor; chart: ChartModel }) {
  const [element, setElement] = useState<ChartElement>('chartArea');
  const C = S3.chartFormat;
  const elements = elementsOf(chart);
  const current = elements.includes(element) ? element : 'chartArea';
  const edit = (recipe: (c: ChartModel) => void): void =>
    ed.editSelected((s) => {
      if (s.kind !== 'chart') return;
      recipe(s.chart);
      delete s.source;
    }, 'chart-format');
  const series = chartSeries(chart);
  const label = (el: ChartElement): string => (el.startsWith('series') ? `${C.series} « ${series[seriesIndex(el)]?.name ?? seriesIndex(el) + 1} »` : C.elements[el as Exclude<ChartElement, `series${number}`>]);
  const fill = fillOf(chart, current);
  const line = lineOf(chart, current);
  const text = textOf(chart, current);
  const lineKind = !line ? 'auto' : line.fill?.type === 'none' ? 'none' : 'solid';
  return (
    <Section title={C.title} testId="chart-format-section">
      <div className="pp-form">
        <label htmlFor="pp-chart-element">{C.element}</label>
        <select id="pp-chart-element" aria-label={C.element} value={current} onChange={(e) => setElement(e.target.value as ChartElement)}>
          {elements.map((el) => <option key={el} value={el}>{label(el)}</option>)}
        </select>
      </div>
      {hasFill(current) && (
        <>
          <div className="pp-pane__radios">
            <label><input type="radio" name="pp-chart-fill" checked={!fill} onChange={() => edit((c) => setFill(c, current, null))} /> {C.auto}</label>
            <label><input type="radio" name="pp-chart-fill" checked={fill?.type === 'none'} onChange={() => edit((c) => setFill(c, current, { type: 'none' }))} /> {S.panes.noFill}</label>
            <label><input type="radio" name="pp-chart-fill" checked={fill?.type === 'solid'} onChange={() => edit((c) => setFill(c, current, { type: 'solid', color: ACCENT }))} /> {S.dialogs.solidFill}</label>
          </div>
          {fill?.type === 'solid' && <ColorField ed={ed} label={`${C.fill} (${label(current)})`} value={fill.color} onChange={(color) => edit((c) => setFill(c, current, { type: 'solid', color }))} />}
        </>
      )}
      {hasLine(current) && (
        <>
          <div className="pp-pane__radios">
            <label><input type="radio" name="pp-chart-line" checked={lineKind === 'auto'} onChange={() => edit((c) => setLine(c, current, null))} /> {C.autoLine}</label>
            <label><input type="radio" name="pp-chart-line" checked={lineKind === 'none'} onChange={() => edit((c) => setLine(c, current, { fill: { type: 'none' } }))} /> {S3.format.line.none}</label>
            <label><input type="radio" name="pp-chart-line" checked={lineKind === 'solid'} onChange={() => edit((c) => setLine(c, current, { width: 1, fill: { type: 'solid', color: TEXT } }))} /> {S3.format.line.solid}</label>
          </div>
          {line?.fill?.type === 'solid' && (
            <>
              <ColorField ed={ed} label={`${C.line} (${label(current)})`} value={line.fill.color} onChange={(color) => edit((c) => setLine(c, current, { ...line, fill: { type: 'solid', color } }))} />
              <div className="pp-form">
                <label>{S.drawing.weight}</label>
                <NumberField value={line.width ?? 1} min={0.25} max={20} step={0.25} unit="pt" width={100} onChange={(w) => edit((c) => setLine(c, current, { ...line, width: w }))} label={`${S.drawing.weight} (${label(current)})`} />
              </div>
            </>
          )}
        </>
      )}
      {hasText(current) && (
        <>
          <div className="pp-form">
            <label>{C.textSize}</label>
            <NumberField value={text?.size ?? 12} min={4} max={96} step={1} unit="pt" width={100} onChange={(v) => edit((c) => setText(c, current, { size: v }))} label={`${C.textSize} (${label(current)})`} />
          </div>
          <Checkbox checked={!!text?.bold} label={C.bold} onChange={(v) => edit((c) => setText(c, current, { bold: v }))} />
          <ColorField ed={ed} label={`${C.textColor} (${label(current)})`} value={text?.color ?? TEXT} transparency={false} onChange={(color) => edit((c) => setText(c, current, { color }))} />
        </>
      )}
    </Section>
  );
}
