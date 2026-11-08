// Protection « Formulaires » : seuls les controles de contenu restent modifiables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from 'prosemirror-state';
import { createBlankDocument } from '@forgeoffice/docx';
import { createSchema } from '../src/editor/schema.ts';
import { formsLockPlugin, insideControl } from '../src/editor/formsLock.ts';

const schema = createSchema();
const p = (t: string, marks: ReturnType<NonNullable<typeof schema.marks.control>['create']>[] = []) => schema.nodes.paragraph!.create(null, schema.text(t, marks));
const ctl = schema.marks.control!.create({ props: { kind: 'plainText' } });
const doc = schema.nodes.doc!.create(null, [
  p('libre'),
  schema.nodes.control_block!.create({ props: { kind: 'plainText' } }, [p('champ bloc')]),
  schema.nodes.paragraph!.create(null, [schema.text('avant '), schema.text('champ ligne', [ctl]), schema.text(' apres')]),
]);

test('plage dans un controle de contenu', () => {
  let libre = 0; let bloc = 0; let ligne = 0;
  doc.descendants((n, pos) => { if (n.isText && n.text === 'libre') libre = pos; if (n.isText && n.text === 'champ bloc') bloc = pos; if (n.isText && n.text === 'champ ligne') ligne = pos; });
  assert.equal(insideControl(doc, libre + 1, libre + 3), false);
  assert.equal(insideControl(doc, bloc + 1, bloc + 4), true);
  assert.equal(insideControl(doc, ligne + 1, ligne + 4), true);
  assert.equal(insideControl(doc, ligne - 3, ligne + 4), false);
});

test('le verrou refuse les modifications hors controle quand la protection forms est active', () => {
  const meta = createBlankDocument();
  meta.settings.protection = { kind: 'forms', enforced: true };
  let state = EditorState.create({ doc, plugins: [formsLockPlugin(() => meta)] });
  let libre = 0; let bloc = 0;
  doc.descendants((n, pos) => { if (n.isText && n.text === 'libre') libre = pos; if (n.isText && n.text === 'champ bloc') bloc = pos; });
  const refused = state.applyTransaction(state.tr.insertText('X', libre + 1));
  assert.equal(refused.transactions.length, 0);
  state = state.applyTransaction(state.tr.insertText('Y', bloc + 1)).state;
  assert.ok(state.doc.textContent.includes('cYhamp bloc'));
  meta.settings.protection = undefined;
  assert.equal(state.applyTransaction(state.tr.insertText('X', libre + 1)).transactions.length, 1);
});
