// Fenetre Espion (Formules > Verification des formules) : cellules surveillees, avec leur valeur et leur formule, visibles
// pendant que l'on travaille sur d'autres feuilles. Un clic sur une ligne selectionne la cellule.
import { useSyncExternalStore } from 'react';
import { Button } from '@forgeoffice/ui';
import { toLocalized } from '@forgeoffice/formulas';
import { rangeName } from '@forgeoffice/xlsx';
import { valueSummary } from '../../logic/formulas/names.ts';
import { activeRange, type Selection } from '../../logic/selection.ts';
import { FM } from '../../strings/index.ts';
import { useDoc, type DocStore } from '../store.ts';
import './formulas.css';

export interface WatchItem {
  sheet: string;
  row: number;
  col: number;
}

interface WatchState {
  open: boolean;
  items: WatchItem[];
  picked: number | null;
}

const states = new WeakMap<DocStore, WatchState>();
const listeners = new Set<() => void>();
let version = 0;
const MAX_WATCHES = 200;

const stateOf = (store: DocStore): WatchState => {
  let s = states.get(store);
  if (!s) {
    s = { open: false, items: [], picked: null };
    states.set(store, s);
  }
  return s;
};

function change(store: DocStore, patch: Partial<WatchState>): void {
  states.set(store, { ...stateOf(store), ...patch });
  version++;
  for (const l of listeners) l();
}

const same = (a: WatchItem, b: WatchItem): boolean => a.sheet === b.sheet && a.row === b.row && a.col === b.col;

export const isWatchOpen = (store: DocStore): boolean => stateOf(store).open;
export const toggleWatch = (store: DocStore): void => change(store, { open: !stateOf(store).open });

/** Ajoute les cellules de la selection (200 au plus au total, sans doublon) ; renvoie le nombre ajoute. */
export function addWatches(store: DocStore, sheet: string, sel: Selection): number {
  const s = stateOf(store);
  const r = activeRange(sel);
  const items = [...s.items];
  let added = 0;
  for (let row = r.r1; row <= r.r2; row++) {
    for (let col = r.c1; col <= r.c2; col++) {
      const it = { sheet, row, col };
      if (items.length >= MAX_WATCHES) break;
      if (!items.some((k) => same(k, it))) {
        items.push(it);
        added++;
      }
    }
  }
  change(store, { items, open: true });
  return added;
}

export interface WatchHostProps {
  store: DocStore;
  sheet: string;
  selection: Selection;
  goTo: (sheet: string, row: number, col: number) => void;
  notify: (message: string) => void;
}

export function WatchHost({ store, sheet, selection, goTo, notify }: WatchHostProps) {
  useDoc(store);
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => version);
  const st = stateOf(store);
  if (!st.open) return null;
  const wb = store.wb;
  const nameOf = (it: WatchItem): string => {
    const index = wb.sheets.findIndex((s) => s.name === it.sheet);
    const target = `${it.sheet}!${rangeName({ r1: it.row, c1: it.col, r2: it.row, c2: it.col }, true)}`.replace(/'/g, '');
    return wb.definedNames.find((n) => (n.localSheet === undefined || n.localSheet === index) && n.formula.replace(/'/g, '') === target)?.name ?? '';
  };
  return (
    <section className="xlf-watch" aria-label={FM.watch.title}>
      <div className="xlf-watch__head">
        <strong>{FM.watch.title}</strong>
        <Button appearance="subtle" size="small" icon="dismiss" aria-label={FM.names.close} onClick={() => toggleWatch(store)} />
      </div>
      <div className="xlf-watch__bar">
        <Button icon="add" onClick={() => notify(FM.watch.added(addWatches(store, sheet, selection)))}>{FM.watch.add}</Button>
        <Button icon="delete" disabled={st.picked === null} onClick={() => change(store, { items: st.items.filter((_, i) => i !== st.picked), picked: null })}>{FM.watch.remove}</Button>
      </div>
      <div className="xlf-watch__body">
        {st.items.length === 0 ? <p className="xlf-watch__empty">{FM.watch.empty}</p> : (
          <table>
            <thead><tr>{(['sheet', 'name', 'cell', 'value', 'formula'] as const).map((k) => <th key={k}>{FM.watch.cols[k]}</th>)}</tr></thead>
            <tbody>
              {st.items.map((it, i) => {
                let value = '';
                try {
                  value = valueSummary(store.engine.value(it.sheet, it.row, it.col)).replace(/^"|"$/g, '');
                } catch {
                  value = ''; // feuille supprimee : la ligne reste, sans valeur
                }
                const f = wb.sheets.find((s) => s.name === it.sheet)?.cells.get(it.row)?.get(it.col)?.formula;
                return (
                  <tr key={`${it.sheet}!${it.row},${it.col}`} className={st.picked === i ? 'is-active' : ''} onClick={() => change(store, { picked: i })} onDoubleClick={() => goTo(it.sheet, it.row, it.col)} title={FM.watch.goTo}>
                    <td>{it.sheet}</td><td>{nameOf(it)}</td><td>{rangeName({ r1: it.row, c1: it.col, r2: it.row, c2: it.col })}</td><td>{value}</td><td>{f === undefined ? '' : toLocalized(`=${f}`, 'fr')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
