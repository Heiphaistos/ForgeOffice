import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFavs, toggleFav } from '../src/logic/favorites.ts';
import { DEFAULT_LAYOUT, pageCss, parseLayout, splitZones, zoneContent } from '../src/logic/print.ts';
import { diffRange, parseKv, props, setProp } from '../src/logic/props.ts';
import { claimRecovery, parseRecovery, snapshot, type RecoveredDoc } from '../src/logic/recovery.ts';

test('props : lire une liste, entrées sans en-tête', () => {
  const t = '---\ntitre: Mon "idée"\ntags:\n  - a\n  - b\nok: oui\n---\ncorps\n';
  assert.deepEqual(props(t), [{ key: 'titre', value: 'Mon "idée"' }, { key: 'tags', value: 'a, b' }, { key: 'ok', value: 'oui' }]);
  assert.deepEqual(props("pas d'entête\n---\nx: 1\n---\n"), []);
});

test('setProp : modifier, ajouter, retirer, fins de ligne et BOM', () => {
  const t = '---\ntitre: T\ntags:\n  - a\n  - b\nok: oui\n---\ncorps\n';
  const s = setProp(t, 'ok', 'non');
  assert.ok(s.endsWith('ok: non\n---\ncorps\n'));
  const s2 = setProp(s, 'tags', 'z');
  assert.ok(s2.includes('tags: z\n') && !s2.includes('  - a'));
  assert.equal(props(setProp(s2, 'nouveau', 'x: y')).at(-1)?.value, 'x: y');
  assert.ok(!setProp(s2, 'ok', '').includes('ok:'));
  assert.equal(setProp('texte\n', 'a', '1'), '---\na: 1\n---\ntexte\n');
  assert.equal(setProp('---\na: 1\n---\nt', 'a', ''), 't');
  assert.equal(setProp('t\r\n', 'a', '1'), '---\r\na: 1\r\n---\r\nt\r\n');
  assert.equal(setProp('﻿t', 'a', '1'), '﻿---\na: 1\n---\nt');
  assert.equal(setProp('t', 'a', ''), 't');
  assert.deepEqual(parseKv('a: b c'), ['a', 'b c']);
  assert.equal(parseKv('a b: c'), null);
});

test('diffRange : zone minimale, jamais au milieu d’une paire de substitution', () => {
  const apply = (a: string, b: string): string => {
    const d = diffRange(a, b);
    return a.slice(0, d.from) + d.insert + a.slice(d.to);
  };
  const a = '---\nx: 1\n---\nété';
  const b = '---\nx: 1\ny: é\n---\nété';
  assert.equal(apply(a, b), b);
  assert.ok(diffRange(a, b).insert.length <= 6);
  assert.equal(apply('a😀b', 'a😁b'), 'a😁b');
  assert.equal(apply('aé', 'aè'), 'aè');
  assert.equal(apply('abc', 'abc'), 'abc');
  assert.equal(apply('aa', 'aaa'), 'aaa');
});

test('favoris : bascule, tête de liste, donnée hostile', () => {
  let r = toggleFav([], '/a');
  assert.deepEqual(r, { list: ['/a'], added: true });
  r = toggleFav(r.list, '/b');
  assert.deepEqual(r.list, ['/b', '/a']);
  assert.deepEqual(toggleFav(r.list, '/b'), { list: ['/a'], added: false });
  assert.deepEqual(parseFavs(['/a', 3, '', '/a', null, '/b']), ['/a', '/b']);
  assert.deepEqual(parseFavs('x'), []);
});

const doc = (name: string, text: string): RecoveredDoc => ({ name, path: null, encoding: 'utf-8', eol: 'lf', text });

test('récupération : fenêtre vivante gardée, fenêtre disparue reprise sans doublon', () => {
  let store = snapshot([], 'w1', [doc('a', 'un'), doc('b', 'deux')]);
  store = snapshot(store, 'w2', [doc('c', 'trois')]);
  assert.equal(store.length, 2);
  const now = 100_000;
  const alive = { w1: now - 1000 };
  const r = claimRecovery(store, alive, now, new Set(['trois']));
  assert.deepEqual(r.docs, []); // w2 disparue mais son texte est déjà ouvert
  assert.deepEqual(r.store.map((e) => e.win), ['w1']);
  const r2 = claimRecovery(store, {}, now, new Set(['un']));
  assert.deepEqual(r2.docs.map((d) => d.name), ['b', 'c']);
  assert.deepEqual(r2.store, []);
  // sortie normale : plus de copie
  assert.deepEqual(snapshot(store, 'w1', []).map((e) => e.win), ['w2']);
});

test('récupération : trop gros ignoré, magasin hostile nettoyé', () => {
  const big = doc('big', 'x'.repeat(1_000_001));
  assert.deepEqual(snapshot([], 'w', [big]), []);
  assert.deepEqual(snapshot([], 'w', [doc('a', 'x'.repeat(900_000)), doc('b', 'y'.repeat(900_000)), doc('c', 'z'.repeat(900_000)), doc('d', 'w')])[0]?.docs.map((d) => d.name), ['a', 'b', 'd']);
  const p = parseRecovery([{ win: 'w', docs: [{ name: 'a', path: null, encoding: 'zzz', eol: 'q', text: 't' }, { name: 3 }, null] }, 'x', { win: 1 }]);
  assert.deepEqual(p, [{ win: 'w', docs: [{ name: 'a', path: null, encoding: 'utf-8', eol: 'crlf', text: 't' }] }]);
  assert.deepEqual(parseRecovery('x'), []);
});

test('mise en page : zones, variables, marges bornées, CSS sûr', () => {
  assert.deepEqual(splitZones('a|b|c'), ['a', 'b', 'c']);
  assert.deepEqual(splitZones('a'), ['a', '', '']);
  assert.deepEqual(splitZones('a|b|c|d'), ['a', 'b', 'c|d']);
  assert.equal(zoneContent('Page {page} / {pages}', 'f', 'd'), '"Page " counter(page) " / " counter(pages)');
  assert.equal(zoneContent('{fichier} ({date})', 'a"b.md', '1/2'), '"a\\"b.md (1/2)"');
  assert.equal(zoneContent('', 'f', 'd'), '""');
  assert.deepEqual(parseLayout({ marginMm: 999, header: 5, footer: 'x' }), { marginMm: 60, header: DEFAULT_LAYOUT.header, footer: 'x' });
  assert.equal(parseLayout(null).marginMm, 18);
  const css = pageCss({ marginMm: 20, header: '|{fichier}|', footer: '{date}||{page}' }, 'n.md', 'd');
  assert.match(css, /^@page \{ margin: 20mm; @top-center \{ content: "n.md";/);
  assert.ok(!css.includes('top-left') && css.includes('@bottom-left { content: "d";') && css.includes('@bottom-right { content: counter(page);'));
});

test('espace de travail : propriété posée dans l’onglet, copie sans changer l’onglet', async () => {
  const { DEFAULT_PREFS } = await import('../src/logic/prefs.ts');
  const { Workspace } = await import('../src/workspace.ts');
  const { fake } = await import('./fake.ts');
  const f = fake();
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  const id = ws.add({ name: 'n.md', text: 'corps\n', eol: 'lf' });
  assert.equal(ws.setProperty('titre: Mon essai'), true);
  assert.equal(ws.text(id), '---\ntitre: Mon essai\n---\ncorps\n');
  assert.equal(ws.tab(id)?.dirty, true);
  assert.equal(ws.setProperty('titre:'), true);
  assert.equal(ws.text(id), 'corps\n');
  assert.equal(ws.setProperty('mauvaise clé: 1'), false);
  ws.patch(id, { readOnly: true });
  assert.equal(ws.setProperty('a: 1'), false);
  ws.patch(id, { readOnly: false, dirty: false });
  assert.equal(await ws.saveCopy(id), true);
  assert.equal(new TextDecoder().decode(f.disk.get('C:/tmp/n - copie.md')), 'corps\n');
  assert.deepEqual([ws.tab(id)?.name, ws.tab(id)?.path, ws.tab(id)?.dirty], ['n.md', null, false]);
});

test('espace de travail : copies de secours écrites, reprises après arrêt brutal, retirées à la sortie', async () => {
  const { DEFAULT_PREFS } = await import('../src/logic/prefs.ts');
  const { Workspace } = await import('../src/workspace.ts');
  const { fake } = await import('./fake.ts');
  const f = fake();
  const a = new Workspace(f.services, DEFAULT_PREFS);
  a.add({ name: 'Sans titre 1', text: 'perdu', dirty: true });
  a.add({ name: 'propre.md', text: 'rien', dirty: false, path: 'C:/p.md' });
  a.persist();
  // Fenêtre vivante : ses copies ne sont pas reprises.
  const b = new Workspace(f.services, DEFAULT_PREFS);
  assert.deepEqual(b.recover(), []);
  // Arrêt brutal : signe de vie périmé, ni sortie normale ni session reprise.
  f.services.settings.set('notes.alive', { [Object.keys(f.services.settings.get<Record<string, number>>('notes.alive', {}))[0] ?? '']: Date.now() - 60_000 });
  assert.deepEqual(b.recover(), ['Sans titre 1']);
  assert.equal(b.text(b.activeId), 'perdu');
  assert.equal(b.active?.dirty, true);
  assert.deepEqual(b.recover(), [], 'reprise unique');
  // Sortie normale : plus de copie.
  const c = new Workspace(f.services, DEFAULT_PREFS);
  c.add({ name: 'x', text: 'y', dirty: true });
  c.persist();
  c.persist(true);
  assert.deepEqual(new Workspace(f.services, DEFAULT_PREFS).recover(), []);
});
