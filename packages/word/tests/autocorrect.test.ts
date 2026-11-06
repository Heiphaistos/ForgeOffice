// Correction automatique : typographie francaise a la frappe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { capitalizeSentence, correct, listMarker, urlToken, NBSP, NNBSP } from '../src/editor/autocorrect.ts';

const fr = { french: true };
const en = { french: false };

test('ponctuation double : espace insecable avant ; ! ? et :', () => {
  assert.deepEqual(correct('Bonjour', '!', fr), { remove: 0, insert: `${NNBSP}!` });
  assert.deepEqual(correct('Bonjour', '?', fr), { remove: 0, insert: `${NNBSP}?` });
  assert.deepEqual(correct('Bonjour', ';', fr), { remove: 0, insert: `${NNBSP};` });
  assert.deepEqual(correct('Voici', ':', fr), { remove: 0, insert: `${NBSP}:` });
  // Une espace normale tapee avant est remplacee par l'espace insecable.
  assert.deepEqual(correct('Bonjour ', '!', fr), { remove: 1, insert: `${NNBSP}!` });
  assert.deepEqual(correct('Voici ', ':', fr), { remove: 1, insert: `${NBSP}:` });
  // Deja correct : rien a faire.
  assert.equal(correct(`Bonjour${NNBSP}`, '!', fr), null);
});

test('ponctuation double : exceptions (heures, debut de paragraphe, ponctuation collee)', () => {
  assert.equal(correct('12', ':', fr), null, 'heure 12:30');
  assert.equal(correct('', '!', fr), null, 'debut de paragraphe');
  assert.equal(correct('Quoi ?', '!', fr), null, 'apres une ponctuation : rien');
  assert.equal(correct('Quoi?', '!', fr), null, '« ?! » : pas d\'espace apres une ponctuation');
  assert.equal(correct('Bonjour', '!', en), null, 'anglais : aucune espace ajoutee');
  assert.equal(correct('Voir https', ':', fr), null, 'schema adresse https://');
  assert.equal(correct('Ecrire mailto', ':', fr), null, 'mailto:');
  assert.equal(correct('Dans C', ':', fr), null, 'lettre de lecteur C:');
});

test('guillemets francais « » avec espaces insecables', () => {
  assert.deepEqual(correct('Il dit ', '"', fr), { remove: 0, insert: `«${NBSP}` });
  assert.deepEqual(correct('', '"', fr), { remove: 0, insert: `«${NBSP}` });
  assert.deepEqual(correct(`Il dit «${NBSP}oui`, '"', fr), { remove: 0, insert: `${NBSP}»` });
  assert.deepEqual(correct(`«${NBSP}oui `, '"', fr), { remove: 1, insert: `${NBSP}»` }, 'l\'espace tapee avant est remplacee');
  assert.deepEqual(correct('oui', '"', fr), { remove: 0, insert: `«${NBSP}` }, 'aucun « ouvert : le guillemet ouvre');
});

test('guillemets anglais “ ” et apostrophe courbe', () => {
  assert.deepEqual(correct('He said ', '"', en), { remove: 0, insert: '“' });
  assert.deepEqual(correct('said', '"', en), { remove: 0, insert: '”' });
  assert.deepEqual(correct("L", "'", fr), { remove: 0, insert: '’' });
});

test('remplacements : symboles, points de suspension, fleches, fractions', () => {
  assert.deepEqual(correct('Droits (c)', ' ', fr), { remove: 3, insert: '© ' });
  assert.deepEqual(correct('Marque (tm)', ' ', fr), { remove: 4, insert: '™ ' });
  assert.deepEqual(correct('Bon...', ' ', fr), { remove: 3, insert: '… ' });
  assert.equal(correct('Bon...', '.', fr), null, 'quatrieme point : pas de remplacement');
  assert.deepEqual(correct('a -->', ' ', fr), { remove: 3, insert: '→ ' });
  assert.deepEqual(correct('Prends 1/2', ' ', fr), { remove: 3, insert: '½ ' });
  assert.equal(correct('Prends 11/2', ' ', fr), null, 'pas au milieu d\'un nombre');
  assert.equal(correct('texte', ' ', fr), null);
});

test('la saisie de plusieurs caracteres (collage) n\'est jamais corrigee', () => {
  assert.equal(correct('Bonjour', 'a!', fr), null);
});

test('listes automatiques : marqueur de debut de paragraphe', () => {
  assert.deepEqual(listMarker('-'), { kind: 'bullet', char: '•' });
  assert.deepEqual(listMarker('*'), { kind: 'bullet', char: '•' });
  assert.deepEqual(listMarker('1.'), { kind: 'number', text: '%1.' });
  assert.deepEqual(listMarker('12)'), { kind: 'number', text: '%1)' });
  assert.equal(listMarker('1'), null);
  assert.equal(listMarker('1.5'), null);
  assert.equal(listMarker('-x'), null);
  assert.equal(listMarker('Bonjour'), null);
});

test('majuscule en debut de phrase', () => {
  assert.deepEqual(capitalizeSentence('bonjour', ' '), { remove: 7, insert: 'Bonjour ' });
  assert.deepEqual(capitalizeSentence('Fin. suite', ' '), { remove: 5, insert: 'Suite ' });
  assert.deepEqual(capitalizeSentence('Quoi ? non', ' '), { remove: 3, insert: 'Non ' });
  assert.deepEqual(capitalizeSentence(`Fin.${NBSP}été`, ' '), { remove: 3, insert: 'Été ' });
  assert.equal(capitalizeSentence('Voir etc. suite', ' '), null, 'abreviation');
  assert.equal(capitalizeSentence('Dr. martin', ' '), null, 'abreviation');
  assert.equal(capitalizeSentence('1. premier', ' '), null, 'numero de liste');
  assert.equal(capitalizeSentence('Salut', ' '), null, 'deja capitalise');
  assert.equal(capitalizeSentence('iPhone', ' '), null, 'majuscule interne');
  assert.equal(capitalizeSentence('une phrase', ' '), null, 'milieu de phrase');
  assert.equal(capitalizeSentence('bonjour', 'a'), null, 'seulement sur une espace');
  assert.equal(capitalizeSentence('www.exemple.fr voir', ' '), null);
});

test('adresses web et e-mails : reconnus avant l espace', () => {
  assert.deepEqual(urlToken('Voir https://exemple.fr/page'), { start: 5, end: 28, address: 'https://exemple.fr/page' });
  assert.deepEqual(urlToken('Voir www.exemple.fr,'), { start: 5, end: 19, address: 'www.exemple.fr' }, 'ponctuation finale exclue');
  assert.deepEqual(urlToken('ecrire a moi@exemple.fr'), { start: 9, end: 23, address: 'moi@exemple.fr' });
  assert.equal(urlToken('Bonjour'), null);
  assert.equal(urlToken('fichier.txt'), null);
  assert.equal(urlToken('http://'), null);
  assert.equal(urlToken('a@b'), null);
});
