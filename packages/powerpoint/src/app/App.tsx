// Application Presentation : chargement, ruban, volets, zone d'edition, barre d'etat, diaporama, raccourcis.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { MODULES, registerProbe, sharedRecovery, type ModuleProps, type RecoveryEntry } from '@forgeoffice/core';
import {
  Button, Dialog, Icon, KeyboardBar, MiniToolbar, Ribbon, Spinner, StatusBar, TitleBar, collectCommands, itemsFromTab, nextFontSize, useConfirmDiscard, useContextMenu, useLayout, useMediaQuery, type MenuItem, type QuickAccessItem, type RibbonTab,
} from '@forgeoffice/ui';
import { applyLayout, createBlankDeck, type Deck, type Section } from '@forgeoffice/pptx';
import { CanvasEditor } from '../canvas/CanvasEditor.tsx';
import { fitZoom } from '../canvas/math.ts';
import { deleteShapes, duplicateShapes, groupShapes, locate, reorder, ungroup } from '../canvas/ops.ts';
import type { CreateRequest } from '../canvas/types.ts';
import { NotesPane, NotesPageView, OutlineView, PreviewOverlay } from './AppViews.tsx';
import { FileMenu, PrintJob, printPages, type PrintLayout } from './backstage.tsx';
import { applyFormat, copySelection, cutSelection, pasteFromEvent, pasteFromRibbon, pickFormat } from './clipboard.ts';
import { createFromRequest, createInk, editSlides } from './deck-ops.ts';
import { Dialogs } from './dialogs.tsx';
import { useEditor, type Editor } from './editor.ts';
import { backup, baseName, errorText, exportImages, OPEN_FILTERS, readDeck, saveDeck } from './fileops.ts';
import { applyParagraph, applyRun, currentRun } from './format.ts';
import { changePicture, insertPictureBytes } from './insert.ts';
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
import { SuiteSidebar } from './SuiteSidebar.tsx';
import { SuiteViewTabs, suiteStatus } from './suite-chrome.tsx';
import './suite-impress.css';
import { SlideShow } from './SlideShow.tsx';
import { pptProbe, probeCounters } from './probe.ts';
import { PresenterWindow } from './PresenterWindow.tsx';
import { listenAnnounce } from './show-sync.ts';
import { applyTimings } from './deck-ops.ts';
import { formatClock } from './RehearseBar.tsx';
import { S2 } from '../strings2.ts';
import { S3 } from './strings-text.ts';
import { saveSelectionAsImage } from './save-as-image.ts';
import { textMenuItems } from './text-menu.ts';
import { matchShortcut, type ShortcutId } from './shortcuts.ts';
import { mediaPlaybackTab } from './ribbon/media.tsx';
import { smartArtTab } from './ribbon/smartart-tab.tsx';
import { effectiveShow, fromShowProps } from './show-settings.ts';
import { backupDelayMs, readOptions } from './options-model.ts';
import { mergeMenuItems } from './merge-ops.ts';
import { PointsOverlay } from './PointsOverlay.tsx';
import { pointsTarget, startEditPoints } from './points-ops.ts';
import { miniKindOf, miniRows, type MiniKind } from './minibar.ts';
import { linkMenuItems } from './link-menu.ts';
import { chartTypeMenuItems } from './ribbon/contextual.tsx';
import { cellFromEvent, tableMenuItems } from './table-menu.ts';
import { selectedEquation, selectedSmartArt } from './insert-objects.ts';
import { S } from '../strings.ts';
import './app.css';

const info = MODULES.powerpoint;

/** Chargement du fichier passe a l'ouverture, puis espace de travail. */
export function PowerPointApp({ services, file }: ModuleProps) {
  // Fenetre « Ecran du presentateur » : ouverte par ?presenter=1, ou invitee par un diaporama en cours dans une autre fenetre.
  const [follower, setFollower] = useState(() => new URLSearchParams(window.location.search).get('presenter') === '1');
  const hadFile = useRef(!!file);
  useEffect(() => (hadFile.current || file || follower ? undefined : listenAnnounce(() => setFollower(true))), [file, follower]);
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
  if (follower) return <PresenterWindow onClose={() => setFollower(false)} />;
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
  /** Disposition LibreOffice / OpenOffice : volet des diapos, onglets de vue, barre laterale et barre d'etat de la suite. */
  const { layout } = useLayout(services.settings, 'powerpoint');
  const suite = layout === 'libreoffice' ? 'lo' : layout === 'openoffice' ? 'oo' : null;
  /** Telephone en portrait : les miniatures passent en bandeau horizontal sous la diapositive (qui garde toute la largeur). */
  const strip = useMediaQuery('(max-width: 719px) and (orientation: portrait)');
  const [preview, setPreview] = useState<'transition' | 'animations' | null>(null);
  const [printJob, setPrintJob] = useState<{ layout: PrintLayout; indices: number[]; hidden: boolean } | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [notesSize, setNotesHeight] = useState<number | null>(null);
  const notesHeight = notesSize ?? (layout === 'onlyoffice' ? 38 : 96); // OnlyOffice : bande de notes de 38 px
  const [stageSize, setStageSize] = useState({ width: 900, height: 600 });
  const stageRef = useRef<HTMLDivElement>(null);
  const context = useContextMenu();
  /** Mini-barre de mise en forme du clic droit (au-dessus du menu). */
  const [mini, setMini] = useState<{ left: number; top: number; width: number; height: number; kind: MiniKind } | null>(null);
  useEffect(() => {
    if (!mini) return;
    const off = (e: Event): void => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as HTMLElement | null)?.closest?.('.fo-mini')) setMini(null);
    };
    window.addEventListener('keydown', off);
    window.addEventListener('pointerdown', off, true);
    return () => {
      window.removeEventListener('keydown', off);
      window.removeEventListener('pointerdown', off, true);
    };
  }, [mini]);
  /** Mini-barre du clic droit : celle du texte en edition, sinon celle du type d'objet. */
  const miniAtPointer = (id: number | null, x: number, y: number): typeof mini => {
    const kind = ed.selection.text ? 'text' : miniKindOf(id === null ? undefined : locate(ed.pageShapes, id)?.shape);
    return kind ? { left: x, top: y, width: 1, height: 1, kind } : null;
  };
  // La modification des points s'arrete quand la selection n'est plus la forme editee.
  useEffect(() => {
    if (ui.editPoints !== null && !(ed.selection.ids.length === 1 && ed.selection.ids[0] === ui.editPoints)) setUi({ editPoints: null });
  }, [ed.selection.ids, ui.editPoints, setUi]);
  // Mini-barre du texte : apparait quand une selection non vide est faite dans la zone de saisie (souris relachee), disparait quand elle se reduit.
  useEffect(() => {
    if (!ed.selection.text) return;
    const show = (): void => {
      const sel = window.getSelection();
      const flow = sel?.anchorNode instanceof Node ? (sel.anchorNode.parentElement?.closest('[data-text-flow][contenteditable="true"]') ?? null) : null;
      if (!sel || sel.isCollapsed || !flow || !sel.rangeCount) return;
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.width > 0) setMini({ left: r.left, top: r.top, width: r.width, height: r.height, kind: 'text' });
    };
    const hide = (): void => {
      if (window.getSelection()?.isCollapsed) setMini((m) => (m?.kind === 'text' ? null : m));
    };
    window.addEventListener('mouseup', show);
    window.addEventListener('keyup', show);
    document.addEventListener('selectionchange', hide);
    return () => {
      window.removeEventListener('mouseup', show);
      window.removeEventListener('keyup', show);
      document.removeEventListener('selectionchange', hide);
    };
  }, [ed.selection.text]);

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
  // Crochet du banc de conformite (developpement seulement).
  useEffect(() => (import.meta.env.DEV ? registerProbe(pptProbe(() => edRef.current)) : undefined), []);
  useEffect(() => {
    if (!ed.ds.modified) return;
    const delay = backupDelayMs(readOptions((k, d) => services.settings.get(k, d), S.review.defaultAuthor));
    if (delay === null) return;
    const t = window.setTimeout(() => void backup(edRef.current).catch(() => undefined), delay);
    return () => window.clearTimeout(t);
  }, [ed.ds.revision, ed.ds.modified, services.settings]);

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
  const zoom = ui.fit ? fitZoom(deck.size, { width: stageSize.width - 16, height: stageSize.height - 16 }, layout === 'onlyoffice' ? 48 : ui.ruler ? 40 : 28) : ui.zoom; // OnlyOffice : 48 px de marge reelle + barres de defilement

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

  const [timings, setTimings] = useState<Record<number, number> | null>(null);
  const appOptions = readOptions((k, d) => services.settings.get(k, d), S.review.defaultAuthor);
  const showSettings = effectiveShow(fromShowProps(deck.show));
  const startShow = useCallback((fromCurrent: boolean, presenter?: boolean, mode?: 'twoWindows' | 'rehearse') => {
    if (mode === 'twoWindows') {
      // Ouvert depuis le geste de l'utilisateur : une seconde fenetre de bureau, sinon une fenetre du navigateur.
      if (services.windowControls) void services.openModule('powerpoint');
      else if (!window.open(`${window.location.pathname}?app=powerpoint&presenter=1`, 'fo-presenter', 'popup,width=1100,height=760')) services.notify(S2.presenterWindow.popupBlocked, 'info');
    }
    setUi({ show: { start: fromCurrent ? ed.slideIndex : 0, presenter: mode === 'twoWindows' ? false : (presenter ?? services.settings.get('powerpoint.presenter', false)), twoWindows: mode === 'twoWindows', rehearse: mode === 'rehearse' } });
  }, [ed.slideIndex, services, setUi]);

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
    previewTransition: () => { if (import.meta.env.DEV) probeCounters.previews += 1; setPreview('transition'); },
    previewAnimations: () => { if (import.meta.env.DEV) probeCounters.previews += 1; setPreview('animations'); },
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
    shapeFormatTab(tabCtx), pictureFormatTab(tabCtx), mediaPlaybackTab(tabCtx), smartArtTab(tabCtx), tableDesignTab(tabCtx), tableLayoutTab(tabCtx), chartDesignTab(tabCtx),
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
      if (e.key === 'Escape' && ui.tool.kind !== 'select') {
        setUi({ tool: { kind: 'select' } });
        return;
      }
      const shortcut = matchShortcut(e, { hasTarget: !!(ed.selection.text || ed.selection.ids.length), hasText: !!ed.selection.text });
      if (!shortcut || (inField && shortcut.group !== 'show')) return;
      const run = currentRun(ed);
      const commands: Record<ShortcutId, () => void> = {
        save: () => void saveDeck(ed),
        saveAs: () => setUi({ backstage: 'saveAs' }),
        open: () => void openFile(),
        print: () => setUi({ backstage: 'print' }),
        undo: ed.ds.undo,
        redo: ed.ds.redo,
        newSlide: () => ed.newSlide(),
        find: () => setUi({ dialog: 'find' }),
        replace: () => setUi({ dialog: 'replace' }),
        link: () => setUi({ dialog: 'link' }),
        font: () => setUi({ dialog: 'font' }),
        bold: () => applyRun(ed, { bold: run.bold ? null : true }),
        italic: () => applyRun(ed, { italic: run.italic ? null : true }),
        underline: () => applyRun(ed, { underline: run.underline && run.underline !== 'none' ? null : 'sng' }),
        center: () => applyParagraph(ed, { align: 'ctr' }),
        left: () => applyParagraph(ed, { align: 'l' }),
        right: () => applyParagraph(ed, { align: 'r' }),
        justify: () => applyParagraph(ed, { align: 'just' }),
        grow: () => applyRun(ed, { size: nextFontSize(run.size ?? 18, 1) }),
        shrink: () => applyRun(ed, { size: nextFontSize(run.size ?? 18, -1) }),
        copyFormat: actions.copyFormat,
        pasteFormat: () => applyFormat(ed, ed.selection.ids),
        startShow: () => startShow(false),
        startFromCurrent: () => startShow(true),
        presenterShow: () => startShow(true, true),
        shortcuts: () => setUi({ dialog: 'shortcuts' }),
      };
      e.preventDefault();
      commands[shortcut.id]();
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
    else if (cmd.startsWith('save-image:')) void exportImages(ed, 'png', true, ed.deck.slides.findIndex((s) => s.id === Number(cmd.slice(11))));
    else if (cmd.startsWith('layout:')) {
      const id = cmd.slice(7);
      const ids = new Set(ed.selectedSlides.length ? ed.selectedSlides : ed.slide ? [ed.slide.id] : []);
      ed.commit(editSlides(deck, ids, (s) => applyLayout(deck, s, id)));
    }
  };

  const shapeMenu = (shapeId: number | null, hit: { row: number; col: number } | null = null): MenuItem[] => {
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
      ...(shape.kind === 'shape' && ids.length === 1 ? [{ id: 'points', label: S3.points.menu, icon: 'edit' as const, onClick: () => startEditPoints(ed) }] : []),
      ...(ids.length > 1 ? [{ id: 'merge', label: S3.merge.menu, icon: 'shapes' as const, items: mergeMenuItems(ed) }] : []),
      { id: 'front', label: S.arrange.front, icon: 'position_forward', onClick: () => ed.editShapes((s) => reorder(s, ids, 'front'), 'order') },
      { id: 'forward', label: S.arrange.forward, icon: 'position_forward', onClick: () => ed.editShapes((s) => reorder(s, ids, 'forward'), 'order') },
      { id: 'backward', label: S.arrange.backward, icon: 'position_backward', onClick: () => ed.editShapes((s) => reorder(s, ids, 'backward'), 'order') },
      { id: 'back', label: S.arrange.back, icon: 'position_backward', onClick: () => ed.editShapes((s) => reorder(s, ids, 'back'), 'order') },
      { id: 'dup', label: S.canvas.duplicate, icon: 'copy' as const, shortcut: 'Ctrl+D', onClick: () => { let made: number[] = []; ed.editShapes((sh) => { made = duplicateShapes(sh, ids, { x: 12, y: 12 }); }, 'duplicate'); if (made.length) ed.setSelection({ ids: made }); } },
      { id: 'del', label: S.canvas.deleteShape, icon: 'delete' as const, shortcut: 'Suppr', onClick: () => { ed.editShapes((sh) => deleteShapes(sh, ids), 'delete'); ed.setSelection({ ids: [] }); } },
      { id: 's2', kind: 'separator' },
      { id: 'link', label: S.insert.link, icon: 'link', shortcut: 'Ctrl+K', onClick: () => setUi({ dialog: 'link' }) },
      { id: 'comment', label: S.review.newComment, icon: 'comment_add', onClick: () => setUi({ dialog: 'comment' }) },
      ...(shape.kind === 'table' ? tableMenuItems(ed, shape, hit) : []),
      ...(shape.kind === 'shape' || shape.kind === 'table' ? [{ id: 'bullets', label: S3.bullets.menu, icon: 'text_bullet_list_ltr' as const, onClick: () => setUi({ dialog: 'bullets' }) }, { id: 'font', label: `${S3.font.title}…`, icon: 'text_font' as const, shortcut: 'Ctrl+T', onClick: () => setUi({ dialog: 'font' }) }, { id: 'para', label: `${S3.paragraph.title}…`, icon: 'text_paragraph' as const, onClick: () => setUi({ dialog: 'paragraph' }) }] : []),
      { id: 'alt', label: S.context.altText, icon: 'accessibility_checkmark', onClick: () => setUi({ pane: 'accessibility' }) },
      { id: 's3', kind: 'separator' },
      ...linkMenuItems(ed, shape.click, () => setUi({ dialog: 'link' })),
      ...(shape.kind === 'chart' ? [{ id: 'ctype', label: S3.changeChartType, icon: 'data_bar_vertical' as const, items: chartTypeMenuItems(ed) }] : []),
      ...(shape.kind === 'picture' ? [{ id: 'changePic', label: S3.changePicture, icon: 'image_add' as const, onClick: () => void changePicture(ed) }] : []),
      ...(shape.kind === 'chart' ? [{ id: 'data', label: S.context.editData, icon: 'table_cell_edit' as const, onClick: () => setUi({ dialog: 'chartData' }) }] : []),
      ...(shape.kind === 'picture' ? [{ id: 'crop', label: S.context.crop, icon: 'crop' as const, onClick: () => setUi({ dialog: 'crop' }) }, { id: 'removeBg', label: S2.removeBg.button, icon: 'image_edit' as const, onClick: () => setUi({ dialog: 'removeBg' }) }] : []),
      ...(selectedEquation(ed) ? [{ id: 'eq', label: S2.equation.edit, icon: 'math_formula' as const, onClick: () => setUi({ dialog: 'equation' }) }] : []),
      ...(selectedSmartArt(ed) ? [{ id: 'sa', label: S2.smartart.edit, icon: 'flow' as const, onClick: () => setUi({ dialog: 'smartart' }) }] : []),
      { id: 'saveImg', label: S3.image.menu, icon: 'image', onClick: () => void saveSelectionAsImage(ed) },
      { id: 'geom', label: S3.geom.menu, icon: 'resize', onClick: () => setUi({ dialog: 'sizePosition' }) },
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
    <div className={`pp-app${ui.grayscale ? ' is-gray' : ''}`} data-app="powerpoint" data-suite-kind={suite ?? undefined} onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()} onDrop={onDrop}>
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
        onFile={(p) => setUi({ backstage: p ?? 'home' })}
        settings={services.settings}
        end={
          <span className="pp-end-extra">
            <Button size="small" appearance="subtle" icon="comment" onClick={() => setUi({ pane: ui.pane === 'comments' ? null : 'comments' })}>{S.review.comments}</Button>
            <Button size="small" appearance="primary" icon="slide_play" onClick={() => startShow(false)}>{S.show.present}</Button>
          </span>
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
            {suite && <div className="pp-side__head"><span>Diapos</span><button type="button" aria-label="Fermer le volet des diapos" onClick={() => setUi({ thumbnails: false })}>×</button></div>}
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
              <SlideList ed={ed} mode="panel" width={strip ? 88 : phone ? 64 : suite ? 112 : 168} onRenameSection={(s) => { setSection(s); setUi({ dialog: 'sectionName' }); }} onCommand={onSlideCommand} />
            )}
          </aside>
        )}
        <main className="pp-main">
          {suite && <SuiteViewTabs ed={ed} />}
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
                    options={{ grid: ui.grid ? 28.35 : null, snapToGrid: ui.snapToGrid, smartGuides: ui.smartGuides, guidesX: ui.guides ? ui.guidesX : [], guidesY: ui.guides ? ui.guidesY : [], onGuidesChange: (g) => setUi({ guidesX: g.x, guidesY: g.y }), rulers: ui.ruler, spell: { enabled: appOptions.spell, lang: appOptions.lang, nativeMenuWithShift: true } }}
                    onContextMenu={(e, id) => { context.open(e, ed.selection.text ? textMenuItems(ed, setUi) : shapeMenu(id, cellFromEvent(e))); setMini(miniAtPointer(id, e.clientX, e.clientY)); }}
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
              {ui.notes && !suite && ui.view === 'normal' && <NotesPane ed={ed} height={notesHeight} onResize={setNotesHeight} />}
            </>
          )}
        </main>
        <SidePanes ed={ed} onPlayAnimations={() => setPreview('animations')} />
        {suite && <SuiteSidebar ed={ed} tabs={tabs} kind={suite} onDialog={(d) => setUi({ dialog: d })} onLayout={(id) => onSlideCommand(`layout:${id}`)} onShape={(preset) => setUi({ tool: { kind: 'shape', preset } })} />}
      </div>
      <KeyboardBar
        items={itemsFromTab(tabs[0] ?? homeTab(tabCtx), ['bold', 'italic', 'underline', 'strike', 'color', 'highlight', 'shrink', 'grow', 'alignLeft', 'alignCenter', 'alignRight', 'justify', 'bullets', 'numbering', 'outdent', 'indent', 'cut', 'copy', 'paste'], ['alignLeft', 'bullets', 'cut'])}
        alwaysVisible={!!ed.selection.text} overflow="scroll"
      />
      <StatusBar
        {...(suite ? suiteStatus(suite, ed, total) : {
          left: [
            { id: 'slide', label: ui.view === 'master' ? S.master.master : S.status.slide(ed.slideIndex + 1, total), title: S.status.goto },
            { id: 'lang', label: S.status.language },
            { id: 'a11y', label: S.status.accessibility, icon: 'accessibility_checkmark' as const, onClick: () => setUi({ pane: 'accessibility' }) },
          ],
          right: [
            { id: 'notes', label: S.view.notes, icon: 'note' as const, onClick: () => setUi({ notes: !ui.notes }) },
            { id: 'comments', label: S.review.comments, icon: 'comment' as const, onClick: () => setUi({ pane: ui.pane === 'comments' ? null : 'comments' }) },
          ],
          views: [
            { id: 'normal', label: S.view.normal, icon: 'slide_text' as const },
            { id: 'sorter', label: S.view.sorter, icon: 'grid' as const },
            { id: 'reading', label: S.view.reading, icon: 'book_open' as const },
            { id: 'show', label: S.show.slideshow, icon: 'slide_play' as const },
          ],
        })}
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
          sync={ui.show.twoWindows ? { openWindow: true } : undefined}
          rehearse={ui.show.rehearse}
          useTimings={services.settings.get('powerpoint.useTimings', true) && !showSettings.manual}
          settings={ui.show.customShowId === undefined ? showSettings : { ...showSettings, customShowId: ui.show.customShowId }}
          onExit={(i, spent) => {
            const s = deck.slides[i];
            if (s) ed.goto(s.id);
            setUi({ show: null });
            if (spent && Object.keys(spent).length) setTimings(spent);
          }}
          onOpenUrl={(url) => {
            if (/^(https?:|mailto:)/i.test(url)) window.open(url, '_blank', 'noopener');
          }}
        />
      )}
      {timings && (
        <Dialog
          open
          title={S2.rehearse.saveTitle}
          onClose={() => setTimings(null)}
          width={440}
          actions={[
            { label: S2.rehearse.save, primary: true, onClick: () => { ed.commit(applyTimings(ed.deck, timings), 'timings'); setTimings(null); } },
            { label: S2.rehearse.keep, onClick: () => setTimings(null) },
          ]}
        >
          <p>{S2.rehearse.saveText(formatClock(Object.values(timings).reduce((a, b) => a + b, 0)), Object.keys(timings).length)}</p>
        </Dialog>
      )}
      {printJob && <PrintJob deck={deck} layout={printJob.layout} pages={printPages(deck, printJob.layout, printJob.indices, printJob.hidden)} onDone={() => setPrintJob(null)} print={services.print} />}
      {context.menu}
      {ui.editPoints !== null && <PointsOverlay ed={ed} shapeId={ui.editPoints} openMenu={context.open} onExit={() => setUi({ editPoints: null })} />}
      {mini && <MiniToolbar label={S2.mini.label} anchor={mini} onClose={() => setMini(null)} rows={miniRows(mini.kind, tabs)} />}
    </div>
  );
}
