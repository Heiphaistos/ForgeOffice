import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { SearchHistory, unescapeExtended } from '../src/logic/find.ts';
import { buildQuery } from '../src/editor/findpanel.ts';
import { allReplacements, expandReplacement } from '../src/editor/replace.ts';
import { DEFAULT_PREFS } from '../src/logic/prefs.ts';
import { Workspace } from '../src/workspace.ts';
import { fake } from './fake.ts';

const matches = (doc: string, q: ReturnType<typeof buildQuery>): number => allReplacements(EditorState.create({ doc }), q).length;

test('mode etendu : \\n \\t \\r \\0 \\\\ \\xNN, le reste est garde', () => {
  assert.equal(unescapeExtended('a\\nb\\tc\\x41\\\\d'), 'a\nb\tcA\\d');
  assert.equal(unescapeExtended('\\r\\0'), '\r\0');
  assert.equal(unescapeExtended('\\d+ \\xZZ fin\\'), '\\d+ \\xZZ fin\\');
});

test('modes Normal / Etendu / Regexp : meme saisie, trois comportements', () => {
  const doc = 'a\nb a\\nb';
  assert.equal(matches(doc, buildQuery('extended', 'a\\nb', '', false, false)), 1, 'etendu : saut de ligne reel');
  assert.equal(matches(doc, buildQuery('normal', 'a\\nb', '', false, false)), 1, 'normal : antislash litteral');
  assert.equal(allReplacements(EditorState.create({ doc }), buildQuery('normal', 'a\\nb', 'X', false, false))[0]?.from, 4);
  assert.equal(allReplacements(EditorState.create({ doc }), buildQuery('extended', 'a\\nb', 'X', false, false))[0]?.from, 0);
  assert.equal(matches('un deux 3', buildQuery('regexp', '\\d', '', false, false)), 1);
  assert.equal(matches('Aa', buildQuery('normal', 'a', '', true, false)), 1, 'casse');
  assert.equal(matches('chat chats', buildQuery('normal', 'chat', '', false, true)), 1, 'mot entier');
});

test('dans la selection : seules les occurrences de la plage comptent, la plage suit les modifications', () => {
  let scope: { from: number; to: number } | null = { from: 4, to: 8 };
  const q = buildQuery('normal', 'a', '', false, false, () => scope);
  assert.equal(matches('a a a a', q), 2);
  scope = null;
  assert.equal(matches('a a a a', q), 0, 'plage perdue : rien');
});

test('remplacement regexp : groupes et $&', () => {
  assert.equal(expandReplacement('<$1|$2|$&|$$>', ['xy', 'x', 'y']), '<x|y|xy|$>');
  const q = buildQuery('regexp', '(\\w+)@(\\w+)', '$2 at $1', false, false);
  const st = EditorState.create({ doc: 'bob@ex et al@fr' });
  const out = st.update({ changes: allReplacements(st, q) }).state.doc.toString();
  assert.equal(out, 'ex at bob et fr at al');
});

test('historique : ordre, doublons, haut / bas, plafond, persistance', () => {
  const saved: string[][] = [];
  const h = new SearchHistory(['x', '', 'y'], (l) => void saved.push([...l]));
  assert.deepEqual(h.list, ['x', 'y']);
  assert.equal(h.step(true), 'y');
  assert.equal(h.step(true), 'x');
  assert.equal(h.step(true), 'x', 'bloque sur la plus ancienne');
  assert.equal(h.step(false), 'y');
  assert.equal(h.step(false), '', 'au-dela de la plus recente : champ vide');
  h.push('x');
  assert.deepEqual(h.list, ['y', 'x']);
  assert.deepEqual(saved.at(-1), ['y', 'x']);
  h.push('');
  assert.equal(saved.length, 1);
  for (let i = 0; i < 40; i++) h.push(`q${i}`);
  assert.equal(h.list.length, 30);
  assert.equal(new SearchHistory().step(true), null);
});

test('tous les onglets : remplace partout, marque les onglets modifies, saute la lecture seule', () => {
  const f = fake();
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  const a = ws.add({ name: 'a.txt', text: 'chat chat' });
  const b = ws.add({ name: 'b.txt', text: 'un chat' });
  const c = ws.add({ name: 'c.txt', text: 'chien' });
  const ro = ws.add({ name: 'd.txt', text: 'chat', readOnly: true });
  const r = ws.replaceInAllTabs(buildQuery('normal', 'chat', 'loup', false, false));
  assert.deepEqual(r, { count: 3, tabs: 2 });
  assert.equal(ws.text(a), 'loup loup');
  assert.equal(ws.text(b), 'un loup');
  assert.equal(ws.text(c), 'chien');
  assert.equal(ws.text(ro), 'chat');
  assert.deepEqual([ws.tab(a)?.dirty, ws.tab(b)?.dirty, ws.tab(c)?.dirty], [true, true, false]);
});
