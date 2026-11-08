// Bordures de cellules : une arete modifiee l'est aussi sur la cellule voisine, pour que les deux cotes concordent.
import type { Line, TableBorders, TableShape } from '@forgeoffice/pptx';

export type BorderSide = 'top' | 'bottom' | 'left' | 'right' | 'insideH' | 'insideV';
export interface CellBox { r0: number; c0: number; r1: number; c1: number }

export const NO_LINE: Line = { fill: { type: 'none' } };

function setEdge(shape: TableShape, r: number, c: number, side: keyof Pick<TableBorders, 'top' | 'bottom' | 'left' | 'right'>, line: Line): void {
  const cell = shape.table.rows[r]?.cells[c];
  if (cell) cell.borders = { ...(cell.borders ?? {}), [side]: { ...line } };
}

/** Applique `line` aux aretes demandees de la plage. Les cellules fusionnees gardent leur propre arete. */
export function applyBorders(shape: TableShape, range: CellBox, sides: readonly BorderSide[], line: Line): void {
  const has = (s: BorderSide): boolean => sides.includes(s);
  for (let r = range.r0; r <= range.r1; r++) {
    for (let c = range.c0; c <= range.c1; c++) {
      const top = r === range.r0;
      const bottom = r === range.r1;
      const left = c === range.c0;
      const right = c === range.c1;
      if ((top && has('top')) || (!top && has('insideH'))) {
        setEdge(shape, r, c, 'top', line);
        setEdge(shape, r - 1, c, 'bottom', line);
      }
      if ((bottom && has('bottom')) || (!bottom && has('insideH'))) {
        setEdge(shape, r, c, 'bottom', line);
        setEdge(shape, r + 1, c, 'top', line);
      }
      if ((left && has('left')) || (!left && has('insideV'))) {
        setEdge(shape, r, c, 'left', line);
        setEdge(shape, r, c - 1, 'right', line);
      }
      if ((right && has('right')) || (!right && has('insideV'))) {
        setEdge(shape, r, c, 'right', line);
        setEdge(shape, r, c + 1, 'left', line);
      }
    }
  }
}

export const ALL_SIDES: readonly BorderSide[] = ['top', 'bottom', 'left', 'right', 'insideH', 'insideV'];
export const OUTSIDE_SIDES: readonly BorderSide[] = ['top', 'bottom', 'left', 'right'];
export const INSIDE_SIDES: readonly BorderSide[] = ['insideH', 'insideV'];
