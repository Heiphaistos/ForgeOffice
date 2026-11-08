import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorsOf, filterComments, isFiltering, kindsOf, NO_FILTER } from '../src/commentfilter.ts';
import type { Item } from '../src/model.ts';

const base = { author: 'Ana', at: 1000 };
const items: Item[] = [
  { ...base, id: '1', page: 2, kind: 'note', pos: { x: 0, y: 0 }, text: 'À vérifier : Équipe', color: '#fff' },
  { ...base, id: '2', page: 0, author: 'Zoé', at: 3000, kind: 'mark', mark: 'highlight', rects: [], color: '#ff0', text: 'important' },
  { ...base, id: '3', page: 1, at: 2000, kind: 'stamp', stamp: 'approuve', rect: { x: 0, y: 0, w: 1, h: 1 } },
];
const label = (k: string): string => ({ note: 'Note', mark: 'Surlignage', stamp: 'Tampon' } as Record<string, string>)[k] ?? k;

test('filtre par texte (sans accents), type, auteur', () => {
  assert.deepEqual(filterComments(items, NO_FILTER, label).map((i) => i.id), ['2', '3', '1']);
  assert.deepEqual(filterComments(items, { ...NO_FILTER, text: 'equipe' }, label).map((i) => i.id), ['1']);
  assert.deepEqual(filterComments(items, { ...NO_FILTER, text: 'zoe' }, label).map((i) => i.id), ['2']);
  assert.deepEqual(filterComments(items, { ...NO_FILTER, text: 'tampon' }, label).map((i) => i.id), ['3']);
  assert.deepEqual(filterComments(items, { ...NO_FILTER, kind: 'note' }, label).map((i) => i.id), ['1']);
  assert.deepEqual(filterComments(items, { ...NO_FILTER, author: 'Ana' }, label).map((i) => i.id), ['3', '1']);
});

test('tris et listes de valeurs', () => {
  assert.deepEqual(filterComments(items, { ...NO_FILTER, sort: 'recent' }, label).map((i) => i.id), ['2', '3', '1']);
  assert.deepEqual(filterComments(items, { ...NO_FILTER, sort: 'author' }, label).map((i) => i.id), ['3', '1', '2']);
  assert.deepEqual(filterComments(items, { ...NO_FILTER, sort: 'kind' }, label).map((i) => i.id), ['1', '2', '3']);
  assert.deepEqual(authorsOf(items), ['Ana', 'Zoé']);
  assert.deepEqual(kindsOf(items), ['note', 'mark', 'stamp']);
  assert.equal(isFiltering(NO_FILTER), false);
  assert.equal(isFiltering({ ...NO_FILTER, kind: 'mark' }), true);
});
