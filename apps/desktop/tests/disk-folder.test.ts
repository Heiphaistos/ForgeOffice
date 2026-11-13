// Dossier sur le vrai disque : la page n'envoie que la racine choisie et des chemins relatifs, avec les commandes de src-tauri/src/folder_cmds.rs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDiskFolder, decodeFrame } from '../../web/src/platform/tauri.ts';

type Call = { command: string; args: unknown };

function fakeShell(reply: (command: string) => unknown = () => undefined) {
  const calls: Call[] = [];
  const call = (command: string, args?: unknown): Promise<never> => {
    calls.push({ command, args });
    return Promise.resolve(reply(command) as never);
  };
  return { calls, call: call as never };
}

test('chaque operation designe la racine et un chemin relatif', async () => {
  const { calls, call } = fakeShell((c) => (c === 'folder_exists' ? true : c === 'folder_list' ? [{ rel: 'a.md', dir: false, size: 3 }] : undefined));
  const folder = createDiskFolder('notes', '/home/u/notes', call);
  assert.deepEqual([folder.name, folder.path], ['notes', '/home/u/notes']);
  assert.deepEqual(await folder.list(), [{ rel: 'a.md', dir: false, size: 3 }]);
  await folder.mkdir('sous');
  await folder.rename('a.md', 'sous/a.md');
  await folder.copy('sous', 'sous2');
  await folder.trash('sous2');
  assert.equal(await folder.exists('a.md'), true);
  assert.deepEqual(calls.map((c) => c.command), ['folder_list', 'folder_mkdir', 'folder_rename', 'folder_copy', 'folder_trash', 'folder_exists']);
  assert.deepEqual(calls[2]?.args, { root: '/home/u/notes', from: 'a.md', to: 'sous/a.md' });
  assert.deepEqual(calls[4]?.args, { root: '/home/u/notes', rel: 'sous2' });
});

test('ecriture : trame [en-tete {root, rel}][octets] ; lecture : octets bruts copies', async () => {
  const { calls, call } = fakeShell((c) => (c === 'folder_read' ? Uint8Array.from([1, 2, 3]).buffer : undefined));
  const folder = createDiskFolder('n', 'C:\\Notes', call);
  await folder.write('sous/b.md', Uint8Array.from([9, 8]));
  const sent = calls[0]?.args as Uint8Array;
  const { header, bytes } = decodeFrame(sent);
  assert.deepEqual(header, { root: 'C:\\Notes', rel: 'sous/b.md' });
  assert.deepEqual(bytes, Uint8Array.from([9, 8]));
  assert.deepEqual(await folder.read('b.md'), Uint8Array.from([1, 2, 3]));
});
