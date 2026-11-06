// Double-clic sur la poignee de recopie : derniere ligne remplie, d'apres la colonne voisine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { autoFillEnd } from '../src/logic/fill.ts';

function sheetWith(entries: Record<string, string>) {
  const d = new Draft(createBlankWorkbook());
  for (const [addr, text] of Object.entries(entries)) {
    const m = addr.match(/^([A-Z]+)(\d+)$/)!;
    const col = m[1]!.charCodeAt(0) - 65;
    const e = parseEntry(text, false);
    if (e.ok) commitEntry(d, 0, Number(m[2]) - 1, col, e);
  }
  return d.wb.sheets[0]!;
}

test('recopie vers le bas jusqu\'a la fin de la colonne de gauche', () => {
  const sh = sheetWith({ A1: 'a', A2: 'b', A3: 'c', A4: 'd', B1: '1' });
  assert.equal(autoFillEnd(sh, { r1: 0, c1: 1, r2: 0, c2: 1 }), 3);
});

test('colonne de droite si celle de gauche est vide ; une cellule vide arrete la recopie', () => {
  const sh = sheetWith({ C1: '1', D1: 'x', D2: 'y', D4: 'z' });
  assert.equal(autoFillEnd(sh, { r1: 0, c1: 2, r2: 0, c2: 2 }), 1, 'la ligne 3 vide arrete a la ligne 2');
});

test('aucune colonne voisine : rien a remplir', () => {
  const sh = sheetWith({ B1: '1' });
  assert.equal(autoFillEnd(sh, { r1: 0, c1: 1, r2: 0, c2: 1 }), 0);
});
