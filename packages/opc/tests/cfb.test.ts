// Lecteur CFB : mini-flux (flux < 4096 octets), flux ordinaires et garde-fous.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CfbFile, isCfb } from '../src/index.ts';
import { buildCfbWithMiniStream } from './cfb-builder.ts';

const pattern = (n: number, seed: number): Uint8Array => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);

test('CFB : petits flux lus dans le mini-flux, gros flux en secteurs', () => {
  const streams: [string, Uint8Array][] = [['Petit', pattern(100, 1)], ['Moyen', pattern(3000, 2)], ['Gros', pattern(9000, 3)], ['Un', pattern(1, 4)]];
  const bytes = buildCfbWithMiniStream(streams);
  assert.ok(isCfb(bytes));
  const cfb = new CfbFile(bytes);
  for (const [name, data] of streams) assert.deepEqual(cfb.stream(name), data, name);
  assert.equal(cfb.stream('absent'), undefined);
});

test('CFB : fichier tronque ou chaine bouclee ne boucle pas et ne leve que CfbError', () => {
  const bytes = buildCfbWithMiniStream([['Petit', pattern(300, 1)], ['Gros', pattern(5000, 2)]]);
  for (const cut of [100, 600, 1500, 3000]) {
    try {
      new CfbFile(bytes.subarray(0, cut)).stream('Gros');
    } catch (error) {
      assert.equal((error as Error).constructor.name, 'CfbError');
    }
  }
});
