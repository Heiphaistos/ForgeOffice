// Ouverture d'un classeur .xlsx chiffre par Excel 365 (chiffrement agile) : mot de passe requis, faux, correct.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readWorkbook, detectFormat, iterateCells, SpreadsheetPasswordError } from '../src/index.ts';

const fichier = new Uint8Array(readFileSync(new URL('../../opc/tests/fixtures/excel-agile.xlsx', import.meta.url)));
const MOT_DE_PASSE = 'Forge2026!';

test('un classeur chiffre est detecte comme xlsx et non comme un ancien .xls', () => {
  assert.equal(detectFormat(fichier, 'budget.xlsx'), 'xlsx');
});

test('sans mot de passe : erreur « requis » que l\'interface sait traiter', async () => {
  await assert.rejects(readWorkbook(fichier, 'budget.xlsx'), (e: unknown) => e instanceof SpreadsheetPasswordError && e.reason === 'required');
});

test('mauvais mot de passe : erreur « incorrect »', async () => {
  await assert.rejects(readWorkbook(fichier, 'budget.xlsx', { password: 'pas-le-bon' }), (e: unknown) => e instanceof SpreadsheetPasswordError && e.reason === 'wrong');
});

test('bon mot de passe : le classeur s\'ouvre avec son contenu', async () => {
  const wb = await readWorkbook(fichier, 'budget.xlsx', { password: MOT_DE_PASSE });
  assert.equal(wb.sheets[0]?.name, 'Feuil1');
  const valeurs = [...iterateCells(wb.sheets[0]!)].map((c) => c.cell.value);
  assert.deepEqual(valeurs, ['chiffre', 42]);
});
