import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageRect } from '../src/app/image-rect.ts';

test('union de deux boites avec marge', () => {
  const r = imageRect([{ x: 10, y: 10, width: 20, height: 10 }, { x: 50, y: 40, width: 10, height: 10 }], 2);
  assert.deepEqual(r, { x: 8, y: 8, width: 54, height: 44 });
});

test('boite tournee de 90 degres : l encombrement est echange', () => {
  const r = imageRect([{ x: 0, y: 0, width: 100, height: 20, rotation: 90 }], 0);
  assert.ok(r && Math.abs(r.width - 20) < 1e-6 && Math.abs(r.height - 100) < 1e-6);
});

test('aucune boite : rien a exporter', () => {
  assert.equal(imageRect([], 2), null);
});
