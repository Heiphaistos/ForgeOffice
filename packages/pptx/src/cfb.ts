// Lecteur de fichiers composes Microsoft (CFB / OLE2) : lecture bornee des flux, pour les .ppt 97-2003.

export class CfbError extends Error {}

const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const END_OF_CHAIN = 0xfffffffe;
const FREE = 0xffffffff;
const MAX_SECTORS = 1 << 22;

export interface CfbEntry {
  name: string;
  type: 'storage' | 'stream' | 'root';
  start: number;
  size: number;
}

export class CfbFile {
  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  private readonly sectorSize: number;
  private readonly miniSectorSize: number;
  private readonly miniCutoff: number;
  private readonly fat: number[];
  private readonly miniFat: number[];
  readonly entries: CfbEntry[];
  private readonly miniStream: Uint8Array;

  constructor(bytes: Uint8Array) {
    if (bytes.length < 512 || !SIGNATURE.every((b, i) => bytes[i] === b)) throw new CfbError('Signature CFB absente');
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const shift = this.view.getUint16(0x1e, true);
    const miniShift = this.view.getUint16(0x20, true);
    if (shift !== 9 && shift !== 12) throw new CfbError('Taille de secteur invalide');
    this.sectorSize = 1 << shift;
    this.miniSectorSize = 1 << miniShift;
    this.miniCutoff = this.view.getUint32(0x38, true);
    this.fat = this.readFat();
    const dirStart = this.view.getUint32(0x30, true);
    const directory = this.chain(dirStart, this.fat, (n) => this.sector(n), this.sectorSize);
    this.entries = this.readDirectory(directory);
    const root = this.entries.find((e) => e.type === 'root');
    const miniFatStart = this.view.getUint32(0x3c, true);
    this.miniFat = miniFatStart === END_OF_CHAIN ? [] : this.words(this.chain(miniFatStart, this.fat, (n) => this.sector(n), this.sectorSize));
    this.miniStream = root && root.start !== END_OF_CHAIN ? this.chain(root.start, this.fat, (n) => this.sector(n), this.sectorSize).subarray(0, root.size) : new Uint8Array(0);
  }

  private sector(n: number): Uint8Array {
    const offset = (n + 1) * this.sectorSize;
    if (offset + this.sectorSize > this.bytes.length) {
      // Dernier secteur tronque : complete par des zeros (tolerance des lecteurs Office).
      const out = new Uint8Array(this.sectorSize);
      if (offset < this.bytes.length) out.set(this.bytes.subarray(offset));
      return out;
    }
    return this.bytes.subarray(offset, offset + this.sectorSize);
  }

  private words(data: Uint8Array): number[] {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const out: number[] = [];
    for (let i = 0; i + 4 <= data.length; i += 4) out.push(view.getUint32(i, true));
    return out;
  }

  private readFat(): number[] {
    const fatSectors: number[] = [];
    for (let i = 0; i < 109; i++) {
      const n = this.view.getUint32(0x4c + i * 4, true);
      if (n !== FREE && n !== END_OF_CHAIN) fatSectors.push(n);
    }
    let difat = this.view.getUint32(0x44, true);
    const seen = new Set<number>();
    while (difat !== END_OF_CHAIN && difat !== FREE && !seen.has(difat) && seen.size < MAX_SECTORS) {
      seen.add(difat);
      const entries = this.words(this.sector(difat));
      const next = entries.pop() ?? END_OF_CHAIN;
      for (const n of entries) if (n !== FREE && n !== END_OF_CHAIN) fatSectors.push(n);
      difat = next;
    }
    const fat: number[] = [];
    for (const n of fatSectors) fat.push(...this.words(this.sector(n)));
    return fat;
  }

  /** Concatene une chaine de secteurs (boucles et chaines trop longues refusees). */
  private chain(start: number, table: number[], read: (n: number) => Uint8Array, size: number): Uint8Array {
    const parts: Uint8Array[] = [];
    const seen = new Set<number>();
    let n = start;
    while (n !== END_OF_CHAIN && n !== FREE) {
      if (seen.has(n) || n >= table.length || seen.size > MAX_SECTORS) throw new CfbError('Chaine de secteurs invalide');
      seen.add(n);
      parts.push(read(n));
      n = table[n] ?? END_OF_CHAIN;
    }
    const out = new Uint8Array(parts.length * size);
    parts.forEach((part, i) => out.set(part, i * size));
    return out;
  }

  private readDirectory(data: Uint8Array): CfbEntry[] {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const entries: CfbEntry[] = [];
    for (let offset = 0; offset + 128 <= data.length; offset += 128) {
      const nameLength = Math.min(64, view.getUint16(offset + 0x40, true));
      const kind = data[offset + 0x42];
      if (kind !== 1 && kind !== 2 && kind !== 5) continue;
      let name = '';
      for (let i = 0; i + 2 < nameLength; i += 2) name += String.fromCharCode(view.getUint16(offset + i, true));
      entries.push({
        name,
        type: kind === 1 ? 'storage' : kind === 2 ? 'stream' : 'root',
        start: view.getUint32(offset + 0x74, true),
        size: view.getUint32(offset + 0x78, true),
      });
    }
    return entries;
  }

  has(name: string): boolean {
    return this.entries.some((e) => e.type === 'stream' && e.name.toLowerCase() === name.toLowerCase());
  }

  /** Contenu d'un flux (recherche par nom, insensible a la casse). */
  stream(name: string): Uint8Array | undefined {
    const entry = this.entries.find((e) => e.type === 'stream' && e.name.toLowerCase() === name.toLowerCase());
    if (!entry) return undefined;
    if (entry.size < this.miniCutoff) {
      const data = this.chain(entry.start, this.miniFat, (n) => {
        const offset = n * this.miniSectorSize;
        const out = new Uint8Array(this.miniSectorSize);
        out.set(this.miniStream.subarray(offset, offset + this.miniSectorSize));
        return out;
      }, this.miniSectorSize);
      return data.subarray(0, entry.size);
    }
    if (entry.size > this.bytes.length) throw new CfbError('Flux plus grand que le fichier');
    return this.chain(entry.start, this.fat, (n) => this.sector(n), this.sectorSize).subarray(0, entry.size);
  }
}
