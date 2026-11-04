// Actions qui touchent au navigateur : dossier, impression, ouverture dans le navigateur, conversion .docx.
import DOMPurify from 'dompurify';
import { MODULES, type Services } from '@forgeoffice/core';
import { readMarkdown, readText, writeDocx } from '@forgeoffice/docx';
import { decodeFile } from './logic/encoding.ts';
import { FOLDER_LIMITS, acceptFolderFile, type FolderFile } from './logic/folder.ts';
import { pageCss } from './logic/print.ts';
import { renderMarkdown } from './ui/Preview.tsx';
import type { Folder } from './workspace.ts';
import { S } from './strings.ts';

/** Choix d'un dossier (<input webkitdirectory>) : fichiers texte lus en memoire, limites appliquees. */
export function pickFolder(): Promise<{ folder: Folder; skipped: number } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.addEventListener(
      'change',
      () => {
        const list = [...(input.files ?? [])];
        if (list.length === 0) {
          resolve(null);
          return;
        }
        const root = (list[0]?.webkitRelativePath ?? '').split('/')[0] ?? '';
        readFolder(list).then((r) => resolve({ folder: { name: root, files: r.files }, skipped: r.skipped }), reject);
      },
      { once: true },
    );
    input.click();
  });
}

async function readFolder(list: readonly File[]): Promise<{ files: FolderFile[]; skipped: number }> {
  const files: FolderFile[] = [];
  let total = 0;
  let skipped = 0;
  for (const f of list) {
    const rel = f.webkitRelativePath.split('/').slice(1).join('/') || f.name;
    if (files.length >= FOLDER_LIMITS.maxFiles || total + f.size > FOLDER_LIMITS.maxTotalBytes || !acceptFolderFile(rel, f.size, MODULES.notes.extensions)) {
      skipped++;
      continue;
    }
    const decoded = decodeFile(new Uint8Array(await f.arrayBuffer()));
    if (decoded.binary) {
      skipped++;
      continue;
    }
    total += f.size;
    files.push({ rel, text: decoded.text });
  }
  return { files, skipped };
}

/** Imprime le texte seul : noir sur blanc, en-tete = nom du fichier, pied « Page n / N ». */
export function printText(name: string, text: string, font: string, print: () => void): void {
  for (const old of document.querySelectorAll('.nt-print-root, style[data-nt-print]')) old.remove();
  const root = document.createElement('div');
  root.className = 'nt-print-root';
  const pre = document.createElement('pre');
  pre.style.fontFamily = font;
  pre.textContent = text;
  root.append(pre);
  const style = document.createElement('style');
  style.dataset.ntPrint = '';
  style.textContent = pageCss(name, S.print.page, S.print.of);
  document.body.append(root);
  document.head.append(style);
  const cleanup = (): void => {
    root.remove();
    style.remove();
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  print();
}

/** Ouvre une copie nettoyee (sans script) du document dans un nouvel onglet du navigateur. */
export function openInBrowser(name: string, text: string, language: string): boolean {
  let blob: Blob;
  if (language === 'Markdown') {
    const holder = document.createElement('div');
    holder.append(renderMarkdown(text));
    blob = new Blob([`<!doctype html><meta charset="utf-8"><title>${name.replace(/[<&]/g, '')}</title><body style="font-family:system-ui;max-width:48rem;margin:2rem auto">${holder.innerHTML}`], { type: 'text/html' });
  } else if (language === 'HTML') {
    blob = new Blob([DOMPurify.sanitize(text, { WHOLE_DOCUMENT: true })], { type: 'text/html' });
  } else blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return win !== null;
}

/** Note (Markdown ou texte) -> document Texte (.docx) ouvert dans l'application Texte. */
export async function convertToDocx(services: Services, name: string, text: string, language: string): Promise<string> {
  const doc = language === 'Markdown' ? readMarkdown(text).document : readText(new TextEncoder().encode(text)).document;
  const bytes = await writeDocx(doc);
  const base = name.replace(/\.[^./\\]+$/, '') || S.untitled;
  const fileName = `${base}.docx`;
  await services.openDocument({ name: fileName, path: null, bytes });
  return fileName;
}
