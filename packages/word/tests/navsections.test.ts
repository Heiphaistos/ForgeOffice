// Volet Navigation : deplacer, hausser / abaisser des sections de titres.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, type Transaction } from 'prosemirror-state';
import { createSchema } from '../src/editor/schema.ts';
import { createBlankDocument } from '@forgeoffice/docx';
import { collectHeadings } from '../src/features/toc.ts';
import { moveSection, moveStep, shiftSection } from '../src/navigation/sections.ts';

const schema = createSchema();
const P = (text: string, styleId: string | null = null) => schema.nodes.paragraph!.create({ styleId }, schema.text(text));
const meta = createBlankDocument();
const doc = schema.nodes.doc!.create(null, [P('A', 'Heading1'), P('a1'), P('A.1', 'Heading2'), P('a11'), P('B', 'Heading1'), P('b1'), P('C', 'Heading1'), P('c1')]);
const run = (s: EditorState, cmd: (st: EditorState, d: (tr: Transaction) => void) => boolean): EditorState => { let out = s; assert.ok(cmd(s, (tr) => { out = s.apply(tr); })); return out; };
const texts = (s: EditorState): string => { const t: string[] = []; s.doc.forEach((n) => t.push(n.textContent)); return t.join(','); };
const heads = (s: EditorState) => collectHeadings(s.doc, meta);

test('deplacer une section avec ses sous-titres', () => {
  const s0 = EditorState.create({ doc });
  assert.equal(texts(run(s0, moveSection(heads(s0), 3, 0))), 'C,c1,A,a1,A.1,a11,B,b1');
  assert.equal(texts(run(s0, moveSection(heads(s0), 0, 4))), 'B,b1,C,c1,A,a1,A.1,a11');
  assert.equal(moveSection(heads(s0), 0, 2)(s0, undefined), false); // sur place
  assert.equal(moveSection(heads(s0), 0, 1)(s0, undefined), false); // dans sa propre section
});

test('monter / descendre parmi les voisines', () => {
  const s0 = EditorState.create({ doc });
  const up = run(s0, moveStep(s0.doc, heads(s0), 2, -1)); // B monte avant A
  assert.equal(texts(up), 'B,b1,A,a1,A.1,a11,C,c1');
  const down = run(s0, moveStep(s0.doc, heads(s0), 0, 1)); // A descend apres B
  assert.equal(texts(down), 'B,b1,A,a1,A.1,a11,C,c1');
  const end = run(s0, moveStep(s0.doc, heads(s0), 2, 1)); // B descend apres C
  assert.equal(texts(end), 'A,a1,A.1,a11,C,c1,B,b1');
  assert.equal(moveStep(s0.doc, heads(s0), 0, -1)(s0, undefined), false);
  assert.equal(moveStep(s0.doc, heads(s0), 3 - 1 + 1, 1)(s0, undefined), false);
});

test('abaisser puis hausser une section avec ses sous-titres', () => {
  const s0 = EditorState.create({ doc });
  const s1 = run(s0, shiftSection(heads(s0), 0, 1));
  assert.deepEqual(heads(s1).map((h) => h.level), [2, 3, 1, 1]);
  const s2 = run(s1, shiftSection(heads(s1), 0, -1));
  assert.deepEqual(heads(s2).map((h) => h.level), [1, 2, 1, 1]);
});
