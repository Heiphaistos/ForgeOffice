import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geomForm, geomPatch, normalizeRotation, withHeight, withWidth } from '../src/app/geom-dialog-model.ts';

const xf = { x: 72, y: 36, width: 144, height: 72, rotation: 0 };

test('ratio verrouille : la hauteur suit la largeur', () => {
  const initial = geomForm(xf, true);
  assert.deepEqual([initial.width, initial.height], [5.08, 2.54]);
  const f = withWidth(initial, initial, 10.16);
  assert.equal(f.height, 5.08);
  assert.equal(withHeight(initial, initial, 5.08).width, 10.16);
});

test('ratio libre : l autre cote ne bouge pas', () => {
  const initial = geomForm(xf, false);
  assert.equal(withWidth(initial, initial, 9).height, 2.54);
});

test('patch minimal en points et rotation normalisee', () => {
  const initial = geomForm(xf, false);
  const patch = geomPatch({ ...initial, width: 10.16, x: 5.08, rotation: -90 }, initial);
  assert.deepEqual(patch, { width: 288, x: 144, rotation: 270 });
  assert.deepEqual(geomPatch(initial, initial), {});
  assert.equal(normalizeRotation(725), 5);
});

test('echelle en % : 200 % double la largeur, le rapport verrouille entraine la hauteur', async () => {
  const { scaleOf, withScale } = await import('../src/app/geom-dialog-model.ts');
  const initial = geomForm(xf, true);
  const f = withScale(initial, initial, 'width', 200);
  assert.deepEqual([f.width, f.height], [10.16, 5.08]);
  assert.equal(scaleOf(f, initial, 'height'), 200);
  const free = geomForm(xf, false);
  assert.equal(withScale(free, free, 'height', 50).width, 5.08);
});
