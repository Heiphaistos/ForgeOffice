import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Paragraph, RunProps } from '@forgeoffice/pptx';
import { breakLines, distribute, fitParagraphs, fromStory, mergeStory, obstacleFloat, partStarts, splitParagraph, toStory, type Frame } from '../src/flow.ts';

/** Mesure a chasse fixe : un caractere = 0,5 x la taille. */
const measure = (text: string, props: RunProps): number => text.length * (props.size ?? 10) * 0.5;
const para = (text: string, size = 10): Paragraph => ({ props: {}, runs: [{ type: 'text', text, props: { size } }] });
const textOf = (ps: Paragraph[]): string[] => ps.map((p) => p.runs.map((r) => (r.type === 'break' ? '\n' : r.text)).join(''));
const NO_INSETS = { left: 0, top: 0, right: 0, bottom: 0 };
/** Zone de 50 pt de large (10 caracteres de 10 pt) et `lines` lignes de 12 pt. */
const frame = (lines: number, extra: Partial<Frame> = {}): Frame => ({ width: 50, height: lines * 12, insets: NO_INSETS, columns: 1, gap: 0, obstacles: [], ...extra });

test('coupure des lignes au mot, mots trop longs coupes par caracteres', () => {
  assert.deepEqual(breakLines(para('aaaa bbbb cccc'), () => 50, measure), [0, 10]);
  assert.deepEqual(breakLines(para('abcdefghijklmnopqrstuvwxy'), () => 50, measure), [0, 10, 20]);
  const withBreak: Paragraph = { props: {}, runs: [{ type: 'text', text: 'aa', props: { size: 10 } }, { type: 'break', props: {} }, { type: 'text', text: 'bb', props: { size: 10 } }] };
  assert.deepEqual(breakLines(withBreak, () => 50, measure), [0, 3]);
});

test('capacite : paragraphes entiers puis coupure au debut de la premiere ligne qui ne tient pas', () => {
  const ps = [para('aaaa bbbb'), para('cccc dddd eeee ffff gggg')];
  assert.deepEqual(fitParagraphs(ps, frame(5), measure), { count: 2, split: 0, fits: true });
  // 2 lignes : le 1er paragraphe (1 ligne) + 1 ligne du second, coupe a « eeee ».
  assert.deepEqual(fitParagraphs(ps, frame(2), measure), { count: 1, split: 10, fits: false });
  // Deux colonnes de 1 ligne chacune (gap 0 => 25 pt = 5 caracteres).
  assert.deepEqual(fitParagraphs([para('aaaa bbbb cccc')], frame(1, { columns: 2 }), measure), { count: 0, split: 10, fits: false });
});

test('habillage : un objet a gauche raccourcit les lignes, « haut et bas » fait sauter le texte sous l objet', () => {
  const square = obstacleFloat({ x: 0, y: 0, width: 20, height: 10, mode: 'square' }, 50);
  assert.equal(square?.side, 'left');
  assert.ok(Math.abs((square?.width ?? 0) - 27.2) < 1e-9);
  const right = obstacleFloat({ x: 40, y: 0, width: 10, height: 10, mode: 'square' }, 50);
  assert.equal(right?.side, 'right');
  const text = [para('aaaa bbbb cccc dddd')];
  assert.equal(fitParagraphs(text, frame(2), measure).fits, true);
  // Objet carre de 20 pt a gauche sur la 1re ligne : il ne reste que 22,8 pt (4 caracteres) -> 3 lignes.
  assert.equal(fitParagraphs(text, frame(2, { obstacles: [{ x: 0, y: 0, width: 20, height: 4, mode: 'square' }] }), measure).fits, false);
  const topBottom = frame(3, { obstacles: [{ x: 10, y: 0, width: 10, height: 4, mode: 'topBottom' }] });
  // La 1re ligne (0..12) touche l'objet (0..11,2) : le texte commence a 11,2 -> 2 lignes possibles seulement.
  assert.deepEqual(fitParagraphs([para('aaaa bbbb cccc dddd eeee ffff')], topBottom, measure), { count: 0, split: 20, fits: false });
});

test('chainage : le texte deborde dans la zone suivante puis se reconstitue sans perte', () => {
  const story = [para('un deux trois quatre cinq six sept huit neuf dix'), para('onze douze')];
  const dist = distribute(story, [frame(2), frame(2), frame(1)], measure);
  assert.deepEqual(dist.parts.map(textOf), [['un deux trois '], ['quatre cinq six '], ['sept huit neuf dix', 'onze douze']]);
  assert.deepEqual(dist.joins, [true, true]);
  assert.equal(dist.overflow, true);
  const merged = mergeStory(dist.parts, dist.joins, dist.empty);
  assert.deepEqual(textOf(merged), textOf(story));
  // Repartition stable : redistribuer l'article reconstitue donne le meme resultat.
  assert.deepEqual(distribute(merged, [frame(2), frame(2), frame(1)], measure).parts, dist.parts);
});

test('chainage : zones vides en fin d article ignorees a la reconstitution', () => {
  const dist = distribute([para('court')], [frame(3), frame(3)], measure);
  assert.deepEqual(dist.empty, [false, true]);
  assert.equal(dist.overflow, false);
  assert.deepEqual(textOf(mergeStory(dist.parts, dist.joins, dist.empty)), ['court']);
  // Texte saisi plus tard dans la zone vide : il fait partie de l'article.
  const typed = [dist.parts[0] as Paragraph[], [para('ajout')]];
  assert.deepEqual(textOf(mergeStory(typed, dist.joins, dist.empty)), ['court', 'ajout']);
});

test('la suite d un paragraphe coupe perd puce et retrait de premiere ligne', () => {
  const p: Paragraph = { props: { indent: 12, bullet: { type: 'char', char: '•' } }, runs: [{ type: 'text', text: 'abcdef', props: { size: 10 } }] };
  const [head, tail] = splitParagraph(p, 2);
  assert.deepEqual(textOf([head, tail]), ['ab', 'cdef']);
  assert.equal(head.props.indent, 12);
  assert.equal(tail.props.indent, undefined);
  assert.deepEqual(tail.props.bullet, { type: 'none' });
});

test('positions : le curseur suit le texte d une zone a l autre', () => {
  const dist = distribute([para('un deux trois quatre cinq six')], [frame(1), frame(1), frame(1)], measure);
  const starts = partStarts(dist.parts, dist.joins, dist.empty);
  assert.deepEqual(starts, [{ p: 0, o: 0 }, { p: 0, o: 8 }, { p: 0, o: 14 }]);
  assert.deepEqual(toStory(starts, 1, { p: 0, o: 3 }), { p: 0, o: 11 });
  assert.deepEqual(fromStory(starts, { p: 0, o: 11 }), { box: 1, pos: { p: 0, o: 3 } });
  assert.deepEqual(fromStory(starts, { p: 0, o: 25 }), { box: 2, pos: { p: 0, o: 11 } });
});
