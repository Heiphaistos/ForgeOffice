import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editDistance, languageName, suggest, vocabulary, wordAt } from '../src/features/spelling.ts';

test('mot sous le curseur : accents, apostrophe et trait d union internes', () => {
  const t = "L'été, c'est l'après-midi.";
  assert.deepEqual(wordAt(t, 3), { word: 'été', from: 2, to: 5 });
  assert.deepEqual(wordAt(t, 5), { word: 'été', from: 2, to: 5 });
  assert.equal(wordAt(t, 6), null);
  assert.equal(wordAt(t, 21)?.word, 'après-midi');
  assert.equal(wordAt('', 0), null);
  assert.equal(wordAt('   ', 1), null);
});

test('distance d edition : transposition = 1, bornee', () => {
  assert.equal(editDistance('bonjour', 'bonjuor', 2), 1);
  assert.equal(editDistance('chat', 'chats', 2), 1);
  assert.equal(editDistance('maison', 'maisson', 1), 1);
  assert.equal(editDistance('abc', 'xyzxyz', 2), 3);
});

test('suggestions : mots plus frequents du document, casse respectee', () => {
  const vocab = vocabulary('Le projet avance. Le projet est livré. Un projet réussi. Le prjoet est une faute. Bonjour Bonjour');
  assert.equal(vocab.get('projet'), 3);
  assert.deepEqual(suggest('prjoet', vocab), ['projet']);
  assert.deepEqual(suggest('Prjoet', vocab), ['Projet']);
  assert.deepEqual(suggest('PRJOET', vocab), ['PROJET']);
  // Un mot correct et frequent n'a aucune suggestion meilleure que lui.
  assert.deepEqual(suggest('projet', vocab), []);
  assert.deepEqual(suggest('zzzzzz', vocab), []);
  assert.deepEqual(suggest('Bonjuor', vocab), ['Bonjour']);
});

test('langues : nom lisible, balise inconnue renvoyee telle quelle', () => {
  assert.equal(languageName(undefined), 'Français (France)');
  assert.equal(languageName('en-gb'), 'Anglais (Royaume-Uni)');
  assert.equal(languageName('xx-YY'), 'xx-YY');
});
