import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitSheetCss } from '../src/print.ts';

// Sans taille de papier explicite (ignoree par WebView2 des que le papier choisi est autre) : orientation, marge 0, mise a l'echelle.
test('fitSheetCss : diapositive 16:9 -> paysage, marge 0, reduite pour tenir sur A4/Lettre', () => {
  const css = fitSheetCss('.s', '.p', 960, 540);
  assert.match(css, /@page \{ size: landscape; margin: 0; \}/);
  assert.doesNotMatch(css, /@page \{[^}]*\d+pt/);
  const zoom = Number(/\.p \{[^}]*zoom: ([\d.]+)/.exec(css)?.[1]);
  assert.ok(Math.abs(zoom - (4 / 3) * (1056 / 1280)) < 1e-9, String(zoom)); // 1280 px de large -> 1056 px
});

test('fitSheetCss : page A5 portrait -> jamais agrandie (taille reelle), centree', () => {
  const css = fitSheetCss('.s', '.p', 420, 595);
  assert.match(css, /size: portrait/);
  assert.match(css, /zoom: 1\.3333/);
  assert.match(css, /justify-content: center/);
});
