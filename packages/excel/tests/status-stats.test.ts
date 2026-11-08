// Calculs de la barre d'etat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { accumulate, parseStats, statValue, DEFAULT_STATS } from '../src/logic/status-stats.ts';

test('calculs sur une selection mixte', () => {
  const acc = accumulate();
  for (const v of [4, 'a', null, 10, '', 1]) acc.add(v);
  const s = acc.result();
  assert.deepEqual(['avg', 'cnt', 'num', 'min', 'max', 'sum'].map((id) => statValue(s, id as 'avg')), [5, 4, 3, 1, 10, 15]);
});

test('texte seul : pas de moyenne ni de somme', () => {
  const acc = accumulate();
  acc.add('x');
  const s = acc.result();
  assert.deepEqual([statValue(s, 'avg'), statValue(s, 'cnt'), statValue(s, 'min')], [undefined, 1, undefined]);
});

test('choix enregistres', () => {
  assert.deepEqual(parseStats(null), [...DEFAULT_STATS]);
  assert.deepEqual(parseStats('min,max,bidule'), ['min', 'max']);
  assert.deepEqual(parseStats(''), []);
});
