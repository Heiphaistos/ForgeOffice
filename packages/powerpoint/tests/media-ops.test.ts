import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchPlayback, volumeChoice } from '../src/app/media-ops.ts';

test('proprietes de lecture : valeurs par defaut retirees, le reste conserve', () => {
  assert.equal(patchPlayback(undefined, { volume: 100, auto: false }), undefined);
  assert.deepEqual(patchPlayback(undefined, { volume: 25, loop: true }), { volume: 25, loop: true });
  assert.deepEqual(patchPlayback({ volume: 25, loop: true, auto: true }, { loop: false }), { volume: 25, auto: true });
  assert.equal(patchPlayback({ auto: true }, { auto: false }), undefined);
});

test('volume : choix le plus proche', () => {
  assert.deepEqual([undefined, 0, 20, 55, 90].map(volumeChoice), ['high', 'mute', 'low', 'medium', 'high']);
});
