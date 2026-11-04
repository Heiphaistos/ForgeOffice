// Trame binaire page <-> coquille : meme octets que src-tauri/src/frame.rs (test `trame_commune_avec_la_page`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFile, decodeFrame, encodeFrame, toBytes } from '../../web/src/platform/tauri.ts';

// {"name":"a","path":null} (24 octets) puis les octets 1, 2.
const SHARED = Uint8Array.from([
  24, 0, 0, 0, ...new TextEncoder().encode('{"name":"a","path":null}'), 1, 2,
]);

test('encodeFrame produit la trame attendue par la coquille', () => {
  assert.deepEqual(encodeFrame({ name: 'a', path: null }, Uint8Array.from([1, 2])), SHARED);
});

test('aller-retour avec texte accentue et octets binaires', () => {
  const bytes = Uint8Array.from([0, 255, 128, 10, 13]);
  const frame = encodeFrame({ path: 'C:\Été\budget.xlsx', suggestedName: 'budget.xlsx' }, bytes);
  const { header, bytes: back } = decodeFrame(frame);
  assert.deepEqual(header, { path: 'C:\Été\budget.xlsx', suggestedName: 'budget.xlsx' });
  assert.deepEqual(back, bytes);
  assert.equal(back.byteOffset, 0, 'octets copies dans un tampon propre');
  assert.equal(back.buffer.byteLength, bytes.length);
});

test('decodeFile : reponse vide = annule, trame valide = fichier', () => {
  assert.equal(decodeFile(new ArrayBuffer(0)), null);
  const file = decodeFile(SHARED.buffer);
  assert.deepEqual(file, { name: 'a', path: null, bytes: Uint8Array.from([1, 2]) });
  const withPath = decodeFile(encodeFrame({ name: 'b.docx', path: '/home/u/b.docx' }, Uint8Array.from([9])));
  assert.equal(withPath?.path, '/home/u/b.docx');
});

test('trames invalides refusees', () => {
  assert.throws(() => decodeFrame(Uint8Array.from([1, 0])));
  assert.throws(() => decodeFrame(Uint8Array.from([200, 0, 0, 0, 123])));
  assert.throws(() => decodeFile(encodeFrame({ name: 42 })));
  assert.throws(() => decodeFile(encodeFrame('texte')));
  assert.throws(() => toBytes('pas des octets'));
});

test('toBytes accepte ArrayBuffer, vue et tableau', () => {
  assert.deepEqual(toBytes(Uint8Array.from([1, 2]).buffer), Uint8Array.from([1, 2]));
  assert.deepEqual(toBytes(new DataView(Uint8Array.from([3]).buffer)), Uint8Array.from([3]));
  assert.deepEqual(toBytes([4, 5]), Uint8Array.from([4, 5]));
});
