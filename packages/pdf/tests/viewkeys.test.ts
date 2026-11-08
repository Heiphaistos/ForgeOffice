import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyHistory, pageFromInput, pushView, stepView, viewAction, type KeyLike } from '../src/viewkeys.ts';

const k = (key: string, o: Partial<KeyLike> = {}): KeyLike => ({ key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...o });

test('raccourcis d\'affichage', () => {
  assert.equal(viewAction(k('=', { ctrlKey: true })), 'zoomIn');
  assert.equal(viewAction(k('+', { ctrlKey: true, shiftKey: true })), 'zoomIn');
  assert.equal(viewAction(k('-', { ctrlKey: true })), 'zoomOut');
  assert.equal(viewAction(k('0', { ctrlKey: true })), 'fitPage');
  assert.equal(viewAction(k('1', { ctrlKey: true })), 'actualSize');
  assert.equal(viewAction(k('2', { ctrlKey: true })), 'fitWidth');
  assert.equal(viewAction(k('N', { ctrlKey: true, shiftKey: true })), 'goToPage');
  assert.equal(viewAction(k('h', { ctrlKey: true })), 'readingMode');
  assert.equal(viewAction(k('F3')), 'findNext');
  assert.equal(viewAction(k('F3', { shiftKey: true })), 'findPrevious');
  assert.equal(viewAction(k('Home')), 'firstPage');
  assert.equal(viewAction(k('End')), 'lastPage');
  assert.equal(viewAction(k('ArrowLeft', { altKey: true })), 'back');
  assert.equal(viewAction(k('ArrowRight', { altKey: true })), 'forward');
  assert.equal(viewAction(k('Home', { ctrlKey: true })), null);
  assert.equal(viewAction(k('a')), null);
  assert.equal(viewAction(k('n', { ctrlKey: true })), null);
});

test('aller à la page : saisie validée', () => {
  assert.equal(pageFromInput(' 3 ', 5), 2);
  assert.equal(pageFromInput('1', 5), 0);
  assert.equal(pageFromInput('5', 5), 4);
  assert.equal(pageFromInput('6', 5), null);
  assert.equal(pageFromInput('0', 5), null);
  assert.equal(pageFromInput('2x', 5), null);
  assert.equal(pageFromInput('', 5), null);
});

test('historique de vues : retour, avance, avance effacée par un nouveau saut', () => {
  let h = emptyHistory(0);
  h = pushView(h, 0, 4); // 0 -> 4
  h = pushView(h, 4, 2); // 4 -> 2
  assert.deepEqual(h.stack, [0, 4, 2]);
  let r = stepView(h, -1);
  assert.equal(r.page, 4);
  r = stepView(r.history, -1);
  assert.equal(r.page, 0);
  assert.equal(stepView(r.history, -1).page, null);
  r = stepView(r.history, 1);
  assert.equal(r.page, 4);
  h = pushView(r.history, 4, 1); // nouveau saut : l'avance (2) disparaît
  assert.deepEqual(h.stack, [0, 4, 1]);
  assert.equal(stepView(h, 1).page, null);
  assert.equal(pushView(h, 1, 1), h);
});
