// Module PDF de ForgeOffice (lecteur + edition facon Acrobat, interface Office 2024) : miniatures, signets editables,
// recherche (regex, remplacement dans les commentaires), zoom, modes de lecture (continu, une page, deux pages, nuit, voix),
// rotation de l'affichage, annotations du fichier modifiables, formulaires, liens, pieces jointes, calques, signatures numeriques,
// organisation des pages, tampons, proprietes, protection, compression, PDF/A, OCR, comparaison, historique.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { MODULES, registerProbe, type ModuleProps } from '@forgeoffice/core';
import { availability, capabilities, input, outputTarget, pdfOps, runBytes, type Capabilities, type NamedBytes } from '@forgeoffice/convert';
import {
  Backstage, BackstageAction, BackstageHeading, BACKSTAGE_PAGES, Button, Icon, Ribbon, Spinner, StatusBar, TitleBar, collectCommands, clampZoom,
  stepZoom, usePersistentState, usePinchZoom, type BackstagePage, type MenuItem, type QuickAccessItem,
} from '@forgeoffice/ui';
import { buildContextMenu, type MenuContext } from './contextMenus.ts';
import { errorText, stem, useDialogActions, zip } from './dialogActions.ts';
import { PdfDialogs, type DialogState } from './dialogs.tsx';
import { DiscardDialog, GoToPageDialog, PrintDialog } from './dialogs-nav.tsx';
import { MergeDialog, type MergeEntry } from './dialogs-merge.tsx';
import { RedactFindDialog } from './dialogs-redact.tsx';
import { SanitizeDialog } from './dialogs-sanitize.tsx';
import { inspectHidden, sanitize, type HiddenReport } from './sanitize.ts';
import { attachmentBytes, type AttachmentInfo, type LinkInfo } from './extras.ts';
import { diffLines, newId, replaceIn, restyle, type Item, type Rect, type Tool } from './model.ts';
import type { Bookmark } from './outlines.ts';
import { writeOutline } from './outlines.ts';
import { PageView, type ToolOptions } from './PageView.tsx';
import { allText, canvasBytes, openPdf, renderPage } from './pdfdoc.ts';
import { pdfTabs, type PdfRibbonActions } from './ribbon.tsx';
import { Sidebar, type Panel } from './Sidebar.tsx';
import { speak, speechText, speechAvailable, stopSpeaking } from './speech.ts';
import { printBytes } from './print.ts';
import { useDoc } from './useDoc.ts';
import { emptyHistory, pushView, stepView, viewAction } from './viewkeys.ts';
import { pdfProbe, type PdfSources } from './probe.ts';
import { useExtras } from './useExtras.ts';
import { useText } from './useText.ts';
import { S } from './strings.ts';
import './Pdf.css';

const info = MODULES.pdf;
const PT = 4 / 3;
const PDF_FILTER = [{ name: 'PDF', extensions: ['pdf'] }];

export function PdfApp({ services, file }: ModuleProps) {
  const d = useDoc(services);
  const { state, pdf, native } = d;
  const [zoom, setZoom] = usePersistentState<number>(services.settings, 'pdf.zoom', 100);
  const [twoPages, setTwoPages] = usePersistentState<boolean>(services.settings, 'pdf.twoPages', false);
  const [pageMode, setPageMode] = usePersistentState<'continuous' | 'single'>(services.settings, 'pdf.pageMode', 'continuous');
  const [night, setNight] = usePersistentState<boolean>(services.settings, 'pdf.night', false);
  const [panel, setPanel] = usePersistentState<Panel | null>(services.settings, 'pdf.panel', 'thumbs');
  const [author] = usePersistentState<string>(services.settings, 'user.name', 'Utilisateur');
  const [viewRotation, setViewRotation] = useState(0);
  const [tool, setToolState] = useState<Tool>('select');
  const [opts, setOpts] = useState<ToolOptions>({ color: '#D13438', markColor: '#FFE500', width: 2, fontSize: 12, stamp: 'approuve', field: 'texte', signature: null, author });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set([0]));
  const [replacement, setReplacement] = useState('');
  const [fillForm, setFillForm] = useState(true);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [backstage, setBackstage] = useState<string | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [firstSize, setFirstSize] = useState({ w: 612, h: 792 });
  const [dragging, setDragging] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [redactFind, setRedactFind] = useState<{ query: string } | null>(null);
  const [hidden, setHidden] = useState<HiddenReport | null>(null);
  const [mergeFrom, setMergeFrom] = useState<MergeEntry | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  const [readingMode, setReadingMode] = useState(false);
  const views = useRef(emptyHistory(0));
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const viewerRef = useRef<HTMLDivElement>(null);
  const signTarget = useRef<{ page: number; rect: Rect } | null>(null);
  const reading = useRef(false);
  usePinchZoom(viewerRef, zoom, (z) => setZoom(clampZoom(z))); // pincement a deux doigts
  const pdfRef = useRef(pdf);
  pdfRef.current = pdf;
  const text = useText(pdf);
  const [fullscreenOn, setFullscreenOn] = useState(false);
  useEffect(() => { const f = () => setFullscreenOn(document.fullscreenElement !== null); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  const extras = useExtras(pdf, panel === 'comments');
  // Crochet du banc de conformite (developpement seulement).
  const probeRef = useRef<PdfSources | null>(null);
  if (import.meta.env.DEV) probeRef.current = { state, name: d.info?.name ?? null, pages: pdf?.numPages ?? 0, fields: d.fields, current, selectedPages, zoom, tool, twoPages, viewRotation, query: text.query, opts: { ...opts }, fullscreen: fullscreenOn, setCurrent, setSelectedPages };
  useEffect(() => (import.meta.env.DEV ? registerProbe(pdfProbe(() => probeRef.current as PdfSources)) : undefined), []);
  const { boxes, needBoxes } = text;

  useEffect(() => {
    if (file) void d.load(file);
  }, [file]);
  useEffect(() => {
    if (native) capabilities(native).then(setCaps, () => undefined);
  }, [native]);

  // Nouveau document pdf.js : taille de reference, avis remis a zero.
  useEffect(() => {
    if (!pdf) return;
    pdf.getPage(1).then((p) => {
      const v = p.getViewport({ scale: 1 });
      setFirstSize({ w: v.width, h: v.height });
    }, () => undefined);
    setCurrent((c) => Math.min(c, pdf.numPages - 1));
  }, [pdf]);
  useEffect(() => setDismissed(new Set()), [d.info?.name]);

  const pageCount = pdf?.numPages ?? 0;
  const editable = d.editable;
  const setTool = useCallback((t: Tool) => {
    setToolState(t);
    setSelectedId(null);
  }, []);

  const single = pageMode === 'single';
  const spreadStart = twoPages ? current - (current % 2) : current;
  const goTo = useCallback((page: number, rect?: Rect) => {
    setCurrent(page);
    if (single) {
      viewerRef.current?.scrollTo({ top: 0 });
      return;
    }
    const el = viewerRef.current?.querySelector<HTMLElement>(`[data-page="${page + 1}"]`);
    if (!el) return;
    if (rect) {
      const c = viewerRef.current;
      if (c) c.scrollTo({ top: el.offsetTop + rect.y * el.offsetHeight - c.clientHeight / 3, behavior: 'smooth' });
    } else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [single]);
  useEffect(() => {
    if (single) viewerRef.current?.scrollTo({ top: 0 });
  }, [single, spreadStart]);
  // Saut (lien, signet, Aller à la page, Début/Fin) : la page quittée est gardée pour « Vue précédente ».
  const jump = useCallback((page: number, rect?: Rect) => {
    views.current = pushView(views.current, current, page);
    goTo(page, rect);
  }, [current, goTo]);
  const stepViews = useCallback((dir: 1 | -1) => {
    const r = stepView(views.current, dir);
    views.current = r.history;
    if (r.page !== null) goTo(r.page);
  }, [goTo]);
  // Ouvrir un autre fichier ou fermer : propose d'enregistrer d'abord s'il reste des modifications.
  const guard = useCallback((run: () => void) => { if (d.modified) setDiscard(() => run); else run(); }, [d.modified]);

  const nativeReason = useCallback((op: string): string | null => {
    if (!native) return S.errors.needNative;
    const a = availability(caps, op);
    return caps === null || a.ok ? null : a.reason;
  }, [native, caps]);

  const pagesSel = useCallback((): number[] => [...(selectedPages.size > 0 ? selectedPages : new Set([current]))].sort((a, b) => a - b), [selectedPages, current]);

  const nativeOp = useCallback((label: string, op: Record<string, unknown>) => d.mutate(label, async (bytes) => {
    if (!native) throw new Error(S.errors.needNative);
    const res = await runBytes(native, { op: 'pdf', entree: input(0), sortie: outputTarget('document.pdf'), ...op }, [{ name: 'document.pdf', bytes }]);
    const out = res.files[0];
    if (!out) throw new Error(S.errors.needNative);
    return out.bytes;
  }), [d, native]);

  const pickPdf = useCallback(async () => {
    try {
      return await services.openFile(PDF_FILTER);
    } catch (err) {
      services.notify(errorText(err), 'error');
      return null;
    }
  }, [services]);

  const openAnother = useCallback(() => guard(() => void pickPdf().then((f) => f && d.load(f))), [guard, pickPdf, d]);

  const saveBytes = useCallback(async (bytes: Uint8Array, name: string, ext: string) => {
    try {
      await services.saveFile(bytes, name, [{ name: ext.toUpperCase(), extensions: [ext] }], null);
    } catch (err) {
      services.notify(errorText(err), 'error');
    }
  }, [services]);

  const { onDialog, openDialog } = useDialogActions({ d, services, pageCount, current, firstSize, pagesSel, setDialog, setOpts, setTool, signTarget, nativeOp, saveBytes });

  const exportAs = useCallback(async (kind: 'images' | 'text' | 'word') => {
    const cur = await d.flush();
    if (!cur || !d.info) return;
    d.setBusy(S.groups.export);
    try {
      const name = stem(d.info.name);
      if (kind === 'word') {
        if (!native) throw new Error(S.errors.needNative);
        const res = await runBytes(native, { op: 'convertir', entree: input(0), vers: 'docx', sortie: outputTarget(`${name}.docx`) }, [{ name: 'document.pdf', bytes: cur.bytes }]);
        const out = res.files[0];
        if (out) await saveBytes(out.bytes, out.name, 'docx');
        return;
      }
      const doc = await openPdf(cur.bytes, d.info.lockedPassword ?? undefined);
      try {
        if (kind === 'text') {
          await saveBytes(new TextEncoder().encode((await allText(doc)).join('\n\f')), `${name}.txt`, 'txt');
          return;
        }
        const images = [];
        for (let i = 1; i <= doc.numPages; i++) images.push({ name: `${name}-page-${i}.png`, bytes: await canvasBytes(await renderPage(await doc.getPage(i), 150 / 72), 'image/png') });
        await saveBytes(await zip(images), `${name}-images.zip`, 'zip');
        services.notify(S.done.exported(images.length), 'success');
      } finally {
        await doc.loadingTask.destroy();
      }
    } catch (err) {
      services.notify(errorText(err), 'error');
    } finally {
      d.setBusy(null);
    }
  }, [d, native, saveBytes, services]);

  const doPrint = useCallback(async (pages: number[] | null) => {
    setPrintOpen(false);
    const cur = await d.flush();
    if (cur) await printBytes(cur.bytes, pages);
  }, [d]);

  const fitValue = useCallback((kind: 'width' | 'page'): number => {
    const c = viewerRef.current;
    if (!c) return zoom;
    const cols = twoPages ? 2 : 1;
    const odd = viewRotation % 180 === 90;
    const pw = (odd ? firstSize.h : firstSize.w) * PT;
    const ph = (odd ? firstSize.w : firstSize.h) * PT;
    const zw = ((c.clientWidth - 48 - (cols - 1) * 16) / cols / pw) * 100;
    const zh = ((c.clientHeight - 32) / ph) * 100;
    return clampZoom(Math.floor(kind === 'width' ? zw : Math.min(zw, zh)));
  }, [twoPages, firstSize, zoom, viewRotation]);
  const fitZoom = useCallback((kind: 'width' | 'page') => setZoom(fitValue(kind)), [fitValue, setZoom]);

  const compare = useCallback(async () => {
    const other = await pickPdf();
    if (!other || !state || !d.info) return;
    d.setBusy(S.compare);
    try {
      const [a, b] = await Promise.all([openPdf(state.bytes, d.info.lockedPassword ?? undefined), openPdf(other.bytes)]);
      const lines = (doc: string[]) => doc.join('\n').split('\n').map((l) => l.trim());
      const [ta, tb] = await Promise.all([allText(a), allText(b)]);
      await Promise.all([a.loadingTask.destroy(), b.loadingTask.destroy()]);
      setDialog({ kind: 'compare', name: other.name, lines: diffLines(lines(ta), lines(tb)) });
    } catch (err) {
      services.notify(errorText(err), 'error');
    } finally {
      d.setBusy(null);
    }
  }, [pickPdf, state, d, services]);

  // Lecture a voix haute : page par page, jusqu'a la fin du document ou l'arret.
  const stopReading = useCallback(() => {
    reading.current = false;
    stopSpeaking();
    setSpeaking(false);
  }, []);
  const readPage = useCallback(async (index: number): Promise<void> => {
    if (!pdf || !reading.current) return;
    goTo(index);
    const content = await (await pdf.getPage(index + 1)).getTextContent();
    const t = speechText(content.items.flatMap((i) => ('str' in i ? [{ str: i.str, hasEOL: i.hasEOL }] : [])));
    if (t === '') {
      if (index + 1 < pdf.numPages) await readPage(index + 1);
      else stopReading();
      return;
    }
    speak(t, (completed) => {
      if (completed && reading.current && index + 1 < pdf.numPages) void readPage(index + 1);
      else stopReading();
    });
  }, [pdf, goTo, stopReading]);
  const toggleSpeech = useCallback(() => {
    if (reading.current) {
      stopReading();
      return;
    }
    if (!speechAvailable()) {
      services.notify(S.reading.noSpeech, 'warning');
      return;
    }
    reading.current = true;
    setSpeaking(true);
    void readPage(current);
  }, [current, readPage, services, stopReading]);
  useEffect(() => stopReading, [pdf, stopReading]);

  const onLink = useCallback((link: LinkInfo) => {
    if (link.page !== null) jump(link.page);
    else if (link.url) setDialog({ kind: 'link', url: link.url });
  }, [jump]);

  const saveAttachment = useCallback(async (a: AttachmentInfo) => {
    if (!pdf) return;
    try {
      const name = a.name.replace(/[\\/:*?"<>|]/g, '_');
      const ext = name.includes('.') ? (name.split('.').pop() ?? 'bin') : 'bin';
      await services.saveFile(await attachmentBytes(pdf, a.id), name, [{ name: ext.toUpperCase(), extensions: [ext] }], null);
    } catch (err) {
      services.notify(errorText(err), 'error');
    }
  }, [pdf, services]);

  const editBookmarks = useCallback((tree: Bookmark[]) => void d.mutate(S.bookmarks, (b) => writeOutline(b, tree)), [d]);

  // Remplacement dans le texte des commentaires (notes, zones de texte, surlignages), ajoutes ou deja dans le fichier.
  const replaceInComments = useCallback(() => {
    let n = 0;
    for (const it of d.allItems) {
      if (it.kind !== 'note' && it.kind !== 'freetext' && it.kind !== 'mark') continue;
      const next = replaceIn(it.text, text.query, replacement, text.options);
      if (next !== it.text) {
        d.changeItem({ ...it, text: next });
        n++;
      }
    }
    services.notify(S.finder.replaced(n), n > 0 ? 'success' : 'info');
  }, [d, text.query, text.options, replacement, services]);

  // Menu du clic droit dans la page (texte selectionne, annotation, champ, fond).
  const buildMenu = useCallback((ctx: MenuContext, editText: (id: string) => void): MenuItem[] => {
    const base = { page: ctx.page, author, at: Date.now() };
    const fieldCleared = (name: string): string | boolean => (d.fields.find((f) => f.name === name)?.type === 'case' ? false : '');
    return buildContextMenu(ctx, {
      editable, pageCount, copy: (t) => void navigator.clipboard?.writeText(t).catch((err: unknown) => services.notify(errorText(err), 'error')),
      addMarkup: (kind, rects, t) => d.addItem({ ...base, id: newId(), kind: 'mark', mark: kind, rects: [...rects], color: kind === 'highlight' ? opts.markColor : kind === 'underline' ? '#185ABD' : '#D13438', text: t }),
      addNote: (page, at) => { const it: Item = { ...base, page, id: newId(), kind: 'note', pos: at, text: '', color: '#FFE500' }; d.addItem(it); setSelectedId(it.id); editText(it.id); },
      addFreeText: (page, at) => { const it: Item = { ...base, page, id: newId(), kind: 'freetext', rect: { x: at.x, y: at.y, w: 0.3, h: 0.04 }, text: '', size: opts.fontSize, color: opts.color }; d.addItem(it); setSelectedId(it.id); editText(it.id); },
      search: (t) => { text.setQuery(t); setPanel('search'); },
      speak: (t) => { if (speechAvailable()) speak(t, () => undefined); else services.notify(S.reading.noSpeech, 'warning'); },
      changeItem: d.changeItem, removeItem: (id) => { d.removeItems(new Set([id]), S.clearItems); setSelectedId(null); }, editText,
      rotatePage: (page, dir) => void d.mutate(dir > 0 ? S.rotateRight : S.rotateLeft, (b) => pdfOps.rotate(b, dir * 90, [page])),
      insertBlank: (page) => void d.mutate(S.insertBlank, (b) => pdfOps.insertBlank(b, page + 1)),
      deletePage: (page) => void d.mutate(S.deletePages, (b) => pdfOps.removePages(b, [page])),
      extractPage: (page) => void d.flush().then(async (cur) => { if (cur && d.info) await saveBytes(await pdfOps.extract(cur.bytes, [page]), `${stem(d.info.name)}-page-${page + 1}.pdf`, 'pdf'); }),
      fit: fitZoom, properties: () => void openDialog('metadata'),
      clearField: (name) => d.setValue(name, fieldCleared(name)),
      resetForm: () => d.fields.forEach((f) => d.setValue(f.name, fieldCleared(f.name))),
      hasFormValues: d.fields.some((f) => f.value !== '' && f.value !== false) || Object.keys(state?.values ?? {}).length > 0,
      signField: (page, rect) => { signTarget.current = { page, rect }; setDialog({ kind: 'signature' }); },
      applyRedactions: () => void d.flush().then((st) => st && services.notify(S.done.applied(S.applyRedactions), 'success')),
      redactSelection: (page, rects) => d.addItems(rects.map((rect) => ({ ...base, page, id: newId(), kind: 'redact' as const, rect })), S.kinds.redact),
    });
  }, [editable, pageCount, author, d, opts, services, text, setPanel, fitZoom, openDialog, saveBytes, state]);

  const pageMenu = useCallback((page: number): MenuItem[] => [
    { id: 'rl', label: S.rotateLeft, icon: 'arrow_counterclockwise', disabled: !editable, onClick: () => void d.mutate(S.rotateLeft, (b) => pdfOps.rotate(b, -90, pagesSel())) },
    { id: 'rr', label: S.rotateRight, icon: 'arrow_clockwise', disabled: !editable, onClick: () => void d.mutate(S.rotateRight, (b) => pdfOps.rotate(b, 90, pagesSel())) },
    { id: 's1', kind: 'separator' },
    { id: 'blank0', label: S.menus.blankBefore, icon: 'document_one_page_add', disabled: !editable, onClick: () => void d.mutate(S.menus.blankBefore, (b) => pdfOps.insertBlank(b, page)) },
    { id: 'blank', label: S.menus.blankAfter, icon: 'document_one_page_add', disabled: !editable, onClick: () => void d.mutate(S.insertBlank, (b) => pdfOps.insertBlank(b, page + 1)) },
    { id: 'dup', label: S.menus.duplicate, icon: 'copy', disabled: !editable, onClick: () => void d.mutate(S.menus.duplicate, async (b) => pdfOps.insertDocument(b, await pdfOps.extract(b, [page]), page + 1)) },
    { id: 'file', label: S.insertFile, icon: 'document_add', disabled: !editable, onClick: () => void pickPdf().then((f) => f && d.mutate(S.insertFile, (b) => pdfOps.insertDocument(b, f.bytes, page + 1))) },
    { id: 'extract', label: S.extractPages, icon: 'document_arrow_up', onClick: () => void openDialog('extract') },
    { id: 's1b', kind: 'separator' },
    { id: 'all', label: S.menus.selectAll, icon: 'select_all_on', onClick: () => setSelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i))) },
    { id: 's2', kind: 'separator' },
    { id: 'del', label: S.deletePages, icon: 'delete', disabled: !editable || pagesSel().length >= pageCount, onClick: () => void d.mutate(S.deletePages, (b) => pdfOps.removePages(b, pagesSel())) },
  ], [editable, d, pagesSel, pickPdf, openDialog, pageCount]);

  const step = twoPages ? 2 : 1;
  const actions: PdfRibbonActions = {
    setTool,
    setOpt: (patch) => {
      setOpts((o) => ({ ...o, ...patch }));
      // Les reglages s'appliquent aussi a l'element selectionne (comme dans Acrobat) : couleur, epaisseur, taille du texte.
      const sel = d.allItems.find((i) => i.id === selectedId);
      if (!sel) return;
      const color = sel.kind === 'mark' ? patch.markColor : patch.color;
      const next = restyle(sel, { color, width: patch.width, size: patch.fontSize });
      if (next) d.changeItem(next);
    },
    zoom: (dir) => setZoom(stepZoom(zoom, dir)),
    fit: fitZoom,
    rotateView: (dir) => setViewRotation((r) => (r + dir * 90 + 360) % 360),
    toggleTwoPages: () => { setTwoPages(!twoPages); window.setTimeout(() => goTo(current), 80); }, // la page courante reste en vue apres le recalage
    setPageMode,
    toggleNight: () => setNight(!night),
    toggleSpeech,
    fullScreen: () => void viewerRef.current?.requestFullscreen().catch(() => undefined),
    go: (delta) => goTo(Math.min(Math.max((single ? spreadStart : current) + delta * (single ? step : 1), 0), pageCount - 1)),
    goToPage: () => setGotoOpen(true),
    viewBack: () => stepViews(-1),
    viewForward: () => stepViews(1),
    toggleReadingMode: () => setReadingMode((r) => !r),
    find: () => setPanel('search'),
    showPanel: (p) => setPanel(panel === p ? null : p),
    clearItems: () => d.removeItems(null, S.clearItems),
    toggleFill: () => setFillForm(!fillForm),
    flatten: () => void d.flush(true).then(() => services.notify(S.done.flattened, 'success')),
    dialog: (k) => void openDialog(k),
    rotatePages: (dir) => void d.mutate(dir > 0 ? S.rotateRight : S.rotateLeft, (b) => pdfOps.rotate(b, dir * 90, pagesSel())),
    deletePages: () => void d.mutate(S.deletePages, (b) => pdfOps.removePages(b, pagesSel())).then(() => setSelectedPages(new Set([0]))),
    insertBlank: () => void d.mutate(S.insertBlank, (b) => pdfOps.insertBlank(b, current + 1)),
    insertFile: () => void pickPdf().then((f) => f && d.mutate(S.insertFile, (b) => pdfOps.insertDocument(b, f.bytes, current + 1))),
    merge: () => void d.flush().then(async (cur) => { if (cur && d.info) setMergeFrom({ name: d.info.name, bytes: cur.bytes, pages: pageCount, current: true }); }),
    applyRedactions: () => void d.flush().then((s) => s && services.notify(S.done.applied(S.applyRedactions), 'success')),
    redactFind: () => setRedactFind({ query: '' }),
    sanitize: () => void d.flush().then(async (cur) => { if (cur) setHidden(await inspectHidden(cur.bytes)); }).catch((err: unknown) => services.notify(errorText(err), 'error')),
    unprotect: () => {
      if (d.info && state) d.setAskPassword({ file: { name: d.info.name, path: d.info.path, bytes: state.bytes }, error: false });
    },
    pdfa: () => void d.mutate(S.pdfa, async (b) => {
      if (!native) throw new Error(S.errors.needNative);
      const out = (await runBytes(native, { op: 'pdf_a', entree: input(0), sortie: outputTarget('pdfa.pdf') }, [{ name: 'document.pdf', bytes: b }])).files[0];
      if (!out) throw new Error(S.errors.needNative);
      return out.bytes;
    }),
    compare: () => void compare(),
    exportAs: (k) => void exportAs(k),
  };

  const items = d.allItems;
  const pendingRedactions = state?.items.filter((i) => i.kind === 'redact').length ?? 0;
  const fieldNames = useMemo(() => new Set([...d.fields.map((f) => f.name), ...(state?.items.flatMap((i) => (i.kind === 'field' ? [i.name] : [])) ?? [])]), [d.fields, state]);
  const tabs = pdfTabs({
    hasDoc: state !== null, editable: d.editable, lockedReason: S.tips.locked, tool, color: opts.color, markColor: opts.markColor, width: opts.width,
    fontSize: opts.fontSize, stamp: opts.stamp, field: opts.field, twoPages, pageMode, night, readingMode, speaking, fillForm, hasFields: d.fields.length > 0, pendingRedactions, hasItems: (state?.items.length ?? 0) > 0,
    selectedPages: pagesSel().length, pageCount, nativeReason,
  }, actions);
  const commands = useMemo(() => collectCommands(tabs), [tabs]);

  // Raccourcis d'affichage et de navigation (Ctrl +/-/0/1/2, Début/Fin, F3, Ctrl+Maj+N, Ctrl+H, Alt+flèches).
  const runView = useCallback((a: NonNullable<ReturnType<typeof viewAction>>) => {
    const hit = (dir: 1 | -1): void => {
      const n = text.hits.length;
      if (n === 0) { setPanel('search'); return; }
      const i = (text.activeHit + dir + n) % n;
      text.setActiveHit(i);
      const h = text.hits[i];
      if (h) jump(h.page, text.hitRects[i] ?? undefined);
    };
    switch (a) {
      case 'zoomIn': setZoom(stepZoom(zoom, 1)); break;
      case 'zoomOut': setZoom(stepZoom(zoom, -1)); break;
      case 'actualSize': setZoom(100); break;
      case 'fitPage': fitZoom('page'); break;
      case 'fitWidth': fitZoom('width'); break;
      case 'firstPage': if (pageCount > 0) jump(0); break;
      case 'lastPage': if (pageCount > 0) jump(pageCount - 1); break;
      case 'findNext': hit(1); break;
      case 'findPrevious': hit(-1); break;
      case 'goToPage': if (pageCount > 0) setGotoOpen(true); break;
      case 'readingMode': setReadingMode((r) => !r); break;
      case 'back': stepViews(-1); break;
      case 'forward': stepViews(1); break;
    }
  }, [text, setPanel, jump, zoom, setZoom, fitZoom, pageCount, stepViews]);

  // Ctrl + molette : zoom (écouteur non passif pour empêcher le zoom du navigateur).
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(stepZoom(zoom, e.deltaY < 0 ? 1 : -1));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, setZoom]);

  // Raccourcis clavier (Acrobat / Office).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
      const k = e.key.toLowerCase();
      const view = viewAction(e);
      if (e.ctrlKey && k === 's') {
        e.preventDefault();
        void d.save(e.shiftKey);
      } else if (e.ctrlKey && k === 'o') {
        e.preventDefault();
        openAnother();
      } else if (e.ctrlKey && k === 'p') {
        e.preventDefault();
        setPrintOpen(true);
      } else if (e.ctrlKey && k === 'f') {
        e.preventDefault();
        setPanel('search');
      } else if (view !== null && (!typing || e.ctrlKey || view === 'findNext' || view === 'findPrevious')) {
        e.preventDefault();
        runView(view);
      } else if (typing) {
        return;
      } else if (e.ctrlKey && k === 'z') {
        e.preventDefault();
        d.undo();
      } else if (e.ctrlKey && k === 'y') {
        e.preventDefault();
        d.redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        d.removeItems(new Set([selectedId]), S.clearItems);
        setSelectedId(null);
      } else if (e.key === 'Escape') { if (readingMode) setReadingMode(false); else setTool('select'); }
      else if (e.key === 'PageDown') goTo(Math.min((single ? spreadStart : current) + (single ? step : 1), pageCount - 1));
      else if (e.key === 'PageUp') goTo(Math.max((single ? spreadStart : current) - (single ? step : 1), 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d, openAnother, runView, readingMode, setPanel, selectedId, setTool, goTo, current, pageCount, single, spreadStart, step]);

  const scale = (zoom / 100) * PT;
  const quickAccess: QuickAccessItem[] = [
    { id: 'save', label: S.save, icon: 'save', shortcut: 'Ctrl+S', disabled: !state, onClick: () => void d.save(false) },
    { id: 'undo', label: S.undo, icon: 'arrow_undo', shortcut: 'Ctrl+Z', disabled: !d.canUndo, onClick: d.undo },
    { id: 'redo', label: S.redo, icon: 'arrow_redo', shortcut: 'Ctrl+Y', disabled: !d.canRedo, onClick: d.redo },
    { id: 'print', label: S.print, icon: 'print', defaultVisible: false, onClick: () => setPrintOpen(true) },
  ];

  const backstagePages: BackstagePage[] = [
    { ...BACKSTAGE_PAGES.info, render: () => (
      <>
        <BackstageHeading>{S.backstage.infoTitle}</BackstageHeading>
        {d.info && <p className="pdf-muted">{d.info.name} · {pageCount} {S.backstage.pages.toLowerCase()} · {state ? `${Math.round(state.bytes.length / 1024)} Ko` : ''}</p>}
        <BackstageAction icon="lock_closed" title={S.backstage.protectTitle} description={S.backstage.protectText} onClick={() => { setBackstage(null); void openDialog('protect'); }} />
        <BackstageAction icon="certificate" title={S.sign.digital} description={S.sign.digitalTip} onClick={() => { setBackstage(null); void openDialog('digitalSign'); }} />
        <BackstageAction icon="info" title={S.backstage.inspectTitle} description={S.backstage.inspectText} onClick={() => { setBackstage(null); void openDialog('metadata'); }} />
        <BackstageAction icon="folder_zip" title={S.backstage.compressTitle} description={nativeReason('compresser') ?? S.backstage.compressText} onClick={() => { setBackstage(null); void openDialog('compress'); }} />
      </>
    ) },
    { ...BACKSTAGE_PAGES.open, onSelect: () => { setBackstage(null); openAnother(); } },
    { ...BACKSTAGE_PAGES.save, disabled: !state, onSelect: () => { setBackstage(null); void d.save(false); } },
    { ...BACKSTAGE_PAGES.saveAs, disabled: !state, onSelect: () => { setBackstage(null); void d.save(true); } },
    { ...BACKSTAGE_PAGES.print, disabled: !state, render: () => (
      <>
        <BackstageHeading actions={<Button appearance="primary" icon="print" onClick={() => { setBackstage(null); setPrintOpen(true); }}>{S.print}</Button>}>{S.backstage.printTitle}</BackstageHeading>
        <p className="pdf-muted">{S.backstage.printText}</p>
      </>
    ) },
    { ...BACKSTAGE_PAGES.export, disabled: !state, render: () => (
      <>
        <BackstageHeading>{S.backstage.exportTitle}</BackstageHeading>
        <BackstageAction icon="image_multiple" title={S.exportImages} description={S.backstage.exportImages} onClick={() => { setBackstage(null); void exportAs('images'); }} />
        <BackstageAction icon="document_text" title={S.exportText} description={S.backstage.exportText} onClick={() => { setBackstage(null); void exportAs('text'); }} />
        <BackstageAction icon="document_text_extract" title={S.exportWord} description={nativeReason('convertir') ?? S.backstage.exportWord} onClick={() => { setBackstage(null); if (native) void exportAs('word'); }} />
      </>
    ) },
    { ...BACKSTAGE_PAGES.close, onSelect: () => { setBackstage(null); guard(() => services.close()); } },
  ];

  const onDrop = async (e: DragEvent): Promise<void> => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      const file = { name: f.name, path: null, bytes: new Uint8Array(await f.arrayBuffer()) };
      guard(() => void d.load(file));
    }
  };

  const fieldsByPage = (page: number) => d.fields.flatMap((field) => field.widgets.filter((w) => w.page === page).map((widget) => ({ field, widget })));
  const shown = !pdf ? [] : single
    ? (twoPages ? [spreadStart, spreadStart + 1] : [current]).filter((i) => i >= 0 && i < pdf.numPages)
    : Array.from({ length: pdf.numPages }, (_, i) => i);
  const pendingCount = state ? state.items.length + Object.keys(state.values).length + Object.keys(state.annotEdits).length : 0;

  // Avis : XFA, JavaScript (jamais execute), signatures numeriques.
  const badSignature = d.signatures.some((r) => r.integrity === 'modified' || r.signature === 'invalid');
  const notices = [
    ...(d.flags.xfa ? [{ id: 'xfa', icon: 'warning' as const, text: S.notices.xfa, see: false }] : []),
    ...(d.flags.javascript ? [{ id: 'js', icon: 'warning' as const, text: S.notices.javascript, see: false }] : []),
    ...(d.signatures.length > 0 ? [{ id: 'sig', icon: (badSignature ? 'error_circle' : 'certificate') as 'error_circle' | 'certificate', text: `${S.sign.count(d.signatures.length)}${badSignature ? ` ${S.sign.states.modified}` : ''}`, see: true }] : []),
  ].filter((n) => !dismissed.has(n.id));

  return (
    <div className="pdf" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => void onDrop(e)}>
      <TitleBar app={info} documentName={d.info?.name} saveState={d.modified ? 'modified' : 'saved'} quickAccess={quickAccess} commands={commands}
        windowControls={services.windowControls} settings={services.settings} />
      {!readingMode && <Ribbon tabs={tabs} onFile={() => setBackstage(state ? 'info' : 'open')} settings={services.settings} />}
      {notices.length > 0 && !readingMode && (
        <div className="pdf-notices">
          {notices.map((n) => (
            <div key={n.id} className="pdf-notice" role="status">
              <Icon name={n.icon} size={18} />
              <span>{n.text}</span>
              {n.see && <button type="button" className="pdf-link" onClick={() => setPanel('signatures')}>{S.notices.see}</button>}
              <button type="button" className="pdf-iconbtn" aria-label={S.notices.dismiss} title={S.notices.dismiss} onClick={() => setDismissed(new Set([...dismissed, n.id]))}><Icon name="dismiss" size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="pdf-body">
        {!readingMode && <Sidebar panel={state ? panel : null} onPanel={setPanel} pdf={pdf} current={current} selected={selectedPages} onSelectPages={setSelectedPages} onGo={(p) => jump(p)}
          onMovePage={(from, to) => void d.mutate(S.groups.pages, (b) => pdfOps.reorder(b, Array.from({ length: pageCount }, (_, i) => i).filter((i) => i !== from).toSpliced(to, 0, from)))}
          pageMenu={pageMenu} bookmarks={{ tree: extras.outline, editable, currentPage: current, onChange: editBookmarks }}
          search={{
            query: text.query, onQuery: text.setQuery, options: text.options, onOptions: text.setOptions, valid: text.valid, hits: text.hits, activeHit: text.activeHit,
            onHit: (i) => { text.setActiveHit(i); const h = text.hits[i]; const r = text.hitRects[i]; if (h) jump(h.page, r ?? undefined); },
            replacement, onReplacement: setReplacement, onReplace: replaceInComments, canReplace: editable,
          }}
          items={items} foreign={extras.foreign} onItem={(i: Item) => { setSelectedId(i.id); goTo(i.page); }} onRemoveItem={(id) => d.removeItems(new Set([id]), S.clearItems)}
          attachments={extras.attachments} onSaveAttachment={(a) => void saveAttachment(a)} layers={extras.layers} onToggleLayer={extras.toggleLayer} signatures={d.signatures}
          log={state?.log ?? []} onUndoTo={d.undoTo} />}
        <div ref={viewerRef} className={`pdf-viewer${twoPages ? ' is-double' : ''}${tool === 'hand' ? ' is-hand' : ''}${night ? ' is-night' : ''}`}
          onPointerDown={(e) => {
            if (tool !== 'hand' || e.pointerType === 'touch') return; // au doigt, le defilement natif s'en charge
            const el = e.currentTarget;
            const sx = e.clientX + el.scrollLeft;
            const sy = e.clientY + el.scrollTop;
            const move = (ev: PointerEvent): void => el.scrollTo(sx - ev.clientX, sy - ev.clientY);
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true });
          }}>
          {!state && (
            <div className="pdf-empty">
              <Icon name="document_pdf" size={48} color="var(--fo-accent)" />
              <h1>{S.empty.title}</h1>
              <p className="pdf-muted">{S.empty.text}</p>
              <Button appearance="primary" icon="folder_open" onClick={openAnother}>{S.empty.button}</Button>
            </div>
          )}
          {pdf && (
            <div className="pdf-pages">
              {shown.map((i) => (
                <PageView key={i} pdf={pdf} index={i} scale={scale} viewRotation={viewRotation} fallbackSize={firstSize} tool={tool} editable={editable} opts={{ ...opts, author }}
                  items={items.filter((it) => it.page === i)} selectedId={selectedId} fieldNames={fieldNames} onSelect={setSelectedId}
                  onAdd={(it) => { d.addItem(it); if (it.kind === 'signature' || it.kind === 'stamp') setTool('select'); }} onChange={d.changeItem}
                  onRemove={(id) => d.removeItems(new Set([id]), S.clearItems)}
                  fields={fieldsByPage(i)} values={state?.values ?? {}} fillForm={fillForm && d.editable} onValue={d.setValue}
                  onSignField={(page, rect) => { signTarget.current = { page, rect }; setDialog({ kind: 'signature' }); }}
                  hits={text.hits.flatMap((h, k) => (h.page === i && text.hitRects[k] ? [text.hitRects[k] as Rect] : []))} activeHit={text.hits[text.activeHit]?.page === i ? (text.hitRects[text.activeHit] ?? null) : null}
                  boxes={boxes.get(i)} needBoxes={needBoxes} onVisible={setCurrent} night={night}
                  layers={{ config: extras.layerConfig, version: extras.layerVersion }} onLink={onLink} buildMenu={buildMenu} />
              ))}
            </div>
          )}
          {d.busy && <div className="pdf-busy"><Spinner size={20} /><span>{d.busy}…</span></div>}
          {dragging && <div className="pdf-drop"><Icon name="arrow_download" size={40} /><span>{S.empty.title}</span></div>}
        </div>
      </div>
      <StatusBar
        left={state ? [
          { id: 'page', label: S.status.page(current + 1, pageCount) },
          ...(pendingCount > 0 ? [{ id: 'pending', label: S.status.pending(pendingCount), icon: 'edit' as const }] : []),
          ...(d.editable ? [] : [{ id: 'locked', label: S.status.locked, icon: 'lock_closed' as const }]),
          ...(tool !== 'select' ? [{ id: 'tool', label: S.status.tool(S.tools[tool]) }] : []),
          { id: 'engine', label: native ? S.status.native : S.status.web, icon: native ? 'checkmark' as const : 'info' as const },
        ] : []}
        views={[{ id: 'continuous', label: S.reading.continuous, icon: 'document_multiple' }, { id: 'single', label: S.reading.single, icon: 'document_one_page' }, { id: 'double', label: S.views.double, icon: 'book_open' }]}
        activeView={twoPages ? 'double' : single ? 'single' : 'continuous'}
        onViewChange={(v) => { setTwoPages(v === 'double'); setPageMode(v === 'single' ? 'single' : 'continuous'); }}
        zoom={zoom} onZoomChange={(z) => setZoom(clampZoom(z))}
        zoomPresets={[{ label: S.fitWidth, compute: () => fitValue('width') }, { label: S.fitPage, compute: () => fitValue('page') }]}
      />
      <Backstage open={backstage !== null} appName={info.name} pages={backstagePages} activePage={backstage ?? 'info'} onPageChange={setBackstage} onClose={() => setBackstage(null)} />
      <GoToPageDialog open={gotoOpen} pageCount={pageCount} current={current} onClose={() => setGotoOpen(false)} onGo={(p) => { setGotoOpen(false); jump(p); }} />
      <MergeDialog open={mergeFrom !== null} current={mergeFrom} onClose={() => setMergeFrom(null)} onError={(err) => services.notify(errorText(err), 'error')}
        onMerge={(entries) => { setMergeFrom(null); void d.mutate(S.mergeDialog.title, (b) => pdfOps.merge(entries.map((e) => (e.current ? b : e.bytes)))).then((ok) => ok && services.notify(S.mergeDialog.done, 'success')); }} />
      <SanitizeDialog report={hidden} onClose={() => setHidden(null)}
        onApply={(kinds) => { setHidden(null); void d.mutate(S.sanitize.title, (b) => sanitize(b, kinds)).then((ok) => ok && services.notify(S.sanitize.done, 'success')); }} />
      <RedactFindDialog open={redactFind !== null} pdf={pdf} initialQuery={redactFind?.query ?? ''} onClose={() => setRedactFind(null)}
        onMark={(zones) => { d.addItems(zones.map((z) => ({ id: newId(), page: z.page, author, at: Date.now(), kind: 'redact' as const, rect: z.rect })), S.kinds.redact); setRedactFind(null); services.notify(S.redactFind.marked(zones.length), 'success'); }} />
      <PrintDialog open={printOpen} pageCount={pageCount} current={current} selected={[...selectedPages]} onClose={() => setPrintOpen(false)} onPrint={(r) => void doPrint(r.pages)} />
      <DiscardDialog open={discard !== null} name={d.info?.name ?? ''} onClose={() => setDiscard(null)}
        onSave={() => { const run = discard; setDiscard(null); void d.save(false).then((ok) => { if (ok) run?.(); }); }}
        onDiscard={() => { const run = discard; setDiscard(null); run?.(); }} />
      <PdfDialogs state={d.askPassword ? { kind: 'password', error: d.askPassword.error } : dialog} onClose={() => { setDialog(null); d.setAskPassword(null); signTarget.current = null; }} onApply={onDialog} />
    </div>
  );
}
