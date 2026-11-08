import assert from 'node:assert/strict';
import { test } from 'node:test';
import { headingKey, headingLine } from '../src/logic/outline.ts';
import { linkifyWikiHtml } from '../src/logic/links.ts';

const doc = '# Intro\n\ntexte\n\n## Deuxième Partie !\n\n```\n# pas un titre\n```\n\n### Fin';

test('clé de titre et recherche de ligne', () => {
  assert.equal(headingKey('Deuxième Partie !'), 'deuxieme-partie');
  assert.equal(headingLine(doc, 'deuxieme partie'), 4);
  assert.equal(headingLine(doc, 'Fin'), 10);
  assert.equal(headingLine(doc, 'pas un titre'), null, 'les blocs de code sont ignorés');
  assert.equal(headingLine(doc, '  '), null);
});

test('aperçu : le titre du lien est conservé dans data-heading', () => {
  const html = linkifyWikiHtml('<p>Voir [[Note#Deuxième Partie]]</p>');
  assert.match(html, /data-note="Note"/);
  assert.match(html, /data-heading="Deuxième Partie"/);
});
