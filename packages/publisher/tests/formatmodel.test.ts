import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Color } from '@forgeoffice/pptx';
import { fillForm, fillOf, lineForm, lineOf, transparencyOf, withTransparency } from '../src/formatmodel.ts';

const rgb = (hex: string): Color => ({ type: 'rgb', value: hex.replace('#', '').toUpperCase() });
const hex = (c: Color): string => `#${c.value}`;

test('transparence : alpha <-> pourcentage, sans toucher aux autres modifications', () => {
  const red = rgb('#FF0000');
  assert.equal(transparencyOf(red), 0);
  const half = withTransparency({ ...red, mods: [{ name: 'lumMod', val: 50000 }] } as Color, 40);
  assert.equal(transparencyOf(half), 40);
  assert.deepEqual(half.mods, [{ name: 'lumMod', val: 50000 }, { name: 'alpha', val: 60000 }]);
  assert.equal(withTransparency(half, 0).mods?.some((m) => m.name === 'alpha'), false);
  assert.equal(withTransparency(red, 0).mods, undefined);
});

test('remplissage : rien n est ecrit sans changement ; degrade conserve', () => {
  const solid = fillForm({ type: 'solid', color: rgb('#112233') }, hex, '#000000');
  assert.equal(fillOf(solid, solid, rgb), null);
  assert.deepEqual(fillOf({ ...solid, transparency: 25 }, solid, rgb), { type: 'solid', color: { type: 'rgb', value: '112233', mods: [{ name: 'alpha', val: 75000 }] } });
  assert.deepEqual(fillOf({ ...solid, mode: 'none' }, solid, rgb), { type: 'none' });
  const keep = fillForm({ type: 'gradient', kind: 'linear', stops: [] }, hex, '#000000');
  assert.equal(keep.mode, 'keep');
  assert.equal(fillOf(keep, keep, rgb), null);
});

test('trait : aucun, couleur, epaisseur et tirets', () => {
  const none = lineForm(undefined, hex, '#333333');
  assert.equal(none.mode, 'none');
  assert.equal(lineOf(none, none, rgb), null);
  const next = { ...none, mode: 'solid' as const, width: 3, dash: 'dash' };
  assert.deepEqual(lineOf(next, none, rgb), { fill: { type: 'solid', color: { type: 'rgb', value: '333333' } }, width: 3, dash: 'dash' });
  const solid = lineForm({ fill: { type: 'solid', color: rgb('#FF0000') }, width: 2, dash: 'bizarre' }, hex, '#000000');
  assert.deepEqual(solid, { mode: 'solid', color: '#FF0000', width: 2, dash: 'solid' });
  assert.deepEqual(lineOf({ ...solid, mode: 'none' }, solid, rgb), { fill: { type: 'none' } });
  assert.equal(lineOf({ ...solid, width: 0 }, solid, rgb)?.width, 0.25);
});

test('effets d image : valeurs neutres retirées, duotone conservé, rien sans changement', async () => {
  const { imageEffectsOf, imageForm } = await import('../src/formatmodel.ts');
  const none = imageForm(undefined);
  assert.equal(imageEffectsOf(none, none, undefined), null);
  assert.deepEqual(imageEffectsOf({ ...none, brightness: 20, transparency: 30, grayscale: true }, none, undefined), { alpha: 70, grayscale: true, brightness: 20 });
  const duo = { duotone: [rgb('#000000'), rgb('#FFFFFF')] as [Color, Color], brightness: 10 };
  const initial = imageForm(duo);
  assert.equal(initial.brightness, 10);
  assert.deepEqual(imageEffectsOf({ ...initial, brightness: 0 }, initial, duo), { duotone: duo.duotone });
  assert.equal(imageEffectsOf({ ...imageForm({ brightness: 5 }), brightness: 0 }, imageForm({ brightness: 5 }), { brightness: 5 }), undefined);
  assert.equal(imageEffectsOf({ ...none, brightness: 500, contrast: -500 }, none, undefined)?.brightness, 100);
  assert.deepEqual(imageForm({ alpha: 40 }), { brightness: 0, contrast: 0, grayscale: false, transparency: 60 });
});

test('alignedOnPage : centre, bords et marge', async () => {
  const { alignedOnPage } = await import('../src/formatmodel.ts');
  assert.equal(alignedOnPage(21, 5, 'center'), 8);
  assert.equal(alignedOnPage(21, 5, 'start', 1.5), 1.5);
  assert.equal(alignedOnPage(21, 5, 'end', 1.5), 14.5);
  assert.equal(alignedOnPage(21, 5.333, 'center'), 7.83);
  assert.equal(alignedOnPage(10, 12, 'center'), -1);
});

test('dégradé et motif : lecture du remplissage, écriture, conservation des autres types', async () => {
  const { fillForm, fillOf } = await import('../src/formatmodel.ts');
  const grad = fillForm({ type: 'gradient', kind: 'linear', angle: 45, stops: [{ position: 0, color: rgb('#112233') }, { position: 100, color: rgb('#AABBCC') }] }, hex, '#000000');
  assert.deepEqual([grad.mode, grad.color, grad.color2, grad.angle], ['gradient', '#112233', '#AABBCC', 45]);
  assert.equal(fillOf(grad, grad, rgb), null);
  const out = fillOf({ ...grad, angle: -90, transparency: 20 }, grad, rgb);
  assert.deepEqual(out, { type: 'gradient', kind: 'linear', angle: 270, stops: [{ position: 0, color: { type: 'rgb', value: '112233', mods: [{ name: 'alpha', val: 80000 }] } }, { position: 100, color: { type: 'rgb', value: 'AABBCC', mods: [{ name: 'alpha', val: 80000 }] } }] });
  const pat = fillForm({ type: 'pattern', preset: 'horz', foreground: rgb('#FF0000'), background: rgb('#FFFFFF') }, hex, '#000000');
  assert.deepEqual([pat.mode, pat.pattern, pat.color, pat.color2], ['pattern', 'horz', '#FF0000', '#FFFFFF']);
  assert.deepEqual(fillOf({ ...pat, pattern: 'diagCross' }, pat, rgb), { type: 'pattern', preset: 'diagCross', foreground: { type: 'rgb', value: 'FF0000' }, background: { type: 'rgb', value: 'FFFFFF' } });
  assert.equal((fillOf({ ...pat, pattern: 'inconnu' }, pat, rgb) as { preset: string }).preset, 'pct50');
  assert.equal(fillForm({ type: 'gradient', kind: 'circle', stops: [] }, hex, '#000000').mode, 'keep');
  assert.equal(fillForm({ type: 'image', mediaId: 'm', mode: 'stretch' }, hex, '#000000').mode, 'keep');
  const solid = fillForm({ type: 'solid', color: rgb('#FF0000') }, hex, '#000000');
  assert.equal((fillOf({ ...solid, mode: 'gradient' }, solid, rgb) as { type: string }).type, 'gradient');
});
