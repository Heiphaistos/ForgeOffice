import { test } from 'node:test';
import assert from 'node:assert/strict';
import { printFrame } from '../src/tabs/framePrint.ts';

// Sans page hote (pas dans un cadre), on imprime directement par l'hote : aucun deplacement de DOM.
test('printFrame : hors cadre, appelle simplement l impression hote', () => {
  const doc = { getElementById: () => null, body: { children: [] } };
  (globalThis as { window?: unknown; document?: unknown }).window = { parent: null as unknown, setTimeout };
  (globalThis as { window: { parent: unknown } }).window.parent = { document: doc };
  (globalThis as { document?: unknown }).document = doc;
  let n = 0;
  printFrame(() => n++);
  assert.equal(n, 1);
});
