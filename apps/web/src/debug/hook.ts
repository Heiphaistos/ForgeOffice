// Crochet de test `window.__FO__` du banc de conformite (apps/web/tests/conformity). Charge UNIQUEMENT en developpement
// (main.tsx : `if (import.meta.env.DEV) import('./debug/hook.ts')`) : absent du build de production.
import { NAVIGATE_EVENT, currentProbe, isAppId, type AppId } from '@forgeoffice/core';
import { STANDARD_COLORS, ribbonProbe } from '@forgeoffice/ui';
import { enumerateCommands, toInfo, type CommandEntry, type CommandInfo } from './enumerate.ts';

declare global {
  interface Window {
    __FO__?: FoHook;
  }
}

export interface UiSignature {
  /** Fenetres modales (boites de dialogue, Backstage). */
  dialogs: string[];
  /** Menus et fenetres flottantes ouverts. */
  popups: string[];
  toasts: string[];
  /** Etats coches / enfonces des controles du ruban. */
  pressed: Record<string, string>;
  /** Hachage par region du reste de l'interface (hors zone de document et hors ruban). */
  outside: Record<string, string>;
  tab: string;
  /** Compteurs d'appels a des API de plateforme interceptees. */
  platform: Record<string, number>;
}

export interface FoHook {
  app(): string;
  presets(): readonly string[];
  commands(): CommandInfo[];
  invoke(id: string, arg?: string): { ok: boolean; error?: string };
  snapshot(): unknown;
  select(preset: string): Promise<boolean>;
  reset(name: string, b64: string, app?: string): Promise<boolean>;
  consoleErrors(clear?: boolean): string[];
  ui(zones: readonly string[]): UiSignature;
}

const errors: string[] = [];
const push = (kind: string, message: string): void => void errors.push(`${kind}: ${message.slice(0, 400)}`);
window.addEventListener('error', (e) => push('exception', e.error instanceof Error ? `${e.error.message} @ ${(e.error.stack ?? '').split('\n')[1]?.trim() ?? ''}` : e.message));
window.addEventListener('unhandledrejection', (e) => push('promesse rejetee', e.reason instanceof Error ? `${e.reason.message} @ ${(e.reason.stack ?? '').split('\n')[1]?.trim() ?? ''}` : String(e.reason)));
const origError = console.error.bind(console);
console.error = (...args: unknown[]): void => {
  push('console.error', args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a) ?? String(a))).join(' '));
  origError(...args);
};

// Appels plateforme interceptes (selecteur de fichier, impression, presse-papiers, ouverture de fenetre) : voir tests/conformity/driver.
const platform: Record<string, number> = {};
const count = (k: string): void => void (platform[k] = (platform[k] ?? 0) + 1);
const origClick = HTMLInputElement.prototype.click;
HTMLInputElement.prototype.click = function (this: HTMLInputElement): void {
  if (this.type === 'file') count('selecteur-de-fichier');
  origClick.call(this);
};
window.print = (): void => count('impression');
window.close = (): void => count('fermeture-de-fenetre');
window.open = (): null => {
  count('window.open');
  return null;
};
const clip = navigator.clipboard;
if (clip) {
  for (const m of ['writeText', 'write', 'readText', 'read'] as const) {
    if (typeof clip[m] !== 'function') continue;
    const orig = clip[m].bind(clip) as (...a: unknown[]) => Promise<unknown>;
    (clip as unknown as Record<string, unknown>)[m] = (...a: unknown[]): Promise<unknown> => {
      count('presse-papiers');
      return orig(...a);
    };
  }
}
const origExec = document.execCommand.bind(document);
document.execCommand = (cmd: string, ...rest: [boolean?, string?]): boolean => {
  if (['copy', 'cut', 'paste'].includes(cmd)) count('presse-papiers');
  return origExec(cmd, ...rest);
};
const origAnchorClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement): void {
  if (this.download) count('telechargement');
  origAnchorClick.call(this);
};

function currentApp(): AppId {
  const app = new URLSearchParams(window.location.search).get('app') ?? 'hub';
  return isAppId(app) ? app : 'hub';
}

let entries: CommandEntry[] = [];
const refresh = (): CommandEntry[] =>
  (entries = enumerateCommands(ribbonProbe.tabs, { colors: STANDARD_COLORS.filter((c) => ['Rouge', 'Bleu'].includes(c.label)).map((c) => [c.label, c.color] as const) }));

const text = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h >>> 0}`;
}

const hook: FoHook = {
  app: currentApp,
  presets: () => currentProbe()?.presets ?? [],
  commands: () => refresh().map(toInfo),
  invoke(id, arg) {
    const e = refresh().find((c) => c.id === id);
    if (!e) return { ok: false, error: 'commande introuvable' };
    try {
      e.run(arg);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? `${err.message} @ ${(err.stack ?? '').split('\n')[1]?.trim() ?? ''}` : String(err) };
    }
  },
  snapshot: () => currentProbe()?.snapshot() ?? null,
  async select(preset) {
    const p = currentProbe();
    return p ? Promise.resolve(p.select(preset)) : false;
  },
  async reset(name, b64, app) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const target = app && isAppId(app) ? app : currentApp();
    window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { app: target, file: b64 ? { name, path: null, bytes } : null } }));
    return true;
  },
  consoleErrors(clear = false) {
    const copy = [...errors];
    if (clear) errors.length = 0;
    return copy;
  },
  ui(zones) {
    const dialogs = [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].map((d) => `${d.getAttribute('aria-label') ?? d.querySelector('.fo-dialog__title,h1,h2')?.textContent ?? ''}|${text(d)}`);
    const popups = [...document.querySelectorAll('.fo-menu,.fo-popover,.fo-combo__list,[role=listbox][aria-label]')].filter((e) => !e.closest('.fo-ribbon__panel .fo-gal') && (e.getBoundingClientRect().width > 0)).map((p) => `${p.className}|${text(p)}`);
    const toasts = [...document.querySelectorAll('.fo-toast')].map(text);
    const pressed: Record<string, string> = {};
    document.querySelectorAll('[data-cmd]').forEach((e) => {
      const b = e.matches('button') ? e : e.querySelector('button,[aria-pressed],[aria-checked]');
      const v = b?.getAttribute('aria-pressed') ?? b?.getAttribute('aria-checked') ?? (e.querySelector('input[type=checkbox]') as HTMLInputElement | null)?.checked?.toString();
      if (v != null) pressed[e.getAttribute('data-cmd') ?? ''] = String(v);
    });
    const root = document.querySelector('#root');
    const outside: Record<string, string> = {};
    if (root) {
      const zoneAttrs = zones.map((sel) => [...document.querySelectorAll(sel)].map((e) => `${e.className}|${e.getAttribute('style') ?? ''}`).join(';')).join('#');
      const clone = root.cloneNode(true) as Element;
      for (const sel of [...zones, '.fo-ribbon', '.fo-toasts', '.fo-tooltip', '[role=tooltip]']) clone.querySelectorAll(sel).forEach((n) => n.remove());
      outside['@racine'] = hash(`${zoneAttrs}|${document.documentElement.className}|${document.documentElement.getAttribute('data-theme')}|${document.body.className}`);
      const walk = (e: Element, key: string, depth: number): void => {
        outside[key] = hash(e.outerHTML);
        if (depth >= 3) return;
        [...e.children].forEach((c, i) => {
          if (c.tagName !== 'STYLE') walk(c, `${key}>${c.tagName.toLowerCase()}.${String(c.className).split(' ')[0] ?? ''}[${i}]`, depth + 1);
        });
      };
      for (const c of clone.children) walk(c, c.tagName.toLowerCase(), 1);
    }
    return {
      dialogs, popups, toasts, pressed, outside,
      tab: text(document.querySelector('.fo-ribbon [role=tab][aria-selected=true]') ?? document.body).slice(0, 40),
      platform: { ...platform },
    };
  },
};

window.__FO__ = hook;
