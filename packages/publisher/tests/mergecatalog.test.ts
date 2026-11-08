import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AutoShape, Deck } from '@forgeoffice/pptx';
import { addText, para } from '../src/build.ts';
import { catalogFits, catalogPages, cellBounds, mergeCatalog } from '../src/mergecatalog.ts';
import { createPublication } from '../src/pubdeck.ts';

const source = { name: 'produits', fields: ['Nom', 'Prix'], records: [['Pomme', '1 €'], ['Poire', '2 €'], ['Kiwi', '3 €'], ['Figue', '4 €'], ['Datte', '5 €']] };
const text = (shape: AutoShape): string => shape.text!.paragraphs.map((p) => p.runs.map((r) => (r.type === 'text' ? r.text : '')).join('')).join('|');

function template(): { deck: Deck; cell: number[] } {
  const deck = createPublication({ width: 595, height: 842 }, 2);
  const shapes = deck.slides[0]!.shapes;
  addText(shapes, [40, 20, 300, 30], [para('Catalogue', { size: 20 })], {}, {});
  const a = addText(shapes, [40, 100, 200, 30], [para('«Nom»', { size: 12 })], {}, {});
  const b = addText(shapes, [40, 130, 200, 20], [para('«Prix»', { size: 10 })], {}, {});
  return { deck, cell: [a.id, b.id] };
}

test('catalogue : plusieurs enregistrements par page, grille, pages produites, titre conservé', () => {
  const { deck, cell } = template();
  const out = mergeCatalog(deck, source, 0, cell, { cols: 2, rows: 1, gapX: 20, gapY: 10 });
  // 5 enregistrements, 2 par page = 3 pages produites + la page 2 d origine
  assert.equal(out.slides.length, 4);
  const first = out.slides[0]!.shapes as AutoShape[];
  assert.equal(first.length, 1 + 4);
  assert.deepEqual(first.map(text), ['Catalogue', 'Pomme', '1 €', 'Poire', '2 €']);
  const xs = first.filter((s) => /Pomme|Poire/.test(text(s))).map((s) => s.xfrm!.x);
  assert.deepEqual(xs, [40, 260]);
  assert.deepEqual((out.slides[2]!.shapes as AutoShape[]).map(text), ['Catalogue', 'Datte', '5 €']);
  assert.equal(new Set(out.slides.map((s) => s.id)).size, 4);
  assert.equal(new Set(first.map((s) => s.id)).size, first.length);
  assert.equal(deck.slides.length, 2);
  assert.equal(text(deck.slides[0]!.shapes[1] as AutoShape), '«Nom»');
});

test('catalogue : lignes et colonnes, bornes, grille trop grande refusée', () => {
  const { deck, cell } = template();
  const shapes = deck.slides[0]!.shapes.filter((s) => cell.includes(s.id));
  const box = cellBounds(shapes)!;
  assert.deepEqual([box.x, box.y, box.width, box.height], [40, 100, 200, 50]);
  assert.equal(catalogPages(5, { cols: 2, rows: 2, gapX: 0, gapY: 0 }), 2);
  assert.equal(catalogFits(deck.size, box, { cols: 2, rows: 3, gapX: 20, gapY: 10 }), null);
  assert.equal(catalogFits(deck.size, box, { cols: 3, rows: 1, gapX: 20, gapY: 10 }), 'overflow');
  assert.equal(catalogFits(deck.size, box, { cols: 1, rows: 99, gapX: 0, gapY: 0 }), 'overflow');
  assert.equal(catalogFits(deck.size, box, { cols: 0, rows: 1, gapX: 0, gapY: 0 }), 'cells');
  const grid = mergeCatalog(deck, source, 0, cell, { cols: 1, rows: 3, gapX: 0, gapY: 15 });
  const ys = (grid.slides[0]!.shapes as AutoShape[]).filter((s) => /Pomme|Poire|Kiwi/.test(text(s))).map((s) => s.xfrm!.y);
  assert.deepEqual(ys, [100, 165, 230]);
  assert.equal(mergeCatalog(deck, source, 0, cell, { cols: 3, rows: 1, gapX: 20, gapY: 10 }), deck);
  assert.equal(mergeCatalog(deck, source, 9, cell, { cols: 1, rows: 1, gapX: 0, gapY: 0 }), deck);
});
