// Bordures et alignement des cellules selectionnees (parite Word : Bordures, Alignement 9 positions).
import type { Node as PMNode } from 'prosemirror-model';
import type { Command, Transaction } from 'prosemirror-state';
import type { Alignment, Border, ParagraphProps, TableCellProps } from '@forgeoffice/docx';
import { tableRect } from './commands.ts';

export type BorderSide = 'outer' | 'inner' | 'top' | 'bottom' | 'left' | 'right' | 'insideH' | 'insideV' | 'all' | 'none';
type Edge = 'top' | 'bottom' | 'left' | 'right';

const NONE: Border = { style: 'none', width: 0, color: 'auto', space: 0 };

/** Bordure simple par defaut (0,5 pt, automatique). */
export const lineBorder = (patch: Partial<Border> = {}): Border => ({ style: 'single', width: 0.5, color: 'auto', space: 0, ...patch });

/** Pose (ou, avec `border` null, retire) les bordures de la selection ; le bord voisin hors selection est mis a jour aussi. */
export const applyBorders = (side: BorderSide, border: Border | null): Command => (state, dispatch) => {
  const r = tableRect(state);
  if (!r) return false;
  const b = side === 'none' ? NONE : border ?? NONE;
  const sides: BorderSide[] = side === 'all' || side === 'none' ? ['outer', 'inner'] : [side];
  const want = (s: BorderSide): boolean => sides.includes(s) || (s === 'top' || s === 'bottom' || s === 'left' || s === 'right' ? sides.includes('outer') : false) || ((s === 'insideH' || s === 'insideV') && sides.includes('inner'));
  if (dispatch) {
    const tr = state.tr;
    const w = r.map.width;
    const cellAt = (row: number, col: number): number => r.tableStart + r.map.map[row * w + col]!;
    const patch = (pos: number, edge: Edge): void => {
      const node = tr.doc.nodeAt(pos);
      if (!node) return;
      const props = node.attrs.props as TableCellProps;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, props: { ...props, borders: { ...props.borders, [edge]: b } } });
    };
    const horizontal = (y: number, col: number): void => {
      if (y < r.map.height) patch(cellAt(y, col), 'top');
      if (y > 0) patch(cellAt(y - 1, col), 'bottom');
    };
    const vertical = (x: number, row: number): void => {
      if (x < w) patch(cellAt(row, x), 'left');
      if (x > 0) patch(cellAt(row, x - 1), 'right');
    };
    for (let col = r.left; col < r.right; col++) {
      if (want('top')) horizontal(r.top, col);
      if (want('bottom')) horizontal(r.bottom, col);
      if (want('insideH')) for (let y = r.top + 1; y < r.bottom; y++) horizontal(y, col);
    }
    for (let row = r.top; row < r.bottom; row++) {
      if (want('left')) vertical(r.left, row);
      if (want('right')) vertical(r.right, row);
      if (want('insideV')) for (let x = r.left + 1; x < r.right; x++) vertical(x, row);
    }
    dispatch(tr);
  }
  return true;
};

/** Trame (couleur de fond hexa sans #, ou null) des cellules selectionnees. */
export const shadeCells = (fill: string | null): Command => (state, dispatch) => {
  const r = tableRect(state);
  if (!r) return false;
  if (dispatch) {
    const tr = state.tr;
    for (const rel of r.map.cellsInRect(r)) {
      const node = tr.doc.nodeAt(r.tableStart + rel);
      if (node) tr.setNodeMarkup(r.tableStart + rel, undefined, { ...node.attrs, props: { ...(node.attrs.props as TableCellProps), shading: fill ? { fill, pattern: 'clear' } : undefined } });
    }
    dispatch(tr);
  }
  return true;
};

/** Alignement du texte dans les cellules selectionnees : horizontal (paragraphes) + vertical (cellule). */
export const alignCells = (h: Alignment, v: NonNullable<TableCellProps['verticalAlign']>): Command => (state, dispatch) => {
  const r = tableRect(state);
  if (!r) return false;
  if (dispatch) {
    const tr: Transaction = state.tr;
    for (const rel of r.map.cellsInRect(r)) {
      const pos = r.tableStart + rel;
      const cell = tr.doc.nodeAt(pos);
      if (!cell) continue;
      tr.setNodeMarkup(pos, undefined, { ...cell.attrs, props: { ...(cell.attrs.props as TableCellProps), verticalAlign: v === 'top' ? undefined : v } });
      const paras: { node: PMNode; at: number }[] = [];
      tr.doc.nodeAt(pos)?.descendants((node, at) => {
        if (node.type.name === 'paragraph') paras.push({ node, at: pos + 1 + at });
        return true;
      });
      for (const p of paras) tr.setNodeMarkup(p.at, undefined, { ...p.node.attrs, props: { ...(p.node.attrs.props as ParagraphProps), alignment: h === 'left' ? undefined : h } });
    }
    dispatch(tr);
  }
  return true;
};
