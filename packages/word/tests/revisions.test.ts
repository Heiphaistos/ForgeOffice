// Volet des verifications : liste, decompte, relecteurs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchema } from '../src/editor/schema.ts';
import { countByKind, listRevisions, reviewers } from '../src/proofing/revisions.ts';

const schema = createSchema();
const rev = (kind: string, id: number, author: string) => schema.marks.revision!.create({ rev: { kind, id, author, date: '2026-11-06T10:00:00Z' } });
const doc = schema.nodes.doc!.create(null, [schema.nodes.paragraph!.create(null, [
  schema.text('Avant '), schema.text('ajout', [rev('insert', 1, 'Léa')]), schema.text(' milieu '), schema.text('retrait', [rev('delete', 2, 'Marc')]),
])]);

test('liste, decompte et relecteurs', () => {
  const all = listRevisions(doc);
  assert.deepEqual(all.map((r) => [r.kind, r.author, r.text]), [['insert', 'Léa', 'ajout'], ['delete', 'Marc', 'retrait']]);
  assert.deepEqual(countByKind(all), { insert: 1, delete: 1, move: 0 });
  assert.deepEqual(reviewers(all), ['Léa', 'Marc']);
  assert.equal(listRevisions(doc, 'Marc').length, 1);
});
