// Bloc-notes de ForgeOffice : reecriture complete de WinNote (onglets, session, notes liees, apercu Markdown, 17 themes).
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from 'react';
import { MODULES, moduleForFile, registerProbe, type ModuleProps, type NoticeKind, type RecentFile, type WindowControls } from '@forgeoffice/core';
import { Ribbon, TitleBar, caretColor, collectCommands, useContextMenu, type MenuItem } from '@forgeoffice/ui';
import { buildCommands, commandMap, parseTimes, type Command, type DialogKind, type PaletteMode } from './commands.ts';
import { ENCODINGS, EOLS } from './logic/encoding.ts';
import { columnText } from './logic/columns.ts';
import { KEYMAP_KEY, KEYMAP_HELP, applyKeymap, parseKeymap } from './logic/keymap.ts';
import { isSafeUrl, noteKey, type LinkTarget } from './logic/links.ts';
import { headingLine, outline } from './logic/outline.ts';
import { FAVS_KEY, parseFavs, toggleFav } from './logic/favorites.ts';
import { PRINT_KEY, parseLayout, type PrintLayout } from './logic/print.ts';
import { parseKv, props } from './logic/props.ts';
import { PREFS_KEY, applyLayout as layoutPrefs, parsePrefs, type NotesPrefs } from './logic/prefs.ts';
import { matchShortcut } from './logic/shortcuts.ts';
import { tabsToClose, type CloseMode } from './logic/tabs.ts';
import { fontStack, themeById } from './logic/themes.ts';
import { goToLine, insertColumn } from './editor/actions.ts';
import { languageNames } from './editor/languages.ts';
import { linkAtPos } from './editor/marks.ts';
import { convertToDocx, openInBrowser, pickFolder, printText } from './dom-actions.ts';
import { buildMenus, buildRibbon, item } from './ribbon.ts';
import { AboutDialog, CompareDialog, FontDialog, KeymapDialog, LossyDialog, PrintLayoutDialog, SaveDialog, StatsDialog, type LossyAnswer, type SaveAnswer } from './ui/Dialogs.tsx';
import { FileBackstage } from './ui/FileBackstage.tsx';
import { MenuBar } from './ui/MenuBar.tsx';
import { tagHits } from './logic/tags.ts';
import { Palette, type PaletteItem } from './ui/Palette.tsx';
import { Preview } from './ui/Preview.tsx';
import { Sidebar, noteSources } from './ui/Sidebar.tsx';
import type { PromptKind } from './folderops.ts';
import { baseName, parentOf } from './logic/fileops.ts';
import { StatusLine } from './ui/StatusLine.tsx';
import { TabStrip } from './ui/TabStrip.tsx';
import { MobileBar } from './ui/MobileBar.tsx';
import { Workspace, errorText } from './workspace.ts';
import { notesProbe } from './probe.ts';
import { CMD, S } from './strings.ts';
import './notes.css';

const info = MODULES.notes;
type TopmostControls = WindowControls & { setAlwaysOnTop?: (on: boolean) => unknown };

export function NotesApp({ services, file }: ModuleProps) {
  const [prefs, setPrefsState] = useState<NotesPrefs>(() => parsePrefs(services.settings.get<unknown>(PREFS_KEY, null)));
  const prefsRef = useRef(prefs);
  const [ws] = useState(() => new Workspace(services, prefsRef.current));
  useSyncExternalStore(ws.subscribe, ws.getVersion);
  // Crochet du banc de conformite (developpement seulement).
  useEffect(() => (import.meta.env.DEV ? registerProbe(notesProbe(ws, () => prefsRef.current)) : undefined), [ws]);
  const [palette, setPalette] = useState<PaletteMode | null>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [compare, setCompare] = useState<{ left: string; right: string } | null>(null);
  const [asking, setAsking] = useState<{ name: string; answer: (a: SaveAnswer) => void } | null>(null);
  const [keymapText, setKeymapText] = useState<string>(() => {
    const v = services.settings.get<unknown>(KEYMAP_KEY, '');
    return typeof v === 'string' ? v : '';
  });
  const [favs, setFavs] = useState<string[]>(() => parseFavs(services.settings.get<unknown>(FAVS_KEY, null)));
  const [layout, setLayout] = useState<PrintLayout>(() => parseLayout(services.settings.get<unknown>(PRINT_KEY, null)));
  const propInit = useRef('');
  const promptTarget = useRef<{ rel: string; dir: boolean } | null>(null);
  const [lossy, setLossy] = useState<{ name: string; encoding: string; answer: (a: LossyAnswer) => void } | null>(null);
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

  // Modification externe (bureau) : au retour dans la fenetre, relit le fichier de l'onglet actif et compare son empreinte.
  useEffect(() => {
    if (services.platform === 'web') return;
    let last = 0;
    const check = (): void => {
      const now = Date.now();
      if (document.visibilityState !== 'visible' || now - last < 1000) return;
      last = now;
      void ws.checkExternal(ws.activeId);
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    const timer = prefs.autoReload ? window.setInterval(() => document.visibilityState === 'visible' && void ws.pollExternal(), 1500) : undefined;
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [ws, services.platform, prefs.autoReload]);
  // Un onglet qu'on rouvre est controle tout de suite (il n'etait pas surveille en arriere-plan).
  useEffect(() => {
    if (services.platform !== 'web' && ws.activeId) void ws.checkExternal(ws.activeId);
  }, [ws, services.platform, ws.activeId]);

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
    async (ids: readonly string[]): Promise<boolean> => {
      for (const id of ids) {
        const t = ws.tab(id);
        if (!t) continue;
        if (t.dirty) {
          ws.activate(id);
          const answer = await askSave(t.name);
          if (answer === 'cancel') return false;
          if (answer === 'save' && !(await ws.save(id))) return false;
        }
        ws.close(id);
      }
      return true;
    },
    [ws, askSave],
  );

  const openNote = useCallback(
    (name: string, heading?: string) => {
      const key = noteKey(name);
      // Saut vers le titre d'un lien [[note#titre]] une fois la note affichée ; titre introuvable : la note s'ouvre en haut, avec un avis.
      const reveal = (): void => {
        if (!heading) return;
        const line = headingLine(ws.text(ws.activeId), heading);
        if (line === null) notify(S.notices.headingMissing(heading), 'warning');
        else if (ws.view) goToLine(ws.view, line + 1);
      };
      const open = ws.tabs.find((t) => noteKey(t.origin ?? t.name) === key);
      if (open) {
        ws.activate(open.id);
        return reveal();
      }
      const f = ws.folder?.files.find((x) => noteKey(x.rel) === key);
      if (f) return void Promise.resolve(ws.openFolderFile(f.rel)).then(reveal);
      const base = name.split(/[\\/]/).pop() ?? name;
      ws.add({ name: /\.[a-z0-9]+$/i.test(base) ? base : `${base}.md`, text: `# ${base}\n\n`, dirty: true, eol: 'lf' });
    },
    [ws, notify],
  );

  const openLink = useCallback(
    (link: LinkTarget) => {
      if (link.kind === 'note') openNote(link.target, link.heading ?? undefined);
      else if (isSafeUrl(link.url)) window.open(link.url, '_blank', 'noopener,noreferrer');
      else notify(S.notices.unsafeLink, 'warning');
    },
    [openNote, notify],
  );
  ws.onOpenLink = openLink;
  ws.confirmLossy = (name, encoding) => new Promise<LossyAnswer>((resolve) => setLossy({ name, encoding: S.encodings[encoding], answer: (a) => { setLossy(null); resolve(a); } }));
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

  const baseCmds: Command[] = buildCommands({
    ws,
    prefs,
    setPrefs,
    applyLayout: (i) => setPrefs(layoutPrefs(prefsRef.current, i)),
    canTopmost,
    canReveal: typeof services.revealInFolder === 'function',
    reveal: (path) => void services.revealInFolder?.(path).catch((err: unknown) => notify(errorText(err), 'error')),
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
    isFavorite: !!tab?.path && favs.includes(tab.path),
    toggleFavorite: () => {
      if (!tab?.path) return notify(S.notices.favNeedsFile, 'warning');
      const r = toggleFav(favs, tab.path);
      setFavs(r.list);
      services.settings.set(FAVS_KEY, r.list);
      notify(r.added ? S.notices.favAdded : S.notices.favRemoved, 'success');
    },
    recover: () => {
      const names = ws.recover();
      notify(names.length ? S.notices.recoveredDone(names.length) : S.notices.recoveredNone, names.length ? 'success' : 'info');
    },
    openFolder: () => {
      pickFolder(services).then(
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
    print: () => tab && printText(tab.name, ws.text(tab.id), fontStack(prefs.font), layout, () => services.print()),
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
    clearRecent: () => {
      services.clearRecent().then(
        () => {
          setRecents([]);
          notify(S.notices.recentCleared, 'success');
        },
        (err: unknown) => notify(errorText(err), 'error'),
      );
    },
    promptEntry: (kind: PromptKind) => {
      promptTarget.current = ws.folderOps.target();
      setPalette(kind);
    },
    copyText: (text, message) => {
      navigator.clipboard.writeText(text).then(() => notify(message), () => notify(S.notices.copyFailed, 'error'));
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
    quit: () => void closeTabs(ws.tabs.filter((t) => t.dirty).map((t) => t.id)).then((ok) => ok && services.close()),
    notify: (m) => notify(m, 'warning'),
  });
  const cmds: Command[] = applyKeymap(baseCmds, parseKeymap(keymapText, baseCmds).overrides);
  const map = commandMap(cmds);
  const cmdsRef = useRef(cmds);
  cmdsRef.current = cmds;
  const overlayOpen = palette !== null || dialog !== null || compare !== null || asking !== null || lossy !== null || backstage !== null;
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

  const paletteProps = useMemo((): { placeholder: string; items?: PaletteItem[]; search?: (q: string) => PaletteItem[]; minQuery?: number; initial?: string } | null => {
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
      case 'tags': {
        const hits = tagHits(noteSources(ws));
        return {
          placeholder: S.palette.tags,
          items: hits.map((h, i) => ({
            id: `tag:${i}`, label: `#${h.tag}  ${h.excerpt}`, hint: `${h.sourceName}:${h.line + 1}`, icon: 'tag' as const,
            run: h.sourceId.startsWith('f:') ? () => openFolderFile(h.sourceId.slice(2), h.line + 1) : () => goTo(h.sourceId, h.line + 1),
          })),
        };
      }
      case 'symbols': {
        if (!t) return { placeholder: S.palette.symbols, items: [] };
        const markdown = ws.languageName(t) === 'Markdown';
        return {
          placeholder: S.palette.symbols,
          items: outline(ws.text(t.id), markdown).map((o, i) => ({ id: `sym:${i}`, label: `${'  '.repeat(Math.min(o.level - 1, 4))}${o.title}`, hint: `${o.line + 1}`, icon: 'document_bullet_list' as const, run: () => goTo(t.id, o.line + 1) })),
        };
      }
      case 'favs':
        return {
          placeholder: S.palette.favs,
          items: favs.map((p) => ({
            id: `fav:${p}`, label: baseName(p), hint: p, icon: 'star' as const,
            run: () => void services.readFile(p).then((f) => ws.openFile(f), () => notify(S.notices.favMissing(p), 'warning')),
          })),
        };
      case 'props': {
        const edit = (init: string) => () => { propInit.current = init; setPalette('propEdit'); };
        const rows = t ? props(ws.text(t.id)) : [];
        return {
          placeholder: S.palette.props,
          items: [
            { id: 'add', label: '+ Ajouter une propriété', hint: 'clé: valeur', icon: 'add' as const, run: edit('') },
            ...rows.map((p) => ({ id: `prop:${p.key}`, label: `${p.key} : ${p.value}`, hint: 'modifier', icon: 'document_bullet_list' as const, run: edit(`${p.key}: ${p.value}`) })),
          ],
        };
      }
      case 'propEdit':
        return {
          placeholder: S.palette.propEdit,
          minQuery: 1,
          initial: propInit.current,
          search: (q) => {
            const kv = parseKv(q);
            if (!kv) return [];
            const done = (): void => {
              if (!ws.setProperty(q)) notify(ws.active?.readOnly ? S.notices.propReadOnly : S.notices.propBadFormat, 'warning');
            };
            const exists = t ? props(ws.text(t.id)).some((p) => p.key === kv[0]) : false;
            const out: PaletteItem[] = [{ id: 'set', label: kv[1] === '' ? `Retirer ${kv[0]}` : `Définir ${kv[0]} : ${kv[1]}`, icon: 'checkmark', run: done }];
            if (exists && kv[1] !== '') out.push({ id: 'del', label: `Retirer ${kv[0]}`, icon: 'delete', run: () => { ws.setProperty(`${kv[0]}:`); } });
            return out;
          },
        };
      case 'language':
        return { placeholder: S.palette.language, items: languageNames().map((n) => ({ id: n, label: n, checked: t ? ws.languageName(t) === n : false, run: () => t && ws.patch(t.id, { lang: n }) })) };
      case 'encoding':
        return { placeholder: S.palette.encoding, items: ENCODINGS.map((e) => ({ id: e, label: S.encodings[e], checked: t?.encoding === e, run: () => t && t.encoding !== e && ws.patch(t.id, { encoding: e, dirty: true }) })) };
      case 'newFile':
      case 'newDir': {
        const dir = promptTarget.current ? (promptTarget.current.dir ? promptTarget.current.rel : parentOf(promptTarget.current.rel)) : '';
        const create = palette === 'newFile' ? (n: string) => ws.folderOps.createFile(dir, n) : (n: string) => ws.folderOps.createDir(dir, n);
        return {
          placeholder: S.palette[palette],
          minQuery: 1,
          search: (q) => [{ id: 'create', label: q.trim(), hint: dir ? `${S.palette.inDir} ${dir}` : S.palette.rootDir, icon: palette === 'newFile' ? 'document_add' : 'folder_add', run: () => void create(q) }],
        };
      }
      case 'rename': {
        const target = promptTarget.current;
        if (!target) return { placeholder: S.palette.rename, items: [] };
        return {
          placeholder: S.palette.rename,
          minQuery: 1,
          initial: baseName(target.rel),
          search: (q) => [{ id: 'rename', label: q.trim(), hint: baseName(target.rel), icon: 'rename', run: () => void ws.folderOps.rename(target.rel, q) }],
        };
      }
      case 'move': {
        const target = promptTarget.current;
        if (!target) return { placeholder: S.palette.move, items: [] };
        return {
          placeholder: S.palette.move,
          items: ws.folderOps.directories(target.dir ? target.rel : undefined).map((d) => ({ id: `dir:${d}`, label: d || S.palette.rootDir, icon: 'folder' as const, checked: d === parentOf(target.rel), run: () => void ws.folderOps.move(target.rel, d) })),
        };
      }
      case 'macroTimes':
        return {
          placeholder: S.palette.macroTimes,
          minQuery: 1,
          initial: '10',
          search: (q) => {
            const times = parseTimes(q);
            if (times === null) return [];
            const label = times === 'end' ? "jusqu'à la fin" : `${times} fois`;
            return [{ id: 'run', label: `${CMD.macroPlay} (${label})`, icon: 'play', run: () => { if (ws.playMacro(times)) notify(S.notices.macroRan(label)); else notify(S.notices.macroNone, 'warning'); } }];
          },
        };
      case 'columnInsert':
        return {
          placeholder: S.palette.columnInsert,
          minQuery: 1,
          initial: '{n}. ',
          search: (q) => [{ id: 'col', label: `${CMD.columnInsert.replace('…', '')} : ${q}`, hint: `${columnText(q, 0)} · ${columnText(q, 1)}`, icon: 'table_insert_column', run: () => { if (ws.view) insertColumn(ws.view, q); ws.view?.focus(); } }],
        };
      case 'reloadEncoding':
        return { placeholder: S.palette.reloadEncoding, items: ENCODINGS.map((e) => ({ id: e, label: S.encodings[e], checked: t?.encoding === e, run: () => t && void ws.reloadAs(t.id, e) })) };
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
  }, [palette, ws, cmds, recents, openFolderFile, goTo, favs, services, notify]);

  // --- Menus contextuels ---

  const tabMenu = (e: MouseEvent, id: string): void => {
    const t = ws.tab(id);
    if (!t) return;
    const index = ws.tabs.findIndex((x) => x.id === id);
    const closing = (mode: CloseMode): string[] => tabsToClose(ws.tabs, id, mode);
    const items: MenuItem[] = [
      { id: 'close', label: S.dialogs.close, icon: 'dismiss', shortcut: id === ws.activeId ? 'Ctrl+W' : undefined, onClick: () => void closeTabs([id]), disabled: t.pinned },
      { id: 'others', label: CMD.closeOthers, onClick: () => void closeTabs(closing('others')), disabled: closing('others').length === 0 },
      { id: 'left', label: CMD.closeLeft, onClick: () => void closeTabs(closing('left')), disabled: closing('left').length === 0 },
      { id: 'right', label: CMD.closeRight, onClick: () => void closeTabs(closing('right')), disabled: closing('right').length === 0 },
      { id: 'unchanged', label: CMD.closeUnchanged, onClick: () => void closeTabs(closing('unchanged')), disabled: closing('unchanged').length === 0 },
      { id: 'all', label: CMD.closeAll, onClick: () => void closeTabs(closing('all')), disabled: closing('all').length === 0 },
      { id: 's0', kind: 'separator' },
      { id: 'pin', label: t.pinned ? CMD.unpin : CMD.pin, icon: 'pin', onClick: () => ws.setPinned(id, !t.pinned) },
      { id: 's1', kind: 'separator' },
      { id: 'save', label: CMD.save, icon: 'save', onClick: () => void ws.save(id) },
      { id: 'saveAs', label: CMD.saveAs, icon: 'save_copy', onClick: () => void ws.save(id, true) },
      { id: 's2', kind: 'separator' },
      { id: 'reveal', label: CMD.reveal, icon: 'folder_open', disabled: !services.revealInFolder || !t.path, description: services.revealInFolder ? undefined : S.revealSoon, onClick: () => t.path && void services.revealInFolder?.(t.path).catch((err: unknown) => notify(errorText(err), 'error')) },
      { id: 'path', label: CMD.copyPath, icon: 'copy', disabled: !t.path, onClick: () => t.path && void navigator.clipboard.writeText(t.path).then(() => notify(S.notices.pathCopied)) },
      { id: 'compare', label: CMD.compare.replace('…', ''), icon: 'column_double_compare', disabled: id === ws.activeId, onClick: () => setCompare({ left: ws.activeId, right: id }) },
      { id: 'reopen', label: CMD.reopenClosed, icon: 'history', disabled: !ws.canReopen(), onClick: () => ws.reopenClosed() },
    ];
    if (services.platform === 'desktop' && t.path) items.push({ id: 'win', label: CMD.moveToWindow, icon: 'window_new', onClick: () => void services.openModule('notes', t.path ?? undefined) });
    ctx.open(e, items);
  };

  /** Menu d'une ligne de l'explorateur : la ligne devient la cible des commandes. */
  const folderMenu = (e: MouseEvent, rel: string | null): void => {
    ws.folderOps.select(rel);
    const run = (id: string) => () => map.get(id)?.run();
    const off = !ws.folderOps.enabled;
    const hint = ws.folder ? S.folderFsHint : S.side.filesEmpty;
    const row = (id: string, label: string, icon: MenuItem['icon'], needsRow = true): MenuItem => ({ id, label, icon, disabled: off || (needsRow && rel === null), description: off ? hint : undefined, onClick: run(id) });
    ctx.open(e, [
      row('newFile', CMD.newFile, 'document_add', false), row('newDir', CMD.newDir, 'folder_add', false), { id: 's0', kind: 'separator' },
      row('renameEntry', CMD.renameEntry, 'rename'), row('duplicateEntry', CMD.duplicateEntry, 'copy'), row('moveEntry', CMD.moveEntry, 'folder_open'), row('deleteEntry', CMD.deleteEntry, 'delete'),
      { id: 's1', kind: 'separator' }, row('refreshFolder', CMD.refreshFolder, 'arrow_sync', false),
    ]);
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
    ENCODINGS.map((e) => ({ id: e, label: S.encodings[e], checked: false, onClick: () => tab && void ws.reloadAs(tab.id, e) })),
  );
  const style = {
    '--nt-font': fontStack(prefs.font),
    '--nt-size': `${((prefs.fontSize * prefs.zoom) / 100).toFixed(2)}pt`,
    '--nt-margin': `${prefs.margin}px`,
    '--nt-spacing': `${prefs.spacing}px`,
    '--nt-liga': prefs.ligatures ? 'normal' : 'none',
    '--nt-caret-w': `${prefs.caret.width}px`,
    '--nt-caret-color': caretColor(prefs.caret, theme?.bg ?? '#FFFFFF', theme?.accent ?? '#185ABD'),
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
      className={`nt-root${zen ? ' is-zen' : ''}${prefs.caret.blink ? '' : ' no-blink'}`}
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
        <Ribbon tabs={ribbonTabs} onFile={(p) => { refreshRecents(); setBackstage(p ?? 'open'); }} settings={services.settings} />
      ) : (
        <MenuBar menus={menus} />
      ))}
      {!zen && <TabStrip tabs={ws.tabs} activeId={ws.activeId} onSelect={(id) => ws.activate(id)} onClose={(id) => void closeTabs([id])} onMove={(id, i) => ws.move(id, i)} onNew={() => ws.newTab()} onPalette={() => setPalette('commands')} onContextMenu={tabMenu} />}
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
            commands={map}
            onRowMenu={folderMenu}
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
      <MobileBar ws={ws} />
      {!zen && prefs.statusBar && <StatusLine ws={ws} zoom={prefs.zoom} onZoom={(zoom) => setPrefs({ zoom })} onPick={setPalette} />}
      {zen && <button type="button" className="nt-zen-exit" onClick={toggleZen} aria-label={S.zen.exit} title={S.zen.exit}>×</button>}
      {paletteProps && <Palette key={palette} {...paletteProps} onClose={() => { setPalette(null); ws.view?.focus(); }} />}
      {dialog === 'stats' && <StatsDialog ws={ws} onClose={() => setDialog(null)} />}
      {dialog === 'font' && <FontDialog prefs={prefs} onApply={setPrefs} onClose={() => setDialog(null)} />}
      {dialog === 'keymap' && (
        <KeymapDialog
          text={keymapText || KEYMAP_HELP}
          commands={baseCmds.filter((c) => !c.hidden)}
          onApply={(text) => {
            setKeymapText(text);
            services.settings.set(KEYMAP_KEY, text);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'printLayout' && <PrintLayoutDialog layout={layout} onApply={(l) => { setLayout(l); services.settings.set(PRINT_KEY, l); }} onClose={() => setDialog(null)} />}
      {dialog === 'about' && <AboutDialog version={services.version} onClose={() => setDialog(null)} />}
      {compare && <CompareDialog ws={ws} leftId={compare.left} rightId={compare.right} onClose={() => setCompare(null)} />}
      {lossy && <LossyDialog name={lossy.name} encoding={lossy.encoding} onAnswer={lossy.answer} />}
      {asking && <SaveDialog name={asking.name} onAnswer={asking.answer} />}
      <FileBackstage
        ws={ws}
        settings={services.settings}
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
        onClearRecent={() => map.get('clearRecent')?.run()}
        onConvert={() => map.get('convertDocx')?.run()}
      />
      {ctx.menu}
    </div>
  );
}
