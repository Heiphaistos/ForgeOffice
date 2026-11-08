import { test } from 'node:test';
import assert from 'node:assert/strict';
import { booleanOp, regionArea, ringArea, type Pt, type Ring } from '../src/canvas/boolean-ops/clip.ts';

const rect = (x0: number, y0: number, x1: number, y1: number): Ring => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const circle = (cx: number, cy: number, r: number, n = 64): Ring => Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((2 * Math.PI * i) / n), y: cy + r * Math.sin((2 * Math.PI * i) / n) }));
const area = (rings: Ring[]): number => Math.round(regionArea(rings) * 100) / 100;

test('deux carres qui se recouvrent', () => {
  const a = [rect(0, 0, 10, 10)];
  const b = [rect(5, 5, 15, 15)];
  assert.equal(area(booleanOp(a, b, 'union')), 175);
  assert.equal(area(booleanOp(a, b, 'intersect')), 25);
  assert.equal(area(booleanOp(a, b, 'subtract')), 75);
  assert.equal(area(booleanOp(a, b, 'combine')), 150);
});

test('carre troue : soustraire un carre interieur donne un trou', () => {
  const r = booleanOp([rect(0, 0, 10, 10)], [rect(3, 3, 7, 7)], 'subtract');
  assert.equal(r.length, 2);
  assert.equal(area(r), 84);
});

test('formes disjointes : union = deux contours, intersection vide', () => {
  const a = [rect(0, 0, 4, 4)];
  const b = [rect(10, 10, 14, 14)];
  assert.equal(booleanOp(a, b, 'union').length, 2);
  assert.equal(booleanOp(a, b, 'intersect').length, 0);
  assert.equal(area(booleanOp(a, b, 'subtract')), 16);
});

test('aretes confondues : carres adjacents et moities superposees', () => {
  assert.equal(area(booleanOp([rect(0, 0, 10, 10)], [rect(10, 0, 20, 10)], 'union')), 200);
  assert.equal(booleanOp([rect(0, 0, 10, 10)], [rect(10, 0, 20, 10)], 'intersect').length, 0);
  const a = [rect(0, 0, 10, 10)];
  const b = [rect(0, 0, 5, 10)];
  assert.equal(area(booleanOp(a, b, 'union')), 100);
  assert.equal(area(booleanOp(a, b, 'intersect')), 50);
  assert.equal(area(booleanOp(a, b, 'subtract')), 50);
});

test('cercles : l aire de l union et de l intersection suit la formule', () => {
  const a = [circle(0, 0, 10, 180)];
  const b = [circle(10, 0, 10, 180)];
  const lens = 2 * 100 * Math.acos(0.5) - 0.5 * 10 * Math.sqrt(4 * 100 - 100);
  const inter = regionArea(booleanOp(a, b, 'intersect'));
  const circleArea = regionArea(a);
  assert.ok(Math.abs(inter - lens) / lens < 0.01, `${inter} vs ${lens}`);
  assert.ok(Math.abs(regionArea(booleanOp(a, b, 'union')) - (2 * circleArea - inter)) < 0.5);
  assert.ok(Math.abs(regionArea(booleanOp(a, b, 'subtract')) - (circleArea - inter)) < 0.5);
});

test('resultat : contours exterieurs et trous orientes pour le remplissage', () => {
  const r = booleanOp([rect(0, 0, 10, 10)], [rect(3, 3, 7, 7)], 'subtract');
  const signed = r.map((ring) => ringArea(ring));
  assert.ok(signed.some((v) => v > 0) && signed.some((v) => v < 0));
  const p: Pt = r[0]?.[0] ?? { x: 0, y: 0 };
  assert.ok(Number.isFinite(p.x));
});
