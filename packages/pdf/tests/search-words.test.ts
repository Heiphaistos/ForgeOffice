import assert from 'node:assert/strict';
import { test } from 'node:test';
import { replaceIn, search } from '../src/find.ts';
import type { TextBox } from '../src/model.ts';

const box = (str: string): TextBox => ({ str, rect: { x: 0, y: 0, w: 1, h: 0.1 }, size: 12 });

test('mot entier : exclut les mots qui contiennent le motif', () => {
  const pages = [[box('un chat, des chats, un achat, chat-chaud, chat')]];
  assert.equal(search(pages, 'chat').length, 5);
  const whole = search(pages, 'chat', { wholeWord: true });
  assert.deepEqual(whole.map((h) => h.start), [3, 30, 42]);
});

test('mot entier : accents, casse, expression reguliere et remplacement', () => {
  const pages = [[box('Été, étés et été')]];
  assert.equal(search(pages, 'ete', { wholeWord: true }).length, 2);
  assert.equal(search(pages, 'ét.', { regex: true, wholeWord: true, matchCase: true }).length, 1);
  assert.equal(search(pages, 'été', { regex: true, wholeWord: true, matchCase: true }).length, 1);
  assert.equal(replaceIn('chat achat chat', 'chat', 'X', { wholeWord: true }), 'X achat X');
});
