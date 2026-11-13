import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lineTags, tagHits } from '../src/logic/tags.ts';

test('lineTags : titres, mots collés, chiffres seuls ignorés', () => {
  assert.deepEqual(lineTags('# Titre #projet/a (#b-2) x#no #123 #é'), ['projet/a', 'b-2', 'é']);
});

test('tagHits : triés, hors blocs de code et hors fichiers non texte', () => {
  const hits = tagHits([
    { id: 'f:a.md', name: 'a.md', text: '# T\nvoir #zeta et #alpha\n```\n#code\n```\n' },
    { id: 't1', name: 'Sans titre 1', text: '#beta' },
    { id: 't2', name: 'x.rs', text: '#alpha' },
  ]);
  assert.deepEqual(hits.map((h) => h.tag), ['alpha', 'beta', 'zeta']);
  assert.equal(hits[0]?.line, 1);
});
