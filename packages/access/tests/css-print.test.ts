// Garde-fou : une accolade en trop dans access.css faisait ignorer en silence le bloc @media print (toute l'interface sortait a l'impression).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/access.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

test('access.css : accolades jamais negatives, soldees a la fin', () => {
  let depth = 0;
  for (const line of css.split('\n')) {
    depth += (line.match(/{/g)?.length ?? 0) - (line.match(/}/g)?.length ?? 0);
    assert.ok(depth >= 0, `accolade fermante en trop : ${line.slice(0, 60)}`);
  }
  assert.equal(depth, 0);
});

test('access.css : @media print masque le volet et libere la feuille de donnees', () => {
  const print = css.slice(css.indexOf('@media print'));
  assert.ok(print.includes('.acc-nav') && print.includes('.acc-ds__grid'));
});
