// Revision : navigation precedent/suivant et notes toujours visibles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { allNotesVisible, neighbourTarget, reviewTargets, setNotesVisible } from '../src/logic/review.ts';

const sheet = {
  notes: [{ ref: { row: 5, col: 1 }, author: 'a', text: 'n1' }, { ref: { row: 1, col: 3 }, author: 'a', text: 'n2' }],
  threadedComments: [{ id: 'x', ref: { row: 1, col: 3 }, personId: 'p', text: 'c', date: '', replies: [] }, { id: 'y', ref: { row: 9, col: 0 }, personId: 'p', text: 'c2', date: '', replies: [] }],
};

test('cibles triees sans doublon', () => {
  assert.deepEqual(reviewTargets(sheet).map((a) => [a.row, a.col]), [[1, 3], [5, 1], [9, 0]]);
});

test('suivant / precedent avec retour', () => {
  const t = reviewTargets(sheet);
  assert.deepEqual(neighbourTarget(t, { row: 0, col: 0 }, 1), { row: 1, col: 3 });
  assert.deepEqual(neighbourTarget(t, { row: 5, col: 1 }, 1), { row: 9, col: 0 });
  assert.deepEqual(neighbourTarget(t, { row: 9, col: 0 }, 1), { row: 1, col: 3 });
  assert.deepEqual(neighbourTarget(t, { row: 1, col: 3 }, -1), { row: 9, col: 0 });
  assert.equal(neighbourTarget([], { row: 0, col: 0 }, 1), undefined);
});

test('notes visibles', () => {
  assert.equal(allNotesVisible(setNotesVisible(sheet.notes, true)), true);
  assert.equal(allNotesVisible(sheet.notes), false);
});
