import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DiskEntry, DiskFolder, FileInfo, OpenedFile, Services } from '@forgeoffice/core';
import { fsFromDisk } from '../src/folderfs.ts';
import { buildCommands } from '../src/commands.ts';
import { DEFAULT_PREFS } from '../src/logic/prefs.ts';
import { Workspace } from '../src/workspace.ts';
import { fake, makeHost } from './fake.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** Faux dossier du vrai disque : memes appels que la coquille (src-tauri/src/folder_cmds.rs). */
function diskFolder(files: Record<string, string>, dirs: string[] = []) {
  const data = new Map(Object.entries(files).map(([k, v]) => [k, enc(v)]));
  const folders = new Set(dirs);
  const trashed: string[] = [];
  const disk: DiskFolder = {
    name: 'notes',
    path: '/home/u/notes',
    list: () => {
      const out: DiskEntry[] = [...folders].map((rel) => ({ rel, dir: true, size: 0 }));
      for (const [rel, b] of data) out.push({ rel, dir: false, size: b.length });
      return Promise.resolve(out);
    },
    read: (rel) => (data.has(rel) ? Promise.resolve(data.get(rel) as Uint8Array) : Promise.reject(new Error('absent'))),
    write: (rel, bytes) => {
      data.set(rel, bytes);
      return Promise.resolve();
    },
    mkdir: (rel) => {
      folders.add(rel);
      return Promise.resolve();
    },
    rename: (from, to) => {
      if (data.has(from)) {
        data.set(to, data.get(from) as Uint8Array);
        data.delete(from);
      }
      return Promise.resolve();
    },
    copy: (from, to) => {
      data.set(to, data.get(from) as Uint8Array);
      return Promise.resolve();
    },
    trash: (rel) => {
      data.delete(rel);
      trashed.push(rel);
      return Promise.resolve();
    },
    exists: (rel) => Promise.resolve(data.has(rel) || folders.has(rel)),
  };
  return { disk, data, trashed };
}

test('dossier du vrai disque : analyse, creation, enregistrement en place, corbeille du systeme', async () => {
  const { disk, data, trashed } = diskFolder({ 'a.md': '# A', 'sous/b.txt': 'bee', 'x.bin': 'a\0b', '.trash/vieux.md': 'v', 'node_modules/p.md': 'p' }, ['sous']);
  const f = fake();
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  const fs = fsFromDisk(disk);
  const scan = await fs.scan();
  assert.deepEqual(scan.files.map((x) => x.rel).sort(), ['a.md', 'sous/b.txt']);
  assert.deepEqual(scan.dirs, ['sous']);
  assert.equal(scan.skipped, 1, 'binaire ecarte ; .trash et node_modules ignores');
  ws.setFolder({ name: disk.name, files: scan.files, dirs: scan.dirs, fs });
  const ops = ws.folderOps;
  assert.equal(await ops.createFile('sous', 'neuf'), true);
  assert.equal(new TextDecoder().decode(data.get('sous/neuf.md')), '');
  const id = ws.openFolderFile('a.md') as string;
  ws.replaceText(id, '# A modifie');
  ws.patch(id, { dirty: true });
  assert.equal(await ws.save(id), true);
  assert.equal(new TextDecoder().decode(data.get('a.md')), '# A modifie');
  assert.equal(await ops.remove('a.md'), true);
  assert.deepEqual(trashed, ['a.md']);
  assert.ok(!data.has('a.md'), 'le fichier a quitte le dossier');
  assert.ok(!data.has('.trash/a.md'), 'jamais de dossier .trash cree par l application');
  assert.match(f.notices.at(-1) ?? '', /envoyé à la corbeille/);
  assert.equal(ws.tab(id)?.origin, null);
});

test('« Afficher dans l explorateur » : actif seulement avec la coquille de bureau et un fichier enregistre', () => {
  const ws = new Workspace(fake().services, DEFAULT_PREFS);
  ws.add({ name: 'a.txt', text: '', path: '/d/a.txt' });
  const revealed: string[] = [];
  const on = buildCommands(makeHost(ws, { canReveal: true, reveal: (p) => void revealed.push(p) })).find((c) => c.id === 'reveal');
  assert.equal(on?.disabled, false);
  on?.run();
  assert.deepEqual(revealed, ['/d/a.txt']);
  assert.equal(buildCommands(makeHost(ws)).find((c) => c.id === 'reveal')?.disabled, true, 'navigateur : grise');
  ws.add({ name: 'libre.txt', text: '' });
  assert.equal(buildCommands(makeHost(ws, { canReveal: true })).find((c) => c.id === 'reveal')?.disabled, true, 'sans chemin : grise');
});

test('rechargement : date et taille inchangees = aucune relecture ; changement = relecture', async () => {
  const f = fake();
  let reads = 0;
  let infoCalls = 0;
  let meta: FileInfo | null = { modifiedAt: 1000, size: 2 };
  const bytes = { current: enc('v1') };
  const services = {
    ...f.services,
    readFile: (): Promise<OpenedFile> => {
      reads++;
      return Promise.resolve({ name: 'n.txt', path: '/x/n.txt', bytes: bytes.current });
    },
    fileInfo: () => {
      infoCalls++;
      return Promise.resolve(meta);
    },
  } as unknown as Services;
  const ws = new Workspace(services, DEFAULT_PREFS);
  ws.openFile({ name: 'n.txt', path: '/x/n.txt', bytes: bytes.current });
  const id = ws.activeId;
  assert.equal(await ws.checkExternal(id), 'same');
  assert.equal(reads, 1, 'premier controle : une lecture pour memoriser date et taille');
  for (let i = 0; i < 5; i++) assert.equal(await ws.checkExternal(id), 'same');
  assert.equal(reads, 1, 'aucune relecture tant que date et taille sont les memes');
  assert.equal(infoCalls, 6);
  bytes.current = enc('v22');
  meta = { modifiedAt: 2000, size: 3 };
  assert.equal(await ws.checkExternal(id), 'reload');
  assert.equal(ws.text(id), 'v22');
  assert.equal(reads, 2);
  meta = null;
  assert.equal(await ws.checkExternal(id), 'missing', 'fichier disparu : texte garde');
  assert.equal(ws.text(id), 'v22');
});
