// Module PDF de ForgeOffice (lecteur + edition facon Acrobat, interface Office 2024) : miniatures, signets,
// recherche, zoom, rotation de l'affichage, deux pages, plein ecran ; annotations, formulaires, texte, caviardage,
// organisation des pages, tampons, proprietes, protection, compression, PDF/A, OCR, comparaison, signature, historique.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { MODULES, type ModuleProps } from '@forgeoffice/core';
import { availability, capabilities, input, outputTarget, pdfOps, runBytes, type Capabilities, type NamedBytes } from '@forgeoffice/convert';
import {
  Backstage, BackstageAction, BackstageHeading, BACKSTAGE_PAGES, Button, Icon, Ribbon, Spinner, StatusBar, TitleBar, collectCommands, clampZoom,
  stepZoom, usePersistentState, usePinchZoom, type BackstagePage, type MenuItem, type QuickAccessItem,
} from '@forgeoffice/ui';
import { PdfDialogs, type DialogResult, type DialogState } from './dialogs.tsx';
import { diffLines, hitRect, search, type Item, type Rect, type TextBox, type Tool } from './model.ts';
import { PageView, type ToolOptions } from './PageView.tsx';
import { allText, canvasBytes, openPdf, outline as readOutline, renderPage, textBoxes, type OutlineNode } from './pdfdoc.ts';
import { pdfTabs, type PdfRibbonActions } from './ribbon.tsx';
import { Sidebar, type Panel } from './Sidebar.tsx';
import { useDoc } from './useDoc.ts';
import { S } from './strings.ts';
import './Pdf.css';

const info = MODULES.pdf;
const PT = 4 / 3;
const PDF_FILTER = [{ name: 'PDF', extensions: ['pdf'] }];
const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));
const stem = (name: string): string => name.replace(/\.pdf$/i, '');

async function zip(files: readonly NamedBytes[]): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const z = new JSZip();
  for (const f of files) z.file(f.name, f.bytes);
  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export function PdfApp({ services, file }: ModuleProps) {
  const d = useDoc(services);
  const { state, pdf, native } = d;
  const [zoom, setZoom] = usePersistentState<number>(services.settings, 'pdf.zoom', 100);
  const [twoPages, setTwoPages] = usePersistentState<boolean>(services.settings, 'pdf.twoPages', false);
  const [panel, setPanel] = usePersistentState<Panel | null>(services.settings, 'pdf.panel', 'thumbs');
  const [author] = usePersistentState<string>(services.settings, 'user.name', 'Utilisateur');
  const [viewRotation, setViewRotation] = useState(0);
  const [tool, setToolState] = useState<Tool>('select');
  const [opts, setOpts] = useState<ToolOptions>({ color: '#D13438', markColor: '#FFE500', width: 2, fontSize: 12, stamp: 'approuve', field: 'texte', signature: null, author });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set([0]));
  const [boxes, setBoxes] = useState<Map<number, TextBox[]>>(new Map());
  const [query, setQuery] = useState('');
  const [activeHit, setActiveHit] = useState(0);
  const [outline, setOutline] = useState<OutlineNode[] | null>(null);
  const [existing, setExisting] = useState<{ page: number; author: string; text: string; type: string }[]>([]);
  const [fillForm, setFillForm] = useState(true);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [backstage, setBackstage] = useState<string | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [firstSize, setFirstSize] = useState({ w: 612, h: 792 });
  const [dragging, setDragging] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  usePinchZoom(viewerRef, zoom, (z) => setZoom(clampZoom(z))); // pincement a deux doigts
  const pdfRef = useRef(pdf);
  pdfRef.current = pdf;

  useEffect(() => {
    if (file) void d.load(file);
  }, [file]);
  useEffect(() => {
    if (native) capabilities(native).then(setCaps, () => undefined);
  }, [native]);

  // Nouveau document pdf.js : signets, taille de reference, caches de texte remis a zero.
  useEffect(() => {
    setBoxes(new Map());
    setOutline(null);
    setExisting([]);
    if (!pdf) return;
    readOutline(pdf).then(setOutline, () => setOutline([]));
    pdf.getPage(1).then((p) => {
      const v = p.getViewport({ scale: 1 });
      setFirstSize({ w: v.width, h: v.height });
    }, () => undefined);
    setCurrent((c) => Math.min(c, pdf.numPages - 1));
  }, [pdf]);

  const pageCount = pdf?.numPages ?? 0;
  const editable = d.editable && viewRotation === 0;
  const setTool = useCallback((t: Tool) => {
    setToolState(t);
    setSelectedId(null);
  }, []);

  const needBoxes = useCallback((index: number) => {
    const doc = pdfRef.current;
    if (!doc) return;
    doc.getPage(index + 1).then(textBoxes).then((b) => {
      if (pdfRef.current === doc) setBoxes((m) => new Map(m).set(index, b));
    }, () => undefined);
  }, []);

  // Recherche : texte de toutes les pages charge a la demande.
  useEffect(() => {
    if (!pdf || !query.trim()) return;
    let alive = true;
    (async () => {
      for (let i = 0; i < pdf.numPages && alive; i++) {
        if (boxes.has(i)) continue;
        const b = await textBoxes(await pdf.getPage(i + 1));
        if (alive) setBoxes((m) => new Map(m).set(i, b));
      }
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pdf, query]);
  const hits = useMemo(() => (pdf && query.trim() ? search(Array.from({ length: pdf.numPages }, (_, i) => boxes.get(i) ?? []), query) : []), [pdf, query, boxes]);
  const hitRects = useMemo(() => {
    // Largeurs mesurees dans une police sans empattement : plus juste qu'un simple compte de caracteres.
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) ctx.font = '100px Helvetica, Arial, sans-serif';
    const measure = (s: string): number => ctx?.measureText(s).width ?? s.length;
    return hits.map((h) => {
      const b = boxes.get(h.page)?.[h.box];
      return b ? hitRect(b, h.start, h.length, measure) : null;
    });
  }, [hits, boxes]);

  // Commentaires deja presents dans le fichier (volet Commentaires).
  useEffect(() => {
    if (!pdf || panel !== 'comments') return;
    let alive = true;
    (async () => {
      const out: { page: number; author: string; text: string; type: string }[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        for (const a of (await (await pdf.getPage(i)).getAnnotations()) as { subtype?: string; titleObj?: { str?: string }; contentsObj?: { str?: string } }[]) {
          if (!a.subtype || a.subtype === 'Widget' || a.subtype === 'Link' || a.subtype === 'Popup') continue;
          out.push({ page: i - 1, author: a.titleObj?.str ?? '', text: a.contentsObj?.str ?? '', type: a.subtype });
        }
      }
      if (alive) setExisting(out);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pdf, panel]);

  const goTo = useCallback((page: number, rect?: Rect) => {
    const el = viewerRef.current?.querySelector<HTMLElement>(`[data-page="${page + 1}"]`);
    if (!el) return;
    if (rect) {
      const c = viewerRef.current;
      if (c) c.scrollTo({ top: el.offsetTop + rect.y * el.offsetHeight - c.clientHeight / 3, behavior: 'smooth' });
    } else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setCurrent(page);
  }, []);

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

  const saveBytes = useCallback(async (bytes: Uint8Array, name: string, ext: string) => {
    try {
      await services.saveFile(bytes, name, [{ name: ext.toUpperCase(), extensions: [ext] }], null);
    } catch (err) {
      services.notify(errorText(err), 'error');
    }
  }, [services]);

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
        const images: NamedBytes[] = [];
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

  const print = useCallback(async () => {
    const cur = await d.flush();
    if (!cur) return;
    const url = URL.createObjectURL(new Blob([cur.bytes.slice()], { type: 'application/pdf' }));
    const frame = document.createElement('iframe');
    frame.className = 'pdf-printframe';
    frame.src = url;
    frame.onload = () => {
      frame.contentWindow?.print();
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    };
    document.body.appendChild(frame);
  }, [d]);

  const fitValue = useCallback((kind: 'width' | 'page'): number => {
    const c = viewerRef.current;
    if (!c) return zoom;
    const cols = twoPages ? 2 : 1;
    const zw = ((c.clientWidth - 48 - (cols - 1) * 16) / cols / (firstSize.w * PT)) * 100;
    const zh = ((c.clientHeight - 32) / (firstSize.h * PT)) * 100;
    return clampZoom(Math.floor(kind === 'width' ? zw : Math.min(zw, zh)));
  }, [twoPages, firstSize, zoom]);
  const fitZoom = useCallback((kind: 'width' | 'page') => setZoom(fitValue(kind)), [fitValue, setZoom]);

  const onDialog = useCallback(<K extends keyof DialogResult>(kind: K, value: DialogResult[K]) => {
    setDialog(null);
    const total = pageCount;
    const pagesOf = (text: string): number[] | undefined => (text.trim() ? pdfOps.parsePageRange(text, total) : undefined);
    const run = (label: string, fn: (b: Uint8Array) => Promise<Uint8Array>) => void d.mutate(label, fn).then((ok) => ok && services.notify(S.done.applied(label), 'success'));
    try {
      switch (kind) {
        case 'watermark': {
          const v = value as DialogResult['watermark'];
          run(S.watermark, (b) => pdfOps.watermark(b, { text: v.text, size: v.size, opacity: v.opacity / 100, angle: v.angle, color: { r: 0.5, g: 0.5, b: 0.5 }, pages: pagesOf(v.pages) }));
          break;
        }
        case 'numbering': {
          const v = value as DialogResult['numbering'];
          run(S.numbering, (b) => pdfOps.stampPages(b, { template: v.template, position: v.position, size: v.size, start: v.start, digits: v.digits, margin: v.margin, color: { r: 0, g: 0, b: 0 }, pages: pagesOf(v.pages) }));
          break;
        }
        case 'headerFooter': {
          const v = value as DialogResult['headerFooter'];
          run(S.headerFooter, async (b) => {
            let out = b;
            const o = { size: v.size, start: 1, digits: 0, margin: 20, color: { r: 0.25, g: 0.25, b: 0.25 } };
            if (v.header.trim()) out = await pdfOps.stampPages(out, { ...o, template: v.header, position: 'haut_centre' });
            if (v.footer.trim()) out = await pdfOps.stampPages(out, { ...o, template: v.footer, position: 'bas_centre' });
            return out;
          });
          break;
        }
        case 'metadata':
          run(S.metadata, (b) => pdfOps.writeMetadata(b, value as DialogResult['metadata']));
          break;
        case 'protect': {
          const v = value as DialogResult['protect'];
          const notify = (ok: boolean) => ok && services.notify(S.done.applied(S.protect), 'success');
          if (native) {
            void nativeOp(S.protect, { actions: [{ action: 'chiffrer', utilisateur: v.user, proprietaire: v.owner, autorisations: { imprimer: v.print, copier: v.copy, modifier: v.edit, annoter: v.annot, remplir_formulaires: v.forms } }] }).then(notify);
          } else {
            // Navigateur : AES-256 par pdf-lib ; le document passe en lecture seule avec son mot de passe d'affichage.
            d.setLocked(v.user);
            void d.mutate(S.protect, (b) => pdfOps.encrypt(b, v)).then((ok) => {
              if (!ok) d.setLocked(null);
              notify(ok);
            });
          }
          break;
        }
        case 'password': {
          const ask = d.askPassword;
          if (ask) void d.load(ask.file, value as string);
          break;
        }
        case 'compress':
          void nativeOp(S.compress, { actions: [{ action: 'compresser', niveau: (value as DialogResult['compress']).level }] });
          break;
        case 'ocr': {
          const v = value as DialogResult['ocr'];
          void d.mutate(S.ocr, async (b) => {
            if (!native) throw new Error(S.errors.needNative);
            const out = (await runBytes(native, { op: 'ocr', entree: input(0), langue: v.lang, forcer: v.force, sortie: outputTarget('ocr.pdf') }, [{ name: 'document.pdf', bytes: b }])).files[0];
            if (!out) throw new Error(S.errors.needNative);
            return out.bytes;
          });
          break;
        }
        case 'split': {
          const v = value as DialogResult['split'];
          const groups = v.mode === 'each' ? pdfOps.chunks(total, 1) : v.mode === 'every' ? pdfOps.chunks(total, v.n) : v.ranges.split('|').map((r) => pdfOps.parsePageRange(r, total));
          void (async () => {
            const cur = await d.flush();
            if (!cur || !d.info) return;
            const parts = await pdfOps.split(cur.bytes, groups);
            const name = stem(d.info.name);
            await saveBytes(await zip(parts.map((bytes, i) => ({ name: `${name}-${i + 1}.pdf`, bytes }))), `${name}-decoupe.zip`, 'zip');
            services.notify(S.done.exported(parts.length), 'success');
          })().catch((err: unknown) => services.notify(errorText(err), 'error'));
          break;
        }
        case 'extract': {
          const pages = pdfOps.parsePageRange(value as string, total);
          void (async () => {
            const cur = await d.flush();
            if (!cur || !d.info) return;
            await saveBytes(await pdfOps.extract(cur.bytes, pages), `${stem(d.info.name)}-extrait.pdf`, 'pdf');
          })().catch((err: unknown) => services.notify(errorText(err), 'error'));
          break;
        }
        case 'signature':
          setOpts((o) => ({ ...o, signature: value as DialogResult['signature'] }));
          setTool('signature');
          break;
      }
    } catch (err) {
      services.notify(errorText(err), 'error');
    }
  }, [pageCount, d, services, nativeOp, native, saveBytes, setTool]);

  const openDialog = useCallback(async (kind: Parameters<PdfRibbonActions['dialog']>[0]) => {
    if (kind === 'metadata') {
      const cur = await d.flush();
      if (!cur) return;
      try {
        const m = await pdfOps.readMetadata(cur.bytes);
        setDialog({ kind, meta: m });
      } catch (err) {
        services.notify(errorText(err), 'error');
      }
      return;
    }
    if (kind === 'split') setDialog({ kind, pages: pageCount });
    else if (kind === 'extract') setDialog({ kind, pages: pageCount, initial: pagesSel().map((p) => p + 1).join(', ') });
    else setDialog({ kind } as DialogState);
  }, [d, pageCount, pagesSel, services]);

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

  const pageMenu = useCallback((page: number): MenuItem[] => [
    { id: 'rl', label: S.rotateLeft, icon: 'arrow_counterclockwise', disabled: !editable, onClick: () => void d.mutate(S.rotateLeft, (b) => pdfOps.rotate(b, -90, pagesSel())) },
    { id: 'rr', label: S.rotateRight, icon: 'arrow_clockwise', disabled: !editable, onClick: () => void d.mutate(S.rotateRight, (b) => pdfOps.rotate(b, 90, pagesSel())) },
    { id: 's1', kind: 'separator' },
    { id: 'blank', label: S.insertBlank, icon: 'document_one_page_add', disabled: !editable, onClick: () => void d.mutate(S.insertBlank, (b) => pdfOps.insertBlank(b, page + 1)) },
    { id: 'file', label: S.insertFile, icon: 'document_add', disabled: !editable, onClick: () => void pickPdf().then((f) => f && d.mutate(S.insertFile, (b) => pdfOps.insertDocument(b, f.bytes, page + 1))) },
    { id: 'extract', label: S.extractPages, icon: 'document_arrow_up', onClick: () => void openDialog('extract') },
    { id: 's2', kind: 'separator' },
    { id: 'del', label: S.deletePages, icon: 'delete', disabled: !editable || pagesSel().length >= pageCount, onClick: () => void d.mutate(S.deletePages, (b) => pdfOps.removePages(b, pagesSel())) },
  ], [editable, d, pagesSel, pickPdf, openDialog, pageCount]);

  const actions: PdfRibbonActions = {
    setTool,
    setOpt: (patch) => setOpts((o) => ({ ...o, ...patch })),
    zoom: (dir) => setZoom(stepZoom(zoom, dir)),
    fit: fitZoom,
    rotateView: (dir) => {
      setViewRotation((r) => (r + dir * 90 + 360) % 360);
      setTool('select');
    },
    toggleTwoPages: () => setTwoPages(!twoPages),
    fullScreen: () => void viewerRef.current?.requestFullscreen().catch(() => undefined),
    go: (delta) => goTo(Math.min(Math.max(current + delta, 0), pageCount - 1)),
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
    merge: () => void pickPdf().then((f) => f && d.mutate(S.merge, (b) => pdfOps.merge([b, f.bytes]))),
    applyRedactions: () => void d.flush().then((s) => s && services.notify(S.done.applied(S.applyRedactions), 'success')),
    unprotect: () => {
      if (d.info && state) setDialogPassword();
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
  function setDialogPassword(): void {
    if (d.info && state) d.setAskPassword({ file: { name: d.info.name, path: d.info.path, bytes: state.bytes }, error: false });
  }

  const pendingRedactions = state?.items.filter((i) => i.kind === 'redact').length ?? 0;
  const fieldNames = useMemo(() => new Set([...d.fields.map((f) => f.name), ...(state?.items.flatMap((i) => (i.kind === 'field' ? [i.name] : [])) ?? [])]), [d.fields, state]);
  const tabs = pdfTabs({
    hasDoc: state !== null, editable: d.editable, lockedReason: S.tips.locked, tool, color: opts.color, markColor: opts.markColor, width: opts.width,
    fontSize: opts.fontSize, stamp: opts.stamp, field: opts.field, twoPages, fillForm, hasFields: d.fields.length > 0, pendingRedactions,
    selectedPages: pagesSel().length, pageCount, nativeReason,
  }, actions);
  const commands = useMemo(() => collectCommands(tabs), [tabs]);

  // Raccourcis clavier (Acrobat / Office).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
      const k = e.key.toLowerCase();
      if (e.ctrlKey && k === 's') {
        e.preventDefault();
        void d.save(e.shiftKey);
      } else if (e.ctrlKey && k === 'o') {
        e.preventDefault();
        void pickPdf().then((f) => f && d.load(f));
      } else if (e.ctrlKey && k === 'p') {
        e.preventDefault();
        void print();
      } else if (e.ctrlKey && k === 'f') {
        e.preventDefault();
        setPanel('search');
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
      } else if (e.key === 'Escape') setTool('select');
      else if (e.key === 'PageDown') goTo(Math.min(current + 1, pageCount - 1));
      else if (e.key === 'PageUp') goTo(Math.max(current - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d, pickPdf, print, setPanel, selectedId, setTool, goTo, current, pageCount]);

  const scale = (zoom / 100) * PT;
  const quickAccess: QuickAccessItem[] = [
    { id: 'save', label: S.save, icon: 'save', shortcut: 'Ctrl+S', disabled: !state, onClick: () => void d.save(false) },
    { id: 'undo', label: S.undo, icon: 'arrow_undo', shortcut: 'Ctrl+Z', disabled: !d.canUndo, onClick: d.undo },
    { id: 'redo', label: S.redo, icon: 'arrow_redo', shortcut: 'Ctrl+Y', disabled: !d.canRedo, onClick: d.redo },
    { id: 'print', label: S.print, icon: 'print', defaultVisible: false, onClick: () => void print() },
  ];

  const backstagePages: BackstagePage[] = [
    { ...BACKSTAGE_PAGES.info, render: () => (
      <>
        <BackstageHeading>{S.backstage.infoTitle}</BackstageHeading>
        {d.info && <p className="pdf-muted">{d.info.name} · {pageCount} {S.backstage.pages.toLowerCase()} · {state ? `${Math.round(state.bytes.length / 1024)} Ko` : ''}</p>}
        <BackstageAction icon="lock_closed" title={S.backstage.protectTitle} description={S.backstage.protectText} onClick={() => { setBackstage(null); void openDialog('protect'); }} />
        <BackstageAction icon="info" title={S.backstage.inspectTitle} description={S.backstage.inspectText} onClick={() => { setBackstage(null); void openDialog('metadata'); }} />
        <BackstageAction icon="folder_zip" title={S.backstage.compressTitle} description={nativeReason('compresser') ?? S.backstage.compressText} onClick={() => { setBackstage(null); void openDialog('compress'); }} />
      </>
    ) },
    { ...BACKSTAGE_PAGES.open, onSelect: () => { setBackstage(null); void pickPdf().then((f) => f && d.load(f)); } },
    { ...BACKSTAGE_PAGES.save, disabled: !state, onSelect: () => { setBackstage(null); void d.save(false); } },
    { ...BACKSTAGE_PAGES.saveAs, disabled: !state, onSelect: () => { setBackstage(null); void d.save(true); } },
    { ...BACKSTAGE_PAGES.print, disabled: !state, render: () => (
      <>
        <BackstageHeading actions={<Button appearance="primary" icon="print" onClick={() => { setBackstage(null); void print(); }}>{S.print}</Button>}>{S.backstage.printTitle}</BackstageHeading>
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
    { ...BACKSTAGE_PAGES.close, onSelect: () => services.close() },
  ];

  const onDrop = async (e: DragEvent): Promise<void> => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) await d.load({ name: f.name, path: null, bytes: new Uint8Array(await f.arrayBuffer()) });
  };

  const items = state?.items ?? [];
  const fieldsByPage = (page: number) => d.fields.flatMap((field) => field.widgets.filter((w) => w.page === page).map((widget) => ({ field, widget })));
  const pages = pdf ? Array.from({ length: pdf.numPages }, (_, i) => i) : [];

  return (
    <div className="pdf" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => void onDrop(e)}>
      <TitleBar app={info} documentName={d.info?.name} saveState={d.modified ? 'modified' : 'saved'} quickAccess={quickAccess} commands={commands}
        windowControls={services.windowControls} settings={services.settings} />
      <Ribbon tabs={tabs} onFile={() => setBackstage(state ? 'info' : 'open')} settings={services.settings} />
      <div className="pdf-body">
        <Sidebar panel={state ? panel : null} onPanel={setPanel} pdf={pdf} current={current} selected={selectedPages} onSelectPages={setSelectedPages} onGo={(p) => goTo(p)}
          onMovePage={(from, to) => void d.mutate(S.groups.pages, (b) => pdfOps.reorder(b, Array.from({ length: pageCount }, (_, i) => i).filter((i) => i !== from).toSpliced(to, 0, from)))}
          pageMenu={pageMenu} outline={outline} query={query} onQuery={(q) => { setQuery(q); setActiveHit(0); }} hits={hits} activeHit={activeHit}
          onHit={(i) => { setActiveHit(i); const h = hits[i]; const r = hitRects[i]; if (h) goTo(h.page, r ?? undefined); }}
          items={items} existingComments={existing} onItem={(i: Item) => { setSelectedId(i.id); goTo(i.page); }} onRemoveItem={(id) => d.removeItems(new Set([id]), S.clearItems)}
          log={state?.log ?? []} onUndoTo={d.undoTo} />
        <div ref={viewerRef} className={`pdf-viewer${twoPages ? ' is-double' : ''}${tool === 'hand' ? ' is-hand' : ''}`}
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
              <Button appearance="primary" icon="folder_open" onClick={() => void pickPdf().then((f) => f && d.load(f))}>{S.empty.button}</Button>
            </div>
          )}
          {pdf && (
            <div className="pdf-pages">
              {pages.map((i) => (
                <PageView key={i} pdf={pdf} index={i} scale={scale} viewRotation={viewRotation} fallbackSize={firstSize} tool={tool} editable={editable} opts={{ ...opts, author }}
                  items={items.filter((it) => it.page === i)} selectedId={selectedId} fieldNames={fieldNames} onSelect={setSelectedId}
                  onAdd={(it) => { d.addItem(it); if (it.kind === 'signature' || it.kind === 'stamp') setTool('select'); }} onChange={d.changeItem}
                  fields={fieldsByPage(i)} values={state?.values ?? {}} fillForm={fillForm && d.editable} onValue={d.setValue}
                  hits={hits.flatMap((h, k) => (h.page === i && hitRects[k] ? [hitRects[k]] : []))} activeHit={hits[activeHit]?.page === i ? (hitRects[activeHit] ?? null) : null}
                  boxes={boxes.get(i)} needBoxes={needBoxes} onVisible={setCurrent} />
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
          ...(items.length + Object.keys(state.values).length > 0 ? [{ id: 'pending', label: S.status.pending(items.length + Object.keys(state.values).length), icon: 'edit' as const }] : []),
          ...(d.editable ? [] : [{ id: 'locked', label: S.status.locked, icon: 'lock_closed' as const }]),
          ...(tool !== 'select' ? [{ id: 'tool', label: S.status.tool(S.tools[tool]) }] : []),
          { id: 'engine', label: native ? S.status.native : S.status.web, icon: native ? 'checkmark' as const : 'info' as const },
        ] : []}
        views={[{ id: 'single', label: S.views.single, icon: 'document_one_page' }, { id: 'double', label: S.views.double, icon: 'book_open' }]}
        activeView={twoPages ? 'double' : 'single'} onViewChange={(v) => setTwoPages(v === 'double')}
        zoom={zoom} onZoomChange={(z) => setZoom(clampZoom(z))}
        zoomPresets={[{ label: S.fitWidth, compute: () => fitValue('width') }, { label: S.fitPage, compute: () => fitValue('page') }]}
      />
      <Backstage open={backstage !== null} appName={info.name} pages={backstagePages} activePage={backstage ?? 'info'} onPageChange={setBackstage} onClose={() => setBackstage(null)} />
      <PdfDialogs state={d.askPassword ? { kind: 'password', error: d.askPassword.error } : dialog} onClose={() => { setDialog(null); d.setAskPassword(null); }} onApply={onDialog} />
    </div>
  );
}
