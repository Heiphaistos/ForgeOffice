// Insertion d'un fichier texte dans une zone : lecture du texte brut de .txt / .md, .docx, .rtf, .odt (sans mise en page).
import { plainText, readDocx, readOdt, readRtf } from '@forgeoffice/docx';

export const TEXT_FILE_EXTENSIONS = ['txt', 'md', 'docx', 'rtf', 'odt'] as const;

const extensionOf = (name: string): string => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';

/** Texte brut d'un fichier (UTF-8, repli Windows-1252) ; les paragraphes sont separes par des sauts de ligne. */
export async function readTextFile(name: string, bytes: Uint8Array): Promise<string> {
  switch (extensionOf(name)) {
    case 'docx': return plainText((await readDocx(bytes)).document).trim();
    case 'rtf': return plainText(readRtf(bytes).document).trim();
    case 'odt': return plainText((await readOdt(bytes)).document).trim();
    case 'txt':
    case 'md': {
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        text = new TextDecoder('windows-1252').decode(bytes);
      }
      return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
    }
    default: throw new Error(`Format non pris en charge : ${name}`);
  }
}
