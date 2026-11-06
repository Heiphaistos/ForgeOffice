// .xls produit par Excel 365 (compte neutre) : commentaires, liens, couleur d'onglet, protection, validations,
// mises en forme conditionnelles, filtre automatique.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readXls, SpreadsheetError } from '../src/index.ts';

const bytes = (): Uint8Array => new Uint8Array(readFileSync(new URL('./fixtures/excel-features.xls', import.meta.url)));

test('commentaires : texte, auteur, position, visibilite, plusieurs lignes', () => {
  const sheet = readXls(bytes()).sheets[0];
  assert.deepEqual(sheet?.notes.map((n) => [n.ref.row, n.ref.col, n.author, n.text, n.visible ?? false]), [
    [1, 1, 'Utilisateur', 'Valeur de test (note 1)', false],
    [2, 2, 'Utilisateur', 'Deuxieme note\nsur deux lignes', true],
  ]);
});

test('liens hypertexte : URL, lien interne, mailto, texte affiche et info-bulle', () => {
  const links = readXls(bytes()).sheets[0]?.hyperlinks ?? [];
  assert.equal(links.length, 3);
  assert.deepEqual(links[0], { ref: { r1: 0, r2: 0, c1: 4, c2: 4 }, display: 'Site exemple', target: 'https://example.org/page?x=1', tooltip: 'Info bulle du lien' });
  assert.deepEqual(links[1], { ref: { r1: 1, r2: 1, c1: 4, c2: 4 }, display: 'Vers Listes', location: 'Listes!B2', tooltip: 'Aller aux listes' });
  assert.equal(links[2]?.target, 'mailto:test@example.org');
});

test('lien javascript: refuse a la lecture', () => {
  const data = bytes();
  const wide = (s: string): number[] => [...s].flatMap((c) => [c.charCodeAt(0), 0]);
  const from = wide('https://example.org/page?x=1');
  const to = wide('javascript:alert(1);//pgx');
  assert.equal(to.length + 6, from.length);
  const padded = [...to, ...wide('y')].slice(0, from.length);
  let hit = -1;
  for (let i = 0; i + from.length < data.length; i++) {
    if (from.every((b, k) => data[i + k] === b)) {
      hit = i;
      break;
    }
  }
  assert.ok(hit >= 0);
  data.set(padded, hit);
  const links = readXls(data).sheets[0]?.hyperlinks ?? [];
  assert.ok(!links.some((l) => /javascript:/i.test(l.target ?? '')));
  assert.equal(links.length, 2);
});

test('couleur d onglet et protection de feuille (mot de passe 16 bits conserve)', () => {
  const wb = readXls(bytes());
  assert.deepEqual(wb.sheets[0]?.tabColor, { rgb: 'FFFF0000' });
  assert.deepEqual(wb.sheets[2]?.tabColor, { rgb: 'FF00FF00' });
  assert.equal(wb.sheets[1]?.tabColor, undefined);
  assert.deepEqual(wb.sheets[1]?.protection, { sheet: true, allow: {}, objects: true, scenarios: true, password: { legacy: 'CC82' } });
  assert.equal(wb.sheets[0]?.protection, undefined);
});

test('validations de donnees : liste en ligne, entier entre, formule personnalisee, messages', () => {
  const dv = readXls(bytes()).sheets[0]?.dataValidations ?? [];
  assert.equal(dv.length, 3);
  assert.deepEqual(dv[0], {
    ranges: [{ r1: 1, r2: 4, c1: 2, c2: 2 }], type: 'list', formula1: '"Oui,Non,Peut-etre"',
    showInputMessage: true, showErrorMessage: true, promptTitle: 'Choix', errorTitle: 'Erreur', prompt: 'Choisir une valeur', error: 'Valeur non permise',
  });
  assert.deepEqual(dv[1], {
    ranges: [{ r1: 1, r2: 4, c1: 1, c2: 1 }], type: 'whole', operator: 'between', formula1: '1', formula2: '100',
    allowBlank: true, showInputMessage: true, showErrorMessage: true, errorStyle: 'warning',
  });
  assert.equal(dv[2]?.type, 'custom');
  assert.equal(dv[2]?.formula1, 'H2>0');
});

test('mises en forme conditionnelles : valeur de cellule, formule, police, gras, remplissage', () => {
  const wb = readXls(bytes());
  const cf = wb.sheets[0]?.conditionalFormats ?? [];
  assert.equal(cf.length, 2);
  assert.deepEqual(cf[0]?.ranges, [{ r1: 1, r2: 4, c1: 1, c2: 1 }]);
  assert.deepEqual(cf[0]?.rules.map((r) => [r.type, r.operator, r.formulas]), [['cellIs', 'greaterThan', ['10']]]);
  assert.deepEqual(cf[1]?.rules.map((r) => [r.type, r.formulas]), [['expression', ['$B2<9']]]);
  const first = wb.styles.dxfs[cf[0]?.rules[0]?.dxfId ?? -1];
  assert.deepEqual(first?.font?.color, { indexed: 10 });
  assert.equal(first?.fill?.type, 'pattern');
  const second = wb.styles.dxfs[cf[1]?.rules[0]?.dxfId ?? -1];
  assert.equal(second?.font?.bold, true);
});

test('filtre automatique : plage (nom integre) et critere de colonne', () => {
  const filter = readXls(bytes()).sheets[0]?.autoFilter;
  assert.deepEqual(filter?.ref, { r1: 0, c1: 0, r2: 4, c2: 2 });
  assert.deepEqual(filter?.columns, [{ colId: 2, filter: { kind: 'custom', conditions: [{ operator: 'equal', value: 'Oui' }] } }]);
});

test('fichier abime : seule SpreadsheetError peut sortir (150 corruptions pseudo-aleatoires)', () => {
  const original = bytes();
  let seed = 42;
  const rnd = (n: number): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };
  for (let round = 0; round < 150; round++) {
    const data = original.slice();
    for (let k = 0; k < 1 + rnd(30); k++) data[rnd(data.length)] = rnd(256);
    try {
      readXls(data);
    } catch (error) {
      assert.ok(error instanceof SpreadsheetError, String(error));
    }
  }
});
