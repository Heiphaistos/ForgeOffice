// Point d'entree : services de la plateforme, theme, puis la coquille.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isAppId } from '@forgeoffice/core';
import { applyTheme, savedTheme } from '@forgeoffice/ui';
import { createServices } from './platform/index.ts';
import { appFromSearch } from './module-check.ts';
import { Shell } from './Shell.tsx';
import { parentHost } from './tabs/host.ts';
import { embedServices, localFile } from './tabs/tabServices.ts';
import { ErrorScreen } from './ErrorBoundary.tsx';
import { S } from './strings.ts';

// Crochet du banc de conformite : developpement seulement (le build de production ne l'embarque pas).
if (import.meta.env.DEV) void import('./debug/hook.ts');

const container = document.getElementById('root');
if (!container) throw new Error('#root introuvable');
document.documentElement.dataset.foVersion = __FO_VERSION__;
const root = createRoot(container);
const initial = appFromSearch(window.location.search, isAppId);

// Cadre d'onglet : les services (et le fichier) viennent de la page hote.
const tabId = new URLSearchParams(window.location.search).get('embedded');
const host = tabId ? parentHost() : null;

(host && tabId ? Promise.resolve(embedServices(host.tabServices(tabId), host.hostBytes)) : createServices()).then(
  (services) => {
    applyTheme(savedTheme(services.settings));
    const app = initial === 'demo' || isAppId(initial) ? initial : 'hub';
    root.render(
      <StrictMode>
        <Shell services={services} initial={app} embedded={host !== null} embeddedFile={host && tabId ? localFile(host.takeFile(tabId)) : null} />
      </StrictMode>,
    );
  },
  (err: unknown) => {
    root.render(<ErrorScreen message={`${S.error.services} ${err instanceof Error ? err.message : String(err)}`} />);
  },
);
