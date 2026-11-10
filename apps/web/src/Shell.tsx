// Coquille : charge le module demande, navigue sans rechargement (NAVIGATE_EVENT), ecran de demarrage, filet d'erreur.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MODULES, NAVIGATE_EVENT, isAppId, moduleForFile, type AppId, type AppModule, type NavigateDetail, type OpenedFile, type Services } from '@forgeoffice/core';
import { Toaster, applyAppAccent, installTouchSupport } from '@forgeoffice/ui';
import { loadModule } from './registry.ts';
import { ErrorBoundary, ErrorScreen } from './ErrorBoundary.tsx';
import { Splash } from './Splash.tsx';
import { ComingSoon } from './ComingSoon.tsx';
import { LeaveGuard } from './platform/LeaveGuard.tsx';
import { TabHost } from './tabs/TabHost.tsx';
import { S } from './strings.ts';
import './shell.css';

const RibbonDemo = lazy(() => import('./demo/RibbonDemo.tsx'));

export type Route = { app: AppId | 'demo'; file: OpenedFile | null; serial: number };

// `app` lie le resultat au module demande : au premier rendu apres une navigation, l'ancien module ne doit pas recevoir le nouveau fichier.
type Loaded = { status: 'loading' } | { status: 'ready'; app: AppId; mod: AppModule } | { status: 'missing'; app: AppId } | { status: 'error'; app: AppId; message: string };

function setAddress(app: AppId | 'demo', push: boolean): void {
  const url = new URL(window.location.href);
  url.searchParams.set('app', app);
  if (url.href === window.location.href) return;
  if (push) window.history.pushState({ app }, '', url);
  else window.history.replaceState({ app }, '', url);
}

/** « Ouvrir » dans une application : un fichier hors de ses filtres (autre extension, « Tous les fichiers ») bascule vers l'application qui le gere
 *  au lieu d'etre lu par la mauvaise ; l'appel renvoie alors null (comme une annulation). */
function routeOpenFile(services: Services): Services {
  return {
    ...services,
    async openFile(filters) {
      const file = await services.openFile(filters);
      if (!file) return null;
      const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
      if (filters.some((f) => f.extensions.includes(ext)) || !moduleForFile(file.name)) return file;
      await services.openDocument(file);
      return null;
    },
  };
}

interface MainPaneProps {
  base: Services;
  initial: AppId | 'demo';
  initialFile: OpenedFile | null;
  /** Titre et indicateur « modifie » de cette page, pour le bandeau d'onglets de l'hote. */
  onReport: (state: { title?: string; modified?: boolean }) => void;
}

/** Page principale : charge le module de la route courante. */
function MainPane({ base, initial, initialFile, onReport }: MainPaneProps) {
  const report = useRef(onReport);
  report.current = onReport;
  const platform = useMemo<Services>(
    () => ({
      ...base,
      setTitle(title) {
        report.current({ title });
        base.setTitle(title);
      },
      setModified(modified) {
        report.current({ modified });
        base.setModified(modified);
      },
    }),
    [base],
  );
  const services = useMemo(() => routeOpenFile(platform), [platform]);
  const [route, setRoute] = useState<Route>({ app: initial, file: initialFile, serial: 0 });
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => installTouchSupport(), []);

  const go = useCallback((app: AppId | 'demo', file: OpenedFile | null, push = true) => {
    setRoute((r) => ({ app, file, serial: r.serial + 1 }));
    setAddress(app, push);
  }, []);

  useEffect(() => {
    const onNavigate = (e: Event): void => {
      const detail = (e as CustomEvent<NavigateDetail>).detail;
      if (detail && isAppId(detail.app)) go(detail.app, detail.file ?? null);
    };
    const onPop = (): void => {
      const app = new URLSearchParams(window.location.search).get('app') ?? 'hub';
      go(app === 'demo' ? 'demo' : isAppId(app) ? app : 'hub', null, false);
    };
    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener(NAVIGATE_EVENT, onNavigate);
      window.removeEventListener('popstate', onPop);
    };
  }, [go]);

  useEffect(() => {
    const app = route.app;
    applyAppAccent(app === 'demo' ? 'word' : app);
    if (app === 'demo') {
      services.setTitle(`${S.demo.title} - ForgeOffice`);
      return;
    }
    const info = MODULES[app];
    services.setTitle(app === 'hub' ? info.name : `${info.name} - ForgeOffice`);
    let alive = true;
    setLoaded({ status: 'loading' });
    loadModule(app).then(
      (mod) => {
        if (alive) setLoaded(mod ? { status: 'ready', app, mod } : { status: 'missing', app });
      },
      (err: unknown) => {
        if (alive) setLoaded({ status: 'error', app, message: err instanceof Error ? err.message : String(err) });
      },
    );
    return () => {
      alive = false;
    };
  }, [route.app, services]);

  const home = (): void => go('hub', null);
  let body;
  if (route.app === 'demo') {
    body = (
      <Suspense fallback={<Splash info={MODULES.word} />}>
        <RibbonDemo services={services} />
      </Suspense>
    );
  } else {
    const info = MODULES[route.app];
    if (loaded.status === 'loading' || loaded.app !== route.app) body = <Splash info={info} />;
    else if (loaded.status === 'missing') body = <ComingSoon info={info} services={services} />;
    else if (loaded.status === 'error') body = <ErrorScreen message={`${S.error.loadFailed(info.name)} ${loaded.message}`} onHome={route.app === 'hub' ? undefined : home} />;
    else {
      const App = loaded.mod.App;
      body = <App key={`${route.app}-${route.serial}`} services={services} file={route.file} />;
    }
  }

  return (
    <>
      <ErrorBoundary key={`${route.app}-${route.serial}`} onHome={home}>
        {body}
      </ErrorBoundary>
      <LeaveGuard onLeave={home} />
    </>
  );
}

export interface ShellProps {
  services: Services;
  initial: AppId | 'demo';
  /** Cadre d'onglet (« tab ») : fichier confie par la page hote ; les onglets sont alors geres par l'hote. */
  embeddedFile?: OpenedFile | null;
  embedded?: boolean;
}

export function Shell({ services, initial, embedded = false, embeddedFile = null }: ShellProps) {
  const [main, setMain] = useState({ title: '', modified: false });
  const onReport = useCallback((s: { title?: string; modified?: boolean }) => setMain((m) => ({ ...m, ...s })), []);
  return (
    <div className="fo-shell">
      {embedded ? (
        <MainPane base={services} initial={initial} initialFile={embeddedFile} onReport={onReport} />
      ) : (
        <TabHost platform={services} mainTitle={main.title} mainModified={main.modified}>
          {(base) => <MainPane base={base} initial={initial} initialFile={null} onReport={onReport} />}
        </TabHost>
      )}
      <Toaster />
    </div>
  );
}
