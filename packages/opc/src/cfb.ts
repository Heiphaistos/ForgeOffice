// Lecteur de fichiers composes OLE / CFB (.doc, .ppt, .xls et OOXML chiffres), borne et sans boucle infinie.

export class CfbError extends Error {}

const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const END_OF_CHAIN = 0xfffffffe;
const FREE = 0xffffffff;
const MAX_REGULAR = 0xfffffffa;

export interface CfbEntry {
  name: string;
  type: number;
  start: number;
  size: number;
}

export function isCfb(bytes: Uint8Array): boolean {
  return SIGNATURE.every((b, i) => bytes[i] === b);
}

export class CfbFile {
  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  private readonly sectorSize: number;
  private readonly miniSectorSize: number;
  private readonly miniCutoff: number;
  private readonly fat: number[] = [];
  private readonly miniFat: number[] = [];
  private miniStream: Uint8Array = new Uint8Array(0);
  readonly entries: CfbEntry[] = [];

  constructor(bytes: Uint8Array) {
    if (bytes.length < 512 || !isCfb(bytes)) throw new CfbError('Signature CFB absente');
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const shift = this.u16(0x1e);
    if (shift !== 9 && shift !== 12) throw new CfbError('Taille de secteur invalide');
    this.sectorSize = 1 << shift;
    this.miniSectorSize = 1 << Math.min(12, this.u16(0x20));
    this.miniCutoff = this.u32(0x38) || 4096;
    this.readFat();
    const directory = this.chain(this.u32(0x30), this.fat, this.sectorSize, (s) => this.sector(s));
    for (let off = 0; off + 128 <= directory.length; off += 128) {
      const dv = new DataView(directory.buffer, directory.byteOffset + off, 128);
      const nameLength = Math.min(64, dv.getUint16(0x40, true));
      let name = '';
      for (let i = 0; i + 1 < nameLength - 1 && i < 62; i += 2) name += String.fromCharCode(dv.getUint16(i, true));
      this.entries.push({ name, type: dv.getUint8(0x42), start: dv.getUint32(0x74, true), size: dv.getUint32(0x78, true) });
    }
    const root = this.entries[0];
    if (!root || root.type !== 5) throw new CfbError('Repertoire racine absent');
    const miniFatStart = this.u32(0x3c);
    if (miniFatStart < MAX_REGULAR) {
      const raw = this.chain(miniFatStart, this.fat, this.sectorSize, (s) => this.sector(s));
      for (let i = 0; i + 4 <= raw.length; i += 4) this.miniFat.push(new DataView(raw.buffer, raw.byteOffset + i, 4).getUint32(0, true));
    }
    if (root.start < MAX_REGULAR) this.miniStream = this.chain(root.start, this.fat, this.sectorSize, (s) => this.sector(s)).subarray(0, root.size);
  }

  private u16(offset: number): number {
    return this.view.getUint16(offset, true);
  }

  private u32(offset: number): number {
    return this.view.getUint32(offset, true);
  }

  private sector(index: number): Uint8Array {
    const start = (index + 1) * this.sectorSize;
    if (start + this.sectorSize > this.bytes.length) {
      if (start >= this.bytes.length) throw new CfbError('Secteur hors du fichier');
      const padded = new Uint8Array(this.sectorSize);
      padded.set(this.bytes.subarray(start));
      return padded;
    }
    return this.bytes.subarray(start, start + this.sectorSize);
  }

  private readFat(): void {
    const difat: number[] = [];
    for (let i = 0; i < 109; i++) {
      const s = this.u32(0x4c + i * 4);
      if (s < MAX_REGULAR) difat.push(s);
    }
    let next = this.u32(0x44);
    const seen = new Set<number>();
    const perSector = this.sectorSize / 4 - 1;
    while (next < MAX_REGULAR && !seen.has(next) && seen.size < 100_000) {
      seen.add(next);
      const sector = this.sector(next);
      const dv = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
      for (let i = 0; i < perSector; i++) {
        const s = dv.getUint32(i * 4, true);
        if (s < MAX_REGULAR) difat.push(s);
      }
      next = dv.getUint32(perSector * 4, true);
    }
    const maxSectors = Math.ceil(this.bytes.length / this.sectorSize) + 1;
    for (const s of difat) {
      if (s >= maxSectors) continue;
      const sector = this.sector(s);
      const dv = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
      for (let i = 0; i < this.sectorSize / 4; i++) this.fat.push(dv.getUint32(i * 4, true));
    }
  }

  /** Suit une chaine de secteurs ; s'arrete sur fin de chaine, boucle ou secteur invalide. */
  private chain(start: number, table: number[], size: number, read: (s: number) => Uint8Array, limit = Infinity): Uint8Array {
    const parts: Uint8Array[] = [];
    const seen = new Set<number>();
    let current = start;
    let total = 0;
    while (current !== END_OF_CHAIN && current !== FREE && current < MAX_REGULAR && !seen.has(current) && total < limit) {
      seen.add(current);
      if (seen.size > table.length + 1) break;
      parts.push(read(current));
      total += size;
      current = table[current] ?? END_OF_CHAIN;
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }

  private miniSector(index: number): Uint8Array {
    const start = index * this.miniSectorSize;
    if (start >= this.miniStream.length) throw new CfbError('Mini-secteur hors du flux');
    return this.miniStream.subarray(start, Math.min(this.miniStream.length, start + this.miniSectorSize));
  }

  /** Contenu d'un flux par son nom (insensible a la casse), ou undefined. */
  stream(name: string): Uint8Array | undefined {
    const entry = this.entries.find((e) => e.type === 2 && e.name.toLowerCase() === name.toLowerCase());
    if (!entry) return undefined;
    const size = entry.size;
    if (size > this.bytes.length * 2 + 4096) throw new CfbError('Taille de flux incoherente');
    const data = size < this.miniCutoff
      ? this.chain(entry.start, this.miniFat, this.miniSectorSize, (s) => this.miniSector(s), size)
      : this.chain(entry.start, this.fat, this.sectorSize, (s) => this.sector(s), size);
    return data.subarray(0, Math.min(size, data.length));
  }
}
