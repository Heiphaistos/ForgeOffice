// Application Texte (equivalent Word 2024) : barre de titre, ruban, surface paginee, volets, barre d'etat, Backstage.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EditorState, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Mark } from 'prosemirror-model';
import { isHistoryTransaction, redo, redoDepth, undo, undoDepth } from 'prosemirror-history';
import DOMPurify from 'dompurify';
import { MODULES, type ModuleProps, type NoticeKind } from '@forgeoffice/core';
import { Backstage, Dialog, Ribbon, StatusBar, TaskPane, TitleBar, collectCommands, nextFontSize, type QuickAccessItem } from '@forgeoffice/ui';
import { countWords, createBlankDocument, readDocument, writeDocument, type Block, type Comment, type Inline, type MediaItem, type WordDocument } from '@forgeoffice/docx';
import { T } from './strings.ts';
import { createSchema } from './editor/schema.ts';
import { documentToPM } from './editor/convert.ts';
import { editorPlugins, type ShortcutId } from './editor/setup.ts';
import { pageKey, searchKey, type StylePreview } from './editor/plugins.ts';
import { documentStylesheet } from './editor/css.ts';
import { findMatches } from './editor/find.ts';
import { setParagraph, setRunProp } from './editor/commands.ts';
import { trackTransaction } from './editor/track.ts';
import { measureFlow } from './layout/measure.ts';
import { pageGeometry, pageOf, paginate, sameGaps } from './layout/paginate.ts';
import { collectHeadings } from './features/toc.ts';
import { advancedStats, formatMinutes } from './features/stats.ts';
import { TEMPLATES } from './features/templates.ts';
import type { Csv } from './features/merge.ts';
import { wordTabs } from './ribbon/index.ts';
import { EMPTY_SELECTION, selectionInfo } from './app/selection.ts';
import { INITIAL_UI, type Ctl, type DialogId, type UiState } from './app/types.ts';
import { createActions, fullDocument, isWritable, type DocInfo, type Env } from './app/actions.ts';
import { COLUMN_WRAP, PAGE_GAP, PageView, px, type HFEdit, type Layout, type PageNote } from './ui/PageView.tsx';
import { Ruler } from './ui/Ruler.tsx';
import { CommentsPane, NavPane, NotesPane, StatsPane, StylesPane } from './ui/Panes.tsx';
import { PageThumbs, backstagePages } from './ui/BackstagePages.tsx';
import { WordDialogs } from './dialogs/index.tsx';
import 'prosemirror-view/style/prosemirror.css';
import './App.css';

const word = MODULES.word;
const RECOVERY = 'word.recovery';
const AUTHOR = 'word.author';
const MAX_RECOVERY = 4_000_000;
const MAX_PASTE_IMAGE = 20 * 1024 * 1024;

interface Recovery {
  name: string;
  savedAt: number;
  data: string;
}

const toBase64 = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));

export function WordApp({ services, file }: ModuleProps) {
  const [meta, setMetaState] = useState<WordDocument>(createBlankDocument);
  const metaRef = useRef(meta);
  const [info, setInfoState] = useState<DocInfo>({ name: `${T.app.untitled}1.docx`, path: null, format: 'docx' });
  const infoRef = useRef(info);
  const [modified, setModifiedState] = useState(false);
  const modifiedRef = useRef(false);
  const [ui, setUiState] = useState<UiState>(() => ({ ...INITIAL_UI, spell: services.settings.get('word.spell', true) }));
  const uiRef = useRef(ui);
  const [, setTick] = useState(0);
  const [layout, setLayout] = useState<Layout>({ pages: 1, notes: [], lineNumbers: [] });
  const [backstage, setBackstage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogId | null>(null);
  const [csv, setCsv] = useState<Csv | null>(null);
  const [hfEdit, setHfEdit] = useState<HFEdit | null>(null);
  const [activeComment, setActiveCommentState] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const [author, setAuthorState] = useState<string>(() => services.settings.get<string>(AUTHOR, T.app.defaultAuthor));
  const [autoSave, setAutoSave] = useState(() => services.settings.get('word.autosave', true));
  const [printing, setPrinting] = useState(false);
  const printingRef = useRef(false);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [navWidth, setNavWidth] = useState(300);
  const [paneWidth, setPaneWidth] = useState(340);
  const [scrollFrac, setScrollFrac] = useState(0);
  const previewRef = useRef<StylePreview | null>(null);
  const painterRef = useRef<{ marks: readonly Mark[]; sticky: boolean } | null>(null);
  const forwardDelete = useRef(false);
  const extraMedia = useRef<Record<string, MediaItem>>({});
  const mediaUrls = useRef(new Map<string, string>());
  const viewRef = useRef<EditorView | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const loopRef = useRef(0);

  const notify = useCallback((m: string, k: NoticeKind = 'info') => services.notify(m, k), [services]);
  const markModified = useCallback((v: boolean) => {
    if (modifiedRef.current === v) return;
    modifiedRef.current = v;
    setModifiedState(v);
    services.setModified(v);
  }, [services]);

  const schema = useMemo(() => createSchema({
    mediaUrl(id) {
      const cached = mediaUrls.current.get(id);
      if (cached) return cached;
      const item = metaRef.current.media[id] ?? extraMedia.current[id];
      if (!item || !/^image\//.test(item.contentType) || item.contentType.includes('svg')) return null;
      const url = URL.createObjectURL(new Blob([item.bytes.slice().buffer], { type: item.contentType }));
      mediaUrls.current.set(id, url);
      return url;
    },
    addMedia(dataUrl) {
      const m = dataUrl.match(/^data:(image\/(png|jpe?g|gif|webp|bmp));base64,(.*)$/i);
      if (!m || m[3]!.length * 0.75 > MAX_PASTE_IMAGE) return null;
      const id = `fo-paste-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
      extraMedia.current[id] = { id, fileName: `${id}.${m[2]!.toLowerCase().replace('jpg', 'jpeg')}`, contentType: m[1]!.toLowerCase(), bytes: fromBase64(m[3]!) };
      return id;
    },
  }), []);

  // ---- Pagination : mesure -> calcul -> espaces poses, jusqu'a stabilite.
  const paginateNow = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const m = metaRef.current;
    const s = m.finalSection;
    const geom = pageGeometry({ height: s.pageHeight, marginTop: s.margins.top, marginBottom: s.margins.bottom }, printingRef.current ? 0 : PAGE_GAP);
    const current = pageKey.getState(view.state) ?? [];
    if (uiRef.current.view !== 'print' || s.columns.count > 1) {
      if (current.length) view.dispatch(view.state.tr.setMeta(pageKey, []).setMeta('addToHistory', false));
      const h = view.dom.offsetHeight;
      const pages = s.columns.count > 1 ? Math.max(1, Math.ceil(COLUMN_WRAP ? (h + geom.stride - geom.contentHeight) / geom.stride : h / geom.contentHeight)) : 1;
      setLayout((l) => (l.pages === pages && !l.notes.length ? l : { pages, notes: [], lineNumbers: [] }));
      return;
    }
    const blocks = measureFlow(view, m);
    const res = paginate(blocks, geom);
    if (!sameGaps(res.gaps, current) && loopRef.current < 6) {
      loopRef.current++;
      view.dispatch(view.state.tr.setMeta(pageKey, res.gaps).setMeta('addToHistory', false));
      return;
    }
    const origin = view.dom.getBoundingClientRect();
    const scale = view.dom.offsetWidth ? origin.width / view.dom.offsetWidth : 1;
    const notes: PageNote[] = [];
    view.dom.querySelectorAll<HTMLElement>('.fo-fnref').forEach((el, i) => {
      const y = (el.getBoundingClientRect().top - origin.top) / scale;
      notes.push({ page: Math.floor(y / geom.stride), noteId: Number(el.dataset.note), num: el.dataset.custom || String(i + 1) });
    });
    const lineNumbers: Layout['lineNumbers'] = [];
    if (s.lineNumbering) {
      let n = 0;
      let lastPage = 0;
      for (const b of blocks) {
        if (b.split !== 'line') continue;
        for (const line of b.lines?.() ?? []) {
          const page = pageOf(res, line.y);
          if (page !== lastPage && s.lineNumbering.restart === 'newPage') n = 0;
          lastPage = page;
          n++;
          if (n % Math.max(1, s.lineNumbering.countBy) === 0) lineNumbers.push({ page, y: line.y - res.pageStarts[page]! + Math.max(0, line.h - 16), n });
        }
      }
    }
    setLayout({ pages: res.pageCount, notes, lineNumbers });
  }, []);

  const schedulePaginate = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(paginateNow);
  }, [paginateNow]);

  const setMeta = useCallback((m: WordDocument, dirty = true) => {
    metaRef.current = m;
    setMetaState(m);
    if (dirty) markModified(true);
    const view = viewRef.current;
    if (view) view.dispatch(view.state.tr.setMeta('fo-refresh', true));
  }, [markModified]);

  const setUi = useCallback((patch: Partial<UiState>) => {
    uiRef.current = { ...uiRef.current, ...patch };
    setUiState(uiRef.current);
    if ('spell' in patch) services.settings.set('word.spell', patch.spell);
  }, [services]);

  const setActiveComment = useCallback((id: number | null) => {
    activeRef.current = id;
    setActiveCommentState(id);
    const view = viewRef.current;
    if (view) view.dispatch(view.state.tr.setMeta('fo-refresh', true));
  }, []);

  const setInfo = useCallback((i: DocInfo) => {
    infoRef.current = i;
    setInfoState(i);
    services.setTitle(`${i.name} - ${word.name}`);
  }, [services]);

  const load = useCallback((doc: WordDocument, i: DocInfo) => {
    for (const url of mediaUrls.current.values()) URL.revokeObjectURL(url);
    mediaUrls.current.clear();
    extraMedia.current = {};
    metaRef.current = doc;
    setMetaState(doc);
    setInfo(i);
    markModified(false);
    loopRef.current = 0;
    const view = viewRef.current;
    if (view) view.updateState(EditorState.create({ doc: documentToPM(schema, doc), plugins: view.state.plugins }));
    setUi({ mergeRecord: -1, readOnly: false });
    setTick((t) => t + 1);
    schedulePaginate();
  }, [schema, setInfo, markModified, setUi, schedulePaginate]);

  const pageOfPos = useCallback((pos: number): number => {
    const view = viewRef.current;
    if (!view || uiRef.current.view !== 'print') return 1;
    const s = metaRef.current.finalSection;
    const stride = px(s.pageHeight) + PAGE_GAP;
    try {
      const origin = view.dom.getBoundingClientRect();
      const scale = view.dom.offsetWidth ? origin.width / view.dom.offsetWidth : 1;
      return Math.floor((view.coordsAtPos(Math.min(pos, view.state.doc.content.size)).top - origin.top) / scale / stride) + 1;
    } catch {
      return 1; // position non affichee (document en cours de reconstruction)
    }
  }, []);

  const env: Env = useMemo(() => ({
    services, schema,
    view: () => viewRef.current,
    meta: () => metaRef.current,
    setMeta: (m) => setMeta(m),
    ui: () => uiRef.current,
    setUi,
    info: () => infoRef.current,
    modified: () => modifiedRef.current,
    markSaved: (i) => {
      setInfo(i);
      markModified(false);
      services.settings.set(RECOVERY, null);
    },
    load,
    author: () => services.settings.get(AUTHOR, T.app.defaultAuthor),
    csv: () => csvRef.current,
    setCsv: (v) => {
      csvRef.current = v;
      setCsv(v);
    },
    pageOfPos,
    extraMedia: extraMedia.current,
    openDialog: setDialog,
    notify,
    setActiveComment,
    setPreview: (p) => {
      previewRef.current = p;
      const view = viewRef.current;
      if (view) view.dispatch(view.state.tr.setMeta('fo-refresh', true));
    },
    setPainter: (p) => {
      painterRef.current = p ? { marks: p.state.storedMarks ?? p.state.selection.$from.marks(), sticky: p.sticky } : null;
      document.body.classList.toggle('fo-word-painting', !!p);
    },
    editHeaderFooter: (kind, id) => setHfEdit({ kind, id, page: Math.max(0, pageOfPos(viewRef.current?.state.selection.from ?? 0) - 1) }),
    requestPrint: () => {
      printingRef.current = true;
      setPrinting(true);
    },
  }), [services, schema, setMeta, setUi, setInfo, markModified, load, pageOfPos, notify, setActiveComment]);
  const csvRef = useRef<Csv | null>(null);
  const act = useMemo(() => createActions(env), [env]);

  // ---- Raccourcis de l'application (depuis le clavier de l'editeur).
  const shortcut = useCallback((id: ShortcutId): boolean => {
    const view = viewRef.current;
    switch (id) {
      case 'save': void act.save(); return true;
      case 'saveAs': setBackstage('saveAs'); return true;
      case 'open': void act.open(); return true;
      case 'new': act.newDocument('blank'); return true;
      case 'print': setBackstage('print'); return true;
      case 'find': setUi({ nav: true }); return true;
      case 'replace': setDialog('find'); return true;
      case 'link': setDialog('link'); return true;
      case 'goto': setDialog('goto'); return true;
      case 'footnote': act.insertNote('footnote'); return true;
      case 'endnote': act.insertNote('endnote'); return true;
      case 'comment': act.insertComment(); return true;
      case 'copyFormat': act.formatPainter(false); return true;
      case 'pasteFormat': applyPainter(); return true;
      case 'date': act.insertField('DATE'); return true;
      case 'time': act.insertField('TIME'); return true;
      case 'grow':
      case 'shrink': {
        const size = view ? selectionInfo(view.state, metaRef.current, 0, 0).run.size ?? 11 : 11;
        return view ? setRunProp('size', nextFontSize(size, id === 'grow' ? 1 : -1))(view.state, view.dispatch) : false;
      }
      case 'spell': setDialog('spelling'); return true;
      case 'bullets': act.list({ kind: 'bullet', char: '•' }); return true;
      case 'fontDialog': setDialog('font'); return true;
      case 'close': act.close(); return true;
      case 'focusExit':
        if (uiRef.current.focus) {
          setUi({ focus: false });
          return true;
        }
        if (painterRef.current) {
          env.setPainter(null);
          return true;
        }
        return false;
    }
  }, [act, setUi, env]);
  const shortcutRef = useRef(shortcut);
  shortcutRef.current = shortcut;

  function applyPainter(): void {
    const view = viewRef.current;
    const p = painterRef.current;
    if (!view || !p || view.state.selection.empty) return;
    const { from, to } = view.state.selection;
    const tr = view.state.tr;
    for (const t of Object.values(view.state.schema.marks)) if (t.name.startsWith('rp_') || t.name === 'cstyle') tr.removeMark(from, to, t);
    for (const m of p.marks) if (m.type.name.startsWith('rp_') || m.type.name === 'cstyle') tr.addMark(from, to, m);
    view.dispatch(tr);
    if (!p.sticky) env.setPainter(null);
  }

  // ---- Transactions : suivi des modifications, etat modifie, pagination.
  const dispatch = (tr: Transaction): void => {
    const view = viewRef.current;
    if (!view) return;
    let t = tr;
    if (metaRef.current.settings.trackRevisions && tr.docChanged && !tr.getMeta('fo-notrack') && !isHistoryTransaction(tr)) {
      t = trackTransaction(view.state, tr, { author: services.settings.get(AUTHOR, T.app.defaultAuthor), date: new Date().toISOString(), forward: forwardDelete.current }) ?? tr;
    }
    forwardDelete.current = false;
    view.updateState(view.state.apply(t));
    if (t.docChanged) {
      loopRef.current = 0;
      if (t.getMeta('addToHistory') !== false || t.getMeta('fo-notrack')) markModified(true);
      if (uiRef.current.typewriter) requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const top = view.coordsAtPos(view.state.selection.head).top - canvas.getBoundingClientRect().top;
        canvas.scrollTop += top - canvas.clientHeight / 2;
      });
    }
    setTick((x) => x + 1);
    schedulePaginate();
  };
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // ---- Creation de l'editeur.
  useLayoutEffect(() => {
    if (!mountRef.current) return;
    const view = new EditorView(mountRef.current, {
      state: EditorState.create({
        doc: documentToPM(schema, metaRef.current),
        plugins: editorPlugins({
          schema, getMeta: () => metaRef.current, getActiveComment: () => activeRef.current, getPreview: () => previewRef.current,
          shortcut: (id) => shortcutRef.current(id), onDeleteKey: (fwd) => { forwardDelete.current = fwd; },
        }),
      }),
      attributes: () => ({ class: 'fo-doc', spellcheck: String(uiRef.current.spell), lang: 'fr-FR', 'aria-label': T.app.editorLabel }),
      editable: () => !uiRef.current.readOnly,
      transformPastedHTML: (html) => DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'], FORBID_ATTR: ['style'] }),
      dispatchTransaction: (tr) => dispatchRef.current(tr),
      handleDOMEvents: {
        mouseup: () => {
          if (painterRef.current) setTimeout(applyPainter, 0);
          return false;
        },
        click: (_v, e) => {
          const target = e.target as HTMLElement;
          const link = target.closest<HTMLElement>('.fo-link');
          if (link && (e.ctrlKey || e.metaKey)) {
            const href = link.dataset.href ?? '';
            if (href.startsWith('#')) {
              const name = href.slice(1);
              viewRef.current?.state.doc.descendants((n, pos) => {
                const d = n.attrs.data as Inline | undefined;
                if (n.type.name === 'atom' && d?.type === 'bookmarkStart' && d.name === name) act.gotoPos(pos + 1);
                return true;
              });
            } else if (/^(https?|mailto|tel|ftp):/i.test(href)) window.open(href, '_blank', 'noopener,noreferrer');
            return true;
          }
          const commented = target.closest<HTMLElement>('.fo-commented');
          if (commented) {
            setActiveComment(Number(commented.dataset.comment));
            setUi({ pane: 'comments' });
          }
          return false;
        },
      },
    });
    viewRef.current = view;
    schedulePaginate();
    const ro = new ResizeObserver(() => schedulePaginate());
    ro.observe(view.dom);
    return () => {
      ro.disconnect();
      view.destroy();
      viewRef.current = null;
    };
  }, [schema]);

  // ---- Ouverture : fichier fourni, modele en attente, ou recuperation apres plantage.
  useEffect(() => {
    let alive = true;
    if (file) {
      readDocument(file.bytes, file.name).then((res) => {
        if (!alive) return;
        load(res.document, { name: file.name, path: file.path, format: res.format });
        if (res.warnings.length) notify(T.app.warnings(res.warnings.length), 'warning');
        if (res.format === 'doc') notify(T.app.readOnlyDoc, 'info');
        if (file.path) void services.addRecent({ app: 'word', name: file.name, path: file.path });
      }, (err: unknown) => notify(T.app.loadFailed(file.name, err instanceof Error ? err.message : String(err)), 'error'));
      return () => { alive = false; };
    }
    const pending = services.settings.get<string | null>('word.pendingTemplate', null);
    const tpl = pending ? TEMPLATES.find((t) => t.id === pending) : undefined;
    if (tpl) {
      services.settings.set('word.pendingTemplate', null);
      load(tpl.build(), { name: `${tpl.label}.docx`, path: null, format: 'docx' });
    } else {
      const rec = services.settings.get<Recovery | null>(RECOVERY, null);
      if (rec?.data) setRecovery(rec);
      services.setTitle(`${infoRef.current.name} - ${word.name}`);
    }
    return () => { alive = false; };
  }, []);

  // ---- Sauvegarde de recuperation (30 s) et enregistrement automatique sur disque si un chemin est connu.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!modifiedRef.current) return;
      const doc = fullDocument(env);
      void writeDocument(doc, 'docx').then((bytes) => {
        if (bytes.length <= MAX_RECOVERY) services.settings.set(RECOVERY, { name: infoRef.current.name, savedAt: Date.now(), data: toBase64(bytes) } satisfies Recovery);
        const i = infoRef.current;
        if (autoSave && i.path && isWritable(i.format) && (i.format === 'docx' || i.format === 'docm' || i.format === 'odt' || i.format === 'rtf')) {
          return writeDocument(doc, i.format).then((b) => services.saveFile(b, i.name, [{ name: word.name, extensions: [i.format] }], i.path)).then((saved) => {
            if (saved) {
              markModified(false);
              services.settings.set(RECOVERY, null);
            }
          });
        }
        return undefined;
      }).catch((err: unknown) => notify(T.app.saveFailed(err instanceof Error ? err.message : String(err)), 'error'));
    }, 30_000);
    return () => clearInterval(timer);
  }, [env, autoSave, services, markModified, notify]);

  // ---- Changements d'affichage : attributs de l'editeur et pagination.
  useEffect(() => {
    viewRef.current?.setProps({});
    schedulePaginate();
  }, [ui.view, ui.spell, ui.readOnly, ui.zoom, meta.finalSection, schedulePaginate]);

  // ---- Impression : pages jointives (sans intervalle) puis boite d'impression du systeme.
  useEffect(() => {
    if (!printing) return;
    paginateNow();
    paginateNow();
    const id = requestAnimationFrame(() => {
      services.print();
      printingRef.current = false;
      setPrinting(false);
    });
    return () => cancelAnimationFrame(id);
  }, [printing, paginateNow, services]);

  // ---- Raccourcis globaux (hors de l'editeur).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.target as HTMLElement | null)?.closest?.('.ProseMirror')) return;
      const mod = e.ctrlKey || e.metaKey;
      const id: ShortcutId | null = mod && e.key.toLowerCase() === 's' ? 'save' : mod && e.key.toLowerCase() === 'o' ? 'open' : mod && e.key.toLowerCase() === 'p' ? 'print' : e.key === 'Escape' ? 'focusExit' : null;
      if (id && shortcutRef.current(id)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const view = viewRef.current;
  const state = view?.state ?? null;
  const sel = state ? selectionInfo(state, meta, undoDepth(state) as number, redoDepth(state) as number) : EMPTY_SELECTION;
  const docText = useMemo(() => state?.doc.textBetween(0, state.doc.content.size, '\n', ' ') ?? '', [state?.doc]);
  const words = useMemo(() => countWords(docText), [docText]);
  const headings = useMemo(() => (state && ui.nav ? collectHeadings(state.doc, meta) : []), [state?.doc, meta, ui.nav]);
  const searchCount = state ? searchKey.getState(state)?.matches.length ?? 0 : 0;
  const readingMinutes = useMemo(() => (ui.readingTimer ? advancedStats(docText).readingMinutes : 0), [docText, ui.readingTimer]);

  const ctl: Ctl = {
    services, schema, meta, sel, ui, pageCount: layout.pages, author, csv, setUi,
    updateMeta: (fn) => setMeta(fn(metaRef.current)),
    run: (cmd) => {
      const v = viewRef.current;
      if (!v) return false;
      const ok = cmd(v.state, v.dispatch, v);
      v.focus();
      return ok;
    },
    state: () => viewRef.current?.state ?? null,
    view: () => viewRef.current,
    openDialog: setDialog,
    notify,
    act,
  };
  const tabs = wordTabs(ctl);
  const commands = collectCommands(tabs);
  const caretPage = state && ui.view === 'print' ? Math.min(layout.pages, pageOfPos(state.selection.head)) : 1;
  const stylesheet = useMemo(() => {
    const s = meta.finalSection;
    return `${documentStylesheet(meta, '.fo-word .fo-doc')}\n@page{size:${s.pageWidth}pt ${s.pageHeight}pt;margin:0}\n.fo-word .fo-doc{${meta.settings.autoHyphenation ? 'hyphens:auto;' : ''}}`;
  }, [meta]);

  const quickAccess: QuickAccessItem[] = [
    { id: 'save', label: T.qat.save, icon: 'save', shortcut: 'Ctrl+S', onClick: () => void act.save() },
    { id: 'undo', label: T.qat.undo, icon: 'arrow_undo', shortcut: 'Ctrl+Z', disabled: !sel.canUndo, onClick: () => ctl.run(undo) },
    { id: 'redo', label: T.qat.redo, icon: 'arrow_redo', shortcut: 'Ctrl+Y', disabled: !sel.canRedo, onClick: () => ctl.run(redo) },
    { id: 'print', label: T.qat.print, icon: 'print', defaultVisible: false, onClick: () => act.print() },
    { id: 'new', label: T.qat.newDoc, icon: 'document_add', defaultVisible: false, onClick: () => act.newDocument('blank') },
    { id: 'open', label: T.qat.open, icon: 'folder_open', defaultVisible: false, onClick: () => void act.open() },
    { id: 'focus', label: T.qat.focus, icon: 'full_screen_maximize', defaultVisible: false, onClick: () => setUi({ focus: true }) },
  ];

  const commentOps = {
    change: (comments: Comment[]) => setMeta({ ...metaRef.current, comments }),
    remove: (id: number) => {
      const ids = new Set([id, ...metaRef.current.comments.filter((c) => c.parentId === id).map((c) => c.id)]);
      const v = viewRef.current;
      if (v) {
        const tr = v.state.tr;
        const del: number[] = [];
        v.state.doc.descendants((n, pos) => {
          const d = n.attrs.data as Inline | undefined;
          if (n.type.name === 'atom' && d && 'commentId' in d && ids.has(d.commentId)) del.push(pos);
          return true;
        });
        for (const pos of del.reverse()) tr.delete(pos, pos + 1);
        v.dispatch(tr);
      }
      setMeta({ ...metaRef.current, comments: metaRef.current.comments.filter((c) => !ids.has(c.id)) });
    },
  };

  const paneTitle = ui.pane === 'comments' ? T.dialogs.commentsTitle : ui.pane === 'notes' ? T.dialogs.notesTitle : ui.pane === 'styles' ? T.cmd.stylesPane : T.cmd.advancedStats;
  const pageW = px(meta.finalSection.pageWidth);
  const zoomFor = (fit: 'width' | 'page'): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 100;
    const byWidth = ((canvas.clientWidth - 48) / pageW) * 100;
    return Math.round(fit === 'width' ? byWidth : Math.min(byWidth, ((canvas.clientHeight - 32) / px(meta.finalSection.pageHeight)) * 100));
  };

  return (
    <div className={`fo-word${ui.focus ? ' is-focus' : ''}${printing ? ' is-printing' : ''}`} data-markup={ui.markup} data-marks={ui.showMarks ? 'on' : 'off'} data-outline={ui.view === 'outline' ? String(ui.outlineLevel) : undefined}>
      <style>{stylesheet}</style>
      {!ui.focus && (
        <TitleBar
          app={word} documentName={info.name.replace(/\.[^.]+$/, '')} location={info.path ?? T.app.location}
          saveState={modified ? 'modified' : 'saved'}
          autoSave={{ enabled: autoSave && !!info.path, disabled: !info.path, onChange: (v) => { setAutoSave(v); services.settings.set('word.autosave', v); } }}
          quickAccess={quickAccess} commands={commands} searchPlaceholder={T.search}
          onRename={(n) => setInfo({ ...infoRef.current, name: `${n}${infoRef.current.name.match(/\.[^.]+$/)?.[0] ?? '.docx'}` })}
          windowControls={services.windowControls} settings={services.settings}
        />
      )}
      {!ui.focus && ui.view !== 'read' && <Ribbon tabs={tabs} onFile={() => setBackstage('home')} settings={services.settings} />}
      <div className="fo-word-main">
        {ui.nav && !ui.focus && (
          <TaskPane title={T.dialogs.navTitle} side="left" width={navWidth} onWidthChange={setNavWidth} onClose={() => { setUi({ nav: false }); act.findText(''); }}>
            <NavPane headings={headings} activePos={state?.selection.from ?? 0} results={searchCount} onGo={(pos) => act.gotoPos(pos + 1)} onSearch={(q) => act.findText(q)} />
          </TaskPane>
        )}
        <div className="fo-word-center">
          {ui.ruler && ui.view === 'print' && !ui.focus && !ui.multiPage && (
            <div className="fo-word-rulerbar"><Ruler section={meta.finalSection} para={sel.para} zoom={printing ? 100 : ui.zoom} onChange={(patch) => ctl.run(setParagraph({ props: patch }))} /></div>
          )}
          <div ref={canvasRef} className={`fo-word-canvas fo-scroll${ui.view === 'read' ? ' is-read' : ''}`}
            onScroll={(e) => {
              if (!ui.readingTimer) return;
              const el = e.currentTarget;
              setScrollFrac(el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 1);
            }}>
            <PageView schema={schema} meta={meta} ui={printing ? { ...ui, zoom: 100 } : ui} layout={layout} gap={printing ? 0 : PAGE_GAP} mountRef={mountRef}
              hfEdit={hfEdit}
              onEditHF={(e) => {
                if (e && !e.id) act.editHeaderFooter(e.kind);
                else setHfEdit(e);
              }}
              onHFChange={(id, blocks: Block[]) => setMeta({ ...metaRef.current, headersFooters: { ...metaRef.current.headersFooters, [id]: { ...metaRef.current.headersFooters[id]!, blocks } } })} />
            {ui.multiPage && (
              <div className="fo-word-multipage">
                <PageThumbs meta={meta} count={layout.pages} scale={0.3} onPick={(page) => {
                  setUi({ multiPage: false });
                  requestAnimationFrame(() => document.querySelector(`.fo-word-sheet[data-page="${page}"]`)?.scrollIntoView({ block: 'start' }));
                }} />
              </div>
            )}
          </div>
          {hfEdit && <button type="button" className="fo-word-hfclose" onClick={() => setHfEdit(null)}>{T.cmd.closeHeader}</button>}
          {ui.focus && <div className="fo-word-focushint" role="status">{T.status.focusExit}</div>}
        </div>
        {ui.pane && !ui.focus && (
          <TaskPane title={paneTitle} side="right" width={paneWidth} onWidthChange={setPaneWidth} onClose={() => setUi({ pane: null })}>
            {ui.pane === 'comments' && (
              <CommentsPane comments={meta.comments} active={activeComment} author={author} onChange={commentOps.change} onDelete={commentOps.remove}
                onSelect={(id) => {
                  setActiveComment(id);
                  viewRef.current?.state.doc.descendants((n, pos) => {
                    const d = n.attrs.data as Inline | undefined;
                    if (n.type.name === 'atom' && d?.type === 'commentStart' && d.commentId === id) act.gotoPos(pos + 1);
                    return true;
                  });
                }} />
            )}
            {ui.pane === 'notes' && (
              <NotesPane schema={schema} footnotes={meta.footnotes} endnotes={meta.endnotes}
                onChange={(kind, id, blocks) => {
                  const key = kind === 'footnote' ? 'footnotes' : 'endnotes';
                  setMeta({ ...metaRef.current, [key]: metaRef.current[key].map((n) => (n.id === id ? { ...n, blocks } : n)) });
                }} />
            )}
            {ui.pane === 'styles' && <StylesPane meta={meta} current={sel.charStyle ?? sel.styleId} onApply={act.applyStyle} />}
            {ui.pane === 'stats' && <StatsPane text={docText} selection={sel.text} />}
          </TaskPane>
        )}
      </div>
      {!ui.focus && (
        <StatusBar
          left={[
            { id: 'page', label: T.status.page(caretPage, layout.pages), onClick: () => setDialog('goto') },
            { id: 'words', label: sel.empty ? T.status.words(words) : T.status.wordsOf(countWords(sel.text), words), onClick: () => setDialog('stats') },
            { id: 'proof', label: '', icon: 'text_proofing_tools', title: T.status.proofing, onClick: () => setDialog('spelling') },
            { id: 'lang', label: T.status.language },
            ...(meta.settings.trackRevisions ? [{ id: 'track', label: T.status.track, onClick: () => act.setTrack(false) }] : []),
            ...(ui.readingTimer ? [{ id: 'timer', label: ui.view === 'read' ? T.status.remaining(formatMinutes(readingMinutes * (1 - scrollFrac))) : T.status.reading(formatMinutes(readingMinutes)) }] : []),
          ]}
          views={[{ id: 'read', label: T.views.read, icon: 'book_open' }, { id: 'print', label: T.views.print, icon: 'document_one_page' }, { id: 'web', label: T.views.web, icon: 'globe' }]}
          activeView={ui.view}
          onViewChange={(id) => setUi({ view: id as UiState['view'], multiPage: false })}
          zoom={ui.zoom}
          onZoomChange={(zoom) => setUi({ zoom })}
          zoomPresets={[{ label: T.cmd.pageWidth, compute: () => zoomFor('width') }, { label: T.cmd.onePage, compute: () => zoomFor('page') }]}
        />
      )}
      <Backstage open={backstage !== null} appName={word.name} pages={backstagePages({ c: ctl, env, pageCount: layout.pages, close: () => setBackstage(null), author, setAuthor: (n) => { setAuthorState(n); services.settings.set(AUTHOR, n); } })}
        activePage={backstage ?? 'home'} onPageChange={setBackstage} onClose={() => setBackstage(null)} />
      <WordDialogs id={dialog} c={ctl} env={env} onClose={() => { setDialog(null); viewRef.current?.focus(); }} />
      {recovery && (
        <Dialog open title={T.app.recoverTitle} onClose={() => setRecovery(null)}
          actions={[
            { label: T.app.restore, primary: true, onClick: () => {
              void readDocument(fromBase64(recovery.data), 'recuperation.docx').then((res) => {
                load(res.document, { name: recovery.name, path: null, format: 'docx' });
                markModified(true);
                notify(T.app.recovered, 'success');
              });
              setRecovery(null);
            } },
            { label: T.app.discard, onClick: () => { services.settings.set(RECOVERY, null); setRecovery(null); } },
          ]}>
          <p>{T.app.recoverText(recovery.name, new Date(recovery.savedAt).toLocaleString('fr-FR'))}</p>
        </Dialog>
      )}
    </div>
  );
}
