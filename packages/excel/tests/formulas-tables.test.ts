// Tableaux structures : references [@Colonne], extension automatique, colonnes calculees et leur controle.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBlankWorkbook, type Table, type Workbook } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { WorkbookEngine } from '../src/logic/engine.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { makeTable } from '../src/logic/tables.ts';
import { afterEntry, toStructured } from '../src/logic/formulas/table-auto.ts';
import { DEFAULT_ERROR_RULES, checkCell } from '../src/logic/formulas/errors.ts';

/** Tableau « Tableau1 » A1:C4 : Produit, Ventes, Taux. */
function base(): Draft {
  const d = new Draft(createBlankWorkbook());
  [['Produit', 'Ventes', 'Taux'], ['a', '10', '2'], ['b', '20', '3'], ['c', '30', '4']].forEach((l, r) => l.forEach((t, c) => {
    const e = parseEntry(t);
    if (e.ok) commitEntry(d, 0, r, c, e);
  }));
  const t = makeTable(d.wb, { r1: 0, c1: 0, r2: 3, c2: 2 }, true, 'TableStyleMedium2', () => null, (i) => `Colonne${i}`);
  d.sheet(0).tables = [{ ...t, columns: [{ id: 1, name: 'Produit' }, { id: 2, name: 'Ventes' }, { id: 3, name: 'Taux' }] }];
  return d;
}

function type(d: Draft, row: number, col: number, text: string): void {
  const e = parseEntry(text);
  assert.ok(e.ok, text);
  commitEntry(d, 0, row, col, e);
  afterEntry(d, 0, row, col, e);
}

const table = (wb: Workbook): Table => {
  const t = wb.sheets[0]?.tables[0];
  assert.ok(t);
  return t;
};

function value(wb: Workbook, row: number, col: number): unknown {
  const e = new WorkbookEngine();
  e.sync(wb);
  return e.value('Feuil1', row, col);
}

test('references structurees saisies en francais', () => {
  const d = base();
  type(d, 6, 5, '=SOMME(Tableau1[Ventes])');
  type(d, 7, 5, '=SOMME(Tableau1[[Ventes]:[Taux]])');
  type(d, 8, 5, '=NB(Tableau1[#Données])');
  assert.equal(value(d.wb, 6, 5), 60);
  assert.equal(value(d.wb, 7, 5), 69);
  assert.equal(value(d.wb, 8, 5), 6, 'six nombres (les textes ne comptent pas)');
});

test('colonne calculee : la formule saisie dans une colonne vide se recopie', () => {
  const d = base();
  type(d, 1, 2, '=B2*2'); // colonne Taux deja remplie : pas de colonne calculee
  assert.equal(table(d.wb).columns[2]?.calculatedFormula, undefined);
  const e = base();
  // Colonne supplementaire vide : on l'ajoute en tapant son en-tete a droite.
  type(e, 0, 3, 'Total');
  assert.equal(table(e.wb).ref.c2, 3, 'en-tete a droite = nouvelle colonne');
  assert.equal(table(e.wb).columns[3]?.name, 'Total');
  type(e, 1, 3, '=B2*C2');
  assert.equal(table(e.wb).columns[3]?.calculatedFormula, '[@Ventes]*[@Taux]');
  assert.equal(e.wb.sheets[0]?.cells.get(2)?.get(3)?.formula, 'B3*C3');
  assert.equal(e.wb.sheets[0]?.cells.get(3)?.get(3)?.formula, 'B4*C4');
  assert.equal(value(e.wb, 1, 3), 20);
  assert.equal(value(e.wb, 3, 3), 120);
});

test('modifier une cellule d une colonne calculee met a jour toute la colonne', () => {
  const d = base();
  type(d, 0, 3, 'Total');
  type(d, 1, 3, '=B2*C2');
  type(d, 2, 3, '=B3+C3');
  assert.equal(table(d.wb).columns[3]?.calculatedFormula, '[@Ventes]+[@Taux]');
  assert.equal(d.wb.sheets[0]?.cells.get(1)?.get(3)?.formula, 'B2+C2');
  assert.equal(d.wb.sheets[0]?.cells.get(3)?.get(3)?.formula, 'B4+C4');
});

test('extension automatique en tapant sous le tableau', () => {
  const d = base();
  type(d, 0, 3, 'Total');
  type(d, 1, 3, '=B2*C2');
  type(d, 4, 0, 'd');
  assert.equal(table(d.wb).ref.r2, 4);
  assert.equal(table(d.wb).autoFilter?.ref.r2, 4);
  assert.equal(d.wb.sheets[0]?.cells.get(4)?.get(3)?.formula, 'B5*C5', 'colonne calculee recopiee sur la nouvelle ligne');
  type(d, 5, 5, 'x');
  assert.equal(table(d.wb).ref.r2, 4, 'une saisie hors de la colonne du tableau ne l etend pas');
});

test('pas d extension sous une ligne de total', () => {
  const d = base();
  const t = table(d.wb);
  d.sheet(0).tables = [{ ...t, ref: { ...t.ref, r2: 4 }, totalsRowShown: true, totalsRowCount: 1 }];
  type(d, 5, 0, 'z');
  assert.equal(table(d.wb).ref.r2, 4);
});

test('le controle des erreurs reconnait la colonne calculee et ses exceptions', () => {
  const d = base();
  type(d, 0, 3, 'Total');
  type(d, 1, 3, '=B2*C2');
  const sheet = d.wb.sheets[0];
  assert.ok(sheet);
  const env = { sheet, value: () => 0, isLocked: () => true, rules: DEFAULT_ERROR_RULES };
  assert.equal(checkCell(env, 2, 3), null, 'B3*C3 est la meme formule que [@Ventes]*[@Taux]');
  d.set(0, 2, 3, { value: null, formula: 'B3+C3' });
  const env2 = { ...env, sheet: d.wb.sheets[0] ?? sheet };
  assert.equal(checkCell(env2, 2, 3)?.rule, 'columnInconsistent');
});

test('toStructured ne touche que la ligne du tableau', () => {
  const d = base();
  const t = table(d.wb);
  assert.equal(toStructured('B2*C2+B3', t, 1), '[@Ventes]*[@Taux]+B3');
  assert.equal(toStructured('SUM(B2:B4)', t, 1), 'SUM(B2:B4)');
});

test('saisie semi-automatique : noms, tableaux, colonnes et elements speciaux', async () => {
  const { completionSource, nameCompletions, columnContext, columnCompletions } = await import('../src/logic/formulas/completion.ts');
  const d = base();
  d.wb.definedNames = [{ name: 'Marge', formula: 'Feuil1!$A$1', comment: 'taux' }, { name: 'Local', formula: 'Feuil1!$A$2', localSheet: 3 }, { name: '_xlnm.Print_Area', formula: 'Feuil1!$A$1' }];
  const src = completionSource(d.wb, 0);
  assert.deepEqual(src.names.map((n) => n.text), ['Marge', 'Tableau1'], 'noms d une autre feuille et noms internes exclus');
  assert.deepEqual(nameCompletions('mar', src).map((n) => n.text), ['Marge']);
  assert.deepEqual(nameCompletions('TAB', src).map((n) => n.kind), ['table']);
  assert.deepEqual(nameCompletions('Marge', src), [], 'mot deja complet');
  assert.deepEqual(columnContext('=SOMME(Tableau1[Ve', 18), { table: 'Tableau1', start: 16, prefix: 'Ve' });
  assert.deepEqual(columnContext('=Tableau1[[', 11), { table: 'Tableau1', start: 11, prefix: '' });
  assert.equal(columnContext('=A1+B2', 6), null);
  assert.deepEqual(columnCompletions('tableau1', 've', src).map((c) => c.text), ['Ventes']);
  assert.deepEqual(columnCompletions('Tableau1', '', src).map((c) => c.text).slice(0, 3), ['Produit', 'Ventes', 'Taux']);
  assert.ok(columnCompletions('Tableau1', '#', src).some((c) => c.text === '#Données'));
  assert.deepEqual(columnCompletions('Inconnu', '', src), []);
});
