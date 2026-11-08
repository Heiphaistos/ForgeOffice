// « Atteindre » : cibles par type et pas suivant/precedent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchema } from '../src/editor/schema.ts';
import { createTable } from '../src/editor/commands.ts';
import { createBlankDocument } from '@forgeoffice/docx';
import { gotoTargets, stepTarget } from '../src/navigation/targets.ts';

const schema = createSchema();
const atom = (data: object) => schema.nodes.atom!.create({ data });
const para = (kids: ReturnType<typeof atom>[], text = 'x', styleId: string | null = null) => schema.nodes.paragraph!.create({ styleId }, [schema.text(text), ...kids]);

test('cibles par type', () => {
  const meta = { ...createBlankDocument(), comments: [{ id: 3, author: 'Léa', blocks: [] }] };
  const doc = schema.nodes.doc!.create(null, [
    para([atom({ type: 'bookmarkStart', id: 1, name: 'Intro' }), atom({ type: 'bookmarkStart', id: 2, name: '_Toc1' })], 'Titre', 'Heading1'),
    para([atom({ type: 'footnoteRef', id: 1 }), atom({ type: 'commentStart', commentId: 3 })]),
    createTable(schema, 1, 2),
    para([atom({ type: 'image', mediaId: 'm', width: 1, height: 1 }), atom({ type: 'endnoteRef', id: 1 }), atom({ type: 'field', instruction: ' PAGE ', result: [] }), atom({ type: 'equation', omml: '' })]),
    schema.nodes.paragraph!.create({ sectionBreak: { breakType: 'nextPage' } }, schema.text('fin de section')),
  ]);
  assert.deepEqual(gotoTargets(doc, meta, 'bookmark').map((t) => t.label), ['Intro']);
  assert.deepEqual(gotoTargets(doc, meta, 'heading').map((t) => t.label), ['Titre']);
  assert.deepEqual(gotoTargets(doc, meta, 'comment').map((t) => t.label), ['Commentaire 1 — Léa']);
  assert.deepEqual(gotoTargets(doc, meta, 'footnote').map((t) => t.label), ['Note de bas de page 1']);
  assert.deepEqual(gotoTargets(doc, meta, 'endnote').map((t) => t.label), ['Note de fin 1']);
  assert.deepEqual(gotoTargets(doc, meta, 'table').map((t) => t.label), ['Tableau 1']);
  assert.deepEqual(gotoTargets(doc, meta, 'image').map((t) => t.label), ['Image 1']);
  assert.deepEqual(gotoTargets(doc, meta, 'field').map((t) => t.label), ['Champ 1 : PAGE']);
  assert.deepEqual(gotoTargets(doc, meta, 'equation').map((t) => t.label), ['Équation 1']);
  assert.deepEqual(gotoTargets(doc, meta, 'section').map((t) => t.label), ['Section 1']);
});

test('suivant / precedent en boucle', () => {
  const t = [{ label: 'a', pos: 5 }, { label: 'b', pos: 20 }];
  assert.equal(stepTarget(t, 0, 1)?.label, 'a');
  assert.equal(stepTarget(t, 5, 1)?.label, 'b');
  assert.equal(stepTarget(t, 20, 1)?.label, 'a');
  assert.equal(stepTarget(t, 20, -1)?.label, 'a');
  assert.equal(stepTarget(t, 5, -1)?.label, 'b');
  assert.equal(stepTarget([], 0, 1), null);
});
