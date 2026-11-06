import test from 'node:test';
import assert from 'node:assert/strict';
import { rgbaToCmyk } from '../src/cmyk.ts';

test('CMJN : blanc, noir, rouge, transparent', () => {
  const px = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255, 10, 20, 30, 0]);
  const c = rgbaToCmyk(px);
  assert.deepEqual([...c.slice(0, 4)], [0, 0, 0, 0]); // blanc : aucune encre
  assert.deepEqual([...c.slice(4, 8)], [0, 0, 0, 255]); // noir : K plein
  assert.deepEqual([...c.slice(8, 12)], [0, 255, 255, 0]); // rouge : magenta + jaune
  assert.deepEqual([...c.slice(12, 16)], [0, 0, 0, 0]); // transparent : papier
});
