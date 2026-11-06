// Convertisseur EMF / WMF vers SVG (enregistrements courants : lignes, polygones, courbes, rectangles, ellipses, traces,
// texte, images DIB). Les navigateurs n'affichent pas ces metafichiers. Les enregistrements inconnus sont ignores ; les
// enregistrements EMF+ (commentaires) sont ignores car les fichiers « dual » contiennent aussi les enregistrements GDI.
import { convertWmf } from './metafile-wmf.ts';
import { MetafileCanvas, type Xform, u16, u32, i32 } from './metafile-canvas.ts';

const MAX_RECORDS = 400_000;
const f32 = (b: Uint8Array, o: number): number => new DataView(b.buffer, b.byteOffset + o, 4).getFloat32(0, true);

const STOCK_BRUSH: Readonly<Record<number, string | null>> = { 0: '#ffffff', 1: '#c0c0c0', 2: '#808080', 3: '#404040', 4: '#000000', 5: null };
const STOCK_PEN: Readonly<Record<number, string | null>> = { 6: '#ffffff', 7: '#000000', 8: null };

function utf16(b: Uint8Array, o: number, count: number): string {
  let out = '';
  for (let i = 0; i < count && o + i * 2 + 1 < b.length; i++) {
    const c = u16(b, o + i * 2);
    if (!c) break;
    out += String.fromCharCode(c);
  }
  return out;
}

/** Octets d'un metafichier EMF ou WMF -> SVG, ou undefined si le format n'est pas reconnu. */
export function metafileToSvg(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 88 && u32(bytes, 0) === 1 && u32(bytes, 40) === 0x464d4520) return convertEmf(bytes);
  if (bytes.length >= 18 && (u32(bytes, 0) === 0x9ac6cdd7 || ((u16(bytes, 0) === 1 || u16(bytes, 0) === 2) && u16(bytes, 2) === 9))) return convertWmf(bytes);
  return undefined;
}

function convertEmf(b: Uint8Array): string | undefined {
  const bounds = { left: i32(b, 8), top: i32(b, 12), right: i32(b, 16), bottom: i32(b, 20) };
  const frame = { left: i32(b, 24), top: i32(b, 28), right: i32(b, 32), bottom: i32(b, 36) };
  const deviceW = i32(b, 72) || 1024;
  const mmW = i32(b, 80) || 320;
  const pxPerMm = deviceW / mmW;
  let box = { x: bounds.left, y: bounds.top, w: bounds.right - bounds.left + 1, h: bounds.bottom - bounds.top + 1 };
  if (box.w <= 1 || box.h <= 1) {
    // Bornes vides : utilise le cadre (0,01 mm) converti en pixels du peripherique.
    box = { x: 0, y: 0, w: Math.max(1, ((frame.right - frame.left) / 100) * pxPerMm), h: Math.max(1, ((frame.bottom - frame.top) / 100) * pxPerMm) };
  }
  const canvas = new MetafileCanvas(box, pxPerMm);
  const objects = new Map<number, () => void>();
  const stack: ReturnType<MetafileCanvas['snapshot']>[] = [];
  let pos = 0;
  for (let n = 0; n < MAX_RECORDS && pos + 8 <= b.length; n++) {
    const type = u32(b, pos);
    const size = u32(b, pos + 4);
    if (size < 8 || size % 4 !== 0 || pos + size > b.length) break;
    const r = pos + 8;
    const end = pos + size;
    const pts32 = (at: number, count: number): Array<[number, number]> => Array.from({ length: Math.min(count, (end - at) >> 3) }, (_, i) => [i32(b, at + i * 8), i32(b, at + i * 8 + 4)]);
    const pts16 = (at: number, count: number): Array<[number, number]> => Array.from({ length: Math.min(count, (end - at) >> 2) }, (_, i) => [(u16(b, at + i * 4) << 16) >> 16, (u16(b, at + i * 4 + 2) << 16) >> 16]);
    switch (type) {
      case 14: pos = b.length; break;
      case 9: canvas.setWindowExt(i32(b, r), i32(b, r + 4)); break;
      case 10: canvas.setWindowOrg(i32(b, r), i32(b, r + 4)); break;
      case 11: canvas.setViewportExt(i32(b, r), i32(b, r + 4)); break;
      case 12: canvas.setViewportOrg(i32(b, r), i32(b, r + 4)); break;
      case 17: canvas.setMapMode(u32(b, r)); break;
      case 18: canvas.state.opaque = u32(b, r) === 2; break;
      case 19: canvas.state.evenOdd = u32(b, r) === 1; break;
      case 22: canvas.state.textAlign = u32(b, r); break;
      case 24: canvas.state.textColor = u32(b, r); break;
      case 25: canvas.state.bkColor = u32(b, r); break;
      case 27: canvas.moveTo(i32(b, r), i32(b, r + 4)); break;
      case 54: canvas.lineTo(i32(b, r), i32(b, r + 4)); break;
      case 33: stack.push(canvas.snapshot()); break;
      case 34: { const count = Math.min(stack.length, Math.max(1, -(i32(b, r)))); for (let k = 0; k < count; k++) { const s = stack.pop(); if (s) canvas.restore(s); } break; }
      case 35: canvas.setTransform([f32(b, r), f32(b, r + 4), f32(b, r + 8), f32(b, r + 12), f32(b, r + 16), f32(b, r + 20)]); break;
      case 36: {
        const x: Xform = [f32(b, r), f32(b, r + 4), f32(b, r + 8), f32(b, r + 12), f32(b, r + 16), f32(b, r + 20)];
        canvas.modifyTransform(x, u32(b, r + 24));
        break;
      }
      case 37: {
        const index = u32(b, r);
        if (index & 0x80000000) {
          const stock = index & 0x7fffffff;
          if (stock in STOCK_BRUSH) canvas.state.brush = STOCK_BRUSH[stock] ?? null;
          else if (stock in STOCK_PEN) canvas.state.pen = { color: STOCK_PEN[stock] ?? null, width: 1, dash: undefined };
        } else objects.get(index)?.();
        break;
      }
      case 38: {
        const id = u32(b, r);
        const style = u32(b, r + 4) & 0xff;
        const width = i32(b, r + 8);
        const color = canvas.color(u32(b, r + 16));
        objects.set(id, () => { canvas.state.pen = { color: style === 5 ? null : color, width, dash: canvas.dash(style) }; });
        break;
      }
      case 95: {
        const id = u32(b, r);
        const style = u32(b, r + 20) & 0xff;
        const width = u32(b, r + 24);
        const color = canvas.color(u32(b, r + 32));
        objects.set(id, () => { canvas.state.pen = { color: style === 5 ? null : color, width, dash: canvas.dash(style) }; });
        break;
      }
      case 39: {
        const id = u32(b, r);
        const style = u32(b, r + 4);
        const color = canvas.color(u32(b, r + 8));
        objects.set(id, () => { canvas.state.brush = style === 1 ? null : color; });
        break;
      }
      case 82: {
        const id = u32(b, r);
        const height = i32(b, r + 4);
        const font = { height: Math.abs(height) || 12, bold: i32(b, r + 20) >= 600, italic: b[r + 24] !== 0, underline: b[r + 25] !== 0, strike: b[r + 26] !== 0, angle: i32(b, r + 12) / 10, family: utf16(b, r + 32, 32) || 'Arial' };
        objects.set(id, () => { canvas.state.font = font; });
        break;
      }
      case 40: objects.delete(u32(b, r)); break;
      case 59: canvas.beginPath(); break;
      case 60: canvas.endPath(); break;
      case 61: canvas.closeFigure(); break;
      case 62: canvas.paintPath(true, false); break;
      case 63: canvas.paintPath(true, true); break;
      case 64: canvas.paintPath(false, true); break;
      case 43: canvas.rect(i32(b, r), i32(b, r + 4), i32(b, r + 8), i32(b, r + 12)); break;
      case 42: canvas.ellipse(i32(b, r), i32(b, r + 4), i32(b, r + 8), i32(b, r + 12)); break;
      case 44: canvas.rect(i32(b, r), i32(b, r + 4), i32(b, r + 8), i32(b, r + 12), i32(b, r + 16) / 2, i32(b, r + 20) / 2); break;
      case 3: canvas.poly(pts32(r + 20, u32(b, r + 16)), true); break;
      case 4: canvas.poly(pts32(r + 20, u32(b, r + 16)), false); break;
      case 86: canvas.poly(pts16(r + 20, u32(b, r + 16)), true); break;
      case 87: canvas.poly(pts16(r + 20, u32(b, r + 16)), false); break;
      case 5: canvas.bezier(pts32(r + 20, u32(b, r + 16)), true); break;
      case 2: canvas.bezier(pts32(r + 20, u32(b, r + 16)), false); break;
      case 88: canvas.bezier(pts16(r + 20, u32(b, r + 16)), true); break;
      case 85: canvas.bezier(pts16(r + 20, u32(b, r + 16)), false); break;
      case 6: canvas.polyTo(pts32(r + 20, u32(b, r + 16))); break;
      case 89: canvas.polyTo(pts16(r + 20, u32(b, r + 16))); break;
      case 8: case 91: {
        const polys = u32(b, r + 16);
        const total = u32(b, r + 20);
        const counts = Array.from({ length: Math.min(polys, 4096) }, (_, i) => u32(b, r + 24 + i * 4));
        const at = r + 24 + polys * 4;
        const all = type === 8 ? pts32(at, total) : pts16(at, total);
        let offset = 0;
        for (const c of counts) { canvas.poly(all.slice(offset, offset + c), true, true); offset += c; }
        canvas.flushCompound();
        break;
      }
      case 84: case 83: {
        const x = i32(b, r + 28);
        const y = i32(b, r + 32);
        const chars = u32(b, r + 36);
        const off = u32(b, r + 40);
        if (off + chars * (type === 84 ? 2 : 1) <= size && chars < 8192) {
          const text = type === 84 ? utf16(b, pos + off, chars) : new TextDecoder('windows-1252').decode(b.subarray(pos + off, pos + off + chars));
          canvas.text(x, y, text);
        }
        break;
      }
      case 81: case 80: {
        // STRETCHDIBITS / SETDIBITSTODEVICE : en-tete DIB + bits.
        const offBmi = u32(b, r + 40);
        const cbBmi = u32(b, r + 44);
        const offBits = u32(b, r + 48);
        const cbBits = u32(b, r + 52);
        const dest = type === 81 ? { x: i32(b, r + 16), y: i32(b, r + 20), w: i32(b, r + 64), h: i32(b, r + 68) } : { x: i32(b, r + 16), y: i32(b, r + 20), w: u32(b, r + 32), h: u32(b, r + 36) };
        canvas.dib(b.subarray(pos + offBmi, pos + offBmi + cbBmi), b.subarray(pos + offBits, pos + offBits + cbBits), dest.x, dest.y, dest.w, dest.h);
        break;
      }
      case 76: case 77: {
        const offBmi = u32(b, r + 76);
        const cbBmi = u32(b, r + 80);
        const offBits = u32(b, r + 84);
        const cbBits = u32(b, r + 88);
        if (cbBmi > 0) canvas.dib(b.subarray(pos + offBmi, pos + offBmi + cbBmi), b.subarray(pos + offBits, pos + offBits + cbBits), i32(b, r + 16), i32(b, r + 20), i32(b, r + 24), i32(b, r + 28));
        break;
      }
      default: break;
    }
    pos += size;
  }
  return canvas.svg();
}
