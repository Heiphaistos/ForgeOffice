import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook, type Workbook } from '@forgeoffice/xlsx';
import type { Scalar } from '@forgeoffice/formulas';
import { Draft } from '../src/logic/draft.ts';
import { WorkbookEngine } from '../src/logic/engine.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { directoryOf, osVersionOf, type HostState } from '../src/logic/host.ts';
import { computePivot, type PivotDef, type PivotLabels } from '../src/logic/pivot.ts';
import { pivotAtCell, pivotLookup, type PivotSnapshot } from '../src/logic/pivot-lookup.ts';
import { deleteSheet } from '../src/logic/structure.ts';
import { createSheet } from '@forgeoffice/xlsx';

const L: PivotLabels = {
  rowLabels: 'Étiquettes de lignes', colLabels: 'Étiquettes de colonnes', grandTotal: 'Total général', blank: '(vide)', all: '(Tous)', values: 'Valeurs',
  valueName: (fn, f) => `${fn === 'sum' ? 'Somme' : fn} de ${f}`,
};

function put(wb: Workbook, entries: Record<string, string>): Workbook {
  const d = new Draft(wb);
  for (const [addr, text] of Object.entries(entries)) {
    const m = addr.match(/^([A-Z]+)(\d+)$/);
    const e = parseEntry(text);
    if (!m || !e.ok) throw new Error(addr);
    commitEntry(d, 0, Number(m[2]) - 1, (m[1] ?? 'A').charCodeAt(0) - 65, e);
  }
  return d.wb;
}

const state = (fileName: string, pivots: readonly PivotSnapshot[] = []): HostState => ({ fileName, pivots: () => pivots, labels: L });

test('hote du moteur : CELLULE (nom de fichier, largeur) et INFORMATIONS (dossier, systeme)', () => {
  const wb = put(createBlankWorkbook(), { B1: '=CELLULE("nomfichier";A1)', B2: '=CELLULE("largeur";A1)', B3: '=INFORMATIONS("repertoire")', B4: '=CELLULE("protege";A1)' });
  const eng = new WorkbookEngine(false, state('C:\\Docs\\Classeur.xlsx'));
  eng.sync(wb);
  assert.equal(eng.value('Feuil1', 0, 1), 'C:\\Docs\\[Classeur.xlsx]Feuil1');
  assert.equal(eng.value('Feuil1', 1, 1), 8, 'largeur par defaut (8,43 arrondie a 8) : comme Excel');
  assert.equal(eng.value('Feuil1', 2, 1), 'C:\\Docs');
  assert.equal(eng.value('Feuil1', 3, 1), 1, 'cellule verrouillee par defaut');
  const bare = new WorkbookEngine();
  bare.sync(wb);
  assert.equal(bare.value('Feuil1', 2, 1), '', 'sans hote : comportement d avant');
});

test('hote : dossier et systeme', () => {
  assert.equal(directoryOf('C:\\a\\b\\c.xlsx'), 'C:\\a\\b');
  assert.equal(directoryOf('/home/u/c.xlsx'), '/home/u');
  assert.equal(directoryOf('c.xlsx'), '');
  assert.equal(osVersionOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'Windows (64-bit) NT 10.00');
  assert.equal(osVersionOf(undefined), undefined);
});

test('LIREDONNEESTABCROISDYNAMIQUE : valeur par elements de ligne et de colonne, totaux generaux', () => {
  const data: Scalar[][] = [['Region', 'Produit', 'Ventes'], ['Nord', 'A', 10], ['Nord', 'B', 5], ['Sud', 'A', 7], ['Sud', 'A', 3], ['Sud', 'B', 1]];
  const def: PivotDef = { sourceSheet: 'Feuil1', source: { r1: 0, c1: 0, r2: 5, c2: 2 }, rows: [0], cols: [1], values: [{ field: 2, fn: 'sum' }], filters: [] };
  const res = computePivot(def, data, (v) => String(v), L);
  const snap: PivotSnapshot = { sheet: 'Pivot', area: { r1: 0, c1: 0, r2: res.cells.length - 1, c2: 5 }, def, fields: res.fields, cells: res.cells };
  const get = (field: string, items: [string, Scalar][]): Scalar | undefined => pivotLookup(snap, L, field, items);
  assert.equal(get('Ventes', [['Region', 'Sud'], ['Produit', 'A']]), 10);
  assert.equal(get('Somme de Ventes', [['Region', 'Nord'], ['Produit', 'B']]), 5);
  assert.equal(get('Ventes', [['Region', 'Sud']]), 11, 'total de la ligne Sud');
  assert.equal(get('Ventes', [['Produit', 'A']]), 20, 'total de la colonne A');
  assert.equal(get('Ventes', []), 26, 'total general');
  assert.equal(get('Ventes', [['Region', 'Est']]), undefined, 'element inconnu');
  assert.equal(get('Marge', []), undefined, 'champ de donnees inconnu');
  assert.equal(pivotAtCell([snap], 'Pivot', 2, 1), snap);
  assert.equal(pivotAtCell([snap], 'Autre', 2, 1), undefined);
});

test('hote : LIREDONNEESTABCROISDYNAMIQUE passe par le tableau croise de l interface', () => {
  const data: Scalar[][] = [['Region', 'Ventes'], ['Nord', 10], ['Sud', 7], ['Sud', 3]];
  const def: PivotDef = { sourceSheet: 'Feuil1', source: { r1: 0, c1: 0, r2: 3, c2: 1 }, rows: [0], cols: [], values: [{ field: 1, fn: 'sum' }], filters: [] };
  const res = computePivot(def, data, (v) => String(v), L);
  const snap: PivotSnapshot = { sheet: 'Feuil1', area: { r1: 5, c1: 3, r2: 5 + res.cells.length - 1, c2: 4 }, def, fields: res.fields, cells: res.cells };
  const wb = put(createBlankWorkbook(), { D6: 'x', A1: '=LIREDONNEESTABCROISDYNAMIQUE("Ventes";D6;"Region";"Sud")', A2: '=LIREDONNEESTABCROISDYNAMIQUE("Ventes";D6)' });
  const eng = new WorkbookEngine(false, state('', [snap]));
  eng.sync(wb);
  assert.equal(eng.value('Feuil1', 0, 0), 10);
  assert.equal(eng.value('Feuil1', 1, 0), 20);
});

test('suppression d une feuille : une reference 3D se raccourcit selon l ordre des onglets', () => {
  let wb = createBlankWorkbook();
  const d = new Draft(wb);
  for (const n of ['Feuil2', 'Feuil3']) d.wb.sheets.push(createSheet(n));
  wb = put(d.wb, { A1: '=SOMME(Feuil1:Feuil3!A1)' });
  const e = new Draft(wb);
  deleteSheet(e, 2);
  assert.equal(e.wb.sheets[0]?.cells.get(0)?.get(0)?.formula, 'SUM(Feuil1:Feuil2!A1)', 'Feuil1:Feuil3 sans Feuil3 -> Feuil1:Feuil2');
});
