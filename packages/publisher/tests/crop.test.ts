import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Picture } from '@forgeoffice/pptx';
import { applyCrop, cropOf, frameForRatio, fullRect, moveFrame, moveImage, resizeFrame, toPageXfrm, zoomImage, type Rect } from '../src/crop.ts';

const close = (a: number, b: number, eps = 1e-6): void => assert.ok(Math.abs(a - b) < eps, `${a} ~ ${b}`);
const inside = (inner: Rect, outer: Rect): boolean => inner.x >= outer.x - 1e-6 && inner.y >= outer.y - 1e-6 && inner.x + inner.width <= outer.x + outer.width + 1e-6 && inner.y + inner.height <= outer.y + outer.height + 1e-6;

const FRAME: Rect = { x: 100, y: 50, width: 200, height: 100 };

test('rognage : l image entiere se deduit du cadre et du rognage, et inversement', () => {
  const full = fullRect(FRAME, { left: 10, top: 20, right: 30, bottom: 0 });
  // Cadre = 60 % de la largeur et 80 % de la hauteur de l'image.
  close(full.width, 200 / 0.6);
  close(full.height, 100 / 0.8);
  close(full.x, 100 - 0.1 * full.width);
  close(full.y, 50 - 0.2 * full.height);
  const back = cropOf(FRAME, full);
  close(back.left, 10, 0.01);
  close(back.top, 20, 0.01);
  close(back.right, 30, 0.01);
  close(back.bottom, 0, 0.01);
  assert.deepEqual(fullRect(FRAME), FRAME, 'sans rognage, image = cadre');
});

test('rognage : deplacer l image derriere le cadre la garde sur tout le cadre', () => {
  const full = fullRect(FRAME, { left: 10, top: 10, right: 10, bottom: 10 });
  const moved = moveImage(FRAME, full, 1000, 1000);
  assert.ok(inside(FRAME, moved), 'le cadre reste couvert');
  close(moved.x, FRAME.x, 1e-6);
  const other = moveImage(FRAME, full, -1000, -1000);
  assert.ok(inside(FRAME, other));
  close(other.x + other.width, FRAME.x + FRAME.width);
  // Sans marge (aucun rognage), l'image ne peut pas bouger.
  assert.deepEqual(moveImage(FRAME, FRAME, 30, 30), FRAME);
  // Deplacer le cadre sur l'image immobile : il reste dans l'image.
  const f = moveFrame(FRAME, full, 1000, -1000);
  assert.ok(inside(f, full));
});

test('rognage : poignees, limites de l image, taille minimale', () => {
  const full: Rect = { x: 0, y: 0, width: 400, height: 300 };
  const frame: Rect = { x: 100, y: 100, width: 200, height: 100 };
  const w = resizeFrame(frame, full, 'w', -40, 0);
  assert.deepEqual(w, { x: 60, y: 100, width: 240, height: 100 });
  const e = resizeFrame(frame, full, 'e', 5000, 0);
  assert.equal(e.x + e.width, 400, 'borne par le bord de l image');
  const nw = resizeFrame(frame, full, 'nw', -5000, -5000);
  assert.equal(nw.x, 0);
  assert.equal(nw.y, 0);
  const tiny = resizeFrame(frame, full, 'e', -5000, 0);
  assert.equal(tiny.width, 12, 'cadre minimal');
  for (const h of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const) assert.ok(inside(resizeFrame(frame, full, h, 777, -777), full), h);
});

test('rognage : proportions verrouillees (arete, coin) et cadre aux proportions voulues', () => {
  const full: Rect = { x: 0, y: 0, width: 400, height: 300 };
  const frame: Rect = { x: 100, y: 100, width: 160, height: 90 };
  const ratio = 16 / 9;
  const grown = resizeFrame(frame, full, 'e', 40, 0, ratio);
  close(grown.width / grown.height, ratio, 1e-6);
  assert.equal(grown.x, 100, 'le bord oppose reste fixe');
  const corner = resizeFrame(frame, full, 'se', 60, 10, ratio);
  close(corner.width / corner.height, ratio, 1e-6);
  const stuck = resizeFrame(frame, full, 'se', 5000, 5000, ratio);
  assert.ok(inside(stuck, full));
  close(stuck.width / stuck.height, ratio, 1e-6);
  const square = frameForRatio(FRAME, fullRect(FRAME, { left: 10, top: 10, right: 10, bottom: 10 }), 1);
  close(square.width, square.height);
  close(square.x + square.width / 2, FRAME.x + FRAME.width / 2);
  assert.equal(square.height, 100, 'le plus grand carre du cadre');
  const wide = frameForRatio(FRAME, fullRect(FRAME), 4);
  close(wide.width / wide.height, 4);
});

test('rognage : zoom de l image autour du centre du cadre, jamais plus petit que le cadre', () => {
  const full = fullRect(FRAME, { left: 10, top: 10, right: 10, bottom: 10 });
  const bigger = zoomImage(FRAME, full, 1.5);
  close(bigger.width, full.width * 1.5);
  assert.ok(inside(FRAME, bigger));
  const smaller = zoomImage(FRAME, full, 0.1);
  assert.ok(inside(FRAME, smaller), 'toujours sur tout le cadre');
  close(smaller.width, FRAME.width, 1e-6);
});

test('rognage : application a l image (position, rognage en %), rotation autour du centre d origine', () => {
  const pic = { kind: 'picture', id: 3, name: 'Image', mediaId: 'm', fillMode: 'stretch', geometry: { type: 'preset', preset: 'rect' }, xfrm: { ...FRAME } } as Picture;
  const full: Rect = { x: 50, y: 0, width: 400, height: 200 };
  applyCrop(pic, FRAME, full, FRAME);
  assert.deepEqual(pic.xfrm, { ...FRAME });
  assert.deepEqual(pic.crop, { left: 12.5, top: 25, right: 37.5, bottom: 25 });
  // Plus de rognage : la propriete disparait.
  applyCrop(pic, FRAME, FRAME, FRAME);
  assert.equal(pic.crop, undefined);
  // Image tournee de 90 degres : un cadre decale de 40 pt « vers la droite » dans le repere de l'image part vers le bas dans la page.
  const shifted: Rect = { ...FRAME, x: FRAME.x + 40 };
  const page = toPageXfrm(shifted, FRAME, 90);
  close(page.x + page.width / 2, FRAME.x + FRAME.width / 2);
  close(page.y + page.height / 2, FRAME.y + FRAME.height / 2 + 40);
  assert.equal(page.width, 200);
});

test('fillFull couvre le cadre sans le deformer ; fitFrame garde les proportions de l image', async () => {
  const { fillFull, fitFrame, cropOf } = await import('../src/crop.ts');
  // image 200 x 100 (ratio 2) rognee dans un cadre carre 100 x 100 : crop gauche/droite 25 %.
  const frame = { x: 10, y: 20, width: 100, height: 100 };
  const crop = { left: 25, top: 0, right: 25, bottom: 0 };
  const full = fillFull(frame, crop);
  assert.ok(Math.abs(full.width / full.height - 2) < 1e-9);
  assert.ok(full.x <= frame.x + 1e-9 && full.y <= frame.y + 1e-9 && full.x + full.width >= frame.x + frame.width - 1e-9 && full.y + full.height >= frame.y + frame.height - 1e-9);
  const back = cropOf(frame, full);
  assert.ok(back.left === 25 && back.right === 25 && back.top === 0 && back.bottom === 0);
  const fit = fitFrame(frame, crop);
  assert.ok(Math.abs(fit.width / fit.height - 2) < 1e-9 && fit.width <= frame.width && Math.abs(fit.x + fit.width / 2 - 60) < 1e-9 && Math.abs(fit.y + fit.height / 2 - 70) < 1e-9);
  // image portrait 100 x 200 dans un cadre large 200 x 100 : remplir = largeur du cadre.
  const wide = { x: 0, y: 0, width: 200, height: 100 };
  const portrait = fillFull(wide, { left: 0, top: 25, right: 0, bottom: 25 });
  assert.ok(Math.abs(portrait.width - 200) < 1e-9 && Math.abs(portrait.height - 200) < 1e-9);
});
