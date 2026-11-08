// Menus contextuels de la grille (cellules, en-tetes de lignes et de colonnes, coin) : un fournisseur par segment, enregistres dans le registre.
import type { MenuItem } from '@forgeoffice/ui';
import type { Commands } from './commands.ts';
import { registerMenu, type DialogState } from './registry.ts';
import { RB, S } from '../strings/index.ts';

export interface ContextHandlers {
  cmd: Commands;
  copy: (cut: boolean) => void;
  paste: () => void;
  open: (d: DialogState) => void;
  comment: () => void;
}

/** Le coin de la grille se comporte comme une cellule. */
const CELLS = ['cell', 'corner'] as const;

registerMenu({
  id: 'grid.clipboard', context: ['cell', 'row', 'col', 'corner'], order: 100,
  items: (h): MenuItem[] => [
    { id: 'cut', label: RB.cut, icon: 'cut', shortcut: 'Ctrl+X', onClick: () => h.copy(true) },
    { id: 'copy', label: RB.copy, icon: 'copy', shortcut: 'Ctrl+C', onClick: () => h.copy(false) },
    { id: 'paste', label: RB.paste, icon: 'clipboard_paste', shortcut: 'Ctrl+V', onClick: h.paste },
    { id: 'pastesp', label: RB.pasteSpecial, onClick: () => h.open({ kind: 'pasteSpecial' }) },
  ],
});
registerMenu({
  id: 'grid.col', context: 'col', order: 200,
  items: ({ cmd, open }): MenuItem[] => [
    { id: 'ic', label: RB.insertCols, icon: 'table_insert_column', onClick: () => cmd.insert('cols') },
    { id: 'dc', label: RB.delCols, icon: 'table_delete_column', onClick: () => cmd.remove('cols') },
    { id: 'cw', label: RB.colWidth, onClick: () => open({ kind: 'size', axis: 'col' }) },
    { id: 'hc', label: RB.hideCols, onClick: () => cmd.hide('col', true) },
    { id: 'sc', label: RB.showCols, onClick: () => cmd.hide('col', false) },
  ],
});
registerMenu({
  id: 'grid.row', context: 'row', order: 200,
  items: ({ cmd, open }): MenuItem[] => [
    { id: 'ir', label: RB.insertRows, icon: 'table_insert_row', onClick: () => cmd.insert('rows') },
    { id: 'dr', label: RB.delRows, icon: 'table_delete_row', onClick: () => cmd.remove('rows') },
    { id: 'rh', label: RB.rowHeight, onClick: () => open({ kind: 'size', axis: 'row' }) },
    { id: 'hr', label: RB.hideRows, onClick: () => cmd.hide('row', true) },
    { id: 'sr', label: RB.showRows, onClick: () => cmd.hide('row', false) },
  ],
});
registerMenu({
  id: 'grid.cells', context: CELLS, order: 200,
  items: ({ cmd, open }): MenuItem[] => [
    { id: 'insdlg', label: `${S.cellsDlg.insertTitle.replace(' des cellules', '')}…`, icon: 'table_insert_row', onClick: () => open({ kind: 'insertCells' }) },
    { id: 'deldlg', label: `${S.cellsDlg.deleteTitle.replace(' des cellules', '')}…`, icon: 'table_delete_row', onClick: () => open({ kind: 'deleteCells' }) },
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
  ],
});
registerMenu({
  id: 'grid.sort', context: CELLS, order: 300,
  items: ({ cmd, open }): MenuItem[] => [
    { id: 'filter', label: RB.filter, icon: 'filter', onClick: cmd.toggleFilter },
    { id: 'sort', label: RB.sortBtn, icon: 'arrow_sort', items: [
      { id: 'a', label: RB.sortAsc, onClick: () => cmd.sortQuick(false) },
      { id: 'd', label: RB.sortDesc, onClick: () => cmd.sortQuick(true) },
      { id: 'c', label: RB.customSort, onClick: () => open({ kind: 'sort' }) },
    ] },
  ],
});
registerMenu({
  id: 'grid.annotate', context: CELLS, order: 400,
  items: ({ open, comment, cmd }): MenuItem[] => [
    { id: 'cmt', label: RB.newComment, icon: 'comment_add', onClick: comment },
    { id: 'note', label: RB.newNote, icon: 'note', onClick: () => open({ kind: 'note' }) },
    { id: 'link', label: RB.link, icon: 'link', onClick: () => open({ kind: 'link' }) },
    { id: 'openlink', label: S.openLink, icon: 'link', disabled: !cmd.linkAt(), onClick: () => cmd.openLink() },
    { id: 'rmlink', label: S.removeLink, icon: 'delete', disabled: !cmd.linkAt(), onClick: () => cmd.removeLink() },
    { id: 'name', label: RB.defineName, icon: 'tag', onClick: () => open({ kind: 'names' }) },
  ],
});
registerMenu({
  id: 'grid.format', context: ['cell', 'row', 'col', 'corner'], order: 900,
  items: ({ open }): MenuItem[] => [
    { id: 'fmt', label: RB.formatCells, icon: 'table_cell_edit', shortcut: 'Ctrl+1', onClick: () => open({ kind: 'formatCells' }) },
  ],
});
