import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TextBody } from '@forgeoffice/pptx';
import {
  applyParagraphProps, applyRunProps, changeCase, commonRunProps, deleteRange, findInBody, indexToPos, insertParagraphs, insertText, paragraphText, posToIndex,
  shiftLevel, sliceBody, splitParagraph, textOfRange, wordAt, wordBoundary,
} from '../src/canvas/text.ts';

const body = (...lines: string[]): TextBody => ({ props: {}, paragraphs: lines.map((t) => ({ props: {}, runs: t ? [{ type: 'text' as const, text: t, props: {} }] : [] })) });
const texts = (b: TextBody): string[] => b.paragraphs.map(paragraphText);

test('insertion simple, multi-paragraphe et saut de ligne', () => {
  const b = body('Bonjour');
  let pos = insertText(b, { p: 0, o: 7 }, ' monde');
  assert.deepEqual(pos, { p: 0, o: 13 });
  pos = insertText(b, { p: 0, o: 0 }, 'A\nB\vC');
  assert.deepEqual(texts(b), ['A', 'B\vCBonjour monde']);
  assert.deepEqual(pos, { p: 1, o: 3 });
  const empty: TextBody = { props: {}, paragraphs: [] };
  insertText(empty, { p: 0, o: 0 }, 'x');
  assert.deepEqual(texts(empty), ['x']);
});

test('suppression sur plusieurs paragraphes et coupure', () => {
  const b = body('Premier', 'Deuxième', 'Troisième');
  const at = deleteRange(b, { start: { p: 0, o: 3 }, end: { p: 2, o: 4 } });
  assert.deepEqual(at, { p: 0, o: 3 });
  assert.deepEqual(texts(b), ['Presième']);
  const pos = splitParagraph(b, { p: 0, o: 3 });
  assert.deepEqual(pos, { p: 1, o: 0 });
  assert.deepEqual(texts(b), ['Pre', 'sième']);
});

test('mise en forme d une plage : decoupe des segments puis fusion', () => {
  const b = body('abcdef');
  applyRunProps(b, { start: { p: 0, o: 2 }, end: { p: 0, o: 4 } }, { bold: true });
  assert.equal(b.paragraphs[0]?.runs.length, 3);
  assert.equal(commonRunProps(b, { start: { p: 0, o: 2 }, end: { p: 0, o: 4 } }).bold, true);
  assert.equal(commonRunProps(b, { start: { p: 0, o: 0 }, end: { p: 0, o: 4 } }).bold, undefined);
  applyRunProps(b, { start: { p: 0, o: 2 }, end: { p: 0, o: 4 } }, { bold: null });
  assert.equal(b.paragraphs[0]?.runs.length, 1);
  insertText(b, { p: 0, o: 6 }, 'g', { size: 40 });
  assert.equal(b.paragraphs[0]?.runs[1]?.props.size, 40);
});

test('proprietes de paragraphe, niveaux, casse, mots', () => {
  const b = body('un deux. trois', 'quatre');
  applyParagraphProps(b, { start: { p: 0, o: 0 }, end: { p: 1, o: 0 } }, { align: 'ctr' });
  assert.equal(b.paragraphs[1]?.props.align, 'ctr');
  shiftLevel(b, { start: { p: 1, o: 0 }, end: { p: 1, o: 0 } }, 1);
  assert.equal(b.paragraphs[1]?.props.level, 1);
  shiftLevel(b, { start: { p: 1, o: 0 }, end: { p: 1, o: 0 } }, -1);
  assert.equal(b.paragraphs[1]?.props.level, undefined);
  changeCase(b, { start: { p: 0, o: 0 }, end: { p: 0, o: 14 } }, 'sentence');
  assert.equal(paragraphText(b.paragraphs[0] as never), 'Un deux. Trois');
  changeCase(b, { start: { p: 0, o: 0 }, end: { p: 0, o: 14 } }, 'upper');
  assert.equal(paragraphText(b.paragraphs[0] as never), 'UN DEUX. TROIS');
  assert.deepEqual(wordAt(b, { p: 0, o: 4 }), { start: { p: 0, o: 3 }, end: { p: 0, o: 7 } });
  assert.deepEqual(wordBoundary(b, { p: 0, o: 0 }, 1), { p: 0, o: 3 });
  assert.equal(textOfRange(b, { start: { p: 0, o: 9 }, end: { p: 1, o: 3 } }), 'TROIS\nqua');
});

test('copier-coller riche et indices globaux', () => {
  const b = body('alpha', 'beta');
  applyRunProps(b, { start: { p: 1, o: 0 }, end: { p: 1, o: 4 } }, { italic: true });
  const slice = sliceBody(b, { start: { p: 0, o: 3 }, end: { p: 1, o: 2 } });
  assert.equal(slice.length, 2);
  const target = body('XY');
  insertParagraphs(target, { p: 0, o: 1 }, slice);
  assert.deepEqual(texts(target), ['Xha', 'beY']);
  assert.equal(target.paragraphs[1]?.runs[0]?.props.italic, true);
  assert.equal(posToIndex(b, { p: 1, o: 2 }), 8);
  assert.deepEqual(indexToPos(b, 8), { p: 1, o: 2 });
  assert.equal(findInBody(b, 'A').length, 3);
});
