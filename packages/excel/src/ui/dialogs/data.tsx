// Dialogues de donnees : tri personnalise, doublons, conversion, sous-totaux, validation, regles de mise en forme
// conditionnelle (creation et gestion), creation d'un tableau croise dynamique.
import { useState } from 'react';
import { Button, Checkbox, Dialog, TextField } from '@forgeoffice/ui';
import { columnName, rangeName, sqrefName, type CfOperator, type DataValidation } from '@forgeoffice/xlsx';
import { fromLocalized, stripEquals, toLocalized } from '@forgeoffice/formulas';
import { guessHeader, removeDuplicates, sortRange, subtotals, textToColumns, type SortKey, type SubtotalFn } from '../../logic/data.ts';
import { rangeSelection } from '../../logic/selection.ts';
import { S } from '../../strings.ts';
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

export function TextToColsDialog({ x }: { x: DlgEnv }) {
  const [sep, setSep] = useState(';');
  const apply = (): void => {
    const r = x.sel.ranges[x.sel.ranges.length - 1];
    if (r) x.store.commit((d) => textToColumns(d, x.si, r, sep, x.value));
    x.close();
  };
  return (
    <Dialog open title={S.textToCols} onClose={x.close} onConfirm={apply} width={380}>
      <p>{S.separator}</p>
      {Object.entries(S.sepNames).map(([k, label]) => <label key={k} className="xl-radio"><input type="radio" checked={sep === k} onChange={() => setSep(k)} />{label}</label>)}
      <label className="xl-radio"><input type="radio" checked={!(sep in S.sepNames)} onChange={() => setSep('|')} />
        <input className="xl-mini" value={sep in S.sepNames ? '' : sep} maxLength={1} onChange={(e) => setSep(e.target.value || '|')} aria-label={S.separator} />
      </label>
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

const loc = (f: string | undefined): string => (f ? toLocalized(`=${f}`, 'fr').slice(1) : '');
const canon = (f: string): string => stripEquals(fromLocalized(f.startsWith('=') ? f : `=${f}`, 'fr'));

export function ValidationDialog({ x }: { x: DlgEnv }) {
  const sh = x.store.wb.sheets[x.si];
  const a = x.sel.active;
  const existing = sh?.dataValidations.find((v) => v.ranges.some((r) => a.row >= r.r1 && a.row <= r.r2 && a.col >= r.c1 && a.col <= r.c2));
  const [type, setType] = useState<DataValidation['type']>(existing?.type ?? 'none');
  const [op, setOp] = useState<NonNullable<DataValidation['operator']>>(existing?.operator ?? 'between');
  const [f1, setF1] = useState(existing?.type === 'list' ? (existing.formula1 ?? '').replace(/^"|"$/g, '').replace(/,/g, ';') : loc(existing?.formula1));
  const [f2, setF2] = useState(loc(existing?.formula2));
  const [err, setErr] = useState(existing?.error ?? '');
  const [prompt, setPrompt] = useState(existing?.prompt ?? '');
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
        ranges: [...x.sel.ranges], type, allowBlank: true, showErrorMessage: true, showInputMessage: !!prompt, inCellDropdown: true,
        formula1: type === 'list' ? (isRef ? canon(f1) : `"${f1.split(';').map((k) => k.trim()).join(',')}"`) : canon(f1),
        ...(type !== 'list' && type !== 'custom' ? { operator: op } : {}),
        ...(f2 && (op === 'between' || op === 'notBetween') ? { formula2: canon(f2) } : {}),
        ...(err ? { error: err } : {}),
        ...(prompt ? { prompt } : {}),
      };
      s.dataValidations = [...rest, v];
    });
    x.close();
  };
  const two = op === 'between' || op === 'notBetween';
  return (
    <Dialog open title={S.validation} onClose={x.close} onConfirm={apply} width={480}>
      <div className="xl-form">
        <label>{S.allow}</label>
        <select value={type} onChange={(e) => setType(e.target.value as DataValidation['type'])}>{Object.entries(S.allowKinds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {type !== 'none' && type !== 'list' && type !== 'custom' && <label>{S.operatorLabel}</label>}
        {type !== 'none' && type !== 'list' && type !== 'custom' && (
          <select value={op} onChange={(e) => setOp(e.target.value as NonNullable<DataValidation['operator']>)}>{Object.entries(S.ops).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        )}
        {type !== 'none' && <label>{type === 'list' ? S.sourceList : type === 'custom' ? S.formula : two ? S.minLabel : S.value}</label>}
        {type !== 'none' && <TextField value={f1} onChange={(e) => setF1(e.target.value)} aria-label={S.sourceList} placeholder={type === 'list' ? 'Oui;Non' : ''} />}
        {type !== 'none' && type !== 'list' && type !== 'custom' && two && <label>{S.maxLabel}</label>}
        {type !== 'none' && type !== 'list' && type !== 'custom' && two && <TextField value={f2} onChange={(e) => setF2(e.target.value)} aria-label={S.maxLabel} />}
        <label>{S.inputMessage}</label>
        <TextField value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label={S.inputMessage} />
        <label>{S.errorMessage}</label>
        <TextField value={err} onChange={(e) => setErr(e.target.value)} aria-label={S.errorMessage} />
      </div>
    </Dialog>
  );
}

const CF_STYLES: Record<string, { font: string; fill: string }> = {
  red: { font: 'FF9C0006', fill: 'FFFFC7CE' }, yellow: { font: 'FF9C5700', fill: 'FFFFEB9C' }, green: { font: 'FF006100', fill: 'FFC6EFCE' },
  redFill: { font: '', fill: 'FFFFC7CE' }, redText: { font: 'FF9C0006', fill: '' },
};

export function CfRuleDialog({ x, preset }: { x: DlgEnv; preset?: string }) {
  const [kind, setKind] = useState<'value' | 'text' | 'formula'>(preset === 'containsText' ? 'text' : preset ? 'value' : 'value');
  const [op, setOp] = useState<CfOperator>((preset && preset !== 'containsText' ? preset : 'greaterThan') as CfOperator);
  const [v1, setV1] = useState('');
  const [v2, setV2] = useState('');
  const [style, setStyle] = useState('red');
  const apply = (): void => {
    const st = CF_STYLES[style] ?? CF_STYLES.red;
    const dxf = { ...(st?.font ? { font: { color: { rgb: st.font } } } : {}), ...(st?.fill ? { fill: { type: 'pattern' as const, pattern: 'solid' as const, bg: { rgb: st.fill } } } : {}) };
    const val = (t: string): string => (Number.isFinite(Number(t.replace(',', '.'))) && t.trim() !== '' ? t.replace(',', '.') : t.startsWith('=') ? canon(t) : `"${t.replace(/"/g, '""')}"`);
    if (kind === 'text') x.cmd.addCf({ type: 'containsText', operator: 'containsText', text: v1 }, dxf);
    else if (kind === 'formula') x.cmd.addCf({ type: 'expression', formulas: [canon(v1)] }, dxf);
    else x.cmd.addCf({ type: 'cellIs', operator: op, formulas: op === 'between' || op === 'notBetween' ? [val(v1), val(v2)] : [val(v1)] }, dxf);
    x.close();
  };
  return (
    <Dialog open title={S.cf} onClose={x.close} onConfirm={apply} width={520}>
      <div className="xl-tabsbar">
        <button type="button" className={kind === 'value' ? 'is-active' : ''} onClick={() => setKind('value')}>{S.cfValue}</button>
        <button type="button" className={kind === 'text' ? 'is-active' : ''} onClick={() => setKind('text')}>{S.cfText}</button>
        <button type="button" className={kind === 'formula' ? 'is-active' : ''} onClick={() => setKind('formula')}>{S.formula}</button>
      </div>
      <div className="xl-dlg-row">
        {kind === 'value' && (
          <select value={op} onChange={(e) => setOp(e.target.value as CfOperator)}>{Object.entries(S.ops).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        )}
        <TextField value={v1} onChange={(e) => setV1(e.target.value)} aria-label={S.value} placeholder={kind === 'formula' ? '=$A1>100' : ''} data-autofocus />
        {kind === 'value' && (op === 'between' || op === 'notBetween') && <TextField value={v2} onChange={(e) => setV2(e.target.value)} aria-label={S.value} />}
      </div>
      <div className="xl-form">
        <label>{S.cfFormatWith}</label>
        <select value={style} onChange={(e) => setStyle(e.target.value)}>{Object.entries(S.cfPresets).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
    </Dialog>
  );
}

export function CfManageDialog({ x }: { x: DlgEnv }) {
  const sh = x.store.wb.sheets[x.si];
  const rules = (sh?.conditionalFormats ?? []).flatMap((cf, i) => cf.rules.map((r, j) => ({ cf, i, r, j })));
  const remove = (i: number, j: number): void => {
    x.store.commit((d) => {
      const s = d.sheet(x.si);
      s.conditionalFormats = s.conditionalFormats.flatMap((cf, k) => {
        if (k !== i) return [cf];
        const rest = cf.rules.filter((_, m) => m !== j);
        return rest.length ? [{ ...cf, rules: rest }] : [];
      });
    });
  };
  return (
    <Dialog open title={S.cfManage} onClose={x.close} actions={[{ label: S.close, primary: true, onClick: x.close }]} width={600}>
      {rules.length === 0 ? <p>{S.cfNone}</p> : (
        <table className="xl-dlg-table">
          <thead><tr><th>{S.cfRule}</th><th>{S.cfApplies}</th><th /></tr></thead>
          <tbody>
            {rules.map(({ cf, i, r, j }) => (
              <tr key={`${i}-${j}`}>
                <td>{r.type}{r.operator ? ` (${S.ops[r.operator] ?? r.operator})` : ''}{r.formulas?.length ? ` ${r.formulas.map(loc).join(' ; ')}` : ''}</td>
                <td>{sqrefName(cf.ranges)}</td>
                <td><Button appearance="subtle" icon="delete" aria-label={S.del} onClick={() => remove(i, j)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
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
