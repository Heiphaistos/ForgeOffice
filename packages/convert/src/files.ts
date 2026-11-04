// Lecture des fichiers choisis ou deposes (dossiers parcourus recursivement). Code DOM.
import type { IncomingFile } from './queue.ts';

async function fromFile(file: File, relativePath?: string): Promise<IncomingFile> {
  return { name: file.name, relativePath: relativePath ?? (file.webkitRelativePath || file.name), bytes: new Uint8Array(await file.arrayBuffer()) };
}

export async function fromFileList(list: FileList | readonly File[]): Promise<IncomingFile[]> {
  const out: IncomingFile[] = [];
  for (const f of Array.from(list)) out.push(await fromFile(f));
  return out;
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

/** Parcourt une entree deposee (fichier ou dossier) ; profondeur et nombre bornes. */
async function walk(entry: FileSystemEntry, out: IncomingFile[], depth: number, max: number): Promise<void> {
  if (out.length >= max || depth > 16) return;
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    out.push(await fromFile(file, entry.fullPath.replace(/^\//, '')));
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries renvoie les entrees par paquets : on relit jusqu'a une reponse vide.
  for (let batch = await readEntries(reader); batch.length > 0; batch = await readEntries(reader)) {
    for (const child of batch) await walk(child, out, depth + 1, max);
  }
}

/** Fichiers d'un glisser-deposer, dossiers compris. */
export async function fromDataTransfer(data: DataTransfer, max: number): Promise<IncomingFile[]> {
  const entries = Array.from(data.items)
    .map((i) => (i.kind === 'file' ? i.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => e !== null);
  if (entries.length === 0) return fromFileList(data.files);
  const out: IncomingFile[] = [];
  for (const e of entries) await walk(e, out, 0, max + 1);
  return out;
}

/** Ouvre le selecteur de fichiers du systeme (plusieurs fichiers, ou un dossier entier). */
export function pickFiles(folder: boolean): Promise<FileList | null> {
  return new Promise((resolve) => {
    const el = document.createElement('input');
    el.type = 'file';
    el.multiple = true;
    el.webkitdirectory = folder;
    el.addEventListener('change', () => resolve(el.files), { once: true });
    el.addEventListener('cancel', () => resolve(null), { once: true });
    el.click();
  });
}
