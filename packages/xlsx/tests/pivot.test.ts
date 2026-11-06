// Tableaux croises dynamiques persistants : lecture/ecriture OOXML, disposition identique a Excel, aller-retour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OpcPackage } from '@forgeoffice/opc';
import {
  addSheet, buildPivotCache, createBlankWorkbook, layoutPivot, parseRange, readXlsx, setValue, writeXlsx,
  type PivotCache, type PivotTable, type PivotValue, type Workbook,
} from '../src/index.ts';

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

/** Egalite structurelle des dispositions : ignore l'ordre des proprietes et les valeurs par defaut (0, absent). */
function norm(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).filter(([k, x]) => !((k === 'dataIndex' || k === 'repeat') && !x)).sort())
    : v));
}

function kindOf(t: PivotTable): 'compact' | 'outline' | 'tabular' {
  return t.attrs?.['compact'] === '0' ? (t.attrs?.['outline'] === '1' ? 'outline' : 'tabular') : 'compact';
}

test('lecture d un fichier Excel : cache (source, champs, 9 enregistrements) et tableaux', async () => {
  const wb = await readXlsx(fixture('excel-pivots.xlsx'));
  assert.equal(wb.pivotCaches?.length, 1);
  const cache = wb.pivotCaches?.[0];
  assert.ok(cache);
  assert.deepEqual(cache.source, { sheet: 'Donnees', ref: { r1: 0, c1: 0, r2: 9, c2: 4 } });
  assert.deepEqual(cache.fields.map((f) => f.name), ['Region', 'Produit', 'Mois', 'Ventes', 'Quantite']);
  assert.equal(cache.records.length, 9);
  assert.deepEqual(cache.records[0], ['Nord', 'Pomme', 'Jan', 100, 10]);
  assert.deepEqual(cache.records[5], ['Est', 'Poire', 'Fev', 70, 7]);
  const croise = wb.sheets.find((s) => s.name === 'Croise')?.pivotTables?.[0];
  assert.ok(croise);
  assert.equal(croise.name, 'TCD1');
  assert.deepEqual(croise.location, { r1: 2, c1: 0, r2: 7, c2: 3 });
  assert.deepEqual([croise.rowFields, croise.colFields], [[0], [1]]);
  assert.deepEqual(croise.pageFields, [{ field: 2 }]);
  assert.deepEqual(croise.dataFields.map((d) => [d.name, d.field, d.summary ?? 'sum']), [['Somme de Ventes', 3, 'sum']]);
  assert.deepEqual(croise.fields[0]?.items?.map((i) => i.value), ['Est', 'Nord', 'Sud']);
  const two = wb.sheets.find((s) => s.name === 'Croise2')?.pivotTables?.[0];
  assert.deepEqual(two?.colFields, [-2]);
  assert.deepEqual(two?.dataFields.map((d) => d.summary ?? 'sum'), ['sum', 'average']);
  assert.equal(wb.sheets.find((s) => s.name === 'Donnees')?.pivotTables, undefined);
});

test('dispositions d Excel (8 tableaux : compact, tabulaire, 3 niveaux, valeurs multiples, sous-totaux, sans totaux) reproduites a l identique', async () => {
  const wb = await readXlsx(fixture('excel-pivots-layouts.xlsx'));
  const cache = wb.pivotCaches?.[0];
  assert.ok(cache);
  let checked = 0;
  for (const sheet of wb.sheets) {
    for (const table of sheet.pivotTables ?? []) {
      const layout = layoutPivot(cache, table, kindOf(table));
      assert.equal(norm(layout.rowItems), norm(table.rowItems), `${table.name} : lignes`);
      assert.equal(norm(layout.colItems), norm(table.colItems), `${table.name} : colonnes`);
      const loc = table.locationAttrs ?? {};
      assert.deepEqual(
        [layout.firstHeaderRow, layout.firstDataRow, layout.firstDataCol],
        [Number(loc['firstHeaderRow']), Number(loc['firstDataRow']), Number(loc['firstDataCol'])],
        `${table.name} : position`,
      );
      assert.equal(table.location.c2 - table.location.c1 + 1, layout.firstDataCol + layout.colItems.length, `${table.name} : largeur`);
      assert.equal(table.location.r2 - table.location.r1 + 1, layout.firstDataRow + layout.rowItems.length, `${table.name} : hauteur`);
      checked++;
    }
  }
  assert.equal(checked, 8);
});

test('aller-retour d un fichier Excel : rien n est perdu (cache, champs, dispositions, formats conserves)', async () => {
  for (const name of ['excel-pivots.xlsx', 'excel-pivots-layouts.xlsx']) {
    const first = await readXlsx(fixture(name));
    const second = await readXlsx(await writeXlsx(first));
    assert.deepEqual(second.pivotCaches, first.pivotCaches, name);
    for (const sheet of first.sheets) {
      const other = second.sheets.find((s) => s.name === sheet.name);
      assert.equal(norm(other?.pivotTables), norm(sheet.pivotTables), `${name} / ${sheet.name}`);
    }
  }
});

function sourceWorkbook(): Workbook {
  const wb = createBlankWorkbook();
  const data = wb.sheets[0]!;
  data.name = 'Donnees';
  const rows: (string | number | boolean | null)[][] = [
    ['Region', 'Produit', 'Ventes', 'Remise', 'Actif'],
    ['Nord', 'Pomme', 100, 0.5, true],
    ['Sud', 'Poire', 80, null, false],
    ['Nord', 'Poire', 60, 0.25, true],
    ['Est', 'Pomme', 40, null, true],
    ['Sud', 'Pomme', 20, 1, false],
  ];
  rows.forEach((r, i) => r.forEach((v, j) => v !== null && setValue(data, i, j, v)));
  return wb;
}

test('classeur neuf : parties, relations, types de contenu et ordre des elements du classeur', async () => {
  const wb = sourceWorkbook();
  const cache = buildPivotCache(wb, wb.sheets[0]!, parseRange('A1:E6')!, 3);
  wb.pivotCaches = [cache];
  const sheet = addSheet(wb, 'Croise');
  sheet.pivotTables = [{
    name: 'TCD1', cacheId: 3, location: { r1: 0, c1: 0, r2: 0, c2: 0 }, fields: [{ axis: 'row' }, { axis: 'col' }, {}, {}, {}],
    rowFields: [0], colFields: [1], pageFields: [], dataFields: [{ name: 'Somme de Ventes', field: 2, numFmt: '0.000" kg"' }],
  }];
  const bytes = await writeXlsx(wb);
  const pkg = await OpcPackage.open(bytes);
  for (const part of ['xl/pivotCache/pivotCacheDefinition1.xml', 'xl/pivotCache/pivotCacheRecords1.xml', 'xl/pivotTables/pivotTable1.xml']) assert.ok(pkg.has(part), part);
  const types = await pkg.readText('[Content_Types].xml');
  assert.match(types, /PartName="\/xl\/pivotTables\/pivotTable1\.xml" ContentType="[^"]*spreadsheetml\.pivotTable\+xml"/);
  assert.match(types, /pivotCacheDefinition\+xml/);
  assert.match(types, /pivotCacheRecords\+xml/);
  const workbookXml = await pkg.readText('xl/workbook.xml');
  const order = ['<sheets>', '<calcPr', '<pivotCaches>', '<extLst>'].map((tag) => workbookXml.indexOf(tag));
  assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > (order[i - 1] ?? 0))), `ordre ${order.join(',')}`);
  assert.match(workbookXml, /<pivotCache cacheId="3" r:id="rId\d+"\/>/);
  const rels = await pkg.readText('xl/pivotTables/_rels/pivotTable1.xml.rels');
  assert.match(rels, /pivotCacheDefinition1\.xml/);
  const back = await readXlsx(bytes);
  assert.equal(back.pivotCaches?.[0]?.id, 3);
  const table = back.sheets.find((s) => s.name === 'Croise')?.pivotTables?.[0];
  assert.equal(table?.dataFields[0]?.name, 'Somme de Ventes');
  assert.equal(back.styles.numFmts.find((f) => f.id === table?.dataFields[0]?.numFmtId)?.code, '0.000" kg"');
  // 1 colonne d etiquettes + 2 produits + total ; 2 lignes d en-tete + 3 regions + total
  assert.deepEqual(table?.location, { r1: 0, c1: 0, r2: 5, c2: 3 });
});

test('cache : nombres libres, vides, texte, booleens, erreurs et dates restent intacts apres aller-retour', async () => {
  const records: PivotValue[][] = [
    ['a', 1, null, true, { error: '#DIV/0!' }, { date: '2020-01-15T00:00:00' }],
    ['b', 2.5, 7, false, { error: '#N/A' }, { date: '2021-06-01T00:00:00' }],
    ['a', -3, 'x', true, null, null],
    [null, 0, 8, false, { error: '#DIV/0!' }, { date: '2020-01-15T00:00:00' }],
  ];
  const cache: PivotCache = {
    id: 1, source: { name: 'Tableau1' }, records,
    fields: ['Texte', 'Nombre', 'Mixte', 'Bool', 'Erreur', 'Date'].map((name) => ({ name })),
  };
  const wb = createBlankWorkbook();
  wb.pivotCaches = [cache];
  const sheet = addSheet(wb, 'T');
  sheet.pivotTables = [{
    name: 'T1', cacheId: 1, location: { r1: 0, c1: 0, r2: 0, c2: 0 }, fields: [{ axis: 'row' }, {}, {}, {}, {}, {}],
    rowFields: [0], colFields: [], pageFields: [], dataFields: [{ name: 'N', field: 1, summary: 'max' }],
  }];
  const bytes = await writeXlsx(wb);
  const def = await (await OpcPackage.open(bytes)).readText('xl/pivotCache/pivotCacheDefinition1.xml');
  assert.match(def, /<worksheetSource name="Tableau1"\/>/);
  assert.match(def, /name="Nombre" numFmtId="0"><sharedItems containsSemiMixedTypes="0" containsString="0" containsNumber="1" minValue="-3" maxValue="2.5"\/>/);
  assert.match(def, /containsDate="1"/);
  const back = await readXlsx(bytes);
  assert.deepEqual(back.pivotCaches?.[0]?.records, records);
  assert.equal(back.sheets.find((s) => s.name === 'T')?.pivotTables?.[0]?.dataFields[0]?.summary, 'max');
});

test('elements masques, selection de filtre, champs invalides et tableaux orphelins', async () => {
  const wb = sourceWorkbook();
  wb.pivotCaches = [buildPivotCache(wb, wb.sheets[0]!, parseRange('A1:E6')!, 1)];
  const sheet = addSheet(wb, 'T');
  sheet.pivotTables = [
    {
      name: 'Filtre', cacheId: 1, location: { r1: 3, c1: 0, r2: 3, c2: 0 },
      fields: [{ axis: 'row', items: [{ value: 'Sud' }, { value: 'Nord', hidden: true }, { value: 'Est', caption: 'Orient' }] }, { axis: 'page' }, {}, {}, {}],
      rowFields: [0], colFields: [], pageFields: [{ field: 1, selected: 'Poire' }], dataFields: [{ name: 'S', field: 2 }, { name: 'Hors', field: 99 }],
    },
    { name: 'Orphelin', cacheId: 42, location: { r1: 20, c1: 0, r2: 20, c2: 0 }, fields: [], rowFields: [0], colFields: [], pageFields: [], dataFields: [] },
    { name: 'Filtre', cacheId: 1, location: { r1: 30, c1: 0, r2: 30, c2: 0 }, fields: [], rowFields: [77], colFields: [], pageFields: [], dataFields: [] },
  ];
  const back = await readXlsx(await writeXlsx(wb));
  const tables = back.sheets.find((s) => s.name === 'T')?.pivotTables ?? [];
  assert.equal(tables.length, 1);
  const t = tables[0]!;
  assert.deepEqual(t.fields[0]?.items?.map((i) => [i.value, i.hidden ?? false, i.caption]), [['Sud', false, undefined], ['Nord', true, undefined], ['Est', false, 'Orient']]);
  assert.deepEqual(t.pageFields, [{ field: 1, selected: 'Poire' }]);
  assert.equal(t.dataFields.length, 1);
  // Poire seulement : Sud (80) ; Nord masque ; Est/Pomme exclu -> une region + total, 1 ligne d en-tete
  assert.equal(t.location.r2 - t.location.r1 + 1, 1 + 2);
});

test('cache de 100 000 enregistrements : ecriture + relecture en moins de 4 s', async () => {
  const wb = createBlankWorkbook();
  const records: PivotValue[][] = Array.from({ length: 100_000 }, (_, i) => [`R${i % 50}`, `P${i % 7}`, i, (i % 13) / 4]);
  wb.pivotCaches = [{ id: 1, source: { name: 'T' }, fields: ['A', 'B', 'C', 'D'].map((name) => ({ name })), records }];
  const sheet = addSheet(wb, 'T');
  sheet.pivotTables = [{
    name: 'P', cacheId: 1, location: { r1: 0, c1: 0, r2: 0, c2: 0 }, fields: [{ axis: 'row' }, { axis: 'col' }, {}, {}],
    rowFields: [0], colFields: [1], pageFields: [], dataFields: [{ name: 'S', field: 2 }],
  }];
  const t0 = performance.now();
  const bytes = await writeXlsx(wb);
  const back = await readXlsx(bytes);
  const ms = performance.now() - t0;
  assert.equal(back.pivotCaches?.[0]?.records.length, 100_000);
  assert.ok(ms < 4000, `${ms.toFixed(0)} ms`);
});
