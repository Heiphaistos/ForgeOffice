// CMS / PKCS#7 SignedData detache (adbe.pkcs7.detached) : construction d'une signature RSA ou ECDSA avec WebCrypto,
// lecture et verification d'une signature existante, lecture des certificats X.509.
import {
  TAG, children, concat, ctx, expect, hex, nul, octets, oid, oidOf, readNode, seq, setOf, sortDer, tlv, utcTime, type Node,
} from './der.ts';
import { buf } from './pkcs12.ts';

export type HashName = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

export const HASH_OID: Readonly<Record<HashName, string>> = {
  'SHA-1': '1.3.14.3.2.26', 'SHA-256': '2.16.840.1.101.3.4.2.1', 'SHA-384': '2.16.840.1.101.3.4.2.2', 'SHA-512': '2.16.840.1.101.3.4.2.3',
};
const HASH_BY_OID = new Map<string, HashName>((Object.keys(HASH_OID) as HashName[]).map((h) => [HASH_OID[h], h]));

const OID = {
  data: '1.2.840.113549.1.7.1', signedData: '1.2.840.113549.1.7.2', contentType: '1.2.840.113549.1.9.3', messageDigest: '1.2.840.113549.1.9.4',
  signingTime: '1.2.840.113549.1.9.5', signingCertV2: '1.2.840.113549.1.9.16.2.47', rsa: '1.2.840.113549.1.1.1', ec: '1.2.840.10045.2.1',
  ecdsaSha256: '1.2.840.10045.4.3.2', ecdsaSha384: '1.2.840.10045.4.3.3', ecdsaSha512: '1.2.840.10045.4.3.4',
  commonName: '2.5.4.3', organization: '2.5.4.10', country: '2.5.4.6', email: '1.2.840.113549.1.9.1',
} as const;
const CURVES: Readonly<Record<string, { name: 'P-256' | 'P-384' | 'P-521'; size: number; hash: HashName; sigOid: string }>> = {
  '1.2.840.10045.3.1.7': { name: 'P-256', size: 32, hash: 'SHA-256', sigOid: OID.ecdsaSha256 },
  '1.3.132.0.34': { name: 'P-384', size: 48, hash: 'SHA-384', sigOid: OID.ecdsaSha384 },
  '1.3.132.0.35': { name: 'P-521', size: 66, hash: 'SHA-512', sigOid: OID.ecdsaSha512 },
};

const subtle = (): SubtleCrypto => globalThis.crypto.subtle;
export async function digest(hash: HashName, ...parts: Uint8Array[]): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest(hash, buf(concat(...parts))));
}

// --- Certificats X.509 ---

export interface CertInfo {
  /** « CN=..., O=... » */
  subject: string;
  issuer: string;
  commonName: string;
  serial: string;
  notBefore: Date;
  notAfter: Date;
  selfSigned: boolean;
  /** SubjectPublicKeyInfo (DER). */
  spki: Uint8Array;
  /** Issuer et numero de serie tels que codes dans le certificat (pour IssuerAndSerialNumber). */
  issuerDer: Uint8Array;
  serialDer: Uint8Array;
}

function text(n: Node): string {
  switch (n.tag) {
    case 0x1e: return new TextDecoder('utf-16be').decode(n.value);
    case 0x14: return new TextDecoder('latin1').decode(n.value);
    default: return new TextDecoder().decode(n.value);
  }
}

function nameString(name: Node): { text: string; cn: string } {
  const parts: string[] = [];
  let cn = '';
  const labels: Readonly<Record<string, string>> = { [OID.commonName]: 'CN', [OID.organization]: 'O', [OID.country]: 'C', [OID.email]: 'E', '2.5.4.11': 'OU', '2.5.4.7': 'L', '2.5.4.8': 'ST' };
  for (const rdn of children(name)) {
    for (const atv of children(rdn)) {
      const [k, v] = children(atv);
      if (!k || !v) continue;
      const id = oidOf(k);
      const value = text(v);
      if (id === OID.commonName) cn = value;
      parts.push(`${labels[id] ?? id}=${value}`);
    }
  }
  return { text: parts.join(', '), cn };
}

function time(n: Node): Date {
  const s = new TextDecoder().decode(n.value);
  const m = n.tag === TAG.UTC ? s.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/) : s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/);
  if (!m) return new Date(NaN);
  const y = n.tag === TAG.UTC ? (Number(m[1]) >= 50 ? 1900 : 2000) + Number(m[1]) : Number(m[1]);
  return new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)));
}

export function parseCert(der: Uint8Array): CertInfo {
  const cert = children(expect(readNode(der), TAG.SEQ, 'certificat'));
  const tbs = children(expect(cert[0], TAG.SEQ, 'TBSCertificate'));
  let i = tbs[0]?.tag === 0xa0 ? 1 : 0;
  const serialDer = expect(tbs[i++], TAG.INT, 'numero de serie');
  i++; // algorithme de signature
  const issuer = expect(tbs[i++], TAG.SEQ, 'emetteur');
  const validity = children(expect(tbs[i++], TAG.SEQ, 'validite'));
  const subject = expect(tbs[i++], TAG.SEQ, 'sujet');
  const spki = expect(tbs[i], TAG.SEQ, 'cle publique');
  const iss = nameString(issuer);
  const sub = nameString(subject);
  return {
    subject: sub.text, issuer: iss.text, commonName: sub.cn || sub.text, serial: hex(serialDer.value), notBefore: time(validity[0] as Node), notAfter: time(validity[1] as Node),
    selfSigned: hex(issuer.raw) === hex(subject.raw), spki: spki.raw, issuerDer: issuer.raw, serialDer: serialDer.raw,
  };
}

// --- Signature ---

interface KeyKind {
  hash: HashName;
  sigOid: string;
  importAlg: RsaHashedImportParams | EcKeyImportParams;
  signAlg: AlgorithmIdentifier | EcdsaParams;
  ecSize: number;
}

function keyKind(pkcs8: Uint8Array): KeyKind {
  const [, algId] = children(expect(readNode(pkcs8), TAG.SEQ, 'PKCS#8'));
  const [algOid, params] = children(expect(algId, TAG.SEQ, 'algorithme de cle'));
  const id = oidOf(expect(algOid, TAG.OID, 'OID'));
  if (id === OID.rsa) {
    return { hash: 'SHA-256', sigOid: OID.rsa, importAlg: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, signAlg: { name: 'RSASSA-PKCS1-v1_5' }, ecSize: 0 };
  }
  if (id === OID.ec && params) {
    const curve = CURVES[oidOf(params)];
    if (curve) return { hash: curve.hash, sigOid: curve.sigOid, importAlg: { name: 'ECDSA', namedCurve: curve.name }, signAlg: { name: 'ECDSA', hash: curve.hash }, ecSize: curve.size };
  }
  throw new Error('Type de clé non pris en charge pour la signature (RSA, ECDSA P-256/384/521).');
}

const trimInt = (b: Uint8Array): Uint8Array => {
  let i = 0;
  while (i < b.length - 1 && b[i] === 0) i++;
  return b.subarray(i);
};
const derInt = (b: Uint8Array): Uint8Array => {
  const t = trimInt(b);
  return tlv(TAG.INT, (t[0] ?? 0) & 0x80 ? concat(Uint8Array.of(0), t) : t);
};
const rawToDer = (raw: Uint8Array): Uint8Array => seq(derInt(raw.subarray(0, raw.length / 2)), derInt(raw.subarray(raw.length / 2)));
function derToRaw(der: Uint8Array, size: number): Uint8Array {
  const [r, s] = children(expect(readNode(der), TAG.SEQ, 'signature ECDSA'));
  const pad = (n: Node | undefined): Uint8Array => {
    const t = trimInt(n?.value ?? new Uint8Array(0));
    const out = new Uint8Array(size);
    out.set(t, size - t.length);
    return out;
  };
  return concat(pad(r), pad(s));
}

export interface SignInput {
  /** Empreinte (SHA-256 ou celle de la courbe) du document a signer, deja calculee. */
  digest: Uint8Array;
  /** Algorithme de l'empreinte ci-dessus. */
  hash: HashName;
  key: Uint8Array;
  certs: Uint8Array[];
  signingTime: Date;
}

/** Algorithme d'empreinte que la cle impose (SHA-256 pour RSA, selon la courbe pour ECDSA). */
export const hashForKey = (pkcs8: Uint8Array): HashName => keyKind(pkcs8).hash;

/** ContentInfo{ SignedData } DER detache, signe avec la cle privee. */
export async function buildSignedData(inp: SignInput): Promise<Uint8Array> {
  const kind = keyKind(inp.key);
  const signer = parseCert(inp.certs[0] as Uint8Array);
  const hashAlg = seq(oid(HASH_OID[inp.hash]), nul());
  const certHash = await digest(inp.hash, inp.certs[0] as Uint8Array);
  const attrs = [
    seq(oid(OID.contentType), setOf(oid(OID.data))),
    seq(oid(OID.signingTime), setOf(utcTime(inp.signingTime))),
    seq(oid(OID.messageDigest), setOf(octets(inp.digest))),
    seq(oid(OID.signingCertV2), setOf(seq(seq(seq(inp.hash === 'SHA-256' ? new Uint8Array(0) : hashAlg, octets(certHash)))))),
  ];
  const sorted = sortDer(attrs);
  const toSign = tlv(TAG.SET, ...sorted);
  const pkey = await subtle().importKey('pkcs8', buf(inp.key), kind.importAlg, false, ['sign']);
  let signature: Uint8Array = new Uint8Array(await subtle().sign(kind.signAlg, pkey, buf(toSign)));
  if (kind.ecSize) signature = rawToDer(signature);
  const sigAlg = seq(oid(kind.sigOid), ...(kind.ecSize ? [] : [nul()]));
  const signerInfo = seq(
    tlv(TAG.INT, Uint8Array.of(1)), seq(signer.issuerDer, signer.serialDer), hashAlg, tlv(0xa0, ...sorted), sigAlg, octets(signature),
  );
  const signedData = seq(
    tlv(TAG.INT, Uint8Array.of(1)), setOf(hashAlg), seq(oid(OID.data)), ctx(0, ...inp.certs), setOf(signerInfo),
  );
  return seq(oid(OID.signedData), ctx(0, signedData));
}

// --- Lecture et verification ---

export interface ParsedSignature {
  hash: HashName | null;
  certs: Uint8Array[];
  issuerDer: Uint8Array;
  serialDer: Uint8Array;
  /** Attributs signes, codes avec l'etiquette SET (c'est ce qui est signe). Null si la signature porte directement sur le contenu. */
  signedAttrs: Uint8Array | null;
  messageDigest: Uint8Array | null;
  signingTime: Date | null;
  sigOid: string;
  signature: Uint8Array;
}

export function parseSignedData(der: Uint8Array): ParsedSignature {
  const ci = children(expect(readNode(der), TAG.SEQ, 'ContentInfo'));
  if (oidOf(expect(ci[0], TAG.OID, 'OID')) !== OID.signedData) throw new Error('Ce n\'est pas une signature CMS.');
  const sd = children(expect(children(expect(ci[1], 0xa0, 'contenu'))[0], TAG.SEQ, 'SignedData'));
  const certNode = sd.find((n) => n.tag === 0xa0);
  const certs = certNode ? children(certNode).map((c) => c.raw) : [];
  const signerInfos = expect(sd[sd.length - 1], TAG.SET, 'SignerInfos');
  const si = children(expect(children(signerInfos)[0], TAG.SEQ, 'SignerInfo'));
  const [issuerSerial] = [si[1]];
  const [issuer, serial] = children(expect(issuerSerial, TAG.SEQ, 'IssuerAndSerialNumber'));
  const digestAlg = children(expect(si[2], TAG.SEQ, 'algorithme d\'empreinte'))[0];
  const attrsNode = si.find((n) => n.tag === 0xa0);
  const idx = si.findIndex((n) => n === attrsNode);
  const sigAlgNode = si[(idx >= 0 ? idx : 2) + 1];
  const sigNode = si[(idx >= 0 ? idx : 2) + 2];
  let messageDigest: Uint8Array | null = null;
  let signingTime: Date | null = null;
  if (attrsNode) {
    for (const a of children(attrsNode)) {
      const [k, v] = children(a);
      if (!k || !v) continue;
      const id = oidOf(k);
      const first = children(v)[0];
      if (id === OID.messageDigest && first) messageDigest = first.value;
      else if (id === OID.signingTime && first) signingTime = time(first);
    }
  }
  return {
    hash: HASH_BY_OID.get(oidOf(expect(digestAlg, TAG.OID, 'OID'))) ?? null, certs,
    issuerDer: expect(issuer, TAG.SEQ, 'emetteur').raw, serialDer: expect(serial, TAG.INT, 'serie').raw,
    signedAttrs: attrsNode ? concat(Uint8Array.of(0x31), attrsNode.raw.subarray(1)) : null, messageDigest, signingTime,
    sigOid: oidOf(expect(children(expect(sigAlgNode, TAG.SEQ, 'algorithme de signature'))[0], TAG.OID, 'OID')), signature: expect(sigNode, TAG.OCTETS, 'signature').value,
  };
}

/** Certificat du signataire parmi ceux inclus (emetteur + serie). */
export function signerCert(p: ParsedSignature): { der: Uint8Array; info: CertInfo } | null {
  for (const der of p.certs) {
    try {
      const info = parseCert(der);
      if (hex(info.issuerDer) === hex(p.issuerDer) && hex(info.serialDer) === hex(p.serialDer)) return { der, info };
    } catch {
      continue; // certificat illisible : on cherche le suivant
    }
  }
  return null;
}

/** Verifie la signature cryptographique (RSA PKCS#1 v1.5 ou ECDSA) du signataire. null = algorithme non gere. */
export async function verifyCryptoSignature(p: ParsedSignature, cert: CertInfo, signedContent: Uint8Array): Promise<boolean | null> {
  const [algId] = children(expect(readNode(cert.spki), TAG.SEQ, 'SPKI'));
  const [keyOid, params] = children(expect(algId, TAG.SEQ, 'algorithme'));
  const id = oidOf(expect(keyOid, TAG.OID, 'OID'));
  const hash = p.hash;
  if (!hash) return null;
  const data = p.signedAttrs ?? signedContent;
  if (id === OID.rsa && p.sigOid !== '1.2.840.113549.1.1.10') {
    const key = await subtle().importKey('spki', buf(cert.spki), { name: 'RSASSA-PKCS1-v1_5', hash }, false, ['verify']);
    return subtle().verify('RSASSA-PKCS1-v1_5', key, buf(p.signature), buf(data));
  }
  if (id === OID.ec && params) {
    const curve = CURVES[oidOf(params)];
    if (!curve) return null;
    const key = await subtle().importKey('spki', buf(cert.spki), { name: 'ECDSA', namedCurve: curve.name }, false, ['verify']);
    return subtle().verify({ name: 'ECDSA', hash }, key, buf(derToRaw(p.signature, curve.size)), buf(data));
  }
  return null;
}
