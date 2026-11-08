import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changeCase, dedupeAdjacent, numberLines, removeEmptyLines, shuffleLines, sortByLength, sortNumeric, trimBoth, trimLeading, words } from '../src/logic/lines.ts';

test('lignes vides, doublons consécutifs, espaces de bord', () => {
  assert.deepEqual(removeEmptyLines(['a', '', '  ', 'b']), ['a', 'b']);
  assert.deepEqual(removeEmptyLines(['a', '', '  ', 'b'], false), ['a', '  ', 'b']);
  assert.deepEqual(dedupeAdjacent(['a', 'a', 'b', 'a', 'a', 'a']), ['a', 'b', 'a']);
  assert.deepEqual(trimLeading(['  \tx ', 'y']), ['x ', 'y']);
  assert.deepEqual(trimBoth([' x  ', '\ty\t']), ['x', 'y']);
});

test('tri numérique : décimales françaises, négatifs, lignes sans nombre à la fin', () => {
  const l = ['10 dix', '2,5 deux et demi', 'texte', '-3 moins trois', '2 deux', '1.5 un et demi'];
  assert.deepEqual(sortNumeric(l), ['-3 moins trois', '1.5 un et demi', '2 deux', '2,5 deux et demi', '10 dix', 'texte']);
  assert.deepEqual(sortNumeric(l, true), ['10 dix', '2,5 deux et demi', '2 deux', '1.5 un et demi', '-3 moins trois', 'texte']);
});

test('tri par longueur, mélange déterministe, numérotation', () => {
  assert.deepEqual(sortByLength(['ccc', 'a', 'bb', 'aa']), ['a', 'aa', 'bb', 'ccc']);
  assert.deepEqual(sortByLength(['ccc', 'a', 'bb'], true), ['ccc', 'bb', 'a']);
  const src = ['1', '2', '3', '4', '5'];
  const mixed = shuffleLines(src, () => 0);
  assert.deepEqual(mixed, ['2', '3', '4', '5', '1']);
  assert.deepEqual(src, ['1', '2', '3', '4', '5']);
  assert.deepEqual([...shuffleLines(src)].sort(), src);
  assert.deepEqual(numberLines(['a', 'b'], 8), ['8. a', '9. b']);
});

test('casses de programmation', () => {
  assert.deepEqual(words('maPhraseXML_v2 test-ok'), ['ma', 'Phrase', 'XML', 'v', '2', 'test', 'ok']);
  assert.equal(changeCase('mon super titre', 'camel'), 'monSuperTitre');
  assert.equal(changeCase('mon super titre', 'pascal'), 'MonSuperTitre');
  assert.equal(changeCase('Mon Super-Titre', 'snake'), 'mon_super_titre');
  assert.equal(changeCase('monSuperTitre', 'kebab'), 'mon-super-titre');
  assert.equal(changeCase('été précoce', 'camel'), 'étéPrécoce');
});
