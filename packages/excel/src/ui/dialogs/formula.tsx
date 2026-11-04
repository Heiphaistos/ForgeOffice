// Dialogues de formules : gestionnaire de noms, assistant Inserer une fonction, evaluation pas a pas,
// format de cellule (nombre, alignement, police, protection).
import { useMemo, useState } from 'react';
import { Button, Checkbox, Dialog, NumberField, TextField } from '@forgeoffice/ui';
import { FormulaError, formatValue, fromLocalized, stripEquals, toLocalized, type Value } from '@forgeoffice/formulas';
import { rangeName, type HorizontalAlignment, type VerticalAlignment } from '@forgeoffice/xlsx';
import { functionCatalog, type FnInfo } from '../../logic/formula-ui.ts';
import { activeRange } from '../../logic/selection.ts';
import { applyPatch, mergeCells, numFmtOf, styleAt } from '../../logic/styles.ts';
import { NUMBER_FORMATS } from '../../ribbon/home.tsx';
import { S, RB } from '../../strings.ts';
import type { DlgEnv } from './basic.tsx';

const NAME_RE = /^[A-Za-z_\\À-￿][\w.À-￿]*$/;

function show(v: Value | undefined): string {
  if (v === undefined || v === null) return '';
  if (v instanceof FormulaError) return toLocalized(`=${v.code}`, 'fr').slice(1);
  if (typeof v === 'object') return '{…}';
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
  if (typeof v === 'number') return formatValue(v, 'General', 'fr-FR');
  return `"${v}"`;
}

export function NamesDialog({ x }: { x: DlgEnv }) {
  const names = x.store.wb.definedNames.map((n, i) => ({ n, i })).filter((k) => !k.n.name.startsWith('_xlnm'));
  const [pick, setPick] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [ref, setRef] = useState(`=${x.store.wb.sheets[x.si]?.name ?? ''}!${rangeName(activeRange(x.sel), true)}`);
  const [scope, setScope] = useState<number | undefined>(undefined);
  const select = (i: number): void => {
    const n = x.store.wb.definedNames[i];
    if (!n) return;
    setPick(i);
    setName(n.name);
    setRef(toLocalized(`=${n.formula}`, 'fr'));
    setScope(n.localSheet);
  };
  const save = (): void => {
    if (!NAME_RE.test(name) || /^[A-Za-z]{1,3}\d+$/.test(name)) {
      x.notify(S.badName, 'error');
      return;
    }
    const formula = stripEquals(fromLocalized(ref.startsWith('=') ? ref : `=${ref}`, 'fr'));
    x.store.commit((d) => {
      const list = d.wb.definedNames.filter((_, i) => i !== pick && !(d.wb.definedNames[i]?.name.toLowerCase() === name.toLowerCase() && d.wb.definedNames[i]?.localSheet === scope));
      d.wb.definedNames = [...list, { name, formula, ...(scope !== undefined ? { localSheet: scope } : {}) }];
    });
    setPick(null);
    setName('');
  };
  const remove = (): void => {
    if (pick === null) return;
    x.store.commit((d) => {
      d.wb.definedNames = d.wb.definedNames.filter((_, i) => i !== pick);
    });
    setPick(null);
  };
  return (
    <Dialog open title={S.names} onClose={x.close} actions={[{ label: S.close, primary: true, onClick: x.close }]} width={620}>
      <table className="xl-dlg-table">
        <thead><tr><th>{S.name.replace(' :', '')}</th><th>{S.value}</th><th>{S.refersTo.replace(' :', '')}</th><th>{S.scope.replace(' :', '')}</th></tr></thead>
        <tbody>
          {names.map(({ n, i }) => {
            let v: Value | undefined;
            try {
              v = x.store.engine.engine.evaluate(n.formula, x.store.wb.sheets[x.si]?.name);
            } catch {
              v = undefined; // formule de nom invalide : valeur non affichee
            }
            return (
              <tr key={`${n.name}-${i}`} className={pick === i ? 'is-active' : ''} onClick={() => select(i)}>
                <td>{n.name}</td><td>{show(v)}</td><td>{toLocalized(`=${n.formula}`, 'fr')}</td><td>{n.localSheet === undefined ? S.workbook : x.store.wb.sheets[n.localSheet]?.name}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="xl-form">
        <label>{S.name}</label>
        <TextField value={name} onChange={(e) => setName(e.target.value)} aria-label={S.name} data-autofocus />
        <label>{S.scope}</label>
        <select value={scope ?? -1} onChange={(e) => setScope(Number(e.target.value) < 0 ? undefined : Number(e.target.value))}>
          <option value={-1}>{S.workbook}</option>
          {x.store.wb.sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
        </select>
        <label>{S.refersTo}</label>
        <TextField value={ref} onChange={(e) => setRef(e.target.value)} aria-label={S.refersTo} />
      </div>
      <div className="xl-dlg-row">
        <Button appearance="primary" icon={pick === null ? 'add' : 'edit'} onClick={save}>{pick === null ? S.add : S.edit2}</Button>
        <Button icon="delete" disabled={pick === null} onClick={remove}>{S.del}</Button>
      </div>
    </Dialog>
  );
}

export function FnWizardDialog({ x, initial, onInsert }: { x: DlgEnv; initial?: string; onInsert: (formula: string) => void }) {
  const all = useMemo(() => functionCatalog(), []);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [fn, setFn] = useState<FnInfo | undefined>(initial ? all.find((f) => f.name === initial.toUpperCase()) : undefined);
  const [args, setArgs] = useState<string[]>([]);
  const list = all.filter((f) => (cat === 'all' || f.category === cat) && (!query || f.name.includes(query.toUpperCase()) || f.description.toLowerCase().includes(query.toLowerCase())));
  if (!fn) {
    return (
      <Dialog open title={S.fnWizard} onClose={x.close} onConfirm={() => { const f = list[0]; if (f) { setFn(f); setArgs([]); } }} width={560}>
        <div className="xl-form">
          <label>{S.fnSearch}</label>
          <TextField value={query} onChange={(e) => setQuery(e.target.value)} aria-label={S.fnSearch} data-autofocus />
          <label>{S.fnCategory}</label>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">{S.fnAll}</option>
            {Object.entries(S.categories).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <p>{S.fnSelect}</p>
        <ul className="xl-list xl-list--tall">
          {list.slice(0, 600).map((f) => <li key={f.canonical}><button type="button" onClick={() => { setFn(f); setArgs([]); }}>{f.name}</button></li>)}
        </ul>
      </Dialog>
    );
  }
  const params = fn.args.filter((a) => a !== '...');
  const formula = `=${fn.name}(${args.slice(0, Math.max(args.length, 0)).join(';').replace(/;+$/, '')})`;
  let result = '';
  try {
    result = show(x.store.engine.engine.evaluate(formula, x.store.wb.sheets[x.si]?.name, 'fr'));
  } catch {
    result = ''; // arguments incomplets : pas de resultat a afficher
  }
  return (
    <Dialog open title={S.fnArgs} onClose={x.close} onConfirm={() => { onInsert(formula); x.close(); }} width={560}>
      <h3 className="xl-fnname">{fn.name}</h3>
      <div className="xl-form">
        {params.map((p, i) => (
          <div key={p} className="xl-contents">
            <label>{p.replace(/[[\]]/g, '')}</label>
            <TextField value={args[i] ?? ''} onChange={(e) => { const next = [...args]; next[i] = e.target.value; setArgs(next); }} aria-label={p} data-autofocus={i === 0 ? true : undefined} />
          </div>
        ))}
      </div>
      <p className="xl-hint">{fn.description}</p>
      <p><strong>{S.fnResult}</strong> {result}</p>
      <Button appearance="subtle" onClick={() => setFn(undefined)}>{S.fnAll}…</Button>
    </Dialog>
  );
}

/** Evaluation pas a pas : remplace l'appel de fonction le plus interieur par sa valeur. */
export function evaluateStep(text: string, evaluate: (f: string) => string): string | null {
  const body = text.startsWith('=') ? text.slice(1) : text;
  let best: { s: number; e: number } | null = null;
  let inStr = false;
  const stack: number[] = [];
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === '(') stack.push(i);
    else if (ch === ')') {
      const open = stack.pop();
      if (open === undefined) continue;
      const m = body.slice(0, open).match(/[A-Za-zÀ-ÿ][\w.À-ÿ]*$/);
      const s = m ? open - (m[0]?.length ?? 0) : open;
      best = { s, e: i + 1 };
      break;
    }
  }
  if (!best) {
    const whole = evaluate(`=${body}`);
    return whole === body ? null : whole;
  }
  const part = body.slice(best.s, best.e);
  return `=${body.slice(0, best.s)}${evaluate(`=${part}`)}${body.slice(best.e)}`;
}

export function EvaluateDialog({ x }: { x: DlgEnv }) {
  const a = x.sel.active;
  const cell = x.store.wb.sheets[x.si]?.cells.get(a.row)?.get(a.col);
  const start = cell?.formula !== undefined ? toLocalized(`=${cell.formula}`, 'fr') : '';
  const [text, setText] = useState(start);
  const sheet = x.store.wb.sheets[x.si]?.name;
  const ev = (f: string): string => {
    try {
      const v = x.store.engine.engine.evaluate(f, sheet, 'fr');
      return show(v);
    } catch {
      return f.slice(1); // morceau non evaluable seul : conserve tel quel
    }
  };
  const done = !text.startsWith('=');
  return (
    <Dialog open title={S.evaluate} onClose={x.close} width={560} actions={[
      { label: done ? S.evaluateRestart : S.evaluateStep, primary: true, onClick: () => setText(done ? start : evaluateStep(text, ev) ?? text.slice(1)) },
      { label: S.close, onClick: x.close },
    ]}>
      <p>{S.reference} {rangeName({ r1: a.row, c1: a.col, r2: a.row, c2: a.col })}</p>
      <p>{S.evaluateEval}</p>
      <pre className="xl-eval">{text || '—'}</pre>
    </Dialog>
  );
}

export function FormatCellsDialog({ x, tab }: { x: DlgEnv; tab?: string }) {
  const sh = x.store.wb.sheets[x.si];
  const sid = sh ? styleAt(sh, x.sel.active.row, x.sel.active.col) : 0;
  const xf = x.store.wb.styles.cellXfs[sid];
  const [page, setPage] = useState(tab ?? 'number');
  const [code, setCode] = useState(numFmtOf(x.store.wb, sid));
  const [h, setH] = useState<HorizontalAlignment>(xf?.alignment?.horizontal ?? 'general');
  const [v, setV] = useState<VerticalAlignment>(xf?.alignment?.vertical ?? 'bottom');
  const [wrap, setWrap] = useState(!!xf?.alignment?.wrapText);
  const [indent, setIndent] = useState(xf?.alignment?.indent ?? 0);
  const [rot, setRot] = useState(xf?.alignment?.textRotation ?? 0);
  const [merge, setMerge] = useState(false);
  const font = x.cmd.activeFont();
  const [bold, setBold] = useState(!!font.bold);
  const [italic, setItalic] = useState(!!font.italic);
  const [size, setSize] = useState(font.size);
  const [locked, setLocked] = useState(xf?.protection?.locked !== false);
  const [hidden, setHidden] = useState(!!xf?.protection?.hidden);
  const sample = x.value(x.sel.active.row, x.sel.active.col);
  const apply = (): void => {
    x.store.commit((d) => {
      applyPatch(d, x.si, [...x.sel.ranges], {
        numberFormat: code,
        alignment: { horizontal: h, vertical: v, wrapText: wrap, indent, textRotation: rot },
        font: { bold, italic, size },
        protection: { locked, hidden },
      });
      if (merge) mergeCells(d, x.si, [...x.sel.ranges], 'merge');
    });
    x.close();
  };
  let preview = '';
  try {
    preview = formatValue(sample, code, 'fr-FR');
  } catch {
    preview = ''; // code de format en cours de saisie
  }
  return (
    <Dialog open title={S.formatCells} onClose={x.close} onConfirm={apply} width={600}>
      <div className="xl-tabsbar">
        {(['number', 'align', 'font', 'protection'] as const).map((k) => <button key={k} type="button" className={page === k ? 'is-active' : ''} onClick={() => setPage(k)}>{S.fcTabs[k]}</button>)}
      </div>
      {page === 'number' && (
        <div className="xl-dlg-cols">
          <ul className="xl-list xl-list--tall">
            {NUMBER_FORMATS.map((n) => <li key={n.id}><button type="button" className={code === n.code ? 'is-active' : ''} onClick={() => setCode(n.code)}>{RB.formats[n.id] ?? n.id}</button></li>)}
          </ul>
          <div className="xl-form xl-form--stack">
            <label>{S.fcSample}</label>
            <div className="xl-sample">{preview}</div>
            <label>{S.fcCode}</label>
            <TextField value={code} onChange={(e) => setCode(e.target.value)} aria-label={S.fcCode} />
          </div>
        </div>
      )}
      {page === 'align' && (
        <div className="xl-form">
          <label>{S.fcHorizontal}</label>
          <select value={h} onChange={(e) => setH(e.target.value as HorizontalAlignment)}>
            {(['general', 'left', 'center', 'right', 'fill', 'justify', 'centerContinuous', 'distributed'] as const).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <label>{S.fcVertical}</label>
          <select value={v} onChange={(e) => setV(e.target.value as VerticalAlignment)}>
            {(['top', 'center', 'bottom', 'justify', 'distributed'] as const).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <label>{S.fcIndent}</label>
          <NumberField value={indent} min={0} max={15} width={80} onChange={setIndent} label={S.fcIndent} />
          <label>{S.fcRotation}</label>
          <NumberField value={rot} min={0} max={180} width={80} onChange={setRot} label={S.fcRotation} />
          <span />
          <Checkbox checked={wrap} onChange={setWrap} label={S.fcWrap} />
          <span />
          <Checkbox checked={merge} onChange={setMerge} label={S.fcMerge} />
        </div>
      )}
      {page === 'font' && (
        <div className="xl-form">
          <label>{RB.size}</label>
          <NumberField value={size} min={1} max={409} step={0.5} unit="pt" width={96} onChange={setSize} label={RB.size} />
          <span />
          <Checkbox checked={bold} onChange={setBold} label={RB.bold} />
          <span />
          <Checkbox checked={italic} onChange={setItalic} label={RB.italic} />
        </div>
      )}
      {page === 'protection' && (
        <div className="xl-form">
          <span />
          <Checkbox checked={locked} onChange={setLocked} label={S.fcLocked} />
          <span />
          <Checkbox checked={hidden} onChange={setHidden} label={S.fcHidden} />
        </div>
      )}
    </Dialog>
  );
}
