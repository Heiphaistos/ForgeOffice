// Application Publication : ouverture, ruban, volet des pages, zone de travail, volets, barre d'etat, raccourcis,
// presse-papiers des objets, reproduction de la mise en forme, recuperation apres plantage.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { MODULES, type ModuleProps } from '@forgeoffice/core';
import { Button, Icon, Ribbon, Spinner, StatusBar, TitleBar, collectCommands, nextFontSize, useContextMenu, type MenuItem, type QuickAccessItem, type RibbonTab } from '@forgeoffice/ui';
import { insertCopies, locate, type CreateRequest } from '@forgeoffice/powerpoint/canvas';
import type { Shape } from '@forgeoffice/pptx';
import { readFopub, writeFopub, type PubDocument } from '../fopub.ts';
import { S } from '../strings.ts';
import { blank } from '../templates/index.ts';
import { flowed, FileMenu, PrintJob } from './backstage.tsx';
import { CheckPane, useIssues } from './CheckPane.tsx';
import { Dialogs } from './dialogs.tsx';
import { useEditor, type Editor } from './editor.ts';
import { baseName, saveDoc, type Sheets } from './export.ts';
import { applyParagraph, applyRun, createFromRequest, currentRun, insertPicture, insertPictureBytes, selectedBox } from './ops.ts';
import { PagesPane } from './PagesPane.tsx';
import { clearRecovery, loadRecovery, saveRecovery, type RecoveryEntry } from './recovery.ts';
import type { AppActions, TabContext } from './ribbon/common.tsx';
import { contextualKinds, pictureFormatTab, shapeFormatTab, tableTab, textFormatTab } from './ribbon/contextual.tsx';
import { designTab } from './ribbon/design.tsx';
import { homeTab } from './ribbon/home.tsx';
import { insertTab } from './ribbon/insert.tsx';
import { mailingsTab, reviewTab, viewTab } from './ribbon/views.tsx';
import { Stage } from './Stage.tsx';
import './app.css';

const info = MODULES.publisher;
const BACKUP_MS = 30_000;

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Chargement du fichier passe a l'ouverture (ou publication vierge), puis espace de travail. */
export function PublisherApp({ services, file }: ModuleProps) {
  const [state, setState] = useState<{ doc: PubDocument; name: string; path: string | null; fresh: boolean } | { error: string } | null>(file ? null : { doc: blank('a4'), name: `${S.app.untitled}.fopub`, path: null, fresh: true });
  useEffect(() => {
    if (!file) return;
    let alive = true;
    const native = /\.fopub$/i.test(file.name);
    readFopub(file.bytes).then(
      (doc) => {
        if (!alive) return;
        setState({ doc, name: native ? file.name : `${baseName(file.name)}.fopub`, path: native ? file.path : null, fresh: false });
        if (!native) services.notify(S.app.importedPptx, 'info');
        if (file.path) void services.addRecent({ app: 'publisher', name: file.name, path: file.path });
      },
      (err: unknown) => alive && setState({ error: errorText(err) }),
    );
    return () => {
      alive = false;
    };
  }, [file, services]);
  if (!state) {
    return (
      <div className="pub-loading">
        <Spinner size={32} label={S.app.opening} />
      </div>
    );
  }
  if ('error' in state) {
    return (
      <div className="pub-loading">
        <Icon name="error_circle" size={40} color="var(--fo-danger)" />
        <p>{S.app.openFailed(file?.name ?? '')}</p>
        <p className="pub-muted">{state.error}</p>
        <Button appearance="primary" icon="home" onClick={() => void services.openModule('hub')}>{S.app.backHome}</Button>
      </div>
    );
  }
  return <Workspace services={services} initial={state.doc} name={state.name} path={state.path} fresh={state.fresh} />;
}

/** Presse-papiers des objets (meme fenetre). */
let objectClipboard: { shapes: Shape[]; count: number } | null = null;

function Workspace({ services, initial, name, path, fresh }: { services: ModuleProps['services']; initial: PubDocument; name: string; path: string | null; fresh: boolean }) {
  const ed = useEditor(services, initial, { name, path });
  const { ui, setUi } = ed;
  const [recovery, setRecovery] = useState<RecoveryEntry | null>(null);
  const [painter, setPainter] = useState<{ run: ReturnType<typeof currentRun>; shape: Shape | undefined } | null>(null);
  const [printJob, setPrintJob] = useState<Sheets | null>(null);
  const [zoomFit, setZoomFit] = useState(100);
  const context = useContextMenu();
  const issues = useIssues(ed);

  useEffect(() => {
    if (fresh) setUi({ backstage: 'new' });
  }, [fresh, setUi]);

  useEffect(() => {
    services.setTitle(`${ed.file.name}${ed.modified ? ' *' : ''} - ${info.name}`);
  }, [services, ed.file.name, ed.modified]);

  // Recuperation : proposee au demarrage d'une publication vierge ; copie periodique pendant les modifications.
  useEffect(() => {
    if (path) return;
    loadRecovery().then((entry) => entry && setRecovery(entry), () => undefined);
  }, [path]);
  const edRef = useRef<Editor>(ed);
  edRef.current = ed;
  useEffect(() => {
    if (!ed.modified) return;
    const t = window.setTimeout(() => {
      const e = edRef.current;
      void writeFopub(e.doc).then((bytes) => saveRecovery({ name: e.file.name, path: e.file.path, bytes, savedAt: Date.now() })).catch(() => undefined);
    }, BACKUP_MS);
    return () => window.clearTimeout(t);
  }, [ed.revision, ed.modified]);

  const save = useCallback((as = false) => {
    void saveDoc(edRef.current, as).then((ok) => ok && clearRecovery().catch(() => undefined));
  }, []);

  const openFile = useCallback(async () => {
    const f = await services.openFile([{ name: S.file.openFilter, extensions: ['fopub', 'pptx'] }]);
    if (!f) return;
    if (edRef.current.modified) {
      await services.openDocument(f);
      return;
    }
    try {
      const doc = await readFopub(f.bytes);
      edRef.current.reset(doc);
      edRef.current.setFile({ name: /\.fopub$/i.test(f.name) ? f.name : `${baseName(f.name)}.fopub`, path: /\.fopub$/i.test(f.name) ? f.path : null });
      if (f.path) await services.addRecent({ app: 'publisher', name: f.name, path: f.path });
    } catch (err) {
      services.notify(`${S.app.openFailed(f.name)} ${errorText(err)}`, 'error');
    }
  }, [services]);

  const newFrom = useCallback((doc: PubDocument) => {
    if (edRef.current.modified) services.notify(S.app.newInWindow, 'info');
    edRef.current.reset(flowed(doc));
    edRef.current.setFile({ name: `${S.app.untitled}.fopub`, path: null });
    setUi({ backstage: null });
  }, [services, setUi]);

  const copyObjects = useCallback((cut: boolean): string => {
    const e = edRef.current;
    const shapes = e.selectedShapes.map((s) => structuredClone(s));
    if (!shapes.length) return '';
    objectClipboard = { shapes, count: 0 };
    if (cut) {
      const ids = e.selection.ids;
      e.editShapes((list) => {
        for (const id of ids) {
          const found = locate(list, id);
          if (found) found.list.splice(found.index, 1);
        }
      }, 'cut');
      e.setSelection({ ids: [] });
    }
    return shapes.map((s) => (s.kind === 'shape' ? (s.text?.paragraphs ?? []).map((p) => p.runs.map((r) => (r.type === 'break' ? '\n' : r.text)).join('')).join('\n') : '')).join('\n');
  }, []);

  const pasteObjects = useCallback((): boolean => {
    const clip = objectClipboard;
    if (!clip) return false;
    clip.count++;
    let ids: number[] = [];
    edRef.current.editShapes((list) => {
      ids = insertCopies(list, clip.shapes, { x: 12 * clip.count, y: 12 * clip.count });
    }, 'paste');
    edRef.current.setSelection({ ids });
    return true;
  }, []);

  const actions: AppActions = useMemo(() => ({
    save: () => save(),
    saveAs: () => setUi({ backstage: 'saveAs' }),
    backstage: (page) => setUi({ backstage: page }),
    newFrom,
    cut: () => void navigator.clipboard?.writeText(copyObjects(true)).catch(() => undefined),
    copy: () => void navigator.clipboard?.writeText(copyObjects(false)).catch(() => undefined),
    paste: () => {
      if (pasteObjects()) return;
      void navigator.clipboard?.read?.().then(async (items) => {
        for (const item of items) {
          const type = item.types.find((t) => t.startsWith('image/'));
          if (type) await insertPictureBytes(edRef.current, new Uint8Array(await (await item.getType(type)).arrayBuffer()), `image.${type.split('/')[1] ?? 'png'}`);
        }
      }).catch(() => undefined);
    },
    copyFormat: () => {
      if (painter) setPainter(null);
      else setPainter({ run: currentRun(edRef.current), shape: edRef.current.selectedShapes[0] });
    },
    painterActive: !!painter,
    drawShape: (preset) => setUi({ tool: { kind: 'shape', preset } }),
    print: () => setUi({ backstage: 'print' }),
  }), [save, setUi, newFrom, copyObjects, pasteObjects, painter]);

  // Reproduire la mise en forme : appliquee a la selection suivante.
  const lastSel = useRef('');
  useEffect(() => {
    const key = ed.selection.ids.join(',');
    if (painter && key && key !== lastSel.current) {
      applyRun(ed, { ...painter.run });
      const src = painter.shape;
      if (src && (src.kind === 'shape' || src.kind === 'picture')) {
        ed.editSelected((s) => {
          if (s.kind === 'shape' && src.kind === 'shape') {
            if (src.fill) s.fill = structuredClone(src.fill);
            if (src.line) s.line = structuredClone(src.line);
          }
        }, 'painter');
      }
      setPainter(null);
    }
    lastSel.current = key;
  }, [ed.selection.ids, painter, ed]);

  const tabCtx: TabContext = { ed, app: actions };
  const editingTable = !!ed.selection.text?.cell;
  const kinds = contextualKinds(ed.selectedShapes, editingTable);
  const tabs: RibbonTab[] = [
    homeTab(tabCtx), insertTab(tabCtx), designTab(tabCtx), mailingsTab(tabCtx), reviewTab(tabCtx, issues.length), viewTab(ed),
    textFormatTab(tabCtx, kinds.text), pictureFormatTab(tabCtx, kinds.picture), shapeFormatTab(tabCtx, kinds.shape), tableTab(tabCtx, kinds.table),
  ];
  const commands = useMemo(() => collectCommands(tabs), [tabs]);

  const onCreate = useCallback((request: CreateRequest) => {
    const e = edRef.current;
    const id = createFromRequest(e, request);
    setUi({ tool: { kind: 'select' } });
    if (id !== null) e.setSelection(request.kind === 'textbox' ? { ids: [id], text: { shapeId: id, range: { start: { p: 0, o: 0 }, end: { p: 0, o: 0 } } } } : { ids: [id] });
  }, [setUi]);

  // Raccourcis clavier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (ui.backstage) return;
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (e.key === 'Escape' && (ui.tool.kind !== 'select' || ui.linking)) {
        setUi({ tool: { kind: 'select' }, linking: null });
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl || inField) return;
      const key = e.key.toLowerCase();
      const run = currentRun(ed);
      const text = !!ed.selection.text || ed.selection.ids.length > 0;
      const handled = (fn: () => void): void => {
        e.preventDefault();
        fn();
      };
      if (key === 's') handled(() => (e.shiftKey ? setUi({ backstage: 'saveAs' }) : save()));
      else if (key === 'z' && !e.shiftKey) handled(ed.undo);
      else if (key === 'y' || (key === 'z' && e.shiftKey)) handled(ed.redo);
      else if (key === 'o') handled(() => void openFile());
      else if (key === 'p') handled(() => setUi({ backstage: 'print' }));
      else if (key === 'f') handled(() => setUi({ dialog: 'find' }));
      else if (key === 'h') handled(() => setUi({ dialog: 'replace' }));
      else if (key === 'n' && e.shiftKey) handled(() => setUi({ dialog: 'insertPages' }));
      else if ((key === 'b' || key === 'g') && !e.shiftKey && text) handled(() => applyRun(ed, { bold: run.bold ? null : true }));
      else if (key === 'i' && text) handled(() => applyRun(ed, { italic: run.italic ? null : true }));
      else if (key === 'u' && text) handled(() => applyRun(ed, { underline: run.underline && run.underline !== 'none' ? null : 'sng' }));
      else if (key === 'e' && text) handled(() => applyParagraph(ed, { align: 'ctr' }));
      else if (key === 'l' && text) handled(() => applyParagraph(ed, { align: 'l' }));
      else if (key === 'r' && text) handled(() => applyParagraph(ed, { align: 'r' }));
      else if (key === 'j' && text) handled(() => applyParagraph(ed, { align: 'just' }));
      else if ((e.key === '>' || (e.shiftKey && e.key === '.')) && text) handled(() => applyRun(ed, { size: nextFontSize(run.size ?? 11, 1) }));
      else if ((e.key === '<' || (e.shiftKey && e.key === ',')) && text) handled(() => applyRun(ed, { size: nextFontSize(run.size ?? 11, -1) }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ed, ui.backstage, ui.tool.kind, ui.linking, setUi, save, openFile]);

  // Copier / couper / coller des objets (hors edition de texte).
  useEffect(() => {
    const editable = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    const onCopy = (e: ClipboardEvent): void => {
      if (editable(e.target) || ui.backstage || ed.selection.text || !ed.selection.ids.length) return;
      e.preventDefault();
      e.clipboardData?.setData('text/plain', copyObjects(e.type === 'cut'));
    };
    const onPaste = (e: ClipboardEvent): void => {
      if (editable(e.target) || ui.backstage || ed.selection.text) return;
      const image = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      e.preventDefault();
      if (image) void image.arrayBuffer().then((b) => insertPictureBytes(edRef.current, new Uint8Array(b), image.name || 'image.png'));
      else pasteObjects();
    };
    window.addEventListener('copy', onCopy);
    window.addEventListener('cut', onCopy);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('cut', onCopy);
      window.removeEventListener('paste', onPaste);
    };
  }, [ed, ui.backstage, copyObjects, pasteObjects]);

  const onDrop = (e: DragEvent): void => {
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    void (async () => {
      for (const f of files) await insertPictureBytes(edRef.current, new Uint8Array(await f.arrayBuffer()), f.name);
    })();
  };

  const shapeMenu = (shapeId: number | null): MenuItem[] => {
    const box = selectedBox(ed);
    const base: MenuItem[] = [
      { id: 'cut', label: S.cmd.cut, icon: 'cut', shortcut: 'Ctrl+X', disabled: shapeId === null, onClick: actions.cut },
      { id: 'copy', label: S.cmd.copy, icon: 'copy', shortcut: 'Ctrl+C', disabled: shapeId === null, onClick: actions.copy },
      { id: 'paste', label: S.cmd.paste, icon: 'clipboard_paste', shortcut: 'Ctrl+V', onClick: actions.paste },
    ];
    if (shapeId === null) {
      return [
        ...base,
        { id: 's', kind: 'separator' },
        { id: 'guides', label: S.cmd.marginGuides, icon: 'grid', onClick: () => setUi({ dialog: 'guides' }) },
        { id: 'bg', label: S.cmd.moreBackgrounds, icon: 'color_background', onClick: () => setUi({ dialog: 'background' }) },
        { id: 'master', label: S.cmd.editMaster, icon: 'slide_layout', onClick: () => setUi({ view: 'master' }) },
      ];
    }
    const shape = locate(ed.pageShapes, shapeId)?.shape;
    return [
      ...base,
      { id: 's1', kind: 'separator' },
      ...(box ? [{ id: 'link', label: S.cmd.linkBox, icon: 'link_add' as const, onClick: () => setUi({ linking: box }) }, { id: 'fmt', label: S.dialogs.textBox, icon: 'text_box_settings' as const, onClick: () => setUi({ dialog: 'textBox' }) }] : []),
      ...(shape?.kind === 'picture' || (shape?.kind === 'shape' && !shape.textBox) ? [{ id: 'pic', label: S.cmd.changePicture, icon: 'image_edit' as const, onClick: () => void insertPicture(ed) }] : []),
      { id: 'alt', label: S.cmd.altText, icon: 'accessibility_checkmark', onClick: () => setUi({ dialog: 'altText' }) },
      { id: 'linkurl', label: S.cmd.link, icon: 'link', onClick: () => setUi({ dialog: 'link' }) },
    ];
  };

  const quickAccess: QuickAccessItem[] = [
    { id: 'save', label: S.app.save, icon: 'save', shortcut: 'Ctrl+S', onClick: actions.save },
    { id: 'undo', label: S.app.undo, icon: 'arrow_undo', shortcut: 'Ctrl+Z', disabled: !ed.canUndo, onClick: ed.undo },
    { id: 'redo', label: S.app.redo, icon: 'arrow_redo', shortcut: 'Ctrl+Y', disabled: !ed.canRedo, onClick: ed.redo },
    { id: 'print', label: S.app.print, icon: 'print', defaultVisible: false, onClick: actions.print },
  ];

  const zoom = ui.fit ? zoomFit : ui.zoom;
  const sel = ed.selectedShapes[0]?.xfrm;
  const cm = (pt: number): string => ((pt / 72) * 2.54).toFixed(2).replace('.', ',');
  const overflowHere = ed.page ? [...ed.overflow].some((k) => k.startsWith(`${ed.page?.id}:`)) : false;

  return (
    <div className="pub-app" data-app="publisher" onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()} onDrop={onDrop}>
      <TitleBar
        app={info}
        documentName={baseName(ed.file.name)}
        location={ed.file.path}
        saveState={ed.modified ? 'modified' : 'saved'}
        quickAccess={quickAccess}
        commands={commands}
        onRename={(n) => ed.setFile({ ...ed.file, name: `${n.replace(/[\\/:*?"<>|]/g, '')}.fopub` })}
        windowControls={services.windowControls}
        settings={services.settings}
      />
      <Ribbon
        tabs={tabs}
        activeTab={tabs.some((t) => t.id === ui.ribbonTab && !t.hidden) ? ui.ribbonTab : undefined}
        onTabChange={(id) => setUi({ ribbonTab: id })}
        onFile={() => setUi({ backstage: 'new' })}
        settings={services.settings}
      />
      {recovery && (
        <div className="pub-banner" role="status">
          <Icon name="history" size={16} />
          <span>{S.app.recovered(recovery.name, new Date(recovery.savedAt).toLocaleString('fr-FR'))}</span>
          <Button size="small" appearance="primary" onClick={() => { void readFopub(recovery.bytes).then((d) => { ed.reset(d); ed.setFile({ name: recovery.name, path: recovery.path }); ed.commitDeck({ ...d.deck }); }); setRecovery(null); setUi({ backstage: null }); }}>{S.app.restore}</Button>
          <Button size="small" onClick={() => { void clearRecovery(); setRecovery(null); }}>{S.app.discard}</Button>
        </div>
      )}
      <div className="pub-body">
        {ui.pagesPane && <PagesPane ed={ed} />}
        <main className="pub-main">
          <Stage
            ed={ed}
            zoom={zoom}
            onFitZoom={setZoomFit}
            onCreate={onCreate}
            onContextMenu={(e, id) => context.open(e, shapeMenu(id))}
            onShapeDoubleClick={(id) => {
              const shape = locate(ed.pageShapes, id)?.shape;
              if (shape?.kind !== 'picture' && !(shape?.kind === 'shape' && shape.name.startsWith("Cadre d'image"))) return false;
              void insertPicture(ed);
              return true;
            }}
          />
        </main>
        {ui.checker && <CheckPane ed={ed} issues={issues} onClose={() => setUi({ checker: false })} />}
      </div>
      <StatusBar
        left={[
          { id: 'page', label: ui.view === 'master' ? S.status.master(ed.owner && 'name' in ed.owner ? String(ed.owner.name) : '') : S.status.page(ed.pageIndex + 1, ed.deck.slides.length) },
          ...(sel ? [{ id: 'pos', label: S.status.position(cm(sel.x), cm(sel.y)), icon: 'cursor' as const }, { id: 'size', label: S.status.size(cm(sel.width), cm(sel.height)), icon: 'resize' as const }] : []),
          ...(overflowHere ? [{ id: 'overflow', label: S.status.overflow, icon: 'textbox_more' as const }] : []),
          ...(ui.mergePreview !== null && ed.pub.merge ? [{ id: 'record', label: S.status.record(ui.mergePreview + 1, ed.pub.merge.records.length), icon: 'mail' as const }] : []),
          { id: 'check', label: S.status.checker(issues.length), icon: issues.length ? ('warning' as const) : ('checkmark_circle' as const), onClick: () => setUi({ checker: !ui.checker }) },
        ]}
        views={[
          { id: 'normal', label: S.cmd.normal, icon: 'document' },
          { id: 'master', label: S.cmd.masterView, icon: 'slide_layout' },
        ]}
        activeView={ui.view}
        onViewChange={(id) => setUi({ view: id === 'master' ? 'master' : 'normal' })}
        zoom={zoom}
        onZoomChange={(z) => setUi({ zoom: z, fit: null })}
        zoomPresets={[{ label: S.cmd.wholePage, compute: () => zoomFit }]}
      >
        <button type="button" className="pub-fitbtn" title={S.cmd.wholePage} aria-pressed={ui.fit === 'page'} onClick={() => setUi({ fit: 'page' })}>
          <Icon name="page_fit" size={16} />
        </button>
      </StatusBar>
      <FileMenu
        ed={ed}
        open={ui.backstage !== null}
        page={ui.backstage ?? 'new'}
        onPage={(page) => setUi({ backstage: page })}
        onClose={() => setUi({ backstage: null })}
        onNew={newFrom}
        onOpen={() => void openFile()}
        onPrint={setPrintJob}
      />
      <Dialogs ed={ed} />
      {printJob && <PrintJob sheets={printJob} onDone={() => setPrintJob(null)} print={services.print} />}
      {context.menu}
    </div>
  );
}
