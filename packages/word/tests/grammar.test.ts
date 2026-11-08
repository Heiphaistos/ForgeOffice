// Grammaire de base : espaces, ponctuation, mots repetes, majuscule de phrase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkText, NBSP, NNBSP } from '../src/features/grammar.ts';

const rules = (t: string): string[] => checkText(t).map((i) => i.rule);
const apply = (t: string): string => [...checkText(t)].reverse().reduce((s, i) => s.slice(0, i.from) + i.fix + s.slice(i.to), t);

test('espaces en trop et avant la virgule', () => {
  assert.deepEqual(rules('Bonjour  le monde'), ['doubleSpace']);
  assert.equal(apply('Bonjour  le monde'), 'Bonjour le monde');
  assert.equal(apply('Un mot , puis un autre .'), 'Un mot, puis un autre.');
});

test('espace manquant apres la virgule, sans toucher aux nombres', () => {
  assert.equal(apply('pommes,poires,fraises'), 'pommes, poires, fraises');
  assert.deepEqual(rules('Il coûte 3,50 euros'), []);
});

test('espace insecable avant ; : ! ?', () => {
  assert.equal(apply('Vraiment ? Oui !'), `Vraiment${NNBSP}? Oui${NNBSP}!`);
  assert.equal(apply('Voici : la liste'), `Voici${NBSP}: la liste`);
  assert.deepEqual(rules(`Déjà${NNBSP}? Ok`), []);
  assert.deepEqual(rules('Rendez-vous à 12:30 sur https://exemple.fr'), []);
});

test('mots repetes, avec exceptions courantes', () => {
  assert.equal(apply('Le le chat dort'), 'Le chat dort');
  assert.equal(apply('Il va de de la maison'), 'Il va de la maison');
  assert.deepEqual(rules('Nous nous aimons très très fort'), []);
});

test('majuscule en debut de phrase, abreviations et nombres epargnes', () => {
  assert.equal(apply('Il pleut. ce soir il neige'), 'Il pleut. Ce soir il neige');
  assert.deepEqual(rules('M. dupont et Mme martin sont là'), []);
  assert.deepEqual(rules('Version 2. suite du texte'), []);
  assert.deepEqual(rules('Il pleut. Il neige.'), []);
});
