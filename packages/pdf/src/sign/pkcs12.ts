// Lecture d'un fichier PKCS#12 (.pfx / .p12) protege par mot de passe : cle privee PKCS#8 + certificats X.509.
// Chiffrements pris en charge : PBES2 (PBKDF2 + AES-CBC, defaut d'OpenSSL 3 et des exports modernes) et
// pbeWithSHAAnd3-KeyTripleDES-CBC / 2-Key (exports Windows classiques). RC2-40 (tres ancien) : refuse avec un message clair.
import { TAG, children, concat, expect, intOf, oidOf, readNode, type Node } from './der.ts';
import { des3CbcDecrypt } from './des.ts';

export interface Pkcs12 {
  /** Cle privee PKCS#8 (DER). */
  key: Uint8Array;
  /** Certificat du signataire en premier, puis le reste de la chaine fournie (DER). */
  certs: Uint8Array[];
}

const OID = {
  data: '1.2.840.113549.1.7.1',
  encrypted: '1.2.840.113549.1.7.6',
  keyBag: '1.2.840.113549.1.12.10.1.1',
  shroudedKeyBag: '1.2.840.113549.1.12.10.1.2',
  certBag: '1.2.840.113549.1.12.10.1.3',
  localKeyId: '1.2.840.113549.1.9.21',
  pbes2: '1.2.840.113549.1.5.13',
  pbkdf2: '1.2.840.113549.1.5.12',
  des3: '1.2.840.113549.1.12.1.3',
  des2: '1.2.840.113549.1.12.1.4',
  rc2_40: '1.2.840.113549.1.12.1.6',
  rc2_128: '1.2.840.113549.1.12.1.5',
} as const;

const HASHES: Readonly<Record<string, { name: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'; len: number; block: number }>> = {
  '1.3.14.3.2.26': { name: 'SHA-1', len: 20, block: 64 },
  '2.16.840.1.101.3.4.2.1': { name: 'SHA-256', len: 32, block: 64 },
  '2.16.840.1.101.3.4.2.2': { name: 'SHA-384', len: 48, block: 128 },
  '2.16.840.1.101.3.4.2.3': { name: 'SHA-512', len: 64, block: 128 },
};
const PRF: Readonly<Record<string, 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'>> = {
  '1.2.840.113549.2.7': 'SHA-1', '1.2.840.113549.2.9': 'SHA-256', '1.2.840.113549.2.10': 'SHA-384', '1.2.840.113549.2.11': 'SHA-512',
};
const AES: Readonly<Record<string, number>> = { '2.16.840.1.101.3.4.1.2': 16, '2.16.840.1.101.3.4.1.22': 24, '2.16.840.1.101.3.4.1.42': 32 };

const MAX_ITERATIONS = 5_000_000;
export const WRONG_PASSWORD = 'Mot de passe du certificat incorrect (ou fichier corrompu).';
const subtle = (): SubtleCrypto => globalThis.crypto.subtle;
/** Copie dans un ArrayBuffer (type exige par WebCrypto). */
export function buf(u: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(u.length); // pas slice() : sur un Buffer Node, slice() renvoie une vue sur tout le tampon partage
  copy.set(u);
  return copy.buffer;
}

const bmp = (pw: string): Uint8Array => {
  if (pw === '') return new Uint8Array(0);
  const out = new Uint8Array(pw.length * 2 + 2);
  for (let i = 0; i < pw.length; i++) {
    const c = pw.charCodeAt(i);
    out[i * 2] = c >> 8;
    out[i * 2 + 1] = c & 0xff;
  }
  return out;
};

const repeat = (src: Uint8Array, len: number): Uint8Array => {
  const out = new Uint8Array(len);
  if (src.length > 0) for (let i = 0; i < len; i++) out[i] = src[i % src.length] ?? 0;
  return out;
};

/** Derivation de cle PKCS#12 (RFC 7292 annexe B.2). id : 1 = cle, 2 = IV, 3 = MAC. */
export async function pkcs12Kdf(id: number, password: string, salt: Uint8Array, iterations: number, n: number, hash: { name: string; len: number; block: number }): Promise<Uint8Array> {
  if (iterations < 1 || iterations > MAX_ITERATIONS) throw new Error('PKCS#12 : nombre d\'iterations invalide');
  const v = hash.block;
  const pw = bmp(password);
  const D = new Uint8Array(v).fill(id);
  const I = concat(salt.length ? repeat(salt, v * Math.ceil(salt.length / v)) : new Uint8Array(0), pw.length ? repeat(pw, v * Math.ceil(pw.length / v)) : new Uint8Array(0));
  const blocks: Uint8Array[] = [];
  let total = 0;
  while (total < n) {
    let A = new Uint8Array(await subtle().digest(hash.name, buf(concat(D, I))));
    for (let r = 1; r < iterations; r++) A = new Uint8Array(await subtle().digest(hash.name, buf(A)));
    blocks.push(A);
    total += A.length;
    if (total >= n) break;
    const B = repeat(A, v);
    for (let j = 0; j < I.length; j += v) {
      let carry = 1;
      for (let k = v - 1; k >= 0; k--) {
        const sum = (I[j + k] ?? 0) + (B[k] ?? 0) + carry;
        I[j + k] = sum & 0xff;
        carry = sum >> 8;
      }
    }
  }
  return concat(...blocks).subarray(0, n);
}

/** Dechiffre un contenu PKCS#12/PKCS#8 d'apres son AlgorithmIdentifier. */
async function decrypt(alg: Node, data: Uint8Array, password: string): Promise<Uint8Array> {
  const [oidNode, params] = children(alg);
  const id = oidOf(expect(oidNode, TAG.OID, 'OID'));
  if (id === OID.pbes2) {
    const [kdfAlg, encAlg] = children(expect(params, TAG.SEQ, 'parametres PBES2'));
    const [kdfOid, kdfParams] = children(expect(kdfAlg, TAG.SEQ, 'KDF'));
    if (oidOf(expect(kdfOid, TAG.OID, 'OID')) !== OID.pbkdf2) throw new Error('PBES2 : fonction de derivation non prise en charge');
    const kp = children(expect(kdfParams, TAG.SEQ, 'parametres PBKDF2'));
    const salt = expect(kp[0], TAG.OCTETS, 'sel').value;
    const iterations = intOf(expect(kp[1], TAG.INT, 'iterations'));
    const prfNode = kp.find((k, i) => i >= 2 && k.tag === TAG.SEQ);
    const prf = prfNode ? PRF[oidOf(children(prfNode)[0] as Node)] : 'SHA-1';
    const [encOid, iv] = children(expect(encAlg, TAG.SEQ, 'chiffrement'));
    const keyLen = AES[oidOf(expect(encOid, TAG.OID, 'OID'))];
    if (!prf || !keyLen) throw new Error('PBES2 : algorithme non pris en charge (AES-CBC et HMAC-SHA seulement)');
    if (iterations < 1 || iterations > MAX_ITERATIONS) throw new Error('PBES2 : nombre d\'iterations invalide');
    const base = await subtle().importKey('raw', buf(new TextEncoder().encode(password)), 'PBKDF2', false, ['deriveKey']);
    const key = await subtle().deriveKey({ name: 'PBKDF2', salt: buf(salt), iterations, hash: prf }, base, { name: 'AES-CBC', length: keyLen * 8 }, false, ['decrypt']);
    try {
      return new Uint8Array(await subtle().decrypt({ name: 'AES-CBC', iv: buf(expect(iv, TAG.OCTETS, 'IV').value) }, key, buf(data)));
    } catch {
      throw new Error(WRONG_PASSWORD);
    }
  }
  if (id === OID.des3 || id === OID.des2) {
    const [saltNode, iterNode] = children(expect(params, TAG.SEQ, 'parametres PBE'));
    const salt = expect(saltNode, TAG.OCTETS, 'sel').value;
    const iterations = intOf(expect(iterNode, TAG.INT, 'iterations'));
    const sha1 = HASHES['1.3.14.3.2.26'] as { name: 'SHA-1'; len: number; block: number };
    const keyBytes = await pkcs12Kdf(1, password, salt, iterations, id === OID.des3 ? 24 : 16, sha1);
    const key = id === OID.des3 ? keyBytes : concat(keyBytes, keyBytes.subarray(0, 8));
    const iv = await pkcs12Kdf(2, password, salt, iterations, 8, sha1);
    const plain = des3CbcDecrypt(key, iv, data);
    if (!plain) throw new Error(WRONG_PASSWORD);
    return plain;
  }
  if (id === OID.rc2_40 || id === OID.rc2_128) throw new Error('Certificat chiffré en RC2 (très ancien) : réexportez-le en AES-256 (openssl pkcs12 -export) ou en 3DES.');
  throw new Error(`Chiffrement PKCS#12 non pris en charge (${id}).`);
}

interface Bag {
  id: string;
  value: Node;
  localKeyId: string | null;
}

async function safeBags(contents: Uint8Array, out: Bag[]): Promise<void> {
  for (const bag of children(expect(readNode(contents), TAG.SEQ, 'SafeContents'))) {
    const [bagId, bagValue, attrs] = children(expect(bag, TAG.SEQ, 'SafeBag'));
    let localKeyId: string | null = null;
    if (attrs?.tag === TAG.SET) {
      for (const attr of children(attrs)) {
        const [aid, aval] = children(attr);
        if (aid && aval && oidOf(aid) === OID.localKeyId) localKeyId = [...(children(aval)[0]?.value ?? [])].join(',');
      }
    }
    out.push({ id: oidOf(expect(bagId, TAG.OID, 'OID du sac')), value: children(expect(bagValue, 0xa0, 'valeur du sac'))[0] as Node, localKeyId });
  }
}

/** Module RSA d'un PKCS#8 (pour apparier le certificat) ; null pour une autre famille de cle. */
function rsaModulus(pkcs8: Uint8Array): string | null {
  try {
    const parts = children(readNode(pkcs8));
    const priv = expect(parts[2], TAG.OCTETS, 'cle');
    return [...(children(readNode(priv.value))[1]?.value ?? [])].join(',');
  } catch {
    return null;
  }
}

function certModulus(cert: Uint8Array): string | null {
  try {
    const tbs = children(readNode(cert))[0] as Node;
    const fields = children(tbs);
    const spki = fields.find((f, i) => f.tag === TAG.SEQ && i >= 5 && children(f)[0]?.tag === TAG.SEQ && children(f)[1]?.tag === TAG.BITS);
    const bits = children(spki as Node)[1] as Node;
    return [...(children(readNode(bits.value.subarray(1)))[0]?.value ?? [])].join(',');
  } catch {
    return null;
  }
}

export async function parsePkcs12(file: Uint8Array, password: string): Promise<Pkcs12> {
  const pfx = children(expect(readNode(file), TAG.SEQ, 'PKCS#12'));
  const authSafe = children(expect(pfx[1], TAG.SEQ, 'authSafe'));
  if (oidOf(expect(authSafe[0], TAG.OID, 'OID')) !== OID.data) throw new Error('PKCS#12 signe par cle publique : non pris en charge.');
  const content = expect(children(expect(authSafe[1], 0xa0, 'contenu'))[0], TAG.OCTETS, 'authSafe').value;

  const mac = pfx[2];
  if (mac) {
    const [digestInfo, macSalt, iter] = children(expect(mac, TAG.SEQ, 'MAC'));
    const [algId, digest] = children(expect(digestInfo, TAG.SEQ, 'DigestInfo'));
    const hash = HASHES[oidOf(children(expect(algId, TAG.SEQ, 'algorithme'))[0] as Node)];
    if (!hash) throw new Error('PKCS#12 : algorithme de MAC non pris en charge.');
    const key = await pkcs12Kdf(3, password, expect(macSalt, TAG.OCTETS, 'sel').value, iter ? intOf(iter) : 1, hash.len, hash);
    const hk = await subtle().importKey('raw', buf(key), { name: 'HMAC', hash: hash.name }, false, ['sign']);
    const expected = new Uint8Array(await subtle().sign('HMAC', hk, buf(content)));
    const got = expect(digest, TAG.OCTETS, 'MAC').value;
    if (expected.length !== got.length || expected.some((b, i) => b !== got[i])) throw new Error(WRONG_PASSWORD);
  }

  const bags: Bag[] = [];
  for (const info of children(expect(readNode(content), TAG.SEQ, 'AuthenticatedSafe'))) {
    const [typeNode, wrapped] = children(expect(info, TAG.SEQ, 'ContentInfo'));
    const type = oidOf(expect(typeNode, TAG.OID, 'OID'));
    const inner = children(expect(wrapped, 0xa0, 'contenu'))[0] as Node;
    if (type === OID.data) await safeBags(expect(inner, TAG.OCTETS, 'donnees').value, bags);
    else if (type === OID.encrypted) {
      const [, eci] = children(expect(inner, TAG.SEQ, 'EncryptedData'));
      const [, algId, encrypted] = children(expect(eci, TAG.SEQ, 'EncryptedContentInfo'));
      if (!encrypted) throw new Error('PKCS#12 : contenu chiffre vide');
      // [0] IMPLICIT OCTET STRING (peut etre construit en BER, jamais produit par les outils courants)
      await safeBags(await decrypt(expect(algId, TAG.SEQ, 'algorithme'), encrypted.value, password), bags);
    }
  }

  let key: Uint8Array | null = null;
  let keyId: string | null = null;
  for (const b of bags) {
    if (b.id === OID.keyBag) key = b.value.raw;
    else if (b.id === OID.shroudedKeyBag) {
      const [algId, data] = children(expect(b.value, TAG.SEQ, 'EncryptedPrivateKeyInfo'));
      key = await decrypt(expect(algId, TAG.SEQ, 'algorithme'), expect(data, TAG.OCTETS, 'cle chiffree').value, password);
    } else continue;
    keyId = b.localKeyId;
    break;
  }
  if (!key) throw new Error('Aucune clé privée dans ce certificat.');

  const certs: { der: Uint8Array; localKeyId: string | null }[] = [];
  for (const b of bags) {
    if (b.id !== OID.certBag) continue;
    const [, wrapped] = children(expect(b.value, TAG.SEQ, 'CertBag'));
    const der = expect(children(expect(wrapped, 0xa0, 'certificat'))[0], TAG.OCTETS, 'certificat').value;
    certs.push({ der, localKeyId: b.localKeyId });
  }
  if (certs.length === 0) throw new Error('Aucun certificat dans ce fichier.');
  const mod = rsaModulus(key);
  const own = certs.findIndex((c) => (keyId !== null && c.localKeyId === keyId) || (mod !== null && certModulus(c.der) === mod));
  const first = certs.splice(own < 0 ? 0 : own, 1);
  return { key, certs: [...first, ...certs].map((c) => c.der) };
}
