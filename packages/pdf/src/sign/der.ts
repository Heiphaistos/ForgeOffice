// ASN.1 DER minimal (lecture + ecriture) pour PKCS#12, certificats X.509 et CMS. Aucune dependance.

/** Noeud DER lu : `raw` = codage complet (tag + longueur + contenu), `value` = contenu seul. */
export interface Node {
  tag: number;
  raw: Uint8Array;
  value: Uint8Array;
}

/** Profondeur et taille bornees : le fichier est hostile. */
const MAX_LEN = 64 * 1024 * 1024;

export function readNode(buf: Uint8Array, pos = 0): Node {
  const tag = buf[pos];
  const first = buf[pos + 1];
  if (tag === undefined || first === undefined) throw new Error('DER tronque');
  if ((tag & 0x1f) === 0x1f) throw new Error('DER : etiquette longue non geree');
  let len = first;
  let hdr = 2;
  if (first & 0x80) {
    const count = first & 0x7f;
    if (count === 0 || count > 4) throw new Error('DER : longueur invalide');
    len = 0;
    for (let i = 0; i < count; i++) len = len * 256 + (buf[pos + 2 + i] ?? 0);
    hdr = 2 + count;
  }
  if (len > MAX_LEN || pos + hdr + len > buf.length) throw new Error('DER tronque');
  return { tag, raw: buf.subarray(pos, pos + hdr + len), value: buf.subarray(pos + hdr, pos + hdr + len) };
}

/** Enfants d'un noeud construit. */
export function children(node: Node): Node[] {
  const out: Node[] = [];
  for (let p = 0; p < node.value.length;) {
    const c = readNode(node.value, p);
    out.push(c);
    p += c.raw.length;
  }
  return out;
}

export const TAG = { INT: 0x02, BITS: 0x03, OCTETS: 0x04, NULL: 0x05, OID: 0x06, UTF8: 0x0c, SEQ: 0x30, SET: 0x31, UTC: 0x17, GENERALIZED: 0x18 } as const;

export function expect(node: Node | undefined, tag: number, what: string): Node {
  if (!node || node.tag !== tag) throw new Error(`DER : ${what} attendu`);
  return node;
}

export function oidOf(node: Node): string {
  const v = node.value;
  const parts: number[] = [Math.floor((v[0] ?? 0) / 40), (v[0] ?? 0) % 40];
  let cur = 0;
  for (let i = 1; i < v.length; i++) {
    cur = cur * 128 + ((v[i] ?? 0) & 0x7f);
    if (((v[i] ?? 0) & 0x80) === 0) {
      parts.push(cur);
      cur = 0;
    }
  }
  return parts.join('.');
}

export function intOf(node: Node): number {
  let n = 0;
  for (const b of node.value) n = n * 256 + b;
  return n;
}

// --- Ecriture ---

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function lengthBytes(n: number): Uint8Array {
  if (n < 0x80) return Uint8Array.of(n);
  const bytes: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 0xff);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

export const tlv = (tag: number, ...content: Uint8Array[]): Uint8Array => {
  const body = concat(...content);
  return concat(Uint8Array.of(tag), lengthBytes(body.length), body);
};

export const seq = (...c: Uint8Array[]): Uint8Array => tlv(TAG.SEQ, ...c);
export const octets = (b: Uint8Array): Uint8Array => tlv(TAG.OCTETS, b);
export const nul = (): Uint8Array => Uint8Array.of(TAG.NULL, 0);
/** Etiquette de contexte `[n]` construite. */
export const ctx = (n: number, ...c: Uint8Array[]): Uint8Array => tlv(0xa0 | n, ...c);

/** Elements d'un SET OF tries par leur codage (obligatoire en DER). */
export function sortDer(items: readonly Uint8Array[]): Uint8Array[] {
  const cmp = (a: Uint8Array, b: Uint8Array): number => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return (a[i] ?? 0) - (b[i] ?? 0);
    return a.length - b.length;
  };
  return [...items].sort(cmp);
}

export const setOf = (...items: Uint8Array[]): Uint8Array => tlv(TAG.SET, ...sortDer(items));

export function oid(dotted: string): Uint8Array {
  const p = dotted.split('.').map(Number);
  const out: number[] = [(p[0] ?? 0) * 40 + (p[1] ?? 0)];
  for (const v of p.slice(2)) {
    const stack = [v & 0x7f];
    for (let x = Math.floor(v / 128); x > 0; x = Math.floor(x / 128)) stack.unshift((x & 0x7f) | 0x80);
    out.push(...stack);
  }
  return tlv(TAG.OID, Uint8Array.from(out));
}

export function utcTime(d: Date): Uint8Array {
  const p = (n: number): string => String(n).padStart(2, '0');
  const s = `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  return tlv(TAG.UTC, new TextEncoder().encode(s));
}

export const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
export const fromHex = (h: string): Uint8Array => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
