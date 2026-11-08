import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addStop, defaultGradient, fillKind, linePatch, removeStop, toggleEffect, transparencyOf, updateStop, withTransparency } from '../src/app/format-pane/format-model.ts';

const red = { type: 'rgb' as const, value: 'FF0000' };

test('transparence : alpha ajoute, relu, retire', () => {
  const c = withTransparency(red, 40);
  assert.deepEqual(c.mods, [{ name: 'alpha', val: 60000 }]);
  assert.equal(transparencyOf(c), 40);
  assert.equal(withTransparency(c, 0).mods, undefined);
  assert.equal(withTransparency({ ...red, mods: [{ name: 'lumMod', val: 50000 }] }, 20).mods?.length, 2);
});

test('degrade : arrets ajoutes au milieu, jamais moins de deux, positions bornees', () => {
  const g = defaultGradient(red);
  const g3 = addStop(g);
  assert.deepEqual(g3.stops.map((s) => s.position), [0, 50, 100]);
  assert.equal(removeStop(g, 0).stops.length, 2);
  assert.deepEqual(removeStop(g3, 1).stops.map((s) => s.position), [0, 100]);
  assert.equal(updateStop(g3, 1, { position: 150 }).stops[1]?.position, 100);
});

test('trait : continu retire les tirets, fleche aucune retire le bout', () => {
  assert.deepEqual(linePatch({ dash: 'solid', head: { type: 'none' }, tail: { type: 'triangle', width: 'lg' } }), { dash: undefined, head: undefined, tail: { type: 'triangle', width: 'lg' } });
  assert.equal(fillKind({ type: 'group' }), 'none');
});

test('effets : activer et retirer sans toucher aux autres', () => {
  const e = toggleEffect({ glow: { color: red, radius: 3 } }, 'outerShadow', true, red);
  assert.ok(e.outerShadow && e.glow);
  const e2 = toggleEffect(e, 'glow', false, red);
  assert.equal(e2.glow, undefined);
  assert.ok(e2.outerShadow);
  assert.equal(toggleEffect(undefined, 'softEdge', true, red).softEdge, 5);
  assert.equal(toggleEffect(undefined, 'reflection', true, red).reflection?.scaleY, -100);
});
