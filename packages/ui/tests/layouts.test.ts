import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Settings } from '@forgeoffice/core';
import { LAYOUT_FAMILY, LAYOUT_IDS, resolveLayout, savedGlobalLayout, savedOpenMode, setGlobalLayout, setModuleLayout } from '../src/logic/layouts.ts';

function memory(initial: Record<string, unknown> = {}): Settings {
  const map = new Map(Object.entries(initial));
  return { get: <T>(k: string, f: T): T => (map.has(k) ? (map.get(k) as T) : f), set: (k, v) => void map.set(k, v) };
}

test('chaque disposition a une famille', () => {
  for (const id of LAYOUT_IDS) assert.ok(LAYOUT_FAMILY[id], id);
});

test('defaut Office, ancien ruban simplifie repris, valeur inconnue ignoree', () => {
  assert.equal(savedGlobalLayout(memory()), 'office');
  assert.equal(savedGlobalLayout(memory({ 'ui.ribbon.layout': 'simplified' })), 'office-simplified');
  assert.equal(savedGlobalLayout(memory({ 'ui.layout': 'onlyoffice', 'ui.ribbon.layout': 'simplified' })), 'onlyoffice');
  assert.equal(savedGlobalLayout(memory({ 'ui.layout': '<script>' })), 'office');
  assert.equal(savedGlobalLayout(null), 'office');
});

test('le module suit le global sauf choix propre', () => {
  const s = memory();
  setGlobalLayout(s, 'libreoffice');
  assert.equal(resolveLayout(s, 'excel'), 'libreoffice');
  setModuleLayout(s, 'word', 'onlyoffice');
  assert.equal(resolveLayout(s, 'word'), 'onlyoffice');
  assert.equal(resolveLayout(s, 'excel'), 'libreoffice');
  setModuleLayout(s, 'word', null);
  assert.equal(resolveLayout(s, 'word'), 'libreoffice');
});

test('mode d ouverture : fenetre par defaut', () => {
  assert.equal(savedOpenMode(memory()), 'window');
  assert.equal(savedOpenMode(memory({ 'ui.openMode': 'tab' })), 'tab');
  assert.equal(savedOpenMode(memory({ 'ui.openMode': 'tab-shared' })), 'tab-shared');
  assert.equal(savedOpenMode(memory({ 'ui.openMode': 'autre' })), 'window');
});
