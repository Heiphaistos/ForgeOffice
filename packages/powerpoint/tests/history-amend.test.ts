import { test } from 'node:test';
import assert from 'node:assert/strict';
import { History } from '../../core/src/history.ts';

test('un ajustement automatique fusionne dans l etape precedente : Annuler revient a l etat d avant', () => {
  const h = new History<string>('base', { mergeMs: 1000 });
  h.commit('taille 28 (hauteur ancienne)', 'format');
  h.amend('taille 28 (hauteur ajustee)');
  assert.equal(h.state, 'taille 28 (hauteur ajustee)');
  assert.equal(h.undo(), 'base');
  assert.equal(h.canUndo, false);
  assert.equal(h.redo(), 'taille 28 (hauteur ajustee)');
});

test('amend ne purge pas le retablir', () => {
  const h = new History<number>(0);
  h.commit(1);
  h.commit(2);
  h.undo();
  h.amend(11);
  assert.equal(h.canRedo, true);
  assert.equal(h.redo(), 2);
});
