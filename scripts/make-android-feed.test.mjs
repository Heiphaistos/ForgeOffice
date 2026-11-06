// Verifie make-android-feed.mjs : node --test scripts/make-android-feed.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFeed } from './make-android-feed.mjs';

const f = (name) => ({ name, size: 10, sha256: 'ab'.repeat(32) });

test('une entree par architecture signee, les -unsigned sont ignores', () => {
  const feed = buildFeed({ version: '1.2.3', notes: 'n', files: [f('ForgeOffice_1.2.3_arm64-v8a.apk'), f('ForgeOffice_1.2.3_x86_64-unsigned.apk')] });
  assert.deepEqual(Object.keys(feed.apks), ['arm64-v8a']);
  assert.equal(feed.apks['arm64-v8a'].sha256.length, 64);
});

test('aucun APK signe : echec (jamais de flux vide)', () => {
  assert.throws(() => buildFeed({ version: '1.2.3', files: [f('ForgeOffice_1.2.3_arm64-v8a-unsigned.apk')] }), /aucun APK signe/);
});
