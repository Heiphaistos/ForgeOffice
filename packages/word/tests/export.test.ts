import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import { createBlankDocument, readDocx, writeDocx, type WordDocument } from '@forgeoffice/docx';
import { createSchema } from '../src/editor/schema.ts';
import { blocksToPM, documentFromPM, documentToPM } from '../src/editor/convert.ts';
import { applyStyle, createTable, insertBlocks, insertInline, insertPageBreak, setList, setRunProp } from '../src/editor/commands.ts';
import { trackTransaction } from '../src/editor/track.ts';
import { ensureList } from '../src/features/lists.ts';
import { collectHeadings, tocBlocks } from '../src/features/toc.ts';

const schema = createSchema();

/** Document construit uniquement par les commandes de l'editeur, puis ecrit en .docx (relu par Word dans la verification COM). */
test('document edite -> .docx valide et relu a l identique', async () => {
  let meta: WordDocument = createBlankDocument();
  let s = EditorState.create({ doc: documentToPM(schema, meta) });
  const run = (cmd: Command): void => { assert.ok(cmd(s, (tr) => { s = s.apply(tr); })); };
  const type = (text: string): void => { s = s.apply(s.tr.insertText(text)); };
  const enter = (): void => { s = s.apply(s.tr.split(s.selection.from)); };
  type('Titre principal');
  run(applyStyle('Heading1', 'paragraph'));
  enter();
  run(applyStyle('Normal', 'paragraph'));
  type('Texte ');
  run(setRunProp('bold', true));
  type('gras');
  run(setRunProp('bold', undefined));
  type(' et normal.');
  enter();
  const list = ensureList(meta, { kind: 'bullet', char: '\u2022' });
  meta = list.doc;
  type('Point de liste');
  run(setList(list.numId));
  enter();
  run(setList(0));
  run(insertInline({ type: 'footnoteRef', noteId: 1, props: { vertAlign: 'superscript' } }));
  meta = { ...meta, footnotes: [{ id: 1, blocks: [{ type: 'paragraph', styleId: 'FootnoteText', props: {}, inlines: [{ type: 'noteMark', kind: 'footnote' }, { type: 'text', text: ' Note.', props: {} }] }] }] };
  run(insertBlocks([createTable(schema, 2, 3), schema.nodes.paragraph!.create()]));
  type('A1');
  s = s.apply(s.tr.setSelection(TextSelection.atEnd(s.doc)));
  run(insertPageBreak);
  type('Page deux');
  const tracked = trackTransaction(s, s.tr.insertText(' suivi'), { author: 'Momo', date: '2026-11-04T10:00:00Z' });
  s = s.apply(tracked!);
  const heads = collectHeadings(s.doc, meta);
  run(insertBlocks([schema.nodes.toc!.create({}, blocksToPM(schema, tocBlocks(heads, () => 1, (_, i) => `_Toc${i}`, 'Table des matières')))], true));
  const doc = documentFromPM(s.doc, meta);
  const bytes = await writeDocx(doc);
  // Export optionnel pour une verification manuelle dans Word : FO_EXPORT=<fichier .docx>.
  if (process.env.FO_EXPORT) writeFileSync(process.env.FO_EXPORT, bytes);
  const back = (await readDocx(bytes)).document;
  const again = documentFromPM(documentToPM(schema, back), back);
  assert.deepEqual(JSON.parse(JSON.stringify(again.body)), JSON.parse(JSON.stringify(back.body)));
  assert.equal(back.body.filter((b) => b.type === 'table').length, 1);
  assert.equal(back.body.filter((b) => b.type === 'toc').length, 1);
  assert.equal(back.footnotes.filter((n) => !n.special).length, 1);
});
