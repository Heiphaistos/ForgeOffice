// Images OfficeArt (BLIP) des formats Office 97-2003 (.doc, .ppt, .xls) : JPEG, PNG, DIB (converti en BMP), TIFF,
// EMF / WMF (decompresses). Lecture bornee.
import { inflate, InflateError } from './inflate.ts';

const u8 = (b: Uint8Array, o: number): number => b[o] ?? 0;
const u16 = (b: Uint8Array, o: number): number => u8(b, o) | (u8(b, o + 1) << 8);
const u32 = (b: Uint8Array, o: number): number => (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0;

export interface Blip {
  contentType: string;
  bytes: Uint8Array;
}

const BLIP_TYPES: Readonly<Record<number, { type: string; meta: boolean }>> = {
  0xf01a: { type: 'image/x-emf', meta: true }, 0xf01b: { type: 'image/x-wmf', meta: true }, 0xf01c: { type: 'image/x-pict', meta: true },
  0xf01d: { type: 'image/jpeg', meta: false }, 0xf02a: { type: 'image/jpeg', meta: false }, 0xf01e: { type: 'image/png', meta: false },
  0xf01f: { type: 'image/bmp', meta: false }, 0xf029: { type: 'image/tiff', meta: false },
};

/** Image d'un enregistrement BLIP (JPEG, PNG, DIB converti en BMP, TIFF, EMF/WMF decompresses). */
export function blipOf(data: Uint8Array, start: number, instance: number, type: number, length: number): Blip | undefined {
  const info = BLIP_TYPES[type];
  const end = Math.min(data.length, start + length);
  if (!info) return undefined;
  let pos = start + ((instance & 1) ? 32 : 16);
  if (info.meta) {
    if (pos + 34 > end) return undefined;
    const compressed = u8(data, pos + 32) === 0;
    const size = u32(data, pos + 28);
    pos += 34;
    const payload = data.subarray(pos, Math.min(end, pos + (size || end - pos)));
    if (!compressed) return { contentType: info.type, bytes: payload };
    try {
      return { contentType: info.type, bytes: inflate(data.subarray(pos, end), { maxBytes: 64 * 1024 * 1024 }) };
    } catch (error) {
      if (error instanceof InflateError) return undefined;
      throw error;
    }
  }
  pos += 1;
  if (pos >= end) return undefined;
  const payload = data.subarray(pos, end);
  if (type !== 0xf01f) return { contentType: info.type, bytes: payload };
  // DIB sans en-tete de fichier : ajoute BITMAPFILEHEADER (14 octets).
  const header = u32(payload, 0) || 40;
  const bpp = u16(payload, 14);
  const colors = bpp <= 8 ? (u32(payload, 32) || 1 << bpp) * 4 : 0;
  const bmp = new Uint8Array(14 + payload.length);
  bmp.set([0x42, 0x4d]);
  new DataView(bmp.buffer).setUint32(2, bmp.length, true);
  new DataView(bmp.buffer).setUint32(10, 14 + header + colors, true);
  bmp.set(payload, 14);
  return { contentType: info.type, bytes: bmp };
}

/** Premiere image trouvee dans une suite d'enregistrements OfficeArt (conteneurs et FBSE parcourus). */
export function findBlip(data: Uint8Array, start: number, end: number, depth = 0): Blip | undefined {
  let pos = start;
  const limit = Math.min(end, data.length);
  while (pos + 8 <= limit && depth < 6) {
    const verInst = u16(data, pos);
    const ver = verInst & 0x0f;
    const instance = verInst >>> 4;
    const type = u16(data, pos + 2);
    const length = u32(data, pos + 4);
    const body = pos + 8;
    const next = body + length;
    if (ver === 0x0f) {
      const found = findBlip(data, body, Math.min(next, limit), depth + 1);
      if (found) return found;
    } else if (type === 0xf007) {
      // FBSE : 36 octets + nom, puis le BLIP incorpore.
      const found = findBlip(data, body + 36 + u8(data, body + 33), Math.min(next, limit), depth + 1);
      if (found) return found;
    } else if (BLIP_TYPES[type]) {
      return blipOf(data, body, instance, type, length);
    }
    if (next <= pos) break;
    pos = next;
  }
  return undefined;
}

