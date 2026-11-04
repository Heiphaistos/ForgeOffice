// Recuperation apres plantage : copie .pptx de la presentation en cours gardee dans IndexedDB.
const DB = 'forgeoffice-recovery';
const STORE = 'files';
const KEY = 'powerpoint';

export interface RecoveryEntry {
  name: string;
  path: string | null;
  bytes: Uint8Array;
  savedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponible'));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
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

export const saveRecovery = (entry: RecoveryEntry): Promise<unknown> => run('readwrite', (s) => s.put(entry, KEY));

export async function loadRecovery(): Promise<RecoveryEntry | null> {
  const value = await run<unknown>('readonly', (s) => s.get(KEY));
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<RecoveryEntry>;
  return v.bytes instanceof Uint8Array && typeof v.name === 'string' ? { name: v.name, path: v.path ?? null, bytes: v.bytes, savedAt: Number(v.savedAt) || 0 } : null;
}

export const clearRecovery = (): Promise<unknown> => run('readwrite', (s) => s.delete(KEY));
