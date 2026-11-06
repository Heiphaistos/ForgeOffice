// Fabrique de conteneurs CFB v3 pour les tests : flux < 4096 octets dans le mini-flux, les autres en secteurs de 512 octets.
const FREE = 0xffffffff;
const END = 0xfffffffe;
const FAT_SECTOR = 0xfffffffd;

export function buildCfbWithMiniStream(streams: [string, Uint8Array][]): Uint8Array {
  const sectorsOf = (n: number): number => Math.max(1, Math.ceil(n / 512));
  const small = streams.filter(([, d]) => d.length < 4096);
  const big = streams.filter(([, d]) => d.length >= 4096);
  // Mini-flux : chaque petit flux aligne sur 64 octets.
  const miniStarts = new Map<string, number>();
  let miniCount = 0;
  for (const [name, d] of small) {
    miniStarts.set(name, miniCount);
    miniCount += Math.max(1, Math.ceil(d.length / 64));
  }
  const miniStream = new Uint8Array(miniCount * 64);
  for (const [name, d] of small) miniStream.set(d, (miniStarts.get(name) ?? 0) * 64);
  const miniFat: number[] = new Array(miniCount).fill(FREE);
  for (const [name, d] of small) {
    const start = miniStarts.get(name) ?? 0;
    const count = Math.max(1, Math.ceil(d.length / 64));
    for (let i = 0; i < count; i++) miniFat[start + i] = i === count - 1 ? END : start + i + 1;
  }
  const dirSectors = sectorsOf((streams.length + 1) * 128);
  const miniFatSectors = miniCount ? sectorsOf(miniCount * 4) : 0;
  const miniStreamSectors = miniCount ? sectorsOf(miniStream.length) : 0;
  const dataSectors = big.reduce((n, [, d]) => n + sectorsOf(d.length), 0);
  let fatSectors = 1;
  while (fatSectors * 128 < fatSectors + dirSectors + miniFatSectors + miniStreamSectors + dataSectors) fatSectors++;
  const total = fatSectors + dirSectors + miniFatSectors + miniStreamSectors + dataSectors;
  const file = new Uint8Array(512 * (1 + total));
  const view = new DataView(file.buffer);
  const u16 = (o: number, v: number): void => view.setUint16(o, v, true);
  const u32 = (o: number, v: number): void => view.setUint32(o, v >>> 0, true);
  file.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  u16(0x18, 0x3e); u16(0x1a, 3); u16(0x1c, 0xfffe); u16(0x1e, 9); u16(0x20, 6);
  u32(0x2c, fatSectors); u32(0x30, fatSectors);
  u32(0x38, 4096);
  const miniFatStart = fatSectors + dirSectors;
  u32(0x3c, miniCount ? miniFatStart : END);
  u32(0x40, miniFatSectors);
  u32(0x44, END);
  for (let i = 0; i < 109; i++) u32(0x4c + i * 4, i < fatSectors ? i : FREE);
  const fat: number[] = new Array(fatSectors * 128).fill(FREE);
  for (let i = 0; i < fatSectors; i++) fat[i] = FAT_SECTOR;
  const chain = (start: number, count: number): void => {
    for (let i = 0; i < count; i++) fat[start + i] = i === count - 1 ? END : start + i + 1;
  };
  chain(fatSectors, dirSectors);
  const sector = (n: number): number => 512 * (1 + n);
  if (miniCount) {
    chain(miniFatStart, miniFatSectors);
    miniFat.forEach((v, i) => u32(sector(miniFatStart) + i * 4, v));
    for (let i = miniFat.length; i < miniFatSectors * 128; i++) u32(sector(miniFatStart) + i * 4, FREE);
  }
  const miniStreamStart = miniFatStart + miniFatSectors;
  if (miniCount) {
    chain(miniStreamStart, miniStreamSectors);
    file.set(miniStream, sector(miniStreamStart));
  }
  const dirAt = sector(fatSectors);
  const entry = (index: number, name: string, type: number, start: number, size: number): void => {
    const o = dirAt + index * 128;
    for (let i = 0; i < name.length; i++) u16(o + i * 2, name.charCodeAt(i));
    u16(o + 0x40, (name.length + 1) * 2);
    file[o + 0x42] = type;
    file[o + 0x43] = 1;
    u32(o + 0x44, FREE); u32(o + 0x48, FREE);
    u32(o + 0x4c, type === 5 ? 1 : FREE);
    u32(o + 0x74, start);
    u32(o + 0x78, size);
  };
  entry(0, 'Root Entry', 5, miniCount ? miniStreamStart : END, miniStream.length);
  let next = miniStreamStart + miniStreamSectors;
  streams.forEach(([name, d], i) => {
    if (d.length < 4096) {
      entry(i + 1, name, 2, miniStarts.get(name) ?? 0, d.length);
    } else {
      const count = sectorsOf(d.length);
      entry(i + 1, name, 2, next, d.length);
      chain(next, count);
      file.set(d, sector(next));
      next += count;
    }
  });
  fat.forEach((v, i) => u32(sector(Math.floor(i / 128)) + (i % 128) * 4, v));
  return file;
}
