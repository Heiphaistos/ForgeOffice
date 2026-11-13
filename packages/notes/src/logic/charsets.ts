// Encodages supplementaires de WinNote (19 au total) : decodage par TextDecoder, encodage par table inverse construite a la demande.
import { decodeText, encodeText, type TextEncoding as BaseEncoding } from '@forgeoffice/docx';

/** Encodages Unicode et ANSI geres par @forgeoffice/docx. */
export type BaseTextEncoding = BaseEncoding;
export type ExtraEncoding =
  | 'windows-1250' | 'windows-1251' | 'windows-1253' | 'windows-1254' | 'windows-1255' | 'windows-1256' | 'windows-1257' | 'windows-1258'
  | 'iso-8859-15' | 'koi8-r' | 'shift_jis' | 'gbk' | 'big5' | 'euc-kr';
export type NotesEncoding = BaseTextEncoding | ExtraEncoding;

/** Les 5 usuels d'abord, puis « Autres encodages » (meme ordre que WinNote). */
export const BASE_ENCODINGS: readonly BaseTextEncoding[] = ['utf-8', 'utf-8-bom', 'utf-16le', 'utf-16be', 'windows-1252'];
export const EXTRA_ENCODINGS: readonly ExtraEncoding[] = [
  'windows-1250', 'windows-1251', 'windows-1253', 'windows-1254', 'windows-1255', 'windows-1256', 'windows-1257', 'windows-1258', 'iso-8859-15', 'koi8-r',
  'shift_jis', 'gbk', 'big5', 'euc-kr',
];
export const ALL_ENCODINGS: readonly NotesEncoding[] = [...BASE_ENCODINGS, ...EXTRA_ENCODINGS];

const MULTIBYTE: ReadonlySet<string> = new Set(['shift_jis', 'gbk', 'big5', 'euc-kr']);

export const isExtra = (e: NotesEncoding): e is ExtraEncoding => (EXTRA_ENCODINGS as readonly string[]).includes(e);

const tables = new Map<ExtraEncoding, Map<number, number[]>>();

/** Table caractere -> octets, obtenue en decodant toutes les sequences d'un ou deux octets (le premier gagnant reste). */
function tableFor(enc: ExtraEncoding): Map<number, number[]> {
  const known = tables.get(enc);
  if (known) return known;
  const dec = new TextDecoder(enc);
  const map = new Map<number, number[]>();
  const add = (bytes: number[]): void => {
    const s = dec.decode(new Uint8Array(bytes));
    const cp = s.codePointAt(0);
    if (cp === undefined || cp === 0xfffd || s.length !== (cp > 0xffff ? 2 : 1) || map.has(cp)) return;
    map.set(cp, bytes);
  };
  for (let b = 0; b <= 0xff; b++) add([b]);
  if (MULTIBYTE.has(enc)) for (let lead = 0x81; lead <= 0xfe; lead++) for (let trail = 0x40; trail <= 0xfe; trail++) add([lead, trail]);
  tables.set(enc, map);
  return map;
}

export function decodeAny(bytes: Uint8Array, enc: NotesEncoding): string {
  if (isExtra(enc)) return new TextDecoder(enc).decode(bytes);
  // Sans BOM, « UTF-8 avec BOM » ne doit pas manger 3 octets de texte.
  if (enc === 'utf-8-bom' && !(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) return decodeText(bytes, 'utf-8');
  return decodeText(bytes, enc);
}

/** Les caracteres absents de l'encodage deviennent « ? ». */
export function encodeAny(text: string, enc: NotesEncoding): Uint8Array {
  if (!isExtra(enc)) return encodeText(text, enc);
  const map = tableFor(enc);
  const out: number[] = [];
  for (const ch of text) out.push(...(map.get(ch.codePointAt(0) ?? 0x3f) ?? [0x3f]));
  return new Uint8Array(out);
}

/** Vrai si l'enregistrement ne perd aucun caractere. */
export function losslessIn(text: string, enc: NotesEncoding): boolean {
  if (enc === 'utf-8' || enc === 'utf-8-bom' || enc === 'utf-16le' || enc === 'utf-16be') return true;
  return decodeAny(encodeAny(text, enc), enc) === text;
}
