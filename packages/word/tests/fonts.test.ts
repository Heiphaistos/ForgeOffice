import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankDocument } from '@forgeoffice/docx';
import { remeasureWhenFontsReady, type FontSetLike } from '../../ui/src/logic/fontsReady.ts';
import { documentFonts } from '../src/layout/fonts.ts';

test('documentFonts : theme, defauts et styles, sans doublon', () => {
  const doc = createBlankDocument();
  doc.styles.styles.push({ id: 'X', name: 'X', type: 'paragraph', run: { font: 'Courier New' } } as never);
  const fonts = documentFonts(doc);
  assert.ok(fonts.includes(doc.theme.minorFont));
  assert.ok(fonts.includes('Courier New'));
  assert.equal(new Set(fonts).size, fonts.length);
});

test('pagination refaite quand les polices du document sont chargees', async () => {
  let open!: () => void;
  const gate = new Promise<void>((r) => { open = r; });
  const set: FontSetLike = { load: () => gate, ready: gate };
  const doc = createBlankDocument();
  const seen: string[][] = [];
  let paginations = 1; // pagination initiale faite avec les polices de repli
  remeasureWhenFontsReady(() => { paginations++; }, () => { seen.push(documentFonts(doc)); return seen[0]!; }, { set });
  assert.equal(paginations, 1);
  open();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(paginations, 2);
});
