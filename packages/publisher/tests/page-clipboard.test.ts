import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublication, insertPages, pastePage } from '../src/pubdeck.ts';

test('pastePage : copie indépendante, nouvel identifiant, insérée après l indice', () => {
  const deck = createPublication({ width: 595, height: 842 }, 3);
  const source = structuredClone(deck.slides[0]!);
  const copy = pastePage(deck, source, 1);
  assert.equal(deck.slides.length, 4);
  assert.equal(deck.slides[2], copy);
  assert.ok(!deck.slides.slice(0, 2).some((s) => s.id === copy.id) && deck.slides[3]!.id !== copy.id);
  assert.notEqual(copy, source);
  assert.equal(copy.layoutId, source.layoutId);
});

test('pastePage : collage en fin / avant le début, page maître disparue remplacée', () => {
  const deck = createPublication({ width: 595, height: 842 }, 1);
  const source = structuredClone(deck.slides[0]!);
  source.layoutId = 'inconnue';
  const a = pastePage(deck, source, 99);
  assert.equal(deck.slides.at(-1), a);
  assert.equal(a.layoutId, deck.masters[0]!.layouts[0]!.id);
  const b = pastePage(deck, source, -1);
  assert.equal(deck.slides[0], b);
  insertPages(deck, 0, 1);
  assert.equal(new Set(deck.slides.map((s) => s.id)).size, deck.slides.length);
});

test('applyMasterToAll / renameMasterPage', async () => {
  const { applyMasterToAll, renameMasterPage, addMasterPage } = await import('../src/pubdeck.ts');
  const deck = createPublication({ width: 595, height: 842 }, 3);
  const second = addMasterPage(deck)!;
  assert.equal(applyMasterToAll(deck, second.id), 3);
  assert.ok(deck.slides.every((s) => s.layoutId === second.id));
  assert.equal(applyMasterToAll(deck, second.id), 0);
  assert.equal(applyMasterToAll(deck, 'zzz'), 0);
  assert.equal(renameMasterPage(deck, second.id, '  Couverture '), true);
  assert.equal(second.name, 'Couverture');
  assert.equal(renameMasterPage(deck, second.id, '  '), false);
});
