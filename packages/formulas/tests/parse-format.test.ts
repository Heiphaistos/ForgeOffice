// Analyse, traduction francaise, formats de nombre et reconnaissance de la saisie.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ERR,
  FormulaParseError,
  formatValue,
  formatValueDetailed,
  fromFileFormula,
  fromLocalized,
  functionNameFromFr,
  functionNameToFr,
  listFunctions,
  parseFormula,
  parseInput,
  printFormula,
  toFileFormula,
  toLocalized,
  type NumberLocale,
  type Scalar,
} from '../src/index.ts';

const TO_FR: [string, string][] = [
  ['=SUM(A1:B2,2.5)', '=SOMME(A1:B2;2,5)'],
  ['=IF(ISERROR(A1),#N/A,TRUE)', '=SI(ESTERREUR(A1);#N/A;VRAI)'],
  ['=VLOOKUP(A1,B:C,2,FALSE)', '=RECHERCHEV(A1;B:C;2;FAUX)'],
  ['=COUNTIFS(A:A,">1",B:B,"x")', '=NB.SI.ENS(A:A;">1";B:B;"x")'],
  ['=IFS(A1>1,"a",TRUE,"b")', '=SI.CONDITIONS(A1>1;"a";VRAI;"b")'],
  ['=XLOOKUP(1,A:A,B:B)', '=RECHERCHEX(1;A:A;B:B)'],
  ['=TEXTJOIN(",",TRUE,A1:A3)', '=JOINDRE.TEXTE(",";VRAI;A1:A3)'],
  ['={1,2;3,4}', '={1.2;3.4}'],
  ['="a,b"&SUM(1.5)', '="a,b"&SOMME(1,5)'],
  ["='My Sheet'!A1+Sheet2!B2", "='My Sheet'!A1+Sheet2!B2"],
  ['=1/0+#VALUE!', '=1/0+#VALEUR!'],
  ['=#NAME?', '=#NOM?'],
  ['=#NUM!', '=#NOMBRE!'],
  ['=#NULL!', '=#NUL!'],
  ['=#SPILL!', '=#EPARS!'],
  ['=#CALC!', '=#CALC!'],
  ['=NETWORKDAYS.INTL(A1,B1)', '=NB.JOURS.OUVRES.INTL(A1;B1)'],
  ['=STDEV.S(A1:A9)', '=ECARTYPE.STANDARD(A1:A9)'],
  ['=PMT(5%/12,60,-10000)', '=VPM(5%/12;60;-10000)'],
  ['=LET(x,1.5,x*2)', '=LET(x;1,5;x*2)'],
  ['=BYROW(A1:B2,SUM)', '=BYROW(A1:B2;SOMME)'],
  ['=Table1[[#Headers],[Col]]', '=Table1[[#En-têtes];[Col]]'],
  ['=DSUM(A1:C9,"x",E1:E2)', '=BDSOMME(A1:C9;"x";E1:E2)'],
  ['=BIN2DEC("101")', '=BINDEC("101")'],
  ['=IMSUM("1+i","2")', '=COMPLEXE.SOMME("1+i";"2")'],
  ['=1E-3', '=1E-3'],
];

for (const [en, fr] of TO_FR) {
  test(`toLocalized ${en}`, () => assert.equal(toLocalized(en, 'fr'), fr));
  test(`fromLocalized ${fr}`, () => assert.equal(fromLocalized(fr, 'fr'), en));
}

test('noms de fonctions francais', () => {
  assert.equal(functionNameToFr('AVERAGEIFS'), 'MOYENNE.SI.ENS');
  assert.equal(functionNameFromFr('recherchev'), 'VLOOKUP');
  assert.equal(functionNameFromFr('SUM'), 'SUM');
  assert.equal(functionNameToFr('INCONNUE'), 'INCONNUE');
});

test('au moins 350 fonctions, aller-retour francais sans perte', () => {
  const fns = listFunctions();
  assert.ok(fns.length >= 350, `${fns.length} fonctions`);
  const lost = fns.map((f) => f.name).filter((n) => functionNameFromFr(functionNameToFr(n)) !== n);
  assert.deepEqual(lost, []);
});

test('fichiers .xlsx : prefixes _xlfn', () => {
  assert.equal(toFileFormula('=XLOOKUP(1,A:A,B:B)'), '=_xlfn.XLOOKUP(1,A:A,B:B)');
  assert.equal(toFileFormula('=SORT(A1:A3)'), '=_xlfn._xlws.SORT(A1:A3)');
  assert.equal(toFileFormula('=LET(x,1,x+1)'), '=_xlfn.LET(_xlpm.x,1,_xlpm.x+1)');
  assert.equal(toFileFormula('=SUM(A1)'), '=SUM(A1)');
  assert.equal(fromFileFormula('_xlfn.CONCAT(A1)'), 'CONCAT(A1)');
  assert.equal(fromFileFormula('_xlfn.LET(_xlpm.x,1,_xlpm.x+1)'), 'LET(x,1,x+1)');
});

const BAD = ['=SUM(1,', '=1+', '="abc', '=(1', '=1)', '=A1:', '={1,2', '=#FOO!', '=SUM(1,2))', '='];
for (const f of BAD) {
  test(`formule invalide ${f}`, () => assert.throws(() => parseFormula(f), FormulaParseError));
}

const PRINT: [string, string][] = [
  ['=1+2*3', '1+2*3'],
  ['=SUM( A1 , $B$2 )', 'SUM(A1,$B$2)'],
  ["='a b'!A1:B2", "'a b'!A1:B2"],
  ['=Sheet1:Sheet3!A1', 'Sheet1:Sheet3!A1'],
  ['=-A1%', '-A1%'],
  ['=A:A', 'A:A'],
  ['=1:3', '1:3'],
  ['=Table1[Col]', 'Table1[Col]'],
  ['=[@Col]', '[@Col]'],
  ['=A1#', 'A1#'],
  ['=LAMBDA(x,x+1)(2)', 'LAMBDA(x,x+1)(2)'],
  ['={1,"a";TRUE,#N/A}', '{1,"a";TRUE,#N/A}'],
];
for (const [src, out] of PRINT) {
  test(`printFormula ${src}`, () => assert.equal(printFormula(parseFormula(src)), out));
}

const FORMATS: [Scalar, string, NumberLocale, string][] = [
  [1234.5, '#,##0.00', 'fr-FR', '1 234,50'],
  [1234.5, '#,##0.00', 'en-US', '1,234.50'],
  [0.1 + 0.2, 'General', 'en-US', '0.3'],
  [1e20, 'General', 'en-US', '1E+20'],
  [123456789012, 'General', 'en-US', '1.23457E+11'],
  [-1234.5, 'General', 'fr-FR', '-1234,5'],
  [2.5, '0', 'en-US', '3'],
  [-0.4, '0', 'en-US', '-0'],
  [0.125, '0%', 'en-US', '13%'],
  [0.5, '0.00%', 'fr-FR', '50,00%'],
  [1 / 3, '0.000', 'fr-FR', '0,333'],
  [12345, '0.00E+00', 'en-US', '1.23E+04'],
  [1.25, '# ?/?', 'en-US', '1 1/4'],
  [3.14159, '# ??/??', 'en-US', '3 14/99'],
  [45351, 'dd/mm/yyyy', 'fr-FR', '29/02/2024'],
  [60, 'dd/mm/yyyy', 'fr-FR', '29/02/1900'],
  [45351.5, 'yyyy-mm-dd hh:mm:ss', 'en-US', '2024-02-29 12:00:00'],
  [45351, 'dddd d mmmm yyyy', 'fr-FR', 'jeudi 29 février 2024'],
  [45351, 'dddd d mmmm yyyy', 'en-US', 'Thursday 29 February 2024'],
  [45351, 'mmm', 'en-US', 'Feb'],
  [45351, 'mmm', 'fr-FR', 'févr.'],
  [1.5, '[h]:mm', 'en-US', '36:00'],
  [0.75, 'h:mm AM/PM', 'en-US', '6:00 PM'],
  [0.5 / 24, 'mm:ss', 'en-US', '30:00'],
  [45351.999999, 'hh:mm:ss', 'en-US', '00:00:00'],
  [-1, 'dd/mm/yyyy', 'en-US', '##########'],
  ['abc', '@', 'en-US', 'abc'],
  [5, '"Total: "0', 'en-US', 'Total: 5'],
  [0, '0;-0;"zero"', 'en-US', 'zero'],
  [-3, '0;(0)', 'en-US', '(3)'],
  [150, '[>100]"big";"small"', 'en-US', 'big'],
  [50, '[>100]"big";"small"', 'en-US', 'small'],
  [1234.5, '#,##0.00 [$€-40C]', 'fr-FR', '1 234,50 €'],
  [42, '0000', 'en-US', '0042'],
  [1234567, '#,##0,', 'en-US', '1,235'],
  [1234567, '0.0,,"M"', 'en-US', '1.2M'],
  ['x', '0;0;0;"T:"@', 'en-US', 'T:x'],
  [true, 'General', 'fr-FR', 'VRAI'],
  [false, 'General', 'en-US', 'FALSE'],
  [ERR.VALUE, 'General', 'fr-FR', '#VALEUR!'],
  [ERR.DIV0, '0.00', 'fr-FR', '#DIV/0!'],
];
for (const [v, code, locale, out] of FORMATS) {
  test(`formatValue ${String(v)} "${code}" ${locale}`, () => assert.equal(formatValue(v, code, locale), out));
}

test('couleurs de format', () => {
  assert.deepEqual(formatValueDetailed(-3, '[Red]0;[Blue]-0', 'en-US'), { text: '-3', color: '#0000FF' });
  assert.equal(formatValueDetailed(3, '[Red]0;[Blue]-0', 'en-US').color, '#FF0000');
  assert.equal(formatValueDetailed(3, '[Rouge]0', 'fr-FR').color, '#FF0000');
});

const INPUTS: [string, NumberLocale, unknown][] = [
  ['12,5', 'fr-FR', { type: 'number', value: 12.5 }],
  ['1 234,5', 'fr-FR', { type: 'number', value: 1234.5, format: '#,##0.00' }],
  ['15%', 'fr-FR', { type: 'number', value: 0.15, format: '0%' }],
  ['29/02/2024', 'fr-FR', { type: 'number', value: 45351, format: 'dd/mm/yyyy' }],
  ['1/2', 'fr-FR', { type: 'number', value: 45323, format: 'd-mmm' }],
  ['12:30', 'fr-FR', { type: 'number', value: 0.5208333333333334, format: 'hh:mm' }],
  ['VRAI', 'fr-FR', { type: 'boolean', value: true }],
  ['faux', 'fr-FR', { type: 'boolean', value: false }],
  ['=1+1', 'fr-FR', { type: 'formula', formula: '=1+1' }],
  ['#N/A', 'fr-FR', { type: 'error', value: '#N/A' }],
  ['#VALEUR!', 'fr-FR', { type: 'error', value: '#VALUE!' }],
  ['abc', 'fr-FR', { type: 'text', value: 'abc' }],
  ['', 'fr-FR', { type: 'blank' }],
  ['-5', 'fr-FR', { type: 'number', value: -5 }],
  ["'123", 'fr-FR', { type: 'text', value: '123' }],
  ['12,5 €', 'fr-FR', { type: 'number', value: 12.5, format: '#,##0.00 [$€-40C]' }],
  ['31/02/2024', 'fr-FR', { type: 'text', value: '31/02/2024' }],
  ['(5)', 'en-US', { type: 'number', value: -5 }],
  ['1/2', 'en-US', { type: 'number', value: 45293, format: 'd-mmm' }],
  ['1,234.5', 'en-US', { type: 'number', value: 1234.5, format: '#,##0.00' }],
  ['2/29/2024', 'en-US', { type: 'number', value: 45351, format: 'm/d/yyyy' }],
  ['TRUE', 'en-US', { type: 'boolean', value: true }],
];
for (const [text, locale, out] of INPUTS) {
  test(`parseInput "${text}" ${locale}`, () => assert.deepEqual(parseInput(text, locale, { currentYear: 2024 }), out));
}
