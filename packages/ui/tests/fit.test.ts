import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Settings } from '@forgeoffice/core';
import { DARK_PAGES, FIT_MODES, effectiveFit, savedDarkPage, savedFit } from '../src/logic/layouts.ts';
import { MIN_SCALE, scaleFor } from '../src/fitScale.ts';

const memory = (initial: Record<string, unknown> = {}): Settings => {
  const map = new Map(Object.entries(initial));
  return { get: <T>(k: string, f: T): T => (map.has(k) ? (map.get(k) as T) : f), set: (k, v) => void map.set(k, v) };
};

test('adaptation de la fenetre : defaut = auto, valeur inconnue ignoree', () => {
  assert.equal(savedFit(memory()), 'auto');
  assert.equal(savedFit(null), 'auto');
  for (const m of FIT_MODES) assert.equal(savedFit(memory({ 'ui.fit': m })), m);
  assert.equal(savedFit(memory({ 'ui.fit': 'zoom<script>' })), 'auto');
});

test('mode auto : groupes replies sous 1000 px, passage a la ligne au-dessus ; un choix explicite est garde', () => {
  assert.equal(effectiveFit('auto', 480, 'office'), 'fold');
  assert.equal(effectiveFit('auto', 999, 'office'), 'fold');
  assert.equal(effectiveFit('auto', 1000, 'office'), 'wrap');
  assert.equal(effectiveFit('auto', 800, 'libreoffice'), 'wrap'); // barres de menus : pas de groupes a replier
  assert.equal(effectiveFit('wrap', 480, 'office'), 'wrap');
  assert.equal(effectiveFit('scale', 1440, 'office'), 'scale');
});

test('page sombre : defaut blanche, valeur inconnue ignoree', () => {
  assert.equal(savedDarkPage(memory()), 'white');
  for (const m of DARK_PAGES) assert.equal(savedDarkPage(memory({ 'ui.darkPage': m })), m);
  assert.equal(savedDarkPage(memory({ 'ui.darkPage': 'x' })), 'white');
});

test('mise a l echelle : 1 si ca tient, arrondie par defaut sinon, plancher a 60 %', () => {
  assert.equal(scaleFor(500, 800), 1);
  assert.equal(scaleFor(1000, 800), 0.8);
  assert.equal(scaleFor(1000, 799), 0.79);
  assert.equal(scaleFor(2000, 400), MIN_SCALE);
  assert.equal(scaleFor(0, 400), 1);
  assert.equal(scaleFor(500, 0), 1);
});
