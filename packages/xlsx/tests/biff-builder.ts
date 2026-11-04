// Fabrique de fichiers .xls de test : enregistrements BIFF8 ecrits a la main dans un conteneur OLE minimal.

export function u16(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff];
}

export function u32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

export function f64(n: number): number[] {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, n, true);
  return [...new Uint8Array(view.buffer)];
}

/** Chaine 8 bits « compressee » (sans octet d'options). */
export function latin(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0) & 0xff);
}

export function utf16(text: string): number[] {
  return [...text].flatMap((c) => u16(c.charCodeAt(0)));
}

export function rec(type: number, body: number[]): number[] {
  return [...u16(type), ...u16(body.length), ...body];
}

export function bof(dt: number, version = 0x0600): number[] {
  return rec(0x0809, [...u16(version), ...u16(dt), ...u16(0), ...u16(0), ...u32(0), ...u32(0)]);
}

export const EOF = rec(0x000a, []);

/** Conteneur OLE version 3 (secteurs de 512 octets) avec un seul flux. */
export function buildCfb(streamName: string, stream: Uint8Array): Uint8Array {
  const size = Math.max(stream.length, 4096);
  const sectors = Math.ceil(size / 512);
  if (sectors > 126) throw new Error('flux de test trop grand');
  const out = new Uint8Array(512 * (3 + sectors));
  const view = new DataView(out.buffer);
  out.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  view.setUint16(0x18, 0x3e, true);
  view.setUint16(0x1a, 3, true);
  view.setUint16(0x1c, 0xfffe, true);
  view.setUint16(0x1e, 9, true);
  view.setUint16(0x20, 6, true);
  view.setUint32(0x2c, 1, true);
  view.setUint32(0x30, 1, true);
  view.setUint32(0x38, 4096, true);
  view.setUint32(0x3c, 0xfffffffe, true);
  view.setUint32(0x44, 0xfffffffe, true);
  for (let i = 0; i < 109; i++) view.setUint32(0x4c + i * 4, i === 0 ? 0 : 0xffffffff, true);
  // Secteur 0 : FAT.
  const fat = 512;
  for (let i = 0; i < 128; i++) view.setUint32(fat + i * 4, 0xffffffff, true);
  view.setUint32(fat, 0xfffffffd, true);
  view.setUint32(fat + 4, 0xfffffffe, true);
  for (let s = 0; s < sectors; s++) view.setUint32(fat + (2 + s) * 4, s === sectors - 1 ? 0xfffffffe : 3 + s, true);
  // Secteur 1 : repertoire (racine + flux).
  const dir = 1024;
  const entry = (index: number, name: string, type: number, start: number, length: number, child: number): void => {
    const at = dir + index * 128;
    utf16(name).forEach((b, i) => { out[at + i] = b; });
    view.setUint16(at + 64, (name.length + 1) * 2, true);
    out[at + 66] = type;
    out[at + 67] = 1;
    view.setUint32(at + 68, 0xffffffff, true);
    view.setUint32(at + 72, 0xffffffff, true);
    view.setUint32(at + 76, child, true);
    view.setUint32(at + 116, start, true);
    view.setUint32(at + 120, length, true);
  };
  entry(0, 'Root Entry', 5, 0xfffffffe, 0, 1);
  entry(1, streamName, 2, 2, size, 0xffffffff);
  out.set(stream, 1536);
  return out;
}

/** Classeur BIFF8 : globaux + feuilles (les positions BOUNDSHEET sont calculees). */
export function buildXls(globals: number[][], sheets: { name: string; body: number[][]; hidden?: boolean }[], streamName = 'Workbook'): Uint8Array {
  const head = globals.flat();
  const boundSize = sheets.reduce((n, s) => n + 4 + 8 + s.name.length, 0);
  let offset = bof(0x0005).length + head.length + boundSize + EOF.length;
  const bounds: number[] = [];
  const bodies: number[] = [];
  for (const sheet of sheets) {
    const body = [...bof(0x0010), ...sheet.body.flat(), ...EOF];
    bounds.push(...rec(0x0085, [...u32(offset), sheet.hidden ? 1 : 0, 0, sheet.name.length, 0, ...latin(sheet.name)]));
    bodies.push(...body);
    offset += body.length;
  }
  return buildCfb(streamName, Uint8Array.from([...bof(0x0005), ...head, ...bounds, ...EOF, ...bodies]));
}
