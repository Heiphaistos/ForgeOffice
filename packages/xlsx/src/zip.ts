// Ecriture d'archives zip avec compression native (CompressionStream « deflate-raw », Node 18+ et
// navigateurs recents), repli JSZip sinon. Sert aux paquets xlsx volumineux et aux .ods (mimetype non compresse).
import JSZip from 'jszip';

export interface ZipEntry {
  path: string;
  data: Uint8Array;
  /** Stocke sans compression (obligatoire pour le « mimetype » d'un OpenDocument). */
  store?: boolean;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = (CRC_TABLE[(crc ^ (data[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function hasNativeDeflate(): boolean {
  if (typeof CompressionStream === 'undefined') return false;
  try {
    return new CompressionStream('deflate-raw') instanceof CompressionStream;
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) return false;
    throw error;
  }
}

async function buildWithJsZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const entry of entries) zip.file(entry.path, entry.data, { compression: entry.store ? 'STORE' : 'DEFLATE' });
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/** Date DOS fixe (1980-01-01) : sortie reproductible. */
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

export async function buildZip(entries: ZipEntry[]): Promise<Uint8Array> {
  if (!hasNativeDeflate()) return buildWithJsZip(entries);
  const encoder = new TextEncoder();
  const compressed = await Promise.all(entries.map(async (entry) => {
    const raw = entry.data;
    const packed = entry.store ? raw : await deflateRaw(raw);
    const useStore = entry.store === true || packed.length >= raw.length;
    return { name: encoder.encode(entry.path), crc: crc32(raw), size: raw.length, body: useStore ? raw : packed, method: useStore ? 0 : 8 };
  }));
  let total = 22;
  for (const item of compressed) total += 30 + item.name.length + item.body.length + 46 + item.name.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let offset = 0;
  const offsets: number[] = [];
  for (const item of compressed) {
    offsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0x0800, true);
    view.setUint16(offset + 8, item.method, true);
    view.setUint16(offset + 10, DOS_TIME, true);
    view.setUint16(offset + 12, DOS_DATE, true);
    view.setUint32(offset + 14, item.crc, true);
    view.setUint32(offset + 18, item.body.length, true);
    view.setUint32(offset + 22, item.size, true);
    view.setUint16(offset + 26, item.name.length, true);
    view.setUint16(offset + 28, 0, true);
    out.set(item.name, offset + 30);
    out.set(item.body, offset + 30 + item.name.length);
    offset += 30 + item.name.length + item.body.length;
  }
  const centralStart = offset;
  compressed.forEach((item, i) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 10, item.method, true);
    view.setUint16(offset + 12, DOS_TIME, true);
    view.setUint16(offset + 14, DOS_DATE, true);
    view.setUint32(offset + 16, item.crc, true);
    view.setUint32(offset + 20, item.body.length, true);
    view.setUint32(offset + 24, item.size, true);
    view.setUint16(offset + 28, item.name.length, true);
    view.setUint32(offset + 42, offsets[i] ?? 0, true);
    out.set(item.name, offset + 46);
    offset += 46 + item.name.length;
  });
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, compressed.length, true);
  view.setUint16(offset + 10, compressed.length, true);
  view.setUint32(offset + 12, offset - centralStart, true);
  view.setUint32(offset + 16, centralStart, true);
  return out;
}
