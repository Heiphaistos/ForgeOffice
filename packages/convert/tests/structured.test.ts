// Donnees structurees : YAML, TOML, XML (ecriture) et lecture YAML/TOML, aller-retours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseToml, parseYaml, toToml, toXml, toYaml, xmlName, type Json } from '../src/structured.ts';

const DATA: Json = {
  nom: 'Atelier: Lumière', actif: true, note: null, prix: 12.5, vide: [], tags: ['a', 'b c', '42', 'true'],
  adresse: { ville: 'Lyon', cp: 69001 },
  clients: [{ id: 1, nom: 'A' }, { id: 2, nom: 'B', extra: { x: [1, 2] } }],
};

test('YAML : aller-retour complet', () => {
  const y = toYaml(DATA);
  assert.match(y, /^nom: "Atelier: Lumière"$/m);
  assert.match(y, /^tags:\n {2}- a\n {2}- b c\n {2}- "42"\n {2}- "true"$/m);
  assert.deepEqual(parseYaml(y), DATA);
});

test('YAML : lecture de documents ecrits a la main', () => {
  const doc = `# config\nname: demo\nversion: 1.5\nenabled: yes_no\nlist:\n- one\n- two # note\nmap: {a: 1, b: [x, y]}\ntext: |\n  ligne 1\n  ligne 2\nfolded: >\n  a\n  b\nquoted: 'it''s'\nempty:\nitems:\n  - id: 1\n    label: A\n  - id: 2\n    label: B\n`;
  assert.deepEqual(parseYaml(doc), {
    name: 'demo', version: 1.5, enabled: 'yes_no', list: ['one', 'two'], map: { a: 1, b: ['x', 'y'] }, text: 'ligne 1\nligne 2\n', folded: 'a b', quoted: "it's", empty: null,
    items: [{ id: 1, label: 'A' }, { id: 2, label: 'B' }],
  });
  assert.deepEqual(parseYaml('- 1\n- [2, 3]\n- {k: v}\n'), [1, [2, 3], { k: 'v' }]);
  assert.equal(parseYaml('42'), 42);
  assert.equal(parseYaml(''), null);
});

test('TOML : ecriture puis lecture (tables, tableaux de tables, null omis)', () => {
  const t = toToml(DATA);
  assert.match(t, /^\[adresse\]$/m);
  assert.match(t, /^\[\[clients\]\]$/m);
  assert.ok(!t.includes('note'));
  const back = parseToml(t) as Record<string, Json>;
  const { note: _n, ...expected } = DATA as Record<string, Json>;
  assert.deepEqual(back, expected);
  assert.deepEqual(parseToml(toToml([{ a: 1 }, { a: 2 }])), { items: [{ a: 1 }, { a: 2 }] });
});

test('TOML : lecture a la main', () => {
  const doc = `title = "T" # c\nn = 1_000\nlist = [1,\n  2]\n[owner]\nname = 'Tom'\ndob = 1979-05-27\n[a.b]\nc = true\n[[p]]\nx = 1\n[[p]]\nx = 2\ninline = { k = "v", z = 3 }\n`;
  assert.deepEqual(parseToml(doc), { title: 'T', n: 1000, list: [1, 2], owner: { name: 'Tom', dob: '1979-05-27' }, a: { b: { c: true } }, p: [{ x: 1 }, { x: 2, inline: { k: 'v', z: 3 } }] });
});

test('XML : echappement, noms valides, tableaux en elements repetes', () => {
  const x = toXml({ 'Nom client': 'A & <B>', '1er': 2, liste: [1, 2], vide: null });
  assert.match(x, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(x, /<Nom_client>A &amp; &lt;B&gt;<\/Nom_client>/);
  assert.match(x, /<_1er>2<\/_1er>/);
  assert.match(x, /<liste>1<\/liste>\n\s+<liste>2<\/liste>/);
  assert.match(x, /<vide\/>/);
  assert.match(toXml([1, 2]), /<item>1<\/item>/);
  assert.equal(xmlName('  '), '_');
});
