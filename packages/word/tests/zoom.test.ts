import test from 'node:test';
import assert from 'node:assert/strict';
import { fitZoom } from '../src/view/zoom.ts';

test('zoom : largeur de page et pleine page', () => {
  const page = { width: 794, height: 1123 };
  assert.equal(fitZoom('width', { width: 1048, height: 700 }, page), Math.round((1000 / 794) * 100));
  // La hauteur limite en pleine page.
  assert.equal(fitZoom('page', { width: 1048, height: 700 }, page), Math.round((668 / 1123) * 100));
  assert.equal(fitZoom('page', { width: 50, height: 50 }, page), 10);
});
