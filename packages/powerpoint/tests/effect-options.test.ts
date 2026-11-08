import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Animation } from '@forgeoffice/pptx';
import { applyEffectPatch, effectForm, effectPatch, pasteAnimations } from '../src/app/effect-model.ts';
import { EFFECTS, TRANSITIONS } from '../src/app/motion-catalog.ts';

const anim = (over: Partial<Animation> = {}): Animation => ({ shapeId: 5, class: 'entr', presetId: 2, presetSubtype: 4, trigger: 'onClick', delay: 0, duration: 500, ...over });

test('formulaire depuis une animation : repetition, retour arriere, declencheur', () => {
  const f = effectForm(anim({ repeat: 3, autoReverse: true, triggerShapeId: 9, delay: 250 }));
  assert.deepEqual([f.repeat, f.autoReverse, f.triggerShapeId, f.delay], ['3', true, 9, 0.25]);
  assert.equal(effectForm(anim({ repeat: 'indefinite' })).repeat, 'indefinite');
  assert.equal(effectForm(anim()).repeat, 'none');
});

test('patch minimal : seuls les champs modifies, retraits par undefined', () => {
  const a = anim({ repeat: 2, autoReverse: true });
  const initial = effectForm(a);
  const patch = effectPatch({ ...initial, repeat: 'none', autoReverse: false, duration: 1.5, direction: 8 }, initial);
  assert.deepEqual(Object.keys(patch).sort(), ['autoReverse', 'duration', 'presetSubtype', 'repeat']);
  const out = applyEffectPatch(a, patch);
  assert.equal(out.duration, 1500);
  assert.equal(out.presetSubtype, 8);
  assert.ok(!('repeat' in out) && !('autoReverse' in out));
  assert.equal(applyEffectPatch(a, effectPatch({ ...initial, repeat: 'indefinite' }, initial)).repeat, 'indefinite');
});

test('reproduire l animation : remplace celles des formes visees, copie pour chaque forme', () => {
  const list = [anim({ shapeId: 1 }), anim({ shapeId: 2, presetId: 10 }), anim({ shapeId: 3, class: 'exit' })];
  const out = pasteAnimations(list, new Set([2, 3]), [anim({ shapeId: 1, triggerShapeId: 4 })]);
  assert.deepEqual(out.map((a) => [a.shapeId, a.class, a.presetId]), [[1, 'entr', 2], [2, 'entr', 2], [3, 'entr', 2]]);
  assert.ok(out.every((a) => a.triggerShapeId === undefined));
});

test('catalogues : identifiants uniques, classes et transitions completes', () => {
  assert.equal(new Set(EFFECTS.map((e) => e.id)).size, EFFECTS.length);
  assert.ok(EFFECTS.filter((e) => e.cls === 'entr').length >= 16 && EFFECTS.filter((e) => e.cls === 'exit').length >= 16 && EFFECTS.filter((e) => e.cls === 'path').length >= 9);
  assert.equal(new Set(TRANSITIONS.map((t) => t.id)).size, TRANSITIONS.length);
  assert.ok(TRANSITIONS.length >= 34);
});

test('par paragraphe : decoupage, regroupement et formes entieres masquees seulement sans plage', async () => {
  const { splitByParagraph, mergeParagraphs, isByParagraph } = await import('../src/app/effect-model.ts');
  const { initiallyHidden } = await import('../src/app/playback.ts');
  const base = { shapeId: 5, class: 'entr' as const, presetId: 10, trigger: 'afterPrevious' as const, delay: 250, duration: 500 };
  const other = { ...base, shapeId: 9, trigger: 'onClick' as const, delay: 0 };
  const split = splitByParagraph([other, base], 5, 3);
  assert.equal(split.length, 4);
  assert.deepEqual(split.slice(1).map((a) => [a.paragraphs?.start, a.paragraphs?.end, a.trigger, a.delay]), [[0, 0, 'afterPrevious', 250], [1, 1, 'onClick', 0], [2, 2, 'onClick', 0]]);
  assert.ok(isByParagraph(split, 5));
  assert.ok(!isByParagraph(split, 9));
  const back = mergeParagraphs(split, 5);
  assert.deepEqual(back, [other, base]);
  assert.deepEqual([...initiallyHidden({ animations: split } as never)], [9]);
  assert.deepEqual([...initiallyHidden({ animations: back } as never)].sort(), [5, 9]);
});
