// Decompression zlib / deflate : comparee a node:zlib sur des donnees variees, et gardes-fous.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateRawSync, deflateSync } from 'node:zlib';
import { inflate, InflateError } from '../src/index.ts';

const sample = (n: number, seed: number): Uint8Array => {
  let x = seed;
  return Uint8Array.from({ length: n }, (_, i) => { x = (x * 1103515245 + 12345) & 0x7fffffff; return i % 7 < 4 ? 65 + (i % 13) : x & 0xff; });
};

test('inflate : identique a node:zlib (niveaux 0, 1, 6, 9 ; zlib et deflate brut)', () => {
  for (const size of [0, 1, 100, 5000, 200_000]) {
    const data = sample(size, size + 3);
    for (const level of [0, 1, 6, 9]) {
      assert.deepEqual(inflate(new Uint8Array(deflateSync(data, { level }))), data, `zlib ${size}/${level}`);
      assert.deepEqual(inflate(new Uint8Array(deflateRawSync(data, { level })), { raw: true }), data, `raw ${size}/${level}`);
    }
  }
  const text = new TextEncoder().encode('abcabcabc'.repeat(1000));
  assert.deepEqual(inflate(new Uint8Array(deflateSync(text))), text);
});

test('inflate : flux tronque, corrompu ou bombe -> InflateError', () => {
  const packed = new Uint8Array(deflateSync(sample(5000, 1)));
  assert.throws(() => inflate(packed.subarray(0, 50)), InflateError);
  assert.throws(() => inflate(new Uint8Array([0x78, 0x9c, 0xff, 0xff, 0xff])), InflateError);
  assert.throws(() => inflate(new Uint8Array(deflateSync(new Uint8Array(1_000_000))), { maxBytes: 10_000 }), InflateError);
  assert.throws(() => inflate(new Uint8Array([1, 2, 3])), InflateError);
});
