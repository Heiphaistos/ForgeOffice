// Menu contextuel d'un tableau : lignes et colonnes, fusion, uniformisation (memes actions que l'onglet Disposition).
import type { MenuItem } from '@forgeoffice/ui';
import type { TableShape } from '@forgeoffice/pptx';
import type { CellRange } from '../canvas/types.ts';
import { locate } from '../canvas/ops.ts';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import type { Editor } from './editor.ts';
import { editTable } from './ribbon/contextual.tsx';
import { deleteColumns, deleteRows, distribute, insertColumn, insertRow, mergeRange, splitColumns, unmerge } from './table-ops.ts';

/** Cellule sous le pointeur lors d'un clic droit (attribut `data-cell` = « ligne:colonne »). */
export function cellFromEvent(e: { target: EventTarget | null }): { row: number; col: number } | null {
  const el = e.target instanceof Element ? e.target.closest('[data-cell]') : null;
  const [row, col] = (el?.getAttribute('data-cell') ?? '').split(':').map(Number);
  return row === undefined || col === undefined || Number.isNaN(row) || Number.isNaN(col) ? null : { row, col };
}

/** Plage visee : la plage selectionnee si elle contient la cellule cliquee, sinon cette cellule seule (comme PowerPoint). */
export function menuRange(ed: Editor, table: TableShape, hit: { row: number; col: number } | null): CellRange {
  const { cells, text } = ed.selection;
  const editing = text?.shapeId === table.id ? text.cell : undefined;
  const chosen: CellRange | null = cells?.shapeId === table.id ? cells : editing ? { shapeId: table.id, r0: editing.row, c0: editing.col, r1: editing.row, c1: editing.col } : null;
  if (hit && !(chosen && hit.row >= chosen.r0 && hit.row <= chosen.r1 && hit.col >= chosen.c0 && hit.col <= chosen.c1)) return { shapeId: table.id, r0: hit.row, c0: hit.col, r1: hit.row, c1: hit.col };
  return chosen ?? { shapeId: table.id, r0: 0, c0: 0, r1: table.table.rows.length - 1, c1: table.table.columns.length - 1 };
}

export function tableMenuItems(ed: Editor, table: TableShape, hit: { row: number; col: number } | null = null): MenuItem[] {
  const sel = menuRange(ed, table, hit);
  const cell = table.table.rows[sel.r0]?.cells[sel.c0];
  const run = (recipe: (s: TableShape) => void) => (): void => editTable(ed, table, recipe, 'tableMenu');
  const single = sel.r0 === sel.r1 && sel.c0 === sel.c1;
  const select = (r: { r0: number; c0: number; r1: number; c1: number }): void => ed.setSelection({ ids: [table.id], text: null, cells: { shapeId: table.id, ...r } });
  const C = S.context;
  return [
    { id: 'ts1', kind: 'separator' },
    {
      id: 'tinsert', label: C.rowsColumns, icon: 'table_insert_row',
      items: [
        { id: 'above', label: C.insertAbove, icon: 'table_insert_row', onClick: run((s) => insertRow(s, sel.r0)) },
        { id: 'below', label: C.insertBelow, icon: 'table_insert_row', onClick: run((s) => insertRow(s, sel.r1 + 1)) },
        { id: 'left', label: C.insertLeft, icon: 'table_insert_column', onClick: run((s) => insertColumn(s, sel.c0)) },
        { id: 'right', label: C.insertRight, icon: 'table_insert_column', onClick: run((s) => insertColumn(s, sel.c1 + 1)) },
      ],
    },
    {
      id: 'tdelete', label: S3.table.deleteSubmenu, icon: 'table_delete_row',
      items: [
        { id: 'cols', label: C.deleteColumns, icon: 'table_delete_column', onClick: run((s) => deleteColumns(s, sel.c0, sel.c1)) },
        { id: 'rows', label: C.deleteRows, icon: 'table_delete_row', onClick: run((s) => deleteRows(s, sel.r0, sel.r1)) },
        { id: 'table', label: C.deleteTable, icon: 'delete', onClick: () => { ed.editShapes((shapes) => { const f = locate(shapes, table.id); if (f) f.list.splice(f.index, 1); }, 'delete'); ed.setSelection({ ids: [] }); } },
      ],
    },
    {
      id: 'tselect', label: S3.borders.select, icon: 'select_all_on',
      items: [
        { id: 'stable', label: S3.borders.selectTable, onClick: () => select({ r0: 0, c0: 0, r1: table.table.rows.length - 1, c1: table.table.columns.length - 1 }) },
        { id: 'scol', label: S3.borders.selectColumn, onClick: () => select({ r0: 0, c0: sel.c0, r1: table.table.rows.length - 1, c1: sel.c1 }) },
        { id: 'srow', label: S3.borders.selectRow, onClick: () => select({ r0: sel.r0, c0: 0, r1: sel.r1, c1: table.table.columns.length - 1 }) },
      ],
    },
    { id: 'tborders', label: S3.borders.menu, icon: 'border_all', onClick: () => { select(sel); ed.setUi({ dialog: 'borders' }); } },
    { id: 'tmerge', label: C.mergeCells, icon: 'table_cells_merge', disabled: single, onClick: run((s) => mergeRange(s, sel.r0, sel.c0, sel.r1, sel.c1)) },
    { id: 'tsplit', label: C.splitCells, icon: 'table_cells_split', onClick: run((s) => (cell?.gridSpan || cell?.rowSpan ? unmerge(s, sel.r0, sel.c0) : splitColumns(s, sel.r0, sel.c0, 2))) },
    { id: 'tdistrows', label: C.distributeRows, icon: 'table_stack_below', onClick: run((s) => distribute(s, 'rows')) },
    { id: 'tdistcols', label: C.distributeColumns, icon: 'table_split', onClick: run((s) => distribute(s, 'columns')) },
  ];
}
