// Integration Android de la page (coquille Tauri mobile) : bouton Retour, document recu par « Ouvrir avec »,
// plein ecran immersif du diaporama, couleur des barres systeme. Le Kotlin est dans
// apps/desktop/src-tauri/gen/android/.../ForgePlugin.kt, les commandes Rust dans mobile_cmds.rs.
import { invoke } from '@tauri-apps/api/core';
import { onBackButtonPress } from '@tauri-apps/api/app';
import { NAVIGATE_EVENT, isAppId, moduleForFile, type NavigateDetail, type OpenedFile, type Services } from '@forgeoffice/core';

/** Demande de retour a l'accueil (bouton Retour) : la coquille web confirme si le document est modifie. */
export const LEAVE_EVENT = 'fo-leave-module';
export interface LeaveDetail {
  modified: boolean;
}

/** Evenement emis par le Kotlin quand un nouveau document arrive pendant que l'appli tourne. */
const INBOX_EVENT = 'fo-inbox';
const OVERLAY = '.fo-dialog, .fo-menu, .fo-popover, .fo-bs';

type Decode = (value: unknown) => OpenedFile | null;

function currentApp(): string {
  return new URLSearchParams(window.location.search).get('app') ?? 'hub';
}

function goHome(): void {
  window.dispatchEvent(new CustomEvent<NavigateDetail>(NAVIGATE_EVENT, { detail: { app: 'hub', file: null } }));
}

/** Couleur CSS `rgb(r, g, b)` -> entier ARGB signe (format Android). */
export function argbOf(css: string): number {
  const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(css);
  if (!m) return 0xff000000 | 0;
  return (0xff000000 | (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3])) | 0;
}

/** Barres systeme : icones et fond assortis au theme (clair/sombre) de la page. */
function syncSystemBars(): void {
  const push = (): void => {
    const dark = document.documentElement.dataset.theme === 'dark';
    const color = argbOf(getComputedStyle(document.body).backgroundColor);
    invoke('set_system_bars', { dark, color }).catch(() => undefined);
  };
  push();
  new MutationObserver(push).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-app'] });
}

/** WebView Android : `requestFullscreen` est annule par le moteur ; le diaporama passe par le mode immersif natif. */
function polyfillFullscreen(): void {
  let element: Element | null = null;
  const set = (next: Element | null): void => {
    element = next;
    invoke('set_immersive', { on: next !== null }).catch(() => undefined);
    document.dispatchEvent(new Event('fullscreenchange'));
  };
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element });
  Element.prototype.requestFullscreen = function requestFullscreen(this: Element): Promise<void> {
    set(this);
    return Promise.resolve();
  };
  document.exitFullscreen = (): Promise<void> => {
    if (element) set(null);
    return Promise.resolve();
  };
}

/** Ouvre le document recu dans l'application qui le gere (selon son extension). */
function openInbox(decode: Decode, notify: Services['notify'], unsupported: (name: string) => string): void {
  invoke<ArrayBuffer>('inbox_take')
    .then((value) => {
      const file = decode(value);
      if (!file) return;
      const app = moduleForFile(file.name);
      if (!app || !isAppId(app)) {
        notify(unsupported(file.name), 'error');
        return;
      }
      window.dispatchEvent(new CustomEvent<NavigateDetail>(NAVIGATE_EVENT, { detail: { app, file } }));
    })
    .catch((err: unknown) => notify(err instanceof Error ? err.message : String(err), 'error'));
}

export interface AndroidHooks {
  decode: Decode;
  unsupported: (name: string) => string;
  /** Etat « modifie » du module affiche (suivi par `setModified`). */
  isModified: () => boolean;
  /** Attend que la coquille React ecoute NAVIGATE_EVENT. */
  whenShellReady: (run: () => void) => void;
}

/** Installe tout ce qui est propre a Android : retour, plein ecran, barres systeme, documents recus. */
export function installAndroid(services: Services, hooks: AndroidHooks): void {
  polyfillFullscreen();
  syncSystemBars();
  // Dialogue, menu, Backstage ou plein ecran (diaporama) : Retour revient a Echap, comme au clavier.
  const overlayOpen = (): boolean => document.querySelector(OVERLAY) !== null || document.fullscreenElement !== null;
  onBackButtonPress(() => {
    if (overlayOpen()) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    } else if (currentApp() === 'hub') {
      invoke('exit_app').catch(() => undefined);
    } else {
      window.dispatchEvent(new CustomEvent<LeaveDetail>(LEAVE_EVENT, { detail: { modified: hooks.isModified() } }));
    }
  }).catch((err: unknown) => services.notify(`Bouton Retour indisponible : ${String(err)}`, 'error'));
  const take = (): void => openInbox(hooks.decode, services.notify, hooks.unsupported);
  window.addEventListener(INBOX_EVENT, take);
  hooks.whenShellReady(take);
}

/** `Services.close()` sur mobile : retour a l'Accueil, ou sortie de l'appli depuis l'Accueil. */
export function closeOnMobile(): void {
  if (currentApp() === 'hub') invoke('exit_app').catch(() => undefined);
  else goHome();
}
