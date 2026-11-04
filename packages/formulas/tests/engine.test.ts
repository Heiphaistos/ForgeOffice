// Moteur de classeur : recalcul incremental, debordement, circularite, structure, noms, tableaux.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FormulaEngine, FormulaError, translateFormula, type CellChange, type Scalar } from '../src/index.ts';

function book(...sheets: string[]): FormulaEngine {
  const e = new FormulaEngine({ locale: 'en-US' });
  for (const s of sheets.length ? sheets : ['Feuil1']) e.addSheet(s);
  return e;
}

const code = (v: Scalar): string | undefined => (v instanceof FormulaError ? v.code : undefined);

describe('recalcul incremental', () => {
  test('somme et dependances en chaine', () => {
    const e = book();
    e.setCell('Feuil1', 'A1', 1);
    e.setCell('Feuil1', 'A2', 2);
    e.setFormula('Feuil1', 'A3', '=SUM(A1:A2)');
    e.setFormula('Feuil1', 'B1', '=A3*10');
    assert.equal(e.getValue('Feuil1', 'A3'), 3);
    assert.equal(e.getValue('Feuil1', 'B1'), 30);
    e.setCell('Feuil1', 'A1', 5);
    assert.equal(e.getValue('Feuil1', 'A3'), 7);
    assert.equal(e.getValue('Feuil1', 'B1'), 70);
    e.clearCell('Feuil1', 'A2');
    assert.equal(e.getValue('Feuil1', 'B1'), 50);
  });

  test('formule ecrite avant ses precedents', () => {
    const e = book();
    e.setFormula('Feuil1', 'C1', '=A1+B1');
    assert.equal(e.getValue('Feuil1', 'C1'), 0);
    e.setCell('Feuil1', 'A1', 2);
    e.setCell('Feuil1', 'B1', 3);
    assert.equal(e.getValue('Feuil1', 'C1'), 5);
  });

  test('ecouteurs de changement', () => {
    const e = book();
    const seen: CellChange[][] = [];
    const off = e.onChange((c) => seen.push(c));
    e.setCell('Feuil1', 'A1', 1);
    e.setFormula('Feuil1', 'B1', '=A1*2');
    e.setCell('Feuil1', 'A1', 4);
    const last = seen[seen.length - 1] ?? [];
    assert.ok(last.some((c) => c.row === 0 && c.col === 1 && c.sheet === 'Feuil1'));
    off();
    const n = seen.length;
    e.setCell('Feuil1', 'A1', 5);
    assert.equal(seen.length, n);
  });

  test('batch : un seul recalcul', () => {
    const e = book();
    let calls = 0;
    e.onChange(() => calls++);
    e.batch(() => {
      e.setCell('Feuil1', 'A1', 1);
      e.setFormula('Feuil1', 'A2', '=A1+1');
      e.setFormula('Feuil1', 'A3', '=A2+1');
    });
    assert.equal(calls, 1);
    assert.equal(e.getValue('Feuil1', 'A3'), 3);
  });

  test('colonne entiere : nouvelle cellule prise en compte', () => {
    const e = book();
    e.setCell('Feuil1', 'A1', 1);
    e.setFormula('Feuil1', 'B1', '=SUM(A:A)');
    e.setCell('Feuil1', 'A500', 10);
    assert.equal(e.getValue('Feuil1', 'B1'), 11);
    e.setFormula('Feuil1', 'B2', '=COUNTA(A:A)');
    e.setCell('Feuil1', 'A2000', 'x');
    assert.equal(e.getValue('Feuil1', 'B2'), 3);
  });

  test('INDIRECT : dependance dynamique', () => {
    const e = book();
    e.setCell('Feuil1', 'A1', 'B1');
    e.setCell('Feuil1', 'B1', 7);
    e.setCell('Feuil1', 'B2', 9);
    e.setFormula('Feuil1', 'C1', '=INDIRECT(A1)');
    assert.equal(e.getValue('Feuil1', 'C1'), 7);
    e.setCell('Feuil1', 'A1', 'B2');
    assert.equal(e.getValue('Feuil1', 'C1'), 9);
    e.setCell('Feuil1', 'B2', 11);
    assert.equal(e.getValue('Feuil1', 'C1'), 11);
  });

  test('fonctions volatiles recalculees a chaque modification', () => {
    let n = 0;
    const e = new FormulaEngine({ random: () => ++n / 100, now: () => new Date(2024, 1, 29, 12) });
    e.addSheet('S');
    e.setFormula('S', 'A1', '=RAND()');
    const first = e.getValue('S', 'A1');
    e.setCell('S', 'B1', 1);
    assert.notEqual(e.getValue('S', 'A1'), first);
    e.setFormula('S', 'A2', '=TODAY()');
    assert.equal(e.getValue('S', 'A2'), 45351);
    e.recalculate();
    assert.equal(e.getValue('S', 'A2'), 45351);
  });

  test('erreurs propagees', () => {
    const e = book();
    e.setFormula('Feuil1', 'A1', '=1/0');
    e.setFormula('Feuil1', 'A2', '=A1+1');
    e.setFormula('Feuil1', 'A3', '=IFERROR(A2,"ok")');
    assert.equal(code(e.getValue('Feuil1', 'A2')), '#DIV/0!');
    assert.equal(e.getValue('Feuil1', 'A3'), 'ok');
    e.setFormula('Feuil1', 'A4', '=Inconnu+1');
    assert.equal(code(e.getValue('Feuil1', 'A4')), '#NAME?');
    e.setFormula('Feuil1', 'A5', '=Absente!A1');
    assert.equal(code(e.getValue('Feuil1', 'A5')), '#REF!');
  });
});

describe('tableaux dynamiques', () => {
  test('debordement, operateur #, blocage #EPARS!', () => {
    const e = book();
    e.setFormula('Feuil1', 'D1', '=SEQUENCE(3)');
    assert.equal(e.getValue('Feuil1', 'D2'), 2);
    assert.equal(e.getValue('Feuil1', 'D3'), 3);
    assert.equal(e.spillRange('Feuil1', 'D1'), 'D1:D3');
    e.setFormula('Feuil1', 'E1', '=SUM(D1#)');
    assert.equal(e.getValue('Feuil1', 'E1'), 6);
    e.setFormula('Feuil1', 'F1', '=D3*2');
    assert.equal(e.getValue('Feuil1', 'F1'), 6);
    e.setCell('Feuil1', 'D2', 'x');
    assert.equal(code(e.getValue('Feuil1', 'D1')), '#SPILL!');
    assert.equal(e.getValue('Feuil1', 'D3'), null);
    assert.equal(e.getValue('Feuil1', 'F1'), 0);
    e.clearCell('Feuil1', 'D2');
    assert.equal(e.getValue('Feuil1', 'D1'), 1);
    assert.equal(e.getValue('Feuil1', 'F1'), 6);
    assert.equal(e.getValue('Feuil1', 'E1'), 6);
  });

  test('changement de taille du debordement', () => {
    const e = book();
    e.setCell('Feuil1', 'A1', 2);
    e.setFormula('Feuil1', 'B1', '=SEQUENCE(A1)');
    e.setFormula('Feuil1', 'C1', '=COUNT(B:B)');
    assert.equal(e.getValue('Feuil1', 'C1'), 2);
    e.setCell('Feuil1', 'A1', 5);
    assert.equal(e.getValue('Feuil1', 'B5'), 5);
    assert.equal(e.getValue('Feuil1', 'C1'), 5);
    e.setCell('Feuil1', 'A1', 1);
    assert.equal(e.getValue('Feuil1', 'B5'), null);
    assert.equal(e.getValue('Feuil1', 'C1'), 1);
    assert.equal(e.spillRange('Feuil1', 'B1'), undefined);
  });

  test('reference a une plage = debordement', () => {
    const e = book();
    e.setCell('Feuil1', 'A1', 1);
    e.setCell('Feuil1', 'A2', 2);
    e.setFormula('Feuil1', 'B1', '=A1:A2*10');
    assert.equal(e.getValue('Feuil1', 'B2'), 20);
  });
});

describe('references circulaires', () => {
  test('circularite simple et croisee -> 0', () => {
    const e = book();
    e.setFormula('Feuil1', 'A1', '=A1+1');
    assert.equal(e.getValue('Feuil1', 'A1'), 0);
    e.setFormula('Feuil1', 'F1', '=F2+1');
    e.setFormula('Feuil1', 'F2', '=F1+1');
    assert.equal(e.getValue('Feuil1', 'F1'), 0);
    assert.equal(e.getValue('Feuil1', 'F2'), 0);
    assert.ok(e.circularReferences().includes('Feuil1!F1'));
    e.setCell('Feuil1', 'F2', 3);
    assert.equal(e.getValue('Feuil1', 'F1'), 4);
    assert.deepEqual(e.circularReferences(), []);
  });

  test('calcul iteratif', () => {
    const e = new FormulaEngine({ iterative: true, maxIterations: 100, maxChange: 0 });
    e.addSheet('S');
    e.setFormula('S', 'A1', '=A1+1');
    assert.equal(e.getValue('S', 'A1'), 100);
    const g = new FormulaEngine({ iterative: true, maxIterations: 1000, maxChange: 1e-12 });
    g.addSheet('S');
    g.setCell('S', 'B1', 2);
    g.setFormula('S', 'A1', '=IF(A1=0,1,(A1+B1/A1)/2)');
    const v = g.getValue('S', 'A1');
    assert.ok(typeof v === 'number' && Math.abs(v - Math.SQRT2) < 1e-9);
  });

  test('longue chaine sans debordement de pile', () => {
    const e = book();
    e.batch(() => {
      e.setCell('Feuil1', 'A1', 1);
      for (let i = 20000; i >= 2; i--) e.setFormula('Feuil1', `A${i}`, `=A${i - 1}+1`);
    });
    assert.equal(e.getValue('Feuil1', 'A20000'), 20000);
    e.setCell('Feuil1', 'A1', 10);
    assert.equal(e.getValue('Feuil1', 'A20000'), 20009);
  });
});

describe('feuilles', () => {
  test('ajout, renommage, suppression', () => {
    const e = book('Feuil1', 'Data');
    e.setCell('Data', 'A1', 21);
    e.setFormula('Feuil1', 'A1', '=Data!A1*2');
    assert.equal(e.getValue('Feuil1', 'A1'), 42);
    e.renameSheet('Data', 'Mes données');
    assert.equal(e.getFormula('Feuil1', 'A1'), "='Mes données'!A1*2");
    assert.equal(e.getValue('Feuil1', 'A1'), 42);
    e.removeSheet('Mes données');
    assert.equal(e.getFormula('Feuil1', 'A1'), '=#REF!A1*2');
    assert.equal(code(e.getValue('Feuil1', 'A1')), '#REF!');
    assert.deepEqual(e.sheetNames(), ['Feuil1']);
  });

  test('reference vers une feuille creee ensuite', () => {
    const e = book();
    e.setFormula('Feuil1', 'A1', '=Plus!B2');
    assert.equal(code(e.getValue('Feuil1', 'A1')), '#REF!');
    e.addSheet('Plus');
    e.setCell('Plus', 'B2', 5);
    assert.equal(e.getValue('Feuil1', 'A1'), 5);
  });

  test('references 3D', () => {
    const e = book('F1', 'F2', 'F3');
    e.setCell('F1', 'A1', 1);
    e.setCell('F2', 'A1', 2);
    e.setCell('F3', 'A1', 3);
    e.setFormula('F1', 'B1', '=SUM(F1:F3!A1)');
    assert.equal(e.getValue('F1', 'B1'), 6);
    e.setCell('F2', 'A1', 20);
    assert.equal(e.getValue('F1', 'B1'), 24);
    assert.equal(e.addSheet(), 'Feuil4');
  });

  test('noms de feuilles invalides et erreurs', () => {
    const e = book();
    assert.throws(() => e.addSheet('Feuil1'));
    assert.throws(() => e.addSheet('a/b'));
    assert.throws(() => e.addSheet('x'.repeat(32)));
    assert.throws(() => e.removeSheet('Feuil1'));
    assert.throws(() => e.getValue('Nope', 'A1'));
    assert.throws(() => e.setCell('Feuil1', 'ZZZZ1', 1));
    assert.throws(() => e.setFormula('Feuil1', 'A1', '=SUM(1,'));
  });
});

describe('insertion et suppression', () => {
  test('lignes', () => {
    const e = book();
    e.setCell('Feuil1', 'A1', 1);
    e.setCell('Feuil1', 'A2', 2);
    e.setCell('Feuil1', 'A3', 3);
    e.setFormula('Feuil1', 'B1', '=SUM(A1:A3)');
    e.setFormula('Feuil1', 'C1', '=A3');
    e.insertRows('Feuil1', 1, 2);
    assert.equal(e.getFormula('Feuil1', 'B1'), '=SUM(A1:A5)');
    assert.equal(e.getFormula('Feuil1', 'C1'), '=A5');
    assert.equal(e.getValue('Feuil1', 'A5'), 3);
    assert.equal(e.getValue('Feuil1', 'B1'), 6);
    e.deleteRows('Feuil1', 4, 1);
    assert.equal(e.getFormula('Feuil1', 'B1'), '=SUM(A1:A4)');
    assert.equal(e.getFormula('Feuil1', 'C1'), '=#REF!');
    assert.equal(code(e.getValue('Feuil1', 'C1')), '#REF!');
    assert.equal(e.getValue('Feuil1', 'B1'), 3);
  });

  test('colonnes et autres feuilles', () => {
    const e = book('A', 'B');
    e.setCell('A', 'C1', 5);
    e.setFormula('A', 'A1', '=C1*2');
    e.setFormula('B', 'A1', '=A!C1+A!D1');
    e.insertColumns('A', 1, 1);
    assert.equal(e.getFormula('A', 'A1'), '=D1*2');
    assert.equal(e.getFormula('B', 'A1'), '=A!D1+A!E1');
    assert.equal(e.getValue('B', 'A1'), 5);
    e.deleteColumns('A', 3, 1);
    assert.equal(e.getFormula('B', 'A1'), '=A!#REF!+A!D1');
    assert.equal(code(e.getValue('A', 'A1')), '#REF!');
  });

  test('suppression d une plage entiere', () => {
    const e = book();
    e.setFormula('Feuil1', 'A1', '=SUM(B2:B3)');
    e.deleteRows('Feuil1', 1, 2);
    assert.equal(e.getFormula('Feuil1', 'A1'), '=SUM(#REF!)');
  });

  test('recopie (translateFormula)', () => {
    assert.equal(translateFormula('=A1+$B$2+B$3+$C4', 2, 1), '=B3+$B$2+C$3+$C6');
    assert.equal(translateFormula('=Feuil2!C4+A:A+1:1', 1, 1), '=Feuil2!D5+B:B+2:2');
    assert.equal(translateFormula('=A1', -1, 0), '=#REF!');
    assert.equal(translateFormula('=SUM(A1:B2)', 0, 0), '=SUM(A1:B2)');
    assert.equal(translateFormula('="A1"&A1', 1, 0), '="A1"&A2');
  });
});

describe('noms et tableaux', () => {
  test('noms definis globaux et de feuille', () => {
    const e = book('F1', 'F2');
    e.defineName('Taux', '0.2');
    e.setFormula('F1', 'A1', '=100*Taux');
    assert.equal(e.getValue('F1', 'A1'), 20);
    e.setCell('F2', 'A1', 5);
    e.defineName('Base', 'F2!$A$1');
    e.setFormula('F1', 'A2', '=Base*2');
    assert.equal(e.getValue('F1', 'A2'), 10);
    e.setCell('F2', 'A1', 6);
    assert.equal(e.getValue('F1', 'A2'), 12);
    e.defineName('Taux', '0.5', 'F1');
    assert.equal(e.getValue('F1', 'A1'), 50);
    e.defineName('Carre', 'LAMBDA(x,x*x)');
    e.setFormula('F1', 'A3', '=Carre(7)');
    assert.equal(e.getValue('F1', 'A3'), 49);
    assert.throws(() => e.defineName('A1', '1'));
    e.removeName('Taux', 'F1');
    assert.equal(e.getValue('F1', 'A1'), 20);
  });

  test('references structurees', () => {
    const e = book();
    e.setCell('Feuil1', 'A1', 'Produit');
    e.setCell('Feuil1', 'B1', 'Prix');
    e.setCell('Feuil1', 'A2', 'x');
    e.setCell('Feuil1', 'B2', 10);
    e.setCell('Feuil1', 'A3', 'y');
    e.setCell('Feuil1', 'B3', 15);
    e.defineTable({ name: 'Ventes', sheet: 'Feuil1', ref: 'A1:B3' });
    e.setFormula('Feuil1', 'D1', '=SUM(Ventes[Prix])');
    e.setFormula('Feuil1', 'D2', '=ROWS(Ventes[#All])');
    e.setFormula('Feuil1', 'C2', '=Ventes[@Prix]*2');
    e.setFormula('Feuil1', 'D3', '=Ventes[[#Headers],[Prix]]');
    assert.equal(e.getValue('Feuil1', 'D1'), 25);
    assert.equal(e.getValue('Feuil1', 'D2'), 3);
    assert.equal(e.getValue('Feuil1', 'C2'), 20);
    assert.equal(e.getValue('Feuil1', 'D3'), 'Prix');
    e.setCell('Feuil1', 'B3', 30);
    assert.equal(e.getValue('Feuil1', 'D1'), 40);
  });
});

describe('saisie et syntaxe francaise', () => {
  test('setInput et getFormula en francais', () => {
    const e = new FormulaEngine();
    e.addSheet('Feuil1');
    e.setInput('Feuil1', 'A1', '12,5');
    e.setInput('Feuil1', 'A2', '=SOMME(A1;2,5)');
    e.setInput('Feuil1', 'A3', 'VRAI');
    e.setInput('Feuil1', 'A4', '#N/A');
    assert.equal(e.getValue('Feuil1', 'A1'), 12.5);
    assert.equal(e.getValue('Feuil1', 'A2'), 15);
    assert.equal(e.getFormula('Feuil1', 'A2'), '=SUM(A1,2.5)');
    assert.equal(e.getFormula('Feuil1', 'A2', 'fr'), '=SOMME(A1;2,5)');
    assert.equal(e.getValue('Feuil1', 'A3'), true);
    assert.equal(code(e.getValue('Feuil1', 'A4')), '#N/A');
    e.setFormula('Feuil1', 'B1', '=SI(A1>10;"grand";"petit")', 'fr');
    assert.equal(e.getValue('Feuil1', 'B1'), 'grand');
    e.setFormula('Feuil1', 'B2', '=FORMULATEXT(A2)');
    assert.equal(e.getValue('Feuil1', 'B2'), '=SOMME(A1;2,5)');
    e.setFormula('Feuil1', 'B3', '="x"&A1');
    assert.equal(e.getValue('Feuil1', 'B3'), 'x12,5');
    assert.equal(e.evaluate('=A1*2'), 25);
    assert.equal(e.evaluate('=MOYENNE(A1;A2)', 'Feuil1', 'fr'), 13.75);
  });
});

describe('performance', () => {
  test('100 000 formules recalculees en moins de 2 s', () => {
    const e = new FormulaEngine();
    e.addSheet('P');
    const t0 = performance.now();
    e.batch(() => {
      e.setCell('P', 'C1', 2);
      for (let i = 0; i < 100000; i++) {
        e.setCell('P', { row: i, col: 0 }, i);
        e.setFormula('P', { row: i, col: 1 }, `=A${i + 1}*$C$1+1`);
      }
    });
    const build = performance.now() - t0;
    assert.equal(e.getValue('P', 'B100000'), 199999);
    const t1 = performance.now();
    e.setCell('P', 'C1', 3);
    const recalc = performance.now() - t1;
    assert.equal(e.getValue('P', 'B100000'), 299998);
    assert.ok(recalc < 2000, `recalcul ${recalc.toFixed(0)} ms`);
    assert.ok(build < 4000, `saisie + calcul ${build.toFixed(0)} ms`);
  });
});
