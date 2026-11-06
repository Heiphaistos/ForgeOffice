// Triple DES (EDE, CBC) en dechiffrement uniquement : WebCrypto ne l'offre pas et les anciens .pfx Windows l'utilisent.
// Implementation par tableaux de bits (quelques Ko a dechiffrer : la vitesse est sans importance). Verifiee contre OpenSSL dans les tests.

const IP = [58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7];
const FP = [40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25];
const E = [32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1];
const P = [16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25];
const PC1 = [57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4];
const PC2 = [14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32];
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
const SBOX: readonly (readonly number[])[] = [
  [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
    4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5,
    0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
    13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
    10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
    4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
    9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
    1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
    7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
];

const bitsOf = (b: Uint8Array): number[] => Array.from({ length: b.length * 8 }, (_, i) => ((b[i >> 3] ?? 0) >> (7 - (i & 7))) & 1);
const permute = (bits: readonly number[], table: readonly number[]): number[] => table.map((t) => bits[t - 1] ?? 0);

/** 16 sous-cles de 48 bits. */
function schedule(key8: Uint8Array): number[][] {
  const k = permute(bitsOf(key8), PC1);
  let c = k.slice(0, 28);
  let d = k.slice(28);
  return SHIFTS.map((s) => {
    c = [...c.slice(s), ...c.slice(0, s)];
    d = [...d.slice(s), ...d.slice(0, s)];
    return permute([...c, ...d], PC2);
  });
}

function crypt(block: Uint8Array, keys: readonly number[][], decrypt: boolean): Uint8Array {
  const ip = permute(bitsOf(block), IP);
  let l = ip.slice(0, 32);
  let r = ip.slice(32);
  for (let i = 0; i < 16; i++) {
    const k = keys[decrypt ? 15 - i : i] as number[];
    const x = permute(r, E).map((b, j) => b ^ (k[j] ?? 0));
    const out: number[] = [];
    for (let s = 0; s < 8; s++) {
      const g = x.slice(s * 6, s * 6 + 6);
      const row = ((g[0] ?? 0) << 1) | (g[5] ?? 0);
      const col = ((g[1] ?? 0) << 3) | ((g[2] ?? 0) << 2) | ((g[3] ?? 0) << 1) | (g[4] ?? 0);
      const v = SBOX[s]?.[row * 16 + col] ?? 0;
      out.push((v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1);
    }
    const f = permute(out, P);
    [l, r] = [r, l.map((b, j) => b ^ (f[j] ?? 0))];
  }
  const pre = permute([...r, ...l], FP);
  return Uint8Array.from({ length: 8 }, (_, i) => pre.slice(i * 8, i * 8 + 8).reduce((a, b) => (a << 1) | b, 0));
}

/** Dechiffre en 3DES-CBC (cle de 24 octets) et retire le bourrage PKCS#7 ; null si le bourrage est invalide (mauvaise cle). */
export function des3CbcDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array | null {
  if (key.length !== 24 || iv.length !== 8 || data.length === 0 || data.length % 8 !== 0) return null;
  const k1 = schedule(key.subarray(0, 8));
  const k2 = schedule(key.subarray(8, 16));
  const k3 = schedule(key.subarray(16, 24));
  const out = new Uint8Array(data.length);
  let prev = iv;
  for (let o = 0; o < data.length; o += 8) {
    const c = data.subarray(o, o + 8);
    const p = crypt(crypt(crypt(c, k3, true), k2, false), k1, true);
    for (let i = 0; i < 8; i++) out[o + i] = (p[i] ?? 0) ^ (prev[i] ?? 0);
    prev = c;
  }
  const pad = out[out.length - 1] ?? 0;
  if (pad < 1 || pad > 8 || out.subarray(out.length - pad).some((b) => b !== pad)) return null;
  return out.subarray(0, out.length - pad);
}
