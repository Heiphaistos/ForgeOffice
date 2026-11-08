import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitContain, whiteToTransparent } from '../src/signimage.ts';

test('cadrage centré avec marge', () => {
  assert.deepEqual(fitContain(1200, 400, 600, 200, 10), { x: 30, y: 10, w: 540, h: 180 });
  const tall = fitContain(100, 400, 600, 200, 10);
  assert.equal(tall.h, 180);
  assert.equal(tall.x, Math.round((600 - tall.w) / 2));
  const tiny = fitContain(10, 10, 600, 200, 10);
  assert.equal(tiny.w, 20, 'jamais agrandie au-delà de 2x');
});

test('fond blanc transparent, encre conservée', () => {
  const px = new Uint8ClampedArray([255, 255, 255, 255, 250, 250, 250, 255, 20, 20, 90, 255, 200, 200, 200, 255]);
  const ink = whiteToTransparent(px);
  assert.equal(px[3], 0, 'blanc pur');
  assert.equal(px[7], 0, 'presque blanc');
  assert.equal(px[11], 255, 'encre bleue');
  assert.ok((px[15] ?? 0) > 0 && (px[15] ?? 0) < 255, 'gris clair : semi-transparent');
  assert.equal(ink, 2, 'encre bleue et gris foncé');
});
