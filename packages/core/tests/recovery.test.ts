// Copies de recuperation : cles par session, TTL, purge, fenetres vivantes (faux magasin, sans navigateur).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecovery, RECOVERY_TTL_MS, type LiveRegistry, type RecoveryBackend, type RecoveryEntry } from '../src/recovery.ts';

class FakeBackend implements RecoveryBackend {
  readonly map = new Map<string, unknown>();
  async put(key: string, value: RecoveryEntry): Promise<void> {
    this.map.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }
  async entries(): Promise<Array<[string, unknown]>> {
    return [...this.map.entries()];
  }
}

class FakeLive implements LiveRegistry {
  readonly alive_ = new Set<string>();
  held: string[] = [];
  hold(session: string): void {
    this.held.push(session);
    this.alive_.add(session);
  }
  async alive(): Promise<ReadonlySet<string>> {
    return this.alive_;
  }
}

const bytes = (n: number): Uint8Array => new Uint8Array([n]);
const file = (name: string, n = 1) => ({ name, path: null, bytes: bytes(n) });

function setup(now: { t: number }) {
  const backend = new FakeBackend();
  const live = new FakeLive();
  let counter = 0;
  const make = (app: 'word' | 'powerpoint' = 'word') =>
    createRecovery(app, { backend, live, now: () => now.t, newId: () => `s${++counter}` });
  return { backend, live, make };
}

test('une cle par session : deux fenetres ne s\'ecrasent pas', async () => {
  const now = { t: 1_000_000 };
  const { backend, make } = setup(now);
  const a = make();
  const b = make();
  await a.save(file('a.docx', 1));
  await b.save(file('b.docx', 2));
  assert.deepEqual([...backend.map.keys()].sort(), ['word:s1', 'word:s2']);
  assert.notEqual(a.session, b.session);
});

test('effacement a l\'enregistrement ou a la fermeture normale', async () => {
  const now = { t: 1_000_000 };
  const { backend, make } = setup(now);
  const a = make();
  await a.save(file('a.docx'));
  assert.equal(backend.map.size, 1);
  await a.clear();
  assert.equal(backend.map.size, 0);
});

test('restauration : seulement les copies sans fenetre vivante, de la meme application', async () => {
  const now = { t: 1_000_000 };
  const { live, make } = setup(now);
  const crashed = make();
  const other = make('powerpoint');
  await crashed.save(file('perdu.docx'));
  await other.save(file('autre.pptx'));
  const survivor = make();
  await survivor.save(file('en-cours.docx'));
  const fresh = make();
  // crashed est encore vivante : rien a proposer.
  assert.deepEqual(await fresh.pending(), []);
  // Plantage : le verrou de la fenetre disparait.
  live.alive_.delete(crashed.session);
  const found = await fresh.pending();
  assert.equal(found.length, 1);
  assert.equal(found[0]?.name, 'perdu.docx');
  assert.equal(found[0]?.session, crashed.session);
  // La copie de la session courante et celles des autres applications ne sont jamais proposees.
  await fresh.save(file('moi.docx'));
  assert.deepEqual((await fresh.pending()).map((e) => e.name), ['perdu.docx']);
  await fresh.discard(found[0] as RecoveryEntry);
  assert.deepEqual(await fresh.pending(), []);
});

test('purge au demarrage des copies de plus de 7 jours', async () => {
  const now = { t: 1_000_000 };
  const { backend, live, make } = setup(now);
  const old = make();
  await old.save(file('vieux.docx'));
  now.t += RECOVERY_TTL_MS - 1000;
  const recent = make();
  await recent.save(file('recent.docx'));
  live.alive_.clear();
  now.t += 2000; // vieux.docx a maintenant plus de 7 jours, recent.docx non
  const fresh = make();
  const found = await fresh.pending();
  assert.deepEqual(found.map((e) => e.name), ['recent.docx']);
  assert.deepEqual([...backend.map.keys()], ['word:s2']);
});

test('donnees invalides ou anciennes copies a cle unique', async () => {
  const now = { t: 5_000_000 };
  const { backend, live, make } = setup(now);
  backend.map.set('word:zzz', { name: 'sans-octets' });
  backend.map.set('inconnu:s9', { name: 'x', bytes: bytes(1), savedAt: now.t });
  backend.map.set('powerpoint', { name: 'ancien.pptx', path: null, bytes: bytes(3), savedAt: now.t - 1000 });
  live.alive_.clear();
  const fresh = make('powerpoint');
  const found = await fresh.pending();
  assert.deepEqual(found.map((e) => e.name), ['ancien.pptx']);
  assert.deepEqual([...backend.map.keys()], ['powerpoint']);
  await fresh.discard(found[0] as RecoveryEntry);
  assert.equal(backend.map.size, 0);
});

test('chaque session tient son verrou de fenetre', () => {
  const now = { t: 1 };
  const { live, make } = setup(now);
  const a = make();
  assert.deepEqual(live.held, [a.session]);
});

test('sans information sur les fenetres : copie recente = fenetre supposee vivante', async () => {
  const now = { t: 10_000_000 };
  const backend = new FakeBackend();
  const unknown: LiveRegistry = { hold: () => undefined, alive: async () => null };
  let n = 0;
  const make = () => createRecovery('word', { backend, live: unknown, now: () => now.t, newId: () => `u${++n}` });
  const a = make();
  await a.save(file('a.docx'));
  const b = make();
  assert.deepEqual(await b.pending(), []);
  now.t += 120_000;
  assert.equal((await b.pending()).length, 1);
});
