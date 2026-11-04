// Bloc-notes de ForgeOffice : reecriture complete de WinNote (onglets, session, notes liees, apercu Markdown, 17 themes).
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from 'react';
import { MODULES, moduleForFile, type ModuleProps, type NoticeKind, type RecentFile, type WindowControls } from '@forgeoffice/core';
import { Ribbon, TitleBar, collectCommands, useContextMenu, type MenuItem } from '@forgeoffice/ui';
import { buildCommands, commandMap, type Command, type DialogKind, type PaletteMode } from './commands.ts';
import { ENCODINGS, EOLS } from './logic/encoding.ts';
import { isSafeUrl, noteKey, type LinkTarget } from './logic/links.ts';
import { PREFS_KEY, applyLayout as layoutPrefs, parsePrefs, type NotesPrefs } from './logic/prefs.ts';
import { matchShortcut } from './logic/shortcuts.ts';
import { fontStack, themeById } from './logic/themes.ts';
import { goToLine } from './editor/actions.ts';
import { languageNames } from './editor/languages.ts';
import { linkAtPos } from './editor/marks.ts';
import { convertToDocx, openInBrowser, pickFolder, printText } from './dom-actions.ts';
import { buildMenus, buildRibbon, item } from './ribbon.ts';
import { AboutDialog, CompareDialog, FontDialog, SaveDialog, StatsDialog, type SaveAnswer } from './ui/Dialogs.tsx';
import { FileBackstage } from './ui/FileBackstage.tsx';
import { MenuBar } from './ui/MenuBar.tsx';
import { Palette, type PaletteItem } from './ui/Palette.tsx';
import { Preview } from './ui/Preview.tsx';
import { Sidebar, noteSources } from './ui/Sidebar.tsx';
import { StatusLine } from './ui/StatusLine.tsx';
import { TabStrip } from './ui/TabStrip.tsx';
import { Workspace, errorText } from './workspace.ts';
import { CMD, S } from './strings.ts';
import './notes.css';

const info = MODULES.notes;
type TopmostControls = WindowControls & { setAlwaysOnTop?: (on: boolean) => unknown };

export function NotesApp({ services, file }: ModuleProps) {
  const [prefs, setPrefsState] = useState<NotesPrefs>(() => parsePrefs(services.settings.get<unknown>(PREFS_KEY, null)));
  const prefsRef = useRef(prefs);
  const [ws] = useState(() => new Workspace(services, prefsRef.current));
  useSyncExternalStore(ws.subscribe, ws.getVersion);
  const [palette, setPalette] = useState<PaletteMode | null>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [compare, setCompare] = useState<{ left: string; right: string } | null>(null);
  const [asking, setAsking] = useState<{ name: string; answer: (a: SaveAnswer) => void } | null>(null);
  const [backstage, setBackstage] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [zen, setZen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const ctx = useContextMenu();
  const topmost = services.windowControls as TopmostControls | null;
  const canTopmost = typeof topmost?.setAlwaysOnTop === 'function';
  const tab = ws.active;

  const setPrefs = useCallback(
    (change: Partial<NotesPrefs>) => {
      const next = { ...prefsRef.current, ...change };
      prefsRef.current = next;
      setPrefsState(next);
      services.settings.set(PREFS_KEY, next);
    },
    [services],
  );
  useEffect(() => ws.setPrefs(prefs), [ws, prefs]);
  useEffect(() => {
    if (canTopmost) topmost?.setAlwaysOnTop?.(prefs.topmost);
  }, [canTopmost, topmost, prefs.topmost]);

  const notify = useCallback((m: string, kind: NoticeKind = 'info') => services.notify(m, kind), [services]);
  const refreshRecents = useCallback(() => {
    services.recentFiles().then((list) => setRecents(list.filter((r) => r.app === 'notes')), (err: unknown) => notify(errorText(err), 'error'));
  }, [services, notify]);

  // Editeur principal + demarrage (session, fichier passe a l'ouverture).
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    ws.attach(el);
    if (!started.current) {
      started.current = true;
      ws.restore().then(
        () => {
          // La coquille peut monter brievement ce module avec le fichier destine a une autre application : ignore.
          if (file && moduleForFile(file.name) === 'notes') ws.openFile(file);
          if (ws.tabs.length === 0) ws.newTab();
          ws.view?.focus();
        },
        (err: unknown) => {
          notify(errorText(err), 'error');
          if (ws.tabs.length === 0) ws.newTab();
        },
      );
    }
    refreshRecents();
    return () => ws.detach();
  }, [ws, file, notify, refreshRecents]);

  useEffect(() => {
    if (!prefs.split || !splitRef.current) return;
    ws.attachSecondary(splitRef.current);
    return () => ws.detachSecondary();
  }, [ws, prefs.split]);

  // Session : ecrite souvent, et a la fermeture de la fenetre.
  useEffect(() => {
    const timer = window.setInterval(() => ws.persist(), 5000);
    const onHide = (): void => ws.persist(true);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', onHide);
      ws.persist(true);
    };
  }, [ws]);
  useEffect(() => {
    const timer = window.setTimeout(() => ws.persist(), 1000);
    return () => window.clearTimeout(timer);
  });

  // Theme WinNote : sombre ou clair pour toute la fenetre (menus et dialogues compris), retabli en quittant.
  const theme = themeById(prefs.theme);
  useEffect(() => {
    const root = document.documentElement;
    const before = root.dataset.theme;
    if (theme) root.dataset.theme = theme.dark ? 'dark' : 'light';
    return () => {
      if (before === undefined) delete root.dataset.theme;
      else root.dataset.theme = before;
    };
  }, [theme]);

  // --- Actions ---

  const askSave = useCallback((name: string) => new Promise<SaveAnswer>((resolve) => setAsking({ name, answer: (a) => { setAsking(null); resolve(a); } })), []);

  const closeTabs = useCallback(
    async (ids: readonly string[]) => {
      for (const id of ids) {
        const t = ws.tab(id);
        if (!t) continue;
        if (t.dirty) {
          ws.activate(id);
          const answer = await askSave(t.name);
          if (answer === 'cancel') return;
          if (answer === 'save' && !(await ws.save(id))) return;
        }
        ws.close(id);
      }
    },
    [ws, askSave],
  );

  const openNote = useCallback(
    (name: string) => {
      const key = noteKey(name);
      const open = ws.tabs.find((t) => noteKey(t.origin ?? t.name) === key);
      if (open) return ws.activate(open.id);
      const f = ws.folder?.files.find((x) => noteKey(x.rel) === key);
      if (f) return void ws.openFolderFile(f.rel);
      const base = name.split(/[\\/]/).pop() ?? name;
      ws.add({ name: /\.[a-z0-9]+$/i.test(base) ? base : `${base}.md`, text: `# ${base}\n\n`, dirty: true, eol: 'lf' });
    },
    [ws],
  );

  const openLink = useCallback(
    (link: LinkTarget) => {
      if (link.kind === 'note') openNote(link.target);
      else if (isSafeUrl(link.url)) window.open(link.url, '_blank', 'noopener,noreferrer');
      else notify(S.notices.unsafeLink, 'warning');
    },
    [openNote, notify],
  );
  ws.onOpenLink = openLink;
  ws.onZoom = (d) => setPrefs({ zoom: Math.min(500, Math.max(10, prefsRef.current.zoom + d)) });

  const openFolderFile = useCallback(
    (rel: string, line?: number) => {
      ws.openFolderFile(rel);
      if (line && ws.view) goToLine(ws.view, line);
    },
    [ws],
  );

  const goTo = useCallback(
    (id: string, line: number) => {
      ws.activate(id);
      if (ws.view) goToLine(ws.view, line);
    },
    [ws],
  );

  const toggleZen = useCallback(() => {
    setZen((z) => {
      const next = !z;
      if (next) document.documentElement.requestFullscreen?.().catch(() => undefined);
      else if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      return next;
    });
  }, []);

  const cmds: Command[] = buildCommands({
    ws,
    prefs,
    setPrefs,
    applyLayout: (i) => setPrefs(layoutPrefs(prefsRef.current, i)),
    canTopmost,
    hasUpdater: services.updater !== null,
    isWeb: services.platform === 'web',
    palette: setPalette,
    dialog: setDialog,
    closeTabs: (ids) => void closeTabs(ids),
    saveAll: () => {
      void (async () => {
        for (const t of ws.tabs) if (t.dirty && !(await ws.save(t.id))) return;
      })();
    },
    openFolder: () => {
      pickFolder().then(
        (r) => {
          if (!r) return;
          if (r.folder.files.length === 0) return notify(S.notices.folderEmpty, 'warning');
          ws.setFolder(r.folder);
          setPrefs({ side: 'files' });
          notify(S.notices.folderLoaded(r.folder.files.length, r.skipped));
        },
        (err: unknown) => notify(errorText(err), 'error'),
      );
    },
    print: () => tab && printText(tab.name, ws.text(tab.id), fontStack(prefs.font), () => services.print()),
    zen: toggleZen,
    openLinkAtCursor: () => {
      const view = ws.view;
      const link = view ? linkAtPos(view.state, view.state.selection.main.head) : null;
      if (link) openLink(link);
      else notify(S.notices.noLink);
    },
    convertDocx: () => {
      if (!tab) return;
      convertToDocx(services, tab.name, ws.text(tab.id), ws.languageName(tab)).then(
        (name) => notify(S.notices.converted(name), 'success'),
        (err: unknown) => notify(S.notices.convertFailed(errorText(err)), 'error'),
      );
    },
    copyPath: () => {
      if (!tab?.path) return notify(S.notices.noPath);
      navigator.clipboard.writeText(tab.path).then(() => notify(S.notices.pathCopied), () => notify(S.notices.copyFailed, 'error'));
    },
    openInBrowser: () => {
      if (tab && !openInBrowser(tab.name, ws.text(tab.id), ws.languageName(tab))) notify(S.notices.unsafeLink, 'warning');
    },
    newWindow: () => void services.openModule('notes'),
    checkUpdate: () => {
      services.updater?.check().then((u) => notify(u ? S.notices.updateAvailable(u.version) : S.notices.upToDate), (err: unknown) => notify(errorText(err), 'error'));
    },
    quit: () => services.close(),
    notify: (m) => notify(m, 'warning'),
  });
  const map = commandMap(cmds);
  const cmdsRef = useRef(cmds);
  cmdsRef.current = cmds;
  const overlayOpen = palette !== null || dialog !== null || compare !== null || asking !== null || backstage !== null;
  const overlayRef = useRef(overlayOpen);
  overlayRef.current = overlayOpen;

  // Raccourcis : interceptes avant l'editeur (Ctrl+D = dupliquer comme WinNote, pas « occurrence suivante »).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && zen) {
        toggleZen();
        return;
      }
      if (overlayRef.current) return;
      const target = e.target instanceof Element ? e.target : null;
      const inText = target?.closest('.cm-content') !== null && target?.closest('.cm-content') !== undefined;
      for (const c of cmdsRef.current) {
        if (!c.key || c.nativeKey || c.disabled || c.hidden || (c.editor && !inText)) continue;
        if (!matchShortcut(c.key, e) && !(c.id === 'tabNext' && matchShortcut('Ctrl+PgSuiv', e)) && !(c.id === 'tabPrev' && matchShortcut('Ctrl+PgPréc', e))) continue;
        e.preventDefault();
        e.stopPropagation();
        c.run();
        return;
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [zen, toggleZen]);

  // --- Palette ---

  const paletteProps = useMemo((): { placeholder: string; items?: PaletteItem[]; search?: (q: string) => PaletteItem[] } | null => {
    if (!palette) return null;
    const t = ws.active;
    switch (palette) {
      case 'commands':
        return {
          placeholder: S.palette.commands,
          items: cmds.filter((c) => !c.hidden && !c.disabled).map((c) => ({ id: c.id, label: c.label, hint: c.key, icon: c.icon, checked: c.checked, run: c.run })),
        };
      case 'quick': {
        const seen = new Set<string>();
        const out: PaletteItem[] = ws.tabs.map((x) => {
          seen.add(x.path ?? x.origin ?? x.id);
          return { id: `tab:${x.id}`, label: x.name, hint: x.path ?? x.origin ?? S.palette.openTab, icon: 'document', run: () => ws.activate(x.id) };
        });
        for (const r of recents) if (!seen.has(r.path)) out.push({ id: `rec:${r.path}`, label: r.name, hint: `${S.palette.recent} · ${r.path}`, icon: 'history', run: () => void ws.openPath(r.path, r.name) });
        for (const f of ws.folder?.files ?? []) if (!seen.has(f.rel)) out.push({ id: `dir:${f.rel}`, label: f.rel.split('/').pop() ?? f.rel, hint: `${S.palette.folder} · ${f.rel}`, icon: 'folder', run: () => openFolderFile(f.rel) });
        return { placeholder: S.palette.quick, items: out };
      }
      case 'inFiles':
        return {
          placeholder: S.palette.inFiles,
          search: (q) => {
            const needle = q.toLocaleLowerCase('fr');
            const out: PaletteItem[] = [];
            for (const src of noteSources(ws)) {
              const lines = src.text.split('\n');
              for (let i = 0; i < lines.length && out.length < 300; i++) {
                const line = lines[i] ?? '';
                if (!line.toLocaleLowerCase('fr').includes(needle)) continue;
                const run = src.id.startsWith('f:') ? () => openFolderFile(src.id.slice(2), i + 1) : () => goTo(src.id, i + 1);
                out.push({ id: `${src.id}:${i}`, label: line.trim().slice(0, 120), hint: `${src.name}:${i + 1}`, icon: 'document_search', run });
              }
            }
            return out;
          },
        };
      case 'language':
        return { placeholder: S.palette.language, items: languageNames().map((n) => ({ id: n, label: n, checked: t ? ws.languageName(t) === n : false, run: () => t && ws.patch(t.id, { lang: n }) })) };
      case 'encoding':
        return { placeholder: S.palette.encoding, items: ENCODINGS.map((e) => ({ id: e, label: S.encodings[e], checked: t?.encoding === e, run: () => t && t.encoding !== e && ws.patch(t.id, { encoding: e, dirty: true }) })) };
      case 'eol':
        return { placeholder: S.palette.eol, items: EOLS.map((e) => ({ id: e, label: S.eols[e], checked: t?.eol === e, run: () => t && t.eol !== e && ws.patch(t.id, { eol: e, dirty: true }) })) };
      case 'theme':
        return { placeholder: S.palette.theme, items: cmds.filter((c) => c.id.startsWith('theme:')).map((c) => ({ id: c.id, label: c.label, checked: c.checked, run: c.run })) };
      case 'compare':
        return {
          placeholder: S.palette.tab,
          items: ws.tabs.filter((x) => x.id !== ws.activeId).map((x) => ({ id: x.id, label: x.name, hint: x.path ?? undefined, icon: 'document', run: () => setCompare({ left: ws.activeId, right: x.id }) })),
        };
    }
  }, [palette, ws, cmds, recents, openFolderFile, goTo]);

  // --- Menus contextuels ---

  const tabMenu = (e: MouseEvent, id: string): void => {
    const t = ws.tab(id);
    if (!t) return;
    const index = ws.tabs.findIndex((x) => x.id === id);
    const right = ws.tabs.slice(index + 1).map((x) => x.id);
    const items: MenuItem[] = [
      { id: 'close', label: S.dialogs.close, icon: 'dismiss', shortcut: id === ws.activeId ? 'Ctrl+W' : undefined, onClick: () => void closeTabs([id]) },
      { id: 'others', label: CMD.closeOthers, onClick: () => void closeTabs(ws.tabs.filter((x) => x.id !== id).map((x) => x.id)), disabled: ws.tabs.length < 2 },
      { id: 'right', label: CMD.closeRight, onClick: () => void closeTabs(right), disabled: right.length === 0 },
      { id: 'all', label: CMD.closeAll, onClick: () => void closeTabs(ws.tabs.map((x) => x.id)) },
      { id: 's1', kind: 'separator' },
      { id: 'save', label: CMD.save, icon: 'save', onClick: () => void ws.save(id) },
      { id: 'saveAs', label: CMD.saveAs, icon: 'save_copy', onClick: () => void ws.save(id, true) },
      { id: 's2', kind: 'separator' },
      { id: 'path', label: CMD.copyPath, icon: 'copy', disabled: !t.path, onClick: () => t.path && void navigator.clipboard.writeText(t.path).then(() => notify(S.notices.pathCopied)) },
      { id: 'compare', label: CMD.compare.replace('…', ''), icon: 'column_double_compare', disabled: id === ws.activeId, onClick: () => setCompare({ left: ws.activeId, right: id }) },
      { id: 'reopen', label: CMD.reopenClosed, icon: 'history', disabled: !ws.canReopen(), onClick: () => ws.reopenClosed() },
    ];
    if (services.platform === 'desktop' && t.path) items.push({ id: 'win', label: CMD.moveToWindow, icon: 'window_new', onClick: () => void services.openModule('notes', t.path ?? undefined) });
    ctx.open(e, items);
  };

  const editorMenu = (e: MouseEvent): void => {
    // Correcteur actif : menu natif (suggestions d'orthographe du moteur web).
    if (prefs.spell || e.shiftKey) return;
    ctx.open(e, ['undo', 'redo', '-1', 'cut', 'copy', 'paste', 'del', 'selectAll', '-2', 'find', 'toggleComment', 'openLink', 'palette'].map((id) => (id.startsWith('-') ? { id, kind: 'separator' as const } : item(map, id))));
  };

  // --- Rendu ---

  const ribbonTabs = buildRibbon({ map, prefs, setPrefs, languageName: tab ? ws.languageName(tab) : S.plainText });
  const recentItems: MenuItem[] = recents.slice(0, 15).map((r, i) => ({ id: `r${i}`, label: `${i + 1}  ${r.name}`, description: r.path, onClick: () => void ws.openPath(r.path, r.name) }));
  const menus = buildMenus(
    map,
    recentItems,
    ENCODINGS.map((e) => ({ id: e, label: S.encodings[e], checked: tab?.encoding === e, onClick: () => tab && ws.patch(tab.id, { encoding: e, dirty: true }) })),
    EOLS.map((e) => ({ id: e, label: S.eols[e], checked: tab?.eol === e, onClick: () => tab && ws.patch(tab.id, { eol: e, dirty: true }) })),
  );
  const style = {
    '--nt-font': fontStack(prefs.font),
    '--nt-size': `${((prefs.fontSize * prefs.zoom) / 100).toFixed(2)}pt`,
    '--nt-margin': `${prefs.margin}px`,
    '--nt-spacing': `${prefs.spacing}px`,
    ...(theme
      ? {
          '--nt-bg': theme.bg, '--nt-fg': theme.fg, '--nt-sel': theme.selection, '--nt-line': theme.activeLine, '--nt-gutter': theme.gutter,
          '--nt-ui-bg': theme.uiBg, '--nt-ui-fg': theme.uiFg, '--nt-accent': theme.accent, '--nt-c-comment': theme.syntax.comment,
          '--nt-c-string': theme.syntax.string, '--nt-c-number': theme.syntax.number, '--nt-c-keyword': theme.syntax.keyword, '--nt-c-type': theme.syntax.type,
          '--nt-c-meta': theme.syntax.meta, '--nt-c-operator': theme.syntax.operator, '--nt-c-attr': theme.syntax.attribute, '--nt-c-func': theme.syntax.func,
        }
      : {}),
  } as CSSProperties;

  return (
    <div
      className={`nt-root${zen ? ' is-zen' : ''}`}
      data-nt-theme={theme ? theme.id : 'office'}
      style={style}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDropCapture={(e) => {
        const files = [...e.dataTransfer.files];
        if (files.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        for (const f of files) f.arrayBuffer().then((b) => ws.openFile({ name: f.name, path: null, bytes: new Uint8Array(b) }), (err: unknown) => notify(errorText(err), 'error'));
      }}
    >
      {!zen && (
        <TitleBar
          app={info}
          documentName={tab?.name}
          location={tab?.path ?? tab?.origin ?? null}
          saveState={tab ? (tab.dirty ? 'modified' : tab.path ? 'saved' : null) : null}
          quickAccess={[
            { id: 'save', label: CMD.save, icon: 'save', shortcut: 'Ctrl+S', onClick: () => map.get('save')?.run() },
            { id: 'undo', label: CMD.undo, icon: 'arrow_undo', shortcut: 'Ctrl+Z', onClick: () => map.get('undo')?.run() },
            { id: 'redo', label: CMD.redo, icon: 'arrow_redo', shortcut: 'Ctrl+Y', onClick: () => map.get('redo')?.run() },
          ]}
          commands={collectCommands(ribbonTabs)}
          windowControls={services.windowControls}
          settings={services.settings}
        />
      )}
      {!zen && (prefs.menus === 'ribbon' ? (
        <Ribbon tabs={ribbonTabs} onFile={() => { refreshRecents(); setBackstage('open'); }} settings={services.settings} />
      ) : (
        <MenuBar menus={menus} />
      ))}
      {!zen && <TabStrip tabs={ws.tabs} activeId={ws.activeId} onSelect={(id) => ws.activate(id)} onClose={(id) => void closeTabs([id])} onMove={(id, i) => ws.move(id, i)} onNew={() => ws.newTab()} onContextMenu={tabMenu} />}
      <div className="nt-body">
        {!zen && prefs.side !== 'none' && (
          <Sidebar
            ws={ws}
            mode={prefs.side}
            width={prefs.sideWidth}
            onWidthChange={(w) => setPrefs({ sideWidth: w })}
            onModeChange={(side) => setPrefs({ side })}
            onOpenFolder={() => map.get('openFolder')?.run()}
            onOpenFolderFile={openFolderFile}
            onGoTo={goTo}
          />
        )}
        <div className={`nt-editors${prefs.split ? ' is-split' : ''}`} onContextMenu={editorMenu}>
          <div className="nt-editor" ref={editorRef} />
          {prefs.split && <div className="nt-editor nt-editor--second" ref={splitRef} />}
        </div>
        {!zen && prefs.preview && (
          <Preview ws={ws} width={prefs.previewWidth} onWidthChange={(w) => setPrefs({ previewWidth: w })} onClose={() => setPrefs({ preview: false })} onOpenNote={openNote} onBlocked={() => notify(S.notices.unsafeLink, 'warning')} />
        )}
      </div>
      {!zen && prefs.statusBar && <StatusLine ws={ws} zoom={prefs.zoom} onZoom={(zoom) => setPrefs({ zoom })} onPick={setPalette} />}
      {zen && <button type="button" className="nt-zen-exit" onClick={toggleZen} aria-label={S.zen.exit} title={S.zen.exit}>×</button>}
      {paletteProps && <Palette key={palette} {...paletteProps} onClose={() => { setPalette(null); ws.view?.focus(); }} />}
      {dialog === 'stats' && <StatsDialog ws={ws} onClose={() => setDialog(null)} />}
      {dialog === 'font' && <FontDialog prefs={prefs} onApply={setPrefs} onClose={() => setDialog(null)} />}
      {dialog === 'about' && <AboutDialog version={services.version} onClose={() => setDialog(null)} />}
      {compare && <CompareDialog ws={ws} leftId={compare.left} rightId={compare.right} onClose={() => setCompare(null)} />}
      {asking && <SaveDialog name={asking.name} onAnswer={asking.answer} />}
      <FileBackstage
        ws={ws}
        open={backstage !== null}
        page={backstage ?? 'open'}
        onPageChange={setBackstage}
        onClose={() => setBackstage(null)}
        recents={recents}
        prefs={prefs}
        setPrefs={setPrefs}
        applyLayout={(i) => setPrefs(layoutPrefs(prefsRef.current, i))}
        onOpenFolder={() => map.get('openFolder')?.run()}
        onPrint={() => map.get('print')?.run()}
        onCloseTab={() => map.get('close')?.run()}
        onQuit={() => map.get('quit')?.run()}
        onConvert={() => map.get('convertDocx')?.run()}
      />
      {ctx.menu}
    </div>
  );
}
