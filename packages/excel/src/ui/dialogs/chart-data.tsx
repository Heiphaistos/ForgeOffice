// Selectionner la source de donnees : une ligne par serie (nom, valeurs, categories), ajout et suppression.
import { useState } from 'react';
import { Button, Dialog } from '@forgeoffice/ui';
import { applySeries, invalidRows, seriesRows, type SeriesRow } from '../../logic/chart-data.ts';
import { S } from '../../strings/index.ts';
import type { DlgEnv } from './basic.tsx';

export function ChartDataDialog({ x, index }: { x: DlgEnv; index: number }) {
  const drawing = x.sheet.drawings[index];
  const model = drawing?.kind === 'chart' ? drawing.chart : undefined;
  const [rows, setRows] = useState<SeriesRow[]>(() => (model ? seriesRows(model) : []));
  const [bad, setBad] = useState<number[]>([]);
  const set = (i: number, patch: Partial<SeriesRow>): void => setRows((cur) => cur.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const apply = (): void => {
    const invalid = invalidRows(rows);
    if (invalid.length || !model) {
      setBad(invalid);
      return;
    }
    x.store.commit((d) => {
      const sh = d.sheet(x.si);
      sh.drawings = sh.drawings.map((o, i) => (i === index && o.kind === 'chart' ? { ...o, chart: applySeries(o.chart, rows) } : o));
    });
    x.close();
  };
  const T = S.chart.data;
  return (
    <Dialog open title={T.title} onClose={x.close} onConfirm={apply} width={620}>
      <table className="xl-dlg-table cd-table">
        <thead><tr><th>{T.name}</th><th>{T.values}</th><th>{T.categories}</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={bad.includes(i) ? 'cd-bad' : ''}>
              <td><input aria-label={`${T.name} ${i + 1}`} value={r.name} onChange={(e) => set(i, { name: e.target.value })} /></td>
              <td><input aria-label={`${T.values} ${i + 1}`} value={r.values} onChange={(e) => set(i, { values: e.target.value })} /></td>
              <td><input aria-label={`${T.categories} ${i + 1}`} value={r.categories} onChange={(e) => set(i, { categories: e.target.value })} /></td>
              <td><Button size="small" appearance="subtle" icon="delete" aria-label={T.remove} onClick={() => setRows((cur) => cur.filter((_, k) => k !== i))} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button icon="add" onClick={() => setRows((cur) => [...cur, { name: '', values: '', categories: cur[0]?.categories ?? '' }])}>{T.add}</Button>
      {bad.length > 0 && <p className="tw-error" role="alert">{T.invalid}</p>}
    </Dialog>
  );
}
