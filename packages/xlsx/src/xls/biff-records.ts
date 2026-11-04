// Enregistrements BIFF8 : decoupage du flux « Workbook », lecture des chaines Unicode (y compris a cheval
// sur des enregistrements CONTINUE), table des chaines partagees (SST), polices et formats de cellule (XF).
import type { Alignment, Border, BorderStyle, Color, Font, HorizontalAlignment, PatternType, Protection, RichRun, VerticalAlignment } from '../model.ts';
import type { StyleSpec } from '../workbook.ts';

export const CONTINUE = 0x003c;

export interface BiffRecord {
  type: number;
  /** Position de l'en-tete dans le flux (BOUNDSHEET8 pointe sur ces positions). */
  offset: number;
  data: Uint8Array;
  /** Enregistrements CONTINUE qui suivent. */
  continues: Uint8Array[];
}

/** Decoupe le flux en enregistrements ; un en-tete tronque arrete la lecture. */
export function splitRecords(stream: Uint8Array): BiffRecord[] {
  const out: BiffRecord[] = [];
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  let p = 0;
  while (p + 4 <= stream.length) {
    const type = view.getUint16(p, true);
    const length = view.getUint16(p + 2, true);
    const data = stream.subarray(p + 4, Math.min(p + 4 + length, stream.length));
    const previous = out[out.length - 1];
    if (type === CONTINUE && previous) previous.continues.push(data);
    else out.push({ type, offset: p, data, continues: [] });
    p += 4 + length;
  }
  return out;
}

export function viewOf(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

/** Lecteur sequentiel sur un enregistrement et ses CONTINUE (les chaines y reprennent avec un octet d'options). */
export class ChunkReader {
  private readonly chunks: Uint8Array[];
  private index = 0;
  private pos = 0;

  constructor(record: BiffRecord, start = 0) {
    this.chunks = [record.data, ...record.continues];
    this.pos = start;
  }

  private current(): Uint8Array {
    let chunk = this.chunks[this.index];
    while (chunk && this.pos >= chunk.length && this.index < this.chunks.length - 1) {
      this.index++;
      this.pos = 0;
      chunk = this.chunks[this.index];
    }
    if (!chunk || this.pos >= chunk.length) throw new RangeError('fin de l’enregistrement');
    return chunk;
  }

  u8(): number {
    const chunk = this.current();
    return chunk[this.pos++] ?? 0;
  }

  u16(): number {
    return this.u8() | (this.u8() << 8);
  }

  u32(): number {
    return (this.u16() | (this.u16() << 16)) >>> 0;
  }

  skip(count: number): void {
    for (let left = count; left > 0;) {
      const chunk = this.current();
      const step = Math.min(left, chunk.length - this.pos);
      this.pos += step;
      left -= step;
    }
  }

  /** Caracteres d'une chaine : a chaque nouvel enregistrement CONTINUE, un octet redonne la largeur. */
  chars(count: number, wide: boolean): string {
    const parts: string[] = [];
    let isWide = wide;
    for (let i = 0; i < count; i++) {
      const chunk = this.chunks[this.index];
      if (chunk && this.pos >= chunk.length && this.index < this.chunks.length - 1) {
        this.index++;
        this.pos = 0;
        isWide = (this.u8() & 1) !== 0;
      }
      parts.push(String.fromCharCode(isWide ? this.u16() : this.u8()));
    }
    return parts.join('');
  }
}

export interface BiffString {
  text: string;
  /** Debuts de mise en forme : [position du caractere, index de police]. */
  runs: [number, number][];
}

/** XLUnicodeRichExtendedString (SST) ou XLUnicodeString selon `rich`. */
export function readUnicodeString(reader: ChunkReader, cchSize: 1 | 2, rich = true): BiffString {
  const cch = cchSize === 1 ? reader.u8() : reader.u16();
  const flags = reader.u8();
  const runCount = rich && flags & 0x08 ? reader.u16() : 0;
  const extSize = rich && flags & 0x04 ? reader.u32() : 0;
  const text = reader.chars(cch, (flags & 1) !== 0);
  const runs: [number, number][] = [];
  for (let i = 0; i < runCount; i++) runs.push([reader.u16(), reader.u16()]);
  reader.skip(extSize);
  return { text, runs };
}

/** Chaine simple d'un enregistrement (sans CONTINUE) a partir de `offset`. */
export function stringAt(data: Uint8Array, offset: number, cchSize: 1 | 2): string {
  if (offset + cchSize >= data.length) return '';
  return readUnicodeString(new ChunkReader({ type: 0, offset: 0, data, continues: [] }, offset), cchSize, false).text;
}

export function readSst(record: BiffRecord, limit: number): BiffString[] {
  const reader = new ChunkReader(record);
  reader.u32();
  const unique = Math.min(reader.u32(), limit);
  const out: BiffString[] = [];
  for (let i = 0; i < unique; i++) {
    try {
      out.push(readUnicodeString(reader, 2));
    } catch (error) {
      if (error instanceof RangeError) break;
      throw error;
    }
  }
  return out;
}

// ---------------------------------------------------------------- Couleurs, polices, XF

export interface Palette {
  /** Couleurs 8..63 personnalisees (enregistrement PALETTE), « RRGGBB ». */
  custom?: string[];
}

export function paletteColor(palette: Palette, icv: number): Color | undefined {
  if (icv >= 64) return undefined;
  const custom = icv >= 8 ? palette.custom?.[icv - 8] : undefined;
  return custom ? { rgb: `FF${custom}` } : { indexed: icv };
}

export function readPalette(data: Uint8Array): Palette {
  const view = viewOf(data);
  const count = Math.min(view.getUint16(0, true), Math.floor((data.length - 2) / 4));
  const custom: string[] = [];
  for (let i = 0; i < count; i++) {
    const p = 2 + i * 4;
    custom.push([data[p], data[p + 1], data[p + 2]].map((b) => (b ?? 0).toString(16).padStart(2, '0')).join('').toUpperCase());
  }
  return { custom };
}

const UNDERLINE: Readonly<Record<number, Font['underline']>> = { 1: 'single', 2: 'double', 0x21: 'singleAccounting', 0x22: 'doubleAccounting' };

export function readFontRecord(data: Uint8Array, palette: Palette): Font {
  const view = viewOf(data);
  const flags = view.getUint16(2, true);
  const font: Font = { name: stringAt(data, 14, 1) || 'Arial', size: view.getUint16(0, true) / 20 };
  if (view.getUint16(6, true) >= 700) font.bold = true;
  if (flags & 0x02) font.italic = true;
  if (flags & 0x08) font.strike = true;
  if (flags & 0x10) font.outline = true;
  if (flags & 0x20) font.shadow = true;
  const script = view.getUint16(8, true);
  if (script === 1) font.vertAlign = 'superscript';
  if (script === 2) font.vertAlign = 'subscript';
  const underline = UNDERLINE[data[10] ?? 0];
  if (underline) font.underline = underline;
  const family = data[11] ?? 0;
  if (family) font.family = family;
  const charset = data[12] ?? 0;
  if (charset) font.charset = charset;
  const color = paletteColor(palette, view.getUint16(4, true));
  if (color) font.color = color;
  return font;
}

/** Index de police d'un XF : l'index 4 n'existe pas en BIFF. */
export function fontAt(fonts: Font[], ifnt: number): Font | undefined {
  return fonts[ifnt >= 4 ? ifnt - 1 : ifnt];
}

const BORDER_STYLES: readonly (BorderStyle | undefined)[] = [
  undefined, 'thin', 'medium', 'dashed', 'dotted', 'thick', 'double', 'hair', 'mediumDashed', 'dashDot',
  'mediumDashDot', 'dashDotDot', 'mediumDashDotDot', 'slantDashDot',
];
const PATTERNS: readonly PatternType[] = [
  'none', 'solid', 'mediumGray', 'darkGray', 'lightGray', 'darkHorizontal', 'darkVertical', 'darkDown', 'darkUp',
  'darkGrid', 'darkTrellis', 'lightHorizontal', 'lightVertical', 'lightDown', 'lightUp', 'lightGrid', 'lightTrellis',
  'gray125', 'gray0625',
];
const HALIGN: readonly (HorizontalAlignment | undefined)[] = [
  undefined, 'left', 'center', 'right', 'fill', 'justify', 'centerContinuous', 'distributed',
];
const VALIGN: readonly VerticalAlignment[] = ['top', 'center', 'bottom', 'justify', 'distributed'];

export interface RawXf {
  ifnt: number;
  ifmt: number;
  spec: Omit<StyleSpec, 'font' | 'numberFormat'>;
}

export function readXfRecord(data: Uint8Array, palette: Palette): RawXf {
  const view = viewOf(data);
  const flags = view.getUint16(4, true);
  const spec: RawXf['spec'] = {};
  const protection: Protection = {};
  if (!(flags & 1)) protection.locked = false;
  if (flags & 2) protection.hidden = true;
  if (Object.keys(protection).length) spec.protection = protection;

  const align = data[6] ?? 0;
  const alignment: Alignment = {};
  const h = HALIGN[align & 7];
  if (h) alignment.horizontal = h;
  if (align & 8) alignment.wrapText = true;
  const v = VALIGN[(align >> 4) & 7] ?? 'bottom';
  if (v !== 'bottom') alignment.vertical = v;
  const rotation = data[7] ?? 0;
  if (rotation) alignment.textRotation = rotation;
  const indentByte = data[8] ?? 0;
  if (indentByte & 0x0f) alignment.indent = indentByte & 0x0f;
  if (indentByte & 0x10) alignment.shrinkToFit = true;
  const order = (indentByte >> 6) & 3;
  if (order) alignment.readingOrder = order;
  if (Object.keys(alignment).length) spec.alignment = alignment;

  const lines = view.getUint32(10, true);
  const colors = view.getUint32(14, true);
  const border: Border = {};
  const edge = (style: number, icv: number): Border['left'] => {
    const name = BORDER_STYLES[style];
    if (!name) return undefined;
    const color = paletteColor(palette, icv);
    return color ? { style: name, color } : { style: name };
  };
  const left = edge(lines & 0xf, (lines >> 16) & 0x7f);
  const right = edge((lines >> 4) & 0xf, (lines >> 23) & 0x7f);
  const top = edge((lines >> 8) & 0xf, colors & 0x7f);
  const bottom = edge((lines >> 12) & 0xf, (colors >> 7) & 0x7f);
  const diagonal = edge((colors >> 21) & 0xf, (colors >> 14) & 0x7f);
  if (left) border.left = left;
  if (right) border.right = right;
  if (top) border.top = top;
  if (bottom) border.bottom = bottom;
  if (diagonal) {
    border.diagonal = diagonal;
    if (lines & 0x40000000) border.diagonalDown = true;
    if (lines & 0x80000000) border.diagonalUp = true;
  }
  if (Object.keys(border).length) spec.border = border;

  const pattern = PATTERNS[(colors >>> 26) & 0x3f] ?? 'none';
  if (pattern !== 'none') {
    const fillColors = view.getUint16(18, true);
    const fg = paletteColor(palette, fillColors & 0x7f);
    const bg = paletteColor(palette, (fillColors >> 7) & 0x7f);
    spec.fill = { type: 'pattern', pattern, ...(fg ? { fg } : {}), ...(bg ? { bg } : {}) };
  }
  return { ifnt: view.getUint16(0, true), ifmt: view.getUint16(2, true), spec };
}

/** Texte enrichi d'une chaine partagee : runs avec la police differente de la police de la cellule. */
export function richRuns(s: BiffString, fonts: Font[]): RichRun[] | undefined {
  if (s.runs.length === 0) return undefined;
  const out: RichRun[] = [];
  // Avant le premier run : police de la cellule (run sans police).
  const first = s.runs[0]?.[0] ?? 0;
  if (first > 0) out.push({ text: s.text.slice(0, first) });
  s.runs.forEach(([at, ifnt], i) => {
    const end = s.runs[i + 1]?.[0] ?? s.text.length;
    const text = s.text.slice(at, end);
    if (!text) return;
    const font = fontAt(fonts, ifnt);
    out.push(font ? { text, font: { ...font } } : { text });
  });
  return out.length > 1 ? out : undefined;
}
