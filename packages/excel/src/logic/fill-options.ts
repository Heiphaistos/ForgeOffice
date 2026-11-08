// « Options de recopie incrementee » : refaire une recopie selon le mode choisi apres coup (copier, serie, formats seuls, sans formats).
import type { Cell, CellRange } from '@forgeoffice/xlsx';
import type { Draft } from './draft.ts';
import { autoFill, type SeriesOptions } from './fill.ts';

export type FillMode = 'copy' | 'series' | 'formats' | 'noFormats';

export const FILL_MODES: readonly FillMode[] = ['copy', 'series', 'formats', 'noFormats'];

/** Cellules de la zone ajoutee (target moins src) avant la recopie, pour pouvoir la refaire autrement. */
export type FillBefore = { row: number; col: number; cell: Cell | undefined }[];

const inside = (r: CellRange, row: number, col: number): boolean => row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2;

export function snapshotFill(d: Draft, si: number, src: CellRange, target: CellRange): FillBefore {
  const out: FillBefore = [];
  for (let row = target.r1; row <= target.r2; row++) {
    for (let col = target.c1; col <= target.c2; col++) if (!inside(src, row, col)) out.push({ row, col, cell: d.get(si, row, col) });
  }
  return out;
}

/** Remet la zone dans son etat d'origine puis recopie selon `mode`. `base` : options de la serie (dates, ...). */
export function applyFillMode(d: Draft, si: number, src: CellRange, target: CellRange, mode: FillMode, before: FillBefore, base: SeriesOptions = {}): boolean {
  for (const b of before) d.set(si, b.row, b.col, b.cell);
  const ok = autoFill(d, si, src, target, { ...base, copyOnly: mode === 'copy' || mode === 'formats' });
  if (!ok) return false;
  for (const b of before) {
    const filled = d.get(si, b.row, b.col);
    if (mode === 'formats') {
      const styleId = filled?.styleId;
      const keep: Cell | undefined = b.cell ?? (styleId ? { value: null } : undefined);
      d.set(si, b.row, b.col, keep && styleId ? { ...keep, styleId } : b.cell);
    } else if (mode === 'noFormats' && filled) {
      const next: Cell = { ...filled };
      if (b.cell?.styleId) next.styleId = b.cell.styleId;
      else delete next.styleId;
      d.set(si, b.row, b.col, next);
    }
  }
  return true;
}

/** Plage englobant la source et la zone recopiee. */
export function fillUnion(src: CellRange, target: CellRange): CellRange {
  return { r1: Math.min(src.r1, target.r1), c1: Math.min(src.c1, target.c1), r2: Math.max(src.r2, target.r2), c2: Math.max(src.c2, target.c2) };
}
