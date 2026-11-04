import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellCount, createBlankWorkbook, getCell, putCell, readXlsx, writeXlsx } from '../src/index.ts';

test('gros classeur : 200 000 cellules ecrites puis relues en moins de 3 s', async () => {
  const wb = createBlankWorkbook();
  const s = wb.sheets[0];
  assert.ok(s);
  const rows = 20_000;
  const cols = 10;
  for (let r = 0; r < rows; r++) {
    const line = new Map();
    for (let c = 0; c < cols; c++) {
      line.set(c, c === 0 ? { value: `Ligne ${r % 500}` } : c === 9 ? { value: r * 2, formula: `B${r + 1}*2` } : { value: r * c + 0.5 });
    }
    s.cells.set(r, line);
  }
  putCell(s, 0, 0, { value: 'En-tete', styleId: 0 });
  const start = performance.now();
  const bytes = await writeXlsx(wb);
  const written = performance.now();
  const back = await readXlsx(bytes);
  const elapsed = performance.now() - start;
  const sheet = back.sheets[0];
  assert.ok(sheet);
  assert.equal(cellCount(sheet), rows * cols);
  assert.equal(getCell(sheet, 19_999, 9)?.formula, 'B20000*2');
  assert.equal(getCell(sheet, 12_345, 3)?.value, 12_345 * 3 + 0.5);
  assert.equal(getCell(sheet, 777, 0)?.value, 'Ligne 277');
  assert.ok(elapsed < 3000, `ecriture ${Math.round(written - start)} ms, total ${Math.round(elapsed)} ms`);
});
