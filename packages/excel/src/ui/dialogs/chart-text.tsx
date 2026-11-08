// Saisie du texte du graphique : titre du graphique ou titre d'un axe.
import { useState } from 'react';
import { Dialog, TextField } from '@forgeoffice/ui';
import { axisTitle, setAxisTitle, setTitleText } from '../../logic/chart-elements.ts';
import { S } from '../../strings/index.ts';
import type { DlgEnv } from './basic.tsx';

export function ChartTextDialog({ x, index, target }: { x: DlgEnv; index: number; target: 'title' | 'category' | 'value' }) {
  const drawing = x.sheet.drawings[index];
  const model = drawing?.kind === 'chart' ? drawing.chart : undefined;
  const current = model ? (target === 'title' ? model.title?.text : axisTitle(model, target)) ?? '' : '';
  const [text, setText] = useState(current);
  const apply = (): void => {
    if (!model) return x.close();
    x.store.commit((d) => {
      const sh = d.sheet(x.si);
      sh.drawings = sh.drawings.map((o, i) => (i === index && o.kind === 'chart'
        ? { ...o, chart: target === 'title' ? setTitleText(o.chart, text) : setAxisTitle(o.chart, target, text, S.chart.axisTitle) }
        : o));
    });
    x.close();
  };
  return (
    <Dialog open title={S.chart.editTitle} onClose={x.close} onConfirm={apply} width={380}>
      <div className="xl-form">
        <label htmlFor="ct-text">{S.chart.textLabel}</label>
        <TextField id="ct-text" value={text} autoFocus onChange={(e) => setText(e.target.value)} />
      </div>
    </Dialog>
  );
}
