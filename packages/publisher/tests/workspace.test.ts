import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Transform } from '@forgeoffice/pptx';
import { addShape, addText, NO_FILL, para } from '../src/build.ts';
import { defaultSettings } from '../src/model.ts';
import { createPublication } from '../src/pubdeck.ts';
import { RESERVE_GAP, isOffPage, moveShapesToPage, placeInPage, reservePosition } from '../src/workspace.ts';

const page = { width: 600, height: 800 };
const at = (x: number, y: number, width = 100, height = 50): Transform => ({ x, y, width, height });

test('zone de travail : hors page, mise en réserve et retour dans la page', () => {
  assert.equal(isOffPage(at(10, 10), page), false);
  assert.equal(isOffPage(at(-60, 10), page), false, 'chevauche encore la page');
  assert.equal(isOffPage(at(-100, 10), page), true);
  assert.equal(isOffPage(at(600, 10), page), true);
  assert.equal(isOffPage(at(10, 800), page), true);
  const reserve = reservePosition(at(200, 300));
  assert.deepEqual(reserve, { x: -100 - RESERVE_GAP, y: 300 });
  assert.equal(isOffPage(at(reserve.x, reserve.y), page), true);
  assert.deepEqual(placeInPage(at(-118, 300), page, 36), { x: 36, y: 300 });
  assert.deepEqual(placeInPage(at(580, 790), page, 36), { x: 464, y: 714 });
  assert.deepEqual(placeInPage(at(50, 50), page, 36), { x: 50, y: 50 });
  assert.deepEqual(placeInPage(at(0, 0, 900, 900), page, 0), { x: 0, y: 0 });
});

test('déplacement entre pages : nouvel identifiant, même position, source nettoyée, article chaîné refusé', () => {
  const deck = createPublication({ width: 600, height: 800 }, 2);
  const [p1, p2] = deck.slides;
  const keep = addShape(p1!.shapes, [10, 10, 50, 50], NO_FILL);
  const moved = addShape(p1!.shapes, [200, 300, 80, 40], NO_FILL);
  const box = addText(p1!.shapes, [20, 400, 100, 60], [para('Texte', {})], {}, {});
  addShape(p2!.shapes, [0, 0, 5, 5], NO_FILL);
  const pub = defaultSettings();
  const r = moveShapesToPage(deck, pub, 0, 1, [moved.id]);
  assert.ok('deck' in r);
  assert.deepEqual(r.deck.slides[0]!.shapes.map((s) => s.id), [keep.id, box.id]);
  const arrived = r.deck.slides[1]!.shapes.find((s) => s.id === r.ids[0]);
  assert.deepEqual([arrived?.xfrm?.x, arrived?.xfrm?.y], [200, 300]);
  assert.equal(new Set(r.deck.slides[1]!.shapes.map((s) => s.id)).size, r.deck.slides[1]!.shapes.length);
  assert.equal(deck.slides[0]!.shapes.length, 3, 'le document d origine n est pas modifié');
  const chained = { ...pub, chains: [{ id: 'a', boxes: [{ page: p1!.id, shape: box.id }, { page: p2!.id, shape: 1 }], joins: [false], empty: [false, true] }] };
  assert.deepEqual(moveShapesToPage(deck, chained, 0, 1, [box.id]), { error: 'chained' });
  assert.deepEqual(moveShapesToPage(deck, pub, 0, 0, [moved.id]), { error: 'same' });
  assert.deepEqual(moveShapesToPage(deck, pub, 0, 5, [moved.id]), { error: 'unknown' });
  assert.deepEqual(moveShapesToPage(deck, pub, 0, 1, [999]), { error: 'unknown' });
});
