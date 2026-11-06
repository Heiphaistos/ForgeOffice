// Services du clavier qui dependent de l'ecran (position de la cellule active, menus, liste deroulante) : fabrique appelee par App
// a chaque touche de la grille, avec l'etat courant. Le reste de l'API des raccourcis (keys-types.ts) vient directement de App.
import type { RefObject } from 'react';
import type { MenuItem } from '@forgeoffice/ui';
import type { NoticeKind } from '@forgeoffice/core';
import type { Scalar } from '@forgeoffice/formulas';
import type { CellRange, Sheet, Workbook } from '@forgeoffice/xlsx';
import { buildChart } from '../logic/charts.ts';
import { commitEntry, editText, parseEntry } from '../logic/cells.ts';
import { rangeValues } from '../logic/engine.ts';
import { nextChartSheetName, pickListValues } from '../logic/keys-logic.ts';
import { activeRange, type Selection } from '../logic/selection.ts';
import { addSheetAt } from '../logic/structure.ts';
import { listItems, validationAt } from '../logic/validation.ts';
import { layout, rangeRect, type Viewport } from '../logic/viewport.ts';
import { S } from '../strings/index.ts';
import type { GridKeyApi } from './keys-types.ts';
import type { DocStore } from './store.ts';

export interface KeyHostDeps {
  gridEl: RefObject<HTMLDivElement | null>;
  viewport: RefObject<Viewport | null>;
  selection: Selection;
  sheet: Sheet;
  wb: Workbook;
  si: number;
  store: DocStore;
  filterButtons: readonly { row: number; col: number }[];
  openFilter: (row: number, col: number, at: { x: number; y: number }) => void;
  openMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[]) => void;
  openCellMenu: (at: { x: number; y: number }) => void;
  display: (row: number, col: number) => string;
  valueText: (row: number, col: number) => string;
  notify: (message: string, kind?: NoticeKind) => void;
  value: (row: number, col: number) => Scalar;
  dataRange: () => CellRange;
  setSi: (i: number) => void;
}

type HostApi = Pick<GridKeyApi, 'pageRows' | 'pageCols' | 'reveal' | 'dropDown' | 'contextMenu' | 'cellText' | 'chartSheet'>;

/**
 * Un menu ouvert au clavier doit recevoir le focus (fleches, Entree, Echap) : le menu est d'abord rendu invisible le temps de se placer,
 * ce qui empeche son propre focus a l'ouverture ; on le refait quand il est visible.
 */
function focusOpenMenu(): void {
  const attempt = (n: number): void => {
    const menu = document.querySelector<HTMLElement>('.fo-menu');
    if (menu && menu.style.visibility !== 'hidden') menu.focus({ preventScroll: true });
    else if (n > 0) requestAnimationFrame(() => attempt(n - 1));
  };
  requestAnimationFrame(() => attempt(10));
}

export function makeKeyHost(d: KeyHostDeps): HostApi {
  /** Coin bas-gauche de la cellule active, en coordonnees ecran (null si la grille n'est pas affichee). */
  const anchor = (): { x: number; y: number } | null => {
    const v = d.viewport.current;
    const el = d.gridEl.current;
    if (!v || !el) return null;
    const box = el.getBoundingClientRect();
    const a = d.selection.active;
    const r = rangeRect(v, { r1: a.row, c1: a.col, r2: a.row, c2: a.col });
    return { x: box.left + r.x, y: box.top + r.y + r.h };
  };
  return {
    pageRows: Math.max(1, Math.floor(((d.viewport.current?.height ?? 600) - 20) / 20)),
    pageCols: d.viewport.current ? Math.max(1, layout(d.viewport.current).cols.length - 1) : 8,
    reveal: () => void d.gridEl.current?.dispatchEvent(new CustomEvent('xl:reveal')),
    contextMenu: () => {
      const at = anchor();
      if (!at) return;
      d.openCellMenu(at);
      focusOpenMenu();
    },
    // F11 : graphique sur une feuille a part (le modele n'a pas de feuille de graphique : feuille « Graph1 » dont le graphique remplit l'ecran).
    chartSheet: () => {
      const r0 = activeRange(d.selection);
      const r = r0.r1 === r0.r2 && r0.c1 === r0.c2 ? d.dataRange() : r0;
      let hasNumber = false;
      for (let row = r.r1; row <= Math.min(r.r2, r.r1 + 200) && !hasNumber; row++) for (let col = r.c1; col <= r.c2; col++) if (typeof d.value(row, col) === 'number') hasNumber = true;
      if (!hasNumber) {
        d.notify(S.chart.noData, 'warning');
        return;
      }
      const model = buildChart('col', d.sheet.name, r, d.value, S.chart.title);
      let index = 0;
      d.store.commit((dr) => {
        index = addSheetAt(dr, d.si + 1, nextChartSheetName(dr.wb.sheets.map((x) => x.name)));
        const sh = dr.sheet(index);
        sh.drawings = [{ kind: 'chart', name: 'Graphique 1', anchor: { type: 'twoCell', from: { col: 0, colOffset: 0, row: 0, rowOffset: 0 }, to: { col: 14, colOffset: 0, row: 28, rowOffset: 0 } }, chart: model }];
      });
      d.setSi(index);
    },
    cellText: (row, col, what) => (what === 'formula' ? editText(d.wb, d.sheet.cells.get(row)?.get(col)) : what === 'display' ? d.display(row, col) : d.valueText(row, col)),
    dropDown: () => {
      const at = anchor();
      if (!at) return;
      const a = d.selection.active;
      if (d.filterButtons.some((b) => b.row === a.row && b.col === a.col)) {
        d.openFilter(a.row, a.col, at);
        return;
      }
      const dv = validationAt(d.sheet, a.row, a.col);
      const items = dv?.type === 'list' && dv.inCellDropdown !== false
        ? listItems(dv, (f) => rangeValues(d.store.engine, f, d.sheet.name).flat())
        : pickListValues(d.sheet, a.row, a.col, d.display);
      if (!items.length) {
        d.notify(S.keys.noDropList, 'info');
        return;
      }
      d.openMenu({ clientX: at.x, clientY: at.y }, items.map((it) => ({
        id: it, label: it,
        onClick: () => {
          const entry = parseEntry(it, d.wb.date1904);
          if (entry.ok) d.store.commit((dr) => commitEntry(dr, d.si, a.row, a.col, entry));
        },
      })));
      focusOpenMenu();
    },
  };
}
