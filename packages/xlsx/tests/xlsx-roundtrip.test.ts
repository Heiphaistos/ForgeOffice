import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpcPackage } from '@forgeoffice/opc';
import {
  cellCount, createBlankWorkbook, expandSharedFormulas, getCell, readXlsx, setValue, translateA1Simple, writeXlsx,
  type ChartObject, type ImageObject, type ShapeObject, type Workbook,
} from '../src/index.ts';
import { richWorkbook, TINY_PNG } from './fixtures.ts';

async function roundTrip(wb: Workbook): Promise<Workbook> {
  return readXlsx(await writeXlsx(wb));
}

test('classeur vierge Office 2024 : Aptos Narrow 11, Feuil1, aller-retour', async () => {
  const wb = createBlankWorkbook();
  assert.equal(wb.sheets[0]?.name, 'Feuil1');
  assert.equal(wb.styles.fonts[0]?.name, 'Aptos Narrow');
  assert.equal(wb.styles.fonts[0]?.size, 11);
  assert.equal(wb.theme.minorFont.latin, 'Aptos Narrow');
  assert.equal(wb.theme.majorFont.latin, 'Aptos Display');
  const back = await roundTrip(wb);
  assert.equal(back.sheets.length, 1);
  assert.equal(back.sheets[0]?.name, 'Feuil1');
  assert.equal(back.styles.fonts[0]?.name, 'Aptos Narrow');
  assert.equal(back.theme.colors.accent1, '156082');
  assert.equal(back.date1904, false);
});

test('aller-retour complet : valeurs, formules, styles, texte enrichi', async () => {
  const back = await roundTrip(richWorkbook());
  const s = back.sheets[0];
  assert.ok(s);
  assert.equal(getCell(s, 0, 0)?.value, 'Produit');
  assert.equal(getCell(s, 1, 1)?.value, 1.5);
  assert.equal(getCell(s, 1, 3)?.formula, 'B2*C2');
  assert.equal(getCell(s, 6, 3)?.formula, 'SUM(D2:D5)');
  assert.equal(getCell(s, 7, 1)?.value, true);
  assert.deepEqual(getCell(s, 7, 2)?.value, { error: '#DIV/0!' });
  const rich = getCell(s, 8, 0);
  assert.equal(rich?.value, 'Texte enrichi');
  assert.equal(rich?.rich?.length, 2);
  assert.equal(rich?.rich?.[0]?.font?.bold, true);
  assert.equal(rich?.rich?.[1]?.font?.color?.rgb, 'FFC00000');
  assert.equal(getCell(s, 9, 0)?.value, 'Ligne 1\nLigne 2');
  const headerXf = back.styles.cellXfs[getCell(s, 0, 0)?.styleId ?? 0];
  assert.equal(back.styles.fonts[headerXf?.fontId ?? 0]?.bold, true);
  const fill = back.styles.fills[headerXf?.fillId ?? 0];
  assert.equal(fill?.type === 'pattern' ? fill.fg?.rgb : undefined, 'FF107C41');
  const moneyXf = back.styles.cellXfs[getCell(s, 1, 1)?.styleId ?? 0];
  assert.equal(back.styles.numFmts.find((f) => f.id === moneyXf?.numFmtId)?.code, '#,##0.00 "€"');
  assert.equal(back.styles.borders[moneyXf?.borderId ?? 0]?.bottom?.style, 'thin');
  const wrapXf = back.styles.cellXfs[getCell(s, 9, 0)?.styleId ?? 0];
  assert.equal(wrapXf?.alignment?.wrapText, true);
  assert.equal(wrapXf?.protection?.locked, false);
  assert.equal(getCell(s, 2, 5)?.formula, 'XLOOKUP("Kiwis",A2:A5,B2:B5)');
});

test('formules partagees et matricielles conservees puis developpees', async () => {
  const back = await roundTrip(richWorkbook());
  const s = back.sheets[0];
  assert.ok(s);
  const master = getCell(s, 1, 4);
  assert.equal(master?.shared?.index, 0);
  assert.deepEqual(master?.shared?.ref, { r1: 1, c1: 4, r2: 4, c2: 4 });
  assert.equal(getCell(s, 3, 4)?.formula, undefined);
  assert.equal(getCell(s, 1, 5)?.array?.ref.r1, 1);
  assert.equal(getCell(s, 1, 5)?.formula, 'SUM(B2:B5*C2:C5)');
  const count = expandSharedFormulas(back, translateA1Simple);
  assert.equal(count, 3);
  assert.equal(getCell(s, 3, 4)?.formula, 'B4*2');
  assert.equal(getCell(s, 4, 4)?.formula, 'B5*2');
  assert.equal(getCell(s, 1, 4)?.shared, undefined);
});

test('translation A1 : relatives, absolues, chaines, feuilles citees, #REF!', () => {
  assert.equal(translateA1Simple('A1+$B$2+B$3+$C4', 2, 1), 'B3+$B$2+C$3+$C6');
  assert.equal(translateA1Simple('"A1"&A1', 1, 0), '"A1"&A2');
  assert.equal(translateA1Simple("'Feuil 2'!A1*SUM(B1:B3)", 1, 1), "'Feuil 2'!B2*SUM(C2:C4)");
  assert.equal(translateA1Simple('A1', -1, 0), '#REF!');
  assert.equal(translateA1Simple('LOG10(A1)', 0, 1), 'LOG10(B1)');
});

test('lignes, colonnes, fusions, volets, zoom, onglet', async () => {
  const back = await roundTrip(richWorkbook());
  const s = back.sheets[0];
  assert.ok(s);
  assert.equal(s.cols.find((c) => c.min === 0)?.width, 18);
  assert.equal(s.cols.find((c) => c.min === 5)?.hidden, true);
  assert.equal(s.cols.find((c) => c.min === 5)?.max, 6);
  assert.equal(s.rows.get(9)?.height, 30);
  assert.equal(s.rows.get(2)?.outlineLevel, 1);
  assert.deepEqual(s.merges, [{ r1: 11, c1: 0, r2: 11, c2: 3 }]);
  assert.deepEqual(s.view.frozen, { rows: 1, cols: 1 });
  assert.equal(s.view.zoom, 120);
  assert.equal(s.tabColor?.rgb, 'FF107C41');
  assert.equal(s.view.tabSelected, true);
  assert.equal(back.sheets[2]?.state, 'hidden');
  assert.equal(back.sheets[2]?.view.tabSelected, undefined);
});

test('mises en forme conditionnelles : cellIs, echelle, barre etendue, icones, doublons, top10, expression', async () => {
  const back = await roundTrip(richWorkbook());
  const cfs = back.sheets[0]?.conditionalFormats ?? [];
  const rules = cfs.flatMap((c) => c.rules);
  assert.equal(rules.length, 7);
  const cellIs = rules.find((r) => r.type === 'cellIs');
  assert.equal(cellIs?.operator, 'greaterThan');
  assert.deepEqual(cellIs?.formulas, ['5']);
  assert.equal(cellIs?.dxfId, 0);
  const scale = rules.find((r) => r.type === 'colorScale');
  assert.equal(scale?.colorScale?.colors[1]?.rgb, 'FF63BE7B');
  const bar = rules.find((r) => r.type === 'dataBar');
  assert.equal(bar?.dataBar?.gradient, false);
  assert.equal(bar?.dataBar?.negativeColor?.rgb, 'FFFF0000');
  const icons = rules.find((r) => r.type === 'iconSet');
  assert.equal(icons?.iconSet?.iconSet, '3Arrows');
  assert.equal(icons?.iconSet?.cfvos.length, 3);
  assert.ok(rules.some((r) => r.type === 'duplicateValues'));
  assert.equal(rules.find((r) => r.type === 'top10')?.rank, 2);
  assert.deepEqual(rules.find((r) => r.type === 'expression')?.formulas, ['$C2>20']);
  assert.equal(back.styles.dxfs[0]?.font?.bold, true);
});

test('validations, liens, notes, commentaires de fil, protection', async () => {
  const back = await roundTrip(richWorkbook());
  const s = back.sheets[0];
  assert.ok(s);
  const list = s.dataValidations.find((d) => d.type === 'list');
  assert.equal(list?.formula1, '"Oui,Non"');
  assert.equal(list?.inCellDropdown, true);
  const whole = s.dataValidations.find((d) => d.type === 'whole');
  assert.equal(whole?.formula2, '1000');
  assert.equal(whole?.prompt, 'Entier');
  assert.equal(s.hyperlinks.find((h) => h.target)?.target, 'https://example.org/');
  assert.equal(s.hyperlinks.find((h) => h.location)?.location, 'Données!A1');
  assert.equal(s.notes.length, 1);
  assert.equal(s.notes[0]?.text, 'Prix TTC');
  assert.equal(s.notes[0]?.visible, true);
  assert.equal(s.threadedComments.length, 1);
  assert.equal(s.threadedComments[0]?.replies[0]?.text, 'OK');
  assert.equal(back.persons[0]?.displayName, 'Momo');
  const data = back.sheets[1];
  assert.equal(data?.protection?.sheet, true);
  assert.equal(data?.protection?.allow.formatCells, true);
  assert.equal(data?.protection?.allow.insertRows, false);
  assert.equal(back.protection?.lockStructure, true);
  assert.equal(s.protectedRanges[0]?.name, 'Saisie');
});

test('tableaux, filtres automatiques, noms definis, impression, sparklines', async () => {
  const back = await roundTrip(richWorkbook());
  const table = back.sheets[1]?.tables[0];
  assert.equal(table?.name, 'Ventes');
  assert.equal(table?.columns[1]?.totalsRowFunction, 'sum');
  assert.equal(table?.totalsRowCount, 1);
  assert.equal(table?.style?.name, 'TableStyleMedium2');
  assert.equal(table?.style?.showRowStripes, true);
  const filter = back.sheets[3]?.autoFilter;
  assert.deepEqual(filter?.ref, { r1: 0, c1: 0, r2: 3, c2: 1 });
  const column = filter?.columns[0];
  assert.equal(column?.filter?.kind, 'custom');
  assert.equal(column?.filter?.kind === 'custom' ? column.filter.conditions[0]?.operator : '', 'greaterThan');
  assert.equal(back.sheets[3]?.rows.get(2)?.hidden, true);
  assert.equal(back.definedNames.find((n) => n.name === 'TauxTVA')?.comment, 'Taux normal');
  assert.equal(back.definedNames.find((n) => n.name === 'Plage')?.formula, 'Feuil1!$A$1:$D$5');
  assert.ok(!back.definedNames.some((n) => n.name.startsWith('_xlnm.')));
  const setup = back.sheets[0]?.pageSetup;
  assert.equal(setup?.orientation, 'landscape');
  assert.equal(setup?.paperSize, 9);
  assert.equal(setup?.fitToPage, true);
  assert.equal(setup?.fitToHeight, 0);
  assert.deepEqual(setup?.printArea, [{ r1: 0, c1: 0, r2: 11, c2: 3 }]);
  assert.deepEqual(setup?.printTitleRows, { first: 0, last: 0 });
  assert.equal(setup?.headerFooter?.oddFooter, '&LPage &P sur &N&R&D');
  assert.deepEqual(setup?.rowBreaks, [20]);
  const group = back.sheets[0]?.sparklineGroups[0];
  assert.equal(group?.markers, true);
  assert.equal(group?.sparklines[0]?.source, 'Feuil1!B2:C2');
  assert.deepEqual(group?.sparklines[0]?.location, { row: 1, col: 7 });
});

test('dessins : image, forme, graphique combine, anneau', async () => {
  const back = await roundTrip(richWorkbook());
  const drawings = back.sheets[0]?.drawings ?? [];
  assert.equal(drawings.length, 4);
  const image = drawings.find((d): d is ImageObject => d.kind === 'image');
  assert.deepEqual(image?.data, TINY_PNG);
  assert.equal(image?.contentType, 'image/png');
  assert.equal(image?.description, 'Pixel rouge');
  assert.equal(image?.anchor.type, 'oneCell');
  const shape = drawings.find((d): d is ShapeObject => d.kind === 'shape');
  assert.equal(shape?.geometry, 'roundRect');
  assert.equal(shape?.text, 'Bonjour');
  assert.equal(shape?.fill?.color, 'FFF2CC');
  const charts = drawings.filter((d): d is ChartObject => d.kind === 'chart');
  const combo = charts[0]?.chart;
  assert.equal(combo?.plots.length, 2);
  assert.equal(combo?.plots[0]?.type, 'bar');
  assert.equal(combo?.plots[1]?.type, 'line');
  assert.equal(combo?.title?.text, 'Ventes');
  assert.equal(combo?.legend?.position, 'b');
  assert.equal(combo?.plots[0]?.series[0]?.values.ref, 'Feuil1!$D$2:$D$5');
  assert.deepEqual(combo?.plots[0]?.series[0]?.values.cache, [15, 9, 14, 20]);
  assert.deepEqual(combo?.plots[0]?.series[0]?.categories?.cache, ['Pommes', 'Poires', 'Cerises', 'Kiwis']);
  assert.equal(combo?.plots[0]?.series[0]?.name?.ref, 'Feuil1!$D$1');
  assert.equal(combo?.plots[0]?.series[0]?.color, '156082');
  assert.equal(combo?.axes.find((a) => a.id === 20)?.title?.text, 'Euros');
  assert.equal(combo?.axes.find((a) => a.id === 40)?.position, 'r');
  const doughnut = charts[1]?.chart;
  assert.equal(doughnut?.plots[0]?.type, 'doughnut');
  assert.equal(doughnut?.plots[0]?.holeSize, 50);
  assert.equal(doughnut?.plots[0]?.series[0]?.dataLabels?.showPercent, true);
});

test('proprietes du document et parties du paquet', async () => {
  const bytes = await writeXlsx(richWorkbook());
  const back = await readXlsx(bytes);
  assert.equal(back.properties.title, 'Démo');
  assert.equal(back.properties.company, 'Forge');
  assert.equal(back.properties.custom?.['Version'], 3);
  assert.equal(back.properties.custom?.['Valide'], true);
  const pkg = await OpcPackage.open(bytes);
  for (const part of ['xl/workbook.xml', 'xl/styles.xml', 'xl/theme/theme1.xml', 'xl/sharedstrings.xml', 'xl/charts/chart1.xml', 'xl/tables/table1.xml', 'xl/persons/person.xml']) {
    assert.ok(pkg.has(part), part);
  }
  assert.ok((await pkg.readText('xl/worksheets/sheet1.xml')).includes('_xlfn.XLOOKUP'));
});

test('xlsm : projet VBA conserve ; xltx : type de contenu modele', async () => {
  const wb = createBlankWorkbook();
  wb.vbaProject = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]);
  const back = await readXlsx(await writeXlsx(wb));
  assert.equal(back.sourceFormat, 'xlsm');
  assert.deepEqual(back.vbaProject, wb.vbaProject);
  const template = await readXlsx(await writeXlsx(createBlankWorkbook(), { format: 'xltx' }));
  assert.equal(template.sourceFormat, 'xltx');
});

test('systeme de dates 1904 et matrices dynamiques', async () => {
  const wb = createBlankWorkbook();
  wb.date1904 = true;
  const s = wb.sheets[0];
  assert.ok(s);
  s.cells.set(0, new Map([[0, { value: 1, formula: 'SEQUENCE(3)', array: { ref: { r1: 0, c1: 0, r2: 2, c2: 0 }, dynamic: true } }]]));
  const bytes = await writeXlsx(wb);
  const back = await readXlsx(bytes);
  assert.equal(back.date1904, true);
  assert.equal(getCell(back.sheets[0] ?? s, 0, 0)?.array?.dynamic, true);
  const pkg = await OpcPackage.open(bytes);
  assert.ok(pkg.has('xl/metadata.xml'));
});

test('cellules : limites, valeurs non finies, texte avec espaces et caracteres de controle', async () => {
  const wb = createBlankWorkbook();
  const s = wb.sheets[0];
  assert.ok(s);
  setValue(s, 0, 0, '  espaces  ');
  setValue(s, 0, 1, Number.NaN);
  setValue(s, 0, 2, 'a\u0001b');
  setValue(s, 1_048_575, 16_383, 'dernier');
  const back = (await roundTrip(wb)).sheets[0];
  assert.ok(back);
  assert.equal(getCell(back, 0, 0)?.value, '  espaces  ');
  assert.deepEqual(getCell(back, 0, 1)?.value, { error: '#NUM!' });
  assert.equal(getCell(back, 0, 2)?.value, 'ab');
  assert.equal(getCell(back, 1_048_575, 16_383)?.value, 'dernier');
  assert.equal(cellCount(back), 4);
});
