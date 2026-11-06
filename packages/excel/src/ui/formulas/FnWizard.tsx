// Inserer une fonction (Maj+F3) : recherche, categories (dont « Recemment utilisees »), puis arguments avec aide, valeur de chaque
// argument, selecteur de plage et resultat en direct.
import { useMemo, useRef, useState } from 'react';
import { Button, Dialog, TextField } from '@forgeoffice/ui';
import { functionCatalog, type FnInfo } from '../../logic/formula-ui.ts';
import { RECENT_FUNCTIONS_KEY, pushRecent, valueSummary } from '../../logic/formulas/names.ts';
import { FM, S } from '../../strings/index.ts';
import type { DialogEnv } from '../registry.ts';
import { PickButton, RangePickBar, selectionRef } from './RangePick.tsx';
import { useDialogFocus } from './focus.ts';
import './formulas.css';

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const MAX_ARGS = 30;

/** Rang d'une fonction pour une recherche : nom commencant par, nom contenant, description contenant ; -1 sinon. */
export function searchRank(f: FnInfo, query: string): number {
  const q = fold(query.trim());
  if (!q) return 0;
  const n = fold(f.name);
  if (n.startsWith(q)) return 0;
  if (n.includes(q)) return 1;
  return fold(f.description).includes(q) ? 2 : -1;
}

/** Nom affiche du i-eme argument (les arguments repetes « nombre2, nombre3... » prolongent le dernier). */
export function argName(args: readonly string[], i: number): string {
  const fixed = args.filter((a) => a !== '...');
  const raw = fixed[i] ?? fixed[fixed.length - 1] ?? `valeur${i + 1}`;
  const clean = raw.replace(/[[\]]/g, '');
  return i < fixed.length ? clean : `${clean.replace(/\d+$/, '')}${i + 1}`;
}

/** Formule composee : arguments vides de fin retires, ceux du milieu laisses vides. */
export function composeCall(name: string, values: readonly string[]): string {
  const last = values.reduce((m, v, i) => (v.trim() !== '' ? i : m), -1);
  return `=${name}(${values.slice(0, last + 1).map((v) => v.trim()).join(';')})`;
}

export function FnWizardDialog({ x, initial, onInsert }: { x: DialogEnv; initial?: string; onInsert: (formula: string) => void }) {
  const all = useMemo(() => functionCatalog(), []);
  const recent = x.services.settings.get<string[]>(RECENT_FUNCTIONS_KEY, []);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string>(recent.length ? 'recent' : 'all');
  const first = initial ? all.find((f) => f.name === initial.toUpperCase()) : undefined;
  const [fn, setFn] = useState<FnInfo | undefined>(first);
  const [step, setStep] = useState<'search' | 'args'>(first ? 'args' : 'search');
  const [highlight, setHighlight] = useState<string | undefined>(first?.canonical);
  const [args, setArgs] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [picking, setPicking] = useState<number | null>(null);
  const sheetName = x.sheet.name;
  /** Selection d'origine : la selection de plages pendant la saisie des arguments ne doit pas deplacer la cellule qui recevra la formule. */
  const origin = useRef(x.sel);
  const endPick = (): void => {
    x.setSel(origin.current);
    setPicking(null);
  };

  const list = useMemo(() => {
    if (query.trim()) {
      return all.map((f) => ({ f, r: searchRank(f, query) })).filter((k) => k.r >= 0).sort((a, b) => a.r - b.r || a.f.name.localeCompare(b.f.name, 'fr')).map((k) => k.f);
    }
    if (cat === 'recent') return recent.map((n) => all.find((f) => f.name === n)).filter((f): f is FnInfo => f !== undefined);
    return all.filter((f) => cat === 'all' || f.category === cat);
  }, [all, query, cat, recent.join('|')]);
  const shown = all.find((f) => f.canonical === highlight) ?? list[0];
  useDialogFocus([step, picking]);

  const open = (f: FnInfo | undefined): void => {
    if (!f) return;
    setFn(f);
    setArgs([]);
    setCurrent(0);
    setStep('args');
  };

  if (step === 'search' || !fn) {
    return (
      <Dialog open title={S.fnWizard} onClose={x.close} onConfirm={() => open(shown)} width={540}>
        <div className="xlf-fn">
          <TextField label={FM.fn.search} placeholder={FM.fn.searchHint} value={query} onChange={(e) => setQuery(e.target.value)} data-autofocus />
          <div className="xl-form">
            <label>{FM.fn.category}</label>
            <select value={cat} onChange={(e) => { setCat(e.target.value); setQuery(''); }} aria-label={FM.fn.category}>
              <option value="recent">{FM.fn.recent}</option>
              <option value="all">{FM.fn.all}</option>
              {Object.entries(S.categories).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <span>{FM.fn.pick}</span>
          <ul className="xl-list xl-list--tall" role="listbox" aria-label={FM.fn.pick}>
            {list.length === 0 && <li className="xlf-names__empty">{FM.fn.noMatch}</li>}
            {list.slice(0, 600).map((f) => (
              <li key={f.canonical} role="option" aria-selected={shown?.canonical === f.canonical}>
                <button type="button" className={shown?.canonical === f.canonical ? 'is-active' : ''} onClick={() => setHighlight(f.canonical)} onDoubleClick={() => open(f)}>{f.name}</button>
              </li>
            ))}
          </ul>
          <p className="xlf-fn__desc">
            {shown && <strong>{`${shown.name}(${shown.args.join('; ')})`}</strong>}
            {shown?.description}
          </p>
        </div>
      </Dialog>
    );
  }

  const fixed = fn.args.filter((a) => a !== '...');
  const variadic = fn.args.includes('...');
  const filled = args.reduce((m, v, i) => (v.trim() !== '' ? i : m), -1) + 1;
  const count = variadic ? Math.min(MAX_ARGS, Math.max(fixed.length, filled + 1)) : fixed.length;
  const values = Array.from({ length: count }, (_, i) => args[i] ?? '');
  const evalIn = (formula: string): string => {
    try {
      return valueSummary(x.store.engine.engine.evaluate(formula, sheetName, 'fr'));
    } catch {
      return ''; // saisie incomplete : pas de valeur a afficher
    }
  };
  const formula = composeCall(fn.name, values);
  const result = evalIn(formula).replace(/^"|"$/g, '');
  const insert = (): void => {
    x.services.settings.set(RECENT_FUNCTIONS_KEY, pushRecent(recent, fn.name));
    onInsert(formula);
    x.close();
  };
  if (picking !== null) {
    const at = picking;
    return <RangePickBar text={selectionRef(sheetName, x.sel, false)} onOk={() => { setArgs((a) => { const n = [...a]; n[at] = selectionRef(sheetName, x.sel, false); return n; }); endPick(); }} onCancel={endPick} />;
  }
  const opt = (i: number): boolean => fixed[i]?.startsWith('[') ?? i >= fixed.length;
  return (
    <Dialog open title={FM.fn.argsTitle} onClose={x.close} onConfirm={insert} width={580}
      actions={[{ label: FM.fn.ok, primary: true, onClick: insert }, { label: FM.fn.cancel, onClick: x.close }]}
      footerStart={<Button appearance="subtle" onClick={() => setStep('search')}>{FM.fn.back}</Button>}>
      <div className="xlf-fn">
        <h3 className="xl-fnname">{fn.name}</h3>
        <div className="xlf-fn__args">
          {values.map((v, i) => (
            <div key={`${argName(fn.args, i)}`} className="xl-contents">
              <label className={opt(i) ? '' : 'is-required'}>{argName(fn.args, i)}</label>
              <TextField value={v} aria-label={argName(fn.args, i)} onFocus={() => setCurrent(i)} data-autofocus={i === 0 ? true : undefined}
                onChange={(e) => setArgs((a) => { const n = [...a]; n[i] = e.target.value; return n; })} contentAfter={<PickButton onClick={() => setPicking(i)} />} />
              <span className="xlf-fn__val" title={v ? evalIn(`=${v}`) : ''}>{v.trim() ? `= ${evalIn(`=${v}`)}` : ''}</span>
            </div>
          ))}
        </div>
        <p className="xlf-fn__desc">
          <strong>{`${fn.name}(${fn.args.join('; ')})`}</strong>
          {fn.description}
          <br />
          <em>{`${FM.fn.argHelp} ${argName(fn.args, current)} : ${opt(current) ? FM.fn.optional : FM.fn.required}`}</em>
        </p>
        <p className="xlf-fn__result">{`${FM.fn.result} ${result}`}</p>
      </div>
    </Dialog>
  );
}
