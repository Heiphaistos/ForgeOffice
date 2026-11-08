// Mot de passe de protection du document (w:documentProtection) : empreinte SHA-512 salee, comme Word 2013 et suivants.
// Algorithme : H0 = SHA-512(sel + mot de passe UTF-16LE) ; Hn = SHA-512(Hn-1 + n sur 4 octets little-endian), n = 0 .. tours - 1.
import type { PasswordHash } from '../model-props.ts';

export const DEFAULT_SPIN_COUNT = 100000;

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function sha512(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-512', data as BufferSource));
}

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};

function utf16le(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out[i * 2] = c & 0xff;
    out[i * 2 + 1] = c >> 8;
  }
  return out;
}

/** Empreinte d'un mot de passe ; `salt` (base64) fixe le sel pour une verification ou un test. */
export async function hashPassword(password: string, salt?: string, spinCount = DEFAULT_SPIN_COUNT): Promise<PasswordHash> {
  const saltBytes = salt ? fromBase64(salt) : globalThis.crypto.getRandomValues(new Uint8Array(16));
  let h = await sha512(concat(saltBytes, utf16le(password)));
  const counter = new Uint8Array(4);
  const view = new DataView(counter.buffer);
  for (let i = 0; i < spinCount; i++) {
    view.setUint32(0, i, true);
    h = await sha512(concat(h, counter));
  }
  return { hash: toBase64(h), salt: toBase64(saltBytes), spinCount };
}

/** Vrai si le mot de passe correspond a l'empreinte enregistree. */
export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  return (await hashPassword(password, stored.salt, stored.spinCount)).hash === stored.hash;
}
