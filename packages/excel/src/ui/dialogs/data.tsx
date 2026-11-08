// Dialogues de donnees : tri personnalise, doublons, conversion, sous-totaux, validation, regles de mise en forme
// conditionnelle (creation et gestion), creation d'un tableau croise dynamique.
import { useState } from 'react';
import { Button, Checkbox, Dialog, TextField } from '@forgeoffice/ui';
import { columnName, rangeName, type CfOperator, type CfRule, type DataValidation } from '@forgeoffice/xlsx';
import { fromLocalized, stripEquals, toLocalized } from '@forgeoffice/formulas';
import { guessHeader, removeDuplicates, sortRange, subtotals, type SortKey, type SubtotalFn } from '../../logic/data.ts';
import { rangeSelection } from '../../logic/selection.ts';
import { S } from '../../strings/index.ts';
import { readRange, type DlgEnv } from './basic.tsx';

function colLabel(x: DlgEnv, header: boolean, row: number, col: number): string {
  const v = header ? x.display(row, col) : '';
  return v || `${S.column(0).replace('0', '')} ${columnName(col)}`;
}

export function SortDialog({ x }: { x: DlgEnv }) {
  const range = x.cmd.dataRange();
  const [header, setHeader] = useState(guessHeader(range, x.value));
  const [keys, setKeys] = useState<SortKey[]>([{ index: x.sel.active.col, descending: false }]);
  const cols: number[] = [];
  for (let c = range.c1; c <= range.c2; c++) cols.push(c);
  const apply = (): void => {
    x.store.commit((d) => sortRange(d, x.si, range, keys, header, x.value));
    x.setSel(rangeSelection(range));
    x.close();
  };
  return (
    <Dialog open title={S.sort} onClose={x.close} onConfirm={apply} width={560} footerStart={<Checkbox checked={header} onChange={setHeader} label={S.hasHeaders} />}>
      <div className="xl-dlg-row">
        <Button icon="add" onClick={() => setKeys([...keys, { index: range.c1, descending: false }])}>{S.addLevel}</Button>
        <Button icon="delete" disabled={keys.length <= 1} onClick={() => setKeys(keys.slice(0, -1))}>{S.delLevel}</Button>
      </div>
      <table className="xl-dlg-table">
        <thead><tr><th /><th>{S.column(0).replace('0', '')}</th><th>{S.order}</th></tr></thead>
        <tbody>
          {keys.map((k, i) => (
            <tr key={i}>
              <td>{i === 0 ? S.sortBy : S.thenBy}</td>
              <td>
                <select value={k.index} onChange={(e) => setKeys(keys.map((q, j) => (j === i ? { ...q, index: Number(e.target.value) } : q)))}>
                  {cols.map((c) => <option key={c} value={c}>{colLabel(x, header, range.r1, c)}</option>)}
                </select>
              </td>
              <td>
                <select value={k.descending ? 'd' : 'a'} onChange={(e) => setKeys(keys.map((q, j) => (j === i ? { ...q, descending: e.target.value === 'd' } : q)))}>
                  <option value="a">{S.asc}</option>
                  <option value="d">{S.desc}</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}

export function RemoveDupDialog({ x }: { x: DlgEnv }) {
  const range = x.cmd.dataRange();
  const [header, setHeader] = useState(guessHeader(range, x.value));
  const cols: number[] = [];
  for (let c = range.c1; c <= range.c2; c++) cols.push(c);
  const [picked, setPicked] = useState<number[]>(cols);
  const apply = (): void => {
    let removed = 0;
    x.store.commit((d) => {
      removed = removeDuplicates(d, x.si, range, picked, header, x.value);
      return removed > 0;
    });
    const total = range.r2 - range.r1 + (header ? 0 : 1);
    x.notify(removed ? S.dupRemoved(removed, total - removed) : S.dupNone, 'info');
    x.close();
  };
  return (
    <Dialog open title={S.removeDup} onClose={x.close} onConfirm={apply} width={420}>
      <p>{S.removeDupHint}</p>
      <Checkbox checked={header} onChange={setHeader} label={S.hasHeaders} />
      <div className="xl-checklist">
        {cols.map((c) => (
          <Checkbox key={c} checked={picked.includes(c)} onChange={(v) => setPicked(v ? [...picked, c] : picked.filter((k) => k !== c))} label={colLabel(x, header, range.r1, c)} />
        ))}
      </div>
    </Dialog>
  );
}

export function SubtotalDialog({ x }: { x: DlgEnv }) {
  const range = x.cmd.dataRange();
  const cols: number[] = [];
  for (let c = range.c1; c <= range.c2; c++) cols.push(c);
  const [group, setGroup] = useState(range.c1);
  const [fn, setFn] = useState<SubtotalFn>('sum');
  const [sums, setSums] = useState<number[]>([range.c2]);
  const apply = (): void => {
    x.store.commit((d) => {
      const r = subtotals(d, x.si, range, group, sums, fn, x.value, { total: S.totalOf, grand: S.grandTotal });
      x.setSel(rangeSelection(r));
    });
    x.close();
  };
  const fnNames: Record<SubtotalFn, string> = { sum: S.pivot.fn.sum ?? '', count: S.pivot.fn.count ?? '', average: S.pivot.fn.average ?? '', max: S.pivot.fn.max ?? '', min: S.pivot.fn.min ?? '', product: S.pivot.fn.product ?? '' };
  return (
    <Dialog open title={S.subtotal} onClose={x.close} onConfirm={apply} width={420}>
      <div className="xl-form">
        <label>{S.atEachChange}</label>
        <select value={group} onChange={(e) => setGroup(Number(e.target.value))}>{cols.map((c) => <option key={c} value={c}>{colLabel(x, true, range.r1, c)}</option>)}</select>
        <label>{S.useFunction}</label>
        <select value={fn} onChange={(e) => setFn(e.target.value as SubtotalFn)}>{(Object.keys(fnNames) as SubtotalFn[]).map((k) => <option key={k} value={k}>{fnNames[k]}</option>)}</select>
      </div>
      <p>{S.addTo}</p>
      <div className="xl-checklist">
        {cols.map((c) => <Checkbox key={c} checked={sums.includes(c)} onChange={(v) => setSums(v ? [...sums, c] : sums.filter((k) => k !== c))} label={colLabel(x, true, range.r1, c)} />)}
      </div>
    </Dialog>
  );
}

export const loc = (f: string | undefined): string => (f ? toLocalized(`=${f}`, 'fr').slice(1) : '');
export const canon = (f: string): string => stripEquals(fromLocalized(f.startsWith('=') ? f : `=${f}`, 'fr'));

export function ValidationDialog({ x }: { x: DlgEnv }) {
  const V = S.validationDlg;
  const sh = x.store.wb.sheets[x.si];
  const a = x.sel.active;
  const existing = sh?.dataValidations.find((v) => v.ranges.some((r) => a.row >= r.r1 && a.row <= r.r2 && a.col >= r.c1 && a.col <= r.c2));
  const [tab, setTab] = useState<'settings' | 'input' | 'error'>('settings');
  const [type, setType] = useState<DataValidation['type']>(existing?.type ?? 'none');
  const [op, setOp] = useState<NonNullable<DataValidation['operator']>>(existing?.operator ?? 'between');
  const [f1, setF1] = useState(existing?.type === 'list' ? (existing.formula1 ?? '').replace(/^"|"$/g, '').replace(/,/g, ';') : loc(existing?.formula1));
  const [f2, setF2] = useState(loc(existing?.formula2));
  const [allowBlank, setAllowBlank] = useState(existing?.allowBlank !== false);
  const [dropdown, setDropdown] = useState(existing?.inCellDropdown !== false);
  const [showInput, setShowInput] = useState(existing ? existing.showInputMessage === true : false);
  const [promptTitle, setPromptTitle] = useState(existing?.promptTitle ?? '');
  const [prompt, setPrompt] = useState(existing?.prompt ?? '');
  const [showError, setShowError] = useState(existing ? existing.showErrorMessage !== false : true);
  const [errStyle, setErrStyle] = useState<NonNullable<DataValidation['errorStyle']>>(existing?.errorStyle ?? 'stop');
  const [errTitle, setErrTitle] = useState(existing?.errorTitle ?? '');
  const [err, setErr] = useState(existing?.error ?? '');
  const apply = (): void => {
    x.store.commit((d) => {
      const s = d.sheet(x.si);
      const rest = s.dataValidations.filter((v) => v !== existing);
      if (type === 'none') {
        s.dataValidations = rest;
        return;
      }
      const isRef = /^=?\$?[A-Za-z]{1,3}\$?\d+/.test(f1) || f1.startsWith('=');
      const v: DataValidation = {
        ranges: [...x.sel.ranges], type, allowBlank, showErrorMessage: showError, showInputMessage: showInput && !!(prompt || promptTitle), inCellDropdown: dropdown,
        formula1: type === 'list' ? (isRef ? canon(f1) : `"${f1.split(';').map((k) => k.trim()).join(',')}"`) : canon(f1),
        ...(type !== 'list' && type !== 'custom' ? { operator: op } : {}),
        ...(f2 && (op === 'between' || op === 'notBetween') ? { formula2: canon(f2) } : {}),
        ...(errStyle !== 'stop' ? { errorStyle: errStyle } : {}),
        ...(errTitle ? { errorTitle: errTitle } : {}),
        ...(err ? { error: err } : {}),
        ...(promptTitle ? { promptTitle } : {}),
        ...(prompt ? { prompt } : {}),
      };
      s.dataValidations = [...rest, v];
    });
    x.close();
  };
  const two = op === 'between' || op === 'notBetween';
  const typed = type !== 'none' && type !== 'list' && type !== 'custom';
  return (
    <Dialog open title={S.validation} onClose={x.close} onConfirm={apply} width={520}>
      <div className="xl-tabsbar">
        <button type="button" className={tab === 'settings' ? 'is-active' : ''} onClick={() => setTab('settings')}>{V.settings}</button>
        <button type="button" className={tab === 'input' ? 'is-active' : ''} onClick={() => setTab('input')}>{V.inputTab}</button>
        <button type="button" className={tab === 'error' ? 'is-active' : ''} onClick={() => setTab('error')}>{V.errorTab}</button>
      </div>
      {tab === 'settings' && (
        <div className="xl-form">
          <label>{S.allow}</label>
          <select value={type} onChange={(e) => setType(e.target.value as DataValidation['type'])} aria-label={S.allow}>{Object.entries(S.allowKinds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          {typed && <label>{S.operatorLabel}</label>}
          {typed && (
            <select value={op} onChange={(e) => setOp(e.target.value as NonNullable<DataValidation['operator']>)} aria-label={S.operatorLabel}>{Object.entries(S.ops).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          )}
          {type !== 'none' && <label>{type === 'list' ? S.sourceList : type === 'custom' ? S.formula : two ? S.minLabel : S.value}</label>}
          {type !== 'none' && <TextField value={f1} onChange={(e) => setF1(e.target.value)} aria-label={S.sourceList} placeholder={type === 'list' ? 'Oui;Non' : ''} />}
          {typed && two && <label>{S.maxLabel}</label>}
          {typed && two && <TextField value={f2} onChange={(e) => setF2(e.target.value)} aria-label={S.maxLabel} />}
          {type !== 'none' && <Checkbox checked={allowBlank} onChange={setAllowBlank} label={V.ignoreBlank} />}
          {type === 'list' && <Checkbox checked={dropdown} onChange={setDropdown} label={V.dropdown} />}
        </div>
      )}
      {tab === 'input' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <Checkbox checked={showInput} onChange={setShowInput} label={V.showInput} />
          <label>{V.title}</label>
          <TextField value={promptTitle} onChange={(e) => setPromptTitle(e.target.value)} aria-label={V.title} disabled={!showInput} />
          <label>{V.message}</label>
          <TextField value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label={S.inputMessage} disabled={!showInput} />
        </div>
      )}
      {tab === 'error' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <Checkbox checked={showError} onChange={setShowError} label={V.showError} />
          <label>{V.style}</label>
          <select value={errStyle} onChange={(e) => setErrStyle(e.target.value as NonNullable<DataValidation['errorStyle']>)} disabled={!showError} aria-label={V.style}>
            {Object.entries(V.styles).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <label>{V.title}</label>
          <TextField value={errTitle} onChange={(e) => setErrTitle(e.target.value)} aria-label={S.errorMessage + ' ' + V.title} disabled={!showError} />
          <label>{V.message}</label>
          <TextField value={err} onChange={(e) => setErr(e.target.value)} aria-label={S.errorMessage} disabled={!showError} />
        </div>
      )}
    </Dialog>
  );
}

export function PivotCreateDialog({ x, onCreate }: { x: DlgEnv; onCreate: (source: string, newSheet: boolean) => void }) {
  const [source, setSource] = useState(rangeName(x.cmd.dataRange(), true));
  const [newSheet, setNewSheet] = useState(true);
  const apply = (): void => {
    if (!readRange(source)) {
      x.notify(S.invalidRef, 'error');
      return;
    }
    onCreate(source, newSheet);
    x.close();
  };
  return (
    <Dialog open title={S.pivot.title} onClose={x.close} onConfirm={apply} width={460}>
      <div className="xl-form">
        <label>{S.pivot.source}</label>
        <TextField value={source} onChange={(e) => setSource(e.target.value)} aria-label={S.pivot.source} data-autofocus />
      </div>
      <label className="xl-radio"><input type="radio" checked={newSheet} onChange={() => setNewSheet(true)} />{S.pivot.destNew}</label>
      <label className="xl-radio"><input type="radio" checked={!newSheet} onChange={() => setNewSheet(false)} />{S.pivot.destExisting}</label>
    </Dialog>
  );
}
