// Services de la coquille Tauri 2 (bureau et mobile) : tout le contrat `Services` passe par les
// commandes natives de apps/desktop/src-tauri (registre d'autorisations, ecriture atomique, recents,
// reglages partages entre fenetres, mise a jour signee, journal). Les fichiers circulent en binaire :
// trame [u32 LE longueur de l'en-tete][en-tete JSON][octets], miroir de src-tauri/src/frame.rs.
import { Channel, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  NAVIGATE_EVENT,
  NOTICE_EVENT,
  isAppId,
  moduleForFile,
  type AppId,
  type FileFilter,
  type NavigateDetail,
  type NoticeKind,
  type OpenedFile,
  type RecentFile,
  type SavedFile,
  type Services,
  type Settings,
  type UpdateInfo,
  type Updater,
  type WindowControls,
} from '@forgeoffice/core';

// Textes propres a la coquille native (ce fichier est le seul du lot cote web).
const TEXTS = {
  updateAvailable: (version: string) =>
    `ForgeOffice ${version} est disponible. Installez-la depuis Fichier > Compte > Mises à jour.`,
  unsupported: (name: string) => `Format de fichier non pris en charge : ${name}`,
  badFrame: 'Réponse inattendue de la coquille ForgeOffice.',
  launchFailed: (detail: string) => `Impossible d'ouvrir le document demandé : ${detail}`,
} as const;

/** Evenements emis par la coquille (src-tauri/src/commands.rs et updates.rs). */
export const SETTING_EVENT = 'forgeoffice://setting-changed';
export const UPDATE_EVENT = 'forgeoffice://update-available';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Trame binaire envoyee a la coquille : en-tete JSON + octets bruts (pas de base64). */
export function encodeFrame(header: unknown, bytes: Uint8Array = new Uint8Array(0)): Uint8Array<ArrayBuffer> {
  const json = encoder.encode(JSON.stringify(header));
  const out = new Uint8Array(4 + json.length + bytes.length);
  new DataView(out.buffer).setUint32(0, json.length, true);
  out.set(json, 4);
  out.set(bytes, 4 + json.length);
  return out;
}

/** Decode une trame ; les octets sont copies (tampon propre, utilisable tel quel par les modules). */
export function decodeFrame(data: Uint8Array): { header: unknown; bytes: Uint8Array } {
  if (data.length < 4) throw new Error(TEXTS.badFrame);
  const length = new DataView(data.buffer, data.byteOffset, 4).getUint32(0, true);
  if (4 + length > data.length) throw new Error(TEXTS.badFrame);
  const header: unknown = JSON.parse(decoder.decode(data.subarray(4, 4 + length)));
  return { header, bytes: data.slice(4 + length) };
}

/** La coquille repond en ArrayBuffer ; on accepte aussi une vue ou un tableau de nombres. */
export function toBytes(value: unknown): Uint8Array {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  throw new Error(TEXTS.badFrame);
}

/** Fichier renvoye par la coquille ; null pour une reponse vide (dialogue annule, jeton inconnu). */
export function decodeFile(value: unknown): OpenedFile | null {
  const data = toBytes(value);
  if (data.length === 0) return null;
  const { header, bytes } = decodeFrame(data);
  if (typeof header !== 'object' || header === null) throw new Error(TEXTS.badFrame);
  const { name, path } = header as { name?: unknown; path?: unknown };
  if (typeof name !== 'string' || (path !== null && path !== undefined && typeof path !== 'string')) {
    throw new Error(TEXTS.badFrame);
  }
  return { name, path: typeof path === 'string' ? path : null, bytes };
}

interface AppInfo {
  version: string;
  platform: 'desktop' | 'mobile';
  os: string;
}

function ignoreLogFailure(): void {
  // Journal indisponible (fenetre en cours de fermeture) : rien d'autre a faire.
}

/** Ecrit dans le journal de la coquille (`[ISO8601] [NIVEAU] [page] message`). */
export function logToShell(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  invoke('log_write', { level, message }).catch(ignoreLogFailure);
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.stack ?? err.message;
  return typeof err === 'string' ? err : JSON.stringify(err);
}

function notifyInPage(message: string, kind: NoticeKind): void {
  window.dispatchEvent(new CustomEvent(NOTICE_EVENT, { detail: { message, kind } }));
}

function plainFilters(filters: readonly FileFilter[]): { name: string; extensions: string[] }[] {
  return filters.map((f) => ({ name: f.name, extensions: [...f.extensions] }));
}

/** Erreurs non rattrapees de la page : consignees dans le journal de la coquille. */
function installErrorLogging(): void {
  window.addEventListener('error', (e) => logToShell('ERROR', `${e.message} (${e.filename}:${e.lineno}:${e.colno})`));
  window.addEventListener('unhandledrejection', (e) => logToShell('ERROR', `promesse rejetee : ${describe(e.reason)}`));
}

/** Copie locale des reglages (lecture synchrone), tenue a jour quand une autre fenetre les change. */
function createSettings(stored: Record<string, unknown>): Settings {
  const cache = new Map<string, unknown>(Object.entries(stored));
  listen<{ key: string; value: unknown }>(SETTING_EVENT, ({ payload }) => {
    if (payload.value === null) cache.delete(payload.key);
    else cache.set(payload.key, payload.value);
  }).catch((err: unknown) => logToShell('WARN', `reglages partages : ${describe(err)}`));
  return {
    get<T>(key: string, fallback: T): T {
      return cache.has(key) ? (cache.get(key) as T) : fallback;
    },
    set<T>(key: string, value: T): void {
      const json = value === undefined ? null : value;
      if (json === null) cache.delete(key);
      else cache.set(key, json);
      invoke('settings_set', { key, value: json }).catch((err: unknown) => logToShell('ERROR', `reglage ${key} : ${describe(err)}`));
    },
  };
}

function createUpdater(): Updater {
  return {
    check: () => invoke<UpdateInfo | null>('update_check'),
    async install(onProgress) {
      const channel = new Channel<number>((fraction) => onProgress?.(Math.min(1, Math.max(0, fraction))));
      await invoke('update_install', { onProgress: channel });
    },
  };
}

function createWindowControls(): WindowControls {
  const win = getCurrentWindow();
  const report = (action: string) => (err: unknown) => logToShell('WARN', `fenetre (${action}) : ${describe(err)}`);
  return {
    minimize: () => void win.minimize().catch(report('reduire')),
    toggleMaximize: () => void win.toggleMaximize().catch(report('agrandir')),
    // Croix de la barre de titre : meme chemin que la fermeture systeme (confirmation si modifie).
    close: () => void win.close().catch(report('fermer')),
    isMaximized: () => win.isMaximized(),
  };
}

/** Ouvre un module : nouvelle fenetre sur bureau ; sur mobile la coquille renvoie l'URL a charger. */
async function openInModule(app: AppId, path: string | null, name: string | null, bytes?: Uint8Array): Promise<void> {
  const url = await invoke<string | null>('open_module', encodeFrame({ app, path, name }, bytes));
  if (url) window.location.assign(url);
}

// --- Document confie a la fenetre par la coquille (?token=... dans l'adresse) ---

let launch: Promise<OpenedFile | null> | null = null;
let launchClaimed = false;

function readLaunch(): Promise<OpenedFile | null> {
  launch ??= (async () => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token || !/^[0-9a-f]{32}$/.test(token)) return null;
    return decodeFile(await invoke<ArrayBuffer>('take_launch', { token }));
  })();
  return launch;
}

/**
 * Document a ouvrir au demarrage de cette fenetre (double-clic, ligne de commande, « ouvrir dans une
 * nouvelle fenetre »), ou null. Si la coquille web l'appelle avant de monter le module, elle le recoit
 * directement ; sinon `createTauriServices` le livre seul par NAVIGATE_EVENT une fois la coquille montee.
 */
export function takeLaunchFile(): Promise<OpenedFile | null> {
  launchClaimed = true;
  return readLaunch();
}

/** Attend que la coquille React ecoute NAVIGATE_EVENT (element `.fo-shell` monte), 5 s au plus. */
function whenShellReady(run: () => void): void {
  const ready = (): boolean => document.querySelector('.fo-shell') !== null;
  if (ready()) {
    setTimeout(run, 0);
    return;
  }
  const observer = new MutationObserver(() => {
    if (!ready()) return;
    observer.disconnect();
    clearTimeout(fallback);
    setTimeout(run, 0);
  });
  const fallback = setTimeout(() => {
    observer.disconnect();
    run();
  }, 5000);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function deliverLaunchFile(notify: Services['notify']): void {
  readLaunch().then(
    (file) => {
      if (!file) return;
      const requested = new URLSearchParams(window.location.search).get('app') ?? '';
      const app = isAppId(requested) && requested !== 'hub' ? requested : moduleForFile(file.name);
      if (!app) {
        notify(TEXTS.unsupported(file.name), 'error');
        return;
      }
      whenShellReady(() => {
        if (launchClaimed) return;
        window.dispatchEvent(new CustomEvent<NavigateDetail>(NAVIGATE_EVENT, { detail: { app, file } }));
        // Le jeton a servi : un retour a l'accueil puis F5 ne doit pas rouvrir le document.
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        window.history.replaceState(window.history.state, '', url);
      });
    },
    (err: unknown) => notify(TEXTS.launchFailed(describe(err)), 'error'),
  );
}

export async function createTauriServices(): Promise<Services> {
  const [info, stored] = await Promise.all([
    invoke<AppInfo>('app_info'),
    invoke<Record<string, unknown>>('settings_load'),
  ]);
  installErrorLogging();
  const desktop = info.platform === 'desktop';

  const services: Services = {
    platform: info.platform,
    version: info.version,
    async openFile(filters) {
      return decodeFile(await invoke<ArrayBuffer>('open_dialog', { filters: plainFilters(filters) }));
    },
    async readFile(path) {
      const file = decodeFile(await invoke<ArrayBuffer>('read_path', { path }));
      if (!file) throw new Error(TEXTS.badFrame);
      return file;
    },
    saveFile(bytes, suggestedName, filters, path): Promise<SavedFile | null> {
      return invoke<SavedFile | null>('save_file', encodeFrame({ path, suggestedName, filters: plainFilters(filters) }, bytes));
    },
    openModule(app, path) {
      return openInModule(app, path ?? null, null);
    },
    async openDocument(file) {
      const app = moduleForFile(file.name);
      if (!app) throw new Error(TEXTS.unsupported(file.name));
      if (file.path) await openInModule(app, file.path, null);
      else await openInModule(app, null, file.name, file.bytes);
    },
    updater: desktop ? createUpdater() : null,
    windowControls: desktop ? createWindowControls() : null,
    native: { invoke: <T,>(command: string, args?: Record<string, unknown>): Promise<T> => invoke<T>(command, args) },
    async recentFiles() {
      const list = await invoke<RecentFile[]>('recents_list');
      return list.filter((r) => isAppId(r.app));
    },
    async addRecent(entry) {
      await invoke('recents_add', { entry: { app: entry.app, name: entry.name, path: entry.path } });
    },
    async clearRecent() {
      await invoke('recents_clear');
    },
    settings: createSettings(stored),
    setTitle(title) {
      document.title = title;
      invoke('window_set_title', { title }).catch((err: unknown) => logToShell('WARN', `titre : ${describe(err)}`));
    },
    setModified(modified) {
      invoke('window_set_modified', { modified }).catch((err: unknown) => logToShell('WARN', `indicateur : ${describe(err)}`));
    },
    notify(message, kind = 'info') {
      if (kind === 'error') logToShell('ERROR', message);
      notifyInPage(message, kind);
    },
    print() {
      invoke('print_window').catch((err: unknown) => {
        logToShell('WARN', `impression native : ${describe(err)}`);
        window.print();
      });
    },
    close() {
      invoke('window_close').catch((err: unknown) => logToShell('ERROR', `fermeture : ${describe(err)}`));
    },
  };

  listen<UpdateInfo>(UPDATE_EVENT, ({ payload }) => services.notify(TEXTS.updateAvailable(payload.version), 'info')).catch(
    (err: unknown) => logToShell('WARN', `annonce de mise a jour : ${describe(err)}`),
  );
  deliverLaunchFile(services.notify);
  return services;
}
