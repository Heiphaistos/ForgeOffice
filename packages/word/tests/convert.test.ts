import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankDocument, readDocx, writeDocx, type Block, type WordDocument } from '@forgeoffice/docx';
import { createSchema } from '../src/editor/schema.ts';
import { blocksFromPM, documentFromPM, documentToPM } from '../src/editor/convert.ts';

const schema = createSchema();
const norm = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

function sample(): WordDocument {
  const doc = createBlankDocument();
  const body: Block[] = [
    { type: 'paragraph', styleId: 'Heading1', props: { keepNext: true }, inlines: [{ type: 'text', text: 'Titre', props: {} }], paraId: '1A2B3C4D' },
    {
      type: 'paragraph', props: { alignment: 'justify', indentFirstLine: 18 }, markProps: { bold: true },
      inlines: [
        { type: 'text', text: 'Gras ', props: { bold: true, size: 14, color: { rgb: 'C00000' } } },
        { type: 'text', text: 'italique', styleId: 'Emphasis', props: { italic: true, noProof: true } },
        { type: 'tab', props: { bold: true } },
        { type: 'text', text: 'apres tab', props: {} },
        { type: 'break', kind: 'line' },
        { type: 'hyperlink', url: 'https://exemple.fr/', tooltip: 'info', inlines: [{ type: 'text', text: 'lien', props: { underline: 'single' } }] },
        { type: 'bookmarkStart', id: 1, name: 'ici' },
        { type: 'bookmarkEnd', id: 1 },
        { type: 'field', instruction: 'PAGE', code: 'PAGE', result: [{ type: 'text', text: '1', props: {} }] },
        { type: 'footnoteRef', noteId: 1 },
        { type: 'text', text: 'inséré', props: {}, revision: { kind: 'insert', id: 4, author: 'Momo', date: '2026-11-04T10:00:00Z' } },
        { type: 'inlineControl', props: { kind: 'plainText', tag: 'nom' }, inlines: [{ type: 'text', text: 'Jean', props: {} }] },
        { type: 'break', kind: 'page' },
        { type: 'raw', xml: { name: 'w:customThing', attrs: { a: '1' }, children: [] } },
      ],
    },
    {
      type: 'table', styleId: 'TableGrid', props: { width: { value: 100, type: 'pct' } }, grid: [100, 120, 80],
      rows: [
        { props: { header: true }, cells: [
          { props: { gridSpan: 2, shading: { fill: 'D9E2F3' } }, blocks: [{ type: 'paragraph', props: {}, inlines: [{ type: 'text', text: 'A+B', props: {} }] }] },
          { props: { vMerge: 'restart' }, blocks: [{ type: 'paragraph', props: {}, inlines: [{ type: 'text', text: 'C', props: {} }] }] },
        ] },
        { props: {}, cells: [
          { props: {}, blocks: [{ type: 'paragraph', props: {}, inlines: [{ type: 'text', text: 'a', props: {} }] }] },
          { props: {}, blocks: [{ type: 'paragraph', props: {}, inlines: [{ type: 'text', text: 'b', props: {} }] }] },
          { props: { vMerge: 'continue' }, blocks: [{ type: 'paragraph', props: {}, inlines: [] }] },
        ] },
      ],
    },
    { type: 'toc', instruction: 'TOC \\o "1-3"', id: 7, blocks: [{ type: 'paragraph', styleId: 'TOC1', props: {}, inlines: [{ type: 'text', text: 'Titre', props: {} }] }] },
    { type: 'contentControl', props: { kind: 'richText', alias: 'Zone' }, blocks: [{ type: 'paragraph', props: {}, inlines: [{ type: 'text', text: 'dedans', props: {} }] }] },
    { type: 'raw', xml: { name: 'w:altChunk', attrs: { 'r:id': 'rId9' }, children: [] } },
    { type: 'paragraph', props: {}, inlines: [], sectionBreak: { ...doc.finalSection, breakType: 'continuous' } },
  ];
  return { ...doc, body };
}

test('aller-retour modele -> ProseMirror -> modele sans perte', () => {
  const doc = sample();
  const pm = documentToPM(schema, doc);
  pm.check();
  const back = documentFromPM(pm, doc);
  assert.deepEqual(norm(back.body), norm(doc.body));
});

test('fusions de cellules : gridSpan -> colspan, vMerge -> rowspan', () => {
  const pm = documentToPM(schema, sample());
  let table = pm.child(0);
  pm.forEach((n) => { if (n.type.name === 'table') table = n; });
  const first = table.child(0);
  assert.equal(first.childCount, 2);
  assert.equal(first.child(0).attrs.colspan, 2);
  assert.equal(first.child(1).attrs.rowspan, 2);
  assert.deepEqual(first.child(0).attrs.colwidth, [133, 160]);
  assert.equal(table.child(1).childCount, 2);
});

test('proprietes de caracteres -> une marque par propriete', () => {
  const pm = documentToPM(schema, sample());
  const para = pm.child(1);
  const bold = para.child(0);
  const names = bold.marks.map((m) => m.type.name).sort();
  assert.deepEqual(names, ['rp_bold', 'rp_color', 'rp_size']);
  const italic = para.child(1);
  assert.ok(italic.marks.some((m) => m.type.name === 'cstyle' && m.attrs.id === 'Emphasis'));
  assert.ok(italic.marks.some((m) => m.type.name === 'rp_rest'));
  assert.equal(para.child(2).text, '\t');
});

test('document vide -> un paragraphe vide', () => {
  const pm = documentToPM(schema, { body: [] });
  assert.equal(pm.childCount, 1);
  assert.equal(pm.child(0).type.name, 'paragraph');
  assert.deepEqual(norm(blocksFromPM(pm)), [{ type: 'paragraph', props: {}, inlines: [] }]);
});

test('vrai .docx : ecriture -> lecture -> ProseMirror -> ecriture -> lecture identique', async () => {
  const doc = sample();
  doc.body = doc.body.filter((b) => b.type !== 'raw');
  const first = await readDocx(await writeDocx(doc));
  const pm = documentToPM(schema, first.document);
  const second = await readDocx(await writeDocx(documentFromPM(pm, first.document)));
  assert.deepEqual(norm(second.document.body), norm(first.document.body));
});
