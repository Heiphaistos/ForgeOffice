// Decompression zlib / deflate synchrone et bornee (d'apres « puff » de Mark Adler), sans dependance :
// images EMF/WMF compressees des .doc et .ppt, flux compresses des anciens formats.

export class InflateError extends Error {}

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CODE_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface Huffman {
  count: Uint16Array;
  symbol: Uint16Array;
}

function huffman(lengths: ArrayLike<number>, n: number): Huffman {
  const count = new Uint16Array(16);
  for (let i = 0; i < n; i++) count[lengths[i] ?? 0] = (count[lengths[i] ?? 0] ?? 0) + 1;
  const offsets = new Uint16Array(16);
  for (let len = 1; len < 15; len++) offsets[len + 1] = (offsets[len] ?? 0) + (count[len] ?? 0);
  const symbol = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const len = lengths[i] ?? 0;
    if (!len) continue;
    symbol[offsets[len] ?? 0] = i;
    offsets[len] = (offsets[len] ?? 0) + 1;
  }
  return { count, symbol };
}

let fixedTables: { lit: Huffman; dist: Huffman } | undefined;
const fixed = (): { lit: Huffman; dist: Huffman } => {
  if (!fixedTables) {
    const lengths = new Uint8Array(288).fill(8, 0, 144).fill(9, 144, 256).fill(7, 256, 280).fill(8, 280, 288);
    fixedTables = { lit: huffman(lengths, 288), dist: huffman(new Uint8Array(30).fill(5), 30) };
  }
  return fixedTables;
};

/**
 * Decompresse un flux deflate (`raw`) ou zlib (defaut : en-tete de 2 octets ignore). Leve InflateError si le flux
 * est invalide ou depasse `maxBytes` (protection contre les bombes de decompression).
 */
export function inflate(data: Uint8Array, options: { raw?: boolean; maxBytes?: number } = {}): Uint8Array {
  const max = options.maxBytes ?? 256 * 1024 * 1024;
  let pos = options.raw ? 0 : 2;
  if (!options.raw && (data.length < 2 || ((data[0] ?? 0) & 0x0f) !== 8)) throw new InflateError('En-tête zlib invalide');
  let bitBuf = 0;
  let bitCount = 0;
  let out = new Uint8Array(Math.min(max, Math.max(1024, data.length * 4)));
  let outPos = 0;

  const bits = (need: number): number => {
    let value = bitBuf;
    while (bitCount < need) {
      if (pos >= data.length) throw new InflateError('Flux tronqué');
      value |= (data[pos++] ?? 0) << bitCount;
      bitCount += 8;
    }
    bitBuf = value >>> need;
    bitCount -= need;
    return value & ((1 << need) - 1);
  };
  const decode = (h: Huffman): number => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len <= 15; len++) {
      code |= bits(1);
      const count = h.count[len] ?? 0;
      if (code - count < first) return h.symbol[index + (code - first)] ?? 0;
      index += count;
      first += count;
      first <<= 1;
      code <<= 1;
    }
    throw new InflateError('Code invalide');
  };
  const push = (byte: number): void => {
    if (outPos >= out.length) {
      if (outPos >= max) throw new InflateError('Taille décompressée excessive');
      const bigger = new Uint8Array(Math.min(max, out.length * 2));
      bigger.set(out);
      out = bigger;
    }
    out[outPos++] = byte;
  };
  const codes = (lit: Huffman, dist: Huffman): void => {
    for (;;) {
      const symbol = decode(lit);
      if (symbol < 256) {
        push(symbol);
      } else if (symbol === 256) {
        return;
      } else {
        const s = symbol - 257;
        if (s >= 29) throw new InflateError('Longueur invalide');
        const length = (LENGTH_BASE[s] ?? 0) + bits(LENGTH_EXTRA[s] ?? 0);
        const d = decode(dist);
        if (d >= 30) throw new InflateError('Distance invalide');
        const distance = (DIST_BASE[d] ?? 0) + bits(DIST_EXTRA[d] ?? 0);
        if (distance > outPos) throw new InflateError('Distance hors fenêtre');
        for (let i = 0; i < length; i++) push(out[outPos - distance] ?? 0);
      }
    }
  };

  let last = 0;
  do {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitBuf = 0;
      bitCount = 0;
      if (pos + 4 > data.length) throw new InflateError('Flux tronqué');
      const len = (data[pos] ?? 0) | ((data[pos + 1] ?? 0) << 8);
      pos += 4;
      if (pos + len > data.length) throw new InflateError('Flux tronqué');
      for (let i = 0; i < len; i++) push(data[pos++] ?? 0);
    } else if (type === 1) {
      const { lit, dist } = fixed();
      codes(lit, dist);
    } else if (type === 2) {
      const nlen = bits(5) + 257;
      const ndist = bits(5) + 1;
      const ncode = bits(4) + 4;
      if (nlen > 286 || ndist > 30) throw new InflateError('Table invalide');
      const lengths = new Uint8Array(320);
      for (let i = 0; i < ncode; i++) lengths[CODE_ORDER[i] ?? 0] = bits(3);
      const lencode = huffman(lengths.subarray(0, 19), 19);
      lengths.fill(0);
      for (let index = 0; index < nlen + ndist;) {
        const symbol = decode(lencode);
        if (symbol < 16) {
          lengths[index++] = symbol;
          continue;
        }
        let repeat: number;
        let value = 0;
        if (symbol === 16) {
          if (index === 0) throw new InflateError('Répétition sans précédent');
          value = lengths[index - 1] ?? 0;
          repeat = 3 + bits(2);
        } else if (symbol === 17) {
          repeat = 3 + bits(3);
        } else {
          repeat = 11 + bits(7);
        }
        if (index + repeat > nlen + ndist) throw new InflateError('Table invalide');
        while (repeat--) lengths[index++] = value;
      }
      codes(huffman(lengths.subarray(0, nlen), nlen), huffman(lengths.subarray(nlen, nlen + ndist), ndist));
    } else {
      throw new InflateError('Type de bloc invalide');
    }
  } while (!last);
  return out.slice(0, outPos);
}
