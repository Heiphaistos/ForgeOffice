// Cadre d'onglet isole : les octets changent de contexte JavaScript (iframe <-> page hote) dans les deux sens, y compris vers les moteurs natifs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import type { Services } from '@forgeoffice/core';
import { embedServices, isBinary, localFile, recopy } from '../../web/src/tabs/embed.ts';

// Un autre contexte JavaScript : ses Uint8Array / ArrayBuffer ne sont pas `instanceof` ceux d'ici.
const foreign = <T,>(code: string): T => runInNewContext(code) as T;

test('un tampon d\'un autre contexte est reconnu comme binaire mais pas comme Uint8Array local', () => {
  const other = foreign<Uint8Array>('new Uint8Array([1, 2, 3])');
  assert.equal(other instanceof Uint8Array, false);
  assert.equal(isBinary(other), true);
  assert.equal(isBinary(foreign<ArrayBuffer>('new ArrayBuffer(4)')), true);
  assert.equal(isBinary({ a: 1 }), false);
  assert.equal(isBinary('abc'), false);
});

test('recopy : vues et tampons recopies dans le contexte demande, le reste inchange', () => {
  const view = recopy(foreign<Uint8Array>('new Uint8Array([7, 8, 9]).subarray(1)'), (b) => new Uint8Array(b)) as Uint8Array;
  assert.equal(view instanceof Uint8Array, true);
  assert.deepEqual([...view], [8, 9]);
  const buffer = recopy(foreign<ArrayBuffer>('new Uint8Array([5, 6]).buffer'), (b) => new Uint8Array(b)) as ArrayBuffer;
  assert.equal(buffer instanceof ArrayBuffer, true);
  assert.deepEqual([...new Uint8Array(buffer)], [5, 6]);
  const plain = { x: 1 };
  assert.equal(recopy(plain, (b) => b), plain);
  assert.equal(recopy(null, (b) => b), null);
});

test('localFile recopie les octets', () => {
  const f = localFile({ name: 'a', path: null, bytes: foreign<Uint8Array>('new Uint8Array([1])') });
  assert.equal(f?.bytes instanceof Uint8Array, true);
  assert.equal(localFile(null), null);
});

test('moteurs natifs depuis un cadre : arguments binaires recopies vers l\'hote, reponses recopiees vers le cadre', async () => {
  const seen: unknown[] = [];
  const hostBytes = (b: Uint8Array): Uint8Array => new Uint8Array(b);
  const host = {
    native: {
      invoke: (command: string, args?: unknown) => {
        seen.push([command, args]);
        return Promise.resolve(foreign<ArrayBuffer>('new Uint8Array([4, 5]).buffer'));
      },
    },
  } as unknown as Services;
  const embedded = embedServices(host, hostBytes);
  const frameFrame = foreign<Uint8Array>('new Uint8Array([9, 9, 9])');
  const reply = await embedded.native?.invoke<ArrayBuffer>('convert_run_bytes', frameFrame as never);
  const sent = (seen[0] as [string, unknown])[1];
  assert.equal(sent instanceof Uint8Array, true, 'l\'hote recoit un Uint8Array de son contexte');
  assert.deepEqual([...(sent as Uint8Array)], [9, 9, 9]);
  assert.equal(reply instanceof ArrayBuffer, true);
  assert.deepEqual([...new Uint8Array(reply as ArrayBuffer)], [4, 5]);
  await embedded.native?.invoke('base_op', { id: 1 });
  assert.deepEqual((seen[1] as [string, unknown])[1], { id: 1 });
  assert.equal(embedServices({ native: null } as unknown as Services, hostBytes).native, null);
});
