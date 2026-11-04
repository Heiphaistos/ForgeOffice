import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ALIASED_FONTS, EMBEDDED_FONTS } from '../src/logic/fonts.ts';
import { whenFontsReady } from '../src/logic/fontsReady.ts';

const css = readFileSync(new URL('../src/fonts.css', import.meta.url), 'utf8');

test('fonts.css : chaque fichier reference existe dans packages/ui/fonts', () => {
  const files = [...css.matchAll(/url\("\.\.\/fonts\/([^"]+)"\)/g)].map((m) => m[1] ?? '');
  assert.ok(files.length >= 50);
  for (const f of files) assert.ok(existsSync(new URL(`../fonts/${f}`, import.meta.url)), f);
});

test('fonts.css : chaque famille embarquee ou aliasee a un @font-face, local() avant url()', () => {
  for (const family of [...EMBEDDED_FONTS, ...ALIASED_FONTS]) assert.ok(css.includes(`font-family: "${family}"`), family);
  for (const src of css.matchAll(/src: ([^;]+);/g)) assert.ok((src[1] ?? '').startsWith('local('), src[1]);
});

test('whenFontsReady : sans navigateur, resolue aussitot', async () => {
  await whenFontsReady(['Calibri']);
});
