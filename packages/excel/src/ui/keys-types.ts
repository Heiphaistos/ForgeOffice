// Types des raccourcis clavier : etat de saisie d'une cellule et API donnee aux raccourcis de chaque contexte.
import type { NoticeKind } from '@forgeoffice/core';
import type { CellRange, Sheet } from '@forgeoffice/xlsx';
import type { ChartKind } from '../logic/charts.ts';
import type { Selection } from '../logic/selection.ts';
import type { Commands } from './commands.ts';
import type { DialogState } from './registry.ts';

/** Saisie en cours dans une cellule ou la barre de formule. */
export interface Edit {
  sheet: number;
  row: number;
  col: number;
  text: string;
  caret: number;
  /** Entrer : les fleches valident ; Modifier : les fleches deplacent le curseur. */
  mode: 'enter' | 'edit';
  /** Reference inseree en mode Pointer (remplacee si l'on clique ailleurs). */
  point: { start: number; end: number } | null;
}

/** API des raccourcis de la grille (hors saisie). */
export interface GridKeyApi {
  sheet: Sheet;
  sel: Selection;
  setSel: (s: Selection) => void;
  cmd: Commands;
  startEdit: (text: string | null) => void;
  undo: () => void;
  redo: () => void;
  canRedo: boolean;
  save: () => void;
  saveAs: () => void;
  openFile: () => void;
  newFile: () => void;
  closeDoc: () => void;
  print: () => void;
  open: (d: DialogState) => void;
  switchSheet: (delta: 1 | -1) => void;
  addSheet: () => void;
  recalc: (scope?: 'sheet' | 'all') => void;
  toggleFormulas: () => void;
  escape: () => void;
  stamp: (kind: 'date' | 'time') => void;
  deleteDrawing: () => boolean;
  flashFill: () => void;
  pageRows: number;
  /** Colonnes d'un ecran (Alt+Page suiv. / Alt+Page prec.). */
  pageCols: number;
  notify: (message: string, kind?: NoticeKind) => void;
  /** Ctrl+Retour arriere : fait defiler la grille jusqu'a la cellule active. */
  reveal: () => void;
  /** Alt+Bas : menu de filtre de l'en-tete, liste de validation ou liste des valeurs de la colonne. */
  dropDown: () => void;
  /** Maj+F10 / touche Menu : menu contextuel de la cellule active. */
  contextMenu: () => void;
  outline: (axis: 'row' | 'col', delta: 1 | -1) => void;
  insertChart: (kind: ChartKind) => void;
  /** F11 : graphique sur une nouvelle feuille. */
  chartSheet: () => void;
  /** Ctrl+Maj+T : bascule la ligne Total du tableau sous la cellule active ; faux hors tableau. */
  toggleTotalRow: () => boolean;
  /** Texte d'une cellule : formule (ou contenu saisi) ou valeur calculee ; Ctrl+' et Ctrl+Maj+". */
  cellText: (row: number, col: number, what: 'formula' | 'value' | 'display') => string;
}

/** API des raccourcis pendant la saisie d'une cellule. */
export interface EntryKeyApi {
  edit: Edit;
  /** Feuille affichee. */
  si: number;
  /** Mode Pointer : les fleches choisissent une reference. */
  pointing: boolean;
  /** Valide la saisie et deplace la selection (dr, dc) ; `fillAll` = Ctrl+Entree (toute la selection) ; `asArray` = Ctrl+Maj+Entree (formule matricielle sur la selection). */
  commit: (dr: number, dc: number, fillAll?: boolean, asArray?: boolean) => boolean;
  open: (d: DialogState) => void;
  cancel: () => void;
  /** F4 : $A$1 -> A$1 -> $A1 -> A1. */
  cycleAbsolute: () => void;
  setEdit: (e: Edit) => void;
  onPoint: (range: CellRange) => void;
  /** Zone de texte qui a recu la touche (position du curseur pour Alt+Entree). */
  textarea: HTMLTextAreaElement | null;
}
