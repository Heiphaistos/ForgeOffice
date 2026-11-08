// Jeux de raccourcis (francais / anglais) et commande Repeter, sans DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Command } from 'prosemirror-state';
import { layerKeysets, type Keyset } from '../src/keymap/keysets.ts';
import { recordRepeatable } from '../src/keymap/repeat.ts';

const call = (c: Command | undefined): boolean => c?.({} as never, () => undefined, undefined) ?? false;

test('le jeu actif est lu a chaque frappe, une touche retiree devient libre', () => {
  const log: string[] = [];
  const mk = (n: string): Command => () => { log.push(n); return true; };
  let ks: Keyset = 'fr';
  const out = layerKeysets({ a: mk('base-a'), b: mk('base-b'), c: mk('base-c') }, { fr: { a: mk('fr-a'), b: null, d: mk('fr-d') } }, () => ks);
  assert.ok(call(out.a)); assert.equal(call(out.b), false); assert.ok(call(out.c)); assert.ok(call(out.d));
  ks = 'en';
  assert.ok(call(out.a)); assert.ok(call(out.b)); assert.equal(call(out.d), false);
  assert.deepEqual(log, ['fr-a', 'base-c', 'fr-d', 'base-a', 'base-b']);
});

test('Repeter rejoue la derniere commande aboutie', () => {
  const log: string[] = [];
  const b: Record<string, Command> = { x: () => { log.push('x'); return true; }, y: () => { log.push('y'); return false; } };
  const rep = recordRepeatable(b, ['x', 'y']);
  assert.equal(call(rep), false);
  call(b.x); call(b.y);
  assert.ok(call(rep));
  assert.deepEqual(log, ['x', 'y', 'x']);
});

test('Alt+Maj+gauche/droite : niveaux de titre', async () => {
  const { shiftedStyle, headingLevel } = await import('../src/keymap/outline.ts');
  assert.equal(headingLevel('Heading3'), 3);
  assert.equal(headingLevel('Normal'), 0);
  assert.equal(shiftedStyle('Heading2', -1), 'Heading1');
  assert.equal(shiftedStyle('Heading1', -1), 'Normal');
  assert.equal(shiftedStyle('Heading1', 1), 'Heading2');
  assert.equal(shiftedStyle('Heading9', 1), null);
  assert.equal(shiftedStyle(null, 1), null);
});
