import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diskSignature, externalChange } from '../src/logic/disk.ts';
import { DEFAULT_PREFS, parsePrefs } from '../src/logic/prefs.ts';
import { buildCommands } from '../src/commands.ts';
import { fake, makeHost } from './fake.ts';
import { Workspace } from '../src/workspace.ts';
import { S } from '../src/strings.ts';

test('enregistrer puis rouvrir : texte, encodage et fins de ligne identiques', async () => {
  for (const [encoding, eol] of [['utf-8', 'lf'], ['utf-8-bom', 'crlf'], ['utf-16le', 'crlf'], ['utf-16be', 'lf'], ['windows-1252', 'cr']] as const) {
    const f = fake();
    const ws = new Workspace(f.services, DEFAULT_PREFS);
    const text = 'Été à Noël\nligne 2 € ç\n\nfin';
    const id = ws.add({ name: 'a.txt', text, encoding, eol, dirty: true });
    assert.equal(await ws.save(id, true), true, `${encoding} enregistre`);
    const saved = ws.tab(id);
    assert.equal(saved?.dirty, false);
    assert.equal(saved?.path, 'C:/tmp/a.txt');
    // Autre fenetre : on relit le fichier du disque comme le ferait « Ouvrir ».
    const ws2 = new Workspace(f.services, DEFAULT_PREFS);
    ws2.openFile(await f.services.readFile('C:/tmp/a.txt'));
    const t = ws2.active;
    assert.ok(t);
    assert.equal(t.encoding, encoding, `${encoding} detecte`);
    assert.equal(t.eol, eol, `${eol} detecte`);
    assert.equal(ws2.text(t.id).replace(/\r\n|\r/g, '\n'), text, `${encoding} texte`);
    assert.equal(t.disk, diskSignature(f.disk.get('C:/tmp/a.txt')!));
  }
});

test('enregistrement : le deuxieme ecrit au meme chemin et refait la signature', async () => {
  const f = fake();
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  const id = ws.add({ name: 'n.md', text: 'un', eol: 'lf', dirty: true });
  await ws.save(id, true);
  const first = ws.tab(id)?.disk;
  ws.replaceText(id, 'deux');
  await ws.save(id);
  assert.equal(f.disk.size, 1);
  assert.notEqual(ws.tab(id)?.disk, first);
  assert.equal(new TextDecoder().decode(f.disk.get('C:/tmp/n.md')), 'deux');
});

test('empreinte et decision de modification externe', () => {
  assert.notEqual(diskSignature(new Uint8Array([1, 2])), diskSignature(new Uint8Array([2, 1])));
  assert.equal(externalChange(null, 'x', false), 'same');
  assert.equal(externalChange('a', 'a', true), 'same');
  assert.equal(externalChange('a', 'b', false), 'reload');
  assert.equal(externalChange('a', 'b', true), 'conflict');
});

test('modification externe : recharge un onglet propre, previent si modifie, ignore le navigateur', async () => {
  const f = fake();
  f.disk.set('C:/x/note.txt', new TextEncoder().encode('v1'));
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  ws.openFile(await f.services.readFile('C:/x/note.txt'));
  const id = ws.activeId;
  assert.equal(await ws.checkExternal(id), 'same');
  f.disk.set('C:/x/note.txt', new TextEncoder().encode('v2'));
  assert.equal(await ws.checkExternal(id), 'reload');
  assert.equal(ws.text(id), 'v2');
  assert.equal(ws.tab(id)?.dirty, false);
  assert.match(f.notices.at(-1) ?? '', /modifié par un autre programme/);
  // Onglet modifie localement : jamais ecrase.
  ws.patch(id, { dirty: true });
  f.disk.set('C:/x/note.txt', new TextEncoder().encode('v3'));
  assert.equal(await ws.checkExternal(id), 'conflict');
  assert.equal(ws.text(id), 'v2');
  assert.equal(await ws.checkExternal(id), 'same', 'un seul avertissement par changement');
  // Fichier supprime : rien n'est touche.
  f.disk.delete('C:/x/note.txt');
  assert.equal(await ws.checkExternal(id), 'missing');
  assert.equal(ws.text(id), 'v2');
  // Navigateur ou onglet inconnu.
  const web = new Workspace(fake('web').services, DEFAULT_PREFS);
  const wid = web.add({ name: 'w.txt', path: 'w.txt', text: '' });
  assert.equal(await web.checkExternal(wid), 'none');
  assert.equal(await ws.checkExternal('inconnu'), 'none');
});

test('ligatures : preference verifiee, vraie par defaut', () => {
  assert.equal(parsePrefs(null).ligatures, true);
  assert.equal(parsePrefs({ ligatures: false }).ligatures, false);
  assert.equal(parsePrefs({ ligatures: 'non' }).ligatures, true);
});

test("commandes : « Afficher dans l'explorateur » grisee avec info-bulle, « Effacer les recents » appelle l'hote", () => {
  const ws = new Workspace(fake().services, DEFAULT_PREFS);
  let cleared = 0;
  const host = makeHost(ws, { clearRecent: () => void cleared++ });
  const list = buildCommands(host);
  const reveal = list.find((c) => c.id === 'reveal');
  assert.equal(reveal?.disabled, true);
  assert.equal(reveal?.hint, S.revealSoon);
  assert.match(S.revealSoon, /^Bientôt disponible/);
  list.find((c) => c.id === 'clearRecent')?.run();
  assert.equal(cleared, 1);
  assert.equal(list.find((c) => c.id === 'ligatures')?.checked, true);
});
