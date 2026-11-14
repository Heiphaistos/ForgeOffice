// Non-regression du banc de fuzz (scripts/fuzz) : chaque entree doit etre refusee proprement (Error lisible) ou lue, sans
// depassement de pile, blocage ni memoire folle. Le corpus tests/fuzz-corpus/<cible>/*.bin rejoue les cas trouves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseXml, pushAll, XmlError } from '@forgeoffice/opc';
import { readHtml } from '@forgeoffice/docx';
import { readFopub } from '../../publisher/src/fopub.ts';
import { opmlToMarkdown } from '../../convert/src/opml.ts';
import { analyze } from '../../pdf/src/analyze.ts';

const CORPUS = join(import.meta.dirname, '../../../tests/fuzz-corpus');
const RUN: Record<string, (b: Uint8Array) => unknown> = {
  fopub: readFopub,
  pdflib: analyze,
};

/** Resout ou rejette avec une Error « propre » (ni TypeError interne ni RangeError de pile). */
async function clean(run: () => unknown): Promise<void> {
  try {
    await run();
  } catch (e) {
    assert.ok(e instanceof Error, 'exception non-Error');
    assert.ok(!(e instanceof TypeError) && !/call stack|Invalid string length|Invalid array length/.test(e.message), `erreur interne : ${e.name}: ${e.message}`);
  }
}

for (const target of existsSync(CORPUS) ? readdirSync(CORPUS) : []) {
  for (const file of readdirSync(join(CORPUS, target))) {
    test(`fuzz corpus ${target}/${file}`, async () => {
      const run = RUN[target];
      assert.ok(run, `cible inconnue : ${target}`);
      await clean(() => run(new Uint8Array(readFileSync(join(CORPUS, target, file)))));
    });
  }
}

test('XML : imbrication trop profonde refusee (pas de depassement de pile chez les lecteurs recursifs)', () => {
  const deep = (n: number): string => `<a>${'<b>'.repeat(n)}${'</b>'.repeat(n)}</a>`;
  assert.equal(parseXml(deep(200)).name, 'a');
  assert.throws(() => parseXml(deep(100_000)), XmlError);
});

test('pushAll : pas de limite d arguments', () => {
  const out: number[] = [];
  pushAll(out, new Array<number>(500_000).fill(1));
  assert.equal(out.length, 500_000);
});

test('HTML : 300 000 elements freres ne depassent pas la pile', async () => {
  await clean(() => readHtml(`<ul>${'<li/>'.repeat(300_000)}</ul>`));
});

test('OPML : 100 000 niveaux d imbrication ne font pas exploser le texte produit', () => {
  const md = opmlToMarkdown(`<opml><body>${'<outline text="x">'.repeat(100_000)}</body></opml>`);
  assert.ok(md.length < 20_000_000);
});
