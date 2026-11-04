// Point d'entree : services de la plateforme, theme, puis la coquille.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isAppId } from '@forgeoffice/core';
import { applyTheme, savedTheme } from '@forgeoffice/ui';
import { createServices } from './platform/index.ts';
import { appFromSearch } from './module-check.ts';
import { Shell } from './Shell.tsx';
import { ErrorScreen } from './ErrorBoundary.tsx';
import { S } from './strings.ts';

const container = document.getElementById('root');
if (!container) throw new Error('#root introuvable');
const root = createRoot(container);
const initial = appFromSearch(window.location.search, isAppId);

createServices().then(
  (services) => {
    applyTheme(savedTheme(services.settings));
    root.render(
      <StrictMode>
        <Shell services={services} initial={initial === 'demo' || isAppId(initial) ? initial : 'hub'} />
      </StrictMode>,
    );
  },
  (err: unknown) => {
    root.render(<ErrorScreen message={`${S.error.services} ${err instanceof Error ? err.message : String(err)}`} />);
  },
);
