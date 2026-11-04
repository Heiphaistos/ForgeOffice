// Export CSV/TSV du Tableur : les textes commencant par = + - @ sont neutralises par defaut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook, setValue } from '@forgeoffice/xlsx';
import { WorkbookEngine } from '../src/logic/engine.ts';
import { serialize } from '../src/ui/io.ts';

function sample() {
  const wb = createBlankWorkbook();
  const s = wb.sheets[0]!;
  setValue(s, 0, 0, '=HYPERLINK("http://x";"clic")');
  setValue(s, 0, 1, '@SUM(A1)');
  setValue(s, 0, 2, 'normal');
  const eng = new WorkbookEngine();
  eng.sync(wb);
  return { wb, eng };
}

const text = (b: Uint8Array) => new TextDecoder().decode(b);

test('CSV : injection de formules neutralisee par defaut', async () => {
  const { wb, eng } = sample();
  const csv = text(await serialize(wb, eng, 'csv', 0));
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'@SUM/);
  assert.doesNotMatch(csv, /(^|[;"﻿])=HYPERLINK/);
  const tsv = text(await serialize(wb, eng, 'tsv', 0));
  assert.match(tsv, /'=HYPERLINK/);
});

test('CSV : la case decochee laisse le texte tel quel', async () => {
  const { wb, eng } = sample();
  const csv = text(await serialize(wb, eng, 'csv', 0, false));
  assert.match(csv, /=HYPERLINK/);
  assert.doesNotMatch(csv, /'=HYPERLINK/);
});
