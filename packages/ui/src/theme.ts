// Theme et accent de l'application, appliques sur <html>.
import type { AppId, Settings } from '@forgeoffice/core';

export type ThemeChoice = 'light' | 'dark' | 'contrast' | 'system';
export type ResolvedTheme = 'light' | 'dark' | 'contrast';

export const THEME_SETTING = 'ui.theme';

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'contrast' || value === 'system';
}

/** Resout « system » d'apres les preferences du systeme. */
export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice !== 'system') return choice;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  if (window.matchMedia('(prefers-contrast: more)').matches) return 'contrast';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let systemListener: (() => void) | null = null;

/** Applique le theme (et suit le systeme si « system »). */
export function applyTheme(choice: ThemeChoice): ResolvedTheme {
  const root = document.documentElement;
  const resolved = resolveTheme(choice);
  root.dataset.theme = resolved;
  if (systemListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemListener);
    systemListener = null;
  }
  if (choice === 'system' && window.matchMedia) {
    systemListener = () => {
      root.dataset.theme = resolveTheme('system');
    };
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', systemListener);
  }
  return resolved;
}

/** Lit le theme enregistre (defaut : systeme). */
export function savedTheme(settings: Settings): ThemeChoice {
  const value = settings.get<unknown>(THEME_SETTING, 'system');
  return isThemeChoice(value) ? value : 'system';
}

/** Change l'accent : `data-app` sur <html>. */
export function applyAppAccent(app: AppId): void {
  document.documentElement.dataset.app = app;
}
