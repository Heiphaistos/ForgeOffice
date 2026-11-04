// Chargement a la demande des applications de la suite (un fichier JS par application).
import type { AppId, AppModule } from '@forgeoffice/core';
import { asAppModule } from './module-check.ts';

const LOADERS: Readonly<Record<AppId, () => Promise<unknown>>> = {
  hub: () => import('@forgeoffice/hub'),
  word: () => import('@forgeoffice/word'),
  excel: () => import('@forgeoffice/excel'),
  powerpoint: () => import('@forgeoffice/powerpoint'),
  publisher: () => import('@forgeoffice/publisher'),
  access: () => import('@forgeoffice/access'),
  pdf: () => import('@forgeoffice/pdf'),
  notes: () => import('@forgeoffice/notes'),
  convert: () => import('@forgeoffice/convert'),
};

const cache = new Map<AppId, Promise<AppModule | null>>();

/** Module charge, ou null s'il n'exporte pas encore { info, App } (« Bientot disponible »). */
export function loadModule(app: AppId): Promise<AppModule | null> {
  let pending = cache.get(app);
  if (!pending) {
    pending = LOADERS[app]().then((m) => asAppModule(m, app));
    pending.catch(() => cache.delete(app));
    cache.set(app, pending);
  }
  return pending;
}

/** Precharge un module (survol d'une vignette de l'accueil). */
export function preloadModule(app: AppId): void {
  void loadModule(app).catch(() => undefined);
}
