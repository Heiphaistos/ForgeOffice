// Table des matieres : options <-> instruction de champ, contenu genere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TOC, parseTocInstruction, tocBlocks, tocInstruction } from '../src/features/toc.ts';

const heads = [{ level: 1, text: 'Un', pos: 1 }, { level: 2, text: 'Deux', pos: 10 }, { level: 4, text: 'Quatre', pos: 20 }];

test('instruction : aller-retour des options', () => {
  assert.equal(tocInstruction(DEFAULT_TOC), 'TOC \\o "1-3" \\h \\z \\u');
  const o = { levels: 5, pageNumbers: false, rightAlign: false, leader: 'none' as const, hyperlinks: false };
  assert.equal(tocInstruction(o), 'TOC \\o "1-5" \\n \\z \\u');
  assert.deepEqual(parseTocInstruction(tocInstruction(DEFAULT_TOC)), DEFAULT_TOC);
  const back = parseTocInstruction(tocInstruction(o), []);
  assert.equal(back.levels, 5);
  assert.equal(back.pageNumbers, false);
  assert.equal(back.hyperlinks, false);
  assert.equal(back.rightAlign, false);
});

test('contenu : niveaux, numeros de page, caractere de suite', () => {
  const blocks = tocBlocks(heads, (p) => p, () => 'a', 'Sommaire', { ...DEFAULT_TOC, levels: 2, leader: 'hyphen' });
  assert.equal(blocks.length, 3); // titre + 2 niveaux
  const first = blocks[1] as { props: { tabs?: { leader?: string }[] }; inlines: { type: string }[] };
  assert.equal(first.props.tabs?.[0]?.leader, 'hyphen');
  assert.deepEqual(first.inlines.map((i) => i.type), ['hyperlink', 'tab', 'text']);
  const bare = tocBlocks(heads, (p) => p, () => 'a', 'S', { levels: 3, pageNumbers: false, rightAlign: true, leader: 'dot', hyperlinks: false });
  assert.deepEqual((bare[1] as { inlines: { type: string }[] }).inlines.map((i) => i.type), ['text']);
  assert.equal(parseTocInstruction('TOC \\o "1-3" \\h', first.props.tabs as never).leader, 'hyphen');
});
