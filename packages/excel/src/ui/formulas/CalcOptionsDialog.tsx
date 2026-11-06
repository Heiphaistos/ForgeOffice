// Options de calcul itératif (Formules > Options de calcul) : activation, nombre maximal d'iterations, variation maximale.
import { useState } from 'react';
import { Checkbox, Dialog, NumberField } from '@forgeoffice/ui';
import { iterationError, iterationOf, withIteration } from '../../logic/formulas/calc.ts';
import { FM } from '../../strings/index.ts';
import type { DialogEnv } from '../registry.ts';
import './formulas.css';

export function CalcOptionsDialog({ x }: { x: DialogEnv }) {
  const [it, setIt] = useState(() => iterationOf(x.store.wb.calc));
  const problem = iterationError(it);
  const save = (): void => {
    if (problem) return;
    x.store.commit((d) => {
      d.wb.calc = withIteration(d.wb.calc, it);
    }, 'calc');
    x.close();
  };
  return (
    <Dialog open title={FM.calc.iterTitle} onClose={x.close} onConfirm={save} width={460}>
      <div className="xl-form xl-form--stack">
        <Checkbox checked={it.enabled} onChange={(v) => setIt({ ...it, enabled: v })} label={FM.calc.iterEnable} />
        <div className="xl-form">
          <label>{FM.calc.iterCount}</label>
          <NumberField value={it.count} min={1} max={32767} step={1} width={110} label={FM.calc.iterCount} onChange={(v) => setIt({ ...it, count: v })} />
          <label>{FM.calc.iterDelta}</label>
          <NumberField value={it.delta} min={0} step={0.001} width={110} label={FM.calc.iterDelta} onChange={(v) => setIt({ ...it, delta: v })} />
        </div>
        <p className="xl-hint">{FM.calc.iterHint}</p>
        <p className="xlf-error" role="alert">{problem === 'count' ? FM.calc.badCount : problem === 'delta' ? FM.calc.badDelta : ''}</p>
      </div>
    </Dialog>
  );
}
