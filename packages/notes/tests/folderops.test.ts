import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fsFromHandle, type DirH, type FileH, type FolderFs } from '../src/folderfs.ts';
import { baseName, isInside, joinRel, nameProblem, namesIn, parentOf, remapRel, uniqueName } from '../src/logic/fileops.ts';
import { folderRows } from '../src/logic/folder.ts';
import { buildCommands } from '../src/commands.ts';
import { DEFAULT_PREFS } from '../src/logic/prefs.ts';
import { Workspace } from '../src/workspace.ts';
import { fake, makeHost } from './fake.ts';

// --- Faux dossier en memoire, meme interface que les poignees de l'API File System Access ---

class MemFile implements FileH {
  readonly kind = 'file' as const;
  name: string;
  data: Uint8Array<ArrayBufferLike>;
  constructor(name: string, data: Uint8Array<ArrayBufferLike>) {
    this.name = name;
    this.data = data;
  }
  getFile() {
    const data = this.data;
    return Promise.resolve({ size: data.length, arrayBuffer: () => Promise.resolve(data.slice().buffer as ArrayBuffer) });
  }
  createWritable() {
    let next: Uint8Array<ArrayBufferLike> = new Uint8Array();
    return Promise.resolve({
      write: (d: Uint8Array) => {
        next = d;
        return Promise.resolve();
      },
      close: () => {
        this.data = next;
        return Promise.resolve();
      },
    });
  }
}

class MemDir implements DirH {
  readonly kind = 'directory' as const;
  name: string;
  entries = new Map<string, MemFile | MemDir>();
  constructor(name: string) {
    this.name = name;
  }
  async *values(): AsyncIterable<MemFile | MemDir> {
    for (const e of [...this.entries.values()]) yield e;
  }
  getFileHandle(name: string, o?: { create?: boolean }): Promise<MemFile> {
    let e = this.entries.get(name);
    if (!e && o?.create) {
      e = new MemFile(name, new Uint8Array());
      this.entries.set(name, e);
    }
    return e instanceof MemFile ? Promise.resolve(e) : Promise.reject(new Error('NotFoundError'));
  }
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<MemDir> {
    let e = this.entries.get(name);
    if (!e && o?.create) {
      e = new MemDir(name);
      this.entries.set(name, e);
    }
    return e instanceof MemDir ? Promise.resolve(e) : Promise.reject(new Error('NotFoundError'));
  }
  removeEntry(name: string): Promise<void> {
    return this.entries.delete(name) ? Promise.resolve() : Promise.reject(new Error('NotFoundError'));
  }
  put(path: string, text: string): MemDir {
    const parts = path.split('/');
    let dir: MemDir = this;
    for (const p of parts.slice(0, -1)) {
      let next = dir.entries.get(p);
      if (!(next instanceof MemDir)) {
        next = new MemDir(p);
        dir.entries.set(p, next);
      }
      dir = next;
    }
    const name = parts.at(-1) as string;
    dir.entries.set(name, new MemFile(name, new TextEncoder().encode(text)));
    return this;
  }
  read(path: string): string | null {
    let e: MemFile | MemDir | undefined = this;
    for (const p of path.split('/')) e = e instanceof MemDir ? e.entries.get(p) : undefined;
    return e instanceof MemFile ? new TextDecoder().decode(e.data) : null;
  }
  has(path: string): boolean {
    let e: MemFile | MemDir | undefined = this;
    for (const p of path.split('/')) e = e instanceof MemDir ? e.entries.get(p) : undefined;
    return e !== undefined;
  }
}

async function openWorkspace() {
  const root = new MemDir('notes').put('a.md', '# A\r\nun').put('sub/b.md', 'bee').put('sub/deep/c.txt', 'cee').put('data.bin', 'x\0y');
  const f = fake();
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  const fs = fsFromHandle(root);
  const scan = await fs.scan();
  ws.setFolder({ name: 'notes', files: scan.files, dirs: scan.dirs, fs });
  return { root, ws, f, ops: ws.folderOps };
}

test('noms : valides, interdits, reserves Windows', () => {
  assert.equal(nameProblem('note.md'), null);
  assert.equal(nameProblem('  '), 'Le nom est vide.');
  for (const bad of ['a/b', 'a\\b', 'a:b', 'a*', 'q?', '..', '.', 'fin.', 'nul', 'COM1.txt', 'x'.repeat(201)]) assert.notEqual(nameProblem(bad), null, bad);
  assert.equal(nameProblem('Éé ça.md'), null);
});

test('chemins : parent, jointure, interieur, renommage de dossier, copie sans ecrasement', () => {
  assert.deepEqual([parentOf('a/b/c.md'), parentOf('c.md'), baseName('a/b/c.md'), joinRel('', 'x'), joinRel('a', 'x')], ['a/b', '', 'c.md', 'x', 'a/x']);
  assert.deepEqual([isInside('a/b', 'a'), isInside('ab', 'a'), isInside('a', 'a'), isInside('x', '')], [true, false, true, true]);
  assert.equal(remapRel('a/b/c.md', 'a', 'z'), 'z/b/c.md');
  assert.equal(remapRel('ab/c.md', 'a', 'z'), 'ab/c.md');
  assert.equal(remapRel('a', 'a', 'z'), 'z');
  assert.equal(uniqueName('n.md', new Set(['x.md'])), 'n.md');
  assert.equal(uniqueName('n.md', new Set(['N.MD'])), 'n (copie).md');
  assert.equal(uniqueName('n.md', new Set(['n.md', 'n (copie).md'])), 'n (copie 2).md');
  assert.equal(uniqueName('dossier', new Set(['dossier'])), 'dossier (copie)');
  assert.deepEqual([...namesIn('sub', ['a.md', 'sub/b.md', 'sub/deep/c.txt'], ['sub/vide'])].sort(), ['b.md', 'deep', 'vide']);
  assert.deepEqual(folderRows(['a.md'], new Set(), ['vide', 'x/y']).map((r) => `${r.depth}${r.dir ? 'D' : 'F'}${r.name}`), ['0Dvide', '0Dx', '1Dy', '0Fa.md']);
});

test('analyse du dossier : fichiers texte avec leurs fins de ligne, sous-dossiers, binaire ecarte', async () => {
  const { ws } = await openWorkspace();
  const files = ws.folder?.files ?? [];
  assert.deepEqual(files.map((f) => f.rel).sort(), ['a.md', 'sub/b.md', 'sub/deep/c.txt']);
  assert.equal(files.find((f) => f.rel === 'a.md')?.eol, 'crlf');
  assert.deepEqual([...(ws.folder?.dirs ?? [])].sort(), ['sub', 'sub/deep']);
});

test('creer un fichier et un dossier : extension par defaut, doublon et nom invalide refuses', async () => {
  const { root, ws, f, ops } = await openWorkspace();
  assert.equal(await ops.createFile('sub', 'idee'), true);
  assert.equal(root.read('sub/idee.md'), '');
  assert.equal(ws.active?.origin, 'sub/idee.md', 'ouvert dans un onglet');
  assert.equal(await ops.createFile('sub', 'idee.md'), false);
  assert.match(f.notices.at(-1) ?? '', /existe déjà/);
  assert.equal(await ops.createFile('', 'a/b'), false);
  assert.equal(await ops.createDir('', 'neuf'), true);
  assert.ok(root.has('neuf'));
  assert.ok(ws.folder?.dirs?.includes('neuf'), 'dossier vide visible');
  assert.equal(await ops.createDir('', 'neuf'), false);
});

test('renommer : fichier et dossier, onglets ouverts suivent, ecrasement refuse', async () => {
  const { root, ws, ops } = await openWorkspace();
  const id = ws.openFolderFile('sub/b.md') as string;
  assert.equal(await ops.rename('sub', 'dossier'), true);
  assert.ok(!root.has('sub') && root.has('dossier/b.md') && root.has('dossier/deep/c.txt'));
  assert.equal(ws.tab(id)?.origin, 'dossier/b.md');
  assert.equal(ws.text(id), 'bee');
  assert.equal(await ops.rename('dossier/b.md', 'c2.md'), true);
  assert.equal(ws.tab(id)?.name, 'c2.md');
  assert.equal(await ops.rename('a.md', 'dossier'), false, 'meme nom qu un dossier');
  assert.equal(await ops.rename('a.md', 'a.md'), true, 'aucun changement');
  assert.equal(root.read('a.md'), '# A\r\nun');
});

test('dupliquer : copie sans ecraser, nom unique, dossier recursif', async () => {
  const { root, ops } = await openWorkspace();
  assert.equal(await ops.duplicate('a.md'), true);
  assert.equal(root.read('a (copie).md'), '# A\r\nun');
  assert.equal(await ops.duplicate('a.md'), true);
  assert.ok(root.has('a (copie 2).md'));
  assert.equal(await ops.duplicate('sub'), true);
  assert.equal(root.read('sub (copie)/deep/c.txt'), 'cee');
  assert.equal(root.read('sub/deep/c.txt'), 'cee', 'original intact');
});

test('deplacer : vers un dossier ou la racine, jamais dans soi-meme, collision refusee', async () => {
  const { root, ws, f, ops } = await openWorkspace();
  assert.equal(await ops.move('a.md', 'sub/deep'), true);
  assert.ok(root.has('sub/deep/a.md') && !root.has('a.md'));
  assert.equal(await ops.move('sub/b.md', ''), true);
  assert.ok(root.has('b.md'));
  assert.equal(await ops.move('sub', 'sub/deep'), false);
  assert.match(f.notices.at(-1) ?? '', /dans lui-même/);
  root.put('b2/c.txt', 'autre');
  await ops.refresh();
  assert.equal(await ops.move('b2/c.txt', 'sub/deep'), false, 'c.txt existe deja dans sub/deep');
  assert.equal(root.read('b2/c.txt'), 'autre');
  assert.deepEqual(ops.directories('sub').includes('sub/deep'), false);
  assert.ok(ws.folder);
});

test('supprimer : corbeille du dossier (.trash), onglets ouverts gardent leur texte, jamais de perte', async () => {
  const { root, ws, ops, f } = await openWorkspace();
  const id = ws.openFolderFile('a.md') as string;
  assert.equal(await ops.remove('a.md'), true);
  assert.ok(!root.has('a.md'));
  assert.equal(root.read('.trash/a.md'), '# A\r\nun');
  assert.equal(ws.tab(id)?.origin, null);
  assert.equal(ws.tab(id)?.dirty, true);
  assert.equal(ws.text(id), '# A\nun');
  assert.match(f.notices.at(-1) ?? '', /corbeille/);
  root.put('a.md', 'nouveau');
  await ops.refresh();
  assert.equal(await ops.remove('a.md'), true);
  assert.ok(root.has('.trash/a (copie).md'), 'deux suppressions du meme nom : aucune ecrasee');
  assert.ok(!(ws.folder?.files ?? []).some((x) => x.rel.startsWith('.trash')), 'corbeille masquee');
});

test('enregistrer un fichier du dossier : ecrit a sa place, fins de ligne conservees', async () => {
  const { root, ws } = await openWorkspace();
  const id = ws.openFolderFile('a.md') as string;
  assert.equal(ws.tab(id)?.eol, 'crlf');
  ws.replaceText(id, '# A\nmodifie');
  ws.patch(id, { dirty: true });
  assert.equal(await ws.save(id), true);
  assert.equal(root.read('a.md'), '# A\r\nmodifie');
  assert.equal(ws.tab(id)?.dirty, false);
  assert.equal(ws.folder?.files.find((x) => x.rel === 'a.md')?.text, '# A\nmodifie');
});

test('actualiser : voit les fichiers ajoutes dehors', async () => {
  const { root, ws, ops } = await openWorkspace();
  root.put('dehors.md', 'x');
  assert.equal(ws.folder?.files.some((x) => x.rel === 'dehors.md'), false);
  assert.equal(await ops.refresh(), true);
  assert.equal(ws.folder?.files.some((x) => x.rel === 'dehors.md'), true);
});

test('dossier en lecture seule : operations refusees avec explication, commandes grisees avec info-bulle', async () => {
  const f = fake();
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  ws.setFolder({ name: 'ro', files: [{ rel: 'x.md', text: 'x' }] });
  assert.equal(ws.folderOps.enabled, false);
  assert.equal(await ws.folderOps.createFile('', 'n'), false);
  assert.match(f.notices.at(-1) ?? '', /lecture seule/);
  const list = buildCommands(makeHost(ws));
  for (const id of ['newFile', 'newDir', 'renameEntry', 'duplicateEntry', 'moveEntry', 'deleteEntry', 'refreshFolder']) {
    const c = list.find((x) => x.id === id);
    assert.equal(c?.disabled, true, id);
    assert.match(c?.hint ?? '', /accès en écriture/, id);
  }
  const none = buildCommands(makeHost(new Workspace(f.services, DEFAULT_PREFS)));
  assert.match(none.find((x) => x.id === 'newFile')?.hint ?? '', /Aucun dossier ouvert/);
});

test('commandes : actives avec un dossier modifiable, la cible suit la ligne choisie ou l onglet actif', async () => {
  const { ws, ops } = await openWorkspace();
  const asked: string[] = [];
  const list = buildCommands(makeHost(ws, { promptEntry: (k) => void asked.push(k) }));
  assert.equal(list.find((c) => c.id === 'newFile')?.disabled, false);
  assert.equal(list.find((c) => c.id === 'renameEntry')?.disabled, true, 'pas de cible');
  ops.select('sub');
  assert.deepEqual(ops.target(), { rel: 'sub', dir: true });
  assert.equal(ops.targetDir(), 'sub');
  const again = buildCommands(makeHost(ws, { promptEntry: (k) => void asked.push(k) }));
  again.find((c) => c.id === 'renameEntry')?.run();
  again.find((c) => c.id === 'newDir')?.run();
  assert.deepEqual(asked, ['rename', 'newDir']);
  ops.select('a.md');
  assert.equal(ops.targetDir(), '');
  ops.select(null);
  ws.openFolderFile('sub/b.md');
  assert.deepEqual(ops.target(), { rel: 'sub/b.md', dir: false });
  assert.equal(ops.targetDir(), 'sub');
});

// --- Fichier ouvert depuis le dossier (origine relative) : meme surveillance que par chemin absolu ---

function diskFs(files: Map<string, { bytes: Uint8Array; mtime: number }>): FolderFs {
  return {
    info: (rel: string) => Promise.resolve(files.has(rel) ? { modifiedAt: files.get(rel)!.mtime, size: files.get(rel)!.bytes.length } : null),
    read: (rel: string) => (files.has(rel) ? Promise.resolve(files.get(rel)!.bytes) : Promise.reject(new Error('introuvable'))),
    write: (rel: string, bytes: Uint8Array) => {
      files.set(rel, { bytes, mtime: Date.now() });
      return Promise.resolve();
    },
  } as unknown as FolderFs;
}

async function openedInFolder(text: string) {
  const f = fake();
  const files = new Map([['a.md', { bytes: new TextEncoder().encode(text), mtime: 1 }]]);
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  ws.setFolder({ name: 'd', files: [{ rel: 'a.md', text, encoding: 'utf-8', eol: 'lf' }], fs: diskFs(files) });
  const id = ws.openFolderFile('a.md') ?? '';
  await ws.checkExternal(id);
  return { f, files, ws, id };
}

test('dossier : un fichier ouvert depuis l explorateur est recharge quand il change sur le disque', async () => {
  const { f, files, ws, id } = await openedInFolder('v1');
  files.set('a.md', { bytes: new TextEncoder().encode('v2'), mtime: 2 });
  assert.equal(await ws.checkExternal(id), 'reload');
  assert.equal(ws.text(id), 'v2');
  assert.match(f.notices.at(-1) ?? '', /modifié par un autre programme/);
});

test('dossier : modifie localement + change sur le disque = conflit, texte local garde', async () => {
  const { files, ws, id } = await openedInFolder('v1');
  ws.patch(id, { dirty: true });
  files.set('a.md', { bytes: new TextEncoder().encode('v2'), mtime: 2 });
  assert.equal(await ws.checkExternal(id), 'conflict');
  assert.equal(ws.text(id), 'v1');
});

test('dossier : son propre enregistrement ne declenche pas de rechargement', async () => {
  const { f, ws, id } = await openedInFolder('v1');
  ws.replaceText(id, 'v1 edite');
  assert.equal(await ws.save(id), true);
  const before = f.notices.length;
  assert.equal(await ws.checkExternal(id), 'same');
  assert.equal(f.notices.length, before);
});
