// Lecture d'un conteneur OLE / CFB (MS-CFB) : secteurs, FAT, DIFAT, mini-flux, repertoire a plat.
// Toutes les chaines de secteurs sont bornees (boucles, index hors fichier) : un fichier hostile leve CfbError.

export class CfbError extends Error {}

const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const END_OF_CHAIN = 0xfffffffe;
const FREE_SECT = 0xffffffff;
const MAX_REGULAR_SECT = 0xfffffffa;
/** Taille maximale d'un flux lu (256 Mo). */
const MAX_STREAM = 256 * 1024 * 1024;

export interface CfbEntry {
  name: string;
  /** 1 stockage, 2 flux, 5 racine. */
  type: number;
  start: number;
  size: number;
}

export function isCfb(bytes: Uint8Array): boolean {
  return bytes.length >= 512 && SIGNATURE.every((b, i) => bytes[i] === b);
}

export class CfbFile {
  readonly entries: CfbEntry[] = [];
  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  private readonly sectorSize: number;
  private readonly miniSectorSize: number;
  private readonly miniCutoff: number;
  private readonly fat: Uint32Array;
  private miniFat: Uint32Array = new Uint32Array(0);
  private miniStream: Uint8Array = new Uint8Array(0);

  constructor(bytes: Uint8Array) {
    if (!isCfb(bytes)) throw new CfbError('signature');
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const shift = this.view.getUint16(0x1e, true);
    const miniShift = this.view.getUint16(0x20, true);
    if ((shift !== 9 && shift !== 12) || miniShift !== 6) throw new CfbError('taille de secteur');
    this.sectorSize = 1 << shift;
    this.miniSectorSize = 1 << miniShift;
    this.miniCutoff = this.view.getUint32(0x38, true);
    this.fat = this.readFat();
    this.readDirectory(this.view.getUint32(0x30, true));
    const root = this.entries[0];
    if (!root || root.type !== 5) throw new CfbError('racine');
    const miniFatStart = this.view.getUint32(0x3c, true);
    if (miniFatStart < MAX_REGULAR_SECT) this.miniFat = toUint32(this.readChain(miniFatStart, -1));
    if (root.size > 0) this.miniStream = this.readChain(root.start, root.size);
  }

  private sectorCount(): number {
    return Math.ceil(this.bytes.length / this.sectorSize) - 1;
  }

  private sector(index: number): Uint8Array {
    const offset = (index + 1) * this.sectorSize;
    if (index >= MAX_REGULAR_SECT || offset >= this.bytes.length) throw new CfbError(`secteur ${index} hors du fichier`);
    return this.bytes.subarray(offset, Math.min(offset + this.sectorSize, this.bytes.length));
  }

  private readFat(): Uint32Array {
    const perSector = this.sectorSize / 4;
    const fatSectors: number[] = [];
    for (let i = 0; i < 109; i++) {
      const s = this.view.getUint32(0x4c + i * 4, true);
      if (s < MAX_REGULAR_SECT) fatSectors.push(s);
    }
    let difat = this.view.getUint32(0x44, true);
    const seen = new Set<number>();
    while (difat < MAX_REGULAR_SECT) {
      if (seen.has(difat) || seen.size > this.sectorCount()) throw new CfbError('boucle DIFAT');
      seen.add(difat);
      const data = toUint32(this.sector(difat));
      for (let i = 0; i < perSector - 1; i++) {
        const s = data[i] ?? FREE_SECT;
        if (s < MAX_REGULAR_SECT) fatSectors.push(s);
      }
      difat = data[perSector - 1] ?? END_OF_CHAIN;
    }
    if (fatSectors.length === 0) throw new CfbError('FAT vide');
    const fat = new Uint32Array(fatSectors.length * perSector);
    fatSectors.forEach((s, i) => fat.set(toUint32(this.sector(s)).subarray(0, perSector), i * perSector));
    return fat;
  }

  /** Concatene une chaine de secteurs ; `size` < 0 = toute la chaine. */
  private readChain(start: number, size: number): Uint8Array {
    if (size > MAX_STREAM) throw new CfbError('flux trop grand');
    const parts: Uint8Array[] = [];
    let total = 0;
    let s = start;
    const seen = new Set<number>();
    while (s !== END_OF_CHAIN && (size < 0 || total < size)) {
      if (s >= this.fat.length || seen.has(s)) throw new CfbError('chaine de secteurs invalide');
      seen.add(s);
      const data = this.sector(s);
      parts.push(data);
      total += data.length;
      s = this.fat[s] ?? END_OF_CHAIN;
    }
    if (size >= 0 && total < size) throw new CfbError('flux tronque');
    return concat(parts, size < 0 ? total : size);
  }

  private readMiniChain(start: number, size: number): Uint8Array {
    const out = new Uint8Array(size);
    let s = start;
    let offset = 0;
    const seen = new Set<number>();
    while (offset < size) {
      if (s >= this.miniFat.length || seen.has(s)) throw new CfbError('chaine de mini-secteurs invalide');
      seen.add(s);
      const from = s * this.miniSectorSize;
      const chunk = this.miniStream.subarray(from, from + Math.min(this.miniSectorSize, size - offset));
      if (chunk.length === 0) throw new CfbError('mini-flux tronque');
      out.set(chunk, offset);
      offset += chunk.length;
      s = this.miniFat[s] ?? END_OF_CHAIN;
    }
    return out;
  }

  private readDirectory(start: number): void {
    const dir = this.readChain(start, -1);
    const view = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
    for (let offset = 0; offset + 128 <= dir.length; offset += 128) {
      const nameLength = Math.min(view.getUint16(offset + 64, true), 64);
      let name = '';
      for (let i = 0; i + 2 < nameLength; i += 2) name += String.fromCharCode(view.getUint16(offset + i, true));
      this.entries.push({
        name,
        type: view.getUint8(offset + 66),
        start: view.getUint32(offset + 116, true),
        // Version 3 : seuls les 32 bits bas comptent ; un poids fort non nul est rejete par readChain.
        size: view.getUint32(offset + 120, true) + (this.sectorSize === 4096 ? view.getUint32(offset + 124, true) * 2 ** 32 : 0),
      });
    }
  }

  find(name: string): CfbEntry | undefined {
    const lower = name.toLowerCase();
    return this.entries.find((e) => e.type === 2 && e.name.toLowerCase() === lower);
  }

  read(entry: CfbEntry): Uint8Array {
    if (entry.size < this.miniCutoff) return this.readMiniChain(entry.start, entry.size);
    return this.readChain(entry.start, entry.size);
  }
}

function toUint32(data: Uint8Array): Uint32Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const out = new Uint32Array(Math.floor(data.length / 4));
  for (let i = 0; i < out.length; i++) out[i] = view.getUint32(i * 4, true);
  return out;
}

function concat(parts: Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    if (offset >= size) break;
    const chunk = part.subarray(0, size - offset);
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
