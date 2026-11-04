// Fichiers texte : encodage (detection reprise de @forgeoffice/docx) et fins de ligne.
import { decodeText, detectEncoding, encodeText, type TextEncoding } from '@forgeoffice/docx';

export type { TextEncoding };
export type Eol = 'crlf' | 'lf' | 'cr';

export const ENCODINGS: readonly TextEncoding[] = ['utf-8', 'utf-8-bom', 'utf-16le', 'utf-16be', 'windows-1252'];
export const EOLS: readonly Eol[] = ['crlf', 'lf', 'cr'];
const EOL_TEXT: Readonly<Record<Eol, string>> = { crlf: '\r\n', lf: '\n', cr: '\r' };

/** Taille maximale d'un fichier ouvert (au-dela, l'editeur deviendrait inutilisable). */
export const MAX_FILE_BYTES = 64 * 1024 * 1024;

export function isEncoding(value: unknown): value is TextEncoding {
  return typeof value === 'string' && (ENCODINGS as readonly string[]).includes(value);
}

export function isEol(value: unknown): value is Eol {
  return value === 'crlf' || value === 'lf' || value === 'cr';
}

/** Fin de ligne majoritaire du texte ; CRLF (Windows) si aucune. */
export function detectEol(text: string): Eol {
  let crlf = 0;
  let lf = 0;
  let cr = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 13) {
      if (text.charCodeAt(i + 1) === 10) {
        crlf++;
        i++;
      } else cr++;
    } else if (c === 10) lf++;
  }
  if (crlf === 0 && lf === 0 && cr === 0) return 'crlf';
  if (crlf >= lf && crlf >= cr) return 'crlf';
  return lf >= cr ? 'lf' : 'cr';
}

/** Toutes les fins de ligne deviennent `\n` (forme interne de l'editeur). */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/** Texte interne (`\n`) vers la fin de ligne choisie. */
export function applyEol(text: string, eol: Eol): string {
  return eol === 'lf' ? text : text.replace(/\n/g, EOL_TEXT[eol]);
}

/** Vrai si le debut du fichier ressemble a du binaire (octets nuls hors UTF-16). */
export function looksBinary(bytes: Uint8Array, encoding: TextEncoding): boolean {
  if (encoding === 'utf-16le' || encoding === 'utf-16be') return false;
  const end = Math.min(bytes.length, 8192);
  for (let i = 0; i < end; i++) if (bytes[i] === 0) return true;
  return false;
}

export interface DecodedFile {
  text: string;
  encoding: TextEncoding;
  eol: Eol;
  binary: boolean;
}

export function decodeFile(bytes: Uint8Array, forced?: TextEncoding): DecodedFile {
  const encoding = forced ?? detectEncoding(bytes);
  const raw = decodeText(bytes, encoding);
  return { text: normalizeEol(raw), encoding, eol: detectEol(raw), binary: looksBinary(bytes, encoding) };
}

export function encodeFile(text: string, encoding: TextEncoding, eol: Eol): Uint8Array {
  return encodeText(applyEol(normalizeEol(text), eol), encoding);
}

/** Vrai si l'encodage peut representer tout le texte (Windows-1252 perd les autres caracteres). */
export function canEncode(text: string, encoding: TextEncoding): boolean {
  if (encoding !== 'windows-1252') return true;
  return decodeText(encodeText(text, encoding), encoding) === text;
}
