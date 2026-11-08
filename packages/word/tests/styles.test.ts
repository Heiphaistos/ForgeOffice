// Styles : modification, suppression (heritage du parent), noms uniques.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankDocument } from '@forgeoffice/docx';
import { canDelete, nameTaken, removeStyle, updateStyle } from '../src/styles/ops.ts';

const base = createBlankDocument();
const custom = (id: string, basedOn: string, extra: object = {}) => ({ id, type: 'paragraph' as const, name: id, basedOn, custom: true, ...extra });
const meta = { ...base, styles: { ...base.styles, styles: [...base.styles.styles, custom('A', 'Normal'), custom('B', 'A', { next: 'A' })] } };

test('modifier un style', () => {
  const m = updateStyle(meta, 'A', { run: { bold: true, size: 14 }, next: 'Normal' });
  const a = m.styles.styles.find((s) => s.id === 'A')!;
  assert.equal(a.run?.size, 14);
  assert.equal((meta.styles.styles.find((s) => s.id === 'A') as { run?: unknown }).run, undefined);
});

test('supprimer : les enfants heritent du parent, les styles integres restent', () => {
  const m = removeStyle(meta, 'A');
  assert.equal(m.styles.styles.some((s) => s.id === 'A'), false);
  const b = m.styles.styles.find((s) => s.id === 'B')!;
  assert.equal(b.basedOn, 'Normal');
  assert.equal(b.next, 'B');
  const normal = meta.styles.styles.find((s) => s.id === 'Normal')!;
  assert.equal(canDelete(normal), false);
  assert.equal(removeStyle(meta, 'Normal'), meta);
});

test('nom deja pris', () => {
  assert.equal(nameTaken(meta, 'a'), true);
  assert.equal(nameTaken(meta, 'a', 'A'), false);
  assert.equal(nameTaken(meta, 'Inconnu'), false);
});

test('liste personnalisee : niveaux conserves, gabarit valide', async () => {
  const { addList, defaultCustomLevels, findList } = await import('../src/features/lists.ts');
  const { templateValid } = await import('../src/format/listTemplate.ts');
  const levels = defaultCustomLevels().map((l, i) => (i === 0 ? { ...l, format: 'upperLetter' as const, text: '%1)' } : l));
  const { doc, numId } = addList(createBlankDocument(), { kind: 'custom', levels });
  const abs = doc.numbering.abstracts.find((a) => a.id === doc.numbering.instances.find((n) => n.id === numId)?.abstractId)!;
  assert.equal(abs.levels.length, 9);
  assert.equal(abs.levels[0]?.text, '%1)');
  assert.equal(abs.levels[0]?.format, 'upperLetter');
  assert.equal(findList(doc, { kind: 'custom', levels }), null);
  assert.equal(templateValid('%1.%2.', 1), true);
  assert.equal(templateValid('%1.%2.', 0), false);
  assert.equal(templateValid('•', 0), true);
});

test('inspecteur : resume de la mise en forme directe', async () => {
  const { describeParagraph, describeRun } = await import('../src/styles/inspect.ts');
  assert.deepEqual(describeParagraph({ alignment: 'center', indentLeft: 72, spacingAfter: 6 }), ['Centré', 'Retrait gauche 2,54 cm', 'Espacement après 6 pt']);
  assert.deepEqual(describeParagraph({}), []);
  assert.deepEqual(describeRun({ bold: true, size: 14, underline: 'single', color: { rgb: 'FF0000' } }), ['Taille 14 pt', 'Gras', 'Souligné', 'Couleur FF0000']);
  assert.deepEqual(describeRun({ underline: 'none' }), []);
});

test('conversion des notes : appels et contenus passent de l un a l autre', async () => {
  const { moveNotes, convertRefs } = await import('../src/references/convertNotes.ts');
  const { createSchema } = await import('../src/editor/schema.ts');
  const { EditorState } = await import('prosemirror-state');
  const base = createBlankDocument();
  const note = (id: number, text: string) => ({ id, blocks: [{ type: 'paragraph' as const, props: {}, inlines: [{ type: 'noteMark' as const, kind: 'footnote' as const }, { type: 'text' as const, text, props: {} }] }] });
  const meta = { ...base, footnotes: [{ id: -1, special: 'separator' as const, blocks: [] }, note(1, 'un'), note(2, 'deux')], endnotes: [note(1, 'fin')] };
  const { meta: out, idMap } = moveNotes(meta, 'footnote');
  assert.deepEqual([...idMap], [[1, 2], [2, 3]]);
  assert.deepEqual(out.footnotes.map((n) => n.id), [-1]);
  assert.deepEqual(out.endnotes.map((n) => n.id), [1, 2, 3]);
  assert.equal((out.endnotes[1]!.blocks[0] as { inlines: { kind?: string }[] }).inlines[0]?.kind, 'endnote');
  const schema = createSchema();
  const atom = (data: object) => schema.nodes.atom!.create({ data });
  const doc = schema.nodes.doc!.create(null, [schema.nodes.paragraph!.create(null, [atom({ type: 'footnoteRef', noteId: 1 }), atom({ type: 'footnoteRef', noteId: 2 }), atom({ type: 'endnoteRef', noteId: 1 })])]);
  let state = EditorState.create({ doc });
  convertRefs('footnote', idMap)(state, (tr) => { state = state.apply(tr); });
  const kinds: string[] = [];
  state.doc.descendants((n) => { if (n.type.name === 'atom') kinds.push(`${(n.attrs.data as { type: string }).type}:${(n.attrs.data as { noteId: number }).noteId}`); });
  assert.deepEqual(kinds, ['endnoteRef:2', 'endnoteRef:3', 'endnoteRef:1']);
});

test('import / export de styles : ajout, remplacement, listes retirees, aller-retour .docx', async () => {
  const { mergeStyles, stylesDocument } = await import('../src/styles/transfer.ts');
  const { readDocx, writeDocx } = await import('@forgeoffice/docx');
  const src = { ...base, styles: { ...base.styles, styles: [...base.styles.styles, { id: 'Neuf', type: 'paragraph' as const, name: 'Neuf', custom: true, paragraph: { alignment: 'center' as const, numbering: { numId: 4, level: 0 } }, run: { bold: true } }] } };
  const { document } = await readDocx(await writeDocx(stylesDocument(src)));
  assert.equal(document.body.length, 1);
  const target = createBlankDocument();
  const r1 = mergeStyles(target, document, 'add');
  assert.equal(r1.added, 1, r1.meta.styles.styles.slice(-5).map((s) => s.id).join(','));
  const neuf = r1.meta.styles.styles.find((s) => s.id === 'Neuf')!;
  assert.equal(neuf.run?.bold, true);
  assert.equal(neuf.paragraph?.alignment, 'center');
  assert.equal(neuf.paragraph?.numbering, undefined);
  const edited = { ...document, styles: { ...document.styles, styles: document.styles.styles.map((s) => (s.id === 'Neuf' ? { ...s, run: { italic: true } } : s)) } };
  assert.equal(mergeStyles(r1.meta, edited, 'add').replaced, 0);
  const r2 = mergeStyles(r1.meta, edited, 'replace');
  assert.equal(r2.replaced, 1);
  assert.equal(r2.meta.styles.styles.find((s) => s.id === 'Neuf')?.run?.italic, true);
});
