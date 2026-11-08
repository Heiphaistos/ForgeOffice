// Assistant Convertir : delimiteurs, identificateur de texte, largeur fixe, formats de colonne, destination.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { convertText, splitLine, type SplitOptions } from '../src/logic/text-split.ts';

const delim: SplitOptions = { mode: 'delimited', delimiters: [';'], consecutive: false, qualifier: '"', breaks: [] };

test('delimiteurs : identificateur de texte et delimiteurs consecutifs', () => {
  assert.deepEqual(splitLine('a;"b;c";d', delim), ['a', 'b;c', 'd']);
  assert.deepEqual(splitLine('a;;b', delim), ['a', '', 'b']);
  assert.deepEqual(splitLine('a;;b', { ...delim, consecutive: true }), ['a', 'b']);
  assert.deepEqual(splitLine('a b,c', { ...delim, delimiters: [' ', ','] }), ['a', 'b', 'c']);
  assert.deepEqual(splitLine('"il dit ""oui""";x', delim), ['il dit "oui"', 'x']);
});

test('largeur fixe : ruptures triees, hors bornes ignorees', () => {
  const fixed: SplitOptions = { ...delim, mode: 'fixed', breaks: [8, 3, 99] };
  assert.deepEqual(splitLine('ABC12345XYZ', fixed), ['ABC', '12345', 'XYZ']);
});

test('conversion : formats Texte / Standard / Ignorer et destination', () => {
  const d = new Draft(createBlankWorkbook());
  const lines = ['007;12,5;x', '008;3;y'];
  const out = convertText(d, 0, { r1: 0, c1: 0, r2: 1, c2: 0 }, delim, ['text', 'general', 'skip'], { row: 4, col: 2 }, (r) => lines[r] ?? null);
  assert.deepEqual(out, { r1: 4, c1: 2, r2: 5, c2: 3 });
  assert.equal(d.get(0, 4, 2)?.value, '007', 'format Texte : zeros conserves');
  assert.equal(d.get(0, 4, 3)?.value, 12.5, 'Standard : nombre francais');
  assert.equal(d.get(0, 5, 3)?.value, 3);
  assert.equal(d.get(0, 4, 4), undefined, 'colonne ignoree');
});
