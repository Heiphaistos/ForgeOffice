// Point d'entree unique : detection du format d'un fichier Texte, lecture et ecriture par format.
import type { PackageLimits } from '@forgeoffice/opc';
import type { ReadResult, WordDocument } from './model.ts';
import { readDoc } from './doc/read-doc.ts';
import { isCfb } from './doc/cfb.ts';
import { DocxError, looksLikeZip, readDocx } from './docx/reader.ts';
import { writeDocx } from './docx/writer.ts';
import { readHtml } from './html/read-html.ts';
import { writeHtml } from './html/write-html.ts';
import { readMarkdown } from './md/read-md.ts';
import { writeMarkdown } from './md/write-md.ts';
import { readOdt } from './odt/read-odt.ts';
import { writeOdt } from './odt/write-odt.ts';
import { readRtf } from './rtf/read-rtf.ts';
import { writeRtf } from './rtf/write-rtf.ts';
import { DEFAULT_READ_LIMITS, type ReadLimits } from './security.ts';
import { ERRORS } from './strings.ts';
import { readText, writeText, type TextEncoding } from './txt.ts';

export type DocumentFormat = 'docx' | 'docm' | 'dotx' | 'dotm' | 'doc' | 'rtf' | 'odt' | 'html' | 'md' | 'txt';

/** Formats que ForgeOffice sait ecrire (le .doc est en lecture seule). */
export type WritableFormat = Exclude<DocumentFormat, 'doc'>;

const EXTENSIONS: Readonly<Record<string, DocumentFormat>> = {
  docx: 'docx', docm: 'docm', dotx: 'dotx', dotm: 'dotm', doc: 'doc', dot: 'doc', rtf: 'rtf', odt: 'odt', ott: 'odt',
  html: 'html', htm: 'html', xhtml: 'html', md: 'md', markdown: 'md', txt: 'txt', text: 'txt',
};

const ascii = (bytes: Uint8Array, start: number, end: number): string => String.fromCharCode(...bytes.subarray(start, end));

/** Format d'apres le contenu (signature) puis l'extension du nom de fichier. */
export function detectFormat(bytes: Uint8Array, fileName = ''): DocumentFormat {
  const ext = EXTENSIONS[fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()];
  if (looksLikeZip(bytes)) {
    // OpenDocument : premiere entree « mimetype » stockee sans compression.
    if (ascii(bytes, 30, 38) === 'mimetype' && ascii(bytes, 38, 80).startsWith('application/vnd.oasis.opendocument.text')) return 'odt';
    return ext === 'docm' || ext === 'dotx' || ext === 'dotm' || ext === 'odt' ? ext : 'docx';
  }
  if (isCfb(bytes)) return 'doc';
  const head = new TextDecoder('utf-8').decode(bytes.subarray(0, 512)).replace(/^﻿/, '').trimStart();
  if (head.startsWith('{\\rtf')) return 'rtf';
  if (ext === 'md' || ext === 'html' || ext === 'txt') return ext;
  if (/^(<!doctype html|<html[\s>])/i.test(head)) return 'html';
  return 'txt';
}

export interface ReadDocumentOptions {
  limits?: Partial<ReadLimits>;
  packageLimits?: Partial<PackageLimits>;
  /** Impose le format au lieu de le detecter. */
  format?: DocumentFormat;
  /** Encodage d'un .txt (defaut : detecte). */
  encoding?: TextEncoding;
}

/** Lit un fichier Texte de n'importe quel format pris en charge. Leve DocxError si illisible. */
export async function readDocument(bytes: Uint8Array, fileName = '', options: ReadDocumentOptions = {}): Promise<ReadResult & { format: DocumentFormat }> {
  const limits: ReadLimits = { ...DEFAULT_READ_LIMITS, ...options.limits };
  if (bytes.length > limits.maxInputBytes) throw new DocxError(ERRORS.tooLarge);
  const format = options.format ?? detectFormat(bytes, fileName);
  const common = { limits, packageLimits: options.packageLimits };
  let result: ReadResult;
  switch (format) {
    case 'docx': case 'docm': case 'dotx': case 'dotm': result = await readDocx(bytes, common); break;
    case 'doc': result = readDoc(bytes, common); break;
    case 'rtf': result = readRtf(bytes, common); break;
    case 'odt': result = await readOdt(bytes, common); break;
    case 'html': result = readHtml(bytes, common); break;
    case 'md': result = readMarkdown(bytes, common); break;
    case 'txt': result = readText(bytes, options.encoding ? { ...common, encoding: options.encoding } : common); break;
  }
  return { ...result, format };
}

/** Ecrit le document dans le format demande. */
export async function writeDocument(doc: WordDocument, format: WritableFormat, options: { encoding?: TextEncoding } = {}): Promise<Uint8Array> {
  switch (format) {
    case 'docx': case 'docm': case 'dotx': case 'dotm': return writeDocx(doc, { kind: format });
    case 'rtf': return writeRtf(doc);
    case 'odt': return writeOdt(doc);
    case 'html': return writeHtml(doc);
    case 'md': return writeMarkdown(doc);
    case 'txt': return writeText(doc, options);
    default: throw new DocxError(ERRORS.unknownFormat(String(format)));
  }
}
