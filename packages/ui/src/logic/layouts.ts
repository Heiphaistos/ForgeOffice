// Dispositions de l'interface (ruban Office 2024, OnlyOffice, LibreOffice...) : liste, lecture/ecriture des reglages.
// Toutes les dispositions affichent les MEMES commandes (le schema declaratif du ruban) ; seule la presentation change.
import type { AppId, Settings } from '@forgeoffice/core';

/** Famille de rendu : ce qui differe vraiment dans le DOM. Les variantes d'une famille partagent le composant. */
export type LayoutFamily = 'ribbon' | 'menubar';

export const LAYOUT_IDS = [
  'office',
  'office-simplified',
  'onlyoffice',
  'libreoffice',
  'openoffice',
  'menus-classic',
  'ribbon-compact',
  'google',
  'dropdown',
  'touch',
] as const;

export type LayoutId = (typeof LAYOUT_IDS)[number];

export const DEFAULT_LAYOUT: LayoutId = 'office';

/** Reglage global (toute la suite). */
export const LAYOUT_SETTING = 'ui.layout';
/** Ancien reglage du ruban (classique / simplifie), lu une fois pour ne pas perdre le choix existant. */
export const LEGACY_RIBBON_SETTING = 'ui.ribbon.layout';
/** Reglage propre a un module : `ui.layout.word`... ; absent ou « default » = suit le reglage global. */
export const layoutSettingFor = (app: AppId): string => `${LAYOUT_SETTING}.${app}`;
export const FOLLOW_GLOBAL = 'default';

/** Famille de chaque disposition. */
export const LAYOUT_FAMILY: Readonly<Record<LayoutId, LayoutFamily>> = {
  office: 'ribbon',
  'office-simplified': 'ribbon',
  onlyoffice: 'ribbon',
  libreoffice: 'menubar',
  openoffice: 'menubar',
  'menus-classic': 'menubar',
  'ribbon-compact': 'ribbon',
  google: 'menubar',
  dropdown: 'ribbon',
  touch: 'ribbon',
};

export function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === 'string' && (LAYOUT_IDS as readonly string[]).includes(value);
}

/** Disposition globale enregistree ; reprend l'ancien choix « ruban simplifie » si le nouveau reglage n'existe pas encore. */
export function savedGlobalLayout(settings: Settings | null | undefined): LayoutId {
  if (!settings) return DEFAULT_LAYOUT;
  const value = settings.get<unknown>(LAYOUT_SETTING, null);
  if (isLayoutId(value)) return value;
  return settings.get<unknown>(LEGACY_RIBBON_SETTING, 'classic') === 'simplified' ? 'office-simplified' : DEFAULT_LAYOUT;
}

/** Choix propre a un module, ou null s'il suit le reglage global. */
export function savedModuleLayout(settings: Settings | null | undefined, app: AppId): LayoutId | null {
  if (!settings) return null;
  const value = settings.get<unknown>(layoutSettingFor(app), FOLLOW_GLOBAL);
  return isLayoutId(value) ? value : null;
}

/** Disposition effective d'un module : son choix propre, sinon le reglage global. */
export function resolveLayout(settings: Settings | null | undefined, app: AppId | null): LayoutId {
  return (app ? savedModuleLayout(settings, app) : null) ?? savedGlobalLayout(settings);
}

export function setGlobalLayout(settings: Settings, layout: LayoutId): void {
  settings.set(LAYOUT_SETTING, layout);
}

/** `null` = le module suit le reglage global. */
export function setModuleLayout(settings: Settings, app: AppId, layout: LayoutId | null): void {
  settings.set(layoutSettingFor(app), layout ?? FOLLOW_GLOBAL);
}

// --- Ouverture d'un nouveau document : fenetre dediee ou onglet ---

/** window = fenetre dediee ; tab = onglet isole (un cadre par document) ; tab-shared = onglet dans la meme page. */
export type OpenMode = 'window' | 'tab' | 'tab-shared';
export const OPEN_MODES: readonly OpenMode[] = ['window', 'tab', 'tab-shared'];
export const OPEN_MODE_SETTING = 'ui.openMode';

export function savedOpenMode(settings: Settings | null | undefined): OpenMode {
  const value = settings?.get<unknown>(OPEN_MODE_SETTING, 'window');
  return OPEN_MODES.find((m) => m === value) ?? 'window';
}
