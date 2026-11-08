// Dictionnaire personnel : occurrences, suspects, ignorer tout, changer tout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from 'prosemirror-state';
import { createSchema } from '../src/editor/schema.ts';
import { addToDictionary, changeAll, ignoreAll, personalWords, scanSuspects, wordRanges } from '../src/features/dictionary.ts';

const schema = createSchema();
const doc = schema.nodes.doc!.create(null, [
  schema.nodes.paragraph!.create(null, schema.text('Le chateau est grand, le chateau est beau. Le château brille. chateau chateau')),
  schema.nodes.paragraph!.create(null, schema.text('Un chateau, un chateaux et une maison, maison, maison.')),
]);
const apply = (cmd: ReturnType<typeof ignoreAll>, s: EditorState): EditorState => { let out = s; cmd(s, (tr) => { out = s.apply(tr); }); return out; };

test('occurrences d un mot entier, casse ignoree', () => {
  assert.equal(wordRanges(doc, 'chateau').length, 5);
  assert.equal(wordRanges(doc, 'Chateau').length, 5);
  assert.equal(wordRanges(doc, 'chat').length, 0);
});

test('suspects : mot rare proche d un mot frequent', () => {
  const s = scanSuspects(doc, new Set());
  assert.ok(s.some((x) => x.word === 'château' && x.suggestions.includes('chateau')));
  assert.ok(!s.some((x) => x.word === 'maison'));
  assert.ok(!scanSuspects(doc, personalWords(['château'])).some((x) => x.word === 'château'));
});

test('ignorer tout : plus de suspect', () => {
  const state = apply(ignoreAll('château'), EditorState.create({ doc }));
  assert.equal(scanSuspects(state.doc, new Set()).some((x) => x.word === 'château'), false);
});

test('changer tout et dictionnaire', () => {
  const state = apply(changeAll('chateau', 'château'), EditorState.create({ doc }));
  assert.equal(wordRanges(state.doc, 'chateau').length, 0);
  assert.equal(wordRanges(state.doc, 'château').length, 6);
  assert.deepEqual(addToDictionary(['zèbre'], 'Abeille'), ['abeille', 'zèbre']);
  assert.deepEqual(addToDictionary(['abeille'], 'ABEILLE'), ['abeille']);
});
