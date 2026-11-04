import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from 'prosemirror-state';
import { createSchema } from '../src/editor/schema.ts';
import { buildRegex, findMatches, nextMatch, replaceMatches, textOf } from '../src/editor/find.ts';

const schema = createSchema();
const p = (...parts: (string | 'IMG')[]) => schema.nodes.paragraph!.create(null, parts.map((x) => (x === 'IMG'
  ? schema.nodes.atom!.create({ data: { type: 'image', mediaId: 'm', width: 10, height: 10 } })
  : schema.text(x))));
const doc = schema.nodes.doc!.create(null, [p('Le chat dort. Un Chat noir.'), p('chaton', 'IMG', ' été chat'), p()]);

test('recherche simple insensible a la casse', () => {
  const m = findMatches(doc, 'chat');
  assert.equal(m.length, 4);
  assert.equal(doc.textBetween(m[0]!.from, m[0]!.to), 'chat');
  assert.equal(m[1]!.text, 'Chat');
});

test('respecter la casse, mot entier, accents', () => {
  assert.equal(findMatches(doc, 'Chat', { caseSensitive: true }).length, 1);
  assert.equal(findMatches(doc, 'chat', { wholeWord: true }).length, 3);
  assert.equal(findMatches(doc, 'ete', { ignoreAccents: true }).length, 1);
  assert.equal(findMatches(doc, 'ete').length, 0);
});

test('expressions regulieres et expression invalide', () => {
  assert.equal(findMatches(doc, 'ch\\w+', { regex: true }).length, 4);
  assert.equal(buildRegex('(', { regex: true }), null);
  assert.deepEqual(findMatches(doc, 'a*', { regex: true }).map((m) => m.text), ['a', 'a', 'a', 'a']);
  assert.equal(textOf(doc.child(1)), 'chaton￼ été chat');
});

test('remplacer tout : texte simple, groupes regex, positions apres un objet', () => {
  const state = EditorState.create({ doc });
  let tr = state.tr;
  assert.equal(replaceMatches(tr, findMatches(doc, 'chat', { wholeWord: true }), 'chat', 'chien'), 3);
  assert.equal(tr.doc.child(0).textContent, 'Le chien dort. Un chien noir.');
  assert.equal(tr.doc.child(1).textContent, 'chaton été chien');
  assert.equal(tr.doc.child(1).childCount, 3);
  tr = state.tr;
  replaceMatches(tr, findMatches(doc, '(\\w+) (noir)', { regex: true }), '(\\w+) (noir)', '$2 $1', { regex: true });
  assert.equal(tr.doc.child(0).textContent, 'Le chat dort. Un noir Chat.');
});

test('occurrence suivante / precedente en boucle', () => {
  const m = findMatches(doc, 'chat');
  assert.equal(nextMatch(m, 0), 0);
  assert.equal(nextMatch(m, m[1]!.from), 1);
  assert.equal(nextMatch(m, 10_000), 0);
  assert.equal(nextMatch(m, 0, true), m.length - 1);
  assert.equal(nextMatch([], 0), -1);
});
