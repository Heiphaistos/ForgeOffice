import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMarkdown, writeDocx, writeOdt } from '@forgeoffice/docx';
import { readTextFile } from '../src/textfile.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

test('txt : UTF-8 avec BOM et fins de ligne Windows, repli Windows-1252', async () => {
  assert.equal(await readTextFile('a.txt', enc('﻿Bonjour\r\nle monde\r\n')), 'Bonjour\nle monde');
  assert.equal(await readTextFile('a.txt', Uint8Array.from([0x45, 0xe9, 0x74, 0xe9])), 'Eété');
});

test('rtf, docx et odt : texte brut des paragraphes', async () => {
  assert.equal(await readTextFile('a.rtf', enc(String.raw`{\rtf1\ansi Bonjour\par Monde}`)), 'Bonjour\nMonde');
  const doc = readMarkdown(enc('Premier paragraphe\n\nSecond paragraphe')).document;
  assert.match(await readTextFile('a.docx', await writeDocx(doc)), /Premier paragraphe\n+Second paragraphe/);
  assert.match(await readTextFile('a.odt', await writeOdt(doc)), /Premier paragraphe\n+Second paragraphe/);
});

test('format inconnu refusé', async () => {
  await assert.rejects(readTextFile('a.exe', enc('x')));
});
