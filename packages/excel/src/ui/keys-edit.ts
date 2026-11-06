// Raccourcis d'edition, de fichier et de commandes (hors saisie) : annuler/retablir/repeter, enregistrer, imprimer, fermer, rechercher, recopier,
// inserer/supprimer, touches de fonction, noms, filtres, tableaux, copie de la cellule du dessus, effacer, saisie directe d'un caractere.
import { MAX_COLS, MAX_ROWS } from '@forgeoffice/xlsx';
import { findFrom, lastFind } from '../logic/find-next.ts';
import { activeRange, isFullCols, isFullRows } from '../logic/selection.ts';
import { S } from '../strings/index.ts';
import { dialogIds, registerShortcuts, type DialogState, type ShortcutDef } from './registry.ts';
import { repeatLast } from './keys-repeat.ts';
import { toggleFormulaBar } from './keys-zones.ts';
import { resetSelectionMode } from './keys-select.ts';
import type { GridKeyApi } from './keys-types.ts';

/**
 * Ctrl+Maj++ / Ctrl+- : lignes ou colonnes entieres = direct ; sinon la boite « Inserer/Supprimer des cellules » quand un lot l'a
 * enregistree (`insertCells` / `deleteCells`), a defaut le decalage vers le bas / le haut (choix par defaut d'Excel).
 */
function cellsAction(k: GridKeyApi, what: 'insert' | 'delete'): void {
  const r = activeRange(k.sel);
  const id = what === 'insert' ? 'insertCells' : 'deleteCells';
  if (r.c1 === 0 && r.c2 === MAX_COLS - 1 && isFullRows(r)) what === 'insert' ? k.cmd.insert('rows') : k.cmd.remove('rows');
  else if (r.r1 === 0 && r.r2 === MAX_ROWS - 1 && isFullCols(r)) what === 'insert' ? k.cmd.insert('cols') : k.cmd.remove('cols');
  else if (dialogIds().includes(id)) k.open({ kind: id } as unknown as DialogState);
  else if (what === 'insert') k.cmd.insert('cellsDown');
  else k.cmd.remove('cellsUp');
}

/** Ctrl+' / Ctrl+Maj+" : saisie dans la cellule active du contenu (formule ou valeur) de la cellule du dessus. */
function copyAbove(k: GridKeyApi, what: 'formula' | 'value'): void {
  const { row, col } = k.sel.active;
  if (row === 0) return;
  k.startEdit(k.cellText(row - 1, col, what));
}

/** F7 : la boite d'orthographe du lot Revision quand elle est enregistree (id `spelling`), sinon un message honnete. */
function spelling(k: GridKeyApi): void {
  if (dialogIds().includes('spelling')) k.open({ kind: 'spelling' } as unknown as DialogState);
  else k.notify(S.keys.noSpelling, 'info');
}

function findNext(k: GridKeyApi, backwards: boolean): void {
  const q = lastFind();
  if (!q) {
    k.notify(S.keys.noFindYet, 'info');
    k.open({ kind: 'find', replace: false });
    return;
  }
  const hit = findFrom(k.sheet, k.sel.active, q, backwards, (r, c) => k.cellText(r, c, q.inFormulas ? 'formula' : 'display'));
  if (!hit) k.notify(S.notFound, 'info');
  else k.setSel({ ranges: [{ r1: hit.row, c1: hit.col, r2: hit.row, c2: hit.col }], active: { row: hit.row, col: hit.col }, anchor: { row: hit.row, col: hit.col } });
}

registerShortcuts<'grid'>([
  // Priorite haute : Alt+= (somme automatique) passait avant toute autre touche. Alt+0 n'existe pas dans Excel (retire).
  { id: 'edit.autoSum.equal', context: 'grid', combo: '~Ctrl+~Shift+Alt+=', priority: 100, run: (k) => k.cmd.autoSum('SUM') },
  { id: 'edit.pasteSpecial', context: 'grid', combo: 'Ctrl+Alt+~Shift+v', run: (k) => k.open({ kind: 'pasteSpecial' }) },
  { id: 'edit.undo', context: 'grid', combo: 'Ctrl+~Alt+z', run: (k) => k.undo() },
  { id: 'edit.redo', context: 'grid', combo: 'Ctrl+Shift+~Alt+z', run: (k) => k.redo() },
  // Ctrl+Y : retablir, ou repeter la derniere action quand rien n'est a retablir ; F4 : repeter.
  { id: 'edit.redo.y', context: 'grid', combo: 'Ctrl+~Shift+~Alt+y', run: (k) => { if (k.canRedo || !repeatLast(k.cmd)) k.redo(); } },
  { id: 'edit.repeat', context: 'grid', combo: 'F4', run: (k) => { if (!repeatLast(k.cmd)) k.notify(S.keys.noRepeat, 'info'); } },
  { id: 'file.save', context: 'grid', combo: 'Ctrl+~Shift+~Alt+s', run: (k) => k.save() },
  { id: 'file.open', context: 'grid', combo: 'Ctrl+~Shift+~Alt+o', run: (k) => k.openFile() },
  { id: 'file.new', context: 'grid', combo: 'Ctrl+~Shift+~Alt+n', run: (k) => k.newFile() },
  { id: 'file.print', context: 'grid', combo: 'Ctrl+~Shift+~Alt+p', run: (k) => k.print() },
  { id: 'file.print.f12', context: 'grid', combo: 'Ctrl+Shift+F12', run: (k) => k.print() },
  { id: 'file.saveAs', context: 'grid', combo: 'F12', run: (k) => k.saveAs() },
  { id: 'file.close', context: 'grid', combo: 'Ctrl+F4', run: (k) => k.closeDoc() },
  { id: 'file.close.w', context: 'grid', combo: 'Ctrl+~Shift+~Alt+w', run: (k) => k.closeDoc() },
  { id: 'edit.fillDown', context: 'grid', combo: 'Ctrl+~Shift+~Alt+b', run: (k) => k.cmd.fill('down') },
  { id: 'edit.fillRight', context: 'grid', combo: 'Ctrl+~Shift+~Alt+d', run: (k) => k.cmd.fill('right') },
  { id: 'edit.flashFill', context: 'grid', combo: 'Ctrl+~Shift+~Alt+e', run: (k) => k.flashFill() },
  { id: 'edit.find', context: 'grid', combo: 'Ctrl+~Shift+~Alt+f', run: (k) => k.open({ kind: 'find', replace: false }) },
  { id: 'edit.find.shiftF5', context: 'grid', combo: 'Shift+F5', run: (k) => k.open({ kind: 'find', replace: false }) },
  { id: 'edit.findNext', context: 'grid', combo: 'Shift+F4', run: (k) => findNext(k, false) },
  { id: 'edit.findPrev', context: 'grid', combo: 'Ctrl+Shift+F4', run: (k) => findNext(k, true) },
  { id: 'edit.replace', context: 'grid', combo: 'Ctrl+~Shift+~Alt+h', run: (k) => k.open({ kind: 'find', replace: true }) },
  { id: 'edit.link', context: 'grid', combo: 'Ctrl+~Shift+~Alt+k', run: (k) => k.open({ kind: 'link' }) },
  { id: 'edit.filter', context: 'grid', combo: 'Ctrl+Shift+~Alt+l', run: (k) => k.cmd.toggleFilter() },
  { id: 'edit.filter.reapply', context: 'grid', combo: 'Ctrl+Alt+~Shift+l', priority: 10, run: (k) => k.cmd.reapplyFilter() },
  { id: 'edit.table', context: 'grid', combo: 'Ctrl+~Alt+l', run: (k) => k.open({ kind: 'createTable', style: 'TableStyleMedium2' }) },
  { id: 'edit.totalRow', context: 'grid', combo: 'Ctrl+Shift+~Alt+t', priority: 10, run: (k) => { if (!k.toggleTotalRow()) k.notify(S.keys.noTable, 'info'); } },
  { id: 'edit.stampDate', context: 'grid', combo: 'Ctrl+~Shift+~Alt+;', run: (k) => k.stamp('date') },
  { id: 'edit.stampTime', context: 'grid', combo: 'Ctrl+~Shift+~Alt+:', run: (k) => k.stamp('time') },
  // Ctrl+" (Ctrl+` en QWERTY) : afficher les formules ; Ctrl+Maj+" : copier la valeur du dessus.
  { id: 'edit.copyValueAbove', context: 'grid', combo: 'Ctrl+Shift+~Alt+"', priority: 10, run: (k) => copyAbove(k, 'value') },
  ...['"', '`', '²'].map((key): ShortcutDef<'grid'> => ({ id: `view.formulas.${key}`, context: 'grid', combo: `Ctrl+~Shift+~Alt+${key}`, run: (k) => k.toggleFormulas() })),
  { id: 'edit.copyFormulaAbove', context: 'grid', combo: "Ctrl+~Shift+~Alt+'", run: (k) => copyAbove(k, 'formula') },
  // Ctrl+Maj++ / Ctrl++ : inserer ; Ctrl+- : supprimer (cellules : boite ou decalage, lignes/colonnes entieres : direct).
  { id: 'edit.deleteCells', context: 'grid', combo: 'Ctrl+~Shift+~Alt+-', run: (k) => cellsAction(k, 'delete') },
  { id: 'edit.insertCells', context: 'grid', combo: 'Ctrl+~Shift+~Alt++', run: (k) => cellsAction(k, 'insert') },
  { id: 'edit.f2', context: 'grid', combo: 'F2', run: (k) => k.startEdit(null) },
  { id: 'edit.note', context: 'grid', combo: 'Shift+F2', run: (k) => k.open({ kind: 'note' }) },
  { id: 'edit.newComment', context: 'grid', combo: 'Ctrl+Shift+F2', run: (k) => k.open({ kind: 'newComment' }) },
  { id: 'edit.fnWizard', context: 'grid', combo: 'Shift+F3', run: (k) => k.open({ kind: 'fnWizard' }) },
  { id: 'edit.names', context: 'grid', combo: 'Ctrl+F3', run: (k) => k.open({ kind: 'names' }) },
  { id: 'edit.pasteName', context: 'grid', combo: 'F3', run: (k) => k.open({ kind: 'keysPasteName' }) },
  { id: 'edit.namesFromSelection', context: 'grid', combo: 'Ctrl+Shift+F3', run: (k) => k.open({ kind: 'keysNamesFromSelection' }) },
  // Calcul : F9 recalcule ; Maj+F9 la feuille, Ctrl+Alt+F9 tout, Ctrl+Alt+Maj+F9 apres reconstruction des dependances
  { id: 'edit.recalc', context: 'grid', combo: 'F9', run: (k) => k.recalc() },
  { id: 'edit.recalcSheet', context: 'grid', combo: 'Shift+F9', run: (k) => k.recalc('sheet') },
  { id: 'edit.recalcAll', context: 'grid', combo: 'Ctrl+Alt+~Shift+F9', run: (k) => k.recalc('all') },
  { id: 'edit.addSheet', context: 'grid', combo: 'Shift+F11', run: (k) => k.addSheet() },
  { id: 'edit.addSheet.f1', context: 'grid', combo: 'Alt+Shift+F1', run: (k) => k.addSheet() },
  // Alt+F1 : graphique integre (histogramme groupe) sur la selection.
  { id: 'edit.chart', context: 'grid', combo: 'Alt+F1', run: (k) => k.insertChart('col') },
  { id: 'edit.spelling', context: 'grid', combo: 'F7', run: spelling },
  { id: 'edit.chartSheet', context: 'grid', combo: 'F11', run: (k) => k.chartSheet() },
  { id: 'edit.expandBar', context: 'grid', combo: 'Ctrl+Shift+~Alt+u', priority: 10, run: () => toggleFormulaBar() },
  // Alt+Bas : menu du filtre, liste de validation ou liste des valeurs de la colonne.
  { id: 'edit.dropDown', context: 'grid', combo: 'Alt+ArrowDown', priority: 10, run: (k) => k.dropDown() },
  // Maj+F10 et touche Menu : menu contextuel de la cellule active.
  { id: 'edit.contextMenu', context: 'grid', combo: 'Shift+F10', run: (k) => k.contextMenu() },
  { id: 'edit.contextMenu.key', context: 'grid', combo: 'ContextMenu', run: (k) => k.contextMenu() },
  // Alt+Maj+Droite / Gauche : grouper / dissocier (colonnes entieres choisies, sinon lignes).
  { id: 'edit.group', context: 'grid', combo: 'Alt+Shift+ArrowRight', priority: 10, run: (k) => k.outline(isFullCols(activeRange(k.sel)) ? 'col' : 'row', 1) },
  { id: 'edit.ungroup', context: 'grid', combo: 'Alt+Shift+ArrowLeft', priority: 10, run: (k) => k.outline(isFullCols(activeRange(k.sel)) ? 'col' : 'row', -1) },
  { id: 'edit.delete', context: 'grid', combo: '~Ctrl+~Shift+~Alt+Delete', run: (k) => { if (!k.deleteDrawing()) k.cmd.clear('contents'); } },
  { id: 'edit.backspace', context: 'grid', combo: '~Alt+Backspace', run: (k) => k.startEdit('') },
  { id: 'edit.escape', context: 'grid', combo: '~Ctrl+~Shift+~Alt+Escape', run: (k) => k.escape() },
  // Dernier recours : tout caractere imprimable demarre la saisie dans la cellule.
  {
    id: 'edit.type', context: 'grid', priority: -100,
    test: (e) => !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && !(e.key === ' ' && e.shiftKey),
    run: (k, e) => {
      resetSelectionMode();
      k.startEdit(e.key);
    },
  },
]);
