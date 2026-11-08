// Donnees typees : classeur vers JSON / HTML / Markdown et JSON vers classeur (nombres, booleens et dates conserves).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkbook } from '@forgeoffice/xlsx';
import { convertFile, DEFAULT_OPTIONS } from '../src/engines.ts';
import { planEngine } from '../src/formats.ts';
import { headerNames, jsonToWorkbook, workbookRows } from '../src/sheet-data.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dec = (b: Uint8Array): string => new TextDecoder().decode(b);
const run = async (name: string, bytes: Uint8Array, target: string): Promise<Uint8Array> => {
  const engine = planEngine(name.split('.').pop() ?? '', target, false);
  assert.equal(engine, 'donnees', `${name} -> ${target}`);
  const [out] = await convertFile({ name, bytes }, target, engine, `s.${target}`, null, DEFAULT_OPTIONS);
  assert.ok(out);
  return out.bytes;
};
const CSV = 'Nom;Age;Actif;Date\nAlice;30;vrai;03/04/2024\nBob;25,5;faux;\n';

test('csv -> json : nombres, booleens et dates typés', async () => {
  const json = JSON.parse(dec(await run('t.csv', enc(CSV), 'json'))) as Record<string, unknown>[];
  assert.equal(json.length, 2);
  assert.equal(json[0]?.Nom, 'Alice');
  assert.equal(json[0]?.Age, 30);
  assert.equal(json[1]?.Age, 25.5);
  assert.equal(typeof json[0]?.Actif, 'boolean');
  assert.equal(json[0]?.Date, '2024-04-03');
  assert.equal(json[1]?.Date, null);
});

test('json -> xlsx -> json : aller-retour, objets imbriques en texte', async () => {
  const src = JSON.stringify([{ id: 1, nom: 'A', ok: true, tags: ['x', 'y'] }, { id: 2, nom: 'B', extra: 'z' }]);
  const xlsx = await run('d.json', enc(src), 'xlsx');
  const back = JSON.parse(dec(await run('d.xlsx', xlsx, 'json'))) as Record<string, unknown>[];
  assert.deepEqual(back[0], { id: 1, nom: 'A', ok: true, tags: '["x","y"]', extra: null });
  assert.deepEqual(back[1], { id: 2, nom: 'B', ok: null, tags: null, extra: 'z' });
});

test('json objet de tableaux -> une feuille par cle ; classeur multi-feuilles -> objet', async () => {
  const wb = jsonToWorkbook(JSON.stringify({ Clients: [{ a: 1 }], 'Ventes/2026': [[1, 2], [3, 4]] }));
  assert.deepEqual(wb.sheets.map((s) => s.name), ['Clients', 'Ventes 2026']);
  const xlsx = await run('m.json', enc('{"A":[{"x":1}],"B":[{"y":2}]}'), 'xlsx');
  const obj = JSON.parse(dec(await run('m.xlsx', xlsx, 'json'))) as Record<string, unknown[]>;
  assert.deepEqual(Object.keys(obj), ['A', 'B']);
  assert.deepEqual(obj.B, [{ y: 2 }]);
});

test('en-tetes : vides et doublons', () => {
  assert.deepEqual(headerNames(['a', null, 'a', 'a']), ['a', 'Colonne 2', 'a (2)', 'a (3)']);
});

test('csv -> html echappe le contenu ; csv -> md echappe | et saute les lignes', async () => {
  const html = dec(await run('t.csv', enc('Nom;Note\n<b>x</b>;3\n'), 'html'));
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /<td class="n">3<\/td>/);
  assert.ok(!html.includes('<b>x</b>'));
  const md = dec(await run('t.csv', enc('A;B\n"a|b";"l1\nl2"\n'), 'md'));
  assert.match(md, /\| A \| B \|\n\| --- \| --- \|\n\| a\\|b \| l1<br>l2 \|/);
});

test('classeur vide : erreur claire', async () => {
  const wb = await readWorkbook(enc(''), 'v.csv').catch(() => null);
  assert.equal(wb, null);
  assert.deepEqual(workbookRows(jsonToWorkbook('[]')), []);
});

test('CSV : option « une feuille par fichier » produit un CSV par feuille visible', async () => {
  const xlsx = await run('m.json', enc('{"Clients":[{"a":1}],"Ventes/2026":[{"b":2}]}'), 'xlsx');
  const one = await convertFile({ name: 'm.xlsx', bytes: xlsx }, 'csv', 'tableur', 'm.csv', null, DEFAULT_OPTIONS);
  assert.equal(one.length, 1, 'sans option : feuille active seule');
  const all = await convertFile({ name: 'm.xlsx', bytes: xlsx }, 'csv', 'tableur', 'm.csv', null, { ...DEFAULT_OPTIONS, allSheets: true });
  assert.deepEqual(all.map((f) => f.name), ['m-Clients.csv', 'm-Ventes 2026.csv']);
  assert.match(dec(all[1]?.bytes ?? new Uint8Array()), /b\r?\n2/);
});

test('YAML / TOML / XML : depuis un CSV, un JSON, un YAML ou un TOML, et vers un classeur', async () => {
  const yaml = dec(await run('t.csv', enc('Nom;Age\nAlice;30\nBob;25\n'), 'yaml'));
  assert.match(yaml, /- Nom: Alice\n {2}Age: 30/);
  const toml = dec(await run('t.csv', enc('Nom;Age\nAlice;30\n'), 'toml'));
  assert.match(toml, /\[\[items\]\]\nNom = "Alice"\nAge = 30/);
  const xml = dec(await run('clients liste.csv', enc('Nom;Age\nAlice;30\n'), 'xml'));
  assert.match(xml, /<clients_liste>\n {2}<item>\n {4}<Nom>Alice<\/Nom>/);
  const fromYaml = JSON.parse(dec(await run('c.yaml', enc('- id: 1\n  nom: A\n- id: 2\n  nom: B\n'), 'json'))) as unknown[];
  assert.equal(fromYaml.length, 2);
  const xlsx = await run('c.toml', enc('[[p]]\nx = 1\n[[p]]\nx = 2\n'), 'xlsx');
  assert.deepEqual(JSON.parse(dec(await run('c.xlsx', xlsx, 'json'))), [{ x: 1 }, { x: 2 }]);
  assert.match(dec(await run('c.json', enc('{"a":{"b":[1,2]}}'), 'yaml')), /a:\n {2}b:\n {4}- 1/);
});
