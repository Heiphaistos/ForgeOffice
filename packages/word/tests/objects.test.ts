// Volet Selection : liste des objets (formes, zones de texte, images) dans l'ordre du texte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchema } from '../src/editor/schema.ts';
import { listObjects } from '../src/objects/list.ts';

const schema = createSchema();
const atom = (data: object) => schema.nodes.atom!.create({ data });
const floating = { horizontal: { relativeTo: 'column' }, vertical: { relativeTo: 'paragraph' }, wrap: 'square', behindText: false, distance: { top: 0, right: 0, bottom: 0, left: 0 }, allowOverlap: true, zIndex: 3 };

test('liste des objets du document', () => {
  const doc = schema.nodes.doc!.create(null, [schema.nodes.paragraph!.create(null, [
    schema.text('a'), atom({ type: 'shape', geometry: 'rightArrow', width: 10, height: 10 }),
    atom({ type: 'shape', geometry: 'rect', width: 10, height: 10, floating, text: [{ type: 'paragraph', props: {}, inlines: [{ type: 'text', text: 'Bonjour', props: {} }] }] }),
    atom({ type: 'image', mediaId: 'm', width: 1, height: 1, alt: 'Logo' }),
  ])]);
  const list = listObjects(doc);
  assert.deepEqual(list.map((o) => o.label), ['Flèche droite 1', 'Zone de texte 2 : Bonjour', 'Logo']);
  assert.deepEqual(list.map((o) => o.floating), [false, true, false]);
  assert.equal(list[1]?.zIndex, 3);
});
