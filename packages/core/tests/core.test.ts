import { test } from 'node:test';
import assert from 'node:assert/strict';
import { History } from '../src/history.ts';
import { moduleForFile, isAppId } from '../src/modules.ts';

test('History fusionne les validations du meme groupe et annule/retablit', () => {
  const h = new History(0);
  h.commit(1, 'frappe', 1000);
  h.commit(2, 'frappe', 1200);
  h.commit(3, null, 5000);
  assert.equal(h.undo(), 2);
  assert.equal(h.undo(), 0);
  assert.equal(h.canUndo, false);
  assert.equal(h.redo(), 2);
  h.commit(9);
  assert.equal(h.canRedo, false);
});

test('moduleForFile associe les extensions', () => {
  assert.equal(moduleForFile('Rapport.DOCX'), 'word');
  assert.equal(moduleForFile('budget.xls'), 'excel');
  assert.equal(moduleForFile('a.pptx'), 'powerpoint');
  assert.equal(moduleForFile('base.accdb'), 'access');
  assert.equal(moduleForFile('inconnu'), null);
  assert.equal(isAppId('word'), true);
  assert.equal(isAppId('toString'), false);
});
