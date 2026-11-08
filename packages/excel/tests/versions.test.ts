// Historique de versions : empreinte, doublons, limite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { digestOf, pushVersion, type VersionInfo } from '../src/logic/versions.ts';

const v = (n: number, digest = `d${n}`): VersionInfo => ({ id: `v${n}`, name: 'a', at: `2026-11-0${n}T10:00:00Z`, size: n, digest });

test('empreinte stable et sensible au contenu', () => {
  assert.equal(digestOf(new Uint8Array([1, 2, 3])), digestOf(new Uint8Array([1, 2, 3])));
  assert.notEqual(digestOf(new Uint8Array([1, 2, 3])), digestOf(new Uint8Array([1, 2, 4])));
});

test('ajout en tete, doublon ignore, limite et versions evincees', () => {
  let list: VersionInfo[] = [];
  for (const n of [1, 2, 3]) list = pushVersion(list, v(n), 3).list;
  assert.deepEqual(list.map((x) => x.id), ['v3', 'v2', 'v1']);
  assert.deepEqual(pushVersion(list, v(9, 'd3'), 3).list.map((x) => x.id), ['v3', 'v2', 'v1'], 'meme contenu que la derniere : ignore');
  const r = pushVersion(list, v(4), 3);
  assert.deepEqual([r.list.map((x) => x.id), r.dropped.map((x) => x.id)], [['v4', 'v3', 'v2'], ['v1']]);
});
