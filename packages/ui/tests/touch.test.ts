import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceMode, ribbonLayoutFor, isLongPress, swipeDirection, handleHitBox, pickHandle, rotationAngle, gridIntent, keyboardInset, scrollDeltaToReveal, foldToolbar, pinchGeometry } from '../src/logic/touch.ts';

test('detection du mode : telephone, tablette, bureau, paysage', () => {
  assert.deepEqual(deviceMode(390, 844, true), { form: 'phone', landscape: false, landscapePhone: false });
  assert.equal(deviceMode(844, 390, true).landscapePhone, true);
  assert.equal(deviceMode(820, 1180, true).form, 'tablet');
  assert.equal(deviceMode(1180, 820, true).form, 'tablet');
  assert.equal(deviceMode(1440, 900, false).form, 'desktop');
  assert.equal(deviceMode(600, 900, false).form, 'phone'); // fenetre etroite sans tactile
});

test('ruban complet seulement en tablette paysage ou sur bureau', () => {
  assert.equal(ribbonLayoutFor(deviceMode(390, 844, true), 390), 'simplified');
  assert.equal(ribbonLayoutFor(deviceMode(820, 1180, true), 820), 'simplified');
  assert.equal(ribbonLayoutFor(deviceMode(1180, 820, true), 1180), 'classic');
  assert.equal(ribbonLayoutFor(deviceMode(1440, 900, false), 1440), 'classic');
});

test('appui long : delai et tolerance de mouvement', () => {
  assert.equal(isLongPress(520, 3), true);
  assert.equal(isLongPress(300, 0), false);
  assert.equal(isLongPress(900, 25), false);
});

test('balayage : direction nette, rapide, assez longue', () => {
  assert.equal(swipeDirection(-120, 10, 200), 'left');
  assert.equal(swipeDirection(120, -20, 200), 'right');
  assert.equal(swipeDirection(5, -90, 200), 'up');
  assert.equal(swipeDirection(-120, 100, 200), null); // diagonale
  assert.equal(swipeDirection(-20, 0, 100), null); // trop court
  assert.equal(swipeDirection(-200, 0, 1500), null); // trop lent
});

test('poignees : zone de toucher de 44 px minimum, la plus proche gagne', () => {
  assert.deepEqual(handleHitBox(100, 100, 8), { x: 78, y: 78, w: 44, h: 44 });
  assert.equal(handleHitBox(100, 100, 60).w, 60);
  const hs = [{ id: 'a', x: 100, y: 100 }, { id: 'b', x: 120, y: 100 }];
  assert.equal(pickHandle(hs, 118, 100, 8)?.id, 'b');
  assert.equal(pickHandle(hs, 101, 100, 8)?.id, 'a');
  assert.equal(pickHandle(hs, 300, 300, 8), null);
});

test('rotation : angle depuis le haut, avec aimantation', () => {
  assert.equal(rotationAngle(0, 0, 0, -10), 0);
  assert.equal(rotationAngle(0, 0, 10, 0), 90);
  assert.equal(rotationAngle(0, 0, 0, 10), 180);
  assert.equal(rotationAngle(0, 0, -10, 0), 270);
  assert.equal(rotationAngle(0, 0, 10, -9, 15), 45);
});

test('bascule selection/defilement de la grille', () => {
  assert.equal(gridIntent('mouse', 'scroll', false), 'select');
  assert.equal(gridIntent('pen', 'scroll', false), 'select');
  assert.equal(gridIntent('touch', 'scroll', false), 'scroll');
  assert.equal(gridIntent('touch', 'scroll', true), 'select');
  assert.equal(gridIntent('touch', 'select', false), 'select');
});

test('clavier virtuel : hauteur masquee et defilement pour rester visible', () => {
  assert.equal(keyboardInset(844, 520, 0), 324);
  assert.equal(keyboardInset(844, 800, 0), 0); // barre d adresse seulement
  assert.equal(scrollDeltaToReveal(400, 460, 0, 500), 0);
  assert.equal(scrollDeltaToReveal(600, 640, 0, 500), 152);
  assert.equal(scrollDeltaToReveal(-50, -10, 0, 500), -62);
});

test('repli de la barre d outils au-dessus du clavier', () => {
  assert.deepEqual(foldToolbar([44, 44, 44], 200), { visible: 3, overflow: 0 });
  assert.deepEqual(foldToolbar([44, 44, 44, 44, 44], 200), { visible: 3, overflow: 2 }); // 44 (plus) + 3*44 = 176
  assert.deepEqual(foldToolbar([44, 44], 30), { visible: 0, overflow: 2 });
});

test('geometrie du pincement', () => {
  assert.deepEqual(pinchGeometry({ x: 0, y: 0 }, { x: 30, y: 40 }), { dist: 50, mx: 15, my: 20 });
});

import { miniToolbarPosition } from '../src/logic/touch.ts';
test('miniToolbarPosition : sous la selection, retournee en haut si pas de place, bornee', () => {
  const size = { width: 200, height: 48 };
  const vis = { width: 390, top: 0, bottom: 600 };
  assert.deepEqual(miniToolbarPosition({ left: 100, right: 160, top: 100, bottom: 120 }, size, vis), { left: 30, top: 150 });
  assert.equal(miniToolbarPosition({ left: 100, right: 160, top: 500, bottom: 520 }, size, vis).top, 422);
  assert.equal(miniToolbarPosition({ left: 0, right: 20, top: 100, bottom: 120 }, size, vis).left, 8);
  assert.equal(miniToolbarPosition({ left: 380, right: 390, top: 100, bottom: 120 }, size, vis).left, 182);
  assert.equal(miniToolbarPosition({ left: 100, right: 160, top: 20, bottom: 580 }, size, vis).top, 544 - 0);
});
