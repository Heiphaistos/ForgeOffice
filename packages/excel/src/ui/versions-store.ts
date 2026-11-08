// Stockage de l'historique de versions dans IndexedDB (une base locale, 5 versions par classeur).
import { digestOf, pushVersion, type VersionInfo } from '../logic/versions.ts';

const DB = 'forgeoffice-excel-versions';
const STORE = 'versions';
export const MAX_VERSIONS = 5;

interface Row { id: string; info: VersionInfo; bytes: Uint8Array }

const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponible'));
});

const done = <T,>(req: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
});

async function rowsOf(db: IDBDatabase, name: string): Promise<Row[]> {
  const all = await done(db.transaction(STORE).objectStore(STORE).getAll() as IDBRequest<Row[]>);
  return all.filter((r) => r.info.name === name).sort((a, b) => b.info.at.localeCompare(a.info.at));
}

/** Enregistre une version de `name` (ignoree si identique a la derniere) et supprime les plus anciennes au-dela de MAX_VERSIONS. */
export async function recordVersion(name: string, bytes: Uint8Array): Promise<void> {
  const db = await open();
  const rows = await rowsOf(db, name);
  const info: VersionInfo = { id: `${name}-${Date.now()}`, name, at: new Date().toISOString(), size: bytes.length, digest: digestOf(bytes) };
  const { list, dropped } = pushVersion(rows.map((r) => r.info), info, MAX_VERSIONS);
  if (!list.includes(info)) return;
  const tx = db.transaction(STORE, 'readwrite');
  const os = tx.objectStore(STORE);
  os.put({ id: info.id, info, bytes } satisfies Row);
  for (const d of dropped) os.delete(d.id);
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error ?? new Error('IndexedDB')); });
}

export async function listVersions(name: string): Promise<VersionInfo[]> {
  return (await rowsOf(await open(), name)).map((r) => r.info);
}

export async function loadVersion(id: string): Promise<Uint8Array | undefined> {
  const row = await done(( await open()).transaction(STORE).objectStore(STORE).get(id) as IDBRequest<Row | undefined>);
  return row?.bytes;
}
