// Presse-papiers de la grille (Ctrl+C, Ctrl+X, Ctrl+V, ruban) et menu contextuel des cellules / en-tetes.
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { NoticeKind } from '@forgeoffice/core';
import type { MenuItem } from '@forgeoffice/ui';
import type { Sheet, Workbook } from '@forgeoffice/xlsx';
import { captureRange, cssOfCell, parseDelimited, parseHtmlTable, pasteClip, pasteText, toHtml, toTsv, type ClipData, type PasteWhat } from '../logic/clipboard.ts';
import { fromScalar } from '../logic/engine.ts';
import { activeRange, clipRange, rangeSelection, type Selection } from '../logic/selection.ts';
import type { Commands, DialogState } from './commands.ts';
import type { ContextArea } from './Grid.tsx';
import type { DocStore } from './store.ts';
import { S, RB } from '../strings.ts';

export interface ClipboardEnv {
  store: DocStore;
  wb: Workbook;
  si: number;
  sheet: Sheet;
  selection: Selection;
  setSel: (s: Selection) => void;
  displayAt: (row: number, col: number) => string;
  notify: (m: string, kind?: NoticeKind) => void;
  guard: () => boolean;
  clip: ClipData | null;
  setClip: (c: ClipData | null) => void;
  gridEl: RefObject<HTMLDivElement | null>;
}

export function useClipboard(e: ClipboardEnv) {
  const { store, wb, si, sheet, selection, setSel, displayAt, notify, guard, clip, setClip, gridEl } = e;
  const lastCopy = useRef('');

  const doCopy = useCallback((cut: boolean, data?: DataTransfer | null) => {
    if (selection.ranges.length > 1) {
      notify(S.cannotMultiple, 'warning');
      return;
    }
    let lastRow = 0;
    let lastCol = 0;
    for (const [row, line] of sheet.cells) {
      lastRow = Math.max(lastRow, row);
      for (const col of line.keys()) lastCol = Math.max(lastCol, col);
    }
    const sel = activeRange(selection);
    const r = clipRange(sel, { r1: 0, c1: 0, r2: Math.max(sel.r1, lastRow), c2: Math.max(sel.c1, lastCol) }) ?? sel;
    const c = captureRange(wb, si, r, cut);
    setClip(c);
    const rows: string[][] = [];
    for (let row = r.r1; row <= r.r2; row++) {
      const line: string[] = [];
      for (let col = r.c1; col <= r.c2; col++) line.push(displayAt(row, col));
      rows.push(line);
    }
    const tsv = toTsv(rows);
    lastCopy.current = tsv;
    if (data) {
      data.setData('text/plain', tsv);
      data.setData('text/html', toHtml(rows, (rr, cc) => cssOfCell(wb, c.cells[rr]?.[cc])));
    } else void navigator.clipboard?.writeText(tsv).catch(() => undefined);
  }, [selection, sheet, wb, si, displayAt, notify, setClip]);

  const pasteInternal = useCallback((what: PasteWhat | 'transpose' = 'all'): boolean => {
    if (!clip) return false;
    if (!guard()) return true;
    store.commit((d) => {
      const target = pasteClip(d, si, clip, activeRange(selection), {
        what: what === 'transpose' ? 'all' : what, transpose: what === 'transpose',
        computed: (r, c) => fromScalar(store.engine.value(wb.sheets[clip.sheet]?.name ?? sheet.name, clip.range.r1 + r, clip.range.c1 + c)),
      });
      setSel(rangeSelection(target));
    });
    if (clip.cut) setClip(null);
    return true;
  }, [clip, guard, store, si, selection, wb, sheet.name, setSel, setClip]);

  const pasteExternal = useCallback((text: string, html: string) => {
    if (!guard()) return;
    if (clip && text === lastCopy.current) {
      pasteInternal();
      return;
    }
    const rows = (html && parseHtmlTable(html)) || parseDelimited(text.replace(/\r?\n$/, ''), text.includes('\t') ? '\t' : text.includes(';') ? ';' : '\t');
    store.commit((d) => {
      setSel(rangeSelection(pasteText(d, si, rows, selection.active)));
    });
  }, [guard, clip, pasteInternal, store, si, selection.active, setSel]);

  const paste = useCallback((what?: PasteWhat | 'transpose') => {
    if (pasteInternal(what ?? 'all')) return;
    navigator.clipboard?.readText().then((t) => pasteExternal(t, ''), () => notify(S.clipboardDenied, 'warning'));
  }, [pasteInternal, pasteExternal, notify]);

  useEffect(() => {
    const inGrid = (): boolean => !!gridEl.current && document.activeElement === gridEl.current;
    const handler = (kind: 'copy' | 'cut' | 'paste') => (ev: ClipboardEvent): void => {
      if (!inGrid()) return;
      ev.preventDefault();
      if (kind === 'paste') pasteExternal(ev.clipboardData?.getData('text/plain') ?? '', ev.clipboardData?.getData('text/html') ?? '');
      else doCopy(kind === 'cut', ev.clipboardData);
    };
    const onCopy = handler('copy');
    const onCut = handler('cut');
    const onPaste = handler('paste');
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, [doCopy, pasteExternal, gridEl]);

  return { doCopy, paste };
}

export interface ContextHandlers {
  cmd: Commands;
  copy: (cut: boolean) => void;
  paste: () => void;
  open: (d: DialogState) => void;
  comment: () => void;
}

/** Menu contextuel de la grille selon la zone (cellules, en-tete de ligne ou de colonne). */
export function gridContextMenu(area: ContextArea, h: ContextHandlers): MenuItem[] {
  const { cmd } = h;
  const specific: MenuItem[] = area === 'col' ? [
    { id: 'ic', label: RB.insertCols, icon: 'table_insert_column', onClick: () => cmd.insert('cols') },
    { id: 'dc', label: RB.delCols, icon: 'table_delete_column', onClick: () => cmd.remove('cols') },
    { id: 'cw', label: RB.colWidth, onClick: () => h.open({ kind: 'size', axis: 'col' }) },
    { id: 'hc', label: RB.hideCols, onClick: () => cmd.hide('col', true) },
    { id: 'sc', label: RB.showCols, onClick: () => cmd.hide('col', false) },
  ] : area === 'row' ? [
    { id: 'ir', label: RB.insertRows, icon: 'table_insert_row', onClick: () => cmd.insert('rows') },
    { id: 'dr', label: RB.delRows, icon: 'table_delete_row', onClick: () => cmd.remove('rows') },
    { id: 'rh', label: RB.rowHeight, onClick: () => h.open({ kind: 'size', axis: 'row' }) },
    { id: 'hr', label: RB.hideRows, onClick: () => cmd.hide('row', true) },
    { id: 'sr', label: RB.showRows, onClick: () => cmd.hide('row', false) },
  ] : [
    { id: 'ins', label: RB.insert, icon: 'table_insert_row', items: [
      { id: 'cd', label: RB.cellsDown, onClick: () => cmd.insert('cellsDown') },
      { id: 'cr', label: RB.cellsRight, onClick: () => cmd.insert('cellsRight') },
      { id: 'r', label: RB.insertRows, onClick: () => cmd.insert('rows') },
      { id: 'c', label: RB.insertCols, onClick: () => cmd.insert('cols') },
    ] },
    { id: 'del', label: RB.del, icon: 'table_delete_row', items: [
      { id: 'cu', label: RB.cellsUp, onClick: () => cmd.remove('cellsUp') },
      { id: 'cl', label: RB.cellsLeft, onClick: () => cmd.remove('cellsLeft') },
      { id: 'r', label: RB.delRows, onClick: () => cmd.remove('rows') },
      { id: 'c', label: RB.delCols, onClick: () => cmd.remove('cols') },
    ] },
    { id: 'clr', label: RB.clearContents, icon: 'eraser', onClick: () => cmd.clear('contents') },
    { id: 's2', kind: 'separator' },
    { id: 'filter', label: RB.filter, icon: 'filter', onClick: cmd.toggleFilter },
    { id: 'sort', label: RB.sortBtn, icon: 'arrow_sort', items: [
      { id: 'a', label: RB.sortAsc, onClick: () => cmd.sortQuick(false) },
      { id: 'd', label: RB.sortDesc, onClick: () => cmd.sortQuick(true) },
      { id: 'c', label: RB.customSort, onClick: () => h.open({ kind: 'sort' }) },
    ] },
    { id: 's3', kind: 'separator' },
    { id: 'cmt', label: RB.newComment, icon: 'comment_add', onClick: h.comment },
    { id: 'note', label: RB.newNote, icon: 'note', onClick: () => h.open({ kind: 'note' }) },
    { id: 'link', label: RB.link, icon: 'link', onClick: () => h.open({ kind: 'link' }) },
    { id: 'name', label: RB.defineName, icon: 'tag', onClick: () => h.open({ kind: 'names' }) },
  ];
  return [
    { id: 'cut', label: RB.cut, icon: 'cut', shortcut: 'Ctrl+X', onClick: () => h.copy(true) },
    { id: 'copy', label: RB.copy, icon: 'copy', shortcut: 'Ctrl+C', onClick: () => h.copy(false) },
    { id: 'paste', label: RB.paste, icon: 'clipboard_paste', shortcut: 'Ctrl+V', onClick: h.paste },
    { id: 'pastesp', label: RB.pasteSpecial, onClick: () => h.open({ kind: 'pasteSpecial' }) },
    { id: 's1', kind: 'separator' },
    ...specific,
    { id: 's4', kind: 'separator' },
    { id: 'fmt', label: RB.formatCells, icon: 'table_cell_edit', shortcut: 'Ctrl+1', onClick: () => h.open({ kind: 'formatCells' }) },
  ];
}
