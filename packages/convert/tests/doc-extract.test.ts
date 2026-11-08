// Document Word vers classeur (tableaux) et vers diaporama (titres).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkbook } from '@forgeoffice/xlsx';
import { openPresentation, slideText, slideTitle } from '@forgeoffice/pptx';
import { convertFile, DEFAULT_OPTIONS } from '../src/engines.ts';
import { planEngine } from '../src/formats.ts';

const HTML = `<html><body><h1>Introduction</h1><p>Premier paragraphe.</p><p>Deuxieme.</p>
<table><tr><th>Produit</th><th>Prix</th></tr><tr><td>Cafe</td><td>18,5</td></tr><tr><td>The</td><td>9</td></tr></table>
<h2>Details</h2><p>Texte de detail.</p><table><tr><td>a</td><td>b</td></tr></table></body></html>`;
const bytes = new TextEncoder().encode(HTML);
const run = async (name: string, target: string) => {
  const engine = planEngine(name.split('.').pop() ?? '', target, false);
  assert.equal(engine, 'extraire', `${name} -> ${target}`);
  const [out] = await convertFile({ name, bytes: name.endsWith('.html') ? bytes : bytes }, target, engine, `s.${target}`, null, DEFAULT_OPTIONS);
  assert.ok(out);
  return out.bytes;
};

test('tableaux d un document -> une feuille par tableau, nombres convertis', async () => {
  const wb = await readWorkbook(await run('doc.html', 'xlsx'), 's.xlsx');
  assert.deepEqual(wb.sheets.map((s) => s.name), ['Tableau 1', 'Tableau 2']);
  const cell = (r: number, c: number) => wb.sheets[0]?.cells.get(r)?.get(c)?.value;
  assert.equal(cell(0, 0), 'Produit');
  assert.equal(cell(1, 1), 18.5);
  assert.equal(cell(2, 1), 9);
});

test('plan d un document -> diapositives : un titre de niveau 1 ou 2 = une diapositive', async () => {
  const deck = await openPresentation(await run('doc.html', 'pptx'));
  assert.equal(deck.slides.length, 2);
  assert.equal(slideTitle(deck.slides[0]!), 'Introduction');
  assert.match(slideText(deck.slides[0]!), /Premier paragraphe\.[\s\S]*Deuxieme\./);
  assert.match(slideText(deck.slides[0]!), /Cafe \| 18,5/);
  assert.equal(slideTitle(deck.slides[1]!), 'Details');
  assert.match(new TextDecoder().decode((await run('doc.html', 'odp')).subarray(30, 80)), /mimetype/);
});

test('document sans tableau : erreur claire', async () => {
  const engine = planEngine('md', 'xlsx', false);
  assert.equal(engine, 'extraire');
  await assert.rejects(convertFile({ name: 'plain.md', bytes: new TextEncoder().encode('# Titre\n\nTexte') }, 'xlsx', engine, 's.xlsx', null, DEFAULT_OPTIONS), /aucun tableau/);
});
