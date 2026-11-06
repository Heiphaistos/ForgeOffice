import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caretColor, DEFAULT_CARET, luminance, parseCaret } from '../src/logic/caret.ts';

test('lecture tolerante des reglages', () => {
  assert.deepEqual(parseCaret(undefined), DEFAULT_CARET);
  assert.deepEqual(parseCaret({ width: 3, color: 'white', blink: false }), { width: 3, color: 'white', blink: false });
  assert.deepEqual(parseCaret({ width: 99, color: '<script>', blink: 'oui' }), DEFAULT_CARET);
  assert.equal(DEFAULT_CARET.width, 2);
});

test('couleur automatique : contraste avec le fond', () => {
  assert.equal(caretColor(DEFAULT_CARET, '#FFFFFF', '#185ABD'), '#000000');
  assert.equal(caretColor(DEFAULT_CARET, '#1E1E1E', '#185ABD'), '#FFFFFF');
  assert.equal(caretColor(DEFAULT_CARET, null, '#185ABD'), '#000000');
  assert.equal(caretColor({ ...DEFAULT_CARET, color: 'accent' }, '#1E1E1E', '#185ABD'), '#185ABD');
  assert.equal(caretColor({ ...DEFAULT_CARET, color: 'black' }, '#000000', '#185ABD'), '#000000');
  assert.ok(luminance('#FFFFFF') > 0.99 && luminance('#000000') < 0.01);
});
