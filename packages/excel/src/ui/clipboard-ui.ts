// Presse-papiers de la grille (Ctrl+C, Ctrl+X, Ctrl+V, ruban).
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { NoticeKind } from '@forgeoffice/core';
import type { Sheet, Workbook } from '@forgeoffice/xlsx';
import { captureRange, cssOfCell, parseDelimited, parseHtmlTable, pasteClip, pasteText, toHtml, toTsv, type ClipData, type PasteWhat } from '../logic/clipboard.ts';
import { fromScalar } from '../logic/engine.ts';
import { activeRange, clipRange, rangeSelection, type Selection } from '../logic/selection.ts';
import type { DocStore } from './store.ts';
import { S } from '../strings/index.ts';

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
