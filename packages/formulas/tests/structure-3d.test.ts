// References 3D : insertion/suppression de lignes et colonnes, suppression d'une feuille de bord (comportement verifie dans Excel 365).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FormulaEngine, removeSheetInFormula, shiftFormula } from '../src/index.ts';

function book(...names: string[]): FormulaEngine {
  const e = new FormulaEngine({ locale: 'en-US' });
  for (const n of names) e.addSheet(n);
  return e;
}

function filled(): FormulaEngine {
  const e = book('Jan', 'Fev', 'Mar', 'Bilan');
  for (const [n, v] of [['Jan', 1], ['Fev', 2], ['Mar', 4]] as const) {
    e.setCell(n, 'A3', v);
    e.setCell(n, 'B2', v * 10);
  }
  e.setFormula('Bilan', 'A1', '=SUM(Jan:Mar!A3)');
  e.setFormula('Bilan', 'A2', '=SUM(Jan:Mar!B2:B3)');
  return e;
}

describe('references 3D et structure', () => {
  test('insertion sur une seule feuille : la reference 3D ne bouge pas (comme Excel)', () => {
    const e = filled();
    e.insertRows('Fev', 0, 1);
    assert.equal(e.getFormula('Bilan', 'A1'), '=SUM(Jan:Mar!A3)');
    assert.equal(e.getValue('Bilan', 'A1'), 1 + 0 + 4);
  });

  test('feuilles groupees : la reference 3D suit l insertion de lignes', () => {
    const e = filled();
    e.insertRows('Jan', 0, 2, ['Jan', 'Fev', 'Mar']);
    assert.equal(e.getFormula('Bilan', 'A1'), '=SUM(Jan:Mar!A5)');
    assert.equal(e.getFormula('Bilan', 'A2'), '=SUM(Jan:Mar!B4:B5)');
    assert.equal(e.getValue('Bilan', 'A1'), 7);
    assert.equal(e.getValue('Fev', 'A5'), 2);
    assert.equal(e.getValue('Bilan', 'A2'), 70);
  });

  test('groupe incomplet : reference 3D inchangee', () => {
    const e = filled();
    e.insertColumns('Jan', 0, 1, ['Jan', 'Fev']);
    assert.equal(e.getFormula('Bilan', 'A2'), '=SUM(Jan:Mar!B2:B3)');
  });

  test('suppression de lignes groupees : reference detruite -> #REF!', () => {
    const e = filled();
    e.deleteRows('Jan', 2, 1, ['Jan', 'Fev', 'Mar']);
    assert.match(e.getFormula('Bilan', 'A1') ?? '', /#REF!/);
    assert.equal(String(e.getValue('Bilan', 'A1')), '#REF!');
    assert.equal(e.getFormula('Bilan', 'A2'), '=SUM(Jan:Mar!B2:B2)');
  });

  test('suppression d une feuille de bord : la reference se raccourcit', () => {
    const e = filled();
    e.removeSheet('Mar');
    assert.equal(e.getFormula('Bilan', 'A1'), '=SUM(Jan:Fev!A3)');
    assert.equal(e.getValue('Bilan', 'A1'), 3);
    e.removeSheet('Jan');
    assert.equal(e.getFormula('Bilan', 'A1'), '=SUM(Fev!A3)');
    assert.equal(e.getValue('Bilan', 'A1'), 2);
  });

  test('suppression de la premiere feuille : la borne passe a la suivante', () => {
    const e = filled();
    e.removeSheet('Jan');
    assert.equal(e.getFormula('Bilan', 'A1'), '=SUM(Fev:Mar!A3)');
    assert.equal(e.getValue('Bilan', 'A1'), 6);
  });

  test('suppression d une feuille intermediaire : reference inchangee', () => {
    const e = filled();
    e.removeSheet('Fev');
    assert.equal(e.getFormula('Bilan', 'A1'), '=SUM(Jan:Mar!A3)');
    assert.equal(e.getValue('Bilan', 'A1'), 5);
  });

  test('fonctions de reecriture : sans l ordre des onglets, retour a #REF! et API inchangee', () => {
    assert.equal(removeSheetInFormula('SUM(Jan:Mar!A1)', 'Mar'), 'SUM(#REF!A1)');
    assert.equal(removeSheetInFormula('SUM(Jan:Mar!A1)', 'Mar', ['Jan', 'Fev', 'Mar']), 'SUM(Jan:Fev!A1)');
    assert.equal(shiftFormula('SUM(Z!A1)', { sheet: 'Z', axis: 'row', at: 0, count: 1 }, 'Z'), 'SUM(Z!A2)');
  });
});
