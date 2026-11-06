import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ImageInline } from '@forgeoffice/docx';
import { alignFromX, nudge, resizeBox, rotationFrom, withAlign, wrapOf, wrapPatch } from '../src/editor/images.ts';

const img: ImageInline = { type: 'image', mediaId: 'm', width: 200, height: 100 };

test('habillage : aller-retour des six modes', () => {
  for (const mode of ['square', 'tight', 'topAndBottom', 'behind', 'front'] as const) {
    const patched = { ...img, ...wrapPatch(img, mode) };
    assert.equal(wrapOf(patched), mode);
  }
  assert.equal(wrapOf({ ...img, ...wrapPatch({ ...img, ...wrapPatch(img, 'square') }, 'inline') }), 'inline');
  const behind = wrapPatch(img, 'behind').floating!;
  assert.equal(behind.wrap, 'none');
  assert.equal(behind.behindText, true);
});

test('habillage : changer de mode garde l alignement et la distance', () => {
  const left = withAlign({ ...img, ...wrapPatch(img, 'square') }, 'right');
  const next = wrapPatch(left, 'topAndBottom').floating!;
  assert.equal(next.horizontal.align, 'right');
  assert.deepEqual(next.distance, left.floating!.distance);
});

test('poignees : coin garde les proportions, cote libre', () => {
  const r = resizeBox('se', { width: 200, height: 100 }, 50, 3);
  assert.equal(r.width, 250);
  assert.equal(r.height, 125);
  const free = resizeBox('se', { width: 200, height: 100 }, 50, 3, true);
  assert.deepEqual(free, { width: 250, height: 103 });
  assert.deepEqual(resizeBox('e', { width: 200, height: 100 }, -50, 99), { width: 150, height: 100 });
  // Poignee nord-ouest : tirer vers le haut gauche agrandit.
  const nw = resizeBox('nw', { width: 200, height: 100 }, -40, -20);
  assert.deepEqual(nw, { width: 240, height: 120 });
  // Jamais sous la taille minimale.
  assert.equal(resizeBox('w', { width: 20, height: 20 }, 500, 0).width, 8);
});

test('deplacement : alignement selon le tiers de la zone de texte', () => {
  assert.equal(alignFromX(110, 100, 600), 'left');
  assert.equal(alignFromX(400, 100, 600), 'center');
  assert.equal(alignFromX(650, 100, 600), 'right');
});

test('fleches : decalage en points sur les images flottantes seulement', () => {
  assert.equal(nudge(img, 1, 0), img);
  const f = { ...img, ...wrapPatch(img, 'square') };
  const moved = nudge(nudge(f, 1, 0), 10, -1);
  assert.equal(moved.floating!.horizontal.offset, 11);
  assert.equal(moved.floating!.vertical.offset, -1);
});

test('rotation : angle depuis le centre, arrondi a 15 degres avec Maj', () => {
  assert.equal(rotationFrom(0, 0, 0, -50, false), 0);
  assert.equal(rotationFrom(0, 0, 50, 0, false), 90);
  assert.equal(rotationFrom(0, 0, 0, 50, false), 180);
  assert.equal(rotationFrom(0, 0, -50, 0, false), 270);
  assert.equal(rotationFrom(0, 0, 50, -40, true) % 15, 0);
});
