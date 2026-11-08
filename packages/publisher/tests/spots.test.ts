import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rgbaToCmyk } from '../src/cmyk.ts';
import { addShape, solid } from '../src/build.ts';
import { defaultSettings, parseSettings, serializeSettings } from '../src/model.ts';
import { createPublication } from '../src/pubdeck.ts';
import { parseSpots, removeSpot, saveSpot, spotLookup, usedSpots } from '../src/spots.ts';

const red = { name: 'Rouge maison', rgb: '#c00000', cmyk: [0, 100, 100, 20] as [number, number, number, number] };

test('tons directs : enregistrement, remplacement par nom, couleur d écran unique, bornes', () => {
  let s = saveSpot([], red);
  assert.deepEqual(s, [{ ...red, rgb: '#C00000' }]);
  s = saveSpot(s, { ...red, cmyk: [0, 90, 100, 10] });
  assert.equal(s.length, 1);
  assert.deepEqual(s[0]!.cmyk, [0, 90, 100, 10]);
  assert.equal(saveSpot(s, { name: 'Autre', rgb: '#C00000', cmyk: [1, 1, 1, 1] }).length, 1, 'même couleur d écran refusée');
  assert.equal(saveSpot(s, { name: '  ', rgb: '#112233', cmyk: [0, 0, 0, 0] }).length, 1);
  assert.equal(saveSpot(s, { name: 'Bleu', rgb: 'bleu', cmyk: [0, 0, 0, 0] }).length, 1);
  assert.deepEqual(parseSpots([{ name: 'X', rgb: '#00ff00', cmyk: [500, -4, 'a', 50.4] }])[0]!.cmyk, [100, 0, 0, 50]);
  assert.deepEqual(removeSpot(s, 'Rouge maison'), []);
  assert.deepEqual(parseSpots('rien'), []);
});

test('CMJN : un aplat de ton direct prend sa valeur CMJN, le reste la conversion générique', () => {
  const lookup = spotLookup([{ ...red, rgb: '#C00000' }]);
  const px = new Uint8ClampedArray([0xc0, 0, 0, 255, 0xc0, 0, 1, 255, 0xc0, 0, 0, 128]);
  const generic = rgbaToCmyk(px);
  const withSpot = rgbaToCmyk(px, lookup);
  assert.deepEqual([...withSpot.slice(0, 4)], [0, 255, 255, 51], 'ton direct exact');
  assert.notDeepEqual([...generic.slice(0, 4)], [...withSpot.slice(0, 4)]);
  assert.deepEqual([...withSpot.slice(4, 8)], [...generic.slice(4, 8)], 'couleur voisine : conversion générique');
  assert.deepEqual([...withSpot.slice(8, 12)], [...generic.slice(8, 12)], 'pixel translucide : conversion générique');
});

test('tons directs utilisés et aller-retour de publication.json', () => {
  const deck = createPublication({ width: 595, height: 842 }, 1);
  addShape(deck.slides[0]!.shapes, [10, 10, 50, 50], solid({ type: 'rgb', value: 'C00000' }));
  const spots = parseSpots([red, { name: 'Bleu', rgb: '#0000FF', cmyk: [100, 100, 0, 0] }]);
  assert.deepEqual(usedSpots(deck, spots).map((x) => x.name), ['Rouge maison']);
  assert.deepEqual(parseSettings(serializeSettings(defaultSettings('blank', { spots }))).spots, spots);
  assert.deepEqual(parseSettings('{"spots": 7}').spots, []);
});
