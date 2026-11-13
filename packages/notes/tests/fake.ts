// Faux Services (disque en memoire) et hote de commandes pour les tests du Bloc-notes.
import type { OpenedFile, Services } from '@forgeoffice/core';
import { DEFAULT_PREFS } from '../src/logic/prefs.ts';
import type { CommandHost } from '../src/commands.ts';
import type { Workspace } from '../src/workspace.ts';

export interface Fake {
  services: Services;
  disk: Map<string, Uint8Array>;
  notices: string[];
}

export function fake(platform: Services['platform'] = 'desktop'): Fake {
  const disk = new Map<string, Uint8Array>();
  const notices: string[] = [];
  const store = new Map<string, unknown>();
  const services = {
    platform,
    version: 'test',
    updater: null,
    windowControls: null,
    native: null,
    settings: { get: <T,>(k: string, d: T): T => (store.has(k) ? (store.get(k) as T) : d), set: (k: string, v: unknown) => void store.set(k, v) },
    setTitle: () => undefined,
    setModified: () => undefined,
    notify: (m: string) => void notices.push(m),
    addRecent: () => Promise.resolve(),
    readFile: (path: string): Promise<OpenedFile> => {
      const bytes = disk.get(path);
      return bytes ? Promise.resolve({ name: path.split('/').pop() ?? path, path, bytes }) : Promise.reject(new Error('introuvable'));
    },
    saveFile: (bytes: Uint8Array, name: string, _filters: unknown, path: string | null) => {
      const p = path ?? `C:/tmp/${name}`;
      disk.set(p, bytes);
      return Promise.resolve({ name: p.split('/').pop() ?? name, path: p });
    },
  } as unknown as Services;
  return { services, disk, notices };
}

const noop = (): void => undefined;

/** Hote de commandes inerte ; `over` remplace ce que le test veut observer. */
export function makeHost(ws: Workspace, over: Partial<CommandHost> = {}): CommandHost {
  return {
    ws, prefs: DEFAULT_PREFS, setPrefs: noop, applyLayout: noop, canTopmost: false, isFavorite: false, toggleFavorite: noop, recover: noop, hasUpdater: false, isWeb: false, palette: noop, dialog: noop, closeTabs: noop,
    saveAll: noop, openFolder: noop, print: noop, zen: noop, openLinkAtCursor: noop, convertDocx: noop, copyPath: noop, clearRecent: noop, copyText: noop, promptEntry: noop, openInBrowser: noop, newWindow: noop,
    checkUpdate: noop, quit: noop, notify: noop, ...over,
  };
}
