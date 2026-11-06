// Index d'intervalles des dependances et statistiques de colonne en cache : exactitude et performance.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DependencyIndex, Recorder } from '../src/engine/deps.ts';
import { FormulaEngine } from '../src/index.ts';

describe('index de dependances (arbre d\'intervalles)', () => {
  test('meme resultat qu\'une recherche exhaustive sur des zones aleatoires', () => {
    let seed = 12345;
    const rnd = (n: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const idx = new DependencyIndex<number>();
    const areas: { sheet: number; r1: number; c1: number; r2: number; c2: number }[][] = [];
    for (let n = 0; n < 300; n++) {
      const rec = new Recorder();
      const list = [];
      for (let k = 0; k < 3; k++) {
        const r1 = rnd(5000);
        const c1 = rnd(6);
        const a = { sheet: rnd(2), r1, c1, r2: r1 + (rnd(3) === 0 ? rnd(40) : rnd(4000)), c2: c1 + rnd(3) };
        list.push(a);
        rec.areas.push(a);
      }
      areas.push(list);
      idx.set(n, rec);
    }
    const check = (): void => {
      for (let t = 0; t < 400; t++) {
        const s = rnd(2), r = rnd(9000), c = rnd(9);
        const got = new Set<number>();
        idx.dependents(s, r, c, (n) => got.add(n));
        const want = new Set<number>();
        areas.forEach((list, n) => {
          if (list.some((a) => a.sheet === s && r >= a.r1 && r <= a.r2 && c >= a.c1 && c <= a.c2)) want.add(n);
        });
        assert.deepEqual([...got].sort((x, y) => x - y), [...want].sort((x, y) => x - y));
      }
    };
    check();
    for (let n = 0; n < 300; n += 3) {
      idx.remove(n);
      areas[n] = [];
    }
    check();
  });
});

describe('totaux cumules', () => {
  test('100 000 totaux cumules SUM($A$1:A1) calcules et recalcules en moins de 3 s', () => {
    const N = 100000;
    const e = new FormulaEngine({ locale: 'en-US' });
    e.addSheet('P');
    const t0 = performance.now();
    e.batch(() => {
      for (let i = 0; i < N; i++) {
        e.setCell('P', { row: i, col: 0 }, i + 1);
        e.setFormula('P', { row: i, col: 1 }, `SUM($A$1:A${i + 1})`);
      }
    });
    assert.equal(e.getValue('P', `B${N}`), (N * (N + 1)) / 2);
    const t1 = performance.now();
    e.setCell('P', 'A1', 1001);
    assert.equal(e.getValue('P', `B${N}`), (N * (N + 1)) / 2 + 1000);
    assert.equal(e.getValue('P', 'B1'), 1001);
    e.setCell('P', 'A50000', 0);
    assert.equal(e.getValue('P', `B${N}`), (N * (N + 1)) / 2 + 1000 - 50000);
    assert.equal(e.getValue('P', 'B49999'), (49999 * 50000) / 2 + 1000);
    assert.equal(e.getValue('P', 'B50000'), (49999 * 50000) / 2 + 1000);
    const t2 = performance.now();
    // seuils larges : les fichiers de tests tournent en parallele (mesure isolee : saisie ~0,9 s, recalcul complet ~0,3 s)
    assert.ok(t1 - t0 < 6000, `saisie + calcul ${(t1 - t0).toFixed(0)} ms`);
    assert.ok(t2 - t1 < 3000, `2 recalculs de 100 000 totaux ${(t2 - t1).toFixed(0)} ms`);
  });

  test('grandes zones : texte, vides, booleens, erreurs, formules et moyenne identiques a la lecture directe', () => {
    const e = new FormulaEngine({ locale: 'en-US' });
    e.addSheet('S');
    e.batch(() => {
      for (let i = 1; i <= 1500; i++) {
        if (i % 7 === 0) e.setCell('S', `A${i}`, 'x');
        else if (i % 11 === 0) e.setCell('S', `A${i}`, true);
        else if (i % 13 !== 0) e.setCell('S', `A${i}`, i * 0.1);
        e.setFormula('S', `B${i}`, `IFERROR(A${i}*2,0)`);
      }
    });
    e.setFormula('S', 'D1', 'SUM(A1:B1500)');
    e.setFormula('S', 'D2', 'SUM(INDEX(A1:B1500,0,0))');
    e.setFormula('S', 'D3', 'AVERAGE(A1:B1500)');
    e.setFormula('S', 'D4', 'COUNT(A1:B1500)');
    e.setFormula('S', 'D5', 'AVERAGE(INDEX(A1:B1500,0,0))');
    e.setFormula('S', 'D6', 'COUNT(INDEX(A1:B1500,0,0))');
    const near = (a: unknown, b: unknown): void => assert.ok(Math.abs(Number(a) - Number(b)) < 1e-6, `${String(a)} != ${String(b)}`);
    near(e.getValue('S', 'D1'), e.getValue('S', 'D2'));
    near(e.getValue('S', 'D3'), e.getValue('S', 'D5'));
    assert.equal(e.getValue('S', 'D4'), e.getValue('S', 'D6'));
    e.setCell('S', 'A700', 5);
    e.setCell('S', 'A701', 'texte');
    near(e.getValue('S', 'D1'), e.getValue('S', 'D2'));
    e.setCell('S', 'A700', 5000);
    near(e.getValue('S', 'D4'), e.getValue('S', 'D6'));
    assert.equal(e.getValue('S', 'D2'), e.getValue('S', 'D1'));
  });

  test('cumul dans la meme colonne : aucune fausse reference circulaire', () => {
    const e = new FormulaEngine({ locale: 'en-US' });
    e.addSheet('S');
    e.batch(() => {
      for (let i = 1; i <= 1200; i++) {
        e.setCell('S', `A${i}`, 1);
        e.setFormula('S', `B${i}`, i === 1 ? 'A1' : `SUM(B$1:B${i - 1})/${i - 1}`);
      }
    });
    assert.equal(e.getValue('S', 'B1200'), 1);
    assert.equal(e.getValue('S', 'B900'), 1);
    assert.deepEqual(e.circularReferences(), []);
  });

  test('la formule qui somme une plage plus bas dans sa propre colonne n\'est pas circulaire', () => {
    const e = new FormulaEngine({ locale: 'en-US' });
    e.addSheet('S');
    e.batch(() => {
      for (let i = 100; i <= 1000; i++) e.setCell('S', `A${i}`, 1);
      e.setFormula('S', 'A50', 'SUM(A100:A1000)');
      e.setFormula('S', 'A60', 'A50+1');
    });
    assert.equal(e.getValue('S', 'A50'), 901);
    assert.equal(e.getValue('S', 'A60'), 902);
    assert.deepEqual(e.circularReferences(), []);
  });
});
