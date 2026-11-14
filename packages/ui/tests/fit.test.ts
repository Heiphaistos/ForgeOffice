import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Settings } from '@forgeoffice/core';
import { FIT_MODES, savedFit } from '../src/logic/layouts.ts';
import { MIN_SCALE, scaleFor } from '../src/fitScale.ts';

const memory = (initial: Record<string, unknown> = {}): Settings => {
  const map = new Map(Object.entries(initial));
  return { get: <T>(k: string, f: T): T => (map.has(k) ? (map.get(k) as T) : f), set: (k, v) => void map.set(k, v) };
};

test('adaptation de la fenetre : defaut = passer a la ligne, valeur inconnue ignoree', () => {
  assert.equal(savedFit(memory()), 'wrap');
  assert.equal(savedFit(null), 'wrap');
  for (const m of FIT_MODES) assert.equal(savedFit(memory({ 'ui.fit': m })), m);
  assert.equal(savedFit(memory({ 'ui.fit': 'zoom<script>' })), 'wrap');
});

test('mise a l echelle : 1 si ca tient, arrondie par defaut sinon, plancher a 60 %', () => {
  assert.equal(scaleFor(500, 800), 1);
  assert.equal(scaleFor(1000, 800), 0.8);
  assert.equal(scaleFor(1000, 799), 0.79);
  assert.equal(scaleFor(2000, 400), MIN_SCALE);
  assert.equal(scaleFor(0, 400), 1);
  assert.equal(scaleFor(500, 0), 1);
});
