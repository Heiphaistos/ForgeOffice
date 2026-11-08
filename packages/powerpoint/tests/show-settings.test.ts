import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Slide } from '@forgeoffice/pptx';
import { DEFAULT_SHOW, effectiveShow, fromShowProps, showOrderFor, toShowProps } from '../src/app/show-settings.ts';

const slides = (hidden: number[] = [], n = 6): Slide[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, hidden: hidden.includes(i) || undefined }) as unknown as Slide);

test('plage de diapositives : bornes incluses, masquees exclues', () => {
  assert.deepEqual(showOrderFor(slides(), DEFAULT_SHOW), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(showOrderFor(slides([2]), { ...DEFAULT_SHOW, from: 2, to: 5 }), [1, 3, 4]);
  assert.deepEqual(showOrderFor(slides(), { ...DEFAULT_SHOW, from: 4, to: 0 }), [3, 4, 5]);
  assert.deepEqual(showOrderFor(slides(), { ...DEFAULT_SHOW, from: 9, to: 12 }), [0, 1, 2, 3, 4, 5]);
});

test('kiosque : boucle et minutages imposes', () => {
  const k = effectiveShow({ ...DEFAULT_SHOW, mode: 'kiosk', manual: true });
  assert.deepEqual([k.loop, k.manual], [true, false]);
  assert.equal(effectiveShow(DEFAULT_SHOW), DEFAULT_SHOW);
});

test('parametres du fichier : conversion dans les deux sens, defauts non ecrits', () => {
  assert.equal(toShowProps(DEFAULT_SHOW), undefined);
  assert.deepEqual(fromShowProps(undefined), DEFAULT_SHOW);
  const settings = { mode: 'kiosk' as const, loop: true, noAnimation: true, from: 2, to: 5, manual: false };
  assert.deepEqual(toShowProps(settings), { mode: 'kiosk', loop: true, noAnimation: true, from: 2, to: 5 });
  assert.deepEqual(fromShowProps(toShowProps(settings)), settings);
  assert.deepEqual(fromShowProps({ mode: 'browse', manual: true }), { ...DEFAULT_SHOW, manual: true });
});
