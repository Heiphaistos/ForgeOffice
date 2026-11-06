// Etat partage des onglets de « Format de cellule » : valeurs de la selection + modifications de l'utilisateur.
// Les onglets lisent `get(cle)` (modification, sinon valeur de la selection) et ecrivent `set({ cle: valeur })`.
import { useMemo, useState } from 'react';
import { resolveColor, type CellRange, type Color, type Workbook } from '@forgeoffice/xlsx';
import type { Scalar } from '@forgeoffice/formulas';
import { readFormat, type FieldKey, type FormatEdits, type FormatFields, type FormatState } from '../../../logic/format-edits.ts';
import type { BorderSpec } from '../../../logic/border-spec.ts';

export type TabId = 'number' | 'align' | 'font' | 'border' | 'fill' | 'protection';
export const ALL_TABS: readonly TabId[] = ['number', 'align', 'font', 'border', 'fill', 'protection'];

export interface FormatCtx {
  wb: Workbook;
  state: FormatState;
  edits: FormatEdits;
  /** Valeur courante d'un champ : la modification de l'utilisateur, sinon celle de la cellule active. */
  get: <K extends FieldKey>(key: K) => FormatFields[K];
  /** Champ different d'une cellule a l'autre ET non modifie. */
  isMixed: (key: FieldKey) => boolean;
  set: (patch: FormatEdits) => void;
  /** Modifie des bords (fusionnes avec les modifications precedentes). */
  setBorders: (patch: BorderSpec) => void;
  /** Valeur de la cellule active (apercu des formats). */
  sample: Scalar;
}

export function useFormatCtx(wb: Workbook, si: number, ranges: readonly CellRange[], active: { row: number; col: number }, sample: Scalar): FormatCtx {
  const state = useMemo(() => readFormat(wb, si, ranges, active), [wb, si, ranges, active]);
  const [edits, setEdits] = useState<FormatEdits>({});
  return {
    wb,
    state,
    edits,
    get: (key) => (edits[key] !== undefined ? edits[key] : state.view.fields[key]) as FormatFields[typeof key],
    isMixed: (key) => state.mixed.has(key) && edits[key] === undefined,
    set: (patch) => setEdits((cur) => ({ ...cur, ...patch })),
    setBorders: (patch) => setEdits((cur) => ({ ...cur, border: { ...cur.border, ...patch } })),
    sample,
  };
}

/** Couleur du modele -> « #RRGGBB » (null = automatique). */
export function colorHex(wb: Workbook, c: Color | null | undefined): string | null {
  const v = resolveColor(wb, c ?? undefined);
  return v ? `#${v}` : null;
}

/** « #RRGGBB » -> couleur du modele. */
export function hexColor(hex: string): Color {
  return { rgb: `FF${hex.replace('#', '').toUpperCase()}` };
}
