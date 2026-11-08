// Donnees > Avance : filtre par zone de criteres, sur place (lignes masquees) ou copie vers un autre emplacement.
import { useState } from 'react';
import { Checkbox, Dialog } from '@forgeoffice/ui';
import type { Scalar } from '@forgeoffice/formulas';
import { rangeName } from '@forgeoffice/xlsx';
import { advancedFilter } from '../../logic/advanced-filter.ts';
import { fromScalar } from '../../logic/engine.ts';
import { rangeSelection } from '../../logic/selection.ts';
import { S } from '../../strings/index.ts';
import { readRange, type DlgEnv } from './basic.tsx';

export function AdvancedFilterDialog({ x }: { x: DlgEnv }) {
  const A = S.advFilter;
  const initial = x.cmd.dataRange();
  const [mode, setMode] = useState<'inPlace' | 'copy'>('inPlace');
  const [list, setList] = useState(rangeName(initial));
  const [crit, setCrit] = useState('');
  const [dest, setDest] = useState('');
  const [unique, setUnique] = useState(false);
  const [error, setError] = useState('');
  const matrix = (r: NonNullable<ReturnType<typeof readRange>>): Scalar[][] =>
    Array.from({ length: r.r2 - r.r1 + 1 }, (_, i) => Array.from({ length: r.c2 - r.c1 + 1 }, (_, k) => x.value(r.r1 + i, r.c1 + k)));
  const apply = (): void => {
    const l = readRange(list);
    const c = readRange(crit);
    const to = readRange(dest);
    if (!l || !c) return setError(A.invalid);
    if (mode === 'copy' && !to) return setError(A.invalidDest);
    const rows = advancedFilter(matrix(l), matrix(c), { unique });
    x.store.commit((d) => {
      if (mode === 'inPlace') {
        const sh = d.sheet(x.si);
        for (let r = l.r1 + 1; r <= l.r2; r++) {
          const info = { ...sh.rows.get(r) };
          if (rows.includes(r - l.r1)) delete info.hidden;
          else info.hidden = true;
          sh.rows.set(r, info);
        }
      } else if (to) {
        const m = matrix(l);
        [0, ...rows].forEach((ri, k) => (m[ri] ?? []).forEach((v, ci) => d.set(x.si, to.r1 + k, to.c1 + ci, v === null ? undefined : { value: fromScalar(v) })));
        x.setSel(rangeSelection({ r1: to.r1, c1: to.c1, r2: to.r1 + rows.length, c2: to.c1 + (l.c2 - l.c1) }));
      }
    });
    x.notify(A.result(rows.length), 'info');
    x.close();
  };
  return (
    <Dialog open title={A.title} onClose={x.close} onConfirm={apply} width={440}>
      <fieldset className="xl-fs">
        <legend>{A.action}</legend>
        <label className="xl-radio"><input type="radio" checked={mode === 'inPlace'} onChange={() => setMode('inPlace')} />{A.inPlace}</label>
        <label className="xl-radio"><input type="radio" checked={mode === 'copy'} onChange={() => setMode('copy')} />{A.copy}</label>
      </fieldset>
      <div className="xl-form">
        <label htmlFor="af-list">{A.listRange}</label>
        <input id="af-list" className="ps-count" value={list} onChange={(e) => setList(e.target.value)} />
        <label htmlFor="af-crit">{A.criteriaRange}</label>
        <input id="af-crit" className="ps-count" value={crit} onChange={(e) => setCrit(e.target.value)} />
        <label htmlFor="af-dest">{A.copyTo}</label>
        <input id="af-dest" className="ps-count" value={dest} disabled={mode !== 'copy'} onChange={(e) => setDest(e.target.value)} />
      </div>
      <Checkbox checked={unique} onChange={setUnique} label={A.unique} />
      {error && <p className="tw-error" role="alert">{error}</p>}
    </Dialog>
  );
}
