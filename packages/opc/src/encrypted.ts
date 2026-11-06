// Dechiffrement des fichiers « Office Open XML chiffres » (.docx / .xlsx / .pptx avec mot de passe) :
// conteneur CFB avec les flux EncryptionInfo + EncryptedPackage ([MS-OFFCRYPTO]). Chiffrement standard
// (AES-128/192/256 ECB, SHA-1, Office 2007) et agile (AES-CBC, SHA-1/256/384/512, Office 2010+).
// Pur Web Crypto : fonctionne dans le navigateur et dans Node. Le HMAC d'integrite des donnees n'est pas verifie.
import { CfbError, CfbFile, isCfb } from './cfb.ts';
import { DEFAULT_LIMITS } from './package.ts';
import { children, isElement, parseXml, XmlError, type XmlElement } from './xml.ts';

/** Cause d'un echec : mot de passe incorrect, variante non geree, ou fichier abime. */
export type EncryptedFailure = 'password' | 'unsupported' | 'corrupt';

export class EncryptedOoxmlError extends Error {
  readonly kind: EncryptedFailure;
  constructor(kind: EncryptedFailure, message: string) {
    super(message);
    this.kind = kind;
  }
}

const MESSAGES = {
  password: 'Mot de passe incorrect.',
  unsupported: 'Ce type de chiffrement n\'est pas pris en charge.',
  corrupt: 'Le fichier chiffré est endommagé.',
} as const;

const fail = (kind: EncryptedFailure, detail = ''): never => {
  throw new EncryptedOoxmlError(kind, detail ? `${MESSAGES[kind]} (${detail})` : MESSAGES[kind]);
};

const ENCRYPTION_INFO = 'EncryptionInfo';
const ENCRYPTED_PACKAGE = 'EncryptedPackage';

/** Ouvre le conteneur CFB s'il porte EncryptionInfo + EncryptedPackage ; sinon undefined. */
function openContainer(bytes: Uint8Array): CfbFile | undefined {
  if (!isCfb(bytes)) return undefined;
  try {
    const cfb = new CfbFile(bytes);
    const names = new Set(cfb.entries.filter((e) => e.type === 2).map((e) => e.name.toLowerCase()));
    return names.has(ENCRYPTION_INFO.toLowerCase()) && names.has(ENCRYPTED_PACKAGE.toLowerCase()) ? cfb : undefined;
  } catch (error) {
    if (error instanceof CfbError) return undefined;
    throw error;
  }
}

/** Vrai si le fichier est un paquet OOXML chiffre par mot de passe (et non un .doc/.xls/.ppt ordinaire). */
export function isEncryptedOoxml(bytes: Uint8Array): boolean {
  return openContainer(bytes) !== undefined;
}

// ---------------------------------------------------------------- primitives

type HashName = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

const HASHES: Readonly<Record<string, HashName>> = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA384: 'SHA-384', SHA512: 'SHA-512' };

function hashName(raw: string | undefined): HashName {
  return HASHES[(raw ?? '').toUpperCase()] ?? fail('unsupported', `hachage ${raw ?? '?'}`);
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

const le32 = (n: number): Uint8Array => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n >>> 0, true);
  return out;
};

const utf16le = (text: string): Uint8Array => {
  const out = new Uint8Array(text.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < text.length; i++) view.setUint16(i * 2, text.charCodeAt(i), true);
  return out;
};

async function digest(algorithm: HashName, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest(algorithm, data as BufferSource));
}

/** Tronque ou complete (octet de remplissage) a `length` octets. */
function fit(data: Uint8Array, length: number, pad: number): Uint8Array {
  if (data.length >= length) return data.subarray(0, length);
  const out = new Uint8Array(length).fill(pad);
  out.set(data);
  return out;
}

/**
 * AES-CBC sans remplissage. Web Crypto exige un bourrage PKCS7 : on ajoute un bloc chiffre qui se dechiffre
 * en seize octets 0x10 (valide), que la bibliotheque retire ensuite.
 */
async function aesCbcDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  if (data.length === 0 || data.length % 16 !== 0) fail('corrupt', 'bloc AES');
  if (![16, 24, 32].includes(key.length)) fail('unsupported', `clé de ${key.length * 8} bits`);
  const aes = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-CBC', false, ['encrypt', 'decrypt']);
  const lastBlock = data.subarray(data.length - 16);
  const padding = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: lastBlock as BufferSource }, aes, new Uint8Array(16).fill(16) as BufferSource)).subarray(0, 16);
  const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv as BufferSource }, aes, concat(data, padding) as BufferSource);
  return new Uint8Array(plain);
}

/** AES-ECB par CBC a IV nul : P_i = CBC(C)_i xor C_(i-1). */
async function aesEcbDecrypt(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const out = await aesCbcDecrypt(key, new Uint8Array(16), data);
  for (let i = 16; i < out.length; i++) out[i] = (out[i] ?? 0) ^ (data[i - 16] ?? 0);
  return out;
}

const equalBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

// ---------------------------------------------------------------- chiffrement standard (Office 2007)

async function decryptStandard(info: Uint8Array, payload: Uint8Array, password: string): Promise<Uint8Array> {
  const view = new DataView(info.buffer, info.byteOffset, info.byteLength);
  if (info.length < 12 + 32 + 8) fail('corrupt', 'EncryptionInfo');
  const headerSize = view.getUint32(8, true);
  const headerEnd = 12 + headerSize;
  if (headerSize < 32 || headerEnd + 4 + 16 + 16 + 4 + 32 > info.length) fail('corrupt', 'en-tête');
  const algId = view.getUint32(12 + 8, true);
  const keyBits = view.getUint32(12 + 16, true) || 128;
  if ((algId !== 0 && (algId < 0x660e || algId > 0x6610)) || ![128, 192, 256].includes(keyBits)) fail('unsupported', 'algorithme standard');
  const saltSize = view.getUint32(headerEnd, true);
  if (saltSize !== 16) fail('corrupt', 'sel');
  const salt = info.subarray(headerEnd + 4, headerEnd + 20);
  const encVerifier = info.subarray(headerEnd + 20, headerEnd + 36);
  const hashSize = view.getUint32(headerEnd + 36, true);
  const encVerifierHash = info.subarray(headerEnd + 40, headerEnd + 72);
  // Cle : SHA-1 iteree 50000 fois, puis derivation « 0x36 / 0x5c » du bloc 0.
  let h = await digest('SHA-1', concat(salt, utf16le(password)));
  for (let i = 0; i < 50_000; i++) h = await digest('SHA-1', concat(le32(i), h));
  const hFinal = await digest('SHA-1', concat(h, le32(0)));
  const xorBlock = (pad: number): Uint8Array => Uint8Array.from({ length: 64 }, (_, i) => pad ^ (hFinal[i] ?? 0));
  const x1 = await digest('SHA-1', xorBlock(0x36));
  const x2 = await digest('SHA-1', xorBlock(0x5c));
  const key = concat(x1, x2).subarray(0, keyBits / 8);
  const verifier = await aesEcbDecrypt(key, encVerifier);
  const verifierHash = (await aesEcbDecrypt(key, encVerifierHash)).subarray(0, Math.min(hashSize, 20));
  if (!equalBytes(await digest('SHA-1', verifier), verifierHash)) fail('password');
  const size = packageSize(payload);
  const padded = Math.ceil(size / 16) * 16;
  if (payload.length < 8 + padded) fail('corrupt', 'données tronquées');
  const decrypted = await aesEcbDecrypt(key, payload.subarray(8, 8 + padded));
  return decrypted.subarray(0, size);
}

// ---------------------------------------------------------------- chiffrement agile (Office 2010+)

const BLOCK_VERIFIER_INPUT = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
const BLOCK_VERIFIER_VALUE = new Uint8Array([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]);
const BLOCK_KEY = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);
const SEGMENT = 4096;
const MAX_SPIN = 10_000_000;

const localName = (name: string): string => name.slice(name.indexOf(':') + 1);

function find(parent: XmlElement | undefined, name: string): XmlElement | undefined {
  return parent?.children.find((n): n is XmlElement => isElement(n) && localName(n.name) === name);
}

function b64(element: XmlElement, name: string): Uint8Array {
  const raw = element.attrs[name];
  if (!raw) return fail('corrupt', name);
  const text = atob(raw);
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}

const intAttr = (element: XmlElement, name: string): number => {
  const value = Number(element.attrs[name]);
  return Number.isInteger(value) && value > 0 ? value : fail('corrupt', name);
};

interface AgileCipher {
  hash: HashName;
  keyBytes: number;
  blockSize: number;
  salt: Uint8Array;
}

function agileCipher(element: XmlElement): AgileCipher {
  if (element.attrs['cipherAlgorithm'] !== 'AES' || element.attrs['cipherChaining'] !== 'ChainingModeCBC') fail('unsupported', 'algorithme agile');
  const blockSize = intAttr(element, 'blockSize');
  if (blockSize !== 16) fail('unsupported', 'taille de bloc');
  return { hash: hashName(element.attrs['hashAlgorithm']), keyBytes: intAttr(element, 'keyBits') / 8, blockSize, salt: b64(element, 'saltValue') };
}

async function decryptAgile(info: Uint8Array, payload: Uint8Array, password: string): Promise<Uint8Array> {
  let root: XmlElement;
  try {
    root = parseXml(new TextDecoder('utf-8').decode(info.subarray(8)));
  } catch (error) {
    if (error instanceof XmlError) return fail('corrupt', 'descripteur');
    throw error;
  }
  const keyData = find(root, 'keyData');
  const encryptedKey = find(find(find(root, 'keyEncryptors'), 'keyEncryptor'), 'encryptedKey')
    ?? children(find(root, 'keyEncryptors')).map((k) => find(k, 'encryptedKey')).find((k) => k !== undefined);
  if (!keyData || !encryptedKey) return fail('corrupt', 'descripteur');
  const data = agileCipher(keyData);
  const pass = agileCipher(encryptedKey);
  const spin = Number(encryptedKey.attrs['spinCount']);
  if (!Number.isInteger(spin) || spin < 0 || spin > MAX_SPIN) fail('corrupt', 'spinCount');
  let h = await digest(pass.hash, concat(pass.salt, utf16le(password)));
  for (let i = 0; i < spin; i++) h = await digest(pass.hash, concat(le32(i), h));
  const derive = async (block: Uint8Array): Promise<Uint8Array> => fit(await digest(pass.hash, concat(h, block)), pass.keyBytes, 0x36);
  const iv = fit(pass.salt, pass.blockSize, 0x36);
  const verifierInput = await aesCbcDecrypt(await derive(BLOCK_VERIFIER_INPUT), iv, b64(encryptedKey, 'encryptedVerifierHashInput'));
  const verifierValue = await aesCbcDecrypt(await derive(BLOCK_VERIFIER_VALUE), iv, b64(encryptedKey, 'encryptedVerifierHashValue'));
  const expected = await digest(pass.hash, verifierInput.subarray(0, intAttr(encryptedKey, 'saltSize')));
  if (!equalBytes(expected, verifierValue.subarray(0, expected.length))) fail('password');
  const secret = (await aesCbcDecrypt(await derive(BLOCK_KEY), iv, b64(encryptedKey, 'encryptedKeyValue'))).subarray(0, data.keyBytes);
  const size = packageSize(payload);
  const body = payload.subarray(8);
  const out = new Uint8Array(Math.ceil(size / 16) * 16);
  for (let index = 0, offset = 0; offset < out.length; index++, offset += SEGMENT) {
    const segIv = fit(await digest(data.hash, concat(data.salt, le32(index))), data.blockSize, 0x36);
    const end = Math.min(offset + SEGMENT, out.length);
    if (body.length < end) fail('corrupt', 'données tronquées');
    out.set(await aesCbcDecrypt(secret, segIv, body.subarray(offset, end)), offset);
  }
  return out.subarray(0, size);
}

// ---------------------------------------------------------------- point d'entree

/** Taille declaree (entier 64 bits) du paquet en clair, bornee par les plafonds d'OpcPackage. */
function packageSize(payload: Uint8Array): number {
  if (payload.length < 8) fail('corrupt', 'EncryptedPackage');
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const size = view.getUint32(0, true) + view.getUint32(4, true) * 2 ** 32;
  if (size > DEFAULT_LIMITS.maxTotalBytes || size > payload.length) fail('corrupt', 'taille');
  return size;
}

/**
 * Dechiffre un paquet OOXML chiffre et renvoie le zip en clair (a passer au lecteur docx/xlsx/pptx).
 * Leve EncryptedOoxmlError : `kind` vaut 'password' (mot de passe incorrect), 'unsupported' ou 'corrupt'.
 */
export async function decryptOoxml(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const cfb = openContainer(bytes);
  if (!cfb) return fail('corrupt', 'conteneur absent');
  const info = cfb.stream(ENCRYPTION_INFO);
  const payload = cfb.stream(ENCRYPTED_PACKAGE);
  if (!info || !payload || info.length < 8) return fail('corrupt', 'flux manquants');
  const view = new DataView(info.buffer, info.byteOffset, info.byteLength);
  const major = view.getUint16(0, true);
  const minor = view.getUint16(2, true);
  if (major === 4 && minor === 4) return decryptAgile(info, payload, password);
  if ((major === 2 || major === 3 || major === 4) && minor === 2) return decryptStandard(info, payload, password);
  return fail('unsupported', `version ${major}.${minor}`);
}
