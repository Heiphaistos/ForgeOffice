import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hslToRgb, hsvToRgb, parseHex, rgbToHsl, rgbToHsv, toHex } from '../src/app/color-model.ts';

test('couleurs de reference : TSV et TSL', () => {
  assert.deepEqual(rgbToHsv({ r: 255, g: 0, b: 0 }), { h: 0, s: 100, v: 100 });
  assert.deepEqual(rgbToHsv({ r: 0, g: 128, b: 255 }), { h: 209.9, s: 100, v: 100 });
  assert.deepEqual(rgbToHsl({ r: 255, g: 0, b: 0 }), { h: 0, s: 100, l: 50 });
  assert.deepEqual(rgbToHsl({ r: 128, g: 128, b: 128 }), { h: 0, s: 0, l: 50.2 });
  assert.deepEqual(hslToRgb({ h: 120, s: 100, l: 25 }), { r: 0, g: 128, b: 0 });
  assert.deepEqual(hsvToRgb({ h: 240, s: 100, v: 100 }), { r: 0, g: 0, b: 255 });
});

test('aller-retour RVB -> TSL -> RVB sur une grille de couleurs', () => {
  for (const r of [0, 37, 128, 200, 255]) for (const g of [0, 90, 255]) for (const b of [0, 17, 250]) {
    const back = hslToRgb(rgbToHsl({ r, g, b }));
    assert.ok(Math.abs(back.r - r) <= 1 && Math.abs(back.g - g) <= 1 && Math.abs(back.b - b) <= 1, JSON.stringify({ r, g, b, back }));
    const v = hsvToRgb(rgbToHsv({ r, g, b }));
    assert.ok(Math.abs(v.r - r) <= 1 && Math.abs(v.g - g) <= 1 && Math.abs(v.b - b) <= 1);
  }
});

test('notation hexadecimale : courte, longue, invalide', () => {
  assert.deepEqual(parseHex('#0af'), { r: 0, g: 170, b: 255 });
  assert.deepEqual(parseHex('c43e1c'), { r: 196, g: 62, b: 28 });
  assert.equal(parseHex('#12345'), null);
  assert.equal(parseHex('zzzzzz'), null);
  assert.equal(toHex({ r: 196, g: 62, b: 28 }), '#C43E1C');
  assert.equal(toHex({ r: 300, g: -4, b: 1.4 }), '#FF0001');
});
