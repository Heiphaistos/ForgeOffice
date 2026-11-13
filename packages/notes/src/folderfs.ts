// Dossier ouvert avec acces en ecriture : interface minimale + adaptateur sur l'API « File System Access » (poignees de dossier).
import { MODULES, type DiskFolder } from '@forgeoffice/core';
import { decodeFile } from './logic/encoding.ts';
import { FOLDER_LIMITS, acceptFolderFile, type FolderFile } from './logic/folder.ts';
import { TRASH_DIR, baseName, joinRel, parentOf, uniqueName } from './logic/fileops.ts';

export interface FolderScan {
  files: FolderFile[];
  /** Tous les sous-dossiers (y compris vides). */
  dirs: string[];
  skipped: number;
}

/** Ce que l'espace de travail sait faire sur le disque du dossier ouvert. Les chemins sont relatifs, separes par « / ». */
export interface FolderFs {
  scan(): Promise<FolderScan>;
  /** Cree ou remplace un fichier. */
  write(rel: string, bytes: Uint8Array): Promise<void>;
  mkdir(rel: string): Promise<void>;
  /** Renomme ou deplace un fichier ou un dossier ; refuse d'ecraser. */
  rename(from: string, to: string): Promise<void>;
  /** Copie un fichier ou un dossier ; refuse d'ecraser. */
  copy(from: string, to: string): Promise<void>;
  /** Corbeille : renvoie le chemin dans la corbeille du dossier (`.trash`, navigateur), ou null si c'est la corbeille du systeme (bureau). */
  trash(rel: string): Promise<string | null>;
  exists(rel: string): Promise<boolean>;
}

// --- Poignees de la File System Access API (types minimaux : lib.dom ne les fournit pas partout) ---

export interface FileLike {
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}
export interface FileH {
  kind: 'file';
  name: string;
  getFile(): Promise<FileLike>;
  createWritable(): Promise<{ write(data: Uint8Array): Promise<void>; close(): Promise<void> }>;
}
export interface DirH {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<FileH | DirH>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileH>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirH>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
}

const parts = (rel: string): string[] => rel.split('/').filter(Boolean);

export function fsFromHandle(root: DirH): FolderFs {
  async function dirAt(rel: string, create = false): Promise<DirH> {
    let dir = root;
    for (const p of parts(rel)) dir = await dir.getDirectoryHandle(p, { create });
    return dir;
  }
  async function kindOf(rel: string): Promise<'file' | 'directory' | null> {
    const dir = await dirAt(parentOf(rel)).catch(() => null);
    if (!dir) return null;
    const name = baseName(rel);
    try {
      await dir.getFileHandle(name);
      return 'file';
    } catch {
      // pas un fichier
    }
    try {
      await dir.getDirectoryHandle(name);
      return 'directory';
    } catch {
      return null;
    }
  }
  async function readBytes(rel: string): Promise<Uint8Array> {
    const handle = await (await dirAt(parentOf(rel))).getFileHandle(baseName(rel));
    return new Uint8Array(await (await handle.getFile()).arrayBuffer());
  }
  async function writeBytes(rel: string, bytes: Uint8Array): Promise<void> {
    const handle = await (await dirAt(parentOf(rel), true)).getFileHandle(baseName(rel), { create: true });
    const w = await handle.createWritable();
    await w.write(bytes);
    await w.close();
  }
  async function copyEntry(from: string, to: string): Promise<void> {
    if ((await kindOf(to)) !== null) throw new Error(`« ${baseName(to)} » existe déjà.`);
    const kind = await kindOf(from);
    if (kind === 'file') return writeBytes(to, await readBytes(from));
    if (kind !== 'directory') throw new Error(`« ${baseName(from)} » est introuvable.`);
    await dirAt(to, true);
    const src = await dirAt(from);
    for await (const child of src.values()) await copyEntry(joinRel(from, child.name), joinRel(to, child.name));
  }
  async function removeEntry(rel: string): Promise<void> {
    await (await dirAt(parentOf(rel))).removeEntry(baseName(rel), { recursive: true });
  }

  async function scan(): Promise<FolderScan> {
    const out: FolderScan = { files: [], dirs: [], skipped: 0 };
    let total = 0;
    async function walk(dir: DirH, prefix: string): Promise<void> {
      for await (const entry of dir.values()) {
        const rel = joinRel(prefix, entry.name);
        if (entry.kind === 'directory') {
          if (entry.name === TRASH_DIR || entry.name === '.git' || entry.name === 'node_modules') continue;
          out.dirs.push(rel);
          await walk(entry, rel);
          continue;
        }
        const file = await entry.getFile();
        if (out.files.length >= FOLDER_LIMITS.maxFiles || total + file.size > FOLDER_LIMITS.maxTotalBytes || !acceptFolderFile(rel, file.size, MODULES.notes.extensions)) {
          out.skipped++;
          continue;
        }
        const decoded = decodeFile(new Uint8Array(await file.arrayBuffer()));
        if (decoded.binary) {
          out.skipped++;
          continue;
        }
        total += file.size;
        out.files.push({ rel, text: decoded.text, encoding: decoded.encoding, eol: decoded.eol });
      }
    }
    await walk(root, '');
    return out;
  }

  return {
    scan,
    write: writeBytes,
    mkdir: async (rel) => {
      if ((await kindOf(rel)) !== null) throw new Error(`« ${baseName(rel)} » existe déjà.`);
      await dirAt(rel, true);
    },
    copy: copyEntry,
    rename: async (from, to) => {
      if (from === to) return;
      await copyEntry(from, to);
      await removeEntry(from);
    },
    trash: async (rel) => {
      const taken = new Set<string>();
      for await (const e of (await dirAt(TRASH_DIR, true)).values()) taken.add(e.name);
      const target = joinRel(TRASH_DIR, uniqueName(baseName(rel), taken));
      await copyEntry(rel, target);
      await removeEntry(rel);
      return target;
    },
    exists: async (rel) => (await kindOf(rel)) !== null,
  };
}

/** Dossier du vrai disque (application de bureau) : lecture / ecriture directes, suppression vers la corbeille du systeme. */
export function fsFromDisk(disk: DiskFolder): FolderFs {
  return {
    async scan() {
      const out: FolderScan = { files: [], dirs: [], skipped: 0 };
      let total = 0;
      for (const entry of await disk.list()) {
        const parts = entry.rel.split('/');
        if (parts.some((p) => p === TRASH_DIR || p === '.git' || p === 'node_modules')) continue;
        if (entry.dir) {
          out.dirs.push(entry.rel);
          continue;
        }
        if (out.files.length >= FOLDER_LIMITS.maxFiles || total + entry.size > FOLDER_LIMITS.maxTotalBytes || !acceptFolderFile(entry.rel, entry.size, MODULES.notes.extensions)) {
          out.skipped++;
          continue;
        }
        const decoded = decodeFile(await disk.read(entry.rel));
        if (decoded.binary) {
          out.skipped++;
          continue;
        }
        total += entry.size;
        out.files.push({ rel: entry.rel, text: decoded.text, encoding: decoded.encoding, eol: decoded.eol });
      }
      return out;
    },
    write: (rel, bytes) => disk.write(rel, bytes),
    mkdir: (rel) => disk.mkdir(rel),
    rename: (from, to) => disk.rename(from, to),
    copy: (from, to) => disk.copy(from, to),
    trash: async (rel) => {
      await disk.trash(rel);
      return null;
    },
    exists: (rel) => disk.exists(rel),
  };
}
