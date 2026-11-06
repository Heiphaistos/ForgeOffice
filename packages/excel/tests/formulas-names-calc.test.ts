// Noms definis (validation, gestionnaire, filtres, recentes) et options de calcul liees au classeur.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBlankWorkbook, readWorkbook, writeWorkbook, type Workbook } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { WorkbookEngine } from '../src/logic/engine.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { engineSettings, iterationError, iterationOf, withCalcMode, withIteration } from '../src/logic/formulas/calc.ts';
import { filterNameRows, functionsIn, looksLikeCellRef, nameError, nameRows, pushRecent, valueSummary } from '../src/logic/formulas/names.ts';

function put(d: Draft, row: number, col: number, text: string): void {
  const e = parseEntry(text);
  assert.ok(e.ok, text);
  commitEntry(d, 0, row, col, e);
}

test('validation des noms (regles d Excel)', () => {
  const names = [{ name: 'Taux', formula: 'Feuil1!$A$1' }, { name: 'Local', formula: 'Feuil1!$A$2', localSheet: 0 }];
  assert.equal(nameError('', names, undefined), 'empty');
  assert.equal(nameError('1abc', names, undefined), 'invalid');
  assert.equal(nameError('mon nom', names, undefined), 'invalid');
  assert.equal(nameError('A1', names, undefined), 'cellRef');
  assert.equal(nameError('xfd1048576', names, undefined), 'cellRef');
  assert.equal(nameError('XFE1', names, undefined), null);
  assert.equal(nameError('R2C3', names, undefined), 'cellRef');
  assert.equal(nameError('R', names, undefined), 'cellRef');
  assert.equal(nameError('taux', names, undefined), 'duplicate');
  assert.equal(nameError('taux', names, 0), null, 'meme nom dans une autre etendue');
  assert.equal(nameError('Taux', names, undefined, 0), null, 'on peut garder son propre nom en modifiant');
  assert.equal(nameError('_ok.nom', names, undefined), null);
  assert.equal(nameError('x'.repeat(256), names, undefined), 'tooLong');
  assert.equal(looksLikeCellRef('Total'), false);
});

test('lignes du gestionnaire : valeur, commentaire, erreurs, tableaux, filtres', () => {
  const d = new Draft(createBlankWorkbook());
  put(d, 0, 0, '5');
  put(d, 1, 0, '7');
  d.wb.definedNames = [
    { name: 'Taux', formula: 'Feuil1!$A$1', comment: 'taux de TVA' },
    { name: 'Plage', formula: 'Feuil1!$A$1:$A$2' },
    { name: 'Casse', formula: 'Feuil1!#REF!' },
    { name: 'Local', formula: 'Feuil1!$A$2', localSheet: 0 },
    { name: '_xlnm.Print_Area', formula: 'Feuil1!$A$1:$B$2', localSheet: 0 },
  ];
  const eng = new WorkbookEngine();
  eng.sync(d.wb);
  const rows = nameRows(d.wb, (f, sheet) => eng.engine.evaluate(f, sheet));
  assert.equal(rows.length, 4, 'les noms internes sont masques');
  const taux = rows.find((r) => r.name === 'Taux');
  assert.equal(taux?.value, '5');
  assert.equal(taux?.comment, 'taux de TVA');
  assert.equal(taux?.refersTo, '=Feuil1!$A$1');
  assert.equal(rows.find((r) => r.name === 'Plage')?.value, '{5;7}');
  assert.equal(rows.find((r) => r.name === 'Casse')?.hasError, true);
  assert.deepEqual(filterNameRows(rows, 'errors', 0).map((r) => r.name), ['Casse']);
  assert.deepEqual(filterNameRows(rows, 'sheet', 0).map((r) => r.name), ['Local']);
  assert.equal(filterNameRows(rows, 'workbook', 0).length, 3);
  assert.equal(filterNameRows(rows, 'noErrors', 0).length, 3);
  assert.equal(valueSummary('a'), '"a"');
  assert.equal(valueSummary(true), 'VRAI');
});

test('le commentaire d un nom survit a l enregistrement xlsx', async () => {
  const d = new Draft(createBlankWorkbook());
  d.wb.definedNames = [{ name: 'Taux', formula: 'Feuil1!$A$1', comment: 'taux de TVA' }];
  const bytes = await writeWorkbook(d.wb, 'xlsx');
  const back = await readWorkbook(bytes);
  assert.equal(back.definedNames.find((n) => n.name === 'Taux')?.comment, 'taux de TVA');
});

test('fonctions recentes : la derniere en tete, sans doublon, dix au plus', () => {
  let list: string[] = [];
  for (const n of ['somme', 'moyenne', 'SOMME', 'si', 'max', 'min', 'nb', 'nbval', 'recherchev', 'texte', 'gauche', 'droite']) list = pushRecent(list, n);
  assert.equal(list[0], 'DROITE');
  assert.equal(list.length, 10);
  assert.equal(list.filter((n) => n === 'SOMME').length <= 1, true);
  assert.deepEqual(functionsIn('=SI(A1>0;SOMME(B1:B3);"MAX(1)")'), ['SI', 'SOMME']);
});

test('options de calcul : mode, iteration, validation', () => {
  const c = createBlankWorkbook().calc;
  assert.equal(engineSettings(c).iterative, false);
  assert.equal(engineSettings(withCalcMode(c, 'manual')).mode, 'manual');
  assert.equal(withCalcMode(c, 'auto'), c, 'identique : meme objet');
  const it = withIteration(c, { enabled: true, count: 50, delta: 0.01 });
  assert.deepEqual(iterationOf(it), { enabled: true, count: 50, delta: 0.01 });
  assert.equal(engineSettings(it).maxIterations, 50);
  assert.equal(iterationError({ enabled: true, count: 0, delta: 1 }), 'count');
  assert.equal(iterationError({ enabled: true, count: 100.5, delta: 1 }), 'count');
  assert.equal(iterationError({ enabled: true, count: 100, delta: -1 }), 'delta');
  assert.equal(iterationError({ enabled: true, count: 100, delta: 0.001 }), null);
});

test('le classeur pilote le moteur : manuel, iteratif, retour en automatique', () => {
  const d = new Draft(createBlankWorkbook());
  put(d, 0, 0, '1');
  put(d, 0, 1, '=A1*2');
  const eng = new WorkbookEngine();
  eng.sync(d.wb);
  assert.equal(eng.value('Feuil1', 0, 1), 2);
  // Passage en manuel (nouvel etat du classeur, comme store.commit).
  const manual = new Draft(d.wb);
  manual.wb.calc = withCalcMode(manual.wb.calc, 'manual');
  eng.sync(manual.wb);
  const edit = new Draft(manual.wb);
  put(edit, 0, 0, '10');
  eng.sync(edit.wb);
  assert.equal(eng.value('Feuil1', 0, 1), 2, 'B1 attend le calcul');
  assert.equal(eng.engine.pendingCalculation, true);
  eng.engine.recalculate();
  assert.equal(eng.value('Feuil1', 0, 1), 20);
  // Retour en automatique.
  const auto = new Draft(edit.wb);
  auto.wb.calc = withCalcMode(auto.wb.calc, 'auto');
  eng.sync(auto.wb);
  const again = new Draft(auto.wb);
  put(again, 0, 0, '3');
  eng.sync(again.wb);
  assert.equal(eng.value('Feuil1', 0, 1), 6);
  // Iteratif : B2 = A2 + B2 / 2 converge vers 2 * A2.
  const circ = new Draft(again.wb);
  put(circ, 1, 0, '4');
  put(circ, 1, 1, '=A2+B2/2');
  circ.wb.calc = withIteration(circ.wb.calc, { enabled: true, count: 200, delta: 1e-9 });
  eng.sync(circ.wb);
  assert.ok(Math.abs(Number(eng.value('Feuil1', 1, 1)) - 8) < 1e-4);
});

test('options de calcul enregistrees dans le fichier', async () => {
  const wb: Workbook = createBlankWorkbook();
  wb.calc = withIteration(withCalcMode(wb.calc, 'manual'), { enabled: true, count: 50, delta: 0.01 });
  const back = await readWorkbook(await writeWorkbook(wb, 'xlsx'));
  assert.equal(back.calc.mode, 'manual');
  assert.equal(back.calc.iterate, true);
  assert.equal(back.calc.iterateCount, 50);
  assert.equal(back.calc.iterateDelta, 0.01);
});

test('renommer un nom reecrit les formules qui l utilisent', async () => {
  const { renameNameInWorkbook } = await import('../src/logic/formulas/ast.ts');
  const d = new Draft(createBlankWorkbook());
  put(d, 0, 0, '=marge*2+SOMME(marge;1)');
  put(d, 1, 0, '=A1+margee');
  d.wb.definedNames = [{ name: 'Marge', formula: 'Feuil1!$B$1' }, { name: 'Double', formula: 'Marge*2' }];
  renameNameInWorkbook(d.wb, 'Marge', 'Remise');
  assert.equal(d.wb.sheets[0]?.cells.get(0)?.get(0)?.formula, 'Remise*2+SUM(Remise,1)');
  assert.equal(d.wb.sheets[0]?.cells.get(1)?.get(0)?.formula, 'A1+margee', 'un autre nom commencant pareil reste intact');
  assert.equal(d.wb.definedNames.find((n) => n.name === 'Double')?.formula, 'Remise*2');
});
