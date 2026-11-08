// Afficher les details d'un tableau croise : lignes sources d'une cellule de valeur.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Scalar } from '@forgeoffice/formulas';
import { computePivot } from '../src/logic/pivot.ts';
import { PIVOT_LABELS } from '../src/ui/pivotLabels.ts';

const data: Scalar[][] = [['Fruit', 'Mois', 'Qte'], ['Pomme', 'Jan', 1], ['Pomme', 'Fev', 2], ['Poire', 'Jan', 3], ['Pomme', 'Jan', 4]];
const def = { sourceSheet: 'S', source: { r1: 0, c1: 0, r2: 4, c2: 2 }, rows: [0], cols: [1], values: [{ field: 2, fn: 'sum' as const }], filters: [] };

test('detail : lignes de la cellule Pomme / Jan, ligne de total et total general', () => {
  const res = computePivot(def, data, (v) => String(v), PIVOT_LABELS);
  const cells = res.cells.flat().filter((c) => c.kind === 'value' && c.at);
  const pommeJan = cells.find((c) => c.at?.path === '/Pomme' && c.at.col === 'Jan');
  assert.ok(pommeJan?.at);
  assert.deepEqual(res.detail(pommeJan.at), [['Fruit', 'Mois', 'Qte'], ['Pomme', 'Jan', 1], ['Pomme', 'Jan', 4]]);
  assert.equal(res.detail({ path: '/Pomme', col: '*' }).length, 4, 'total de la ligne Pomme : 3 lignes + en-tete');
  assert.equal(res.detail({ path: '', col: '*' }).length, 5, 'total general : toutes les lignes');
});
