import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TAB_TEXT, claimSession, keepText, parseAlive, parseStore, touchAlive, upsertWindow, type SessionTab, type WindowSession } from '../src/logic/session.ts';
import { DEFAULT_PREFS, applyLayout, parsePrefs } from '../src/logic/prefs.ts';
import { LAYOUTS, THEMES, fontStack } from '../src/logic/themes.ts';

const tab = (name: string, extra: Partial<SessionTab> = {}): SessionTab => ({
  name, path: null, origin: null, encoding: 'utf-8', eol: 'crlf', lang: null, dirty: true, readOnly: false, pinned: false, text: `texte de ${name}`, cursor: 0, ...extra,
});

test('session : aller-retour JSON et texte non enregistre conserve', () => {
  const w: WindowSession = { win: 'w1', active: 1, tabs: [tab('Sans titre 1'), tab('a.md', { path: 'C:/a.md', dirty: false, text: null, encoding: 'utf-16le', eol: 'lf', cursor: 12 })] };
  const store = parseStore(JSON.parse(JSON.stringify({ windows: [w] })));
  assert.deepEqual(store.windows[0], w);
});

test('session : donnees hostiles ignorees', () => {
  assert.deepEqual(parseStore(null), { windows: [] });
  assert.deepEqual(parseStore({ windows: 'x' }), { windows: [] });
  const s = parseStore({
    windows: [
      { win: 'ok', active: 99, tabs: [{ name: 'a', text: 'x', encoding: 'ebcdic', eol: '??', cursor: -4 }, { name: 'sans texte ni chemin', text: null, path: null }, 42] },
      { win: 7, tabs: [] },
    ],
  });
  assert.equal(s.windows.length, 1);
  const w = s.windows[0];
  assert.ok(w);
  assert.equal(w.tabs.length, 1);
  assert.equal(w.active, 0);
  assert.deepEqual([w.tabs[0]?.encoding, w.tabs[0]?.eol, w.tabs[0]?.cursor], ['utf-8', 'crlf', 0]);
});

test('session : reprise des fenetres fermees seulement', () => {
  const now = 1_000_000;
  let store = parseStore({ windows: [] });
  store = upsertWindow(store, { win: 'fermee', active: 1, tabs: [tab('A'), tab('B')] });
  store = upsertWindow(store, { win: 'vivante', active: 0, tabs: [tab('C')] });
  store = upsertWindow(store, { win: 'plantee', active: 0, tabs: [tab('D')] });
  const alive = parseAlive({ vivante: now - 2000, plantee: now - 60_000, bizarre: 'x' });
  assert.deepEqual(alive, { vivante: now - 2000, plantee: now - 60_000 });
  const claimed = claimSession(store, alive, now);
  assert.deepEqual(claimed.tabs.map((t) => t.name), ['A', 'B', 'D']);
  assert.equal(claimed.active, 1);
  assert.deepEqual(claimed.store.windows.map((w) => w.win), ['vivante']);
  // Mise a jour de sa propre entree sans toucher aux autres.
  const next = upsertWindow(claimed.store, { win: 'moi', active: 0, tabs: claimed.tabs });
  assert.deepEqual(next.windows.map((w) => w.win), ['vivante', 'moi']);
  assert.equal(upsertWindow(next, { win: 'moi', active: 0, tabs: [] }).windows.length, 2);
  // Signes de vie : les muettes sont oubliees, fermer retire la fenetre.
  assert.deepEqual(touchAlive(alive, 'moi', now, now), { vivante: now - 2000, moi: now });
  assert.deepEqual(touchAlive({ moi: now }, 'moi', now, 0), {});
});

test('session : quel texte garder', () => {
  assert.equal(keepText({ dirty: false, path: 'C:/x.txt' }, 10), false);
  assert.equal(keepText({ dirty: true, path: 'C:/x.txt' }, 10), true);
  assert.equal(keepText({ dirty: false, path: null }, 10), true);
  assert.equal(keepText({ dirty: true, path: null }, MAX_TAB_TEXT + 1), false);
});

test('reglages : valeurs verifiees et dispositions', () => {
  assert.deepEqual(parsePrefs(undefined), DEFAULT_PREFS);
  const p = parsePrefs({ theme: 'inconnu', fontSize: 999, zoom: -3, wrap: 'oui', side: 'outline', spellLang: 'xx', font: 'Fira Code' });
  assert.equal(p.theme, 'office');
  assert.equal(p.fontSize, 72);
  assert.equal(p.zoom, 10);
  assert.equal(p.wrap, DEFAULT_PREFS.wrap);
  assert.equal(p.side, 'outline');
  assert.equal(p.spellLang, 'fr');
  assert.equal(p.font, 'Fira Code');
  const obs = applyLayout(DEFAULT_PREFS, 5);
  assert.equal(obs.theme, 'obsidian');
  assert.equal(obs.side, 'outline');
  assert.equal(applyLayout(DEFAULT_PREFS, 1).foldGutter, true);
  assert.equal(THEMES.length, 17);
  assert.equal(LAYOUTS.length, 8);
  assert.match(fontStack('Consolas'), /monospace$/);
  assert.match(fontStack('Georgia'), /serif$/);
  assert.equal(fontStack('A"b'), '"Ab", "Segoe UI", system-ui, sans-serif');
});
