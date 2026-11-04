import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlankDeck,
  deckTheme,
  effectiveShape,
  fontStack,
  MAX_SLIDE_PT,
  MIN_SLIDE_PT,
  readPptx,
  SIZE_NAMES,
  SLIDE_SIZES,
  standardTextStyles,
  writePptx,
  type SlideSizePreset,
} from '../src/index.ts';
import { near } from './helpers.ts';

const LAYOUTS_FR = [
  'Diapositive de titre',
  'Titre et contenu',
  'En-tête de section',
  'Deux contenus',
  'Comparaison',
  'Titre seul',
  'Vide',
  'Contenu avec légende',
  'Image avec légende',
  'Titre et texte vertical',
  'Titre vertical et texte',
];

test('presentation vierge 16:9 : masque, 11 dispositions francaises, diapositive de titre', () => {
  const deck = createBlankDeck();
  assert.equal(deck.size.width, 960);
  assert.equal(deck.size.height, 540);
  assert.equal(deck.masters.length, 1);
  assert.deepEqual(deck.masters[0]?.layouts.map((l) => l.name), LAYOUTS_FR);
  assert.deepEqual(deck.masters[0]?.layouts.map((l) => l.type), ['title', 'obj', 'secHead', 'twoObj', 'twoTxTwoObj', 'titleOnly', 'blank', 'objTx', 'picTx', 'vertTx', 'vertTitleAndTx']);
  assert.equal(deck.slides.length, 1);
  const slide = deck.slides[0];
  assert.equal(slide?.layoutId, 'layout1');
  assert.deepEqual(slide?.shapes.map((s) => s.placeholder?.type), ['ctrTitle', 'subTitle']);
  assert.equal(createBlankDeck('widescreen', { titleSlide: false }).slides.length, 0);
});

test('theme Office 2024 : Aptos / Aptos Display avec repli, 12 couleurs', () => {
  const theme = deckTheme(createBlankDeck());
  assert.equal(theme.fonts.major.latin, 'Aptos Display');
  assert.equal(theme.fonts.minor.latin, 'Aptos');
  assert.equal(Object.keys(theme.colors).filter((k) => k !== 'name').length, 12);
  assert.deepEqual(theme.colors.accent1, { type: 'rgb', value: '156082' });
  assert.deepEqual(theme.colors.accent2, { type: 'rgb', value: 'E97132' });
  assert.equal(theme.formatScheme.fills.length, 3);
  assert.ok(theme.fontFallbacks?.Aptos?.includes('Segoe UI'));
  assert.ok(fontStack('Aptos Display', theme).startsWith('"Aptos Display", "Aptos"'));
  assert.ok(fontStack('Aptos', theme).endsWith('sans-serif'));
});

test('tailles predefinies : ecran, papier, carte de visite, banniere', () => {
  const size = (preset: SlideSizePreset, orientation?: 'portrait' | 'landscape') => createBlankDeck(preset, { orientation, titleSlide: false }).size;
  assert.deepEqual([size('standard').width, size('standard').height], [720, 540]);
  assert.ok(near(size('a4').width, 595.28) && near(size('a4').height, 841.89));
  assert.ok(near(size('a4', 'landscape').width, 841.89) && near(size('a4', 'landscape').height, 595.28));
  assert.ok(near(size('a3').width, 841.89) && near(size('a3').height, 1190.55));
  assert.deepEqual([size('letter').width, size('letter').height], [612, 792]);
  assert.ok(near(size('businessCard').width, 240.94) && near(size('businessCard').height, 155.91));
  assert.deepEqual([size('banner').width, size('banner').height], [576, 72]);
  assert.deepEqual([size('widescreen', 'portrait').width, size('widescreen', 'portrait').height], [540, 960]);
  for (const preset of Object.keys(SLIDE_SIZES) as SlideSizePreset[]) assert.ok(SIZE_NAMES[preset].length > 0, preset);
});

test('taille libre (module Publication) bornee aux limites OOXML', () => {
  const poster = createBlankDeck({ width: 1684, height: 2384 }, { titleSlide: false });
  assert.deepEqual([poster.size.width, poster.size.height], [1684, 2384]);
  const clamped = createBlankDeck({ width: 10, height: 99999 }, { titleSlide: false });
  assert.equal(clamped.size.width, MIN_SLIDE_PT);
  assert.equal(clamped.size.height, MAX_SLIDE_PT);
});

test('espaces reserves des dispositions dans la diapositive, quelle que soit la taille', () => {
  for (const preset of Object.keys(SLIDE_SIZES) as SlideSizePreset[]) {
    const deck = createBlankDeck(preset, { titleSlide: false });
    const { width, height } = deck.size;
    const master = deck.masters[0];
    assert.ok(master);
    const all = [...master.shapes, ...master.layouts.flatMap((l) => l.shapes.map((s) => effectiveShape(deck, l, s)))];
    const outside = all.filter((s) => !s.xfrm || s.xfrm.x < -0.5 || s.xfrm.y < -0.5 || s.xfrm.x + s.xfrm.width > width + 0.5 || s.xfrm.y + s.xfrm.height > height + 0.5);
    assert.deepEqual(outside.map((s) => s.name), [], preset);
  }
});

test('styles de texte : 44 pt en ecran, reduits pour une carte de visite', () => {
  assert.equal(standardTextStyles(SLIDE_SIZES.widescreen).title.levels[0]?.defaultRun?.size, 44);
  assert.equal(standardTextStyles(SLIDE_SIZES.standard).title.levels[0]?.defaultRun?.size, 44);
  assert.equal(standardTextStyles(SLIDE_SIZES.widescreen).body.levels[0]?.defaultRun?.size, 28);
  const card = standardTextStyles(SLIDE_SIZES.businessCard).title.levels[0]?.defaultRun?.size ?? 0;
  assert.ok(card > 0 && card < 20, `titre carte de visite ${card}`);
});

test('titre effectif de la diapositive vierge : herite position et police du masque', () => {
  const deck = createBlankDeck();
  const slide = deck.slides[0];
  assert.ok(slide);
  const title = effectiveShape(deck, slide, slide.shapes[0]!);
  assert.equal(title.kind, 'shape');
  assert.ok(title.xfrm && title.xfrm.width > 0);
  if (title.kind !== 'shape') return;
  assert.equal(title.text?.props.anchor, 'b');
  assert.equal(title.text?.listStyle?.levels[0]?.defaultRun?.font, '+mj-lt');
});

test('chaque format predefini survit a l\'enregistrement (taille et dispositions)', async () => {
  for (const preset of ['widescreen', 'standard', 'a4', 'businessCard', 'banner'] as const) {
    const deck = createBlankDeck(preset);
    const back = await readPptx(await writePptx(deck));
    assert.ok(near(back.size.width, deck.size.width, 0.001) && near(back.size.height, deck.size.height, 0.001), preset);
    assert.deepEqual(back.masters[0]?.layouts.map((l) => l.name), LAYOUTS_FR, preset);
  }
});
