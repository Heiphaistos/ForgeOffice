// Copies de recuperation apres plantage, communes aux applications (Texte, Tableur, Presentation, Publication).
// Une cle par session d'edition (identifiant aleatoire) : deux fenetres ne s'ecrasent plus. Effacement a
// l'enregistrement et a la fermeture normale, purge des copies de plus de 7 jours, et restauration proposee
// seulement pour les copies dont la fenetre n'est plus vivante (verrou Web Locks tenu par chaque fenetre).
import { isAppId } from './modules.ts';
import type { AppId } from './types.ts';

export const RECOVERY_TTL_MS = 7 * 24 * 3600 * 1000;
/** Sans Web Locks : une copie ecrite depuis moins de ce delai est supposee appartenir a une fenetre vivante. */
export const LIVE_FALLBACK_MS = 90_000;
const LOCK_PREFIX = 'forgeoffice-session:';
const LEGACY_SESSION = 'legacy';

export interface RecoveryEntry {
  app: AppId;
  session: string;
  name: string;
  path: string | null;
  bytes: Uint8Array;
  savedAt: number;
}

/** Magasin cle/valeur asynchrone (IndexedDB en production, Map dans les tests). */
export interface RecoveryBackend {
  put(key: string, value: RecoveryEntry): Promise<void>;
  remove(key: string): Promise<void>;
  entries(): Promise<Array<[string, unknown]>>;
}

/** Fenetres vivantes. `alive()` vaut null quand la plateforme ne sait pas le dire. */
export interface LiveRegistry {
  hold(session: string): void;
  alive(): Promise<ReadonlySet<string> | null>;
}

export interface RecoveryDeps {
  backend?: RecoveryBackend;
  live?: LiveRegistry;
  now?: () => number;
  newId?: () => string;
  ttl?: number;
}

/** Cle d'une copie : `app:session`. Une ancienne copie (cle `powerpoint`, `publisher`) devient la session `legacy`. */
function parseEntry(key: string, value: unknown): RecoveryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<RecoveryEntry>;
  const [app = '', session = LEGACY_SESSION] = key.split(':');
  if (!isAppId(app) || !(v.bytes instanceof Uint8Array) || typeof v.name !== 'string') return null;
  const savedAt = Number(v.savedAt);
  if (!Number.isFinite(savedAt) || savedAt <= 0) return null;
  return { app, session, name: v.name, path: typeof v.path === 'string' ? v.path : null, bytes: v.bytes, savedAt };
}

const keyOf = (app: string, session: string): string => (session === LEGACY_SESSION ? app : `${app}:${session}`);

export interface Recovery {
  readonly session: string;
  /** Ecrit (ou remplace) la copie de cette session. */
  save(file: { name: string; path: string | null; bytes: Uint8Array }): Promise<void>;
  /** Efface la copie de cette session (enregistrement, fermeture normale). */
  clear(): Promise<void>;
  /** Purge les copies perimees puis liste les copies restaurables (autres sessions, sans fenetre vivante), recentes d'abord. */
  pending(): Promise<RecoveryEntry[]>;
  /** Supprime une copie proposee (restauree ou ignoree). */
  discard(entry: RecoveryEntry): Promise<void>;
  /** Efface la copie quand la fenetre se ferme vraiment (`pagehide`) ; renvoie le nettoyage a appeler au demontage. */
  clearOnExit(): () => void;
}

export function createRecovery(app: AppId, deps: RecoveryDeps = {}): Recovery {
  const backend = deps.backend ?? indexedDbBackend();
  const live = deps.live ?? webLocksRegistry();
  const now = deps.now ?? Date.now;
  const ttl = deps.ttl ?? RECOVERY_TTL_MS;
  const session = (deps.newId ?? randomId)();
  const own = keyOf(app, session);
  live.hold(session);

  const self: Recovery = {
    session,
    save: (file) => backend.put(own, { app, session, name: file.name, path: file.path, bytes: file.bytes, savedAt: now() }),
    clear: () => backend.remove(own),
    async pending() {
      const rows = await backend.entries();
      const kept: RecoveryEntry[] = [];
      for (const [key, value] of rows) {
        const entry = parseEntry(key, value);
        if (!entry || now() - entry.savedAt > ttl) await backend.remove(key);
        else kept.push(entry);
      }
      const alive = await live.alive();
      return kept
        .filter((e) => e.app === app && e.session !== session && (alive ? !alive.has(e.session) : now() - e.savedAt > LIVE_FALLBACK_MS))
        .sort((a, b) => b.savedAt - a.savedAt);
    },
    discard: (entry) => backend.remove(keyOf(entry.app, entry.session)),
    clearOnExit() {
      const onHide = (): void => void self.clear().catch(() => undefined);
      window.addEventListener('pagehide', onHide);
      return () => {
        window.removeEventListener('pagehide', onHide);
        onHide();
      };
    },
  };
  return self;
}

const shared = new Map<AppId, Recovery>();

/** Une session par application et par fenetre (reutilisee quand le module est remonte dans la meme page). */
export function sharedRecovery(app: AppId): Recovery {
  let rec = shared.get(app);
  if (!rec) {
    rec = createRecovery(app);
    shared.set(app, rec);
  }
  return rec;
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------- Plateforme

interface LockManagerLike {
  request(name: string, callback: () => Promise<void>): Promise<unknown>;
  query(): Promise<{ held?: Array<{ name?: string }> }>;
}

function lockManager(): LockManagerLike | null {
  const locks = (globalThis as { navigator?: { locks?: LockManagerLike } }).navigator?.locks;
  return locks ?? null;
}

/** Chaque fenetre tient un verrou tant qu'elle vit (libere par le navigateur a la fermeture ou au plantage). */
export function webLocksRegistry(): LiveRegistry {
  return {
    hold(session) {
      void lockManager()?.request(LOCK_PREFIX + session, () => new Promise<void>(() => undefined)).catch(() => undefined);
    },
    async alive() {
      const locks = lockManager();
      if (!locks) return null;
      try {
        const state = await locks.query();
        const names = (state.held ?? []).map((l) => l.name ?? '').filter((n) => n.startsWith(LOCK_PREFIX));
        return new Set(names.map((n) => n.slice(LOCK_PREFIX.length)));
      } catch {
        return null; // etat des verrous illisible : repli sur l'anciennete de la copie
      }
    },
  };
}

const DB = 'forgeoffice-recovery';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponible'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = action(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
    });
  } finally {
    db.close();
  }
}

/** Magasin IndexedDB `forgeoffice-recovery` (le meme que les anciennes versions, cles differentes). */
export function indexedDbBackend(): RecoveryBackend {
  return {
    async put(key, value) {
      await withStore('readwrite', (s) => s.put(value, key));
    },
    async remove(key) {
      await withStore('readwrite', (s) => s.delete(key));
    },
    async entries() {
      const db = await openDb();
      try {
        return await new Promise<Array<[string, unknown]>>((resolve, reject) => {
          const out: Array<[string, unknown]> = [];
          const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
          req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return resolve(out);
            out.push([String(cursor.key), cursor.value]);
            cursor.continue();
          };
          req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
        });
      } finally {
        db.close();
      }
    },
  };
}
