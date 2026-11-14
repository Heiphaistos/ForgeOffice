// Application Texte (equivalent Word 2024) : barre de titre, ruban, surface paginee, volets, barre d'etat, Backstage.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CellSelection } from 'prosemirror-tables';
import { EditorState, NodeSelection, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Mark } from 'prosemirror-model';
import { isHistoryTransaction, redo, redoDepth, undo, undoDepth } from 'prosemirror-history';
import DOMPurify from 'dompurify';
import { MODULES, afterPrint, registerProbe, sharedRecovery, type ModuleProps, type NoticeKind, type RecoveryEntry } from '@forgeoffice/core';
import { isOnlyOfficeFor } from '@forgeoffice/ui/logic/ooMode';
import { useRevealFile, Backstage, Dialog, Ribbon, StatusBar, TaskPane, TitleBar, collectCommands, useContextMenu, parseCaret, MiniToolbar, useSelectionMiniToolbar, nextFontSize, isOnlyOffice, remeasureWhenFontsReady, useConfirmDiscard, usePinchZoom, type QuickAccessItem, type StatusItem } from '@forgeoffice/ui';
import { countWords, createBlankDocument, readDocument, writeDocument, type Block, type Comment, type Inline, type MediaItem, type WordDocument } from '@forgeoffice/docx';
import { T } from './strings.ts';
import { createSchema } from './editor/schema.ts';
import { documentToPM } from './editor/convert.ts';
import { editorPlugins, type ShortcutId } from './editor/setup.ts';
import { KEYSET_SETTING } from './keymap/keysets.ts';
import { pageKey, searchKey, type StylePreview } from './editor/plugins.ts';
import { documentStylesheet } from './editor/css.ts';
import { findMatches } from './editor/find.ts';
import { setParagraph, setRunProp } from './editor/commands.ts';
import { trackTransaction } from './editor/track.ts';
import { documentFonts } from './layout/fonts.ts';
import { materialize, sameGaps } from './layout/paginate.ts';
import { measureTabs } from './layout/tabs.ts';
import { sameTabs, tabKey } from './editor/layout-deco.ts';
import { computeFlow, uniformSheets } from './layout/flow.ts';
import { sectionIndexAt, sectionSpans } from './features/sections.ts';
import { collectHeadings } from './features/toc.ts';
import { advancedStats, formatMinutes } from './features/stats.ts';
import type { Csv } from './features/merge.ts';
import { wordTabs } from './ribbon/index.ts';
import { EMPTY_SELECTION, selectionInfo } from './app/selection.ts';
import { INITIAL_UI, type Ctl, type DialogId, type TrackOptions, type UiState } from './app/types.ts';
import { createActions, fullDocument, isWritable, linkMarkAttrs, type DocInfo, type Env } from './app/actions.ts';
import { COLUMN_WRAP, EMPTY_LAYOUT, PAGE_GAP, PageView, columnsSection, px, type HFEdit, type Layout } from './ui/PageView.tsx';
import { Ruler } from './ui/Ruler.tsx';
import { DocOverlays } from './ui/DocOverlays.tsx';
import { miniBarRows } from './ui/miniBar.ts';
import { currentLanguageName, editorMenu, headerFooterMenu, languageItems } from './ui/editorMenu.ts';
import { nudgeWithArrows } from './editor/images-dom.ts';
import { CommentsPane, NavPane, NotesPane, StatsPane } from './ui/Panes.tsx';
import { moveSection, moveStep, shiftSection } from './navigation/sections.ts';
import { SpeechPane } from './voice/SpeechPane.tsx';
import { SelectionPane } from './objects/SelectionPane.tsx';
import { ReviewingPane } from './proofing/ReviewingPane.tsx';
import { X } from './strings-extra.ts';
import { StylesPane } from './styles/StylesPane.tsx';
import { rulerMenu } from './ui/rulerMenu.ts';
import { statusMenu } from './ui/statusMenu.ts';
import { PageThumbs, backstagePages } from './ui/BackstagePages.tsx';
import { WordDialogs } from './dialogs/index.tsx';
import 'prosemirror-view/style/prosemirror.css';
import { MobileBar } from './ui/MobileBar.tsx';
import { wordProbe } from './app/probe.ts';
import { ImageHandles } from './ui/ImageHandles.tsx';
import './App.css';

const word = MODULES.word;
const LEGACY_RECOVERY = 'word.recovery';
const AUTHOR = 'word.author';
const MAX_RECOVERY = 4_000_000;
const MAX_PASTE_IMAGE = 20 * 1024 * 1024;
const MOBILE_MIN_ZOOM = 70;
/** Au-dela de ce nombre de pages, seules les feuilles proches de l'ecran sont dessinees. */
const VIRTUAL_MIN = 40;
const VIRTUAL_MARGIN = 3;

const fromBase64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));

export function WordApp({ services, file }: ModuleProps) {
  const [meta, setMetaState] = useState<WordDocument>(() => createBlankDocument(isOnlyOfficeFor(services.settings, 'word') ? 'onlyoffice' : undefined));
  const metaRef = useRef(meta);
  const [info, setInfoState] = useState<DocInfo>({ name: `${T.app.untitled}1.docx`, path: null, format: 'docx' });
  useRevealFile(info.path, services);
  const infoRef = useRef(info);
  const [modified, setModifiedState] = useState(false);
  const modifiedRef = useRef(false);
  const [ui, setUiState] = useState<UiState>(() => ({ ...INITIAL_UI, spell: services.settings.get('word.spell', true), caret: parseCaret(services.settings.get('word.caret', null)), miniBar: services.settings.get('word.minibar', true), trackOpts: { ...INITIAL_UI.trackOpts, ...services.settings.get<Partial<TrackOptions>>('word.track', {}) }, statusHidden: services.settings.get<string[]>('word.statusHidden', []) }));
  const uiRef = useRef(ui);
  const [, setTick] = useState(0);
  const [layout, setLayout] = useState<Layout>(EMPTY_LAYOUT);
  const [backstage, setBackstage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogId | null>(null);
  const [csv, setCsv] = useState<Csv | null>(null);
  const selectionBox = useCallback(() => {
    const v = viewRef.current;
    const s = v?.state.selection;
    if (!v || !s || s.empty || s instanceof NodeSelection || s instanceof CellSelection) return null;
    const a = v.coordsAtPos(s.from);
    const b = v.coordsAtPos(s.to);
    return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), width: Math.abs(b.left - a.left) || 1, height: Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top) };
  }, []);
  const [hfEdit, setHfEdit] = useState<HFEdit | null>(null);
  const [activeComment, setActiveCommentState] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const [author, setAuthorState] = useState<string>(() => services.settings.get<string>(AUTHOR, T.app.defaultAuthor));
  const [autoSave, setAutoSave] = useState(() => services.settings.get('word.autosave', true));
  const [printing, setPrinting] = useState(false);
  const printingRef = useRef(false);
  const [recovery, setRecovery] = useState<RecoveryEntry | null>(null);
  const [navWidth, setNavWidth] = useState(300);
  const [paneWidth, setPaneWidth] = useState(340);
  const [scrollFrac, setScrollFrac] = useState(0);
  const previewRef = useRef<StylePreview | null>(null);
  const painterRef = useRef<{ marks: readonly Mark[]; sticky: boolean } | null>(null);
  const forwardDelete = useRef(false);
  const nativeMenuNext = useRef(false);
  const ctxMenu = useContextMenu();
  const miniRef = useRef<{ showAt: (b: { left: number; top: number; width: number; height: number }) => void } | null>(null);
  const ctlRef = useRef<Ctl | null>(null);
  const extraMedia = useRef<Record<string, MediaItem>>({});
  const mediaUrls = useRef(new Map<string, string>());
  const viewRef = useRef<EditorView | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pagesRef = useMemo(() => ({ get current(): HTMLElement | null { return canvasRef.current?.querySelector<HTMLElement>('.fo-word-pages') ?? null; } }), []);
  const rafRef = useRef(0);
  const layoutRef = useRef<Layout>(EMPTY_LAYOUT);
  const noteHeightsRef = useRef(new Map<number, number>());
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const loopRef = useRef(0);

  const confirm = useConfirmDiscard();
  const guardRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));
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

  // ---- Pagination : mesure -> calcul par section -> espaces poses, jusqu'a stabilite.
  const paginateNow = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const m = metaRef.current;
    const sections = sectionSpans(view.state.doc, m.finalSection).map((x) => x.section);
    const colIdx = columnsSection(sections);
    const frame = sections[Math.max(0, colIdx)]!;
    const gapPx = printingRef.current ? 0 : PAGE_GAP;
    // Tabulations a taquets personnalises : largeurs mesurees avant la pagination (la ligne change de longueur).
    const tabs = measureTabs(view, m);
    if (!sameTabs(tabs, tabKey.getState(view.state) ?? []) && loopRef.current < 8) {
      loopRef.current++;
      view.dispatch(view.state.tr.setMeta(tabKey, tabs).setMeta('addToHistory', false));
      return;
    }
    const current = pageKey.getState(view.state) ?? [];
    if (uiRef.current.view !== 'print' || colIdx >= 0) {
      if (current.length) view.dispatch(view.state.tr.setMeta(pageKey, []).setMeta('addToHistory', false));
      const h = view.dom.offsetHeight;
      const contentH = px(frame.pageHeight - frame.margins.top - frame.margins.bottom);
      const stride = px(frame.pageHeight) + gapPx;
      const pages = frame.columns.count > 1 ? Math.max(1, Math.ceil(COLUMN_WRAP ? (h + stride - contentH) / stride : h / contentH)) : 1;
      setLayout((l) => (l.pages === pages && !l.notes.length && l.sheets.length === pages ? l : { pages, notes: [], lineNumbers: [], sheets: uniformSheets(pages, frame, Math.max(0, colIdx), gapPx), tailGap: 0, endnotes: [] }));
      return;
    }
    const out = computeFlow({ view, meta: m, sections, gapPx, noteHeights: noteHeightsRef.current, endnotesEl: canvasRef.current?.querySelector<HTMLElement>('.fo-word-endnotes') ?? null, tailGap: layoutRef.current.tailGap });
    if (!sameGaps(out.gaps, current) && loopRef.current < 6) {
      loopRef.current++;
      view.dispatch(view.state.tr.setMeta(pageKey, materialize(out.gaps)).setMeta('addToHistory', false));
      return;
    }
    layoutRef.current = out.layout;
    setLayout(out.layout);
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
    if ('caret' in patch) services.settings.set('word.caret', patch.caret);
    if ('miniBar' in patch) services.settings.set('word.minibar', patch.miniBar);
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
    setUi({ mergeRecord: -1, readOnly: !!doc.settings.protection?.enforced && (doc.settings.protection.kind === 'readOnly' || doc.settings.protection.kind === 'comments') });
    setTick((t) => t + 1);
    schedulePaginate();
  }, [schema, setInfo, markModified, setUi, schedulePaginate]);

  const pageOfPos = useCallback((pos: number): number => {
    const view = viewRef.current;
    if (!view || uiRef.current.view !== 'print') return 1;
    try {
      const origin = view.dom.getBoundingClientRect();
      const scale = view.dom.offsetWidth ? origin.width / view.dom.offsetWidth : 1;
      const y = view.coordsAtPos(Math.min(pos, view.state.doc.content.size)).top - origin.top;
      // Haut de la zone de texte de chaque feuille = haut de la feuille + marge haute de sa section ; on retient la derniere feuille commencee.
      const sheets = layoutRef.current.sheets;
      let page = 0;
      for (let i = 0; i < sheets.length; i++) if (sheets[i]!.textTop <= y / scale + 1) page = i;
      return page + 1;
    } catch {
      return 1; // position non affichee (document en cours de reconstruction)
    }
  }, []);

  const scrollToPage = useCallback((page: number): void => {
    const canvas = canvasRef.current;
    const sheet = layoutRef.current.sheets[Math.max(0, page - 1)];
    const pages = canvas?.querySelector<HTMLElement>('.fo-word-pages');
    if (!canvas || !sheet || !pages) return;
    canvas.scrollTop = pages.offsetTop + sheet.top * (uiRef.current.zoom / 100) - 8;
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
    guard: () => guardRef.current(),
    markSaved: (i) => {
      setInfo(i);
      markModified(false);
      void sharedRecovery('word').clear().catch(() => undefined);
    },
    load,
    author: () => services.settings.get(AUTHOR, T.app.defaultAuthor),
    csv: () => csvRef.current,
    setCsv: (v) => {
      csvRef.current = v;
      setCsv(v);
    },
    pageOfPos,
    scrollToPage,
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
  }), [services, schema, setMeta, setUi, setInfo, markModified, load, pageOfPos, scrollToPage, notify, setActiveComment]);
  const csvRef = useRef<Csv | null>(null);
  const act = useMemo(() => createActions(env), [env]);
  guardRef.current = () => confirm.guard(modifiedRef.current, infoRef.current.name, async () => {
    await act.save();
    return !modifiedRef.current;
  });

  // ---- Raccourcis de l'application (depuis le clavier de l'editeur).
  const shortcut = useCallback((id: ShortcutId): boolean => {
    const view = viewRef.current;
    switch (id) {
      case 'save': void act.save(); return true;
      case 'saveAs': setBackstage('saveAs'); return true;
      case 'open': void act.open(); return true;
      case 'new': void act.newDocument('blank'); return true;
      case 'print': setBackstage('print'); return true;
      case 'find': if (isOnlyOffice()) setDialog('find'); else setUi({ nav: true }); return true;
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
      case 'close': void act.close(); return true;
      case 'track': act.setTrack(!metaRef.current.settings.trackRevisions); return true;
      case 'marks': setUi({ showMarks: !uiRef.current.showMarks }); return true;
      case 'updateFields': act.updateFields(); return true;
      case 'viewPrint': setUi({ view: 'print' }); return true;
      case 'viewOutline': setUi({ view: 'outline' }); return true;
      case 'viewDraft': setUi({ view: 'draft' }); return true;
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
          startList: (spec) => {
            if (spec.kind === 'bullet') return act.list({ kind: 'bullet', char: spec.char });
            // Une nouvelle liste numerotee repart de 1 (comme Word), meme si le document en contient deja une identique.
            act.list({ kind: 'number', format: 'decimal', text: spec.text });
            act.restartNumbering();
          },
          linkAttrs: (address) => linkMarkAttrs(address, ''),
          getAutocorrect: () => (services.settings.get('word.autocorrect', true) ? { french: services.settings.get('word.autocorrect.french', true), capitalize: services.settings.get('word.autocorrect.capitalize', true) } : null),
          getKeyset: () => (services.settings.get<string>(KEYSET_SETTING, 'fr') === 'en' ? 'en' : 'fr'),
          shortcut: (id) => shortcutRef.current(id), onDeleteKey: (fwd) => { forwardDelete.current = fwd; },
        }),
      }),
      attributes: () => ({ class: 'fo-doc', spellcheck: String(uiRef.current.spell), lang: 'fr-FR', 'aria-label': T.app.editorLabel }),
      editable: () => !uiRef.current.readOnly,
      transformPastedHTML: (html) => DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'], FORBID_ATTR: ['style'] }),
      dispatchTransaction: (tr) => dispatchRef.current(tr),
      handleKeyDown: (v, e) => nudgeWithArrows(v, e),
      handleDOMEvents: {
        contextmenu: (_v, e) => {
          // Menu du navigateur : une fois, a la demande (« Corrections du navigateur »), ou quand le correcteur est coupe.
          if (nativeMenuNext.current) {
            nativeMenuNext.current = false;
            return false;
          }
          const ctl = ctlRef.current;
          if (!ctl) return false;
          miniRef.current?.showAt({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
          e.preventDefault();
          const target = e.target;
          // Clic droit sur une image : elle est selectionnee d'abord (comme Word), puis le menu est construit sur l'etat a jour.
          const hit = _v.posAtCoords({ left: e.clientX, top: e.clientY });
          const hitNode = hit && hit.inside >= 0 ? _v.state.doc.nodeAt(hit.inside) : null;
          if (hitNode?.type.name === 'atom' && (hitNode.attrs.data as Inline).type === 'image') _v.dispatch(_v.state.tr.setSelection(NodeSelection.create(_v.state.doc, hit!.inside)));
          const { clientX, clientY } = e;
          setTimeout(() => {
            const c = ctlRef.current;
            if (c) ctxMenu.open({ clientX, clientY }, editorMenu(c, clientX, clientY, { armNative: () => { nativeMenuNext.current = true; } }, target));
          }, 0);
          return true;
        },
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
    void sharedRecovery('word').pending().then((list) => list[0] && setRecovery(list[0]), () => undefined);
    services.setTitle(`${infoRef.current.name} - ${word.name}`);
    return () => { alive = false; };
  }, []);

  // ---- Fermeture normale : plus de copie a proposer ; ancienne copie unique des reglages supprimee.
  useEffect(() => {
    services.settings.set(LEGACY_RECOVERY, null);
    return sharedRecovery('word').clearOnExit();
  }, [services]);

  // ---- Sauvegarde de recuperation (30 s) et enregistrement automatique sur disque si un chemin est connu.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!modifiedRef.current) return;
      const doc = fullDocument(env);
      void writeDocument(doc, 'docx').then((bytes) => {
        if (bytes.length <= MAX_RECOVERY) void sharedRecovery('word').save({ name: infoRef.current.name, path: null, bytes }).catch(() => undefined);
        const i = infoRef.current;
        if (autoSave && i.path && isWritable(i.format) && (i.format === 'docx' || i.format === 'docm' || i.format === 'odt' || i.format === 'rtf')) {
          return writeDocument(doc, i.format).then((b) => services.saveFile(b, i.name, [{ name: word.name, extensions: [i.format] }], i.path)).then((saved) => {
            if (saved) {
              markModified(false);
              void sharedRecovery('word').clear().catch(() => undefined);
            }
          });
        }
        return undefined;
      }).catch((err: unknown) => notify(T.app.saveFailed(err instanceof Error ? err.message : String(err)), 'error'));
    }, 30_000);
    return () => clearInterval(timer);
  }, [env, autoSave, services, markModified, notify]);

  // ---- Apres chaque mise en page : hauteurs reelles des notes (la zone de texte des pages est reduite d'autant), espace des notes de fin.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let changed = false;
    canvas.querySelectorAll<HTMLElement>('.fo-word-notes [data-note]').forEach((el) => {
      const id = Number(el.dataset.note);
      const h = el.offsetHeight;
      if (Math.abs((noteHeightsRef.current.get(id) ?? 0) - h) > 1) {
        noteHeightsRef.current.set(id, h);
        changed = true;
      }
    });
    if (changed) {
      loopRef.current = 0;
      schedulePaginate();
    }
  }, [layout, schedulePaginate]);

  // ---- Virtualisation : seules les feuilles proches de l'ecran sont dessinees (documents de centaines de pages).
  const updateRange = useCallback(() => {
    const canvas = canvasRef.current;
    const sheets = layoutRef.current.sheets;
    if (!canvas || printingRef.current || sheets.length <= VIRTUAL_MIN) {
      setRange((r) => (r === null ? r : null));
      return;
    }
    const z = uiRef.current.zoom / 100;
    const pages = canvas.querySelector<HTMLElement>('.fo-word-pages');
    const top = (canvas.scrollTop - (pages?.offsetTop ?? 0)) / z;
    const bottom = top + canvas.clientHeight / z;
    let a = 0;
    while (a < sheets.length - 1 && sheets[a + 1]!.top <= top) a++;
    let b = a;
    while (b < sheets.length - 1 && sheets[b + 1]!.top < bottom) b++;
    const next = { from: Math.max(0, a - VIRTUAL_MARGIN), to: Math.min(sheets.length - 1, b + VIRTUAL_MARGIN) };
    setRange((r) => (r && r.from === next.from && r.to === next.to ? r : next));
  }, []);
  useLayoutEffect(updateRange, [layout, ui.zoom, ui.view, updateRange]);

  // ---- Polices : la pagination faite avant le chargement des @font-face (Calibri, Arial...) est refaite des qu'elles sont la.
  const fontKey = useMemo(() => documentFonts(meta).join('|'), [meta]);
  useEffect(() => remeasureWhenFontsReady(() => {
    loopRef.current = 0;
    schedulePaginate();
  }, fontKey ? fontKey.split('|') : []), [fontKey, schedulePaginate]);

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
      afterPrint(() => {
        printingRef.current = false;
        setPrinting(false);
      });
      services.print();
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
  const spans = useMemo(() => (state ? sectionSpans(state.doc, meta.finalSection) : [{ index: 0, section: meta.finalSection, paraPos: null, start: 0, end: 0 }]), [state?.doc, meta.finalSection]);
  const sections = useMemo(() => spans.map((x) => x.section), [spans]);
  const curSection = sections[state ? sectionIndexAt(spans, state.selection.from) : 0] ?? meta.finalSection;
  const sel = state ? selectionInfo(state, meta, undoDepth(state) as number, redoDepth(state) as number) : EMPTY_SELECTION;
  const docText = useMemo(() => state?.doc.textBetween(0, state.doc.content.size, '\n', ' ') ?? '', [state?.doc]);
  const words = useMemo(() => countWords(docText), [docText]);
  const headings = useMemo(() => (state && ui.nav ? collectHeadings(state.doc, meta) : []), [state?.doc, meta, ui.nav]);
  const searchCount = state ? searchKey.getState(state)?.matches.length ?? 0 : 0;
  const readingMinutes = useMemo(() => (ui.readingTimer ? advancedStats(docText).readingMinutes : 0), [docText, ui.readingTimer]);

  const ctl: Ctl = {
    services, schema, meta, sel, ui, pageCount: layout.pages, section: curSection, sectionCount: sections.length, sectionIndex: state ? sectionIndexAt(spans, state.selection.from) : 0, author, csv, setUi,
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
  // Crochet du banc de conformite (developpement seulement).
  useEffect(() => (import.meta.env.DEV ? registerProbe(wordProbe({ view: () => viewRef.current, meta: () => metaRef.current, ui: () => uiRef.current, setUi })) : undefined), []);
  ctlRef.current = ctl;
  const mini = useSelectionMiniToolbar({ container: canvasRef, getRect: selectionBox, enabled: ui.miniBar && ui.view !== 'read' && !ui.readOnly && !hfEdit });
  miniRef.current = mini;
  const tabs = wordTabs(ctl);
  const commands = collectCommands(tabs);
  const caretPage = state && ui.view === 'print' ? Math.min(layout.pages, pageOfPos(state.selection.head)) : 1;
  const stylesheet = useMemo(() => {
    const s = sections[0] ?? meta.finalSection;
    return `${documentStylesheet(meta, '.fo-word .fo-doc')}\n@page{size:${s.pageWidth}pt ${s.pageHeight}pt;margin:0}\n.fo-word .fo-doc{${meta.settings.autoHyphenation ? 'hyphens:auto;' : ''}}`;
  }, [meta, sections]);

  const quickAccess: QuickAccessItem[] = [
    { id: 'save', label: T.qat.save, icon: 'save', shortcut: 'Ctrl+S', onClick: () => void act.save() },
    { id: 'undo', label: T.qat.undo, icon: 'arrow_undo', shortcut: 'Ctrl+Z', disabled: !sel.canUndo, onClick: () => ctl.run(undo) },
    { id: 'redo', label: T.qat.redo, icon: 'arrow_redo', shortcut: 'Ctrl+Y', disabled: !sel.canRedo, onClick: () => ctl.run(redo) },
    { id: 'print', label: T.qat.print, icon: 'print', defaultVisible: false, onClick: () => act.print() },
    { id: 'new', label: T.qat.newDoc, icon: 'document_add', defaultVisible: false, onClick: () => void act.newDocument('blank') },
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

  const paneTitle = ui.pane === 'comments' ? T.dialogs.commentsTitle : ui.pane === 'notes' ? T.dialogs.notesTitle : ui.pane === 'styles' ? T.cmd.stylesPane : ui.pane === 'revisions' ? X.reviewing.title : ui.pane === 'selection' ? X.objects.selectionPane : ui.pane === 'speech' ? X.voice.title : T.cmd.advancedStats;
  const pageW = px(curSection.pageWidth);
  const zoomFor = (fit: 'width' | 'page'): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 100;
    const byWidth = ((canvas.clientWidth - 48) / pageW) * 100;
    return Math.round(fit === 'width' ? byWidth : Math.min(byWidth, ((canvas.clientHeight - 32) / px(curSection.pageHeight)) * 100));
  };
  // Pincement a deux doigts sur la page.
  usePinchZoom(canvasRef, ui.zoom, (zoom) => setUi({ zoom }));
  // Telephone : la page s'ouvre ajustee a la largeur de l'ecran, sans descendre sous 70 % (en dessous le texte est illisible : defilement horizontal).
  useEffect(() => {
    if (window.matchMedia('(max-width: 719px)').matches) setUi({ zoom: Math.max(MOBILE_MIN_ZOOM, zoomFor('width')) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, au montage
  }, []);

  return (
    <div className={`fo-word${ui.focus ? ' is-focus' : ''}${printing ? ' is-printing' : ''}`} data-markup={ui.markup} data-marks={ui.showMarks ? 'on' : 'off'} style={{ '--fo-ins-color': ui.trackOpts.insColor, '--fo-del-color': ui.trackOpts.delColor, '--fo-ins-deco': ui.trackOpts.insStyle === 'underline' || ui.trackOpts.insStyle === 'double' ? 'underline' : 'none', '--fo-ins-deco-style': ui.trackOpts.insStyle === 'double' ? 'double' : 'solid', '--fo-ins-weight': ui.trackOpts.insStyle === 'bold' ? '700' : 'inherit' } as React.CSSProperties} data-outline={ui.view === 'outline' ? String(ui.outlineLevel) : undefined}>
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
      {!ui.focus && ui.view !== 'read' && <Ribbon tabs={tabs} onFile={(p) => setBackstage(p ?? 'home')} settings={services.settings} />}
      <div className="fo-word-main">
        {ui.nav && !ui.focus && (
          <TaskPane title={T.dialogs.navTitle} side="left" width={navWidth} onWidthChange={setNavWidth} onClose={() => { setUi({ nav: false }); act.findText(''); }}>
            <NavPane headings={headings} activePos={state?.selection.from ?? 0} results={searchCount} pageCount={layout.pages} thumbs={<PageThumbs sheets={layout.sheets} sections={sections} scale={0.2} onPick={act.gotoPage} max={60} />} onGo={(pos) => act.gotoPos(pos + 1)} onGoPage={act.gotoPage} onSearch={(q) => act.findText(q)}
              onMove={(from, to) => ctl.run(moveSection(headings, from, to))} onStep={(i, dir) => state && ctl.run(moveStep(state.doc, headings, i, dir))} onShift={(i, d) => ctl.run(shiftSection(headings, i, d))} />
          </TaskPane>
        )}
        <div className="fo-word-center">
          {ui.ruler && ui.view === 'print' && !ui.focus && !ui.multiPage && (
            <div className="fo-word-rulerbar"><Ruler section={curSection} para={sel.para} zoom={printing ? 100 : ui.zoom} onChange={(patch) => ctl.run(setParagraph({ props: patch }))} onContext={(e) => ctxMenu.open(e, rulerMenu(ctl))} /></div>
          )}
          <div ref={canvasRef} className={`fo-word-canvas fo-scroll${ui.view === 'read' ? ' is-read' : ''}`}
            onScroll={(e) => {
              updateRange();
              if (!ui.readingTimer) return;
              const el = e.currentTarget;
              setScrollFrac(el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 1);
            }}>
            <PageView
              onHFContext={(e, kind) => ctxMenu.open(e, headerFooterMenu(ctl, kind))}
              overlay={!ui.readOnly ? <DocOverlays ctl={ctl} view={view} meta={meta} pagesRef={pagesRef} /> : null}
              schema={schema} meta={meta} sections={sections} range={range} ui={printing ? { ...ui, zoom: 100 } : ui} layout={layout} gap={printing ? 0 : PAGE_GAP} mountRef={mountRef}
              hfEdit={hfEdit}
              onEditHF={(e) => {
                if (e && !e.id) act.editHeaderFooter(e.kind);
                else setHfEdit(e);
              }}
              onHFChange={(id, blocks: Block[]) => setMeta({ ...metaRef.current, headersFooters: { ...metaRef.current.headersFooters, [id]: { ...metaRef.current.headersFooters[id]!, blocks } } })} />
            {ui.multiPage && (
              <div className="fo-word-multipage">
                <PageThumbs sheets={layout.sheets} sections={sections} scale={0.3} onPick={(page) => {
                  setUi({ multiPage: false });
                  requestAnimationFrame(() => scrollToPage(page));
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
            {ui.pane === 'styles' && <StylesPane c={ctl} />}
            {ui.pane === 'revisions' && <ReviewingPane c={ctl} />}
            {ui.pane === 'selection' && <SelectionPane c={ctl} />}
            {ui.pane === 'speech' && <SpeechPane c={ctl} />}
            {ui.pane === 'stats' && <StatsPane text={docText} selection={sel.text} />}
          </TaskPane>
        )}
      </div>
      {!ui.focus && (
        <StatusBar
          onContextMenu={(e) => ctxMenu.open(e, statusMenu(ctl))}
          left={([
            { id: 'page', label: T.status.page(caretPage, layout.pages), onClick: () => setDialog('goto') },
            { id: 'stats', label: 'Statistiques', icon: 'text_word_count', onClick: () => setDialog('stats') },
            { id: 'words', label: sel.empty ? T.status.words(words) : T.status.wordsOf(countWords(sel.text), words), onClick: () => setDialog('stats') },
            { id: 'proof', label: '', icon: 'text_proofing_tools', title: T.status.proofing, onClick: () => setDialog('spelling') },
            { id: 'lang', label: currentLanguageName(ctl), title: T.cmd.language, onClick: () => ctxMenu.open({ clientX: 260, clientY: window.innerHeight - 30 }, languageItems(ctl)) },
            ...(meta.settings.trackRevisions ? [{ id: 'track', label: T.status.track, onClick: () => act.setTrack(false) }] : []),
            ...(ui.readingTimer ? [{ id: 'timer', label: ui.view === 'read' ? T.status.remaining(formatMinutes(readingMinutes * (1 - scrollFrac))) : T.status.reading(formatMinutes(readingMinutes)) }] : []),
          ] as StatusItem[]).filter((item) => !ui.statusHidden.includes(item.id))}
          views={[{ id: 'read', label: T.views.read, icon: 'book_open' }, { id: 'print', label: T.views.print, icon: 'document_one_page' }, { id: 'web', label: T.views.web, icon: 'globe' }]}
          activeView={ui.view}
          onViewChange={(id) => setUi({ view: id as UiState['view'], multiPage: false })}
          zoom={ui.zoom}
          onZoomChange={(zoom) => setUi({ zoom })}
          zoomPresets={[{ label: T.cmd.pageWidth, compute: () => zoomFor('width') }, { label: T.cmd.onePage, compute: () => zoomFor('page') }]}
        />
      )}
      <Backstage open={backstage !== null} appName={word.name} pages={backstagePages({ c: ctl, env, pageCount: layout.pages, sheets: layout.sheets, sections, close: () => setBackstage(null), author, setAuthor: (n) => { setAuthorState(n); services.settings.set(AUTHOR, n); } })}
        activePage={backstage ?? 'home'} onPageChange={setBackstage} onClose={() => setBackstage(null)} />
      {!ui.focus && ui.view !== 'read' && <MobileBar c={ctl} />}
      {!ui.focus && ui.view !== 'read' && <ImageHandles c={ctl} />}
      {confirm.dialog}
      {ctxMenu.menu}
      {mini.visible && mini.anchor && <MiniToolbar rows={miniBarRows(ctl, matchMedia('(pointer: coarse)').matches)} anchor={mini.anchor} label={T.cmd.miniBar} onClose={() => undefined} />}
      <WordDialogs id={dialog} c={ctl} env={env} onClose={() => { setDialog(null); viewRef.current?.focus(); }} />
      {recovery && (
        <Dialog open title={T.app.recoverTitle} onClose={() => setRecovery(null)}
          actions={[
            { label: T.app.restore, primary: true, onClick: () => {
              void readDocument(recovery.bytes, 'recuperation.docx').then((res) => {
                load(res.document, { name: recovery.name, path: null, format: 'docx' });
                markModified(true);
                notify(T.app.recovered, 'success');
              });
              void sharedRecovery('word').discard(recovery).catch(() => undefined);
              setRecovery(null);
            } },
            { label: T.app.discard, onClick: () => { void sharedRecovery('word').discard(recovery).catch(() => undefined); setRecovery(null); } },
          ]}>
          <p>{T.app.recoverText(recovery.name, new Date(recovery.savedAt).toLocaleString('fr-FR'))}</p>
        </Dialog>
      )}
    </div>
  );
}
