// Analyse de scenarios > Valeur cible : deux etapes (parametres, puis resultat a accepter ou refuser).
import { useState } from 'react';
import { Dialog } from '@forgeoffice/ui';
import { cellName } from '@forgeoffice/xlsx';
import { commitEntry, parseEntry } from '../../logic/cells.ts';
import { goalSeek, type GoalResult } from '../../logic/goal-seek.ts';
import { S } from '../../strings/index.ts';
import { readRange, type DlgEnv } from './basic.tsx';

export function GoalSeekDialog({ x }: { x: DlgEnv }) {
  const a = x.sel.active;
  const [cell, setCell] = useState(cellName(a.row, a.col));
  const [target, setTarget] = useState('');
  const [changing, setChanging] = useState('');
  const [error, setError] = useState('');
  const [res, setRes] = useState<(GoalResult & { at: { row: number; col: number } }) | null>(null);
  const G = S.goalSeek;
  const run = (): void => {
    const f = readRange(cell);
    const c = readRange(changing);
    const t = Number(target.replace(',', '.'));
    if (!f || !c || target.trim() === '' || !Number.isFinite(t)) return setError(G.invalid);
    if (typeof x.value(f.r1, f.c1) !== 'number') return setError(G.notFormula);
    setError('');
    setRes({ ...goalSeek(x.store.wb, x.si, { row: f.r1, col: f.c1 }, t, { row: c.r1, col: c.c1 }), at: { row: c.r1, col: c.c1 } });
  };
  const accept = (): void => {
    if (res?.found) {
      const entry = parseEntry(String(Number(res.x.toPrecision(12))), x.store.wb.date1904);
      if (entry.ok) x.store.commit((d) => commitEntry(d, x.si, res.at.row, res.at.col, entry));
    }
    x.close();
  };
  if (res) {
    return (
      <Dialog open title={G.title} onClose={x.close} width={380}
        actions={[{ label: S.cancel, onClick: x.close }, { label: S.ok, onClick: accept, primary: true }]}>
        <p role="status">{res.found ? G.found(cell, Number(res.value.toPrecision(10))) : G.notFound}</p>
        {res.found && <p>{G.newValue(changing, Number(res.x.toPrecision(10)))}</p>}
      </Dialog>
    );
  }
  return (
    <Dialog open title={G.title} onClose={x.close} onConfirm={run} width={380}>
      <div className="xl-form">
        <label htmlFor="gs-cell">{G.setCell}</label>
        <input id="gs-cell" className="ps-count" value={cell} onChange={(e) => setCell(e.target.value)} />
        <label htmlFor="gs-target">{G.toValue}</label>
        <input id="gs-target" className="ps-count" value={target} onChange={(e) => setTarget(e.target.value)} />
        <label htmlFor="gs-changing">{G.byChanging}</label>
        <input id="gs-changing" className="ps-count" value={changing} onChange={(e) => setChanging(e.target.value)} />
      </div>
      {error && <p className="tw-error" role="alert">{error}</p>}
    </Dialog>
  );
}
