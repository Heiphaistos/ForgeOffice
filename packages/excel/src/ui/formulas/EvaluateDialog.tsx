// Evaluation de formule : pas a pas avec la sous-expression soulignee, pas a pas detaille (entrer dans la formule d'une cellule
// referencee) et pas sortant.
import { useState } from 'react';
import { Dialog } from '@forgeoffice/ui';
import { FormulaParseError, toLocalized } from '@forgeoffice/formulas';
import { rangeName } from '@forgeoffice/xlsx';
import { evaluateStep, startEvaluation, stepIn, stepOut, viewOf, type EvalEnv, type EvalState } from '../../logic/formulas/evaluate.ts';
import { FM } from '../../strings/index.ts';
import type { DialogEnv } from '../registry.ts';
import { useDialogFocus } from './focus.ts';
import './formulas.css';

const quoted = (s: string): string => (/^[A-Za-z_À-ÿ][\w.À-ÿ]*$/.test(s) ? s : `'${s.replace(/'/g, "''")}'`);

export function EvaluateDialog({ x }: { x: DialogEnv }) {
  const a = x.sel.active;
  const cell = x.sheet.cells.get(a.row)?.get(a.col);
  const origin = (sheet: string, row: number, col: number): string => `${quoted(sheet)}!${rangeName({ r1: row, c1: col, r2: row, c2: col }, true)}`;
  const start = (): EvalState | null => {
    if (cell?.formula === undefined) return null;
    try {
      return startEvaluation(cell.formula, x.sheet.name, origin(x.sheet.name, a.row, a.col));
    } catch (e) {
      if (e instanceof FormulaParseError) return null;
      throw e;
    }
  };
  const [state, setState] = useState<EvalState | null>(start);
  const env: EvalEnv = {
    evaluate: (f, sheet) => x.store.engine.engine.evaluate(f, sheet),
    formulaAt: (sheet, row, col) => x.store.wb.sheets.find((s) => s.name === sheet)?.cells.get(row)?.get(col)?.formula,
  };
  useDialogFocus([state]);
  const view = state ? viewOf(state, env) : null;
  const run = (fn: (s: EvalState) => EvalState): void => {
    if (state) setState(fn(state));
  };
  const shown = view?.text ?? (cell?.formula !== undefined ? toLocalized(`=${cell.formula}`, 'fr') : '');
  const u = view?.underline ?? null;
  return (
    <Dialog open title={FM.evaluate.title} onClose={x.close} width={600} actions={[
      view?.finished
        ? { label: FM.evaluate.restart, primary: true, onClick: () => setState(start()) }
        : { label: FM.evaluate.step, primary: true, disabled: !view, onClick: () => run((s) => evaluateStep(s, env)) },
      { label: FM.evaluate.stepIn, disabled: !view?.canStepIn, onClick: () => run((s) => stepIn(s, env, origin)) },
      { label: FM.evaluate.stepOut, disabled: !view?.canStepOut, onClick: () => run((s) => stepOut(s, env)) },
      { label: FM.evaluate.close, onClick: x.close },
    ]}>
      <div className="xlf-eval">
        {state === null && <p className="xlf-error" role="alert">{cell?.formula === undefined ? FM.evaluate.noFormula : FM.evaluate.invalid}</p>}
        <div className="xlf-eval__row">
          <span>{FM.evaluate.reference}</span>
          <strong>{view?.origin ?? origin(x.sheet.name, a.row, a.col)}</strong>
          {view && view.depth > 0 && <span className="xlf-eval__depth">{`(${view.depth})`}</span>}
        </div>
        <span>{FM.evaluate.evaluation}</span>
        <pre aria-live="polite">
          {u ? <>{shown.slice(0, u[0])}<u>{shown.slice(u[0], u[1])}</u>{shown.slice(u[1])}</> : shown}
        </pre>
        <span className="xl-hint">{view?.finished ? FM.evaluate.finished : u ? FM.evaluate.underlined : ''}</span>
      </div>
    </Dialog>
  );
}
