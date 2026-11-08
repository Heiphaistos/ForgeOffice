// Generateur d'expressions : catalogue, insertion, controle de syntaxe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog, checkExpression, insertAt } from '../src/logic/expression-catalog.ts';

test('catalogue : un groupe de champs par table puis fonctions, operateurs, constantes', () => {
  const c = catalog([{ name: 'Clients', fields: ['Société', 'Ville'] }, { name: 'Produits', fields: ['Prix'] }]);
  assert.deepEqual(c.slice(0, 2).map((x) => x.label), ['Champs : Clients', 'Champs : Produits']);
  assert.deepEqual(c[0]?.items.map((i) => i.insert), ['[Société]', '[Ville]']);
  assert.ok(c.some((x) => x.id === 'ops') && c.some((x) => x.id === 'const'));
  const names = c.flatMap((x) => x.items.map((i) => i.label));
  assert.ok(names.includes('Gauche(texte; n)') && names.includes('Somme(champ)'));
});

test('insertion : au curseur, curseur place entre les parentheses', () => {
  const g = catalog([]).flatMap((x) => x.items).find((i) => i.label.startsWith('Majuscule'));
  assert.ok(g);
  assert.deepEqual(insertAt('= + 1', 2, g), { text: '= Majuscule()+ 1', caret: 2 + 'Majuscule('.length });
  assert.deepEqual(insertAt('', 99, { label: 'x', insert: '[A]' }), { text: '[A]', caret: 3 });
  const between = catalog([]).flatMap((x) => x.items).find((i) => i.label.startsWith('Entre'));
  assert.deepEqual(insertAt('[Prix]', 6, between!), { text: '[Prix] Entre  Et ', caret: 6 + ' Entre '.length });
});

test('controle de syntaxe', () => {
  assert.equal(checkExpression('Gauche([Nom]; 3) & " (" & [Ville] & ")"'), null);
  assert.equal(checkExpression('[Date] > #01/01/2026#'), null);
  assert.equal(checkExpression('Gauche(([Nom]; 3)'), '1 parenthèse(s) à fermer.');
  assert.match(checkExpression('[Nom]) + 1') ?? '', /fermante/);
  assert.match(checkExpression('"abc') ?? '', /Guillemet/);
  assert.match(checkExpression('[Nom') ?? '', /Crochet/);
  assert.match(checkExpression('#01/01/2026') ?? '', /Dièse/);
  assert.equal(checkExpression('"(" & [A]'), null, 'parenthese dans une chaine ignoree');
  assert.equal(checkExpression(''), null);
});
