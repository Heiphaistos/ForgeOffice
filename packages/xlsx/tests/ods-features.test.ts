// .ods : fichier produit par Excel 365 (commentaires, validations, mises en forme conditionnelles, texte enrichi, graphique)
// et fichiers OpenDocument manuscrits (volets figes, conditional-formats, grammaire des conditions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { readOds } from '../src/index.ts';
import { parseCfCondition, parseOdfRange, parseValidationCondition } from '../src/ods/ods-extras.ts';

const fixture = (): Uint8Array => new Uint8Array(readFileSync(new URL('./fixtures/excel-features.ods', import.meta.url)));

test('commentaires : texte, auteur, position, visibilite', async () => {
  const sheet = (await readOds(fixture())).sheets[0];
  assert.deepEqual(sheet?.notes.map((n) => [n.ref.row, n.ref.col, n.author, n.text, n.visible ?? false]), [
    [1, 1, 'Utilisateur', 'Note ods 1', false],
    [2, 2, 'Utilisateur', 'Deuxieme note\nlignes', true],
  ]);
});

test('validations : liste et entier entre 1 et 100 (avertissement), messages et plages', async () => {
  const dv = (await readOds(fixture())).sheets[0]?.dataValidations ?? [];
  assert.equal(dv.length, 2);
  const whole = dv.find((v) => v.type === 'whole');
  assert.deepEqual(whole, {
    type: 'whole', operator: 'between', formula1: '1', formula2: '100', allowBlank: true, showInputMessage: true, showErrorMessage: true,
    errorStyle: 'warning', ranges: [{ r1: 1, r2: 4, c1: 1, c2: 1 }],
  });
  const list = dv.find((v) => v.type === 'list');
  assert.equal(list?.formula1, '"Oui,Non,Peut-etre"');
  assert.deepEqual([list?.promptTitle, list?.prompt, list?.errorTitle, list?.error], ['Choix', 'Choisir une valeur', 'Erreur', 'Valeur non permise']);
  assert.deepEqual(list?.ranges, [{ r1: 1, r2: 4, c1: 2, c2: 2 }]);
});

test('mises en forme conditionnelles (style:map d Excel) : valeur de cellule et formule, formats differentiels', async () => {
  const wb = await readOds(fixture());
  const cf = wb.sheets[0]?.conditionalFormats ?? [];
  assert.equal(cf.length, 2);
  const byRange = (c: number) => cf.find((f) => f.ranges[0]?.c1 === c);
  assert.deepEqual(byRange(1)?.rules.map((r) => [r.type, r.operator, r.formulas]), [['cellIs', 'greaterThan', ['10']]]);
  assert.deepEqual(byRange(0)?.rules.map((r) => [r.type, r.formulas]), [['expression', ['$B2<9']]]);
  const dxf = wb.styles.dxfs[byRange(1)?.rules[0]?.dxfId ?? -1];
  assert.deepEqual(dxf?.font?.color, { rgb: 'FFFF0000' });
  assert.equal(dxf?.fill?.type, 'pattern');
  assert.equal(wb.styles.dxfs[byRange(0)?.rules[0]?.dxfId ?? -1]?.font?.bold, true);
});

test('texte enrichi : passages en gras, rouge et italique', async () => {
  const cell = (await readOds(fixture())).sheets[0]?.cells.get(0)?.get(4);
  assert.equal(cell?.value, 'Gras et rouge ici');
  assert.equal(cell?.rich?.map((r) => r.text).join(''), 'Gras et rouge ici');
  assert.deepEqual(cell?.rich?.find((r) => r.text === 'rouge')?.font?.color, { rgb: 'FFFF0000' });
  assert.equal(cell?.rich?.find((r) => r.text === 'ici')?.font?.italic, true);
});

test('graphique de base : histogramme, titre, series, categories, legende', async () => {
  const wb = await readOds(fixture());
  const chart = wb.sheets[1]?.drawings.find((d) => d.kind === 'chart');
  assert.ok(chart && chart.kind === 'chart');
  assert.equal(chart.chart.title?.text, 'Ventes');
  const plot = chart.chart.plots[0];
  assert.equal(plot?.type, 'bar');
  assert.equal(plot?.series[0]?.values.ref, 'Donnees!B2:B5');
  assert.equal(plot?.series[0]?.categories?.ref, 'Donnees!A2:A5');
  assert.equal(plot?.series[0]?.name?.ref, 'Donnees!B1');
  assert.equal(chart.chart.legend?.position, 'r');
  assert.equal(chart.anchor.type, 'absolute');
});

const CONTENT_NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"', 'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"', 'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"', 'xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0"',
].join(' ');

async function handmade(table: string, settings?: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.spreadsheet', { compression: 'STORE' });
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${CONTENT_NS}>
<office:automatic-styles><style:style style:name="cf1" style:family="table-cell"><style:text-properties fo:font-weight="bold" fo:color="#ff0000"/></style:style></office:automatic-styles>
<office:body><office:spreadsheet>${table}</office:spreadsheet></office:body></office:document-content>`);
  if (settings) zip.file('settings.xml', settings);
  return zip.generateAsync({ type: 'uint8array' });
}

const ROWS = '<table:table-column/><table:table-row><table:table-cell office:value-type="float" office:value="1"/><table:table-cell office:value-type="float" office:value="2"/></table:table-row>'
  + '<table:table-row><table:table-cell office:value-type="float" office:value="9"/><table:table-cell office:value-type="float" office:value="8"/></table:table-row>';

test('conditional-formats (LibreOffice) : condition + style, echelle de couleurs', async () => {
  const table = `<table:table table:name="S">${ROWS}<table:conditional-formats>
<table:conditional-format table:target-range-address="S.A1:S.A2"><table:condition table:value="cell-content()&gt;5" table:apply-style-name="cf1" table:base-cell-address="S.A1"/></table:conditional-format>
<table:conditional-format table:target-range-address="S.B1:S.B2"><calcext:color-scale><calcext:color-scale-entry calcext:type="minimum" calcext:color="#ff0000"/><calcext:color-scale-entry calcext:type="maximum" calcext:color="#00ff00"/></calcext:color-scale></table:conditional-format>
</table:conditional-formats></table:table>`;
  const wb = await readOds(await handmade(table));
  const cf = wb.sheets[0]?.conditionalFormats ?? [];
  assert.equal(cf.length, 2);
  assert.deepEqual(cf[0]?.rules[0]?.formulas, ['5']);
  assert.equal(cf[0]?.rules[0]?.operator, 'greaterThan');
  assert.equal(wb.styles.dxfs[cf[0]?.rules[0]?.dxfId ?? -1]?.font?.bold, true);
  assert.deepEqual(cf[1]?.rules[0]?.colorScale?.colors, [{ rgb: 'FFFF0000' }, { rgb: 'FF00FF00' }]);
  assert.deepEqual(cf[1]?.rules[0]?.colorScale?.cfvos.map((v) => v.type), ['min', 'max']);
});

test('volets figes, zoom et quadrillage (settings.xml)', async () => {
  const settings = `<?xml version="1.0"?><office:document-settings xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><office:settings>
<config:config-item-set config:name="ooo:view-settings"><config:config-item-map-indexed config:name="Views"><config:config-item-map-entry>
<config:config-item config:name="ViewId" config:type="string">view1</config:config-item>
<config:config-item-map-named config:name="Tables"><config:config-item-map-entry config:name="S">
<config:config-item config:name="HorizontalSplitMode" config:type="short">2</config:config-item><config:config-item config:name="VerticalSplitMode" config:type="short">2</config:config-item>
<config:config-item config:name="HorizontalSplitPosition" config:type="int">2</config:config-item><config:config-item config:name="VerticalSplitPosition" config:type="int">3</config:config-item>
<config:config-item config:name="ShowGrid" config:type="boolean">false</config:config-item>
</config:config-item-map-entry></config:config-item-map-named>
</config:config-item-map-entry></config:config-item-map-indexed></config:config-item-set></office:settings></office:document-settings>`;
  const wb = await readOds(await handmade(`<table:table table:name="S">${ROWS}</table:table>`, settings));
  assert.deepEqual(wb.sheets[0]?.view.frozen, { rows: 3, cols: 2 });
  assert.equal(wb.sheets[0]?.view.showGridLines, false);
});

test('grammaire des conditions de validation et de mise en forme', () => {
  assert.deepEqual(parseValidationCondition('of:cell-content-is-whole-number() and of:cell-content-is-between(1;100)'), { type: 'whole', operator: 'between', formula1: '1', formula2: '100' });
  assert.deepEqual(parseValidationCondition('of:cell-content-is-decimal-number() and of:cell-content-is-greater-than(0)'), { type: 'decimal', operator: 'greaterThan', formula1: '0' });
  assert.deepEqual(parseValidationCondition('of:cell-content-is-in-list("a";"b";"c")'), { type: 'list', formula1: '"a,b,c"' });
  assert.deepEqual(parseValidationCondition('of:cell-content-is-in-list([$Listes.$A$1:.$A$5])'), { type: 'list', formula1: 'Listes!$A$1:$A$5' });
  assert.deepEqual(parseValidationCondition('of:is-true-formula(AND([.A1]>0;[.A1]<10))'), { type: 'custom', formula1: 'AND(A1>0,A1<10)' });
  assert.deepEqual(parseValidationCondition('of:cell-content-text-length-is-less-than-or-equal-to(5)'), { type: 'textLength', operator: 'lessThanOrEqual', formula1: '5' });
  assert.equal(parseValidationCondition('n importe quoi'), undefined);
  assert.deepEqual(parseCfCondition('of:cell-content()>=10', 1), { type: 'cellIs', priority: 1, operator: 'greaterThanOrEqual', formulas: ['10'] });
  assert.deepEqual(parseCfCondition('of:cell-content-is-between(1;5)', 2), { type: 'cellIs', priority: 2, operator: 'between', formulas: ['1', '5'] });
  assert.deepEqual(parseCfCondition('of:is-true-formula([.$B2]<9)', 1), { type: 'expression', priority: 1, formulas: ['$B2<9'] });
  assert.equal(parseCfCondition('texte inconnu', 1), undefined);
  assert.deepEqual(parseOdfRange("$'Ma feuille'.$B$2:.$D$9"), { sheet: 'Ma feuille', range: { r1: 1, r2: 8, c1: 1, c2: 3 } });
  assert.deepEqual(parseOdfRange('Feuil1.A1'), { sheet: 'Feuil1', range: { r1: 0, r2: 0, c1: 0, c2: 0 } });
});

test('validation sur une colonne entiere repetee : plages bornees, pas d explosion memoire', async () => {
  const table = `<table:table table:name="S"><table:table-column/><table:table-row table:number-rows-repeated="1048576"><table:table-cell table:number-columns-repeated="16384" table:content-validation-name="v"/></table:table-row></table:table>`;
  const zipped = await handmade(table.replace('<table:table table:name="S">', '<table:content-validations><table:content-validation table:name="v" table:condition="of:cell-content-is-whole-number()"/></table:content-validations><table:table table:name="S">'));
  const wb = await readOds(zipped);
  const dv = wb.sheets[0]?.dataValidations ?? [];
  assert.equal(dv.length, 1);
  assert.deepEqual(dv[0]?.ranges, [{ r1: 0, r2: 1_048_575, c1: 0, c2: 16383 }]);
});
