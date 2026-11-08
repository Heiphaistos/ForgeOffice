// Menu du filtre automatique d'une colonne : calcule les valeurs distinctes, applique le tri ou le filtre.
import type { Scalar } from '@forgeoffice/formulas';
import { applyAutoFilter, distinctColors, distinctValues, sortRange } from '../logic/data.ts';
import { tableAt } from '../logic/tables.ts';
import type { DocStore } from './store.ts';
import { FilterMenu } from './Panes.tsx';

export interface FilterMenuState {
  row: number;
  col: number;
  x: number;
  y: number;
}

interface FilterHostProps {
  menu: FilterMenuState;
  store: DocStore;
  si: number;
  valueAt: (row: number, col: number) => Scalar;
  displayAt: (row: number, col: number) => string;
  onClose: () => void;
}

export function FilterHost({ menu, store, si, valueAt, displayAt, onClose }: FilterHostProps) {
  const sheet = store.wb.sheets[si];
  if (!sheet) return null;
  const t = tableAt(sheet, menu.row, menu.col);
  const af = t?.autoFilter ?? sheet.autoFilter;
  if (!af) return null;
  const ref = t ? { ...t.ref, r2: t.ref.r2 - t.totalsRowCount } : af.ref;
  const items = distinctValues(ref, menu.col, valueAt, displayAt);
  const colId = menu.col - ref.c1;
  const colors = distinctColors(store.wb, si, ref, menu.col, true, 'fill');
  return (
    <FilterMenu
      anchor={{ x: menu.x, y: menu.y }}
      column={displayAt(ref.r1, menu.col)}
      items={items}
      numeric={items.some((i) => typeof i.value === 'number')}
      colors={colors}
      onSortColor={(rgb) => {
        store.commit((d) => sortRange(d, si, ref, [{ index: menu.col, descending: false, byColor: { rgb, kind: 'fill' } }], true, valueAt));
        onClose();
      }}
      current={af.columns.find((k) => k.colId === colId)?.filter}
      onSort={(desc) => {
        store.commit((d) => sortRange(d, si, ref, [{ index: menu.col, descending: desc }], true, valueAt));
        onClose();
      }}
      onApply={(f) => {
        store.commit((d) => {
          const s = d.sheet(si);
          const columns = [...af.columns.filter((k) => k.colId !== colId), ...(f ? [{ colId, filter: f }] : [])];
          const next = { ...af, ref, columns };
          if (t) s.tables = s.tables.map((x) => (x === t ? { ...x, autoFilter: next } : x));
          else s.autoFilter = next;
          applyAutoFilter(d, si, next, valueAt, displayAt);
        });
        onClose();
      }}
      onClose={onClose}
    />
  );
}
