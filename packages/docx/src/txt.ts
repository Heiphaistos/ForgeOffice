// Texte brut : detection d'encodage (BOM, UTF-8 valide, UTF-16 sans BOM, Windows-1252) et ecriture.
import type { Block, ReadResult, WordDocument } from './model.ts';
import { createBlankDocument } from './blank.ts';
import { DocxError } from './docx/reader.ts';
import { computeListLabels } from './resolve.ts';
import { DEFAULT_READ_LIMITS, Warnings, type ReadLimits } from './security.ts';
import { ERRORS } from './strings.ts';
import { blocksText, inlinesText } from './text.ts';

export type TextEncoding = 'utf-8' | 'utf-8-bom' | 'utf-16le' | 'utf-16be' | 'windows-1252';

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/** Devine l'encodage d'un texte. */
export function detectEncoding(bytes: Uint8Array): TextEncoding {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8-bom';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  // UTF-16 sans BOM : beaucoup d'octets nuls en position paire ou impaire.
  const sample = bytes.subarray(0, 4096);
  let evenZeros = 0;
  let oddZeros = 0;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      if (i % 2 === 0) evenZeros++;
      else oddZeros++;
    }
  }
  const half = sample.length / 2;
  if (half > 0 && oddZeros / half > 0.3 && evenZeros / half < 0.05) return 'utf-16le';
  if (half > 0 && evenZeros / half > 0.3 && oddZeros / half < 0.05) return 'utf-16be';
  return isValidUtf8(bytes) ? 'utf-8' : 'windows-1252';
}

/** Decode un texte selon l'encodage detecte (ou impose). BOM retire. */
export function decodeText(bytes: Uint8Array, encoding: TextEncoding = detectEncoding(bytes)): string {
  switch (encoding) {
    case 'utf-8-bom': return new TextDecoder('utf-8').decode(bytes.subarray(3));
    case 'utf-8': return new TextDecoder('utf-8').decode(bytes);
    case 'utf-16le': return new TextDecoder('utf-16le').decode(bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.subarray(2) : bytes);
    case 'utf-16be': {
      const start = bytes[0] === 0xfe && bytes[1] === 0xff ? 2 : 0;
      const swapped = new Uint8Array(bytes.length - start);
      for (let i = start; i + 1 < bytes.length; i += 2) {
        swapped[i - start] = bytes[i + 1] ?? 0;
        swapped[i - start + 1] = bytes[i] ?? 0;
      }
      return new TextDecoder('utf-16le').decode(swapped);
    }
    case 'windows-1252': return new TextDecoder('windows-1252').decode(bytes);
  }
}

let cp1252: Map<number, number> | undefined;

function encode1252(text: string): Uint8Array {
  if (!cp1252) {
    cp1252 = new Map();
    const decoder = new TextDecoder('windows-1252');
    for (let b = 0; b <= 0xff; b++) cp1252.set(decoder.decode(new Uint8Array([b])).charCodeAt(0), b);
  }
  const out: number[] = [];
  for (const ch of text) out.push(cp1252.get(ch.codePointAt(0) ?? 0x3f) ?? 0x3f);
  return new Uint8Array(out);
}

/** Encode un texte ; les caracteres absents de Windows-1252 deviennent « ? ». */
export function encodeText(text: string, encoding: TextEncoding = 'utf-8'): Uint8Array {
  switch (encoding) {
    case 'utf-8': return new TextEncoder().encode(text);
    case 'utf-8-bom': {
      const body = new TextEncoder().encode(text);
      const out = new Uint8Array(body.length + 3);
      out.set([0xef, 0xbb, 0xbf]);
      out.set(body, 3);
      return out;
    }
    case 'utf-16le':
    case 'utf-16be': {
      const out = new Uint8Array(2 + text.length * 2);
      const le = encoding === 'utf-16le';
      out.set(le ? [0xff, 0xfe] : [0xfe, 0xff]);
      for (let i = 0; i < text.length; i++) {
        const unit = text.charCodeAt(i);
        out[2 + i * 2] = le ? unit & 0xff : unit >> 8;
        out[3 + i * 2] = le ? unit >> 8 : unit & 0xff;
      }
      return out;
    }
    case 'windows-1252': return encode1252(text);
  }
}

export interface ReadTextOptions {
  encoding?: TextEncoding;
  limits?: Partial<ReadLimits>;
}

/** Lit un texte brut : une ligne = un paragraphe, les sauts de page (\f) sont conserves. */
export function readText(bytes: Uint8Array, options: ReadTextOptions = {}): ReadResult & { encoding: TextEncoding } {
  const limits: ReadLimits = { ...DEFAULT_READ_LIMITS, ...options.limits };
  if (bytes.length > limits.maxInputBytes) throw new DocxError(ERRORS.tooLarge);
  const encoding = options.encoding ?? detectEncoding(bytes);
  const text = decodeText(bytes, encoding);
  const doc = createBlankDocument();
  const warnings = new Warnings();
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const blocks: Block[] = [];
  for (const line of lines.slice(0, limits.maxBlocks)) {
    // Saut de page (\f) et tabulation restent dans le paragraphe, comme les ecrit writeText.
    const paragraph: Block = { type: 'paragraph', props: {}, inlines: [] };
    for (const part of line.split(/([\f\t])/)) {
      if (part === '\f') paragraph.inlines.push({ type: 'break', kind: 'page' });
      else if (part === '\t') paragraph.inlines.push({ type: 'tab' });
      else if (part) paragraph.inlines.push({ type: 'text', text: part, props: {} });
    }
    blocks.push(paragraph);
  }
  if (lines.length > limits.maxBlocks) warnings.add('too-many-blocks', 'Document trop volumineux : contenu tronqué.');
  doc.body = blocks.length ? blocks : [{ type: 'paragraph', props: {}, inlines: [] }];
  return { document: doc, warnings: warnings.list, encoding };
}

export interface WriteTextOptions {
  encoding?: TextEncoding;
  /** Fin de ligne (defaut : CRLF, comme le Bloc-notes et Word). */
  newline?: '\r\n' | '\n';
  /** Prefixer les paragraphes de liste par leur numero ou puce (defaut : vrai). */
  listLabels?: boolean;
}

/** Texte brut du document, listes numerotees comprises. */
export function documentToText(doc: WordDocument, options: WriteTextOptions = {}): string {
  const labels = options.listLabels === false ? new Map() : computeListLabels(doc);
  const lines: string[] = [];
  const visit = (blocks: readonly Block[]): void => {
    for (const block of blocks) {
      if (block.type === 'paragraph') {
        const label = labels.get(block);
        lines.push(`${label ? `${label}\t` : ''}${inlinesText(block.inlines)}`);
      } else if (block.type === 'table') {
        lines.push(blocksText([block]));
      } else if (block.type === 'contentControl' || block.type === 'toc') {
        visit(block.blocks);
      }
    }
  };
  visit(doc.body);
  const notes = doc.footnotes.filter((n) => !n.special);
  if (notes.length) {
    lines.push('', '__________');
    for (const note of notes) lines.push(`[${note.id}] ${blocksText(note.blocks).replace(/\n/g, ' ')}`);
  }
  const newline = options.newline ?? '\r\n';
  return lines.join('\n').replace(/\n/g, newline);
}

export function writeText(doc: WordDocument, options: WriteTextOptions = {}): Uint8Array {
  return encodeText(documentToText(doc, options), options.encoding ?? 'utf-8');
}
