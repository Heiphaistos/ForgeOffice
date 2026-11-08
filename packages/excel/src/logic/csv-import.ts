// Import de texte/CSV : decodage selon l'encodage choisi, decoupe en lignes, detection du delimiteur.

export type TextEncoding = 'utf-8' | 'windows-1252' | 'iso-8859-1' | 'utf-16le';

export const ENCODINGS: readonly TextEncoding[] = ['utf-8', 'windows-1252', 'iso-8859-1', 'utf-16le'];

/** Decode des octets (BOM UTF-8 retire) puis decoupe en lignes ; les lignes finales vides sont ignorees, les vides internes gardees (null). */
export function decodeLines(bytes: Uint8Array, encoding: TextEncoding): (string | null)[] {
  const text = new TextDecoder(encoding).decode(bytes).replace(/^﻿/, '');
  const lines = text.split(/\r\n|\n|\r/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.map((l) => (l === '' ? null : l));
}

/** Premier delimiteur le plus frequent parmi tabulation, point-virgule et virgule dans les premieres lignes (virgule par defaut). */
export function detectDelimiter(lines: readonly (string | null)[]): string {
  const sample = lines.filter((l): l is string => l !== null).slice(0, 10).join('\n');
  const count = (ch: string): number => sample.split(ch).length - 1;
  const best = (['\t', ';', ','] as const).reduce((a, b) => (count(b) > count(a) ? b : a));
  return count(best) > 0 ? best : ',';
}

/** Detecte l'UTF-8 : renvoie 'utf-8' si les octets sont valides, sinon 'windows-1252'. */
export function detectEncoding(bytes: Uint8Array): TextEncoding {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return 'utf-8';
  } catch {
    return 'windows-1252';
  }
}
