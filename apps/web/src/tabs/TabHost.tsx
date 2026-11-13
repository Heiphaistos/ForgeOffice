// Onglets de documents dans une seule fenetre, comme un navigateur. Deux methodes au choix (reglage `ui.openMode`) :
// « tab » = un cadre isole par onglet ; « tab-shared » = le module est monte dans la meme page.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MODULES, type AppId, type AppModule, type OpenedFile, type Services } from '@forgeoffice/core';
import { DocumentTabs, WindowButtons, applyAppAccent, savedOpenMode, useAsk, type DocumentTab } from '@forgeoffice/ui';
import { loadModule } from '../registry.ts';
import { ErrorBoundary } from '../ErrorBoundary.tsx';
import { Splash } from '../Splash.tsx';
import { S } from '../strings.ts';
import { forTab, withTabRouting, type OpenTab } from './tabServices.ts';
import type { TabHostApi } from './host.ts';
import './tabs.css';

interface Tab {
  id: string;
  app: AppId;
  mode: 'frame' | 'shared';
  title: string;
  modified: boolean;
  file: OpenedFile | null;
}

const MAIN = 'main';
const cleanTitle = (t: string): string => t.replace(/^\*/, '').replace(/ - ForgeOffice$/, '');

function SharedModule({ app, file, services }: { app: AppId; file: OpenedFile | null; services: Services }) {
  const [mod, setMod] = useState<AppModule | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadModule(app).then((m) => alive && setMod(m), () => alive && setMod(null));
    return () => {
      alive = false;
    };
  }, [app]);
  if (mod === undefined) return <Splash info={MODULES[app]} />;
  if (mod === null) return <p className="fo-shell-text">{S.error.loadFailed(MODULES[app].name)}</p>;
  const App = mod.App;
  return <App services={services} file={file} />;
}

function frameUrl(app: AppId, id: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('app', app);
  url.searchParams.set('embedded', id);
  return url.href;
}

export interface TabHostProps {
  platform: Services;
  /** Page principale (premier onglet) : recoit les services qui ouvrent un nouvel onglet. */
  children: (services: Services) => ReactNode;
  mainTitle: string;
  mainModified: boolean;
}

export function TabHost({ platform, children, mainTitle, mainModified }: TabHostProps) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<string>(MAIN);
  const counter = useRef(0);
  const files = useRef(new Map<string, OpenedFile | null>());
  const ask = useAsk();
  // Accent et disposition propres a un module (data-app) : celui de l'onglet affiche, avant son rendu ; l'onglet principal retrouve le sien.
  const baseApp = useRef(document.documentElement.dataset.app);
  const showApp = useCallback((app: AppId | null): void => {
    const target = app ?? baseApp.current;
    if (target && target !== document.documentElement.dataset.app) applyAppAccent(target as AppId);
  }, []);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const openTab = useCallback<OpenTab>(
    (app, file) => {
      const id = `t${++counter.current}`;
      const mode = savedOpenMode(platform.settings) === 'tab' ? 'frame' : 'shared';
      files.current.set(id, file);
      setTabs((list) => [...list, { id, app, mode, title: file?.name ?? MODULES[app].name, modified: false, file }]);
      if (mode === 'shared') showApp(app);
      setActive(id);
    },
    [platform, showApp],
  );

  const close = useCallback((id: string): void => {
    files.current.delete(id);
    setTabs((list) => list.filter((t) => t.id !== id));
    setActive((a) => {
      if (a === id) showApp(null);
      return a === id ? MAIN : a;
    });
  }, [showApp]);

  const requestClose = useCallback(
    async (id: string): Promise<void> => {
      if (id === MAIN) {
        platform.close();
        return;
      }
      const tab = tabsRef.current.find((t) => t.id === id);
      if (tab?.modified && !(await ask.confirm(S.tabs.closeModified(cleanTitle(tab.title)), S.tabs.closeAnyway))) return;
      close(id);
    },
    [ask, close, platform],
  );

  const patch = useCallback((id: string, change: Partial<Tab>): void => {
    setTabs((list) => list.map((t) => (t.id === id ? { ...t, ...change } : t)));
  }, []);

  const servicesFor = useCallback(
    (id: string): Services =>
      forTab(platform, { onTitle: (title) => patch(id, { title }), onModified: (modified) => patch(id, { modified }), onClose: () => void requestClose(id) }, openTab),
    [platform, patch, requestClose, openTab],
  );

  // Page hote : les cadres y retrouvent leurs services et leur fichier.
  useEffect(() => {
    const api: TabHostApi = {
      tabServices: servicesFor,
      takeFile(id) {
        const file = files.current.get(id) ?? null;
        files.current.set(id, null);
        return file;
      },
      hostBytes: (b) => new Uint8Array(b),
    };
    window.__FO_HOST__ = api;
    return () => {
      delete window.__FO_HOST__;
    };
  }, [servicesFor]);

  const mainServices = useMemo(() => withTabRouting(platform, openTab), [platform, openTab]);

  // Titre et indicateur de la fenetre : ceux de l'onglet actif, « modifie » si un onglet l'est.
  const activeTab = tabs.find((t) => t.id === active);
  useEffect(() => {
    if (tabs.length === 0) return;
    platform.setTitle(activeTab ? activeTab.title : mainTitle);
  }, [platform, tabs.length, activeTab, mainTitle]);
  const anyModified = mainModified || tabs.some((t) => t.modified);
  useEffect(() => {
    if (tabs.length > 0) platform.setModified(anyModified);
  }, [platform, tabs.length, anyModified]);

  const strip: DocumentTab[] = [
    { id: MAIN, label: cleanTitle(mainTitle) || MODULES.hub.name, modified: mainModified },
    ...tabs.map((t) => ({ id: t.id, label: cleanTitle(t.title), modified: t.modified })),
  ];

  return (
    <>
      {tabs.length > 0 && <DocumentTabs tabs={strip} activeId={active} onSelect={(id) => { const t = tabs.find((x) => x.id === id); showApp(t && t.mode === 'shared' ? t.app : null); setActive(id); }} onClose={(id) => void requestClose(id)} end={(active !== MAIN || document.documentElement.dataset.layout === 'onlyoffice') && platform.windowControls ? <WindowButtons controls={platform.windowControls} /> : undefined} />}
      <div className="fo-tabpanes">
        <div className="fo-tabpane" hidden={active !== MAIN} inert={active !== MAIN}>{children(mainServices)}</div>
        {tabs.map((t) => (
          <div key={t.id} className="fo-tabpane" hidden={active !== t.id} inert={active !== t.id}>
            {t.mode === 'frame' ? (
              <iframe className="fo-tabframe" title={cleanTitle(t.title)} src={frameUrl(t.app, t.id)} />
            ) : (
              <ErrorBoundary onHome={() => close(t.id)}>
                <SharedModule app={t.app} file={t.file} services={servicesFor(t.id)} />
              </ErrorBoundary>
            )}
          </div>
        ))}
      </div>
      {ask.dialog}
    </>
  );
}
