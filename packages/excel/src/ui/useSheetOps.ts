// Operations sur les feuilles du classeur : ajout, suppression, renommage, changement de feuille, atteindre une plage ou un nom.
import { useCallback } from 'react';
import { isValidSheetName } from '@forgeoffice/xlsx';
import { rangeFromText } from '../logic/rangeText.ts';
import { rangeSelection, type Selection } from '../logic/selection.ts';
import { addSheetAt, deleteSheet, renameSheet } from '../logic/structure.ts';
import type { DocStore } from './store.ts';
import { S } from '../strings.ts';

interface SheetOpsDeps {
  store: DocStore;
  si: number;
  setSi: (i: number) => void;
  setSels: (fn: (s: Record<string, Selection>) => Record<string, Selection>) => void;
  notify: (m: string, kind?: 'info' | 'success' | 'warning' | 'error') => void;
  focusGrid: () => void;
}

export function useSheetOps({ store, si, setSi, setSels, notify, focusGrid }: SheetOpsDeps) {
  const wb = store.wb;
  const sheet = wb.sheets[si];

  const addSheet = useCallback(() => {
    if (wb.protection?.lockStructure) return notify(S.protectedBook, 'warning');
    let idx = 0;
    store.commit((d) => {
      idx = addSheetAt(d, si + 1);
    });
    setSi(idx);
  }, [wb, store, si, setSi, notify]);

  const removeSheet = useCallback((i: number) => {
    if (wb.protection?.lockStructure) return notify(S.protectedBook, 'warning');
    if (wb.sheets.filter((s) => s.state === 'visible').length <= 1) return notify(S.lastSheet, 'warning');
    const n = wb.sheets[i]?.name ?? '';
    if (!window.confirm(S.deleteSheetConfirm(n))) return;
    store.commit((d) => deleteSheet(d, i));
    setSi(Math.max(0, Math.min(i, store.wb.sheets.length - 1)));
  }, [wb, store, setSi, notify]);

  const renameCurrent = useCallback(() => {
    const n = window.prompt(S.renameSheet, sheet?.name);
    if (n && isValidSheetName(n) && !wb.sheets.some((s, i) => i !== si && s.name.toLowerCase() === n.toLowerCase())) store.commit((d) => renameSheet(d, si, n));
    else if (n) notify(S.badSheetName, 'error');
  }, [sheet, wb, si, store, notify]);

  const switchSheet = useCallback((delta: 1 | -1) => {
    let i = si;
    do i += delta; while (i >= 0 && i < wb.sheets.length && wb.sheets[i]?.state !== 'visible');
    if (i >= 0 && i < wb.sheets.length) setSi(i);
  }, [si, wb, setSi]);

  /** Zone Nom : atteint une plage (« B2:D5 », « Feuil2!A1 ») ou un nom defini. */
  const goTo = useCallback((ref: string) => {
    const n = wb.definedNames.find((k) => k.name.toLowerCase() === ref.toLowerCase());
    const target = (n ? n.formula : ref).replace(/\$/g, '');
    const local = target.includes('!') ? target.slice(target.lastIndexOf('!') + 1) : target;
    const sheetPart = target.includes('!') ? target.slice(0, target.lastIndexOf('!')).replace(/^'|'$/g, '') : null;
    const idx = sheetPart ? wb.sheets.findIndex((s) => s.name.toLowerCase() === sheetPart.toLowerCase()) : si;
    if (idx < 0) return notify(S.invalidRef, 'error');
    const r = rangeFromText(local.toUpperCase());
    if (!r) return notify(S.invalidRef, 'error');
    if (idx !== si) setSi(idx);
    setSels((s) => ({ ...s, [wb.sheets[idx]?.name ?? '']: rangeSelection(r) }));
    focusGrid();
  }, [wb, si, setSi, setSels, notify, focusGrid]);

  return { addSheet, removeSheet, renameCurrent, switchSheet, goTo };
}
