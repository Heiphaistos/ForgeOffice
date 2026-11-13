// Contrat entre l'application, le ruban, les volets et les dialogues.
import type { Schema } from 'prosemirror-model';
import type { Command, EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { NoticeKind, Services } from '@forgeoffice/core';
import type { CaretPrefs } from '@forgeoffice/ui';
import type { BorderStyle, Section, WordDocument, WritableFormat } from '@forgeoffice/docx';
import type { ListSpec } from '../features/lists.ts';
import type { Csv } from '../features/merge.ts';
import type { TocOptions } from '../features/toc.ts';
import type { SelectionInfo } from './selection.ts';

export type ViewMode = 'print' | 'read' | 'web' | 'outline' | 'draft';
export type Markup = 'all' | 'simple' | 'none' | 'original';
export type RightPane = 'comments' | 'notes' | 'styles' | 'stats' | 'revisions' | 'selection' | 'speech' | null;

export type DialogId =
  | 'font' | 'paragraph' | 'find' | 'table' | 'link' | 'bookmark' | 'crossref' | 'symbol' | 'equation' | 'date' | 'watermark'
  | 'pageSetup' | 'stats' | 'caption' | 'citation' | 'index' | 'style' | 'goto' | 'pasteSpecial' | 'alt'
  | 'pageBorder' | 'pageSetupAll' | 'sort' | 'ink' | 'spelling' | 'field' | 'tableProps' | 'textToTable' | 'tabs' | 'zoom' | 'toc' | 'styleEdit' | 'borders' | 'lineNumbers' | 'shapeText' | 'notesFormat' | 'listDefine' | 'protect' | 'trackOptions';

export interface UiState {
  view: ViewMode;
  zoom: number;
  ruler: boolean;
  grid: boolean;
  nav: boolean;
  showMarks: boolean;
  focus: boolean;
  multiPage: boolean;
  markup: Markup;
  pane: RightPane;
  spell: boolean;
  readingTimer: boolean;
  typewriter: boolean;
  /** Mode Plan : niveaux affiches (1..9, 10 = tout). */
  outlineLevel: number;
  /** Apercu des resultats du publipostage (index de l'enregistrement) ou -1. */
  mergeRecord: number;
  /** Document marque comme final (lecture seule). */
  readOnly: boolean;
  /** Stylet de l'onglet Dessin. */
  pen: Pen;
  /** Point d'insertion : epaisseur, couleur, clignotement. */
  caret: CaretPrefs;
  /** Mini-barre de mise en forme pres de la selection. */
  miniBar: boolean;
  borderPen: BorderPen;
  /** Style en cours de modification (boite Modifier le style). */
  styleEdit: string | null;
  /** Couleurs et style d'affichage des modifications suivies. */
  trackOpts: TrackOptions;
  /** Indicateurs masques de la barre d'etat. */
  statusHidden: string[];
}

export interface TrackOptions {
  insColor: string;
  delColor: string;
  insStyle: 'underline' | 'double' | 'bold' | 'none';
}

/** Trait des bordures de tableau (onglet Creation de tableau). */
export interface BorderPen {
  style: BorderStyle;
  width: number;
  /** Hexa avec # ou auto. */
  color: string;
}

export interface Pen {
  color: string;
  width: number;
  highlighter: boolean;
}

export const INITIAL_UI: UiState = {
  view: 'print', zoom: 100, ruler: true, grid: false, nav: false, showMarks: false, focus: false, multiPage: false, markup: 'all',
  pane: null, spell: true, readingTimer: false, typewriter: false, outlineLevel: 10, mergeRecord: -1, readOnly: false,
  pen: { color: '#000000', width: 2, highlighter: false }, caret: { width: 2, color: 'auto', blink: true }, miniBar: true,
  borderPen: { style: 'single', width: 0.5, color: 'auto' }, styleEdit: null,
  trackOpts: { insColor: '#B10E1C', delColor: '#B10E1C', insStyle: 'underline' }, statusHidden: [],
};

export interface Actions {
  save(): Promise<void>;
  saveAs(format?: WritableFormat, name?: string): Promise<void>;
  open(): Promise<void>;
  newDocument(templateId: string): Promise<void>;
  print(): void;
  exportFile(format: WritableFormat): Promise<void>;
  close(): Promise<void>;
  cut(): void;
  copy(): void;
  paste(mode: 'keep' | 'text'): Promise<void>;
  formatPainter(sticky: boolean): void;
  insertImage(): Promise<void>;
  insertComment(): void;
  insertNote(kind: 'footnote' | 'endnote'): void;
  insertToc(opts?: TocOptions): void;
  updateToc(): void;
  removeToc(): void;
  list(spec: ListSpec | null): void;
  restartNumbering(): void;
  /** Modifie la section du curseur (ou toutes les sections si scope = document). */
  setSection(patch: Partial<Section>, scope?: 'section' | 'document'): void;
  /** Type de debut de la section du curseur (nouvelle page, continu, page paire, page impaire) sans inserer de saut. */
  setSectionStart(type: Section['breakType']): void;
  insertCover(): void;
  editHeaderFooter(kind: 'header' | 'footer', preset?: string): void;
  removeHeaderFooter(kind: 'header' | 'footer'): void;
  pageNumbers(where: 'header' | 'footer', align: 'left' | 'center' | 'right', ofTotal?: boolean): void;
  insertField(code: string): void;
  updateFields(): void;
  loadCsv(): Promise<void>;
  setMergeRecord(index: number): void;
  finishMerge(): void;
  insertMergeField(name: string): void;
  review(decision: 'accept' | 'reject', all: boolean): void;
  gotoChange(dir: 1 | -1): void;
  gotoComment(dir: 1 | -1): void;
  setTrack(on: boolean): void;
  compareWith(): Promise<void>;
  setPreviewStyle(id: string | null): void;
  applyStyle(id: string): void;
  createStyle(name: string): void;
  insertTable(rows: number, cols: number): void;
  insertBlankPage(): void;
  gotoPage(page: number): void;
  gotoPos(pos: number): void;
  findText(text: string): void;
}

export interface Ctl {
  services: Services;
  schema: Schema;
  meta: WordDocument;
  sel: SelectionInfo;
  ui: UiState;
  pageCount: number;
  /** Section du curseur et nombre de sections du document. */
  section: Section;
  sectionCount: number;
  /** Rang (0..n-1) de la section du curseur. */
  sectionIndex: number;
  author: string;
  csv: Csv | null;
  setUi(patch: Partial<UiState>): void;
  /** Modifie le modele hors corps (styles, sections, notes...). Marque le document modifie. */
  updateMeta(fn: (m: WordDocument) => WordDocument): void;
  run(cmd: Command): boolean;
  state(): EditorState | null;
  view(): EditorView | null;
  openDialog(id: DialogId): void;
  notify(message: string, kind?: NoticeKind): void;
  act: Actions;
}
