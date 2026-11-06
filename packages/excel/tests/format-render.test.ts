import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { applyEdits } from '../src/logic/format-edits.ts';
import { GRADIENT_KINDS, PATTERNS, buildGradient, joinFill, patternPixel, resolveFill, splitFill } from '../src/logic/fill-spec.ts';
import { cellLook } from '../src/logic/look.ts';
import { fitRows, wrapCount } from '../src/logic/rowfit.ts';
import { styleAt } from '../src/logic/styles.ts';

const hex = (c: { rgb?: string } | undefined, fb: string): string => (c?.rgb ? `#${c.rgb.slice(-6)}` : fb);

test('remplissage : couleur + motif <-> modele, uni et aucun', () => {
  const red = { rgb: 'FFFF0000' };
  assert.deepEqual(splitFill(joinFill({ bg: red, pattern: 'none', patternColor: null })), { bg: red, pattern: 'none', patternColor: null });
  const f = joinFill({ bg: { rgb: 'FFFFFF00' }, pattern: 'lightTrellis', patternColor: red });
  assert.deepEqual(f, { type: 'pattern', pattern: 'lightTrellis', fg: red, bg: { rgb: 'FFFFFF00' } });
  assert.deepEqual(splitFill(f), { bg: { rgb: 'FFFFFF00' }, pattern: 'lightTrellis', patternColor: red });
  assert.deepEqual(joinFill({ bg: null, pattern: 'none', patternColor: null }), { type: 'pattern', pattern: 'none' });
  assert.equal(resolveFill(joinFill({ bg: red, pattern: 'none', patternColor: null }), hex), null, 'uni : couleur plate, pas de motif a dessiner');
  assert.deepEqual(resolveFill(f, hex), { kind: 'pattern', pattern: 'lightTrellis', fg: '#FF0000', bg: '#FFFF00' });
});

test('degrades : 6 styles x 4 variantes, points d arret et angles', () => {
  const a = { rgb: 'FF111111' };
  const b = { rgb: 'FFEEEEEE' };
  for (const k of GRADIENT_KINDS) for (let v = 1; v <= 4; v++) assert.ok(buildGradient(k, v, a, b).stops.length >= 2, `${k}/${v}`);
  assert.equal(buildGradient('horizontal', 1, a, b).degree, 90);
  assert.equal(buildGradient('vertical', 1, a, b).degree, 0);
  assert.deepEqual(buildGradient('horizontal', 2, a, b).stops.map((s) => s.color), [b, a]);
  assert.deepEqual(buildGradient('horizontal', 3, a, b).stops.map((s) => s.position), [0, 0.5, 1]);
  const corner = buildGradient('corner', 4, a, b);
  assert.deepEqual([corner.gradient, corner.left, corner.top], ['path', 1, 1]);
  const g = resolveFill(buildGradient('center', 1, a, b), hex);
  assert.ok(g && g.kind === 'gradient' && g.path && g.focus.x === 0.5);
});

test('motifs : les 17 motifs dessinent, densites ordonnees', () => {
  const count = (p: (typeof PATTERNS)[number]): number => {
    let n = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (patternPixel(p, x, y)) n++;
    return n;
  };
  for (const p of PATTERNS.filter((k) => k !== 'none')) assert.ok(count(p) > 0 && count(p) < 64, p);
  assert.equal(count('none'), 0);
  assert.ok(count('darkGray') > count('mediumGray') && count('mediumGray') > count('lightGray') && count('lightGray') > count('gray125') && count('gray125') > count('gray0625'));
  assert.ok(count('darkGrid') > count('lightGrid'));
  assert.equal(patternPixel('lightHorizontal', 3, 0), true);
  assert.equal(patternPixel('lightHorizontal', 3, 1), false);
});

test('apparence : motif, indice, ajuster, soulignement double, diagonale, sens du texte, orientation', () => {
  const d = new Draft(createBlankWorkbook());
  d.set(0, 0, 0, { value: 'abc' });
  applyEdits(d, 0, [{ r1: 0, c1: 0, r2: 0, c2: 0 }], {
    fill: joinFill({ bg: { rgb: 'FFFFFF00' }, pattern: 'darkUp', patternColor: { rgb: 'FF0000FF' } }),
    vertAlign: 'subscript', shrink: true, underline: 'doubleAccounting', readingOrder: 2, v: 'distributed',
    border: { diagDown: { style: 'thin', color: { rgb: 'FF00FF00' } } },
  });
  const look = cellLook(d.wb, d.get(0, 0, 0), 'abc', { colPx: 64, styleId: styleAt(d.wb.sheets[0]!, 0, 0) });
  assert.deepEqual(look.fillPaint, { kind: 'pattern', pattern: 'darkUp', fg: '#0000FF', bg: '#FFFF00' });
  assert.deepEqual([look.vert, look.shrink, look.underlineStyle, look.underline, look.rtl, look.vSpread], ['subscript', true, 'doubleAccounting', true, true, 'distributed']);
  assert.equal(look.align, 'right', 'sens droite a gauche : le texte standard s aligne a droite');
  assert.equal(look.borders.diagDown?.color, '#00FF00');
  assert.equal(look.borders.diagUp, undefined);
  const px = Number(look.font.match(/([\d.]+)px/)?.[1]);
  assert.ok(px < look.fontPx, 'la police dessinee est reduite pour un indice');
});

test('lignes automatiques : renvoi, rotation, texte vertical, police agrandie', () => {
  const measure = (t: string): number => t.length * 7; // 7 px par caractere
  const d = new Draft(createBlankWorkbook());
  const rng = (r1: number, c1: number, r2: number, c2: number) => ({ r1, c1, r2, c2 });
  d.set(0, 0, 0, { value: 'un long texte pour le renvoi a la ligne' }); // 39 car. = 273 px > colonne de 64 px
  d.set(0, 1, 0, { value: 'court' });
  d.set(0, 2, 0, { value: 'Vertical' });
  d.set(0, 3, 0, { value: 'Grand' });
  d.set(0, 4, 0, { value: 'Fixe' });
  applyEdits(d, 0, [rng(0, 0, 0, 0)], { wrap: true });
  applyEdits(d, 0, [rng(1, 0, 1, 0)], { wrap: true });
  applyEdits(d, 0, [rng(2, 0, 2, 0)], { rotation: 255 });
  applyEdits(d, 0, [rng(3, 0, 3, 0)], { size: 28 });
  applyEdits(d, 0, [rng(4, 0, 4, 0)], { wrap: true });
  d.sheet(0).rows.set(4, { height: 15 }); // hauteur imposee : jamais touchee
  const n = fitRows(d, 0, [rng(0, 0, 4, 0)], measure, () => null);
  const h = (row: number): number | undefined => d.wb.sheets[0]?.rows.get(row)?.height;
  assert.equal(n, 3);
  assert.ok((h(0) ?? 0) > 60, `renvoi : plusieurs lignes (${h(0)})`);
  assert.equal(h(1), undefined, 'texte court : ligne inchangee');
  assert.ok((h(2) ?? 0) > 100, `texte vertical : une lettre par ligne (${h(2)})`);
  assert.ok((h(3) ?? 0) > 30, `police 28 pt (${h(3)})`);
  assert.equal(h(4), 15, 'hauteur imposee conservee');
  assert.equal(wrapCount('aa bb cc', 30, measure, ''), 3);
});
