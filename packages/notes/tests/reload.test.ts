import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCommands } from '../src/commands.ts';
import { DEFAULT_PREFS, parsePrefs } from '../src/logic/prefs.ts';
import { Workspace } from '../src/workspace.ts';
import { fake, makeHost } from './fake.ts';

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

async function opened(text: string) {
  const f = fake();
  f.disk.set('C:/x/log.txt', bytes(text));
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  ws.openFile(await f.services.readFile('C:/x/log.txt'));
  return { f, ws, id: ws.activeId };
}

test('controle periodique : onglet actif recharge sans bruit en mode suivi, avec avis sinon', async () => {
  const { f, ws, id } = await opened('a');
  f.disk.set('C:/x/log.txt', bytes('a\nb'));
  await ws.pollExternal();
  assert.equal(ws.text(id), 'a\nb');
  assert.equal(f.notices.length, 1, 'avis de rechargement');
  ws.setFollow(id, true);
  assert.equal(ws.tab(id)?.follow, true);
  f.disk.set('C:/x/log.txt', bytes('a\nb\nc'));
  await ws.pollExternal();
  assert.equal(ws.text(id), 'a\nb\nc');
  assert.equal(f.notices.length, 1, 'pas d avis en mode suivi');
  assert.equal(ws.stateOf(id)?.selection.main.head, 5, 'curseur a la fin');
});

test('suivi : les onglets suivis sont controles meme en arriere-plan, pas les autres', async () => {
  const { f, ws, id } = await opened('1');
  ws.setFollow(id, true);
  const other = ws.add({ name: 'o.txt', text: 'x' });
  f.disk.set('C:/x/log.txt', bytes('1\n2'));
  assert.equal(ws.activeId, other);
  await ws.pollExternal();
  assert.equal(ws.text(id), '1\n2');
});

test('suivi : refuse sans fichier ou onglet modifie ; un conflit coupe le suivi', async () => {
  const f = fake();
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  const blank = ws.add({ name: 'n.txt', text: '' });
  ws.setFollow(blank, true);
  assert.equal(ws.tab(blank)?.follow, false);
  const { ws: ws2, id, f: f2 } = await opened('v1');
  ws2.setFollow(id, true);
  ws2.patch(id, { dirty: true });
  f2.disk.set('C:/x/log.txt', bytes('v2'));
  await ws2.pollExternal();
  assert.equal(ws2.tab(id)?.follow, false);
  assert.equal(ws2.text(id), 'v1', 'texte local jamais ecrase');
  assert.match(f2.notices.at(-1) ?? '', /suivi de fin de fichier arrêté/);
});

test('rechargement : un encodage choisi a la main est conserve', async () => {
  const f = fake();
  f.disk.set('C:/x/ru.txt', Uint8Array.from([0xcf, 0xf0]));
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  ws.openFile(await f.services.readFile('C:/x/ru.txt'));
  const id = ws.activeId;
  await ws.reloadAs(id, 'windows-1251');
  f.disk.set('C:/x/ru.txt', Uint8Array.from([0xcf, 0xf0, 0xe8]));
  await ws.checkExternal(id);
  assert.equal(ws.text(id), 'При');
  assert.equal(ws.tab(id)?.encoding, 'windows-1251');
});

test('commandes : suivi grise sans chemin ou dans le navigateur, rechargement auto actif par defaut', async () => {
  const { ws } = await opened('x');
  const list = buildCommands(makeHost(ws));
  assert.equal(list.find((c) => c.id === 'follow')?.disabled, false);
  assert.equal(list.find((c) => c.id === 'autoReload')?.checked, true);
  assert.equal(buildCommands(makeHost(ws, { isWeb: true })).find((c) => c.id === 'follow')?.disabled, true);
  assert.equal(parsePrefs({ autoReload: false }).autoReload, false);
  list.find((c) => c.id === 'follow')?.run();
  assert.equal(ws.active?.follow, true);
});
