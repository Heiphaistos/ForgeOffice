// Verification des erreurs : parcourt les cellules signalees par un triangle vert (une regle violee par cellule), propose les
// correctifs, l'evaluation pas a pas, « Ignorer l'erreur », l'edition dans la barre de formule et les regles actives.
import { useEffect, useState } from 'react';
import { Button, Checkbox, Dialog } from '@forgeoffice/ui';
import { rangeName } from '@forgeoffice/xlsx';
import { editText } from '../../logic/cells.ts';
import {
  ERROR_RULES, ERROR_RULES_KEY, fixesFor, findNextError, findPreviousError, ignoreKey, type Finding, type Fix, type ErrorRuleId,
} from '../../logic/formulas/errors.ts';
import { cellSelection } from '../../logic/selection.ts';
import { applyPatch } from '../../logic/styles.ts';
import { FM } from '../../strings/index.ts';
import type { DialogEnv, DialogHostApi } from '../registry.ts';
import { checkEnv, errorRules, ignoredErrors } from './error-state.ts';
import { useDialogFocus } from './focus.ts';
import './formulas.css';

export function ErrorCheckDialog({ x, host, options }: { x: DialogEnv; host: DialogHostApi; options: boolean }) {
  const settings = x.services.settings;
  const [rules, setRules] = useState(() => errorRules(settings));
  const ignored = ignoredErrors(x.store);
  const env = checkEnv(x.store, x.si, rules);
  const [mode, setMode] = useState<'check' | 'options'>(options ? 'options' : 'check');
  const a = x.sel.active;
  const [finding, setFinding] = useState<Finding | null>(() => (env ? findNextError(env, { row: a.row, col: a.col - 1 }, ignored) : null));
  const [pending, setPending] = useState<string | null>(null);
  useDialogFocus([finding, mode]);

  useEffect(() => {
    if (finding) x.setSel(cellSelection(finding.row, finding.col));
  }, [finding?.row, finding?.col]);
  // L'edition demarre apres le rendu qui suit le changement de cellule active (sinon la mauvaise cellule serait editee).
  useEffect(() => {
    if (pending === null) return;
    host.insertFormula(pending);
    x.close();
  }, [pending]);

  const cellText = finding ? rangeName({ r1: finding.row, c1: finding.col, r2: finding.row, c2: finding.col }) : '';
  const cell = finding ? x.sheet.cells.get(finding.row)?.get(finding.col) : undefined;
  const move = (dir: 1 | -1): void => {
    if (!env) return;
    const from = finding ?? { row: a.row, col: a.col };
    setFinding((dir === 1 ? findNextError : findPreviousError)(env, from, ignored));
  };
  const ignore = (): void => {
    if (!finding || !env) return;
    ignored.add(ignoreKey(x.sheet.name, finding));
    x.store.notify();
    setFinding(findNextError(env, finding, ignored));
  };
  const apply = (fix: Fix): void => {
    if (!finding) return;
    const { row, col } = finding;
    x.store.commit((d) => {
      const c = d.get(x.si, row, col);
      if (!c) return false;
      if (fix.kind === 'lock') applyPatch(d, x.si, [{ r1: row, c1: col, r2: row, c2: col }], { protection: { locked: true } });
      else if (fix.number !== undefined) d.set(x.si, row, col, { ...c, value: fix.number });
      else if (fix.formula !== undefined) d.set(x.si, row, col, { ...c, formula: fix.formula });
      return true;
    });
    const next = checkEnv(x.store, x.si, rules);
    setFinding(next ? findNextError(next, { row, col: col - 1 }, ignored) : null);
  };
  const saveRules = (): void => {
    settings.set(ERROR_RULES_KEY, rules);
    x.store.notify();
    setMode('check');
    if (env) setFinding(findNextError(checkEnv(x.store, x.si, rules) ?? env, { row: a.row, col: a.col - 1 }, ignored));
  };

  if (mode === 'options') {
    return (
      <Dialog open title={FM.errors.optionsTitle} onClose={() => (options ? x.close() : setMode('check'))} onConfirm={saveRules} width={480}
        footerStart={<Button appearance="subtle" onClick={() => { ignored.clear(); x.store.notify(); x.notify(FM.errors.ignoredReset, 'info'); }}>{FM.errors.resetIgnored}</Button>}>
        <div className="xlf-rules">
          {ERROR_RULES.map((id: ErrorRuleId) => <Checkbox key={id} checked={rules[id]} onChange={(v) => setRules({ ...rules, [id]: v })} label={FM.errors.rules[id] ?? id} />)}
        </div>
      </Dialog>
    );
  }
  const fixes = finding && env ? fixesFor(env, finding) : [];
  return (
    <Dialog open title={FM.errors.title} onClose={x.close} width={560} actions={[
      { label: FM.errors.previous, disabled: !finding, onClick: () => move(-1) },
      { label: FM.errors.next, primary: true, disabled: !finding, onClick: () => move(1) },
      { label: FM.errors.options, onClick: () => setMode('options') },
      { label: FM.errors.close, onClick: x.close },
    ]}>
      {finding ? (
        <div className="xlf-check">
          <p className="xlf-check__title">{FM.errors.inCell(cellText)}</p>
          <p>{FM.errors.rules[finding.rule]}</p>
          <p className="xl-hint">{finding.rule === 'formulaError' && finding.detail ? FM.errors.detail[finding.detail] ?? FM.errors.help.formulaError : FM.errors.help[finding.rule]}</p>
          <pre className="xlf-check__formula">{editText(x.store.wb, cell)}</pre>
          <div className="xlf-check__actions">
            {fixes.map((f) => <Button key={f.kind} onClick={() => apply(f)}>{FM.errors.fix[f.kind]}</Button>)}
            {cell?.formula !== undefined && <Button onClick={() => x.open({ kind: 'evaluate' })}>{FM.errors.showSteps}</Button>}
            <Button onClick={ignore}>{FM.errors.ignore}</Button>
            <Button onClick={() => setPending(editText(x.store.wb, cell))}>{FM.errors.editBar}</Button>
          </div>
        </div>
      ) : <p>{FM.errors.noneFound}</p>}
    </Dialog>
  );
}
