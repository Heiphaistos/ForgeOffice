import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankDocument, formatNumber, type Block, type Section } from '@forgeoffice/docx';
import { createSchema } from '../src/editor/schema.ts';
import { documentToPM } from '../src/editor/convert.ts';
import { horizontalDiffers, pageLabels, resolveRefs, sectionIndexAt, sectionSpans, startsNewPage } from '../src/features/sections.ts';
import { paginate, pageGeometry, NOTE_SEPARATOR, type FlowBlock, type FlowLine } from '../src/layout/paginate.ts';

const schema = createSchema();
const para = (text: string, sectionBreak?: Section): Block => ({ type: 'paragraph', props: {}, inlines: [{ type: 'text', text, props: {} }], ...(sectionBreak ? { sectionBreak } : {}) });

function threeSections() {
  const doc = createBlankDocument();
  const a = { ...doc.finalSection, breakType: 'nextPage' as const };
  const b: Section = { ...doc.finalSection, orientation: 'landscape', pageWidth: doc.finalSection.pageHeight, pageHeight: doc.finalSection.pageWidth, breakType: 'nextPage' };
  const c: Section = { ...doc.finalSection, breakType: 'oddPage' };
  doc.body = [para('un'), para('fin 1', a), para('deux'), para('fin 2', b), para('trois')];
  doc.finalSection = c;
  return { doc, a, b, c };
}

test('sectionSpans : une section par paragraphe de fin + la derniere', () => {
  const { doc, a, b, c } = threeSections();
  const pm = documentToPM(schema, doc);
  const spans = sectionSpans(pm, doc.finalSection);
  assert.equal(spans.length, 3);
  assert.deepEqual(spans.map((s) => s.paraPos !== null), [true, true, false]);
  assert.equal(spans[0]!.section.pageWidth, a.pageWidth);
  assert.equal(spans[1]!.section.orientation, b.orientation);
  assert.equal(spans[2]!.section, c);
  assert.equal(sectionIndexAt(spans, 1), 0);
  assert.equal(sectionIndexAt(spans, spans[0]!.end), 1);
  assert.equal(sectionIndexAt(spans, pm.content.size), 2);
  assert.equal(horizontalDiffers([a, b, c]), true);
  assert.equal(horizontalDiffers([a, c]), false);
});

test('une section continue de taille differente ouvre une nouvelle page', () => {
  const { a, b } = threeSections();
  assert.equal(startsNewPage(a, { ...a, breakType: 'continuous' }), false);
  assert.equal(startsNewPage(a, { ...b, breakType: 'continuous' }), true);
  assert.equal(startsNewPage(a, { ...a, breakType: 'nextPage' }), true);
});

test('numerotation : une section avec start redemarre, les autres continuent', () => {
  const { a, b, c } = threeSections();
  const secs = [a, { ...b, pageNumbering: { start: 1, format: 'lowerRoman' as const } }, c];
  const labels = pageLabels([0, 0, 1, 1, 2], secs, formatNumber);
  assert.deepEqual(labels.map((l) => l.text), ['1', '2', 'i', 'ii', '3']);
  assert.deepEqual(labels.map((l) => l.firstOfSection), [true, false, true, false, true]);
});

test('en-tetes : une section sans reference herite de la precedente', () => {
  const { a, b, c } = threeSections();
  const refs = resolveRefs([{ ...a, headers: { default: 'h1' } }, { ...b, headers: {} }, { ...c, headers: { default: 'h3', first: 'f3' } }], 'headers');
  assert.deepEqual(refs.map((r) => r.default), ['h1', 'h1', 'h3']);
  assert.equal(refs[1]!.first, undefined);
  assert.equal(refs[2]!.first, 'f3');
});

// Paragraphes de n lignes de 10 px.
function lines(pos: number, y: number, n: number, section: number, extra: Partial<FlowBlock> = {}): FlowBlock {
  const ls: FlowLine[] = Array.from({ length: n }, (_, i) => ({ y: y + i * 10, h: 10, pos: pos + 1 + i * 5 }));
  return { pos, top: y, bottom: y + n * 10, lines: () => ls, split: 'line', section, ...extra };
}

test('pagination par section : chaque page prend la hauteur de sa section', () => {
  const portrait = { contentHeight: 100, stride: 130, top: 20 };
  const landscape = { contentHeight: 60, stride: 90, top: 10 };
  // 6 lignes portrait (une page + 0), puis section paysage (saut de page), 8 lignes (60 px -> 2 pages).
  const blocks = [lines(0, 0, 6, 0), lines(50, 60, 8, 1, { breakBefore: true })];
  const r = paginate(blocks, [portrait, landscape]);
  assert.deepEqual(r.pageSections, [0, 1, 1]);
  assert.equal(r.pageCount, 3);
  // Premier saut : fin de page portrait (130 - 60) + difference de marges haute (10 - 20).
  assert.equal(r.gaps[0]!.height, 130 - 60 + (10 - 20));
  // Haut des feuilles : portrait 130 plus loin, puis paysage 90 plus loin.
  assert.deepEqual(r.pageTops, [0, 130, 220]);
  // La page paysage coupe a 60 px, pas a 100.
  assert.equal(r.gaps[1]!.pos, 50 + 1 + 6 * 5);
});

test('section en page impaire : une page blanche est inseree', () => {
  const g = { contentHeight: 100, stride: 130, top: 0 };
  const blocks = [lines(0, 0, 3, 0), lines(30, 30, 3, 1, { breakBefore: true, parity: 'odd' })];
  const r = paginate(blocks, [g, g]);
  // Le saut tombe sur la page 2 : il faut une page blanche pour arriver en page 3 (impaire).
  assert.equal(r.pageCount, 3);
  assert.equal(r.gaps[0]!.height, 130 - 30 + 130);
  assert.deepEqual(r.pageTops, [0, 130, 260]);
  const even = paginate([lines(0, 0, 3, 0), lines(30, 30, 3, 1, { breakBefore: true, parity: 'even' })], [g, g]);
  assert.equal(even.pageCount, 2);
});

test('notes de bas de page : la zone de texte est reduite de la hauteur des notes', () => {
  const g = { contentHeight: 100, stride: 130 };
  const blocks = [lines(0, 0, 10, 0)];
  // Sans note : tout tient a 100.
  assert.equal(paginate(blocks, g).pageCount, 1);
  // Une note de 30 px ancree dans la premiere ligne : il reste 100 - 30 - separateur.
  const r = paginate(blocks, g, [{ y: 2, h: 30 }]);
  assert.equal(r.pageCount, 2);
  const keep = 100 - 30 - NOTE_SEPARATOR;
  assert.equal(r.gaps[0]!.pos, 0 + 1 + keep / 10 * 5);
  // Une note ancree sur la page 2 ne reduit pas la page 1.
  const late = paginate([lines(0, 0, 14, 0)], g, [{ y: 105, h: 30 }]);
  assert.equal(late.gaps[0]!.pos, 0 + 1 + 10 * 5);
});

test('geometrie de page : marge haute transmise', () => {
  const geo = pageGeometry({ height: 600, marginTop: 72, marginBottom: 72 }, 16);
  assert.equal(geo.top, 96);
  assert.equal(geo.stride, 800 + 16);
});
