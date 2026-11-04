// Structures binaires Word 97-2003 (MS-DOC) : FIB, table des pieces, FKP CHPX / PAPX, sprm, feuille de styles,
// table des polices, proprietes SummaryInformation. Toute lecture est bornee (fichier hostile).
import type {
  Alignment, DocumentProperties, HighlightColor, ParagraphProps, RunProps, UnderlineType,
} from '../model.ts';
import { LCID_TO_LANG } from '../rtf/header.ts';
import { twipsToPt } from '../units.ts';

export const u8 = (b: Uint8Array, o: number): number => b[o] ?? 0;
export const u16 = (b: Uint8Array, o: number): number => u8(b, o) | (u8(b, o + 1) << 8);
export const u32 = (b: Uint8Array, o: number): number => (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0;
const i16 = (b: Uint8Array, o: number): number => (u16(b, o) << 16) >> 16;

/** Chaine UTF-16LE de `count` unites (arretee au premier NUL si `zero`). */
function utf16(b: Uint8Array, offset: number, count: number, zero = false): string {
  let out = '';
  for (let i = 0; i < count && offset + i * 2 + 1 < b.length; i++) {
    const c = u16(b, offset + i * 2);
    if (zero && c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

const CP1252 = (() => {
  const all = new Uint8Array(256).map((_, i) => i);
  return new TextDecoder('windows-1252').decode(all);
})();

export interface Fib {
  nFib: number;
  encrypted: boolean;
  tableStream: '0Table' | '1Table';
  ccpText: number;
  ccpFtn: number;
  ccpHdd: number;
  ccpAtn: number;
  ccpEdn: number;
  /** Debut / fin du texte dans le flux WordDocument (anciens formats sans table des pieces). */
  fcMin: number;
  fcMac: number;
  /** Paire (fc, lcb) n° `index` de FibRgFcLcb (0 si absente). */
  fcLcb(index: number): { fc: number; lcb: number };
}

/** Index des paires FibRgFcLcb97 utilisees. */
export const FC = {
  stshf: 1, plcffndRef: 2, plcffndTxt: 3, plcfBteChpx: 12, plcfBtePapx: 13, sttbfFfn: 15, clx: 33, plcfendRef: 46,
  plcfendTxt: 47,
} as const;

export function readFib(word: Uint8Array): Fib | undefined {
  if (word.length < 68 || u16(word, 0) !== 0xa5ec) return undefined;
  const flags = u16(word, 0x0a);
  const csw = u16(word, 32);
  const lw = 34 + csw * 2 + 2;
  const cslw = u16(word, lw - 2);
  const rg = lw + cslw * 4 + 2;
  const count = u16(word, rg - 2);
  const lwAt = (i: number): number => (i < cslw ? u32(word, lw + i * 4) : 0);
  return {
    nFib: u16(word, 2),
    encrypted: (flags & 0x0100) !== 0,
    tableStream: (flags & 0x0200) !== 0 ? '1Table' : '0Table',
    ccpText: lwAt(3), ccpFtn: lwAt(4), ccpHdd: lwAt(5), ccpAtn: lwAt(7), ccpEdn: lwAt(8),
    fcMin: u32(word, 0x18), fcMac: u32(word, 0x1c),
    fcLcb: (i) => (i < count ? { fc: u32(word, rg + i * 8), lcb: u32(word, rg + i * 8 + 4) } : { fc: 0, lcb: 0 }),
  };
}

export interface Piece {
  cpStart: number;
  cpEnd: number;
  /** Position en octets dans le flux WordDocument. */
  fc: number;
  compressed: boolean;
}

/** Table des pieces (Clx -> Pcdt -> PlcPcd). Vide si absente ou abimee. */
export function readPieces(table: Uint8Array, fc: number, lcb: number): Piece[] {
  let pos = fc;
  const end = Math.min(table.length, fc + lcb);
  while (pos < end) {
    const kind = u8(table, pos);
    if (kind === 1) {
      pos += 3 + u16(table, pos + 1);
      continue;
    }
    if (kind !== 2) return [];
    const size = u32(table, pos + 1);
    const plc = pos + 5;
    if (size < 4 || plc + size > table.length) return [];
    const n = Math.floor((size - 4) / 12);
    const pieces: Piece[] = [];
    for (let i = 0; i < n; i++) {
      const raw = u32(table, plc + (n + 1) * 4 + i * 8 + 2);
      const compressed = (raw & 0x40000000) !== 0;
      const value = raw & 0x3fffffff;
      const cpStart = u32(table, plc + i * 4);
      const cpEnd = u32(table, plc + (i + 1) * 4);
      if (cpEnd > cpStart) pieces.push({ cpStart, cpEnd, fc: compressed ? value / 2 : value, compressed });
    }
    return pieces;
  }
  return [];
}

/** Texte du document et position (fc) de chaque unite UTF-16, bornes par la taille du flux. */
export function decodePieces(word: Uint8Array, pieces: readonly Piece[], maxCp: number): { text: string; fcs: Uint32Array } {
  const ordered = [...pieces].sort((a, b) => a.cpStart - b.cpStart);
  const total = Math.min(maxCp, ordered.reduce((n, p) => Math.max(n, p.cpEnd), 0), word.length);
  const fcs = new Uint32Array(total);
  const chunks: string[] = [];
  let cp = 0;
  for (const piece of ordered) {
    if (piece.cpStart !== cp || cp >= total) continue;
    const length = Math.min(piece.cpEnd, total) - piece.cpStart;
    let chunk = '';
    for (let i = 0; i < length; i++) {
      const fc = piece.compressed ? piece.fc + i : piece.fc + i * 2;
      if (fc + (piece.compressed ? 0 : 1) >= word.length) break;
      chunk += piece.compressed ? (CP1252[u8(word, fc)] ?? '?') : String.fromCharCode(u16(word, fc));
      fcs[cp++] = fc;
    }
    chunks.push(chunk);
    if (chunk.length < length) break;
  }
  return { text: chunks.join(''), fcs: fcs.subarray(0, cp) };
}

/** Decode des octets Windows-1252 (formats sans table des pieces). */
export const decode1252 = (bytes: Uint8Array): string => Array.from(bytes, (b) => CP1252[b] ?? '?').join('');

export interface Sprm {
  op: number;
  /** Operande (avec son prefixe de longueur pour les sprm de taille variable). */
  data: Uint8Array;
}

/** Decoupe une suite de sprm (grpprl). */
export function sprms(grpprl: Uint8Array): Sprm[] {
  const out: Sprm[] = [];
  let pos = 0;
  while (pos + 2 <= grpprl.length) {
    const op = u16(grpprl, pos);
    pos += 2;
    let size: number;
    switch (op >>> 13) {
      case 0: case 1: size = 1; break;
      case 2: case 4: case 5: size = 2; break;
      case 3: size = 4; break;
      case 7: size = 3; break;
      default: size = op === 0xd608 || op === 0xd606 ? 1 + u16(grpprl, pos) : 1 + u8(grpprl, pos);
    }
    if (pos + size > grpprl.length) break;
    out.push({ op, data: grpprl.subarray(pos, pos + size) });
    pos += size;
  }
  return out;
}

export interface FcRange<T> {
  fcStart: number;
  fcEnd: number;
  value: T;
}

/** Plage contenant `fc` (tableau trie par fcStart), ou undefined. */
export function findRange<T>(ranges: readonly FcRange<T>[], fc: number): FcRange<T> | undefined {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid];
    if (!r) break;
    if (fc < r.fcStart) hi = mid - 1;
    else if (fc >= r.fcEnd) lo = mid + 1;
    else return r;
  }
  return undefined;
}

/** Pages FKP (512 octets) designees par une PlcBte. */
function fkpPages(word: Uint8Array, table: Uint8Array, fc: number, lcb: number): Uint8Array[] {
  if (lcb < 12 || fc + lcb > table.length) return [];
  const n = Math.floor((lcb - 4) / 8);
  const pages: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    const pn = u32(table, fc + (n + 1) * 4 + i * 4) & 0x3fffff;
    if ((pn + 1) * 512 <= word.length) pages.push(word.subarray(pn * 512, pn * 512 + 512));
  }
  return pages;
}

/** Proprietes de caracteres directes (CHPX) par plage de positions. */
export function readChpx(word: Uint8Array, table: Uint8Array, fc: number, lcb: number): FcRange<Uint8Array>[] {
  const out: FcRange<Uint8Array>[] = [];
  for (const page of fkpPages(word, table, fc, lcb)) {
    const crun = Math.min(u8(page, 511), 101);
    for (let i = 0; i < crun; i++) {
      const b = u8(page, (crun + 1) * 4 + i) * 2;
      const grpprl = b ? page.subarray(b + 1, Math.min(511, b + 1 + u8(page, b))) : new Uint8Array(0);
      out.push({ fcStart: u32(page, i * 4), fcEnd: u32(page, (i + 1) * 4), value: grpprl });
    }
  }
  return out.sort((a, b) => a.fcStart - b.fcStart);
}

export interface Papx {
  istd: number;
  grpprl: Uint8Array;
}

/** Proprietes de paragraphes directes (PAPX) par plage de positions. */
export function readPapx(word: Uint8Array, table: Uint8Array, fc: number, lcb: number): FcRange<Papx>[] {
  const out: FcRange<Papx>[] = [];
  for (const page of fkpPages(word, table, fc, lcb)) {
    const cpara = Math.min(u8(page, 511), 29);
    for (let i = 0; i < cpara; i++) {
      const b = u8(page, (cpara + 1) * 4 + i * 13) * 2;
      let papx: Papx = { istd: 0, grpprl: new Uint8Array(0) };
      if (b) {
        const cb = u8(page, b);
        const start = cb ? b + 1 : b + 2;
        const size = cb ? cb * 2 - 1 : u8(page, b + 1) * 2;
        const end = Math.min(511, start + size);
        if (end >= start + 2) papx = { istd: u16(page, start), grpprl: page.subarray(start + 2, end) };
      }
      out.push({ fcStart: u32(page, i * 4), fcEnd: u32(page, (i + 1) * 4), value: papx });
    }
  }
  return out.sort((a, b) => a.fcStart - b.fcStart);
}

/** Positions (CP) d'une PLC dont les donnees font `dataSize` octets : n+1 CP puis n donnees. */
export function plcCps(table: Uint8Array, fc: number, lcb: number, dataSize: number): number[] {
  if (lcb < 4 || fc + lcb > table.length) return [];
  const n = Math.floor((lcb - 4) / (4 + dataSize));
  return Array.from({ length: n + 1 }, (_, i) => u32(table, fc + i * 4));
}

/** Styles : istd -> { sti (identifiant integre), nom }. */
export function readStyleNames(table: Uint8Array, fc: number, lcb: number): Map<number, { sti: number; name: string }> {
  const out = new Map<number, { sti: number; name: string }>();
  if (lcb < 6 || fc + lcb > table.length) return out;
  const cbStshi = u16(table, fc);
  const cstd = Math.min(u16(table, fc + 2), 4096);
  const baseSize = u16(table, fc + 4) || 10;
  let pos = fc + 2 + cbStshi;
  const end = fc + lcb;
  for (let istd = 0; istd < cstd && pos + 2 <= end; istd++) {
    const cb = u16(table, pos);
    const std = pos + 2;
    if (cb >= baseSize + 2) {
      const cch = Math.min(u16(table, std + baseSize), 255);
      out.set(istd, { sti: u16(table, std) & 0x0fff, name: utf16(table, std + baseSize + 2, cch) });
    }
    pos = std + cb;
  }
  return out;
}

/** Table des polices (SttbfFfn) : index ftc -> nom. */
export function readFontNames(table: Uint8Array, fc: number, lcb: number): string[] {
  const out: string[] = [];
  if (lcb < 4 || fc + lcb > table.length) return out;
  const count = Math.min(u16(table, fc), 4096);
  let pos = fc + 4;
  for (let i = 0; i < count && pos < fc + lcb; i++) {
    const cb = u8(table, pos);
    out.push(cb > 39 ? utf16(table, pos + 1 + 39, Math.floor((cb - 39) / 2), true) : '');
    pos += 1 + cb;
  }
  return out;
}

/** Couleurs Word 97 par index (ico). */
const ICO = ['auto', '000000', '0000FF', '00FFFF', '00FF00', 'FF00FF', 'FF0000', 'FFFF00', 'FFFFFF', '000080', '008080',
  '008000', '800080', '800000', '808000', '808080', 'C0C0C0'];

const ICO_HIGHLIGHT: readonly HighlightColor[] = ['none', 'black', 'blue', 'cyan', 'green', 'magenta', 'red', 'yellow',
  'white', 'darkBlue', 'darkCyan', 'darkGreen', 'darkMagenta', 'darkRed', 'darkYellow', 'darkGray', 'lightGray'];

const KUL: Readonly<Record<number, UnderlineType>> = {
  0: 'none', 1: 'single', 2: 'words', 3: 'double', 4: 'dotted', 6: 'thick', 7: 'dash', 9: 'dotDash', 10: 'dotDotDash',
  11: 'wave', 20: 'dottedHeavy', 23: 'dashedHeavy', 25: 'dashDotHeavy', 26: 'dashDotDotHeavy', 27: 'wavyHeavy',
  39: 'dashLong', 43: 'wavyDouble', 55: 'dashLongHeavy',
};

const TOGGLES: Readonly<Record<number, keyof RunProps>> = {
  0x0835: 'bold', 0x0836: 'italic', 0x0837: 'strike', 0x0838: 'outline', 0x0839: 'shadow', 0x083a: 'smallCaps',
  0x083b: 'caps', 0x083c: 'hidden', 0x0858: 'emboss', 0x0854: 'imprint', 0x2a53: 'doubleStrike',
};

export interface CharFormat {
  props: RunProps;
  revision?: 'insert' | 'delete';
}

/** Proprietes de caracteres d'un grpprl CHPX. Les bascules « comme le style » (0x80) sont ignorees. */
export function charFormat(grpprl: Uint8Array, fonts: readonly string[]): CharFormat {
  const props: RunProps = {};
  const out: CharFormat = { props };
  for (const { op, data } of sprms(grpprl)) {
    const v = u8(data, 0);
    const toggle = TOGGLES[op];
    if (toggle) {
      if (v !== 0x80) Object.assign(props, { [toggle]: v === 1 || v === 0x81 });
      continue;
    }
    switch (op) {
      case 0x0800: if (v) out.revision = 'delete'; break;
      case 0x0801: if (v) out.revision = 'insert'; break;
      case 0x2a3e: { const u = KUL[v]; if (u) props.underline = u; break; }
      case 0x4a43: props.size = u16(data, 0) / 2; break;
      case 0x2a48: props.vertAlign = v === 1 ? 'superscript' : v === 2 ? 'subscript' : 'baseline'; break;
      case 0x2a42: { const c = ICO[v]; if (c) props.color = { rgb: c }; break; }
      case 0x6870: props.color = { rgb: u8(data, 3) === 0xff ? 'auto' : [0, 1, 2].map((i) => u8(data, i).toString(16).padStart(2, '0')).join('').toUpperCase() }; break;
      case 0x2a0c: { const h = ICO_HIGHLIGHT[v]; if (h && h !== 'none') props.highlight = h; break; }
      case 0x4a4f: case 0x4a51: case 0x4a5e: { const f = fonts[u16(data, 0)]; if (f) props.font = f; break; }
      case 0x8840: props.spacing = twipsToPt(i16(data, 0)); break;
      case 0x486d: case 0x4873: { const lang = LCID_TO_LANG[u16(data, 0)]; if (lang) props.lang = lang; break; }
      default: break;
    }
  }
  return out;
}

export interface ParaFormat {
  props: ParagraphProps;
  inTable: boolean;
  /** Marque de fin de ligne de tableau. */
  rowEnd: boolean;
  /** Fin de ligne d'un tableau imbrique (ignoree : les tableaux imbriques sont aplatis). */
  innerRowEnd: boolean;
  /** Profondeur d'imbrication des tableaux (1 = tableau simple). */
  depth: number;
  /** Bords des cellules (twips) donnes par sprmTDefTable. */
  cellEdges?: number[];
}

const JC: readonly Alignment[] = ['left', 'center', 'right', 'justify', 'distribute'];

/** Proprietes de paragraphe d'un grpprl PAPX. */
export function paraFormat(grpprl: Uint8Array): ParaFormat {
  const props: ParagraphProps = {};
  const out: ParaFormat = { props, inTable: false, rowEnd: false, innerRowEnd: false, depth: 0 };
  for (const { op, data } of sprms(grpprl)) {
    const v = u8(data, 0);
    switch (op) {
      case 0x2403: case 0x2461: { const a = JC[v]; if (a) props.alignment = a; break; }
      case 0x840f: case 0x845e: props.indentLeft = twipsToPt(i16(data, 0)); break;
      case 0x840e: case 0x845d: props.indentRight = twipsToPt(i16(data, 0)); break;
      case 0x8411: case 0x8460: props.indentFirstLine = twipsToPt(i16(data, 0)); break;
      case 0xa413: props.spacingBefore = twipsToPt(u16(data, 0)); break;
      case 0xa414: props.spacingAfter = twipsToPt(u16(data, 0)); break;
      case 0x6412: {
        const line = i16(data, 0);
        props.lineSpacing = i16(data, 2) ? { rule: 'auto', value: Math.round((line / 240) * 100) / 100 }
          : { rule: line < 0 ? 'exact' : 'atLeast', value: twipsToPt(Math.abs(line)) };
        break;
      }
      case 0x2405: props.keepLines = v !== 0; break;
      case 0x2406: props.keepNext = v !== 0; break;
      case 0x2407: props.pageBreakBefore = v !== 0; break;
      case 0x2431: props.widowControl = v !== 0; break;
      case 0x2640: if (v < 9) props.outlineLevel = v; break;
      case 0x2416: out.inTable = v !== 0; break;
      case 0x2417: out.rowEnd = v !== 0; break;
      case 0x244c: out.innerRowEnd = v !== 0; break;
      case 0x6649: out.depth = u32(data, 0); break;
      case 0xd608: {
        const count = Math.min(u8(data, 2), 63);
        out.cellEdges = Array.from({ length: count + 1 }, (_, i) => i16(data, 3 + i * 2));
        break;
      }
      default: break;
    }
  }
  if (out.inTable && out.depth === 0) out.depth = 1;
  return out;
}

/** Proprietes du flux « \x05SummaryInformation » (titre, auteur, dates...). */
export function readSummary(stream: Uint8Array, props: DocumentProperties): void {
  if (stream.length < 48 || u16(stream, 0) !== 0xfffe) return;
  const section = u32(stream, 44);
  const count = Math.min(u32(stream, section + 4), 256);
  let codepage = 1252;
  const values = new Map<number, number>();
  for (let i = 0; i < count; i++) values.set(u32(stream, section + 8 + i * 8), section + u32(stream, section + 12 + i * 8));
  const cpAt = values.get(1);
  if (cpAt !== undefined && u32(stream, cpAt) === 2) codepage = u16(stream, cpAt + 4);
  const text = (pid: number): string | undefined => {
    const at = values.get(pid);
    if (at === undefined || u32(stream, at) !== 30) return undefined;
    const raw = stream.subarray(at + 8, Math.min(stream.length, at + 8 + Math.min(u32(stream, at + 4), 4096)));
    const decoded = codepage === 65001 ? new TextDecoder('utf-8').decode(raw) : decode1252(raw);
    return decoded.replace(/\0[\s\S]*$/, '') || undefined;
  };
  const date = (pid: number): string | undefined => {
    const at = values.get(pid);
    if (at === undefined || u32(stream, at) !== 64) return undefined;
    const ticks = u32(stream, at + 4) + u32(stream, at + 8) * 2 ** 32;
    const ms = ticks / 10_000 - 11_644_473_600_000;
    return ms > 0 && ms < 8.64e15 ? new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z') : undefined;
  };
  const assign = <K extends keyof DocumentProperties>(key: K, value: DocumentProperties[K] | undefined): void => {
    if (value !== undefined) props[key] = value;
  };
  assign('title', text(2));
  assign('subject', text(3));
  assign('creator', text(4));
  assign('keywords', text(5));
  assign('description', text(6));
  assign('template', text(7));
  assign('lastModifiedBy', text(8));
  assign('created', date(12));
  assign('modified', date(13));
  assign('application', text(18));
}
