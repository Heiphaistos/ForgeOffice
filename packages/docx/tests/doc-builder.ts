// Fabrique de fichiers Word 97-2003 (.doc) minimaux pour les tests : conteneur CFB + FIB + table des pieces +
// FKP CHPX/PAPX + feuille de styles + polices + notes + SummaryInformation. Ecrit d'apres MS-DOC / MS-CFB.

export interface DocSpec {
  /** Texte principal (\r fin de paragraphe, \x07 fin de cellule, \x13\x14\x15 champs, \x02 appel de note). */
  text: string;
  /** Texte des notes de bas de page (chacune commence par \x02 et finit par \r). */
  footnotes?: string[];
  /** CP des appels de note dans le texte principal. */
  footnoteRefs?: number[];
  /** Texte en UTF-16 plutot qu'en Windows-1252 compresse. */
  unicode?: boolean;
  /** Coupe le texte en deux pieces : la premiere compressee, la seconde en UTF-16. */
  splitAt?: number;
  /** Mise en forme des caracteres par plage de CP. */
  runs?: { start: number; end: number; sprms: number[] }[];
  /** Mise en forme des paragraphes par index de paragraphe (dans tout le texte). */
  paras?: Record<number, { istd?: number; sprms?: number[] }>;
  styles?: { sti: number; name: string }[];
  fonts?: string[];
  summary?: { title?: string; author?: string; created?: Date };
  encrypted?: boolean;
  nFib?: number;
  /** Ne pas ecrire le flux de table (fichier abime). */
  noTable?: boolean;
}

class Bytes {
  readonly data: number[] = [];
  u8(v: number): this { this.data.push(v & 0xff); return this; }
  u16(v: number): this { return this.u8(v).u8(v >> 8); }
  u32(v: number): this { return this.u16(v & 0xffff).u16((v >>> 16) & 0xffff); }
  bytes(b: ArrayLike<number>): this { for (let i = 0; i < b.length; i++) this.u8(b[i] ?? 0); return this; }
  utf16(s: string): this { for (let i = 0; i < s.length; i++) this.u16(s.charCodeAt(i)); return this; }
  pad(multiple: number): this { while (this.data.length % multiple) this.u8(0); return this; }
  get length(): number { return this.data.length; }
  out(): Uint8Array { return Uint8Array.from(this.data); }
}

const putU32 = (b: Uint8Array, o: number, v: number): void => { new DataView(b.buffer, b.byteOffset).setUint32(o, v >>> 0, true); };
const putU16 = (b: Uint8Array, o: number, v: number): void => { new DataView(b.buffer, b.byteOffset).setUint16(o, v, true); };

/** Sprm avec operande : op + octets. */
export const sprm = (op: number, ...operand: number[]): number[] => [op & 0xff, op >> 8, ...operand];
export const sprm16 = (op: number, value: number): number[] => sprm(op, value & 0xff, (value >> 8) & 0xff);

const TEXT_START = 1024;

interface Piece { cpStart: number; cpEnd: number; fc: number; compressed: boolean }

/** Une page FKP de 512 octets. */
function fkp(rgfc: number[], entries: (Uint8Array | null)[], papx: boolean): Uint8Array {
  const page = new Uint8Array(512);
  const n = entries.length;
  rgfc.forEach((fc, i) => putU32(page, i * 4, fc));
  let free = 511;
  entries.forEach((entry, i) => {
    const slot = (n + 1) * 4 + i * (papx ? 13 : 1);
    if (!entry) return;
    free = (free - entry.length) & ~1;
    page.set(entry, free);
    page[slot] = free / 2;
  });
  page[511] = n;
  return page;
}

export function buildDoc(spec: DocSpec): Uint8Array {
  const all = spec.text + (spec.footnotes ?? []).join('');
  const total = all.length;
  const pieces: Piece[] = [];
  const word = new Bytes();
  for (let i = 0; i < TEXT_START; i++) word.u8(0);
  const addPiece = (cpStart: number, cpEnd: number, compressed: boolean): void => {
    if (!compressed) word.pad(2);
    const fc = word.length;
    const chunk = all.slice(cpStart, cpEnd);
    if (compressed) for (const ch of chunk) word.u8(ch.charCodeAt(0) === 0x20ac ? 0x80 : ch.charCodeAt(0));
    else word.utf16(chunk);
    pieces.push({ cpStart, cpEnd, fc, compressed });
  };
  if (spec.splitAt !== undefined) {
    addPiece(0, spec.splitAt, true);
    addPiece(spec.splitAt, total, false);
  } else addPiece(0, total, !spec.unicode);
  const textEnd = word.length;
  const fcOf = (cp: number): number => {
    const p = pieces.find((x) => cp >= x.cpStart && cp < x.cpEnd) ?? pieces[pieces.length - 1];
    if (!p) return TEXT_START;
    return p.fc + (cp - p.cpStart) * (p.compressed ? 1 : 2);
  };
  const width = (cp: number): number => (pieces.find((x) => cp >= x.cpStart && cp < x.cpEnd)?.compressed === false ? 2 : 1);

  // FKP CHPX et PAPX : une page par piece.
  word.pad(512);
  const chpxPns: number[] = [];
  const papxPns: number[] = [];
  const paraStarts: number[] = [0];
  for (let cp = 0; cp < total; cp++) if (all[cp] === '\r' || all[cp] === '\x07') paraStarts.push(cp + 1);
  for (const piece of pieces) {
    // Caracteres : decoupe par changement de plage.
    const bounds = new Set([piece.cpStart, piece.cpEnd]);
    for (const r of spec.runs ?? []) for (const b of [r.start, r.end]) if (b > piece.cpStart && b < piece.cpEnd) bounds.add(b);
    const cps = [...bounds].sort((a, b) => a - b);
    const entries = cps.slice(0, -1).map((cp) => {
      const r = (spec.runs ?? []).find((x) => cp >= x.start && cp < x.end);
      return r ? Uint8Array.from([r.sprms.length, ...r.sprms]) : null;
    });
    chpxPns.push(word.length / 512);
    word.bytes(fkp(cps.map((cp) => (cp === piece.cpEnd ? fcOf(cp - 1) + width(cp - 1) : fcOf(cp))), entries, false));
    // Paragraphes : chaque paragraphe qui se termine dans cette piece.
    const ends: number[] = [];
    const papx: (Uint8Array | null)[] = [];
    paraStarts.forEach((_, index) => {
      const next = paraStarts[index + 1];
      if (next === undefined || next - 1 < piece.cpStart || next - 1 >= piece.cpEnd) return;
      const def = spec.paras?.[index] ?? {};
      const istd = def.istd ?? 0;
      const body = [istd & 0xff, istd >> 8, ...(def.sprms ?? [])];
      if (body.length % 2) body.push(0);
      papx.push(Uint8Array.from([0, body.length / 2, ...body]));
      ends.push(next);
    });
    if (!papx.length) continue;
    const firstStart = Math.max(piece.cpStart, paraStarts.filter((s) => s <= (ends[0] ?? 0) - 1).pop() ?? piece.cpStart);
    const rgfc = [fcOf(firstStart), ...ends.map((e) => fcOf(e - 1) + width(e - 1))];
    papxPns.push(word.length / 512);
    word.bytes(fkp(rgfc, papx, true));
  }

  // Flux de table.
  const table = new Bytes();
  const fcLcb: Record<number, [number, number]> = {};
  const section = (index: number, write: () => void): void => {
    const fc = table.length;
    write();
    fcLcb[index] = [fc, table.length - fc];
  };
  section(1, () => {
    table.u16(4).u16(spec.styles?.length ?? 0).u16(10);
    for (const s of spec.styles ?? []) {
      table.u16(10 + 2 + s.name.length * 2 + 2).u16(s.sti).u16(1).u16(0).u16(0).u16(0).u16(s.name.length).utf16(s.name).u16(0);
    }
  });
  section(15, () => {
    table.u16(spec.fonts?.length ?? 0).u16(0);
    for (const f of spec.fonts ?? []) table.u8(39 + (f.length + 1) * 2).bytes(new Uint8Array(39)).utf16(f).u16(0);
  });
  const plcBte = (pns: number[]): void => {
    for (let i = 0; i <= pns.length; i++) table.u32(0);
    for (const pn of pns) table.u32(pn);
  };
  section(12, () => plcBte(chpxPns));
  section(13, () => plcBte(papxPns));
  if (spec.footnotes?.length) {
    section(2, () => {
      for (const cp of spec.footnoteRefs ?? []) table.u32(cp);
      table.u32(spec.text.length);
      for (let i = 0; i < (spec.footnoteRefs ?? []).length; i++) table.u16(1);
    });
    section(3, () => {
      let cp = 0;
      table.u32(0);
      for (const note of spec.footnotes ?? []) table.u32((cp += note.length));
      table.u32(cp + 1);
    });
  }
  section(33, () => {
    const plc = new Bytes();
    for (const p of pieces) plc.u32(p.cpStart);
    plc.u32(total);
    for (const p of pieces) plc.u16(0).u32(p.compressed ? (p.fc * 2) | 0x40000000 : p.fc).u16(0);
    table.u8(2).u32(plc.length).bytes(plc.data);
  });

  // FIB.
  const out = word.out();
  putU16(out, 0, 0xa5ec);
  putU16(out, 2, spec.nFib ?? 0xc1);
  putU16(out, 0x0a, 0x0200 | (spec.encrypted ? 0x0100 : 0));
  putU32(out, 0x18, TEXT_START);
  putU32(out, 0x1c, textEnd);
  putU16(out, 32, 14);
  putU16(out, 62, 22);
  putU32(out, 64 + 3 * 4, spec.text.length);
  putU32(out, 64 + 4 * 4, (spec.footnotes ?? []).join('').length);
  putU16(out, 152, 93);
  for (const [index, [fc, lcb]] of Object.entries(fcLcb)) {
    putU32(out, 154 + Number(index) * 8, fc);
    putU32(out, 154 + Number(index) * 8 + 4, lcb);
  }
  const streams: [string, Uint8Array][] = [['WordDocument', out]];
  if (!spec.noTable) streams.push(['1Table', table.out()]);
  if (spec.summary) streams.push(['\u0005SummaryInformation', summaryStream(spec.summary)]);
  return buildCfb(streams);
}

function summaryStream(s: NonNullable<DocSpec['summary']>): Uint8Array {
  const values: [number, Bytes][] = [[1, new Bytes().u32(2).u16(1252).u16(0)]];
  const str = (v: string): Bytes => new Bytes().u32(30).u32(v.length + 1).bytes([...v].map((c) => c.charCodeAt(0))).u8(0).pad(4);
  if (s.title) values.push([2, str(s.title)]);
  if (s.author) values.push([4, str(s.author)]);
  if (s.created) {
    const ticks = BigInt(s.created.getTime() + 11_644_473_600_000) * 10_000n;
    values.push([12, new Bytes().u32(64).u32(Number(ticks & 0xffffffffn)).u32(Number(ticks >> 32n))]);
  }
  const head = 8 + values.length * 8;
  const body = new Bytes();
  const index = new Bytes();
  for (const [pid, value] of values) {
    index.u32(pid).u32(head + body.length);
    body.bytes(value.data);
  }
  return new Bytes().u16(0xfffe).u16(0).u32(0).bytes(new Uint8Array(16)).u32(1).bytes(new Uint8Array(16)).u32(48)
    .u32(head + body.length).u32(values.length).bytes(index.data).bytes(body.data).out();
}

/** Conteneur CFB version 3 (secteurs de 512 octets, aucun mini-flux : seuil de mini-flux a 1 octet). */
export function buildCfb(streams: [string, Uint8Array][]): Uint8Array {
  const sectorsOf = (n: number): number => Math.max(1, Math.ceil(n / 512));
  const dirSectors = sectorsOf((streams.length + 1) * 128);
  const dataSectors = streams.reduce((n, [, d]) => n + sectorsOf(d.length), 0);
  let fatSectors = 1;
  while (fatSectors * 128 < fatSectors + dirSectors + dataSectors) fatSectors++;
  const totalSectors = fatSectors + dirSectors + dataSectors;
  const file = new Uint8Array(512 * (1 + totalSectors));
  file.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  putU16(file, 0x18, 0x3e);
  putU16(file, 0x1a, 3);
  putU16(file, 0x1c, 0xfffe);
  putU16(file, 0x1e, 9);
  putU16(file, 0x20, 6);
  putU32(file, 0x2c, fatSectors);
  putU32(file, 0x30, fatSectors);
  putU32(file, 0x38, 1);
  putU32(file, 0x3c, 0xfffffffe);
  putU32(file, 0x44, 0xfffffffe);
  for (let i = 0; i < 109; i++) putU32(file, 0x4c + i * 4, i < fatSectors ? i : 0xffffffff);
  const fat: number[] = new Array(fatSectors * 128).fill(0xffffffff);
  for (let i = 0; i < fatSectors; i++) fat[i] = 0xfffffffd;
  const chain = (start: number, count: number): void => {
    for (let i = 0; i < count; i++) fat[start + i] = i === count - 1 ? 0xfffffffe : start + i + 1;
  };
  chain(fatSectors, dirSectors);
  const sector = (n: number): number => 512 * (1 + n);
  const dirAt = sector(fatSectors);
  const entry = (index: number, name: string, type: number, start: number, size: number): void => {
    const o = dirAt + index * 128;
    for (let i = 0; i < name.length; i++) putU16(file, o + i * 2, name.charCodeAt(i));
    putU16(file, o + 0x40, (name.length + 1) * 2);
    file[o + 0x42] = type;
    file[o + 0x43] = 1;
    putU32(file, o + 0x44, 0xffffffff);
    putU32(file, o + 0x48, 0xffffffff);
    putU32(file, o + 0x4c, type === 5 ? 1 : 0xffffffff);
    putU32(file, o + 0x74, start);
    putU32(file, o + 0x78, size);
  };
  entry(0, 'Root Entry', 5, 0xfffffffe, 0);
  let next = fatSectors + dirSectors;
  streams.forEach(([name, data], i) => {
    const count = sectorsOf(data.length);
    entry(i + 1, name, 2, next, data.length);
    chain(next, count);
    file.set(data, sector(next));
    next += count;
  });
  fat.forEach((v, i) => putU32(file, sector(Math.floor(i / 128)) + (i % 128) * 4, v));
  return file;
}
