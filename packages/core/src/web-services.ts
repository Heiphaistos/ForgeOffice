// Implementation navigateur des services : banc de test et version web.
// Ouvrir = <input type="file"> ; enregistrer = telechargement. Les recents ne gardent que le nom
// (le navigateur ne donne pas de chemin), stockes dans localStorage.
import type { AppId, FileFilter, NoticeKind, OpenedFile, RecentFile, SavedFile, Services, Settings } from './types.ts';
import { moduleForFile } from './modules.ts';

/** Evenement de navigation interne du banc navigateur. */
export const NAVIGATE_EVENT = 'fo-navigate';

export interface NavigateDetail {
  app: AppId;
  file: OpenedFile | null;
}

/** Evenement des notifications (toasts) : detail = { message, kind }. */
export const NOTICE_EVENT = 'fo-notice';

const RECENT_KEY = 'fo-recent';
const RECENT_MAX = 50;

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // stockage bloque (navigation privee) : comportement par defaut
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // stockage bloque : le reglage reste valable pour la session seulement
  }
}

export const webSettings: Settings = {
  get<T>(key: string, fallback: T): T {
    const raw = storageGet(`fo-setting:${key}`);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    storageSet(`fo-setting:${key}`, JSON.stringify(value));
  },
};

function acceptAttribute(filters: readonly FileFilter[]): string {
  return filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
}

function pickFile(filters: readonly FileFilter[]): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = acceptAttribute(filters);
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

function readRecent(): RecentFile[] {
  const raw = storageGet(RECENT_KEY);
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? (list as RecentFile[]) : [];
  } catch {
    return [];
  }
}

function notifyInPage(message: string, kind: NoticeKind): void {
  window.dispatchEvent(new CustomEvent(NOTICE_EVENT, { detail: { message, kind } }));
}

export function createWebServices(version: string): Services {
  return {
    platform: 'web',
    version,
    async openFile(filters): Promise<OpenedFile | null> {
      const file = await pickFile(filters);
      if (!file) return null;
      return { name: file.name, path: null, bytes: new Uint8Array(await file.arrayBuffer()) };
    },
    async readFile(path): Promise<OpenedFile> {
      throw new Error(`Lecture impossible dans le navigateur : ${path}`);
    },
    async saveFile(bytes, suggestedName): Promise<SavedFile | null> {
      const blob = new Blob([bytes.slice().buffer]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = suggestedName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return { name: suggestedName, path: null };
    },
    // Navigation dans la page (sans rechargement) : apps/web ecoute `fo-navigate` et monte le module.
    async openModule(app: AppId): Promise<void> {
      window.dispatchEvent(new CustomEvent<NavigateDetail>(NAVIGATE_EVENT, { detail: { app, file: null } }));
    },
    async openDocument(file: OpenedFile): Promise<void> {
      const app = moduleForFile(file.name);
      if (!app) throw new Error(`Format non pris en charge : ${file.name}`);
      window.dispatchEvent(new CustomEvent<NavigateDetail>(NAVIGATE_EVENT, { detail: { app, file } }));
    },
    updater: null,
    windowControls: null,
    native: null,
    async recentFiles() {
      return readRecent();
    },
    async addRecent(entry) {
      const list = readRecent().filter((r) => !(r.path === entry.path && r.app === entry.app));
      list.unshift({ ...entry, openedAt: Date.now() });
      storageSet(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
    },
    async clearRecent() {
      storageSet(RECENT_KEY, '[]');
    },
    settings: webSettings,
    setTitle(title) {
      document.title = title;
    },
    setModified() {
      // pas d'indicateur systeme dans le navigateur : la barre de titre du module l'affiche
    },
    notify(message, kind = 'info') {
      notifyInPage(message, kind);
    },
    print() {
      window.print();
    },
    close() {
      void this.openModule('hub');
    },
  };
}
