// Ecran Accueil de ForgeOffice (facon Office 2024) : rail des applications, Bonjour + Nouveau + Recents,
// Ouvrir (dialogue, glisser-deposer), Options.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { MODULES, moduleForFile, type AppId, type ModuleProps, type OpenedFile, type RecentFile } from '@forgeoffice/core';
import { AppBadge, Icon, TitleBar, usePersistentState, type CommandEntry, type IconName } from '@forgeoffice/ui';
import { BLANK_APPS, PINNED_SETTING, RAIL_APPS, checkDropped, greeting, openFilters, pinKey, togglePin } from './logic.ts';
import { TEMPLATES, templateFile, type Template } from './templates.ts';
import { HomePage, NewPage, OpenPage, OptionsPage, type HubActions } from './pages.tsx';
import { S } from './strings.ts';
import './Hub.css';

type Page = 'home' | 'new' | 'open' | 'options';

const PAGES: readonly { id: Page; label: string; icon: IconName }[] = [
  { id: 'home', label: S.home, icon: 'home' },
  { id: 'new', label: S.new, icon: 'document_add' },
  { id: 'open', label: S.open, icon: 'folder_open' },
];

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function Hub({ services, file }: ModuleProps) {
  const [page, setPage] = useState<Page>('home');
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [pins, setPins] = usePersistentState<string[]>(services.settings, PINNED_SETTING, []);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const refresh = useCallback(() => {
    services.recentFiles().then(setRecents, (err: unknown) => services.notify(errorText(err), 'error'));
  }, [services]);
  useEffect(refresh, [refresh]);

  const openFile = useCallback(
    async (f: OpenedFile) => {
      const app = moduleForFile(f.name);
      if (!app) {
        services.notify(S.unsupported(f.name), 'error');
        return;
      }
      try {
        await services.addRecent({ app, name: f.name, path: f.path ?? f.name });
        await services.openDocument(f);
      } catch (err) {
        services.notify(`${S.openFailed(f.name)} ${errorText(err)}`, 'error');
      }
      refresh();
    },
    [services, refresh],
  );

  // Fichier passe au demarrage (ligne de commande, association) : on le confie a son application.
  useEffect(() => {
    if (file) void openFile(file);
  }, [file, openFile]);

  const actions: HubActions = useMemo(
    () => ({
      newBlank: (app: AppId) => void services.openModule(app),
      newFromTemplate: (t: Template) => {
        services.openDocument(templateFile(t)).catch((err: unknown) => services.notify(`${S.openFailed(t.label)} ${errorText(err)}`, 'error'));
      },
      browse: () => {
        services.openFile(openFilters()).then(
          (f) => (f ? openFile(f) : undefined),
          (err: unknown) => services.notify(errorText(err), 'error'),
        );
      },
      openRecent: (r: RecentFile) => {
        if (services.platform === 'web') {
          services.notify(S.reopenWeb, 'warning');
          return;
        }
        services.readFile(r.path).then(openFile, (err: unknown) => services.notify(`${S.openFailed(r.name)} ${errorText(err)}`, 'error'));
      },
      togglePin: (r: RecentFile) => setPins(togglePin(pins, pinKey(r))),
      showPage: setPage,
    }),
    [services, openFile, pins, setPins],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === 'o') {
        e.preventDefault();
        actions.browse();
      } else if (key === 'n') {
        e.preventDefault();
        actions.newBlank('word');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);

  const commands: CommandEntry[] = useMemo(
    () => [
      ...BLANK_APPS.map((app) => ({ id: `new-${app}`, label: S.newBlank(MODULES[app].blankLabel), path: `${S.commandPath} > ${S.new}`, icon: 'document_add' as const, run: () => actions.newBlank(app) })),
      ...TEMPLATES.map((t) => ({ id: `tpl-${t.id}`, label: t.label, path: `${S.commandPath} > ${S.templates}`, icon: 'document_text' as const, run: () => actions.newFromTemplate(t) })),
      { id: 'browse', label: S.browse, path: `${S.commandPath} > ${S.open}`, icon: 'folder_open', shortcut: 'Ctrl+O', run: actions.browse },
      ...RAIL_APPS.map((app) => ({ id: `app-${app}`, label: S.openWith(MODULES[app].name), path: S.apps, icon: 'apps' as const, run: () => void services.openModule(app) })),
      { id: 'options', label: S.options, path: S.commandPath, icon: 'settings', run: () => setPage('options') },
    ],
    [actions, services],
  );

  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const first = files[0];
    if (!first) return;
    if (files.length > 1) services.notify(S.onlyFirst, 'info');
    const check = checkDropped(first.name, first.size);
    if ('error' in check) {
      services.notify(check.error, 'error');
      return;
    }
    first.arrayBuffer().then(
      (buf) => openFile({ name: first.name, path: null, bytes: new Uint8Array(buf) }),
      (err: unknown) => services.notify(`${S.openFailed(first.name)} ${errorText(err)}`, 'error'),
    );
  };
  const hasFiles = (e: DragEvent): boolean => Array.from(e.dataTransfer.types).includes('Files');

  const clearRecent = (): void => {
    services.clearRecent().then(() => {
      setPins([]);
      refresh();
      services.notify(S.recentCleared, 'success');
    }, (err: unknown) => services.notify(errorText(err), 'error'));
  };

  const railButton = (id: Page, label: string, icon: IconName) => (
    <button key={id} type="button" className={`hub-rail__item${page === id ? ' is-active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}>
      <Icon name={icon} size={24} filled={page === id} />
      <span>{label}</span>
    </button>
  );

  return (
    <div
      className="hub"
      onDragEnter={(e) => { if (hasFiles(e)) { dragDepth.current += 1; setDragging(true); } }}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
      onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragging(false); }}
      onDrop={onDrop}
    >
      <TitleBar app={MODULES.hub} commands={commands} searchPlaceholder={S.search} windowControls={services.windowControls} settings={services.settings} />
      <div className="hub-body">
        <nav className="hub-rail" aria-label={S.rail}>
          {PAGES.map((p) => railButton(p.id, p.label, p.icon))}
          <div className="hub-rail__sep" role="separator" />
          <div className="hub-rail__apps" aria-label={S.apps}>
            {RAIL_APPS.map((app) => {
              const info = MODULES[app];
              return (
                <button key={app} type="button" className="hub-rail__item hub-rail__app" title={S.openWith(info.name)} onClick={() => void services.openModule(app)}>
                  <AppBadge glyph={info.glyph} color={info.accent} size={24} />
                  <span>{info.name}</span>
                </button>
              );
            })}
          </div>
          <div className="hub-rail__bottom">{railButton('options', S.options, 'settings')}</div>
        </nav>
        <main className="hub-main fo-scroll">
          <div className="hub-content">
            {page === 'home' && <HomePage services={services} actions={actions} recents={recents} pins={pins} greetingText={greeting(new Date().getHours())} />}
            {page === 'new' && <NewPage actions={actions} />}
            {page === 'open' && <OpenPage services={services} actions={actions} recents={recents} pins={pins} />}
            {page === 'options' && <OptionsPage services={services} onClearRecent={clearRecent} />}
          </div>
        </main>
      </div>
      {dragging && (
        <div className="hub-drop" aria-live="polite">
          <div className="hub-drop__card">
            <Icon name="arrow_upload" size={48} />
            <strong>{S.dropTitle}</strong>
            <span>{S.dropHint}</span>
          </div>
        </div>
      )}
    </div>
  );
}
