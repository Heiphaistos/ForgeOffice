// BAHTTEXT (valeurs d'Excel 365), EUROCONVERT (taux officiels), ROGNERPLAGE, PIVOTBY et LIREDONNEESTABCROISDYNAMIQUE.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FormulaEngine, evaluateFormula, type Scalar } from '../src/index.ts';

const BAHT: [number, string][] = [
  [0, "ศูนย์บาทถ้วน"],
  [1, "หนึ่งบาทถ้วน"],
  [12, "สิบสองบาทถ้วน"],
  [21, "ยี่สิบเอ็ดบาทถ้วน"],
  [100, "หนึ่งร้อยบาทถ้วน"],
  [1234.5, "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์"],
  [1234.56, "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบหกสตางค์"],
  [0.25, "ยี่สิบห้าสตางค์"],
  [1000000, "หนึ่งล้านบาทถ้วน"],
  [1000011, "หนึ่งล้านสิบเอ็ดบาทถ้วน"],
  [-5, "ลบห้าบาทถ้วน"],
  [101, "หนึ่งร้อยเอ็ดบาทถ้วน"],
  [11, "สิบเอ็ดบาทถ้วน"],
  [1.01, "หนึ่งบาทหนึ่งสตางค์"],
  [0.5, "ห้าสิบสตางค์"],
  [2000000.75, "สองล้านบาทเจ็ดสิบห้าสตางค์"],
  [123456789, "หนึ่งร้อยยี่สิบสามล้านสี่แสนห้าหมื่นหกพันเจ็ดร้อยแปดสิบเก้าบาทถ้วน"],
  [2, "สองบาทถ้วน"],
  [10, "สิบบาทถ้วน"],
  [20, "ยี่สิบบาทถ้วน"],
  [22, "ยี่สิบสองบาทถ้วน"],
  [30, "สามสิบบาทถ้วน"],
  [31, "สามสิบเอ็ดบาทถ้วน"],
  [100, "หนึ่งร้อยบาทถ้วน"],
  [110, "หนึ่งร้อยสิบบาทถ้วน"],
  [111, "หนึ่งร้อยสิบเอ็ดบาทถ้วน"],
  [121, "หนึ่งร้อยยี่สิบเอ็ดบาทถ้วน"],
  [1001, "หนึ่งพันเอ็ดบาทถ้วน"],
  [1011, "หนึ่งพันสิบเอ็ดบาทถ้วน"],
  [1021, "หนึ่งพันยี่สิบเอ็ดบาทถ้วน"],
  [10000, "หนึ่งหมื่นบาทถ้วน"],
  [100000, "หนึ่งแสนบาทถ้วน"],
  [1000001, "หนึ่งล้านเอ็ดบาทถ้วน"],
  [1000021, "หนึ่งล้านยี่สิบเอ็ดบาทถ้วน"],
  [1000100, "หนึ่งล้านหนึ่งร้อยบาทถ้วน"],
  [1100000, "หนึ่งล้านหนึ่งแสนบาทถ้วน"],
  [10000000, "สิบล้านบาทถ้วน"],
  [1000000000000, "หนึ่งล้านล้านบาทถ้วน"],
  [0.01, "หนึ่งสตางค์"],
  [0.1, "สิบสตางค์"],
  [0.11, "สิบเอ็ดสตางค์"],
  [0.21, "ยี่สิบเอ็ดสตางค์"],
  [0.99, "เก้าสิบเก้าสตางค์"],
  [0.999, "หนึ่งบาทถ้วน"],
  [1.999, "สองบาทถ้วน"],
  [0.004, "ศูนย์บาทถ้วน"],
  [0.005, "หนึ่งสตางค์"],
  [0.006, "หนึ่งสตางค์"],
  [-0.5, "ลบห้าสิบสตางค์"],
  [-0.004, "ลบศูนย์บาทถ้วน"],
  [-1234567.89, "ลบหนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ดบาทแปดสิบเก้าสตางค์"],
  [999999.99, "เก้าแสนเก้าหมื่นเก้าพันเก้าร้อยเก้าสิบเก้าบาทเก้าสิบเก้าสตางค์"],
  [12345678901, "หนึ่งหมื่นสองพันสามร้อยสี่สิบห้าล้านหกแสนเจ็ดหมื่นแปดพันเก้าร้อยเอ็ดบาทถ้วน"],
  [123456789012345, "หนึ่งร้อยยี่สิบสามล้านสี่แสนห้าหมื่นหกพันเจ็ดร้อยแปดสิบเก้าล้านหนึ่งหมื่นสองพันสามร้อยสี่สิบห้าบาทถ้วน"],
  [2.5, "สองบาทห้าสิบสตางค์"],
  [10.1, "สิบบาทสิบสตางค์"],
  [21.21, "ยี่สิบเอ็ดบาทยี่สิบเอ็ดสตางค์"],
  [1000000.01, "หนึ่งล้านบาทหนึ่งสตางค์"],
  [100000000, "หนึ่งร้อยล้านบาทถ้วน"],
  [1.005, "หนึ่งบาทหนึ่งสตางค์"],
];

const ev = (f: string): unknown => {
  const v = evaluateFormula(f, { locale: 'en-US' });
  return typeof v === 'object' && v !== null && 'code' in v ? String((v as { code: string }).code) : v;
};

describe('BAHTTEXT', () => {
  test(`${BAHT.length} valeurs identiques a Excel`, () => {
    for (const [n, text] of BAHT) assert.equal(ev(`=BAHTTEXT(${n})`), text, String(n));
  });
  test('texte non numerique : #VALUE!', () => {
    assert.equal(ev('=BAHTTEXT("abc")'), '#VALUE!');
  });
});

describe('EUROCONVERT', () => {
  test('exemples de la documentation Microsoft et arrondis a la monnaie cible', () => {
    assert.equal(ev('=EUROCONVERT(1,"DEM","EUR")'), 0.51);
    assert.equal(ev('=EUROCONVERT(1,"EUR","DEM")'), 1.96);
    assert.equal(ev('=EUROCONVERT(1000,"EUR","BEF")'), 40340);
    assert.equal(ev('=EUROCONVERT(1000,"eur","frf")'), 6559.57);
    assert.equal(ev('=EUROCONVERT(1000,"EUR","ITL")'), 1936270);
  });
  test('precision totale et triangulation', () => {
    assert.ok(Math.abs(Number(ev('=EUROCONVERT(1,"EUR","DEM",TRUE)')) - 1.95583) < 1e-12);
    assert.equal(ev('=EUROCONVERT(1,"FRF","DEM")'), 0.3);
    assert.ok(Math.abs(Number(ev('=EUROCONVERT(1,"FRF","DEM",TRUE,3)')) - 0.298) < 1e-3);
    assert.ok(Math.abs(Number(ev('=EUROCONVERT(1,"FRF","DEM",TRUE)')) - 1.95583 / 6.55957) < 1e-12);
  });
  test('monnaie inconnue, triangulation < 3 : #VALUE!', () => {
    assert.equal(ev('=EUROCONVERT(1,"EUR","USD")'), '#VALUE!');
    assert.equal(ev('=EUROCONVERT(1,"FRF","DEM",TRUE,2)'), '#VALUE!');
  });
});

function book(): FormulaEngine {
  const e = new FormulaEngine({
    locale: 'en-US',
    host: {
      pivotValue: (sheet, row, col, field, items) =>
        sheet === 'T' && row === 0 && col === 0 && field === 'Ventes' && items.length === 1 && items[0]?.[0] === 'Region'
          ? (items[0][1] === 'Nord' ? 42 : undefined)
          : undefined,
    },
  });
  e.addSheet('T');
  e.batch(() => {
    const rows: Scalar[][] = [
      ['Region', 'Produit', 'Ventes'],
      ['Nord', 'A', 10], ['Nord', 'B', 20], ['Sud', 'A', 5], ['Sud', 'B', 7], ['Nord', 'A', 12],
    ];
    rows.forEach((r, i) => r.forEach((v, j) => e.setCell('T', { row: i + 5, col: j }, v)));
    e.setCell('T', 'F2', 1);
    e.setCell('T', 'G3', 2);
    e.setCell('T', 'F4', 3);
  });
  return e;
}

describe('ROGNERPLAGE', () => {
  test('modes 0 a 3, colonnes et lignes vides en bord', () => {
    const e = book();
    e.setFormula('T', 'J1', 'ROWS(TRIMRANGE(E1:H6))');
    e.setFormula('T', 'J2', 'COLUMNS(TRIMRANGE(E1:H6))');
    e.setFormula('T', 'J3', 'ROWS(TRIMRANGE(E1:H6,1,1))');
    e.setFormula('T', 'J4', 'COLUMNS(TRIMRANGE(E1:H6,2,2))');
    e.setFormula('T', 'J5', 'ROWS(TRIMRANGE(E1:H6,0,0))');
    e.setFormula('T', 'J6', 'SUM(TRIMRANGE(E1:H6))');
    assert.equal(e.getValue('T', 'J1'), 3);
    assert.equal(e.getValue('T', 'J2'), 2);
    assert.equal(e.getValue('T', 'J3'), 5);
    assert.equal(e.getValue('T', 'J4'), 3);
    assert.equal(e.getValue('T', 'J5'), 6);
    assert.equal(e.getValue('T', 'J6'), 6);
    e.setCell('T', 'F2', 100);
    assert.equal(e.getValue('T', 'J6'), 105);
  });
  test('zone vide : #CALC!', () => {
    assert.equal(String(book().evaluate('TRIMRANGE(M1:O5)', 'T')), '#CALC!');
  });
});

describe('PIVOTBY et LIREDONNEESTABCROISDYNAMIQUE', () => {
  test('PIVOTBY : totaux, tri et en-tetes', () => {
    const e = book();
    e.setFormula('T', 'L1', 'PIVOTBY(A7:A11,B7:B11,C7:C11,SUM,0)');
    assert.deepEqual([e.getValue('T', 'L1'), e.getValue('T', 'M1'), e.getValue('T', 'N1'), e.getValue('T', 'O1')], [null, 'A', 'B', 'Total']);
    assert.deepEqual([e.getValue('T', 'L2'), e.getValue('T', 'M2'), e.getValue('T', 'N2'), e.getValue('T', 'O2')], ['Nord', 22, 20, 42]);
    assert.deepEqual([e.getValue('T', 'L3'), e.getValue('T', 'M3'), e.getValue('T', 'N3'), e.getValue('T', 'O3')], ['Sud', 5, 7, 12]);
    assert.deepEqual([e.getValue('T', 'L4'), e.getValue('T', 'M4'), e.getValue('T', 'N4'), e.getValue('T', 'O4')], ['Total', 27, 27, 54]);
  });
  test('PIVOTBY avec en-tetes de champs, sans totaux, tri decroissant', () => {
    const e = book();
    e.setFormula('T', 'L1', 'PIVOTBY(A6:A11,B6:B11,C6:C11,SUM,3,0,-1,0)');
    assert.deepEqual([e.getValue('T', 'L1'), e.getValue('T', 'M1'), e.getValue('T', 'N1')], ['Region', 'A', 'B']);
    assert.deepEqual([e.getValue('T', 'L2'), e.getValue('T', 'M2'), e.getValue('T', 'N2')], ['Sud', 5, 7]);
    assert.equal(e.getValue('T', 'L4'), null);
  });
  test('GETPIVOTDATA passe par l hote ; sans hote : #REF!', () => {
    const e = book();
    e.setFormula('T', 'Q1', 'GETPIVOTDATA("Ventes",A1,"Region","Nord")');
    e.setFormula('T', 'Q2', 'GETPIVOTDATA("Ventes",A1,"Region","Est")');
    assert.equal(e.getValue('T', 'Q1'), 42);
    assert.equal(String(e.getValue('T', 'Q2')), '#REF!');
    assert.equal(ev('=GETPIVOTDATA("x",A1)'), '#REF!');
  });
});
