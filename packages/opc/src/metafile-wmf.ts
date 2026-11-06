// Convertisseur WMF (Windows Metafile 16 bits, avec ou sans en-tete « placeable ») vers SVG.
import { MetafileCanvas, u16, u32, type GdiState } from './metafile-canvas.ts';

const MAX_RECORDS = 400_000;
const s16 = (b: Uint8Array, o: number): number => (u16(b, o) << 16) >> 16;

/** Longueur de l'en-tete BITMAPINFO (en-tete + palette + masques) d'une DIB compacte. */
function dibInfoLength(b: Uint8Array, at: number): number {
  const size = u32(b, at) || 40;
  if (size < 12) return size;
  const bpp = u16(b, at + 14);
  const used = u32(b, at + 32);
  const compression = u32(b, at + 16);
  const colors = bpp <= 8 ? (used || 1 << bpp) * 4 : used * 4;
  return size + colors + (size === 40 && (compression === 3 || compression === 6) ? 12 : 0);
}

export function convertWmf(b: Uint8Array): string | undefined {
  let pos = 0;
  let box = { x: 0, y: 0, w: 0, h: 0 };
  const placeable = u32(b, 0) === 0x9ac6cdd7;
  if (placeable) {
    const [l, t, r, bt] = [s16(b, 6), s16(b, 8), s16(b, 10), s16(b, 12)];
    box = { x: l, y: t, w: Math.max(1, r - l), h: Math.max(1, bt - t) };
    pos = 22;
  }
  if (u16(b, pos + 2) !== 9) return undefined;
  pos += u16(b, pos + 2) * 2;
  // Fenetre logique : premiers SETWINDOWORG / SETWINDOWEXT du fichier (sinon la boite « placeable »).
  const records: Array<{ fn: number; at: number; end: number }> = [];
  for (let p = pos; p + 6 <= b.length && records.length < MAX_RECORDS;) {
    const words = u32(b, p);
    if (words < 3 || p + words * 2 > b.length) break;
    records.push({ fn: u16(b, p + 4), at: p + 6, end: p + words * 2 });
    p += words * 2;
  }
  const org = records.find((r) => r.fn === 0x020b);
  const ext = records.find((r) => r.fn === 0x020c);
  if (ext) box = { x: org ? s16(b, org.at + 2) : 0, y: org ? s16(b, org.at) : 0, w: Math.max(1, Math.abs(s16(b, ext.at + 2))), h: Math.max(1, Math.abs(s16(b, ext.at))) };
  if (box.w <= 1 && box.h <= 1) return undefined;
  const canvas = new MetafileCanvas(box, 3.78);
  const objects: Array<(() => void) | undefined> = [];
  const stack: GdiState[] = [];
  const add = (apply: () => void): void => {
    const free = objects.findIndex((o) => o === undefined);
    if (free >= 0) objects[free] = apply;
    else objects.push(apply);
  };
  for (const { fn, at, end } of records) {
    const pts = (from: number, count: number): Array<[number, number]> => Array.from({ length: Math.max(0, Math.min(count, (end - from) >> 2)) }, (_, i) => [s16(b, from + i * 4), s16(b, from + i * 4 + 2)]);
    switch (fn) {
      case 0x0103: canvas.setMapMode(u16(b, at)); break;
      case 0x0102: canvas.state.opaque = u16(b, at) === 2; break;
      case 0x0106: canvas.state.evenOdd = u16(b, at) === 1; break;
      case 0x012e: canvas.state.textAlign = u16(b, at); break;
      case 0x0209: canvas.state.textColor = u32(b, at); break;
      case 0x0201: canvas.state.bkColor = u32(b, at); break;
      case 0x001e: stack.push(canvas.snapshot()); break;
      case 0x0127: { const n = Math.min(stack.length, Math.max(1, -s16(b, at))); for (let k = 0; k < n; k++) { const s = stack.pop(); if (s) canvas.restore(s); } break; }
      case 0x02fa: {
        const style = u16(b, at) & 0xff;
        const color = canvas.color(u32(b, at + 6));
        add(() => { canvas.state.pen = { color: style === 5 ? null : color, width: s16(b, at + 2), dash: canvas.dash(style) }; });
        break;
      }
      case 0x02fc: {
        const style = u16(b, at);
        const color = canvas.color(u32(b, at + 2));
        add(() => { canvas.state.brush = style === 1 ? null : color; });
        break;
      }
      case 0x02fb: {
        let name = '';
        for (let i = at + 18; i < end && b[i]; i++) name += String.fromCharCode(b[i] ?? 0);
        const font = { height: Math.abs(s16(b, at)) || 12, bold: u16(b, at + 8) >= 600, italic: b[at + 10] !== 0, underline: b[at + 11] !== 0, strike: b[at + 12] !== 0, angle: s16(b, at + 4) / 10, family: name || 'Arial' };
        add(() => { canvas.state.font = font; });
        break;
      }
      case 0x012d: objects[u16(b, at)]?.(); break;
      case 0x01f0: objects[u16(b, at)] = undefined; break;
      case 0x0214: canvas.moveTo(s16(b, at + 2), s16(b, at)); break;
      case 0x0213: canvas.lineTo(s16(b, at + 2), s16(b, at)); break;
      case 0x041b: canvas.rect(s16(b, at + 6), s16(b, at + 4), s16(b, at + 2), s16(b, at)); break;
      case 0x0418: canvas.ellipse(s16(b, at + 6), s16(b, at + 4), s16(b, at + 2), s16(b, at)); break;
      case 0x061c: canvas.rect(s16(b, at + 10), s16(b, at + 8), s16(b, at + 6), s16(b, at + 4), s16(b, at + 2) / 2, s16(b, at) / 2); break;
      case 0x0324: canvas.poly(pts(at + 2, u16(b, at)), true); break;
      case 0x0325: canvas.poly(pts(at + 2, u16(b, at)), false); break;
      case 0x0538: {
        const n = Math.min(u16(b, at), 4096);
        const counts = Array.from({ length: n }, (_, i) => u16(b, at + 2 + i * 2));
        const all = pts(at + 2 + n * 2, counts.reduce((a, c) => a + c, 0));
        let offset = 0;
        for (const c of counts) { canvas.poly(all.slice(offset, offset + c), true, true); offset += c; }
        canvas.flushCompound();
        break;
      }
      case 0x0521: {
        const len = u16(b, at);
        const padded = len + (len % 2);
        canvas.text(s16(b, at + 2 + padded + 2), s16(b, at + 2 + padded), new TextDecoder('windows-1252').decode(b.subarray(at + 2, at + 2 + len)));
        break;
      }
      case 0x0a32: {
        const len = u16(b, at + 4);
        const options = u16(b, at + 6);
        const start = at + 8 + (options & 6 ? 8 : 0);
        canvas.text(s16(b, at + 2), s16(b, at), new TextDecoder('windows-1252').decode(b.subarray(start, Math.min(end, start + len))));
        break;
      }
      case 0x0f43: {
        // STRETCHDIB : rop(4) usage(2) srcH srcW srcY srcX destH destW destY destX puis la DIB.
        const dib = at + 22;
        const infoLen = dibInfoLength(b, dib);
        canvas.dib(b.subarray(dib, dib + infoLen), b.subarray(dib + infoLen, end), s16(b, at + 20), s16(b, at + 18), s16(b, at + 16), s16(b, at + 14));
        break;
      }
      case 0x0b41: {
        const dib = at + 20;
        const infoLen = dibInfoLength(b, dib);
        canvas.dib(b.subarray(dib, dib + infoLen), b.subarray(dib + infoLen, end), s16(b, at + 18), s16(b, at + 16), s16(b, at + 14), s16(b, at + 12));
        break;
      }
      default: break;
    }
  }
  return canvas.svg();
}
