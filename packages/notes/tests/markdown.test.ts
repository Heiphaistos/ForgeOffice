import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeLink, setHeading, toggleInline, toggleLineStyle, type Edit, type InlineMark } from '../src/logic/markdown.ts';

const apply = (doc: string, e: Edit): { text: string; sel: string } => {
  const text = doc.slice(0, e.from) + e.insert + doc.slice(e.to);
  return { text, sel: text.slice(Math.min(e.anchor, e.head), Math.max(e.anchor, e.head)) };
};
const inline = (doc: string, from: number, to: number, mark: InlineMark): string => apply(doc, toggleInline(doc, from, to, mark)).text;

test('gras, italique, barré, code : poser puis retirer', () => {
  assert.equal(inline('un mot ici', 3, 6, '**'), 'un **mot** ici');
  assert.equal(inline('un **mot** ici', 5, 8, '**'), 'un mot ici');
  assert.equal(inline('un mot ici', 4, 4, '**'), 'un **mot** ici', 'curseur dans un mot');
  assert.equal(inline('', 0, 0, '*'), '**', 'paire vide');
  assert.equal(toggleInline('', 0, 0, '*').anchor, 1);
  assert.equal(inline('a b', 2, 3, '~~'), 'a ~~b~~');
  assert.equal(inline('a `b` c', 3, 4, '`'), 'a b c');
});

test('italique et gras imbriqués', () => {
  assert.equal(inline('un **mot** ici', 5, 8, '*'), 'un ***mot*** ici', 'italique dans du gras');
  assert.equal(inline('un ***mot*** ici', 6, 9, '*'), 'un **mot** ici', 'retire l\'italique, garde le gras');
  assert.equal(inline('un ***mot*** ici', 6, 9, '**'), 'un *mot* ici', 'retire le gras, garde l\'italique');
  assert.equal(inline('un *mot* ici', 4, 7, '*'), 'un mot ici');
});

test('marques comprises dans la sélection', () => {
  assert.equal(inline('un **mot** ici', 3, 10, '**'), 'un mot ici');
  assert.equal(apply('x', toggleInline('x', 0, 1, '**')).sel, 'x', 'la sélection suit le texte');
});

test('lien', () => {
  const a = apply('voir doc ici', makeLink('voir doc ici', 5, 8));
  assert.equal(a.text, 'voir [doc](https://) ici');
  assert.equal(a.sel, 'https://');
  const b = apply('https://exemple.fr', makeLink('https://exemple.fr', 0, 18));
  assert.equal(b.text, '[](https://exemple.fr)');
  assert.equal(apply('', makeLink('', 0, 0)).text, '[texte](https://)');
});

test('listes et citations : poser, remplacer, retirer, garder l\'indentation', () => {
  assert.deepEqual(toggleLineStyle(['a', '', 'b'], 'bullet'), ['- a', '', '- b']);
  assert.deepEqual(toggleLineStyle(['- a', '- b'], 'bullet'), ['a', 'b']);
  assert.deepEqual(toggleLineStyle(['- a', '- b'], 'number'), ['1. a', '2. b']);
  assert.deepEqual(toggleLineStyle(['1. a', '2. b'], 'task'), ['- [ ] a', '- [ ] b']);
  assert.deepEqual(toggleLineStyle(['- [x] a'], 'task'), ['a']);
  assert.deepEqual(toggleLineStyle(['  a', '  b'], 'quote'), ['  > a', '  > b']);
  assert.deepEqual(toggleLineStyle(['> a', '> b'], 'quote'), ['a', 'b']);
  assert.deepEqual(toggleLineStyle(['- a', 'b'], 'bullet'), ['- a', '- b'], 'une ligne sans style : on complète');
});

test('titres', () => {
  assert.equal(setHeading('Bonjour', 2), '## Bonjour');
  assert.equal(setHeading('# Bonjour', 3), '### Bonjour');
  assert.equal(setHeading('## Bonjour', 2), 'Bonjour');
  assert.equal(setHeading('#Pas un titre', 1), '# #Pas un titre');
});
