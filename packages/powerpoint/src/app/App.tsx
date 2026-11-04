// Application Presentation : chargement, ruban, volets, zone d'edition, barre d'etat, diaporama, raccourcis.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { MODULES, sharedRecovery, type ModuleProps, type RecoveryEntry } from '@forgeoffice/core';
import {
  Button, Icon, Ribbon, Spinner, StatusBar, TitleBar, collectCommands, nextFontSize, useConfirmDiscard, useContextMenu, useMediaQuery, type MenuItem, type QuickAccessItem, type RibbonTab,
} from '@forgeoffice/ui';
import { applyLayout, createBlankDeck, type Deck, type Section } from '@forgeoffice/pptx';
import { CanvasEditor } from '../canvas/CanvasEditor.tsx';
import { fitZoom } from '../canvas/math.ts';
import { groupShapes, locate, reorder, ungroup } from '../canvas/ops.ts';
import type { CreateRequest } from '../canvas/types.ts';
import { NotesPane, NotesPageView, OutlineView, PreviewOverlay } from './AppViews.tsx';
import { FileMenu, PrintJob, printPages, type PrintLayout } from './backstage.tsx';
import { applyFormat, copySelection, cutSelection, pasteFromEvent, pasteFromRibbon, pickFormat } from './clipboard.ts';
import { createFromRequest, createInk, editSlides } from './deck-ops.ts';
import { Dialogs } from './dialogs.tsx';
import { useEditor, type Editor } from './editor.ts';
import { backup, baseName, errorText, OPEN_FILTERS, readDeck, saveDeck } from './fileops.ts';
import { applyParagraph, applyRun, currentRun } from './format.ts';
import { insertPictureBytes } from './insert.ts';
import { SidePanes } from './panes.tsx';
import type { AppActions, TabContext } from './ribbon/common.tsx';
import { chartDesignTab, pictureFormatTab, shapeFormatTab, tableDesignTab, tableLayoutTab } from './ribbon/contextual.tsx';
import { designTab, drawTab } from './ribbon/design.tsx';
import { presetName } from './ribbon/galleries.tsx';
import { homeTab } from './ribbon/home.tsx';
import { insertTab } from './ribbon/insert.tsx';
import { animationsTab, transitionsTab } from './ribbon/motion.tsx';
import { masterTab, openView, reviewTab, showTab, viewTab } from './ribbon/views.tsx';
import { SlideList } from './SlidePanel.tsx';
import { SlideShow } from './SlideShow.tsx';
import { S } from '../strings.ts';
import './app.css';

const info = MODULES.powerpoint;
const BACKUP_MS = 30_000;

/** Chargement du fichier passe a l'ouverture, puis espace de travail. */
export function PowerPointApp({ services, file }: ModuleProps) {
  const [state, setState] = useState<{ deck: Deck; name: string; path: string | null } | { error: string } | null>(file ? null : { deck: createBlankDeck(), name: `${S.app.untitled}.pptx`, path: null });
  useEffect(() => {
    if (!file) return;
    let alive = true;
    readDeck(file.bytes).then(
      (deck) => {
        if (!alive) return;
        setState({ deck, name: /\.(pptx|pptm|potx|potm|ppsx|ppsm)$/i.test(file.name) ? file.name : `${baseName(file.name)}.pptx`, path: /\.(pptx|pptm|potx|potm|ppsx|ppsm)$/i.test(file.name) ? file.path : null });
        if (file.path) void services.addRecent({ app: 'powerpoint', name: file.name, path: file.path });
      },
      (err: unknown) => alive && setState({ error: errorText(err) }),
    );
    return () => {
      alive = false;
    };
  }, [file, services]);
  if (!state) {
    return (
      <div className="pp-loading">
        <Spinner size={32} label={S.app.opening} />
      </div>
    );
  }
  if ('error' in state) {
    return (
      <div className="pp-loading">
        <Icon name="error_circle" size={40} color="var(--fo-danger)" />
        <p>{S.app.openFailed(file?.name ?? '')}</p>
        <p className="pp-muted">{state.error}</p>
        <Button appearance="primary" icon="home" onClick={() => void services.openModule('hub')}>{S.app.backHome}</Button>
      </div>
    );
  }
  return <Workspace services={services} initial={state.deck} name={state.name} path={state.path} />;
}

function Workspace({ services, initial, name, path }: { services: ModuleProps['services']; initial: Deck; name: string; path: string | null }) {
  const ed = useEditor(services, () => initial, { name, path });
  const { deck, ui, setUi } = ed;
  const [recovery, setRecovery] = useState<RecoveryEntry | null>(null);
  const [painter, setPainter] = useState(false);
  const phone = useMediaQuery('(max-width: 719px)');
  /** Telephone en portrait : les miniatures passent en bandeau horizontal sous la diapositive (qui garde toute la largeur). */
  const strip = useMediaQuery('(max-width: 719px) and (orientation: portrait)');
  const [preview, setPreview] = useState<'transition' | 'animations' | null>(null);
  const [printJob, setPrintJob] = useState<{ layout: PrintLayout; indices: number[]; hidden: boolean } | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [notesHeight, setNotesHeight] = useState(96);
  const [stageSize, setStageSize] = useState({ width: 900, height: 600 });
  const stageRef = useRef<HTMLDivElement>(null);
  const context = useContextMenu();

  // Titre de la fenetre.
  useEffect(() => {
    services.setTitle(`${ed.file.name}${ed.ds.modified ? ' *' : ''} - ${info.name}`);
  }, [services, ed.file.name, ed.ds.modified]);

  // Recuperation apres plantage : proposee au demarrage d'une presentation vierge.
  useEffect(() => {
    if (path) return;
    sharedRecovery('powerpoint').pending().then((list) => list[0] && setRecovery(list[0]), () => undefined);
  }, [path]);
  // Fermeture normale : plus de copie a proposer.
  useEffect(() => sharedRecovery('powerpoint').clearOnExit(), []);

  // Copie de recuperation periodique.
  const edRef = useRef<Editor>(ed);
  edRef.current = ed;
  useEffect(() => {
    if (!ed.ds.modified) return;
    const t = window.setTimeout(() => void backup(edRef.current).catch(() => undefined), BACKUP_MS);
    return () => window.clearTimeout(t);
  }, [ed.ds.revision, ed.ds.modified]);

  // Zoom ajuste a la fenetre.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = (): void => setStageSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ui.view]);
  const zoom = ui.fit ? fitZoom(deck.size, stageSize, ui.ruler ? 40 : 28) : ui.zoom;

  // Presentation modifiee : Enregistrer / Ne pas enregistrer / Annuler avant d'ouvrir, de remplacer par une nouvelle ou de fermer.
  const confirm = useConfirmDiscard();
  const canReplace = useCallback(() => confirm.guard(ed.ds.modified, ed.file.name, () => saveDeck(ed)), [confirm, ed]);

  const openFile = useCallback(async () => {
    const file = await services.openFile(OPEN_FILTERS);
    if (!file) return;
    try {
      const next = await readDeck(file.bytes);
      if (!(await canReplace())) return;
      ed.ds.reset(next);
      ed.setFile({ name: file.name, path: file.path });
      ed.goto(next.slides[0]?.id ?? 0);
      if (file.path) await services.addRecent({ app: 'powerpoint', name: file.name, path: file.path });
    } catch (err) {
      services.notify(`${S.app.openFailed(file.name)} ${errorText(err)}`, 'error');
    }
  }, [services, ed, canReplace]);

  const newDeck = useCallback((next: Deck) => {
    void canReplace().then((ok) => {
      if (!ok) return;
      ed.ds.reset(next.slides.length ? next : { ...next, slides: createBlankDeck(next.size).slides });
      ed.setFile({ name: `${S.app.untitled}.pptx`, path: null });
      ed.setUi({ backstage: null });
      const first = ed.ds.deck.slides[0];
      if (first) ed.goto(first.id);
    });
  }, [ed, canReplace]);

  const closeDoc = useCallback(() => {
    void canReplace().then((ok) => ok && services.close());
  }, [canReplace, services]);

  const startShow = useCallback((fromCurrent: boolean, presenter?: boolean) => {
    setUi({ show: { start: fromCurrent ? ed.slideIndex : 0, presenter: presenter ?? services.settings.get('powerpoint.presenter', false) } });
  }, [ed.slideIndex, services.settings, setUi]);

  const actions: AppActions = useMemo(() => ({
    save: () => void saveDeck(ed),
    saveAs: (format) => void saveDeck(ed, format ?? 'pptx'),
    backstage: (page) => setUi({ backstage: page }),
    startShow,
    cut: () => {
      const text = cutSelection(ed);
      void navigator.clipboard?.writeText(text).catch(() => undefined);
    },
    copy: () => {
      const text = copySelection(ed);
      void navigator.clipboard?.writeText(text).catch(() => undefined);
    },
    paste: (mode) => void pasteFromRibbon(ed, mode),
    copyFormat: () => {
      if (painter) setPainter(false);
      else if (pickFormat(ed)) setPainter(true);
    },
    dialog: (id) => setUi({ dialog: id }),
    pane: (pane) => setUi({ pane }),
    previewTransition: () => setPreview('transition'),
    previewAnimations: () => setPreview('animations'),
    drawShape: (preset) => setUi({ tool: { kind: 'shape', preset } }),
    painterActive: painter,
  }), [ed, painter, setUi, startShow]);

  // Reproduire la mise en forme : appliquee a la selection suivante.
  const lastSel = useRef(ed.selection.ids.join(','));
  useEffect(() => {
    const key = ed.selection.ids.join(',');
    if (painter && key && key !== lastSel.current) {
      applyFormat(ed, ed.selection.ids);
      setPainter(false);
    }
    lastSel.current = key;
  }, [ed.selection.ids, painter, ed]);

  const tabCtx: TabContext = { ed, app: actions };
  const tabs: RibbonTab[] = [
    homeTab(tabCtx), insertTab(tabCtx), drawTab(tabCtx), designTab(tabCtx), transitionsTab(tabCtx), animationsTab(tabCtx), showTab(tabCtx), reviewTab(tabCtx), viewTab(tabCtx), masterTab(tabCtx),
    shapeFormatTab(tabCtx), pictureFormatTab(tabCtx), tableDesignTab(tabCtx), tableLayoutTab(tabCtx), chartDesignTab(tabCtx),
  ];
  const commands = useMemo(() => collectCommands(tabs), [tabs]);

  const onCreate = useCallback((request: CreateRequest) => {
    let id: number | null = null;
    if (request.kind === 'ink') {
      ed.editShapes((shapes) => { id = createInk(shapes, request.points, request.color, request.width, !!request.highlighter); }, 'ink');
      return;
    }
    ed.editShapes((shapes) => { id = createFromRequest(shapes, request, presetName); }, 'insert');
    setUi({ tool: { kind: 'select' } });
    if (id !== null) {
      const created = id;
      ed.setSelection(request.kind === 'textbox' ? { ids: [created], text: { shapeId: created, range: { start: { p: 0, o: 0 }, end: { p: 0, o: 0 } } } } : { ids: [created] });
    }
  }, [ed, setUi]);

  // Raccourcis clavier globaux.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (ui.show || ui.backstage) return;
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (e.key === 'F5') {
        e.preventDefault();
        startShow(e.shiftKey || e.altKey, e.altKey);
        return;
      }
      if (e.key === 'Escape' && ui.tool.kind !== 'select') {
        setUi({ tool: { kind: 'select' } });
        return;
      }
      if (!ctrl || inField) return;
      const run = currentRun(ed);
      const handled = (fn: () => void): void => {
        e.preventDefault();
        fn();
      };
      if (key === 's') handled(() => (e.shiftKey ? setUi({ backstage: 'saveAs' }) : void saveDeck(ed)));
      else if (key === 'z' && !e.shiftKey) handled(ed.ds.undo);
      else if (key === 'y' || (key === 'z' && e.shiftKey)) handled(ed.ds.redo);
      else if (key === 'o') handled(() => void openFile());
      else if (key === 'p') handled(() => setUi({ backstage: 'print' }));
      else if (key === 'm') handled(() => ed.newSlide());
      else if (key === 'f') handled(() => setUi({ dialog: 'find' }));
      else if (key === 'h') handled(() => setUi({ dialog: 'replace' }));
      else if (key === 'k' && (ed.selection.ids.length || ed.selection.text)) handled(() => setUi({ dialog: 'link' }));
      else if ((key === 'b' || key === 'g') && !e.shiftKey && (ed.selection.text || (ed.selection.ids.length && key === 'b'))) handled(() => applyRun(ed, { bold: run.bold ? null : true }));
      else if (key === 'i' && (ed.selection.text || ed.selection.ids.length)) handled(() => applyRun(ed, { italic: run.italic ? null : true }));
      else if (key === 'u' && (ed.selection.text || ed.selection.ids.length)) handled(() => applyRun(ed, { underline: run.underline && run.underline !== 'none' ? null : 'sng' }));
      else if (key === 'e' && (ed.selection.text || ed.selection.ids.length)) handled(() => applyParagraph(ed, { align: 'ctr' }));
      else if (key === 'l' && (ed.selection.text || ed.selection.ids.length)) handled(() => applyParagraph(ed, { align: 'l' }));
      else if (key === 'r' && (ed.selection.text || ed.selection.ids.length)) handled(() => applyParagraph(ed, { align: 'r' }));
      else if (key === 'j' && (ed.selection.text || ed.selection.ids.length)) handled(() => applyParagraph(ed, { align: 'just' }));
      else if ((e.key === ']' || e.key === '>' || (e.shiftKey && e.key === '.')) && (ed.selection.text || ed.selection.ids.length)) handled(() => applyRun(ed, { size: nextFontSize(run.size ?? 18, 1) }));
      else if ((e.key === '[' || e.key === '<' || (e.shiftKey && e.key === ',')) && (ed.selection.text || ed.selection.ids.length)) handled(() => applyRun(ed, { size: nextFontSize(run.size ?? 18, -1) }));
      else if (key === 'c' && e.shiftKey) handled(actions.copyFormat);
      else if (key === 'v' && e.shiftKey) handled(() => applyFormat(ed, ed.selection.ids));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ed, ui.show, ui.backstage, ui.tool.kind, setUi, startShow, openFile, actions.copyFormat]);

  // Copier / couper / coller hors edition de texte (formes, diapositives, images du systeme).
  useEffect(() => {
    const editable = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    const onCopy = (e: ClipboardEvent): void => {
      if (editable(e.target) || ui.show || ui.backstage || ed.selection.text) return;
      const inSlides = !!(e.target instanceof Element && e.target.closest('.pp-slides'));
      e.preventDefault();
      const text = e.type === 'cut' ? cutSelection(ed, inSlides) : copySelection(ed, inSlides);
      e.clipboardData?.setData('text/plain', text);
    };
    const onPaste = (e: ClipboardEvent): void => {
      if (editable(e.target) || ui.show || ui.backstage || ed.selection.text) return;
      e.preventDefault();
      void pasteFromEvent(ed, e.clipboardData);
    };
    window.addEventListener('copy', onCopy);
    window.addEventListener('cut', onCopy);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('cut', onCopy);
      window.removeEventListener('paste', onPaste);
    };
  }, [ed, ui.show, ui.backstage]);

  const onDrop = (e: DragEvent): void => {
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    void (async () => {
      for (const f of files) await insertPictureBytes(ed, new Uint8Array(await f.arrayBuffer()), f.name);
    })();
  };

  const onSlideCommand = (cmd: string): void => {
    if (cmd === 'cut-slides') void navigator.clipboard?.writeText(cutSelection(ed, true)).catch(() => undefined);
    else if (cmd === 'copy-slides') void navigator.clipboard?.writeText(copySelection(ed, true)).catch(() => undefined);
    else if (cmd === 'paste') void pasteFromRibbon(ed);
    else if (cmd.startsWith('layout:')) {
      const id = cmd.slice(7);
      const ids = new Set(ed.selectedSlides.length ? ed.selectedSlides : ed.slide ? [ed.slide.id] : []);
      ed.commit(editSlides(deck, ids, (s) => applyLayout(deck, s, id)));
    }
  };

  const shapeMenu = (shapeId: number | null): MenuItem[] => {
    const ids = shapeId === null ? [] : ed.selection.ids.includes(shapeId) ? ed.selection.ids : [shapeId];
    const shape = shapeId === null ? undefined : locate(ed.pageShapes, shapeId)?.shape;
    const base: MenuItem[] = [
      { id: 'cut', label: S.common.cut, icon: 'cut', shortcut: 'Ctrl+X', disabled: !ids.length, onClick: actions.cut },
      { id: 'copy', label: S.common.copy, icon: 'copy', shortcut: 'Ctrl+C', disabled: !ids.length, onClick: actions.copy },
      { id: 'paste', label: S.common.paste, icon: 'clipboard_paste', shortcut: 'Ctrl+V', onClick: () => actions.paste() },
    ];
    if (!shape) {
      return [
        ...base,
        { id: 's', kind: 'separator' },
        { id: 'layout', label: S.slides.layout, icon: 'slide_layout', items: (deck.masters[0]?.layouts ?? []).map((l) => ({ id: l.id, label: l.name, onClick: () => onSlideCommand(`layout:${l.id}`) })) },
        { id: 'bg', label: S.design.formatBackground, icon: 'color_background', onClick: () => setUi({ dialog: 'background' }) },
        { id: 'grid', label: S.view.gridlines, checked: ui.grid, onClick: () => setUi({ grid: !ui.grid }) },
        { id: 'guides', label: S.view.guides, checked: ui.guides, onClick: () => setUi({ guides: !ui.guides, guidesX: ui.guidesX.length ? ui.guidesX : [deck.size.width / 2], guidesY: ui.guidesY.length ? ui.guidesY : [deck.size.height / 2] }) },
        { id: 'ruler', label: S.view.ruler, checked: ui.ruler, onClick: () => setUi({ ruler: !ui.ruler }) },
        { id: 'comment', label: S.review.newComment, icon: 'comment_add', onClick: () => setUi({ dialog: 'comment' }) },
      ];
    }
    return [
      ...base,
      { id: 's1', kind: 'separator' },
      {
        id: 'group', label: S.arrange.groupHeader, icon: 'group',
        items: [
          { id: 'g', label: S.arrange.group, disabled: ids.length < 2, onClick: () => { let gid: number | null = null; ed.editShapes((s) => { gid = groupShapes(s, ids, S.canvas.groupName); }, 'group'); if (gid !== null) ed.setSelection({ ids: [gid] }); } },
          { id: 'u', label: S.arrange.ungroup, disabled: shape.kind !== 'group', onClick: () => { let c: number[] = []; ed.editShapes((s) => { c = ungroup(s, shape.id); }, 'ungroup'); ed.setSelection({ ids: c }); } },
        ],
      },
      { id: 'front', label: S.arrange.front, icon: 'position_forward', onClick: () => ed.editShapes((s) => reorder(s, ids, 'front'), 'order') },
      { id: 'back', label: S.arrange.back, icon: 'position_backward', onClick: () => ed.editShapes((s) => reorder(s, ids, 'back'), 'order') },
      { id: 's2', kind: 'separator' },
      { id: 'link', label: S.insert.link, icon: 'link', shortcut: 'Ctrl+K', onClick: () => setUi({ dialog: 'link' }) },
      { id: 'comment', label: S.review.newComment, icon: 'comment_add', onClick: () => setUi({ dialog: 'comment' }) },
      { id: 'alt', label: S.context.altText, icon: 'accessibility_checkmark', onClick: () => setUi({ pane: 'accessibility' }) },
      { id: 's3', kind: 'separator' },
      ...(shape.kind === 'chart' ? [{ id: 'data', label: S.context.editData, icon: 'table_cell_edit' as const, onClick: () => setUi({ dialog: 'chartData' }) }] : []),
      ...(shape.kind === 'picture' ? [{ id: 'crop', label: S.context.crop, icon: 'crop' as const, onClick: () => setUi({ dialog: 'crop' }) }] : []),
      { id: 'format', label: shape.kind === 'picture' ? S.panes.formatPicture : S.home.formatShape, icon: 'paint_bucket', onClick: () => setUi({ pane: 'format' }) },
    ];
  };

  const showSlides = ui.thumbnails && (ui.view === 'normal' || ui.view === 'master');
  const total = deck.slides.length;
  const quickAccess: QuickAccessItem[] = [
    { id: 'save', label: S.app.save, icon: 'save', shortcut: 'Ctrl+S', onClick: actions.save },
    { id: 'undo', label: S.app.undo, icon: 'arrow_undo', shortcut: 'Ctrl+Z', disabled: !ed.ds.canUndo, onClick: ed.ds.undo },
    { id: 'redo', label: S.app.redo, icon: 'arrow_redo', shortcut: 'Ctrl+Y', disabled: !ed.ds.canRedo, onClick: ed.ds.redo },
    { id: 'show', label: S.show.fromStart, icon: 'slide_play', shortcut: 'F5', onClick: () => startShow(false) },
    { id: 'print', label: S.file.print, icon: 'print', defaultVisible: false, onClick: () => setUi({ backstage: 'print' }) },
  ];

  const masterPages = ui.view === 'master' ? deck.masters.flatMap((m, mi) => [{ ref: { kind: 'master' as const, masterIndex: mi }, label: m.name ?? S.master.master }, ...m.layouts.map((l) => ({ ref: { kind: 'layout' as const, masterIndex: mi, layoutId: l.id }, label: l.name }))]) : [];

  return (
    <div className={`pp-app${ui.grayscale ? ' is-gray' : ''}`} data-app="powerpoint" onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()} onDrop={onDrop}>
      <TitleBar
        app={info}
        documentName={baseName(ed.file.name)}
        location={ed.file.path}
        saveState={ed.ds.modified ? 'modified' : 'saved'}
        quickAccess={quickAccess}
        commands={commands}
        onRename={(n) => ed.setFile({ ...ed.file, name: `${n.replace(/[\\/:*?"<>|]/g, '')}.${ed.file.name.split('.').pop() ?? 'pptx'}` })}
        windowControls={services.windowControls}
        settings={services.settings}
      />
      <Ribbon
        tabs={tabs}
        activeTab={tabs.some((t) => t.id === ui.ribbonTab && !t.hidden) ? ui.ribbonTab : undefined}
        onTabChange={(id) => setUi({ ribbonTab: id })}
        onFile={() => setUi({ backstage: 'home' })}
        settings={services.settings}
        end={
          <>
            <Button size="small" appearance="subtle" icon="comment" onClick={() => setUi({ pane: ui.pane === 'comments' ? null : 'comments' })}>{S.review.comments}</Button>
            <Button size="small" appearance="primary" icon="slide_play" onClick={() => startShow(false)}>{S.show.present}</Button>
          </>
        }
      />
      {recovery && (
        <div className="pp-banner" role="status">
          <Icon name="history" size={16} />
          <span>{S.app.recovered(recovery.name, new Date(recovery.savedAt).toLocaleString('fr-FR'))}</span>
          <Button size="small" appearance="primary" onClick={() => { void readDeck(recovery.bytes).then((d) => { ed.ds.reset(d); ed.setFile({ name: recovery.name, path: recovery.path }); ed.goto(d.slides[0]?.id ?? 0); ed.ds.commit({ ...d }); }); void sharedRecovery('powerpoint').discard(recovery).catch(() => undefined); setRecovery(null); }}>{S.app.restore}</Button>
          <Button size="small" onClick={() => { void sharedRecovery('powerpoint').discard(recovery).catch(() => undefined); setRecovery(null); }}>{S.app.discard}</Button>
        </div>
      )}
      <div className={`pp-body${strip ? ' is-strip' : ''}`}>
        {showSlides && (
          <aside className={`pp-side${strip ? ' is-strip' : ''}`} aria-label={S.slides.listLabel}>
            {ui.view === 'master' ? (
              <div className="pp-masterlist">
                {masterPages.map((p, i) => {
                  const active = ui.masterPage && JSON.stringify(ui.masterPage) === JSON.stringify(p.ref);
                  return (
                    <button key={i} type="button" className={`pp-masterlist__item${p.ref.kind === 'layout' ? ' is-layout' : ''}${active ? ' is-active' : ''}`} onClick={() => { setUi({ masterPage: p.ref }); ed.setSelection({ ids: [] }); }}>
                      <Icon name={p.ref.kind === 'master' ? 'slide_layout' : 'slide_text'} size={16} />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <SlideList ed={ed} mode="panel" width={strip ? 88 : phone ? 64 : 168} onRenameSection={(s) => { setSection(s); setUi({ dialog: 'sectionName' }); }} onCommand={onSlideCommand} />
            )}
          </aside>
        )}
        <main className="pp-main">
          {ui.view === 'sorter' && <SlideList ed={ed} mode="sorter" width={220} onRenameSection={(s) => { setSection(s); setUi({ dialog: 'sectionName' }); }} onCommand={onSlideCommand} />}
          {ui.view === 'outline' && <OutlineView ed={ed} />}
          {ui.view === 'notesPage' && <NotesPageView ed={ed} />}
          {ui.view === 'reading' && <SlideShow deck={deck} start={ed.slideIndex} presenter={false} windowed onExit={(i) => { const s = deck.slides[i]; if (s) ed.goto(s.id); setUi({ view: 'normal' }); }} onOpenUrl={(url) => window.open(url, '_blank', 'noopener')} />}
          {(ui.view === 'normal' || ui.view === 'master') && (
            <>
              <div className="pp-stage" ref={stageRef}>
                {ed.owner ? (
                  <CanvasEditor
                    width={deck.size.width}
                    height={deck.size.height}
                    background={ed.background}
                    ctx={ed.ctx}
                    shapes={ed.pageShapes}
                    underlay={ed.underlay}
                    uid={`e${ed.page.kind}${ed.slide?.id ?? 0}`}
                    zoom={zoom}
                    onZoomChange={(z) => setUi({ zoom: z, fit: false })}
                    selection={ed.selection}
                    onSelectionChange={ed.setSelection}
                    onEdit={ed.editShapes}
                    tool={ui.tool}
                    onCreate={onCreate}
                    options={{ grid: ui.grid ? 28.35 : null, snapToGrid: ui.snapToGrid, smartGuides: ui.smartGuides, guidesX: ui.guides ? ui.guidesX : [], guidesY: ui.guides ? ui.guidesY : [], onGuidesChange: (g) => setUi({ guidesX: g.x, guidesY: g.y }), rulers: ui.ruler }}
                    onContextMenu={(e, id) => context.open(e, shapeMenu(id))}
                    onShapeDoubleClick={(id) => {
                      const shape = locate(ed.pageShapes, id)?.shape;
                      if (shape?.kind === 'chart') setUi({ dialog: 'chartData' });
                      else setUi({ pane: 'format' });
                      return true;
                    }}
                    className="pp-canvas"
                  />
                ) : (
                  <div className="pp-empty">{S.app.noSlide}</div>
                )}
                {preview && ed.slide && ui.view === 'normal' && <PreviewOverlay ed={ed} kind={preview} onDone={() => setPreview(null)} width={deck.size.width} height={deck.size.height} scale={(zoom / 100) * (96 / 72)} />}
              </div>
              {ui.notes && ui.view === 'normal' && <NotesPane ed={ed} height={notesHeight} onResize={setNotesHeight} />}
            </>
          )}
        </main>
        <SidePanes ed={ed} onPlayAnimations={() => setPreview('animations')} />
      </div>
      <StatusBar
        left={[
          { id: 'slide', label: ui.view === 'master' ? S.master.master : S.status.slide(ed.slideIndex + 1, total), title: S.status.goto },
          { id: 'lang', label: S.status.language },
          { id: 'a11y', label: S.status.accessibility, icon: 'accessibility_checkmark', onClick: () => setUi({ pane: 'accessibility' }) },
        ]}
        right={[
          { id: 'notes', label: S.view.notes, icon: 'note', onClick: () => setUi({ notes: !ui.notes }) },
          { id: 'comments', label: S.review.comments, icon: 'comment', onClick: () => setUi({ pane: ui.pane === 'comments' ? null : 'comments' }) },
        ]}
        views={[
          { id: 'normal', label: S.view.normal, icon: 'slide_text' },
          { id: 'sorter', label: S.view.sorter, icon: 'grid' },
          { id: 'reading', label: S.view.reading, icon: 'book_open' },
          { id: 'show', label: S.show.slideshow, icon: 'slide_play' },
        ]}
        activeView={ui.view === 'master' ? 'normal' : ui.view}
        onViewChange={(id) => (id === 'show' ? startShow(true) : openView(ed, id as 'normal' | 'sorter' | 'reading'))}
        zoom={zoom}
        onZoomChange={(z) => setUi({ zoom: z, fit: false })}
        zoomPresets={[{ label: S.view.fit, compute: () => fitZoom(deck.size, stageSize, 28) }]}
      >
        <button type="button" className="pp-fitbtn" title={S.view.fit} aria-pressed={ui.fit} onClick={() => setUi({ fit: true })}>
          <Icon name="zoom_fit" size={16} />
        </button>
      </StatusBar>
      <FileMenu
        ed={ed}
        open={ui.backstage !== null}
        page={ui.backstage ?? 'home'}
        onPage={(page) => setUi({ backstage: page })}
        onClose={() => setUi({ backstage: null })}
        onNew={newDeck}
        onOpen={() => void openFile()}
        onCloseDoc={closeDoc}
        onPrint={(layout, indices, hidden) => setPrintJob({ layout, indices, hidden })}
      />
      {confirm.dialog}
      <Dialogs ed={ed} dialog={ui.dialog} section={section} onClose={() => { setUi({ dialog: null }); setSection(null); }} />
      {ui.show && (
        <SlideShow
          deck={deck}
          start={ui.show.start}
          presenter={ui.show.presenter}
          onExit={(i) => {
            const s = deck.slides[i];
            if (s) ed.goto(s.id);
            setUi({ show: null });
          }}
          onOpenUrl={(url) => {
            if (/^(https?:|mailto:)/i.test(url)) window.open(url, '_blank', 'noopener');
          }}
        />
      )}
      {printJob && <PrintJob deck={deck} layout={printJob.layout} pages={printPages(deck, printJob.layout, printJob.indices, printJob.hidden)} onDone={() => setPrintJob(null)} print={services.print} />}
      {context.menu}
    </div>
  );
}
