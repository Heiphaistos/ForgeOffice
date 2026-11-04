// Classeur de demonstration couvrant toutes les fonctions du modele (tests et verification dans Excel).
import {
  addSheet, createBlankWorkbook, putCell, setFormula, setValue, styleIdFor, type Workbook,
} from '../src/index.ts';

/** PNG 1x1 rouge. */
export const TINY_PNG = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
), (c) => c.charCodeAt(0));

export function richWorkbook(): Workbook {
  const wb = createBlankWorkbook();
  wb.properties = { title: 'Démo', creator: 'ForgeOffice', company: 'Forge', custom: { Projet: 'Tableur', Version: 3, Valide: true } };
  const s = wb.sheets[0];
  if (!s) throw new Error('feuille absente');
  s.tabColor = { rgb: 'FF107C41' };
  const bold = styleIdFor(wb, { font: { bold: true, color: { rgb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fg: { rgb: 'FF107C41' } } });
  const money = styleIdFor(wb, { numberFormat: '#,##0.00 "€"', border: { bottom: { style: 'thin', color: { rgb: 'FF000000' } } } });
  const date = styleIdFor(wb, { numberFormat: 'dd/mm/yyyy', alignment: { horizontal: 'center' } });
  const wrap = styleIdFor(wb, { alignment: { wrapText: true, vertical: 'top' }, protection: { locked: false } });
  ['Produit', 'Prix', 'Quantité', 'Total'].forEach((h, c) => putCell(s, 0, c, { value: h, styleId: bold }));
  const rows: [string, number, number][] = [['Pommes', 1.5, 10], ['Poires', 2.25, 4], ['Cerises', 7, 2], ['Kiwis', 0.8, 25]];
  rows.forEach(([name, price, qty], i) => {
    const r = i + 1;
    setValue(s, r, 0, name);
    putCell(s, r, 1, { value: price, styleId: money });
    setValue(s, r, 2, qty);
    putCell(s, r, 3, { value: price * qty, formula: `B${r + 1}*C${r + 1}`, styleId: money });
  });
  setValue(s, 6, 0, 'Somme');
  putCell(s, 6, 3, { value: 61.5, formula: 'SUM(D2:D5)', styleId: money });
  putCell(s, 7, 0, { value: 45658, styleId: date });
  setValue(s, 7, 1, true);
  putCell(s, 7, 2, { value: { error: '#DIV/0!' }, formula: '1/0' });
  putCell(s, 8, 0, { value: 'Texte enrichi', rich: [{ text: 'Texte ', font: { bold: true } }, { text: 'enrichi', font: { italic: true, color: { rgb: 'FFC00000' } } }] });
  putCell(s, 9, 0, { value: 'Ligne 1\nLigne 2', styleId: wrap });
  // Formule partagee E2:E5 et formule matricielle.
  putCell(s, 1, 4, { value: 3, formula: 'B2*2', shared: { index: 0, ref: { r1: 1, c1: 4, r2: 4, c2: 4 } } });
  for (let r = 2; r <= 4; r++) putCell(s, r, 4, { value: 0, shared: { index: 0 } });
  putCell(s, 1, 5, { value: 61.5, formula: 'SUM(B2:B5*C2:C5)', array: { ref: { r1: 1, c1: 5, r2: 1, c2: 5 } } });
  setFormula(s, 2, 5, 'XLOOKUP("Kiwis",A2:A5,B2:B5)', 0.8);
  s.cols.push({ min: 0, max: 0, width: 18 }, { min: 5, max: 6, width: 12, hidden: true });
  s.rows.set(9, { height: 30 });
  s.rows.set(2, { outlineLevel: 1 });
  s.merges.push({ r1: 11, c1: 0, r2: 11, c2: 3 });
  setValue(s, 11, 0, 'Fusion');
  s.view.frozen = { rows: 1, cols: 1 };
  s.view.zoom = 120;
  s.conditionalFormats.push(
    { ranges: [{ r1: 1, c1: 2, r2: 4, c2: 2 }], rules: [{ type: 'cellIs', priority: 1, operator: 'greaterThan', formulas: ['5'], dxfId: 0 }] },
    { ranges: [{ r1: 1, c1: 1, r2: 4, c2: 1 }], rules: [{ type: 'colorScale', priority: 2, colorScale: { cfvos: [{ type: 'min' }, { type: 'max' }], colors: [{ rgb: 'FFF8696B' }, { rgb: 'FF63BE7B' }] } }] },
    { ranges: [{ r1: 1, c1: 3, r2: 4, c2: 3 }], rules: [{ type: 'dataBar', priority: 3, dataBar: { cfvos: [{ type: 'min' }, { type: 'max' }], color: { rgb: 'FF638EC6' }, gradient: false, negativeColor: { rgb: 'FFFF0000' } } }] },
    { ranges: [{ r1: 1, c1: 2, r2: 4, c2: 2 }], rules: [{ type: 'iconSet', priority: 4, iconSet: { iconSet: '3Arrows', cfvos: [{ type: 'percent', value: '0' }, { type: 'percent', value: '33' }, { type: 'percent', value: '67' }] } }] },
    { ranges: [{ r1: 1, c1: 0, r2: 4, c2: 0 }], rules: [{ type: 'duplicateValues', priority: 5, dxfId: 0 }, { type: 'top10', priority: 6, rank: 2, dxfId: 0 }] },
    { ranges: [{ r1: 1, c1: 0, r2: 4, c2: 3 }], rules: [{ type: 'expression', priority: 7, formulas: ['$C2>20'], dxfId: 0 }] },
  );
  wb.styles.dxfs.push({ font: { bold: true, color: { rgb: 'FF9C0006' } }, fill: { type: 'pattern', pattern: 'solid', bg: { rgb: 'FFFFC7CE' } } });
  s.dataValidations.push(
    { ranges: [{ r1: 1, c1: 6, r2: 4, c2: 6 }], type: 'list', formula1: '"Oui,Non"', allowBlank: true, inCellDropdown: true, showErrorMessage: true },
    { ranges: [{ r1: 1, c1: 2, r2: 4, c2: 2 }], type: 'whole', operator: 'between', formula1: '0', formula2: '1000', showInputMessage: true, prompt: 'Entier' },
  );
  s.hyperlinks.push({ ref: { r1: 13, c1: 0, r2: 13, c2: 0 }, target: 'https://example.org/', tooltip: 'Site' }, { ref: { r1: 13, c1: 1, r2: 13, c2: 1 }, location: 'Données!A1' });
  setValue(s, 13, 0, 'Lien');
  setValue(s, 13, 1, 'Interne');
  s.notes.push({ ref: { row: 0, col: 1 }, author: 'Momo', text: 'Prix TTC', visible: true });
  s.threadedComments.push({ id: '{11111111-1111-4111-8111-111111111111}', ref: { row: 0, col: 2 }, personId: '{22222222-2222-4222-8222-222222222222}', text: 'À vérifier', date: '2026-11-03T10:00:00.00', replies: [{ id: '{33333333-3333-4333-8333-333333333333}', personId: '{22222222-2222-4222-8222-222222222222}', text: 'OK', date: '2026-11-03T11:00:00.00' }] });
  wb.persons.push({ id: '{22222222-2222-4222-8222-222222222222}', displayName: 'Momo', providerId: 'None' });
  s.pageSetup.orientation = 'landscape';
  s.pageSetup.paperSize = 9;
  s.pageSetup.fitToPage = true;
  s.pageSetup.fitToWidth = 1;
  s.pageSetup.fitToHeight = 0;
  s.pageSetup.printArea = [{ r1: 0, c1: 0, r2: 11, c2: 3 }];
  s.pageSetup.printTitleRows = { first: 0, last: 0 };
  s.pageSetup.headerFooter = { oddHeader: '&C&"-,Gras"Inventaire', oddFooter: '&LPage &P sur &N&R&D' };
  s.pageSetup.rowBreaks.push(20);
  s.sparklineGroups.push({ type: 'line', markers: true, sparklines: [{ source: 'Feuil1!B2:C2', location: { row: 1, col: 7 } }] });
  s.drawings.push(
    { kind: 'image', name: 'Logo', description: 'Pixel rouge', anchor: { type: 'oneCell', from: { col: 9, colOffset: 0, row: 1, rowOffset: 0 }, width: 952500, height: 952500 }, data: TINY_PNG, contentType: 'image/png' },
    { kind: 'shape', name: 'Note', geometry: 'roundRect', text: 'Bonjour', fill: { color: 'FFF2CC' }, line: { color: 'BF9000', width: 1 }, anchor: { type: 'twoCell', from: { col: 9, colOffset: 0, row: 7, rowOffset: 0 }, to: { col: 12, colOffset: 0, row: 10, rowOffset: 0 } } },
    {
      kind: 'chart', name: 'Graphique 1', anchor: { type: 'twoCell', from: { col: 9, colOffset: 0, row: 12, rowOffset: 0 }, to: { col: 16, colOffset: 0, row: 27, rowOffset: 0 } },
      chart: {
        title: { text: 'Ventes' },
        legend: { position: 'b' },
        plots: [
          { type: 'bar', barDirection: 'col', grouping: 'clustered', axisIds: [10, 20], series: [{ idx: 0, order: 0, name: { ref: 'Feuil1!$D$1', text: 'Total' }, categories: { ref: 'Feuil1!$A$2:$A$5', cache: ['Pommes', 'Poires', 'Cerises', 'Kiwis'] }, values: { ref: 'Feuil1!$D$2:$D$5', cache: [15, 9, 14, 20] }, color: '156082' }] },
          { type: 'line', grouping: 'standard', axisIds: [30, 40], series: [{ idx: 1, order: 1, name: { text: 'Prix' }, categories: { ref: 'Feuil1!$A$2:$A$5' }, values: { ref: 'Feuil1!$B$2:$B$5', cache: [1.5, 2.25, 7, 0.8] }, marker: { symbol: 'circle', size: 6 } }] },
        ],
        axes: [
          { id: 10, kind: 'category', position: 'b', crossAxisId: 20 },
          { id: 20, kind: 'value', position: 'l', crossAxisId: 10, majorGridlines: true, title: { text: 'Euros' } },
          { id: 30, kind: 'category', position: 'b', crossAxisId: 40, deleted: true },
          { id: 40, kind: 'value', position: 'r', crossAxisId: 30, crosses: 'max' },
        ],
      },
    },
    {
      kind: 'chart', name: 'Secteurs', anchor: { type: 'twoCell', from: { col: 17, colOffset: 0, row: 12, rowOffset: 0 }, to: { col: 23, colOffset: 0, row: 27, rowOffset: 0 } },
      chart: { title: { text: 'Répartition' }, legend: { position: 'r' }, plots: [{ type: 'doughnut', axisIds: [], holeSize: 50, series: [{ idx: 0, order: 0, categories: { ref: 'Feuil1!$A$2:$A$5' }, values: { ref: 'Feuil1!$C$2:$C$5' }, dataLabels: { showPercent: true } }] }], axes: [] },
    },
  );
  s.protectedRanges.push({ name: 'Saisie', ranges: [{ r1: 1, c1: 2, r2: 4, c2: 2 }] });

  const data = addSheet(wb, 'Données');
  ['Région', 'Ventes'].forEach((h, c) => setValue(data, 0, c, h));
  [['Nord', 120], ['Sud', 80], ['Est', 95]].forEach(([region, sales], i) => {
    setValue(data, i + 1, 0, region as string);
    setValue(data, i + 1, 1, sales as number);
  });
  setValue(data, 4, 0, 'Total');
  putCell(data, 4, 1, { value: 295, formula: 'SUBTOTAL(109,Ventes[Ventes])' });
  data.tables.push({
    id: 1, name: 'Ventes', displayName: 'Ventes', ref: { r1: 0, c1: 0, r2: 4, c2: 1 }, headerRowCount: 1, totalsRowShown: true, totalsRowCount: 1,
    columns: [{ id: 1, name: 'Région', totalsRowLabel: 'Total' }, { id: 2, name: 'Ventes', totalsRowFunction: 'sum' }],
    style: { name: 'TableStyleMedium2', showFirstColumn: false, showLastColumn: false, showRowStripes: true, showColumnStripes: false },
  });
  data.autoFilter = undefined;
  data.protection = { sheet: true, allow: { formatCells: true, sort: true } };

  const hidden = addSheet(wb, 'Cachée');
  hidden.state = 'hidden';
  setValue(hidden, 0, 0, 'secret');
  const filtered = addSheet(wb, 'Filtre');
  ['Nom', 'Note'].forEach((h, c) => setValue(filtered, 0, c, h));
  [['A', 12], ['B', 8], ['C', 15]].forEach(([n, v], i) => {
    setValue(filtered, i + 1, 0, n as string);
    setValue(filtered, i + 1, 1, v as number);
  });
  filtered.autoFilter = { ref: { r1: 0, c1: 0, r2: 3, c2: 1 }, columns: [{ colId: 1, filter: { kind: 'custom', conditions: [{ operator: 'greaterThan', value: '10' }] } }] };
  filtered.rows.set(2, { hidden: true });
  wb.definedNames.push({ name: 'TauxTVA', formula: '0.2', comment: 'Taux normal' }, { name: 'Plage', formula: 'Feuil1!$A$1:$D$5' });
  wb.protection = { lockStructure: true };
  return wb;
}
