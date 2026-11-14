// Etat des documents du Bloc-notes, hors React : onglets, etats CodeMirror, vue scindee, enregistrement, session.
import type { LanguageSupport } from '@codemirror/language';
import { undo, redo } from '@codemirror/commands';
import type { SearchQuery } from '@codemirror/search';
import { Annotation, EditorState, type Transaction } from '@codemirror/state';
import { EditorView, keymap, type ViewUpdate } from '@codemirror/view';
import { MODULES, type FileFilter, type FileInfo, type NoticeKind, type OpenedFile, type Services } from '@forgeoffice/core';
import { diskSignature, externalChange } from './logic/disk.ts';
import { MAX_FILE_BYTES, canEncode, pinnedEncoding, decodeFile, encodeFile, type Eol, type TextEncoding } from './logic/encoding.ts';
import { diffRange, parseKv, setProp } from './logic/props.ts';
import { RECOVERY_KEY, claimRecovery, parseRecovery, snapshot, type RecoveredDoc } from './logic/recovery.ts';
import { FolderOps } from './folderops.ts';
import type { FolderFs } from './folderfs.ts';
import type { FolderFile } from './logic/folder.ts';
import type { LinkTarget } from './logic/links.ts';
import type { NotesPrefs } from './logic/prefs.ts';
import {
  ALIVE_KEY, SESSION_KEY, claimSession, keepText, parseAlive, parseStore, touchAlive, upsertWindow, type SessionTab, type WindowSession,
} from './logic/session.ts';
import { editorExtensions, reconfigure, type EditorHooks, type EditorSettings } from './editor/extensions.ts';
import { languageByName, languageForFile } from './editor/languages.ts';
import { allReplacements } from './editor/replace.ts';
import { SearchHistory } from './logic/find.ts';
import { indentStyle } from './logic/indent.ts';
import { DAILY_TEMPLATE, dailyNote } from './logic/daily.ts';
import { parseSteps, recordStep, runMacro, type MacroStep } from './editor/macros.ts';
import { changeEffects } from './editor/visual.ts';
import { clampMove, pinTarget } from './logic/tabs.ts';
import { S } from './strings.ts';

export interface Tab {
  id: string;
  name: string;
  path: string | null;
  origin: string | null;
  encoding: TextEncoding;
  eol: Eol;
  /** Langage choisi a la main (nom ou « Texte brut ») ; null = d'apres le nom du fichier. */
  lang: string | null;
  dirty: boolean;
  readOnly: boolean;
  /** Onglet épinglé : à gauche, sans bouton de fermeture, épargné par les fermetures groupées. */
  pinned: boolean;
  /** Empreinte du fichier tel que lu ou enregistre en dernier (null : jamais lu du disque). */
  disk: string | null;
  /** Date et taille vues au dernier controle (`services.fileInfo`) : inchangees = pas de relecture. */
  info: string | null;
  /** Suivi de fin de fichier (tail -f) : le texte est relu des qu'il change sur le disque et la vue va a la fin. */
  follow: boolean;
}

export interface TabInit {
  name: string;
  text: string;
  path?: string | null;
  origin?: string | null;
  encoding?: TextEncoding;
  eol?: Eol;
  lang?: string | null;
  dirty?: boolean;
  readOnly?: boolean;
  pinned?: boolean;
  cursor?: number;
  disk?: string | null;
}

export interface CursorInfo {
  line: number;
  col: number;
  selChars: number;
  ranges: number;
  chars: number;
  /** Change a chaque modification du texte (apercu, plan, retroliens). */
  docVersion: number;
}

export interface Folder {
  name: string;
  files: FolderFile[];
  /** Sous-dossiers, y compris vides (absents : deduits des fichiers). */
  dirs?: string[];
  /** Acces en ecriture ; absent : dossier en lecture seule. */
  fs?: FolderFs | null;
}

/** Au-dela, le controle periodique est saute (relire un tel fichier toutes les 1,5 s coute trop) ; le retour dans la fenetre le controle encore. */
const POLL_MAX_CHARS = 8_000_000;
const MACRO_KEY = 'notes.macro';
const FIND_HISTORY_KEY = 'notes.findHistory';
const sync = Annotation.define<boolean>();
/** Changement qui ne rend pas le document « modifie » (rechargement depuis le disque). */
const quiet = Annotation.define<boolean>();

export const FILTERS = (platform: Services['platform']): FileFilter[] => [
  { name: S.filterText, extensions: MODULES.notes.extensions },
  ...(platform === 'web' ? [] : [{ name: S.filterAll, extensions: ['*'] }]),
];

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class Workspace {
  tabs: Tab[] = [];
  activeId = '';
  folder: Folder | null = null;
  cursor: CursorInfo = { line: 1, col: 1, selChars: 0, ranges: 1, chars: 0, docVersion: 0 };
  view: EditorView | null = null;
  view2: EditorView | null = null;
  onOpenLink: (link: LinkTarget) => void = () => undefined;
  onZoom: (delta: number) => void = () => undefined;
  /** Demande quoi faire quand l'encodage perd des caracteres (l'application affiche un dialogue). Sans reponse : on enregistre avec un avertissement. */
  confirmLossy: ((name: string, encoding: TextEncoding) => Promise<'utf8' | 'force' | 'cancel'>) | null = null;
  private prefs: NotesPrefs;
  private version = 0;
  private seq = 0;
  private docVersion = 0;
  private lastSession = '';
  private lastRecovery = '';
  private readonly services: Services;
  private readonly win: string;
  private readonly states = new Map<string, EditorState>();
  private readonly closed: { init: TabInit }[] = [];
  private readonly langs = new Map<string, LanguageSupport>();
  private readonly listeners = new Set<() => void>();
  private readonly cursorListeners = new Set<() => void>();
  private readonly hooks: EditorHooks;
  private readonly findHistory: SearchHistory;
  readonly folderOps: FolderOps = new FolderOps(this);
  /** Macro : etapes en cours d'enregistrement et derniere macro terminee (gardee entre deux sessions). */
  macro: { recording: boolean; current: MacroStep[]; last: MacroStep[] } = { recording: false, current: [], last: [] };

  constructor(services: Services, prefs: NotesPrefs) {
    this.services = services;
    this.prefs = prefs;
    this.findHistory = new SearchHistory(services.settings.get<unknown>(FIND_HISTORY_KEY, []) as string[], (list) => services.settings.set(FIND_HISTORY_KEY, list));
    this.macro.last = parseSteps(services.settings.get<unknown>(MACRO_KEY, []));
    this.win = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    this.hooks = {
      onUpdate: (u) => this.onViewUpdate(u),
      onOpenLink: (l) => this.onOpenLink(l),
      onZoom: (d) => this.onZoom(d),
      find: {
        history: this.findHistory,
        replaceAllTabs: (q) => this.replaceInAllTabs(q),
        notify: (m) => this.services.notify(m, 'info'),
      },
    };
  }

  /** Remplace dans tous les onglets modifiables (onglet actif par la vue, les autres par leur etat). */
  replaceInAllTabs(query: SearchQuery): { count: number; tabs: number } {
    let count = 0;
    let tabs = 0;
    for (const tab of this.tabs) {
      const state = this.stateOf(tab.id);
      if (!state || tab.readOnly) continue;
      const changes = allReplacements(state, query);
      if (changes.length === 0) continue;
      count += changes.length;
      tabs++;
      if (tab.id === this.activeId && this.view) this.view.dispatch({ changes, userEvent: 'input.replace.all' });
      else {
        this.states.set(tab.id, state.update({ changes }).state);
        this.patch(tab.id, { dirty: true });
      }
    }
    return { count, tabs };
  }

  // --- Abonnements (useSyncExternalStore) ---

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = (): number => this.version;
  subscribeCursor = (fn: () => void): (() => void) => {
    this.cursorListeners.add(fn);
    return () => this.cursorListeners.delete(fn);
  };
  getCursor = (): CursorInfo => this.cursor;

  private bump(): void {
    this.version++;
    for (const fn of this.listeners) fn();
    const dirty = this.tabs.some((t) => t.dirty);
    this.services.setModified(dirty);
  }

  // --- Onglets ---

  get active(): Tab | null {
    return this.tabs.find((t) => t.id === this.activeId) ?? null;
  }

  tab(id: string): Tab | null {
    return this.tabs.find((t) => t.id === id) ?? null;
  }

  /** Texte courant d'un onglet (vue principale pour l'onglet actif). */
  text(id: string): string {
    if (id === this.activeId && this.view) return this.view.state.doc.toString();
    return this.states.get(id)?.doc.toString() ?? '';
  }

  stateOf(id: string): EditorState | null {
    if (id === this.activeId && this.view) return this.view.state;
    return this.states.get(id) ?? null;
  }

  languageName(tab: Tab): string {
    if (tab.lang) return tab.lang;
    return languageForFile(tab.name)?.name ?? S.plainText;
  }

  private settingsFor(tab: Tab): EditorSettings {
    const name = this.languageName(tab);
    return { prefs: this.prefs, readOnly: tab.readOnly, language: this.langs.get(name) ?? null, eol: tab.eol, indent: indentStyle(this.prefs.indent, name, this.prefs.tabSize) };
  }

  private createState(tab: Tab, text: string, cursor = 0): EditorState {
    const state = EditorState.create({ doc: text, extensions: editorExtensions(this.settingsFor(tab), this.hooks, true) });
    const pos = Math.min(cursor, state.doc.length);
    return pos ? state.update({ selection: { anchor: pos } }).state : state;
  }

  /** Charge la coloration du langage puis l'applique a l'onglet. */
  private loadLanguage(tab: Tab): void {
    const name = this.languageName(tab);
    if (this.langs.has(name)) return;
    const desc = name === S.plainText ? null : (languageByName(name) ?? languageForFile(tab.name));
    if (!desc) return;
    desc.load().then(
      (support) => {
        this.langs.set(name, support);
        for (const t of this.tabs) if (this.languageName(t) === name) this.refreshConfig(t.id);
      },
      (err: unknown) => this.services.notify(errorText(err), 'warning'),
    );
  }

  /** Reapplique les reglages (langage, lecture seule, preferences) a un onglet. */
  refreshConfig(id: string): void {
    const tab = this.tab(id);
    if (!tab) return;
    const effects = reconfigure(this.settingsFor(tab));
    if (id === this.activeId && this.view) {
      this.view.dispatch({ effects });
      this.view2?.dispatch({ effects: reconfigure({ ...this.settingsFor(tab) }) });
    } else {
      const st = this.states.get(id);
      if (st) this.states.set(id, st.update({ effects }).state);
    }
  }

  setPrefs(prefs: NotesPrefs): void {
    this.prefs = prefs;
    if (this.active) this.refreshConfig(this.activeId);
  }

  private nextUntitled(): string {
    const used = new Set(this.tabs.map((t) => t.name));
    for (let i = 1; ; i++) {
      const name = `${S.untitled} ${i}`;
      if (!used.has(name)) return name;
    }
  }

  add(init: TabInit, activate = true): string {
    const id = `t${++this.seq}`;
    const tab: Tab = {
      id,
      name: init.name,
      path: init.path ?? null,
      origin: init.origin ?? null,
      encoding: init.encoding ?? 'utf-8',
      eol: init.eol ?? 'crlf',
      lang: init.lang ?? null,
      dirty: init.dirty ?? false,
      readOnly: init.readOnly ?? false,
      pinned: init.pinned ?? false,
      disk: init.disk ?? null,
      follow: false,
      info: null,
    };
    this.tabs = [...this.tabs, tab];
    this.states.set(id, this.createState(tab, init.text, init.cursor));
    this.loadLanguage(tab);
    if (activate) this.activate(id);
    else this.bump();
    return id;
  }

  newTab(): string {
    return this.add({ name: this.nextUntitled(), text: '' });
  }

  activate(id: string): void {
    const tab = this.tab(id);
    if (!tab) return;
    const view = this.view;
    if (view && this.activeId && this.activeId !== id && this.tab(this.activeId)) this.states.set(this.activeId, view.state);
    this.activeId = id;
    const state = this.states.get(id);
    if (view && state) {
      view.setState(state);
      view.dispatch({ effects: reconfigure(this.settingsFor(tab)) });
      this.resetSecondary();
    }
    this.updateCursor();
    this.bump();
    this.services.setTitle(`${tab.dirty ? '*' : ''}${tab.name} - ${MODULES.notes.name}`);
  }

  move(id: string, toIndex: number): void {
    toIndex = clampMove(this.tabs, id, toIndex);
    const from = this.tabs.findIndex((t) => t.id === id);
    if (from < 0) return;
    const list = [...this.tabs];
    const [tab] = list.splice(from, 1);
    if (!tab) return;
    list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, tab);
    this.tabs = list;
    this.bump();
  }

  /** Épingle ou désépingle un onglet (il rejoint la fin du bloc épinglé). */
  setPinned(id: string, pinned: boolean): void {
    this.patch(id, { pinned });
    this.move(id, pinTarget(this.tabs, id));
  }

  /** Ferme sans confirmation (l'interface demande avant). Garde de quoi rouvrir. */
  close(id: string): void {
    const tab = this.tab(id);
    if (!tab) return;
    const state = this.stateOf(id);
    this.closed.push({ init: { ...tab, text: state?.doc.toString() ?? '', cursor: state?.selection.main.head ?? 0 } });
    if (this.closed.length > 30) this.closed.shift();
    const index = this.tabs.findIndex((t) => t.id === id);
    this.tabs = this.tabs.filter((t) => t.id !== id);
    this.states.delete(id);
    if (this.activeId === id) {
      this.activeId = '';
      const next = this.tabs[Math.min(index, this.tabs.length - 1)];
      if (next) this.activate(next.id);
      else this.newTab();
    } else this.bump();
  }

  canReopen(): boolean {
    return this.closed.length > 0;
  }

  reopenClosed(): void {
    const last = this.closed.pop();
    if (last) this.add(last.init);
  }

  patch(id: string, change: Partial<Omit<Tab, 'id'>>): void {
    const before = this.tab(id);
    if (!before) return;
    const after = { ...before, ...change };
    this.tabs = this.tabs.map((t) => (t.id === id ? after : t));
    if (change.lang !== undefined || change.name !== undefined || change.readOnly !== undefined || change.eol !== undefined) {
      this.loadLanguage(after);
      this.refreshConfig(id);
    }
    this.bump();
    if (id === this.activeId) this.services.setTitle(`${after.dirty ? '*' : ''}${after.name} - ${MODULES.notes.name}`);
  }

  /** Remplace tout le texte d'un onglet (rechargement). */
  replaceText(id: string, text: string): void {
    if (id === this.activeId && this.view) {
      this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text }, annotations: quiet.of(true), effects: changeEffects.cleared() });
    } else {
      const st = this.states.get(id);
      if (st) this.states.set(id, st.update({ changes: { from: 0, to: st.doc.length, insert: text }, effects: changeEffects.cleared() }).state);
    }
  }

  // --- Macros, note du jour ---

  /** Demarre l'enregistrement, ou l'arrete et garde la macro (vide : l'ancienne reste). Renvoie le nombre d'etapes gardees (null au demarrage). */
  toggleMacro(): number | null {
    if (!this.macro.recording) {
      this.macro = { ...this.macro, recording: true, current: [] };
      this.bump();
      return null;
    }
    const steps = this.macro.current;
    this.macro = { recording: false, current: [], last: steps.length ? steps : this.macro.last };
    if (steps.length) this.services.settings.set(MACRO_KEY, steps);
    this.bump();
    return steps.length;
  }

  /** Rejoue la macro (N fois, ou jusqu'a la fin du document). Faux : pas de macro ou editeur indisponible. */
  playMacro(times: number | 'end'): boolean {
    const view = this.view;
    if (!view || view.state.readOnly || this.macro.last.length === 0) return false;
    const trs = runMacro(view.state, this.macro.last, times);
    if (trs.length) view.dispatch(trs);
    return true;
  }

  /** Ouvre (ou cree) la note AAAA-MM-JJ.md ; le modele `modele-quotidien.md` du dossier ouvert sert de depart. */
  openDailyNote(date: Date = new Date()): { id: string; created: boolean; name: string } {
    const template = this.folder?.files.find((f) => f.rel === DAILY_TEMPLATE)?.text ?? null;
    const note = dailyNote(date, template);
    const open = this.tabs.find((t) => t.name === note.name || t.origin === note.name);
    if (open) {
      this.activate(open.id);
      return { id: open.id, created: false, name: note.name };
    }
    if (this.folder?.files.some((f) => f.rel === note.name)) return { id: this.openFolderFile(note.name) ?? '', created: false, name: note.name };
    return { id: this.add({ name: note.name, text: note.text, dirty: true, eol: 'lf' }), created: true, name: note.name };
  }

  /** Envoie des effets a l'etat d'un onglet (affiche ou non). */
  private applyEffects(id: string, effects: Parameters<EditorView['dispatch']>[0]['effects']): void {
    if (id === this.activeId && this.view) this.view.dispatch({ effects });
    else {
      const st = this.states.get(id);
      if (st) this.states.set(id, st.update({ effects }).state);
    }
  }

  // --- Vues CodeMirror ---

  attach(parent: HTMLElement): EditorView {
    const tab = this.active;
    const state = (tab && this.states.get(tab.id)) ?? EditorState.create({ doc: '' });
    this.view = new EditorView({
      state,
      parent,
      dispatchTransactions: (trs, view) => {
        view.update(trs);
        this.forward(trs, this.view2);
      },
    });
    if (tab) this.view.dispatch({ effects: reconfigure(this.settingsFor(tab)) });
    this.updateCursor();
    return this.view;
  }

  detach(): void {
    if (this.view && this.active) this.states.set(this.activeId, this.view.state);
    this.view?.destroy();
    this.view = null;
  }

  private forward(trs: readonly Transaction[], target: EditorView | null): void {
    if (!target) return;
    for (const tr of trs) {
      if (tr.changes.empty || tr.annotation(sync)) continue;
      target.dispatch({ changes: tr.changes, annotations: sync.of(true) });
    }
  }

  private secondaryState(): EditorState {
    const tab = this.active;
    const main = this.view;
    const settings = tab ? this.settingsFor(tab) : { prefs: this.prefs, readOnly: false, language: null, eol: 'lf' as const, indent: indentStyle(this.prefs.indent, S.plainText, this.prefs.tabSize) };
    const mainView = (): EditorView | null => this.view;
    return EditorState.create({
      doc: main?.state.doc ?? '',
      extensions: [
        keymap.of([
          { key: 'Mod-z', run: () => { const v = mainView(); return v ? undo(v) : false; } },
          { key: 'Mod-y', run: () => { const v = mainView(); return v ? redo(v) : false; } },
          { key: 'Mod-Shift-z', run: () => { const v = mainView(); return v ? redo(v) : false; } },
        ]),
        editorExtensions(settings, { onUpdate: () => undefined, onOpenLink: this.hooks.onOpenLink, onZoom: this.hooks.onZoom }, false),
      ],
    });
  }

  /** Deuxieme vue du meme document (vue scindee). */
  attachSecondary(parent: HTMLElement): void {
    this.view2 = new EditorView({
      state: this.secondaryState(),
      parent,
      dispatchTransactions: (trs, view) => {
        view.update(trs);
        this.forward(trs, this.view);
      },
    });
  }

  detachSecondary(): void {
    this.view2?.destroy();
    this.view2 = null;
  }

  private resetSecondary(): void {
    this.view2?.setState(this.secondaryState());
  }

  private onViewUpdate(u: ViewUpdate): void {
    if (this.macro.recording && (u.docChanged || u.selectionSet)) {
      for (const tr of u.transactions) {
        const step = recordStep(tr);
        if (step) this.macro.current.push(step);
      }
    }
    if (u.docChanged) {
      this.docVersion++;
      const tab = this.active;
      if (tab && !tab.dirty && !u.transactions.some((tr) => tr.annotation(quiet))) this.patch(tab.id, { dirty: true });
    }
    if (u.docChanged || u.selectionSet) this.updateCursor();
  }

  private updateCursor(): void {
    const view = this.view;
    if (!view) return;
    const { state } = view;
    const head = state.selection.main.head;
    const line = state.doc.lineAt(head);
    let col = 1;
    for (let i = line.from; i < head; i++) col += state.doc.sliceString(i, i + 1) === '\t' ? state.tabSize - ((col - 1) % state.tabSize) : 1;
    const selChars = state.selection.ranges.reduce((sum, r) => sum + (r.to - r.from), 0);
    this.cursor = { line: line.number, col, selChars, ranges: state.selection.ranges.length, chars: state.doc.length, docVersion: this.docVersion };
    for (const fn of this.cursorListeners) fn();
  }

  // --- Fichiers ---

  /** Ouvre un fichier lu (dialogue, recents, glisser-deposer, ligne de commande). */
  openFile(file: OpenedFile, origin: string | null = null): void {
    if (file.bytes.length > MAX_FILE_BYTES) {
      this.services.notify(S.notices.tooLarge(file.name), 'error');
      return;
    }
    const existing = this.tabs.find((t) => (file.path && t.path === file.path) || (origin && t.origin === origin));
    if (existing) {
      this.activate(existing.id);
      return;
    }
    const decoded = decodeFile(file.bytes);
    if (decoded.binary) this.services.notify(S.notices.binary(file.name), 'warning');
    // Un onglet vierge jamais touche est remplace (comme le Bloc-notes).
    const blank = this.active;
    const replace = blank && !blank.path && !blank.dirty && !blank.origin && this.text(blank.id) === '' && this.tabs.length === 1;
    this.add({ name: file.name, path: file.path, origin, text: decoded.text, encoding: decoded.encoding, eol: decoded.eol, readOnly: decoded.binary, disk: file.path ? diskSignature(file.bytes) : null });
    if (replace && blank) {
      this.tabs = this.tabs.filter((t) => t.id !== blank.id);
      this.states.delete(blank.id);
      this.bump();
    }
    if (file.path) this.services.addRecent({ app: 'notes', name: file.name, path: file.path }).catch(() => undefined);
  }

  setFolder(folder: Folder | null): void {
    this.folder = folder;
    this.folderOps.selected = null;
    this.bump();
  }

  /** Previent les abonnes (explorateur) d'un changement qui ne passe pas par un onglet. */
  touch(): void {
    this.bump();
  }

  notify(message: string, kind: NoticeKind = 'info'): void {
    this.services.notify(message, kind);
  }

  /** Ouvre un fichier du dossier (deja decode) ou bascule sur son onglet. */
  openFolderFile(rel: string): string | null {
    const existing = this.tabs.find((t) => t.origin === rel);
    if (existing) {
      this.activate(existing.id);
      return existing.id;
    }
    const f = this.folder?.files.find((x) => x.rel === rel);
    if (!f) return null;
    return this.add({ name: rel.split('/').pop() ?? rel, origin: rel, text: f.text, encoding: f.encoding, eol: f.eol ?? 'lf' });
  }

  async openDialog(): Promise<void> {
    const file = await this.services.openFile(FILTERS(this.services.platform));
    if (file) this.openFile(file);
  }

  async openPath(path: string, name: string): Promise<void> {
    if (this.services.platform === 'web') {
      this.services.notify(S.notices.reopenWeb, 'warning');
      return;
    }
    try {
      this.openFile(await this.services.readFile(path));
    } catch (err) {
      this.services.notify(S.notices.openFailed(name, errorText(err)), 'error');
    }
  }

  /** Enregistre ; renvoie false si annule ou en echec. */
  async save(id: string, saveAs = false, encoding?: TextEncoding, eol?: Eol): Promise<boolean> {
    const tab = this.tab(id);
    if (!tab) return false;
    const text = this.text(id);
    let enc = encoding ?? tab.encoding;
    const end = eol ?? tab.eol;
    if (!canEncode(text, enc)) {
      const answer = this.confirmLossy ? await this.confirmLossy(tab.name, enc) : 'force';
      if (answer === 'cancel') return false;
      if (answer === 'utf8') enc = 'utf-8';
      else this.services.notify(S.notices.lossy(S.encodings[enc]), 'warning');
    }
    if (!saveAs && tab.origin && this.folder?.fs) return this.saveInFolder(id, tab.origin, text, enc, end);
    const suggested = /\.[^./\\]+$/.test(tab.name) ? tab.name : `${tab.name}.txt`;
    try {
      const bytes = encodeFile(text, enc, end);
      const saved = await this.services.saveFile(bytes, suggested, FILTERS(this.services.platform), saveAs ? null : tab.path);
      if (!saved) return false;
      const path = saved.path ?? tab.path;
      this.patch(id, { name: saved.name, path, encoding: enc, eol: end, dirty: false, disk: path ? diskSignature(bytes) : null });
      this.applyEffects(id, changeEffects.saved());
      this.services.addRecent({ app: 'notes', name: saved.name, path: saved.path ?? saved.name }).catch(() => undefined);
      return true;
    } catch (err) {
      this.services.notify(S.notices.saveFailed(tab.name, errorText(err)), 'error');
      return false;
    }
  }

  /** « Enregistrer une copie » : ecrit le texte dans un autre fichier sans changer le nom, le chemin ni l'etat « modifie » de l'onglet. */
  async saveCopy(id: string): Promise<boolean> {
    const tab = this.tab(id);
    if (!tab) return false;
    const text = this.text(id);
    const enc = canEncode(text, tab.encoding) ? tab.encoding : 'utf-8';
    if (enc !== tab.encoding) this.services.notify(S.notices.copyUtf8, 'warning');
    const base = tab.name.replace(/\.[^./\\]+$/, '');
    const ext = tab.name.match(/\.[^./\\]+$/)?.[0] ?? '.txt';
    try {
      const saved = await this.services.saveFile(encodeFile(text, enc, tab.eol), `${base} - copie${ext}`, FILTERS(this.services.platform), null);
      if (saved) this.services.notify(S.notices.copySaved(saved.path ?? saved.name), 'success');
      return saved !== null;
    } catch (err) {
      this.services.notify(S.notices.copyFailed2(errorText(err)), 'error');
      return false;
    }
  }

  /** Pose « cle: valeur » dans l'en-tete YAML de l'onglet actif (valeur vide : retire la propriete) ; un seul pas d'annulation. */
  setProperty(kv: string): boolean {
    const parsed = parseKv(kv);
    const tab = this.active;
    if (!parsed || !tab || tab.readOnly) return false;
    const old = this.text(tab.id);
    const d = diffRange(old, setProp(old, parsed[0], parsed[1]));
    if (d.from === d.to && d.insert === '') return true;
    const changes = { from: d.from, to: d.to, insert: d.insert };
    const st = this.states.get(tab.id);
    if (this.view) this.view.dispatch({ changes });
    else if (st) {
      this.states.set(tab.id, st.update({ changes }).state);
      this.patch(tab.id, { dirty: true });
    }
    return true;
  }

  /** Enregistre un fichier du dossier ouvert (acces en ecriture) a sa place, sans passer par « Enregistrer sous ». */
  private async saveInFolder(id: string, rel: string, text: string, encoding: TextEncoding, eol: Eol): Promise<boolean> {
    const folder = this.folder;
    const bytes = encodeFile(text, encoding, eol);
    try {
      await folder?.fs?.write(rel, bytes);
    } catch (err) {
      this.services.notify(S.notices.saveFailed(this.tab(id)?.name ?? rel, errorText(err)), 'error');
      return false;
    }
    if (folder) this.folder = { ...folder, files: folder.files.map((f) => (f.rel === rel ? { ...f, text, encoding, eol } : f)) };
    this.patch(id, { encoding, eol, dirty: false, disk: diskSignature(bytes), info: null });
    this.applyEffects(id, changeEffects.saved());
    return true;
  }

  async reload(id: string): Promise<void> {
    const tab = this.tab(id);
    if (!tab?.path) {
      this.services.notify(S.notices.noPath, 'info');
      return;
    }
    try {
      const file = await this.services.readFile(tab.path);
      const decoded = decodeFile(file.bytes, pinnedEncoding(tab.encoding));
      this.replaceText(id, decoded.text);
      this.patch(id, { encoding: decoded.encoding, eol: decoded.eol, dirty: false, disk: diskSignature(file.bytes) });
    } catch (err) {
      this.services.notify(S.notices.openFailed(tab.name, errorText(err)), 'error');
    }
  }

  /**
   * Relit le fichier avec un autre encodage (« Recharger avec l'encodage »). Onglet modifie : le texte en memoire est reinterprete
   * (octets = texte reecrit dans l'encodage actuel), les modifications sont gardees.
   */
  async reloadAs(id: string, encoding: TextEncoding): Promise<void> {
    const tab = this.tab(id);
    if (!tab) return;
    try {
      let bytes: Uint8Array;
      if (tab.path && !tab.dirty && this.services.platform !== 'web') bytes = (await this.services.readFile(tab.path)).bytes;
      else bytes = encodeFile(this.text(id), tab.encoding, 'lf');
      const decoded = decodeFile(bytes, encoding);
      this.replaceText(id, decoded.text);
      this.patch(id, { encoding, eol: tab.dirty ? tab.eol : decoded.eol, disk: tab.path && !tab.dirty ? diskSignature(bytes) : tab.disk });
      this.services.notify(S.notices.reloadedAs(tab.name, S.encodings[encoding]), 'info');
    } catch (err) {
      this.services.notify(S.notices.reloadFailed(errorText(err)), 'error');
    }
  }

  /** Lecture et controle du fichier disque d'un onglet : par chemin absolu, ou par chemin relatif dans le dossier ouvert (bureau). */
  private diskSource(tab: Tab): { read(): Promise<{ bytes: Uint8Array }>; info?(): Promise<FileInfo | null> } | null {
    const { path, origin } = tab;
    if (path) {
      const { fileInfo } = this.services;
      return { read: () => this.services.readFile(path), info: fileInfo ? () => fileInfo.call(this.services, path) : undefined };
    }
    const fs = this.folder?.fs;
    if (origin && fs?.read) {
      const { read, info } = fs;
      return { read: async () => ({ bytes: await read.call(fs, origin) }), info: info ? () => info.call(fs, origin) : undefined };
    }
    return null;
  }

  /**
   * Detection de modification externe (bureau) : relit le fichier de l'onglet et compare son empreinte a la derniere connue.
   * Onglet propre -> rechargement ; onglet modifie -> avertissement (la version du disque devient la reference, un seul avertissement).
   * Renvoie ce qui a ete fait (« missing » : fichier illisible ou supprime, rien n'est touche).
   */
  async checkExternal(id: string): Promise<'same' | 'reload' | 'conflict' | 'missing' | 'none'> {
    const tab = this.tab(id);
    const src = tab ? this.diskSource(tab) : null;
    if (!tab || !src || this.services.platform === 'web') return 'none';
    // La coquille donne date et taille sans lire le fichier : rien de change = rien a relire.
    let info: string | null = null;
    if (src.info) {
      try {
        const meta = await src.info();
        if (meta === null) return 'missing';
        info = `${meta.modifiedAt}:${meta.size}`;
        if (tab.info === info && tab.disk !== null) return 'same';
      } catch {
        info = null; // contrôle impossible : relecture complete comme avant
      }
    }
    let file: { bytes: Uint8Array };
    try {
      file = await src.read();
    } catch {
      return 'missing'; // supprime ou deplace : l'onglet garde son texte, on ne l'ecrase pas
    }
    const current = this.tab(id);
    if (!current) return 'none';
    if (info !== current.info) this.patch(id, { info });
    const sig = diskSignature(file.bytes);
    const verdict = externalChange(current.disk, sig, current.dirty);
    if (verdict === 'reload') {
      const decoded = decodeFile(file.bytes, pinnedEncoding(current.encoding));
      this.replaceText(id, decoded.text);
      this.patch(id, { encoding: decoded.encoding, eol: decoded.eol, dirty: false, disk: sig });
      if (current.follow) this.moveToEnd(id);
      else this.services.notify(S.notices.externalReloaded(current.name), 'info');
    } else if (verdict === 'conflict') {
      this.patch(id, { disk: sig, ...(current.follow ? { follow: false } : {}) });
      this.services.notify(current.follow ? S.notices.followStopped(current.name) : S.notices.externalConflict(current.name), 'warning');
    } else if (current.disk === null) this.patch(id, { disk: sig });
    return verdict;
  }

  /** Curseur et vue a la fin du document (suivi de fin de fichier). */
  moveToEnd(id: string): void {
    if (id === this.activeId && this.view) {
      this.view.dispatch({ selection: { anchor: this.view.state.doc.length }, scrollIntoView: true });
    } else {
      const st = this.states.get(id);
      if (st) this.states.set(id, st.update({ selection: { anchor: st.doc.length } }).state);
    }
  }

  /** Active ou coupe le suivi de fin de fichier (onglet avec chemin, bureau, sans modification en attente). */
  setFollow(id: string, on: boolean): void {
    const tab = this.tab(id);
    if (!tab || (on && (!tab.path || tab.dirty))) return;
    this.patch(id, { follow: on });
    if (on) {
      this.moveToEnd(id);
      void this.checkExternal(id);
    }
  }

  private polling = false;

  /** Controle periodique : onglet actif et onglets suivis (jamais deux controles en meme temps). */
  async pollExternal(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      for (const tab of this.tabs) {
        if (tab.id !== this.activeId && !tab.follow) continue;
        if ((this.stateOf(tab.id)?.doc.length ?? 0) > POLL_MAX_CHARS) continue;
        await this.checkExternal(tab.id);
      }
    } finally {
      this.polling = false;
    }
  }

  // --- Session ---

  private sessionTabs(): WindowSession {
    const tabs: SessionTab[] = [];
    for (const tab of this.tabs) {
      const state = this.stateOf(tab.id);
      const length = state?.doc.length ?? 0;
      const keep = keepText(tab, length);
      if (!keep && !tab.path) continue;
      if (!tab.path && !tab.dirty && length === 0 && !tab.origin) continue;
      tabs.push({
        name: tab.name, path: tab.path, origin: tab.origin, encoding: tab.encoding, eol: tab.eol, lang: tab.lang, dirty: tab.dirty, readOnly: tab.readOnly, pinned: tab.pinned,
        text: keep ? (state?.doc.toString() ?? '') : null, cursor: state?.selection.main.head ?? 0,
      });
    }
    return { win: this.win, active: Math.max(0, this.tabs.findIndex((t) => t.id === this.activeId)), tabs };
  }

  /** Ecrit la session de cette fenetre (seulement si elle a change) et son signe de vie. */
  persist(closing = false): void {
    const settings = this.services.settings;
    const now = Date.now();
    settings.set(ALIVE_KEY, touchAlive(parseAlive(settings.get<unknown>(ALIVE_KEY, null)), this.win, now, closing ? 0 : now));
    this.persistRecovery(closing);
    const mine = this.sessionTabs();
    const json = JSON.stringify(mine);
    if (json === this.lastSession) return;
    this.lastSession = json;
    settings.set(SESSION_KEY, upsertWindow(parseStore(settings.get<unknown>(SESSION_KEY, null)), mine));
  }

  /** Copies de secours des documents modifies de cette fenetre ; une sortie normale (`closing`) les retire. */
  private persistRecovery(closing: boolean): void {
    const docs: RecoveredDoc[] = closing
      ? []
      : this.tabs.filter((t) => t.dirty).map((t) => ({ name: t.name, path: t.path, encoding: t.encoding, eol: t.eol, text: this.text(t.id) }));
    const key = JSON.stringify(docs);
    if (key === this.lastRecovery) return;
    this.lastRecovery = key;
    const settings = this.services.settings;
    settings.set(RECOVERY_KEY, snapshot(parseRecovery(settings.get<unknown>(RECOVERY_KEY, null)), this.win, docs));
  }

  /** Rouvre, comme documents modifies, les copies des fenetres disparues sans sortie normale. Renvoie leurs noms. */
  recover(): string[] {
    const settings = this.services.settings;
    const open = new Set(this.tabs.map((t) => this.text(t.id)));
    const r = claimRecovery(parseRecovery(settings.get<unknown>(RECOVERY_KEY, null)), parseAlive(settings.get<unknown>(ALIVE_KEY, null)), Date.now(), open);
    settings.set(RECOVERY_KEY, r.store);
    for (const d of r.docs) this.add({ name: d.name, path: d.path, encoding: d.encoding, eol: d.eol, text: d.text, dirty: true });
    return r.docs.map((d) => d.name);
  }

  /** Reprend les onglets des fenetres fermees. Renvoie le nombre d'onglets restaures. */
  async restore(): Promise<number> {
    const settings = this.services.settings;
    const claimed = claimSession(parseStore(settings.get<unknown>(SESSION_KEY, null)), parseAlive(settings.get<unknown>(ALIVE_KEY, null)), Date.now());
    settings.set(SESSION_KEY, claimed.store);
    let restored = 0;
    let activeId = '';
    for (const [i, t] of claimed.tabs.entries()) {
      let text = t.text;
      let encoding = t.encoding;
      let eol = t.eol;
      let disk: string | null = null;
      if (text === null && t.path) {
        try {
          const bytes = (await this.services.readFile(t.path)).bytes;
          disk = diskSignature(bytes);
          ({ text, encoding, eol } = decodeFile(bytes));
        } catch {
          this.services.notify(S.notices.sessionLost(t.name), 'warning');
          continue;
        }
      }
      if (text === null) continue;
      const id = this.add({ ...t, text, encoding, eol, disk }, false);
      if (i === claimed.active) activeId = id;
      restored++;
    }
    if (restored) this.activate(activeId || (this.tabs[0]?.id ?? ''));
    const recovered = this.recover();
    if (recovered.length) this.services.notify(S.notices.recovered(recovered), 'warning');
    this.lastSession = '';
    this.persist();
    return restored;
  }
}
