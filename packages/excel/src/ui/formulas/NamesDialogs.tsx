// Gestionnaire de noms (Ctrl+F3) et boite « Nouveau nom » / « Modifier le nom » : etendue, commentaire, selecteur de plage.
import { useRef, useState } from 'react';
import { Button, Dialog, TextField } from '@forgeoffice/ui';
import { fromLocalized, parseFormula, stripEquals, toLocalized } from '@forgeoffice/formulas';
import { renameNameInWorkbook } from '../../logic/formulas/ast.ts';
import { filterNameRows, nameError, nameRows, type NameFilter, type NameRow } from '../../logic/formulas/names.ts';
import { FM, S } from '../../strings/index.ts';
import type { DialogEnv } from '../registry.ts';
import { PickButton, RangePickBar, selectionRef } from './RangePick.tsx';
import { useDialogFocus } from './focus.ts';
import './formulas.css';

const FILTERS: NameFilter[] = ['all', 'sheet', 'workbook', 'errors', 'noErrors', 'names', 'tables'];

/** Formule d'un champ « Fait reference a » (francais, avec ou sans « = ») -> formule canonique, ou null si elle est illisible. */
function canonicalRefers(text: string): string | null {
  try {
    const f = stripEquals(fromLocalized(text.startsWith('=') ? text : `=${text}`, 'fr'));
    parseFormula(f);
    return f;
  } catch {
    return null; // formule invalide : la boite affiche un message
  }
}

export function NameEditDialog({ x, index, from }: { x: DialogEnv; index: number | null; from?: 'names' }) {
  const names = x.store.wb.definedNames;
  const current = index === null ? undefined : names[index];
  const [name, setName] = useState(current?.name ?? '');
  const [scope, setScope] = useState<number | undefined>(current?.localSheet);
  const [comment, setComment] = useState(current?.comment ?? '');
  const [refers, setRefers] = useState(current ? toLocalized(`=${current.formula}`, 'fr') : `=${selectionRef(x.sheet.name, x.sel)}`);
  const [picking, setPicking] = useState(false);
  const [touched, setTouched] = useState(false);
  const origin = useRef(x.sel);
  const endPick = (): void => {
    x.setSel(origin.current);
    setPicking(false);
  };
  const back = (): void => (from === 'names' ? x.open({ kind: 'names' }) : x.close());
  const nameProblem = nameError(name, names, scope, index);
  const formula = canonicalRefers(refers);
  const problem = touched && nameProblem ? FM.nameEdit.errors[nameProblem] : formula === null && touched ? FM.nameEdit.badFormula : '';
  const save = (): void => {
    setTouched(true);
    if (nameProblem || formula === null) return;
    x.store.commit((d) => {
      if (current && current.name !== name) renameNameInWorkbook(d.wb, current.name, name);
      const entry = { name, formula, ...(scope !== undefined ? { localSheet: scope } : {}), ...(comment.trim() ? { comment: comment.trim() } : {}), ...(current?.hidden ? { hidden: true } : {}) };
      d.wb.definedNames = index === null ? [...d.wb.definedNames, entry] : d.wb.definedNames.map((n, i) => (i === index ? entry : n));
    });
    x.notify(FM.names.saved(name), 'success');
    back();
  };
  if (picking) {
    return <RangePickBar text={selectionRef(x.sheet.name, x.sel)} onOk={() => { setRefers(`=${selectionRef(x.sheet.name, x.sel)}`); endPick(); }} onCancel={endPick} />;
  }
  return (
    <Dialog open title={index === null ? FM.nameEdit.titleNew : FM.nameEdit.titleEdit} onClose={back} onConfirm={save} width={460}>
      <div className="xl-form xlf-form">
        <label>{FM.nameEdit.name}</label>
        <TextField value={name} onChange={(e) => { setName(e.target.value); setTouched(true); }} aria-label={FM.nameEdit.name} data-autofocus />
        <label>{FM.nameEdit.scope}</label>
        <select value={scope ?? -1} disabled={index !== null} onChange={(e) => setScope(Number(e.target.value) < 0 ? undefined : Number(e.target.value))} aria-label={FM.nameEdit.scope}>
          <option value={-1}>{S.workbook}</option>
          {x.store.wb.sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
        </select>
        <label>{FM.nameEdit.comment}</label>
        <TextField value={comment} onChange={(e) => setComment(e.target.value)} aria-label={FM.nameEdit.comment} />
        <label>{FM.nameEdit.refersTo}</label>
        <TextField value={refers} onChange={(e) => setRefers(e.target.value)} aria-label={FM.nameEdit.refersTo} contentAfter={<PickButton onClick={() => setPicking(true)} />} />
      </div>
      <p className="xlf-error" role="alert">{problem}</p>
    </Dialog>
  );
}

const scopeLabel = (x: DialogEnv, r: NameRow): string => (r.scope === undefined ? S.workbook : x.store.wb.sheets[r.scope]?.name ?? '');
const rowKey = (r: NameRow): string => `${r.index}|${r.name}|${r.scope ?? ''}`;

export function NamesManagerDialog({ x }: { x: DialogEnv }) {
  const [filter, setFilter] = useState<NameFilter>('all');
  const [pick, setPick] = useState<string | null>(null);
  const [refers, setRefers] = useState<{ key: string; text: string } | null>(null);
  const all = nameRows(x.store.wb, (f, sheet) => x.store.engine.engine.evaluate(f, sheet));
  const rows = filterNameRows(all, filter, x.si);
  const sel = rows.find((r) => rowKey(r) === pick);
  useDialogFocus([pick, rows.length]);
  const edit = (r: NameRow | undefined): void => {
    if (r && !r.isTable) x.open({ kind: 'nameEdit', index: r.index, from: 'names' });
  };
  const remove = (): void => {
    if (!sel || sel.isTable) return;
    x.store.commit((d) => {
      d.wb.definedNames = d.wb.definedNames.filter((_, i) => i !== sel.index);
    });
    x.notify(FM.names.deleted(sel.name), 'info');
    setPick(null);
  };
  const apply = (): void => {
    const f = refers ? canonicalRefers(refers.text) : null;
    if (!sel || sel.isTable || f === null) {
      x.notify(FM.nameEdit.badFormula, 'error');
      return;
    }
    x.store.commit((d) => {
      d.wb.definedNames = d.wb.definedNames.map((n, i) => (i === sel.index ? { ...n, formula: f } : n));
    });
    setRefers(null);
  };
  const shownRefers = refers && refers.key === (sel ? rowKey(sel) : '') ? refers.text : sel?.refersTo ?? '';
  return (
    <Dialog open title={FM.names.title} onClose={x.close} width={760} actions={[{ label: FM.names.close, primary: true, onClick: x.close }]}>
      <div className="xlf-names">
        <div className="xlf-names__bar">
          <Button icon="add" onClick={() => x.open({ kind: 'nameEdit', index: null, from: 'names' })}>{FM.names.newBtn}</Button>
          <Button icon="edit" disabled={!sel || sel.isTable} onClick={() => edit(sel)}>{FM.names.edit}</Button>
          <Button icon="delete" disabled={!sel || sel.isTable} onClick={remove}>{FM.names.del}</Button>
          <select value={filter} onChange={(e) => setFilter(e.target.value as NameFilter)} aria-label={FM.names.filter}>
            {FILTERS.map((k) => <option key={k} value={k}>{k === 'all' ? FM.names.filter : FM.names.filters[k]}</option>)}
          </select>
        </div>
        <div className="xlf-names__scroll">
          {rows.length === 0 ? <p className="xlf-names__empty">{FM.names.empty}</p> : (
            <table className="xl-dlg-table">
              <thead><tr>{(['name', 'value', 'refersTo', 'scope', 'comment'] as const).map((k) => <th key={k}>{FM.names.cols[k]}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={rowKey(r)} className={`${rowKey(r) === pick ? 'is-active' : ''}${r.hasError ? ' is-error' : ''}`} onClick={() => setPick(rowKey(r))} onDoubleClick={() => edit(r)} title={r.isTable ? FM.names.tableName : undefined}>
                    <td>{r.name}</td><td>{r.value}</td><td>{r.refersTo}</td><td>{scopeLabel(x, r)}</td><td>{r.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="xl-form">
          <label>{FM.names.refersTo}</label>
          <TextField value={shownRefers} disabled={!sel || sel.isTable} onChange={(e) => sel && setRefers({ key: rowKey(sel), text: e.target.value })} aria-label={FM.names.refersTo}
            contentAfter={<Button appearance="subtle" size="small" disabled={!refers || !sel} onClick={apply}>{FM.names.apply}</Button>} />
        </div>
      </div>
    </Dialog>
  );
}
