// Caractères génériques de Word, recherche dans la sélection, ^p dans le remplacement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from 'prosemirror-state';
import { createSchema } from '../src/editor/schema.ts';
import { findMatches, replaceMatches } from '../src/editor/find.ts';
import { wildcardReplacement, wildcardToRegex } from '../src/editor/wildcards.ts';

const schema = createSchema();
const p = (t: string) => schema.nodes.paragraph!.create(null, t ? schema.text(t) : null);
const docOf = (...t: string[]) => schema.nodes.doc!.create(null, t.map(p));
const texts = (s: EditorState): string[] => [...Array(s.doc.childCount).keys()].map((i) => s.doc.child(i).textContent);

test('traduction des motifs', () => {
  assert.equal(wildcardToRegex('a?c'), 'a.c');
  assert.equal(wildcardToRegex('a*c'), 'a.*?c');
  assert.equal(wildcardToRegex('[!a-c]x'), '[^a-c]x');
  assert.equal(wildcardToRegex('a{2,3}'), 'a{2,3}');
  assert.equal(wildcardToRegex('\\?'), '\\?');
  assert.equal(wildcardToRegex('[abc'), null);
  assert.equal(wildcardToRegex('a{x}'), null);
  assert.equal(wildcardReplacement('\\2-\\1 ^& $'), '$2-$1 $& $$');
});

test('recherche : ? * [a-z] < > @ et groupes', () => {
  const doc = docOf('chat chut chot cheval', 'aaa bb', 'Dupont Jean, Martin Paul');
  const find = (q: string) => findMatches(doc, q, { wildcards: true }).map((m) => m.text);
  assert.deepEqual(find('ch?t'), ['chat', 'chut', 'chot']);
  assert.deepEqual(find('ch[au]t'), ['chat', 'chut']);
  assert.deepEqual(find('ch[!au]t'), ['chot']);
  assert.deepEqual(find('<che*>'), ['cheval']);
  assert.deepEqual(find('<a@>'), ['aaa']);
  assert.deepEqual(find('b{2}'), ['bb']);
  assert.deepEqual(find('<[A-Z][a-z]@> <[A-Z][a-z]@>'), ['Dupont Jean', 'Martin Paul']);
});

test('remplacement avec groupes \\1 \\2 (inverser prenom et nom)', () => {
  const doc = docOf('Dupont Jean, Martin Paul');
  const q = '(<[A-Z][a-z]@>) (<[A-Z][a-z]@>)';
  let state = EditorState.create({ doc });
  const tr = state.tr;
  replaceMatches(tr, findMatches(doc, q, { wildcards: true }), q, '\\2 \\1', { wildcards: true });
  state = state.apply(tr);
  assert.deepEqual(texts(state), ['Jean Dupont, Paul Martin']);
});

test('recherche dans la selection', () => {
  const doc = docOf('mot un mot', 'mot deux');
  const all = findMatches(doc, 'mot', {});
  assert.equal(all.length, 3);
  const second = doc.child(0).nodeSize;
  assert.equal(findMatches(doc, 'mot', { range: { from: second, to: doc.content.size } }).length, 1);
  assert.equal(findMatches(doc, 'mot', { range: { from: 1, to: 6 } }).length, 1);
});

test('^p dans le remplacement coupe le paragraphe', () => {
  const doc = docOf('un; deux; trois');
  let state = EditorState.create({ doc });
  const tr = state.tr;
  replaceMatches(tr, findMatches(doc, '; ', {}), '; ', '^p', {});
  state = state.apply(tr);
  assert.deepEqual(texts(state), ['un', 'deux', 'trois']);
});
