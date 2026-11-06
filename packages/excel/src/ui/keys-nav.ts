// Raccourcis de navigation et de selection dans la grille (hors saisie) : fleches, Ctrl+fleches, Entree, Tab,
// Debut/Fin, pages, selection de lignes/colonnes/region, Atteindre.
import { usedRange } from '@forgeoffice/xlsx';
import { axisSize, colAxis, rowAxis } from '../logic/geometry.ts';
import { currentRegion } from '../logic/data.ts';
import {
  activeRange, cellSelection, cycleActive, extendBy, extendTo, jumpEdge, moveActive, rangeSelection, selectAll, selectCols, selectRows,
} from '../logic/selection.ts';
import { nextCorner, reduceToActive } from '../logic/keys-logic.ts';
import { registerShortcuts, type KeyLike, type ShortcutDef } from './registry.ts';
import type { GridKeyApi } from './keys-types.ts';

const filled = (k: GridKeyApi, r: number, c: number): boolean => {
  const cell = k.sheet.cells.get(r)?.get(c);
  return !!cell && (cell.value !== null || cell.formula !== undefined);
};
/** Derniere ligne/colonne utilisee (limite de Ctrl+Fin et des sauts Ctrl+fleche). */
const limitOf = (k: GridKeyApi): { row: number; col: number } => {
  const used = usedRange(k.sheet);
  return { row: used?.r2 ?? 0, col: used?.c2 ?? 0 };
};

/** Ctrl+A / Ctrl+Maj+Espace : region courante, puis la feuille entiere (ou directement la feuille hors des donnees). */
const selectRegionThenSheet = (k: GridKeyApi): void => {
  const { sel, sheet } = k;
  const r = activeRange(sel);
  const region = currentRegion(sheet, sel.active.row, sel.active.col);
  const same = region.r1 === r.r1 && region.r2 === r.r2 && region.c1 === r.c1 && region.c2 === r.c2;
  k.setSel(same || (region.r1 === region.r2 && region.c1 === region.c2 && !filled(k, region.r1, region.c1)) ? selectAll() : rangeSelection(region, sel.active));
};

const DIRS = [['ArrowUp', -1, 0], ['ArrowDown', 1, 0], ['ArrowLeft', 0, -1], ['ArrowRight', 0, 1]] as const;

const arrows = DIRS.flatMap(([key, dr, dc]): ShortcutDef<'grid'>[] => [
  {
    id: `nav.jump.${key}`, context: 'grid', combo: `Ctrl+~Shift+~Alt+${key}`,
    run: (k, e: KeyLike) => {
      const { sel, sheet } = k;
      const r = activeRange(sel);
      const from = e.shiftKey ? { row: sel.anchor.row === r.r1 ? r.r2 : r.r1, col: sel.anchor.col === r.c1 ? r.c2 : r.c1 } : sel.active;
      const to = jumpEdge(from, dr, dc, (row, col) => filled(k, row, col), limitOf(k));
      k.setSel(e.shiftKey ? extendTo(sel, to.row, to.col, sheet.merges) : cellSelection(to.row, to.col));
    },
  },
  {
    id: `nav.move.${key}`, context: 'grid', combo: `~Shift+~Alt+${key}`,
    run: (k, e: KeyLike) => {
      const rows = rowAxis(k.sheet);
      const cols = colAxis(k.sheet);
      k.setSel(e.shiftKey ? extendBy(k.sel, dr, dc) : moveActive(k.sel, dr, dc, (r, c) => axisSize(rows, r) === 0 || axisSize(cols, c) === 0));
    },
  },
]);

const pages = ([['PageDown', 1], ['PageUp', -1]] as const).flatMap(([key, d]): ShortcutDef<'grid'>[] => [
  // Ctrl+Page : feuille suivante/precedente (Ctrl+Maj+Page, qui groupe les feuilles dans Excel, n'est pas pris).
  { id: `nav.sheet.${key}`, context: 'grid', combo: `Ctrl+${key}`, run: (k) => k.switchSheet(d) },
  { id: `nav.page.${key}`, context: 'grid', combo: `~Shift+${key}`, run: (k, e) => k.setSel(e.shiftKey ? extendBy(k.sel, d * k.pageRows, 0) : moveActive(k.sel, d * k.pageRows, 0)) },
  // Alt+Page : un ecran vers la droite / la gauche.
  { id: `nav.screen.${key}`, context: 'grid', combo: `Alt+${key}`, run: (k) => k.setSel(moveActive(k.sel, 0, d * k.pageCols)) },
]);

registerShortcuts<'grid'>([
  ...arrows,
  { id: 'nav.enter', context: 'grid', combo: '~Ctrl+~Alt+Enter', run: (k) => k.setSel(cycleActive(k.sel, 1, 0)) },
  { id: 'nav.enterUp', context: 'grid', combo: 'Shift+~Ctrl+~Alt+Enter', run: (k) => k.setSel(cycleActive(k.sel, -1, 0)) },
  { id: 'nav.tab', context: 'grid', combo: '~Ctrl+~Alt+Tab', run: (k) => k.setSel(cycleActive(k.sel, 0, 1)) },
  { id: 'nav.tabBack', context: 'grid', combo: 'Shift+~Ctrl+~Alt+Tab', run: (k) => k.setSel(cycleActive(k.sel, 0, -1)) },
  { id: 'nav.home', context: 'grid', combo: '~Alt+Home', run: (k) => k.setSel(cellSelection(k.sel.active.row, 0)) },
  { id: 'nav.homeExtend', context: 'grid', combo: 'Shift+~Alt+Home', run: (k) => k.setSel(extendTo(k.sel, k.sel.active.row, 0)) },
  { id: 'nav.homeTop', context: 'grid', combo: 'Ctrl+~Alt+Home', run: (k) => k.setSel(cellSelection(0, 0)) },
  { id: 'nav.homeTopExtend', context: 'grid', combo: 'Ctrl+Shift+~Alt+Home', run: (k) => k.setSel(extendTo(k.sel, 0, 0, k.sheet.merges)) },
  {
    id: 'nav.end', context: 'grid', combo: 'Ctrl+~Shift+~Alt+End',
    run: (k, e) => {
      const limit = limitOf(k);
      k.setSel(e.shiftKey ? extendTo(k.sel, limit.row, limit.col) : cellSelection(limit.row, limit.col));
    },
  },
  ...pages,
  { id: 'nav.selectCols', context: 'grid', combo: 'Ctrl+~Alt+Space', run: (k) => k.setSel(selectCols(k.sel.active.col, activeRange(k.sel).c2)) },
  { id: 'nav.selectRows', context: 'grid', combo: 'Shift+~Alt+Space', run: (k) => k.setSel(selectRows(k.sel.active.row, activeRange(k.sel).r2)) },
  {
    id: 'nav.selectAll', context: 'grid', combo: 'Ctrl+~Shift+~Alt+a',
    run: selectRegionThenSheet,
  },
  { id: 'nav.selectSheet', context: 'grid', combo: 'Ctrl+Shift+~Alt+Space', run: selectRegionThenSheet },
  { id: 'nav.region', context: 'grid', combo: 'Ctrl+~Shift+~Alt+*', run: (k) => k.setSel(rangeSelection(currentRegion(k.sheet, k.sel.active.row, k.sel.active.col), k.sel.active)) },
  { id: 'nav.goto', context: 'grid', combo: 'F5', run: (k) => k.open({ kind: 'goto' }) },
  { id: 'nav.gotoCtrlT', context: 'grid', combo: 'Ctrl+~Alt+t', run: (k) => k.open({ kind: 'goto' }) },
  // Ctrl+Retour arriere : afficher la cellule active ; Maj+Retour arriere : reduire la selection a la cellule active.
  { id: 'nav.reveal', context: 'grid', combo: 'Ctrl+~Alt+Backspace', priority: 10, run: (k) => k.reveal() },
  { id: 'nav.collapse', context: 'grid', combo: 'Shift+~Alt+Backspace', priority: 10, run: (k) => k.setSel(reduceToActive(k.sel)) },
  // Ctrl+Point : coin suivant de la selection.
  { id: 'nav.corner', context: 'grid', combo: 'Ctrl+~Shift+~Alt+.', run: (k) => k.setSel(nextCorner(k.sel)) },
]);
