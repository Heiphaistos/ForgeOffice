import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageGeometry, pageOf, paginate, sameGaps, type FlowBlock, type FlowLine } from '../src/layout/paginate.ts';

const G = { contentHeight: 100, stride: 130 };

/** Paragraphe de n lignes de 10 px a partir de y. */
function para(pos: number, y: number, n: number, extra: Partial<FlowBlock> = {}): FlowBlock {
  const lines: FlowLine[] = Array.from({ length: n }, (_, i) => ({ y: y + i * 10, h: 10, pos: pos + 1 + i * 5 }));
  return { pos, top: y, bottom: y + n * 10, lines: () => lines, split: 'line', ...extra };
}

test('tout tient sur une page : aucun saut', () => {
  const r = paginate([para(0, 0, 3), para(20, 30, 5)], G);
  assert.equal(r.pageCount, 1);
  assert.deepEqual(r.gaps, []);
});

test('paragraphe coupe entre deux lignes, espace = reste de page + intervalle', () => {
  const r = paginate([para(0, 0, 6), para(40, 60, 6)], G);
  assert.equal(r.pageCount, 2);
  assert.deepEqual(r.gaps, [{ pos: 40 + 1 + 4 * 5, height: 130 - 100, at: 'line' }]);
  assert.deepEqual(r.pageStarts, [0, 100]);
});

test('orpheline evitee : une seule ligne en bas de page -> paragraphe entier deplace', () => {
  const r = paginate([para(0, 0, 9), para(50, 90, 4)], G);
  assert.deepEqual(r.gaps, [{ pos: 50, height: 130 - 90, at: 'block' }]);
});

test('veuve evitee : la derniere ligne n est jamais seule en haut de page', () => {
  const r = paginate([para(0, 0, 7), para(50, 70, 4)], G);
  // lignes a 70, 80, 90, 100 : la 4e deborde -> on coupe avant la 3e (90).
  assert.equal(r.gaps.length, 1);
  assert.equal(r.gaps[0]!.pos, 50 + 1 + 2 * 5);
  assert.equal(r.gaps[0]!.height, 130 - 90);
});

test('sans controle des veuves : coupe exacte', () => {
  const r = paginate([para(0, 0, 7), para(50, 70, 4, { widowControl: false })], G);
  assert.equal(r.gaps[0]!.pos, 50 + 1 + 3 * 5);
});

test('saut de page avant et solidaire du suivant', () => {
  const r = paginate([para(0, 0, 2), para(10, 20, 1, { breakBefore: true })], G);
  assert.deepEqual(r.gaps, [{ pos: 10, height: 110, at: 'block' }]);
  // Titre en bas de page (85..95) solidaire d'un paragraphe qui ne tient pas : le titre passe avec lui.
  const k = paginate([para(0, 0, 8), para(30, 85, 1, { keepNext: true, widowControl: false }), para(40, 95, 3)], G);
  assert.equal(k.gaps[0]!.pos, 30);
  assert.equal(k.gaps[0]!.at, 'block');
});

test('lignes solidaires et bloc indivisible', () => {
  const r = paginate([para(0, 0, 8), para(30, 80, 4, { keepLines: true })], G);
  assert.deepEqual(r.gaps, [{ pos: 30, height: 50, at: 'block' }]);
  const img = paginate([para(0, 0, 5), { pos: 9, top: 50, bottom: 140 }], G);
  assert.deepEqual(img.gaps, [{ pos: 9, height: 80, at: 'block' }]);
});

test('saut manuel au milieu d un paragraphe et tableau coupe par rangees', () => {
  const lines: FlowLine[] = [{ y: 0, h: 10, pos: 1 }, { y: 10, h: 10, pos: 9, forced: true }];
  const r = paginate([{ pos: 0, top: 0, bottom: 20, hasForced: true, lines: () => lines, split: 'line' }], G);
  assert.deepEqual(r.gaps, [{ pos: 9, height: 120, at: 'line' }]);
  const rows: FlowLine[] = Array.from({ length: 5 }, (_, i) => ({ y: 40 + i * 25, h: 25, pos: 100 + i * 10 }));
  const t = paginate([para(0, 0, 4), { pos: 99, top: 40, bottom: 165, lines: () => rows, split: 'row' }], G);
  assert.deepEqual(t.gaps, [{ pos: 120, height: 40, at: 'row' }]);
  assert.equal(t.pageCount, 2);
});

test('long document : plusieurs pages, page d une ordonnee, comparaison', () => {
  const blocks = Array.from({ length: 30 }, (_, i) => para(i * 100, i * 30, 3));
  const r = paginate(blocks, G);
  assert.equal(r.pageCount, 10); // 3 lignes jamais coupees 1+2 : 90 px par page
  assert.equal(pageOf(r, 0), 0);
  assert.equal(pageOf(r, 899), 9);
  assert.ok(sameGaps(r.gaps, paginate(blocks, G).gaps));
  assert.ok(!sameGaps(r.gaps, []));
});

test('geometrie A4 en pixels', () => {
  const g = pageGeometry({ height: 841.9, marginTop: 70.85, marginBottom: 70.85 }, 16);
  assert.equal(Math.round(g.pageHeight), 1123);
  assert.equal(Math.round(g.contentHeight), 934);
  assert.equal(Math.round(g.stride), 1139);
});
