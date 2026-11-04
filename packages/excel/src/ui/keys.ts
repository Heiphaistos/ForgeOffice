// Raccourcis clavier de la grille (hors edition), conformes a Excel en francais.
import type { KeyboardEvent } from 'react';
import { usedRange, type Sheet } from '@forgeoffice/xlsx';
import { axisSize, colAxis, rowAxis } from '../logic/geometry.ts';
import {
  activeRange, cellSelection, cycleActive, extendBy, extendTo, jumpEdge, moveActive, rangeSelection, selectAll, selectCols, selectRows, type Selection,
} from '../logic/selection.ts';
import { currentRegion } from '../logic/data.ts';
import type { Commands, DialogState } from './commands.ts';

export interface KeyApi {
  sheet: Sheet;
  sel: Selection;
  setSel: (s: Selection) => void;
  cmd: Commands;
  startEdit: (text: string | null) => void;
  undo: () => void;
  redo: () => void;
  save: () => void;
  openFile: () => void;
  newFile: () => void;
  print: () => void;
  open: (d: DialogState) => void;
  switchSheet: (delta: 1 | -1) => void;
  addSheet: () => void;
  recalc: () => void;
  toggleFormulas: () => void;
  escape: () => void;
  stamp: (kind: 'date' | 'time') => void;
  deleteDrawing: () => boolean;
  flashFill: () => void;
  pageRows: number;
}

export function handleGridKey(e: KeyboardEvent<HTMLElement>, k: KeyApi): boolean {
  const ctrl = e.ctrlKey || e.metaKey;
  const { sel, sheet } = k;
  const filled = (r: number, c: number): boolean => {
    const cell = sheet.cells.get(r)?.get(c);
    return !!cell && (cell.value !== null || cell.formula !== undefined);
  };
  const rows = rowAxis(sheet);
  const cols = colAxis(sheet);
  const hidden = (r: number, c: number): boolean => axisSize(rows, r) === 0 || axisSize(cols, c) === 0;
  const used = usedRange(sheet);
  const limit = { row: used?.r2 ?? 0, col: used?.c2 ?? 0 };
  const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  const dir = arrows[e.key];
  if (dir) {
    const [dr, dc] = dir;
    if (ctrl) {
      const r = activeRange(sel);
      const from = e.shiftKey ? { row: sel.anchor.row === r.r1 ? r.r2 : r.r1, col: sel.anchor.col === r.c1 ? r.c2 : r.c1 } : sel.active;
      const to = jumpEdge(from, dr, dc, filled, limit);
      k.setSel(e.shiftKey ? extendTo(sel, to.row, to.col, sheet.merges) : cellSelection(to.row, to.col));
    } else k.setSel(e.shiftKey ? extendBy(sel, dr, dc) : moveActive(sel, dr, dc, hidden));
    return true;
  }
  if (!ctrl && !e.altKey && e.key.length === 1 && !(e.key === ' ' && e.shiftKey)) {
    k.startEdit(e.key);
    return true;
  }
  switch (e.key) {
    case 'Enter':
      k.setSel(cycleActive(sel, e.shiftKey ? -1 : 1, 0));
      return true;
    case 'Tab':
      k.setSel(cycleActive(sel, 0, e.shiftKey ? -1 : 1));
      return true;
    case 'F2':
      if (e.shiftKey) k.open({ kind: 'note' });
      else k.startEdit(null);
      return true;
    case 'F3':
      if (e.shiftKey) k.open({ kind: 'fnWizard' });
      else if (ctrl) k.open({ kind: 'names' });
      return true;
    case 'F4':
      if (ctrl) k.save();
      return true;
    case 'F5':
      k.open({ kind: 'goto' });
      return true;
    case 'F9':
      k.recalc();
      return true;
    case 'F11':
      if (e.shiftKey) k.addSheet();
      return e.shiftKey;
    case 'F12':
      k.open({ kind: 'formatCells' });
      return false;
    case 'Delete':
      if (!k.deleteDrawing()) k.cmd.clear('contents');
      return true;
    case 'Backspace':
      k.startEdit('');
      return true;
    case 'Escape':
      k.escape();
      return true;
    case 'Home':
      k.setSel(ctrl ? cellSelection(0, 0) : e.shiftKey ? extendTo(sel, sel.active.row, 0) : cellSelection(sel.active.row, 0));
      return true;
    case 'End':
      if (ctrl) k.setSel(e.shiftKey ? extendTo(sel, limit.row, limit.col) : cellSelection(limit.row, limit.col));
      return ctrl;
    case 'PageDown':
    case 'PageUp': {
      const d = e.key === 'PageDown' ? 1 : -1;
      if (ctrl) k.switchSheet(d);
      else k.setSel(e.shiftKey ? extendBy(sel, d * k.pageRows, 0) : moveActive(sel, d * k.pageRows, 0));
      return true;
    }
  }
  if (e.key === ' ' && ctrl) {
    k.setSel(selectCols(sel.active.col, activeRange(sel).c2));
    return true;
  }
  if (e.key === ' ' && e.shiftKey) {
    k.setSel(selectRows(sel.active.row, activeRange(sel).r2));
    return true;
  }
  if (!ctrl) return false;
  const key = e.key.toLowerCase();
  if (e.altKey && key === 'v') {
    k.open({ kind: 'pasteSpecial' });
    return true;
  }
  switch (key) {
    case 'z': k.undo(); return true;
    case 'y': k.redo(); return true;
    case 's': k.save(); return true;
    case 'o': k.openFile(); return true;
    case 'n': k.newFile(); return true;
    case 'p': k.print(); return true;
    case 'g': k.cmd.bold(); return true;
    case 'i': k.cmd.italic(); return true;
    case 'u': k.cmd.underline(); return true;
    case '5': k.cmd.strike(); return true;
    case 'b': k.cmd.fill('down'); return true;
    case 'd': k.cmd.fill('right'); return true;
    case 'e': k.flashFill(); return true;
    case 'f': k.open({ kind: 'find', replace: false }); return true;
    case 'h': k.open({ kind: 'find', replace: true }); return true;
    case 't': k.open({ kind: 'goto' }); return true;
    case 'k': k.open({ kind: 'link' }); return true;
    case 'l':
      if (e.shiftKey) k.cmd.toggleFilter();
      else k.cmd.formatAsTable('TableStyleMedium2');
      return true;
    case '1': k.open({ kind: 'formatCells' }); return true;
    case ';': k.stamp('date'); return true;
    case ':': k.stamp('time'); return true;
    case '"':
    case '`':
    case '²': k.toggleFormulas(); return true;
    case '%': k.cmd.numberFormat('0%'); return true;
    case '$': k.cmd.numberFormat('#,##0.00 [$€-40C]'); return true;
    case '-': k.cmd.remove('rows'); return true;
    case '+': k.cmd.insert('rows'); return true;
    case 'a': {
      const r = activeRange(sel);
      const region = currentRegion(sheet, sel.active.row, sel.active.col);
      const same = region.r1 === r.r1 && region.r2 === r.r2 && region.c1 === r.c1 && region.c2 === r.c2;
      k.setSel(same || (region.r1 === region.r2 && region.c1 === region.c2 && !filled(region.r1, region.c1)) ? selectAll() : rangeSelection(region, sel.active));
      return true;
    }
    case '*': k.setSel(rangeSelection(currentRegion(sheet, sel.active.row, sel.active.col), sel.active)); return true;
  }
  return false;
}
