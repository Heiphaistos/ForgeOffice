import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addAutoShape, createBlankDeck, type Slide } from '@forgeoffice/pptx';
import type { Paragraph, RunProps } from '@forgeoffice/pptx';
import { fitParagraphs } from '../src/flow.ts';
import { flattenPath, shapeOutline } from '../src/outline.ts';
import { bandAt, columnHeight, columnWidth, spanAt, wrapFloats, WRAP_GAP, type Frame, type Obstacle } from '../src/wrap.ts';

const measure = (text: string, props: RunProps): number => text.length * (props.size ?? 10) * 0.5;
const para = (text: string): Paragraph => ({ props: {}, runs: [{ type: 'text', text, props: { size: 10 } }] });
const NO = { left: 0, top: 0, right: 0, bottom: 0 };
/** Zone de 200 pt de large, 240 pt de haut (20 lignes de 12 pt). */
const frame = (extra: Partial<Frame> = {}): Frame => ({ width: 200, height: 240, insets: NO, columns: 1, gap: 0, obstacles: [], ...extra });
const box = (x: number, y: number, w: number, h: number, mode: Obstacle['mode'] = 'square'): Obstacle => ({ x, y, width: w, height: h, mode });
const circle = (cx: number, cy: number, r: number): Array<[number, number]> => Array.from({ length: 48 }, (_, i) => [cx + r * Math.cos((i / 48) * 2 * Math.PI), cy + r * Math.sin((i / 48) * 2 * Math.PI)]);

test('habillage : un nombre quelconque d objets se cumulent (gauche, droite, gauche plus bas)', () => {
  const f = frame({ obstacles: [box(0, 0, 40, 30), box(160, 60, 40, 30), box(0, 120, 60, 30), box(150, 0, 50, 20), box(0, 200, 30, 30)] });
  const top = bandAt(f, 0, 0, 12);
  assert.ok(Math.abs(top.left - (40 + WRAP_GAP)) < 1e-9, `gauche ${top.left}`);
  assert.ok(Math.abs(top.right - (50 + WRAP_GAP)) < 1e-9, `droite ${top.right}`);
  const mid = bandAt(f, 0, 70, 12);
  assert.equal(mid.left, 0);
  assert.ok(Math.abs(mid.right - (40 + WRAP_GAP)) < 1e-9);
  assert.ok(Math.abs(bandAt(f, 0, 130, 12).left - (60 + WRAP_GAP)) < 1e-9);
  assert.ok(Math.abs(bandAt(f, 0, 205, 12).left - (30 + WRAP_GAP)) < 1e-9);
  // Plus d'objets = moins de place : la meme page de texte ne tient plus.
  const text = [para('mot '.repeat(300))];
  const free = fitParagraphs(text, frame(), measure);
  const crowded = fitParagraphs(text, f, measure);
  assert.equal(free.fits, false);
  assert.ok(crowded.split > 0 && crowded.split < free.split, `${crowded.split} < ${free.split}`);
});

test('habillage : chaque colonne a ses propres objets, un objet de la 2e colonne ne gene pas la 1re', () => {
  // 2 colonnes de 95 pt (gap 10). Image dans la 2e colonne uniquement (x = 105..).
  const f = frame({ columns: 2, gap: 10, obstacles: [box(105, 0, 50, 100)] });
  assert.equal(columnWidth(f), 95);
  assert.equal(bandAt(f, 0, 0, 12).left, 0, 'colonne 1 libre');
  assert.equal(bandAt(f, 0, 0, 12).right, 0);
  const second = bandAt(f, 1, 0, 12);
  assert.ok(Math.abs(second.left - (50 + WRAP_GAP)) < 1e-9, `colonne 2 : ${second.left}`);
  // Un objet a cheval sur les deux colonnes reserve a droite de la 1re et a gauche de la 2e.
  const both = frame({ columns: 2, gap: 10, obstacles: [box(70, 0, 60, 50)] });
  assert.ok(bandAt(both, 0, 0, 12).right > 0, 'colonne 1 : cote droit');
  assert.ok(bandAt(both, 1, 0, 12).left > 0, 'colonne 2 : cote gauche');
  // La capacite tient compte de la 2e colonne (avant : seule la 1re etait habillee).
  const text = [para('mot '.repeat(300))];
  const plain = fitParagraphs(text, frame({ columns: 2, gap: 10 }), measure);
  const wrapped = fitParagraphs(text, f, measure);
  assert.ok(wrapped.split < plain.split, `${wrapped.split} < ${plain.split}`);
});

test('habillage ajuste : le texte suit le contour (cercle) et non le rectangle', () => {
  const r = 50;
  const tight: Obstacle = { x: 0, y: 0, width: 2 * r, height: 2 * r, mode: 'tight', polygons: [circle(r, r, r)] };
  const square: Obstacle = { ...tight, mode: 'square' };
  const at = (ob: Obstacle, y: number): number => bandAt(frame({ obstacles: [ob] }), 0, y, 1).left;
  // Au sommet du cercle l'etendue est faible, au milieu elle atteint le diametre ; le carre reserve toujours la largeur entiere.
  assert.ok(at(tight, 0 - WRAP_GAP + 0.5) < 75, `sommet ${at(tight, 0 - WRAP_GAP + 0.5)}`);
  assert.ok(at(tight, 0 - WRAP_GAP + 0.5) < at(square, 0) - 25, 'bien en dessous du rectangle');
  assert.ok(Math.abs(at(tight, 49) - (2 * r + WRAP_GAP)) < 2, `milieu ${at(tight, 49)}`);
  assert.ok(Math.abs(at(square, 0) - (2 * r + WRAP_GAP)) < 1e-9);
  assert.ok(at(tight, 22) < at(tight, 49), 'le profil grandit vers le centre');
  const s = spanAt([circle(r, r, r)], 49, 51);
  assert.ok(s && Math.abs(s.min - 0) < 1 && Math.abs(s.max - 100) < 1);
  // Un cercle laisse plus de place au texte qu'un carre de meme boite.
  const text = [para('mot '.repeat(200))];
  const fitTight = fitParagraphs(text, frame({ height: 120, obstacles: [tight] }), measure);
  const fitSquare = fitParagraphs(text, frame({ height: 120, obstacles: [square] }), measure);
  assert.ok(fitTight.split > fitSquare.split, `${fitTight.split} > ${fitSquare.split}`);
});

test('habillage : contour reel des formes (ellipse, triangle, rotation, retournement) en polygones', () => {
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const slide = { id: 256, layoutId: deck.masters[0]?.layouts[0]?.id ?? '', shapes: [], animations: [], comments: [] } as unknown as Slide;
  const ellipse = addAutoShape(slide, 'ellipse', { x: 100, y: 100, width: 80, height: 40 });
  const polys = shapeOutline(ellipse, 100, 100);
  assert.ok(polys && polys.length === 1 && (polys[0]?.length ?? 0) > 20);
  for (const [x, y] of polys?.[0] ?? []) assert.ok(x >= -0.5 && x <= 80.5 && y >= -0.5 && y <= 40.5, `${x},${y} dans la boite`);
  // Le triangle est plus etroit en haut qu'en bas ; retourne verticalement, c'est l'inverse.
  const tri = addAutoShape(slide, 'triangle', { x: 0, y: 0, width: 100, height: 100 });
  const a = shapeOutline(tri, 0, 0) ?? [];
  assert.ok((spanAt(a, 0, 5)?.max ?? 0) - (spanAt(a, 0, 5)?.min ?? 0) < 20);
  assert.ok((spanAt(a, 95, 100)?.max ?? 0) - (spanAt(a, 95, 100)?.min ?? 0) > 90);
  tri.xfrm = { ...(tri.xfrm as NonNullable<typeof tri.xfrm>), flipV: true };
  const flipped = shapeOutline(tri, 0, 0) ?? [];
  assert.ok((spanAt(flipped, 0, 5)?.max ?? 0) - (spanAt(flipped, 0, 5)?.min ?? 0) > 90);
  // Rotation de 90 degres d'un rectangle large : le contour devient haut.
  const rect = addAutoShape(slide, 'rect', { x: 0, y: 0, width: 100, height: 20, rotation: 90 });
  const r = shapeOutline(rect, 0, 0) ?? [];
  const xs = r.flat().map((p) => p[0]);
  const ys = r.flat().map((p) => p[1]);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 21 && Math.max(...ys) - Math.min(...ys) > 99);
  // Aplatissement d'un chemin avec courbes.
  assert.equal(flattenPath('M 0 0 L 10 0 L 10 10 Z M 20 20 C 30 20 40 30 40 40 L 20 40 Z').length, 2);
});

test('habillage : flottants CSS pour toutes les colonnes mises bout a bout', () => {
  const f = frame({ columns: 2, gap: 10, obstacles: [box(105, 20, 50, 100)] });
  const floats = wrapFloats(f);
  const ch = columnHeight(f);
  assert.equal(floats.length, 1);
  const only = floats[0];
  assert.equal(only?.side, 'left');
  assert.ok(Math.abs((only?.width ?? 0) - (50 + WRAP_GAP)) < 1e-9);
  // Le flottant commence dans la 2e colonne (coordonnees empilees : une colonne plus haut) et couvre l'objet (+ marges).
  assert.ok((only?.before ?? 0) > ch, `espace avant : ${only?.before}`);
  assert.ok(Math.abs((only?.height ?? 0) - (100 + 2 * WRAP_GAP)) < STEP_TOLERANCE, `hauteur : ${only?.height}`);
  assert.match(only?.polygon ?? '', /^polygon\(0px 0px, /);
  assert.deepEqual(wrapFloats(frame()), []);
  assert.deepEqual(wrapFloats(frame({ obstacles: [box(0, 500, 40, 30)] })), [], 'objet hors de la zone');
});

const STEP_TOLERANCE = 6;

test('habillage : objets des deux cotes a des hauteurs differentes = flottants de plage, sans se gener', () => {
  // Gauche : 0..60, largeur 150 ; droite : 100..160, largeur 120 (la somme depasse la colonne de 200 pt mais jamais a la meme hauteur).
  const f = frame({ obstacles: [box(0, 0, 150, 60), box(80, 100, 120, 60)] });
  const floats = wrapFloats(f);
  const left = floats.filter((x) => x.side === 'left');
  const right = floats.filter((x) => x.side === 'right');
  assert.equal(left.length, 1);
  assert.equal(right.length, 1);
  const l = left[0];
  const r = right[0];
  assert.ok(l && r);
  assert.ok(l.height < 100 && r.height < 100, 'chaque flottant ne mesure que sa plage');
  assert.ok(r.before + r.height > 100 && r.before > l.height - 20, 'le flottant droit commence plus bas');
  // La mesure donne la meme chose : texte de 100 a 160 limite a droite seulement.
  assert.ok(bandAt(f, 0, 110, 12).right > 0 && bandAt(f, 0, 110, 12).left === 0);
  assert.ok(bandAt(f, 0, 10, 12).left > 0 && bandAt(f, 0, 10, 12).right === 0);
});

test('habillage : objets qui ne laissent plus de place au texte entre eux, la bande est reservee en entier', () => {
  const f = frame({ obstacles: [box(0, 0, 130, 40), box(70, 0, 130, 40)] });
  const b = bandAt(f, 0, 5, 12);
  assert.equal(b.left, 200);
  assert.equal(b.right, 0);
  const floats = wrapFloats(f);
  assert.equal(floats.length, 1);
  assert.equal(floats[0]?.width, 200);
  // Objet « haut et bas » : bande entierement bloquee, le texte reprend sous l'objet.
  const tb = frame({ obstacles: [box(30, 24, 100, 30, 'topBottom')] });
  assert.equal(bandAt(tb, 0, 30, 12).left, 200);
  assert.equal(bandAt(tb, 0, 24 + 30 + WRAP_GAP, 12).left, 0);
});
