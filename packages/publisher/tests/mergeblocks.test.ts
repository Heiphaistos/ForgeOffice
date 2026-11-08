import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AutoShape } from '@forgeoffice/pptx';
import { addText, para } from '../src/build.ts';
import { fillShapes } from '../src/merge.ts';
import { addressBlock, greetingLine, mergeIssues, usedFields } from '../src/mergeblocks.ts';
import { createPublication } from '../src/pubdeck.ts';

const fields = ['Civilité', 'Prénom', 'Nom', 'Adresse', 'Code postal', 'Ville', 'Pays'];
const full = ['Madame', 'Claire', 'Martin', '12 rue des Lilas', '75011', 'Paris', 'France'];

test('bloc d adresse : lignes composées, lignes vides omises, noms de champs souples', () => {
  assert.equal(addressBlock(fields, full), 'Madame Claire Martin\n12 rue des Lilas\n75011 Paris\nFrance');
  assert.equal(addressBlock(fields, ['', '', 'Durand', '3 quai', '', 'Lyon', '']), 'Durand\n3 quai\nLyon');
  assert.equal(addressBlock(['DESTINATAIRE', 'Rue', 'CP', 'COMMUNE'], ['Société X', '1 av. Foch', '69001', 'Lyon']), 'Société X\n1 av. Foch\n69001 Lyon');
  assert.equal(addressBlock(['Autre'], ['x']), '');
});

test('ligne de salutation', () => {
  assert.equal(greetingLine(fields, full), 'Bonjour Madame Martin,');
  assert.equal(greetingLine(['Nom'], ['Dupont']), 'Bonjour Dupont,');
  assert.equal(greetingLine(['Ville'], ['Paris']), 'Madame, Monsieur,');
});

test('fusion : le bloc d adresse devient des sauts de ligne dans le même paragraphe', () => {
  const deck = createPublication({ width: 595, height: 842 }, 1);
  const box = addText(deck.slides[0]!.shapes, [10, 10, 200, 80], [para('«Bloc d’adresse»', { size: 11 })], {}, {}) as AutoShape;
  fillShapes(deck.slides[0]!.shapes, fields, full);
  const runs = box.text!.paragraphs[0]!.runs;
  assert.deepEqual(runs.map((r) => (r.type === 'text' ? r.text : '↵')), ['Madame Claire Martin', '↵', '12 rue des Lilas', '↵', '75011 Paris', '↵', 'France']);
});

test('erreurs de fusion : champ inconnu, valeurs vides, champ en double', () => {
  const deck = createPublication({ width: 595, height: 842 }, 1);
  addText(deck.slides[0]!.shapes, [10, 10, 200, 40], [para('«Nom» «Ville» «Inconnu» «Bloc d’adresse»', {})], {}, {});
  assert.deepEqual(usedFields(deck).sort(), ['Bloc d’adresse', 'Inconnu', 'Nom', 'Ville']);
  const issues = mergeIssues(deck, { name: 's', fields: ['Nom', 'Ville', 'Nom'], records: [['A', 'Paris', ''], ['B', '', ''], ['C', 'Lyon', '']] });
  assert.ok(issues.some((i) => i.kind === 'duplicate' && i.field === 'Nom'));
  assert.ok(issues.some((i) => i.kind === 'unknown' && i.field === 'Inconnu'));
  assert.ok(issues.some((i) => i.kind === 'empty' && i.field === 'Ville' && i.records.join() === '1'));
  assert.ok(!issues.some((i) => i.field === 'Bloc d’adresse'));
});
