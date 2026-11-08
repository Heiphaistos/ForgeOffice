// Valeur cible : solveur et classeur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { goalSeek, solve } from '../src/logic/goal-seek.ts';

test('solveur : lineaire, carre, sans solution', () => {
  const lin = solve((x) => 3 * x + 2, 20, 0);
  assert.ok(lin.found && Math.abs(lin.x - 6) < 1e-6);
  const sq = solve((x) => x * x, 49, 1);
  assert.ok(sq.found && Math.abs(Math.abs(sq.x) - 7) < 1e-6);
  assert.equal(solve((x) => x * x + 1, 0, 1).found, false);
});

test('valeur cible sur un classeur : B1 = A1*3+2 vaut 20 pour A1 = 6', () => {
  const d = new Draft(createBlankWorkbook());
  for (const [r, c, t] of [[0, 0, '5'], [0, 1, '=A1*3+2']] as const) {
    const e = parseEntry(t, false);
    if (e.ok) commitEntry(d, 0, r, c, e);
  }
  const res = goalSeek(d.wb, 0, { row: 0, col: 1 }, 20, { row: 0, col: 0 });
  assert.ok(res.found && Math.abs(res.x - 6) < 1e-6, JSON.stringify(res));
  assert.equal(d.get(0, 0, 0)?.value, 5, 'le classeur d\'origine n\'est pas modifie');
});
