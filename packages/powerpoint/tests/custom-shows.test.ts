import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Slide } from '@forgeoffice/pptx';
import { addShow, moveItem, pruneShows, removeShow, uniqueName, updateShow } from '../src/app/custom-shows.ts';
import { DEFAULT_SHOW, showOrderFor } from '../src/app/show-settings.ts';

const slides = Array.from({ length: 5 }, (_, i) => ({ id: 10 + i }) as unknown as Slide);

test('creation : nom sans doublon, refus d un diaporama vide, identifiants croissants', () => {
  const a = addShow([], 'Court', [10, 12]);
  const b = addShow(a, 'court', [11]);
  assert.deepEqual(b.map((s) => [s.id, s.name]), [[0, 'Court'], [1, 'court (2)']]);
  assert.equal(addShow(b, 'Vide', []).length, 2);
  assert.equal(uniqueName(b, 'Nouveau'), 'Nouveau');
});

test('modification, ordre, suppression et nettoyage des diapositives supprimees', () => {
  const shows = addShow([], 'Court', [10, 11, 12]);
  assert.deepEqual(moveItem([10, 11, 12], 2, -1), [10, 12, 11]);
  assert.deepEqual(moveItem([10, 11, 12], 0, -1), [10, 11, 12]);
  assert.deepEqual(updateShow(shows, 0, { slideIds: [12, 10, 12] })[0]?.slideIds, [12, 10, 12]);
  assert.deepEqual(pruneShows(shows, new Set([10, 12]))[0]?.slideIds, [10, 12]);
  assert.equal(removeShow(shows, 0).length, 0);
});

test('lecture : le diaporama personnalise impose son ordre et ses repetitions, sinon la plage', () => {
  const shows = [{ id: 3, name: 'X', slideIds: [13, 10, 13, 99] }];
  assert.deepEqual(showOrderFor(slides, { ...DEFAULT_SHOW, customShowId: 3 }, shows), [3, 0, 3]);
  assert.deepEqual(showOrderFor(slides, { ...DEFAULT_SHOW, customShowId: 8 }, shows), [0, 1, 2, 3, 4]);
  assert.deepEqual(showOrderFor(slides, { ...DEFAULT_SHOW, from: 2, to: 3 }, shows), [1, 2]);
});
