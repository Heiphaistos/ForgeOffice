// Etat des documents du Bloc-notes, hors React : onglets, etats CodeMirror, vue scindee, enregistrement, session.
import type { LanguageSupport } from '@codemirror/language';
import { undo, redo } from '@codemirror/commands';
import { Annotation, EditorState, type Transaction } from '@codemirror/state';
import { EditorView, keymap, type ViewUpdate } from '@codemirror/view';
import { MODULES, type FileFilter, type OpenedFile, type Services } from '@forgeoffice/core';
import { diskSignature, externalChange } from './logic/disk.ts';
import { MAX_FILE_BYTES, canEncode, decodeFile, encodeFile, type Eol, type TextEncoding } from './logic/encoding.ts';
import type { FolderFile } from './logic/folder.ts';
import type { LinkTarget } from './logic/links.ts';
import type { NotesPrefs } from './logic/prefs.ts';
import {
  ALIVE_KEY, SESSION_KEY, claimSession, keepText, parseAlive, parseStore, touchAlive, upsertWindow, type SessionTab, type WindowSession,
} from './logic/session.ts';
import { editorExtensions, reconfigure, type EditorHooks, type EditorSettings } from './editor/extensions.ts';
import { languageByName, languageForFile } from './editor/languages.ts';
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
  /** Empreinte du fichier tel que lu ou enregistre en dernier (null : jamais lu du disque). */
  disk: string | null;
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
}

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
  private prefs: NotesPrefs;
  private version = 0;
  private seq = 0;
  private docVersion = 0;
  private lastSession = '';
  private readonly services: Services;
  private readonly win: string;
  private readonly states = new Map<string, EditorState>();
  private readonly closed: { init: TabInit }[] = [];
  private readonly langs = new Map<string, LanguageSupport>();
  private readonly listeners = new Set<() => void>();
  private readonly cursorListeners = new Set<() => void>();
  private readonly hooks: EditorHooks;

  constructor(services: Services, prefs: NotesPrefs) {
    this.services = services;
    this.prefs = prefs;
    this.win = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    this.hooks = {
      onUpdate: (u) => this.onViewUpdate(u),
      onOpenLink: (l) => this.onOpenLink(l),
      onZoom: (d) => this.onZoom(d),
    };
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
    return { prefs: this.prefs, readOnly: tab.readOnly, language: this.langs.get(name) ?? null };
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
      disk: init.disk ?? null,
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
    const from = this.tabs.findIndex((t) => t.id === id);
    if (from < 0) return;
    const list = [...this.tabs];
    const [tab] = list.splice(from, 1);
    if (!tab) return;
    list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, tab);
    this.tabs = list;
    this.bump();
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
    if (change.lang !== undefined || change.name !== undefined || change.readOnly !== undefined) {
      this.loadLanguage(after);
      this.refreshConfig(id);
    }
    this.bump();
    if (id === this.activeId) this.services.setTitle(`${after.dirty ? '*' : ''}${after.name} - ${MODULES.notes.name}`);
  }

  /** Remplace tout le texte d'un onglet (rechargement). */
  replaceText(id: string, text: string): void {
    if (id === this.activeId && this.view) {
      this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text }, annotations: quiet.of(true) });
    } else {
      const st = this.states.get(id);
      if (st) this.states.set(id, st.update({ changes: { from: 0, to: st.doc.length, insert: text } }).state);
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
    const settings = tab ? this.settingsFor(tab) : { prefs: this.prefs, readOnly: false, language: null };
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
    this.bump();
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
    return this.add({ name: rel.split('/').pop() ?? rel, origin: rel, text: f.text, eol: 'lf' });
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
    const enc = encoding ?? tab.encoding;
    const end = eol ?? tab.eol;
    if (!canEncode(text, enc)) this.services.notify(S.notices.lossy, 'warning');
    const suggested = /\.[^./\\]+$/.test(tab.name) ? tab.name : `${tab.name}.txt`;
    try {
      const bytes = encodeFile(text, enc, end);
      const saved = await this.services.saveFile(bytes, suggested, FILTERS(this.services.platform), saveAs ? null : tab.path);
      if (!saved) return false;
      const path = saved.path ?? tab.path;
      this.patch(id, { name: saved.name, path, encoding: enc, eol: end, dirty: false, disk: path ? diskSignature(bytes) : null });
      this.services.addRecent({ app: 'notes', name: saved.name, path: saved.path ?? saved.name }).catch(() => undefined);
      return true;
    } catch (err) {
      this.services.notify(S.notices.saveFailed(tab.name, errorText(err)), 'error');
      return false;
    }
  }

  async reload(id: string): Promise<void> {
    const tab = this.tab(id);
    if (!tab?.path) {
      this.services.notify(S.notices.noPath, 'info');
      return;
    }
    try {
      const file = await this.services.readFile(tab.path);
      const decoded = decodeFile(file.bytes);
      this.replaceText(id, decoded.text);
      this.patch(id, { encoding: decoded.encoding, eol: decoded.eol, dirty: false, disk: diskSignature(file.bytes) });
    } catch (err) {
      this.services.notify(S.notices.openFailed(tab.name, errorText(err)), 'error');
    }
  }

  /**
   * Detection de modification externe (bureau) : relit le fichier de l'onglet et compare son empreinte a la derniere connue.
   * Onglet propre -> rechargement ; onglet modifie -> avertissement (la version du disque devient la reference, un seul avertissement).
   * Renvoie ce qui a ete fait (« missing » : fichier illisible ou supprime, rien n'est touche).
   */
  async checkExternal(id: string): Promise<'same' | 'reload' | 'conflict' | 'missing' | 'none'> {
    const tab = this.tab(id);
    if (!tab?.path || this.services.platform === 'web') return 'none';
    let file: OpenedFile;
    try {
      file = await this.services.readFile(tab.path);
    } catch {
      return 'missing'; // supprime ou deplace : l'onglet garde son texte, on ne l'ecrase pas
    }
    const current = this.tab(id);
    if (!current) return 'none';
    const sig = diskSignature(file.bytes);
    const verdict = externalChange(current.disk, sig, current.dirty);
    if (verdict === 'reload') {
      const decoded = decodeFile(file.bytes);
      this.replaceText(id, decoded.text);
      this.patch(id, { encoding: decoded.encoding, eol: decoded.eol, dirty: false, disk: sig });
      this.services.notify(S.notices.externalReloaded(current.name), 'info');
    } else if (verdict === 'conflict') {
      this.patch(id, { disk: sig });
      this.services.notify(S.notices.externalConflict(current.name), 'warning');
    } else if (current.disk === null) this.patch(id, { disk: sig });
    return verdict;
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
        name: tab.name, path: tab.path, origin: tab.origin, encoding: tab.encoding, eol: tab.eol, lang: tab.lang, dirty: tab.dirty, readOnly: tab.readOnly,
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
    const mine = this.sessionTabs();
    const json = JSON.stringify(mine);
    if (json === this.lastSession) return;
    this.lastSession = json;
    settings.set(SESSION_KEY, upsertWindow(parseStore(settings.get<unknown>(SESSION_KEY, null)), mine));
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
    this.lastSession = '';
    this.persist();
    return restored;
  }
}
