import type { AppId, Settings } from '@forgeoffice/core';
import { resolveLayout } from './layouts.ts';

/** Profil OnlyOffice actif ? (le DOM porte `data-layout` ; absent en test Node). */
export const isOnlyOffice = (): boolean => typeof document !== 'undefined' && document.documentElement.dataset.layout === 'onlyoffice';

/** Profil OnlyOffice choisi dans les reglages : sert au tout premier rendu d'un module, avant que `data-layout` soit pose par le ruban. */
export const isOnlyOfficeFor = (settings: Settings | null | undefined, app: AppId): boolean => isOnlyOffice() || resolveLayout(settings, app) === 'onlyoffice';
