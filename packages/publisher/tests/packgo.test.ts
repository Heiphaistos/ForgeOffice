import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addText, para } from '../src/build.ts';
import { fontsUsed, packReadme } from '../src/packgo.ts';
import { createPublication } from '../src/pubdeck.ts';

test('fontsUsed : polices du texte des pages et du modèle, triées et sans doublon', () => {
  const deck = createPublication({ width: 595, height: 842 }, 2);
  addText(deck.slides[0]!.shapes, [10, 10, 100, 20], [para('Bonjour', { font: 'Georgia', size: 12 })], {}, {});
  addText(deck.slides[1]!.shapes, [10, 10, 100, 20], [para('Salut', { font: 'Georgia' }), para('Texte', { font: '+mn-lt' })], {}, {});
  const fonts = fontsUsed(deck);
  assert.ok(fonts.includes('Georgia'));
  assert.equal(fonts.filter((f) => f === 'Georgia').length, 1);
  assert.ok(!fonts.some((f) => f.startsWith('+')), fonts.join(','));
  assert.deepEqual([...fonts].sort((a, b) => a.localeCompare(b, 'fr')), fonts);
});

test('packReadme : dimensions en mm, polices et images listées', () => {
  const text = packReadme({ title: 'Gazette', pages: 4, size: { width: 595.2756, height: 841.8898 }, bleed: 8.5, fonts: ['Georgia'], images: ['image1.png'], files: ['Gazette.fopub'] });
  assert.match(text, /210,0 x 297,0 mm/);
  assert.match(text, /fond perdu 3,0 mm/);
  assert.match(text, /- Georgia/);
  assert.match(text, /- image1\.png/);
});

test('packReadme : tons directs utilisés listés', () => {
  const text = packReadme({ title: 'G', pages: 1, size: { width: 595, height: 842 }, bleed: 9, fonts: [], images: [], files: [], spots: ['Rouge maison : C 0 M 100 J 100 N 20'] });
  assert.match(text, /Tons directs utilisés \(1\)/);
  assert.match(text, /- Rouge maison : C 0 M 100 J 100 N 20/);
  assert.doesNotMatch(packReadme({ title: 'G', pages: 1, size: { width: 595, height: 842 }, bleed: 9, fonts: [], images: [], files: [] }), /Tons directs/);
});
