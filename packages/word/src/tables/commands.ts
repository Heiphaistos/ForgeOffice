// Commandes de tableau supplementaires (parite Word) : taille, uniformiser, ajustement, selection, fractionner, conversions.
import { CellSelection, selectedRect, type TableRect } from 'prosemirror-tables';
import type { Node as PMNode } from 'prosemirror-model';
import { TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import type { TableCellProps, TableProps, TableRowProps } from '@forgeoffice/docx';
import { selectedParagraphs } from '../editor/commands.ts';

const PX = 4 / 3;

/** Rectangle de cellules selectionnees ; null hors tableau (selectedRect leve une erreur dans ce cas). */
export function tableRect(state: EditorState): TableRect | null {
  try {
    return selectedRect(state);
  } catch {
    return null;
  }
}

const isSingleCell = (r: TableRect): boolean => r.right - r.left === 1 && r.bottom - r.top === 1;

/** Plage de colonnes / lignes visee : la selection, ou tout le tableau si une seule cellule. */
function span(r: TableRect, axis: 'col' | 'row'): [number, number] {
  if (isSingleCell(r)) return axis === 'col' ? [0, r.map.width] : [0, r.map.height];
  return axis === 'col' ? [r.left, r.right] : [r.top, r.bottom];
}

const cellPosAt = (r: TableRect, row: number, col: number): number => r.tableStart + r.map.map[row * r.map.width + col]!;

function rowPos(r: TableRect, row: number): number {
  let pos = r.tableStart;
  for (let i = 0; i < row; i++) pos += r.table.child(i).nodeSize;
  return pos;
}

/** Ecrit la largeur (px) d'une colonne dans chaque cellule qui la couvre. */
function writeColumnWidth(tr: Transaction, r: TableRect, col: number, px: number): void {
  const seen = new Set<number>();
  for (let row = 0; row < r.map.height; row++) {
    const pos = cellPosAt(r, row, col);
    if (seen.has(pos)) continue;
    seen.add(pos);
    const node = tr.doc.nodeAt(pos);
    if (!node) continue;
    const left = r.map.colCount(pos - r.tableStart);
    const widths: number[] = Array.isArray(node.attrs.colwidth) ? [...(node.attrs.colwidth as number[])] : new Array<number>(node.attrs.colspan as number).fill(0);
    widths[col - left] = px;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, colwidth: widths });
  }
}

function writeGrid(tr: Transaction, r: TableRect, widthsPt: ReadonlyMap<number, number>): void {
  const grid = [...(r.table.attrs.grid as number[])];
  while (grid.length < r.map.width) grid.push(0);
  for (const [col, pt] of widthsPt) grid[col] = pt;
  tr.setNodeMarkup(r.tableStart - 1, undefined, { ...r.table.attrs, grid });
}

/** Largeur (pt) des colonnes selectionnees. */
export const setColumnWidth = (pt: number): Command => (state, dispatch) => {
  const r = tableRect(state);
  if (!r || pt <= 0) return false;
  if (dispatch) {
    const tr = state.tr;
    const widths = new Map<number, number>();
    for (let col = r.left; col < r.right; col++) {
      writeColumnWidth(tr, r, col, Math.round(pt * PX));
      widths.set(col, pt);
    }
    writeGrid(tr, r, widths);
    dispatch(tr);
  }
  return true;
};

/** Modifie les proprietes des lignes selectionnees. */
export const setRowProps = (patch: Partial<TableRowProps>): Command => (state, dispatch) => {
  const r = tableRect(state);
  if (!r) return false;
  if (dispatch) {
    const tr = state.tr;
    for (let row = r.top; row < r.bottom; row++) {
      const pos = rowPos(r, row);
      const node = tr.doc.nodeAt(pos);
      if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, props: { ...(node.attrs.props as TableRowProps), ...patch } });
    }
    dispatch(tr);
  }
  return true;
};

/** Hauteur des lignes selectionnees (undefined = automatique). */
export const setRowHeight = (height: TableRowProps['height']): Command => setRowProps({ height });

/** Modifie les proprietes des cellules selectionnees. */
export const setCellProps = (patch: Partial<TableCellProps>): Command => (state, dispatch) => {
  const r = tableRect(state);
  if (!r) return false;
  if (dispatch) {
    const tr = state.tr;
    for (const rel of r.map.cellsInRect(r)) {
      const node = tr.doc.nodeAt(r.tableStart + rel);
      if (node) tr.setNodeMarkup(r.tableStart + rel, undefined, { ...node.attrs, props: { ...(node.attrs.props as TableCellProps), ...patch } });
    }
    dispatch(tr);
  }
  return true;
};

/** Uniformise la hauteur des lignes (la plus haute, mesuree par `measurePx(pos de ligne)`). */
export const equalizeRows = (measurePx: (rowPos: number) => number): Command => (state, dispatch) => {
  const r = tableRect(state);
  if (!r) return false;
  const [from, to] = span(r, 'row');
  const target = Math.max(...Array.from({ length: to - from }, (_, i) => measurePx(rowPos(r, from + i))));
  if (!(target > 0)) return false;
  if (dispatch) {
    const tr = state.tr;
    for (let row = from; row < to; row++) {
      const pos = rowPos(r, row);
      const node = tr.doc.nodeAt(pos);
      if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, props: { ...(node.attrs.props as TableRowProps), height: { value: Math.round(target / PX * 100) / 100, rule: 'atLeast' } } });
    }
    dispatch(tr);
  }
  return true;
};

/** Uniformise la largeur des colonnes (moyenne des colonnes visees). */
export const equalizeColumns: Command = (state, dispatch) => {
  const r = tableRect(state);
  if (!r) return false;
  const [from, to] = span(r, 'col');
  const grid = r.table.attrs.grid as number[];
  const total = Array.from({ length: to - from }, (_, i) => grid[from + i] ?? 0).reduce((a, b) => a + b, 0);
  if (!(total > 0)) return false;
  if (dispatch) {
    const each = Math.round((total / (to - from)) * 100) / 100;
    const tr = state.tr;
    const widths = new Map<number, number>();
    for (let col = from; col < to; col++) {
      writeColumnWidth(tr, r, col, Math.round(each * PX));
      widths.set(col, each);
    }
    writeGrid(tr, r, widths);
    dispatch(tr);
  }
  return true;
};

export type AutoFit = 'contents' | 'window' | 'fixed';

/** Ajustement automatique : au contenu (colonnes libres), a la fenetre (100 %), largeur fixe. */
export const autoFit = (mode: AutoFit): Command => (state, dispatch) => {
  const r = tableRect(state);
  if (!r) return false;
  if (dispatch) {
    const tr = state.tr;
    const props: TableProps = { ...(r.table.attrs.props as TableProps) };
    if (mode === 'fixed') props.layout = 'fixed';
    else {
      props.layout = 'autofit';
      props.width = mode === 'window' ? { value: 100, type: 'pct' } : { value: 0, type: 'auto' };
    }
    tr.setNodeMarkup(r.tableStart - 1, undefined, { ...r.table.attrs, props });
    if (mode === 'contents') {
      const seen = new Set<number>();
      r.map.map.forEach((rel) => {
        if (seen.has(rel)) return;
        seen.add(rel);
        const node = tr.doc.nodeAt(r.tableStart + rel);
        if (node) tr.setNodeMarkup(r.tableStart + rel, undefined, { ...node.attrs, colwidth: null });
      });
    }
    dispatch(tr);
  }
  return true;
};

/** Modifie les proprietes du tableau courant. */
export const setTableProps = (patch: Partial<TableProps>): Command => (state, dispatch) => {
  const r = tableRect(state);
  if (!r) return false;
  if (dispatch) dispatch(state.tr.setNodeMarkup(r.tableStart - 1, undefined, { ...r.table.attrs, props: { ...(r.table.attrs.props as TableProps), ...patch } }));
  return true;
};

export type TableScope = 'cell' | 'column' | 'row' | 'table';

/** Selectionne la cellule, la colonne, la ligne ou le tableau du curseur. */
export const selectTablePart = (scope: TableScope): Command => (state, dispatch) => {
  const r = tableRect(state);
  if (!r) return false;
  const [r0, r1, c0, c1] = scope === 'cell' ? [r.top, r.top, r.left, r.left]
    : scope === 'row' ? [r.top, r.top, 0, r.map.width - 1]
    : scope === 'column' ? [0, r.map.height - 1, r.left, r.left]
    : [0, r.map.height - 1, 0, r.map.width - 1];
  if (dispatch) dispatch(state.tr.setSelection(new CellSelection(state.doc.resolve(cellPosAt(r, r0, c0)), state.doc.resolve(cellPosAt(r, r1, c1)))));
  return true;
};

/** Fractionne le tableau avant la ligne du curseur ; un paragraphe vide separe les deux. */
export const splitTable: Command = (state, dispatch) => {
  const r = tableRect(state);
  if (!r || r.top < 1) return false;
  for (let col = 0; col < r.map.width; col++) if (cellPosAt(r, r.top, col) === cellPosAt(r, r.top - 1, col)) return false; // cellule fusionnee a cheval
  if (dispatch) {
    const rows: PMNode[] = [];
    r.table.forEach((row) => rows.push(row));
    const make = (part: PMNode[]): PMNode => r.table.type.create(r.table.attrs, part);
    const para = state.schema.nodes.paragraph!.create();
    const start = r.tableStart - 1;
    const tr = state.tr.replaceWith(start, start + r.table.nodeSize, [make(rows.slice(0, r.top)), para, make(rows.slice(r.top))]);
    dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(start + make(rows.slice(0, r.top)).nodeSize + 1))));
  }
  return true;
};

/** Convertit le tableau du curseur en paragraphes (cellules separees par une tabulation). */
export const tableToText: Command = (state, dispatch) => {
  const r = tableRect(state);
  if (!r) return false;
  if (dispatch) {
    const paras: PMNode[] = [];
    r.table.forEach((row) => {
      const cells: string[] = [];
      row.forEach((cell) => cells.push(cell.textContent.replace(/\s+/g, ' ').trim()));
      const text = cells.join('\t');
      paras.push(state.schema.nodes.paragraph!.create(null, text ? state.schema.text(text) : null));
    });
    const start = r.tableStart - 1;
    dispatch(state.tr.replaceWith(start, start + r.table.nodeSize, paras).scrollIntoView());
  }
  return true;
};

/** Decoupe un texte en cellules selon un separateur (tabulation, point-virgule, virgule, paragraphe). */
export function splitCells(line: string, sep: string): string[] {
  return sep === '' ? [line] : line.split(sep);
}

/** Convertit les paragraphes selectionnes en tableau (une ligne par paragraphe, `sep` entre les cellules). */
export const textToTable = (sep: string, width = 453.6): Command => (state, dispatch) => {
  const paras = selectedParagraphs(state).filter((p) => p.node.textContent.length > 0);
  if (paras.length === 0) return false;
  const rows = paras.map((p) => splitCells(p.node.textContent, sep));
  const cols = Math.max(...rows.map((cells) => cells.length));
  if (dispatch) {
    const { schema } = state;
    const col = Math.round((width / cols) * 100) / 100;
    const mkRow = (cells: string[]): PMNode => schema.nodes.table_row!.create({ props: {} }, Array.from({ length: cols }, (_, i) => schema.nodes.table_cell!.create(
      { props: {}, colwidth: [Math.round(col * PX)] },
      schema.nodes.paragraph!.create(null, cells[i] ? schema.text(cells[i]!) : null),
    )));
    const table = schema.nodes.table!.create({ styleId: 'TableGrid', props: { width: { value: 0, type: 'auto' } }, grid: Array.from({ length: cols }, () => col) }, rows.map(mkRow));
    const from = paras[0]!.pos;
    const last = paras[paras.length - 1]!;
    dispatch(state.tr.replaceWith(from, last.pos + last.node.nodeSize, table).scrollIntoView());
  }
  return true;
};
