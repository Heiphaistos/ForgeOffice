// Convertisseur EMF / WMF -> SVG : metafichiers reels exportes par PowerPoint 365 (rectangle, ellipse, triangle, ligne
// pointillee, texte, forme a courbes) ; rendu compare a l'oeil au PNG de PowerPoint (voir STATUS).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { metafileToSvg } from '../src/index.ts';

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

for (const name of ['shapes.emf', 'shapes.wmf']) {
  test(`metafile : ${name} -> SVG (formes, couleurs, trait pointille, texte)`, () => {
    const svg = metafileToSvg(fixture(name));
    assert.ok(svg?.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox='));
    if (!svg) return;
    assert.ok(svg.includes('fill="#ff0000"'), 'rectangle rouge');
    assert.ok(svg.includes('stroke="#0000ff"'), 'contour bleu');
    assert.ok(svg.includes('fill="#00c000"'), 'ellipse verte');
    assert.ok(svg.includes('fill="#0080ff"'), 'triangle');
    assert.ok(svg.includes('#800080'), 'ligne pointillee violette');
    assert.ok(/>Bonjour EMF<\/text>/.test(svg) && svg.includes('font-weight="bold"') && svg.includes('Arial'), 'texte gras Arial');
    assert.ok(!/NaN|undefined/.test(svg));
  });
}

test('metafile : donnees quelconques ou tronquees -> undefined ou SVG, jamais d\'exception ni de boucle', () => {
  assert.equal(metafileToSvg(new Uint8Array(0)), undefined);
  assert.equal(metafileToSvg(new Uint8Array(500).fill(7)), undefined);
  let seed = 7;
  const next = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
  for (const name of ['shapes.emf', 'shapes.wmf']) {
    const original = fixture(name);
    for (let i = 0; i < 300; i++) {
      const copy = original.slice(0, 100 + (next() % (original.length - 100)));
      for (let k = 0; k < 8; k++) copy[next() % copy.length] = next() & 0xff;
      assert.doesNotThrow(() => metafileToSvg(copy), `${name} tirage ${i}`);
    }
  }
});
