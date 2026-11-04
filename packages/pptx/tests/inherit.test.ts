import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addAutoShape,
  addSlide,
  backgroundShapes,
  createBlankDeck,
  effectiveBackground,
  effectiveColorMap,
  effectiveShape,
  matchPlaceholder,
  paragraphsFromText,
  placeholderPrompt,
  readPptx,
  rgb,
  writePptx,
  type Paragraph,
  type Shape,
} from '../src/index.ts';
import { autoShape, fixture, near } from './helpers.ts';

function setText(shape: Shape | undefined, value: string): void {
  autoShape(shape).text = { props: {}, paragraphs: paragraphsFromText(value) };
}

const firstRun = (paragraph: Paragraph | undefined) => paragraph?.runs[0]?.props;

test('position : diapositive -> disposition -> masque', () => {
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const slide = addSlide(deck, 'layout2');
  const [title, body] = slide.shapes;
  assert.equal(title?.xfrm, undefined);
  const effTitle = effectiveShape(deck, slide, title!);
  // La disposition « Titre et contenu » n'a pas de position : celle du masque s'applique.
  assert.ok(near(effTitle.xfrm?.x, 66) && near(effTitle.xfrm?.y, 28.75));
  const effBody = effectiveShape(deck, slide, body!);
  assert.ok(near(effBody.xfrm?.y, 143.75));
  // Une position propre a la diapositive l'emporte et l'original n'est pas modifie.
  body!.xfrm = { x: 1, y: 2, width: 3, height: 4 };
  assert.deepEqual(effectiveShape(deck, slide, body!).xfrm, { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(title?.xfrm, undefined);
});

test('position : la disposition l\'emporte sur le masque', () => {
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const slide = addSlide(deck, 'layout1');
  const eff = effectiveShape(deck, slide, slide.shapes[0]!);
  assert.ok(near(eff.xfrm?.x, 120) && near(eff.xfrm?.width, 720));
});

test('indice d\'espace reserve : le 2e contenu prend la colonne de droite', () => {
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const slide = addSlide(deck, 'layout4');
  assert.deepEqual(slide.shapes.map((s) => s.placeholder?.index), [undefined, 1, 2]);
  const left = effectiveShape(deck, slide, slide.shapes[1]!);
  const right = effectiveShape(deck, slide, slide.shapes[2]!);
  assert.ok(near(left.xfrm?.x, 66));
  assert.ok(near(right.xfrm?.x, 486));
  const layout = deck.masters[0]!.layouts[3]!;
  assert.equal(matchPlaceholder(layout.shapes, { type: 'obj', index: 2 })?.placeholder?.index, 2);
  assert.equal(matchPlaceholder(deck.masters[0]!.shapes, { type: 'ctrTitle' }, true)?.placeholder?.type, 'title');
  assert.equal(matchPlaceholder(deck.masters[0]!.shapes, { type: 'obj', index: 7 }, true)?.placeholder?.type, 'body');
});

test('texte : styles du masque, surcharge de la disposition puis de la diapositive', () => {
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const titleSlide = addSlide(deck, 'layout1');
  setText(titleSlide.shapes[0], 'Bonjour');
  setText(titleSlide.shapes[1], 'Sous-titre');
  const title = autoShape(effectiveShape(deck, titleSlide, titleSlide.shapes[0]!));
  const titleRun = firstRun(title.text?.paragraphs[0]);
  assert.equal(titleRun?.size, 60, 'la disposition passe le titre a 60 pt');
  assert.equal(titleRun?.font, 'Aptos Display', 'police de theme +mj-lt resolue');
  assert.equal(title.text?.paragraphs[0]?.props.align, 'ctr');
  assert.equal(title.text?.props.anchor, 'b');
  const subtitle = autoShape(effectiveShape(deck, titleSlide, titleSlide.shapes[1]!));
  assert.equal(firstRun(subtitle.text?.paragraphs[0])?.size, 24);
  assert.deepEqual(subtitle.text?.paragraphs[0]?.props.bullet, { type: 'none' });

  const content = addSlide(deck, 'layout2');
  setText(content.shapes[0], 'Titre');
  setText(content.shapes[1], 'Niveau 1\n\tNiveau 2\n\t\tNiveau 3');
  const body = autoShape(effectiveShape(deck, content, content.shapes[1]!));
  const [p1, p2, p3] = body.text?.paragraphs ?? [];
  assert.equal(firstRun(p1)?.size, 28);
  assert.equal(firstRun(p2)?.size, 24);
  assert.equal(firstRun(p3)?.size, 20);
  assert.equal(p2?.props.level, 1);
  assert.deepEqual(p1?.props.bullet, { type: 'char', char: '•' });
  assert.equal(firstRun(p1)?.font, 'Aptos');
  assert.deepEqual(firstRun(p1)?.color, { type: 'scheme', value: 'tx1' });
  assert.equal(firstRun(autoShape(effectiveShape(deck, content, content.shapes[0]!)).text?.paragraphs[0])?.size, 44);

  // Mise en forme directe du segment : prioritaire.
  autoShape(content.shapes[1]).text!.paragraphs[0]!.runs[0]!.props.size = 18;
  assert.equal(firstRun(autoShape(effectiveShape(deck, content, content.shapes[1]!)).text?.paragraphs[0])?.size, 18);
  // Style de liste propre a la forme : prioritaire sur la disposition et le masque.
  autoShape(content.shapes[1]).text!.listStyle = { levels: { 1: { defaultRun: { size: 11 } } } };
  assert.equal(firstRun(autoShape(effectiveShape(deck, content, content.shapes[1]!)).text?.paragraphs[1])?.size, 11);
});

test('invite des espaces reserves vides', () => {
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const slide = addSlide(deck, 'layout2');
  const prompt = placeholderPrompt(deck, slide, slide.shapes[0]!);
  assert.equal(prompt?.[0]?.runs[0]?.type === 'text' ? prompt[0].runs[0].text : '', 'Modifiez le style du titre');
  assert.equal(firstRun(prompt?.[0])?.size, 44);
  assert.equal(placeholderPrompt(deck, slide, addAutoShape(slide, 'rect', { x: 0, y: 0, width: 1, height: 1 })), undefined);
});

test('styles de theme des formes (remplissage, contour)', () => {
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const slide = addSlide(deck, 'layout7');
  const shape = addAutoShape(slide, 'ellipse', { x: 0, y: 0, width: 10, height: 10 });
  const eff = autoShape(effectiveShape(deck, slide, shape));
  assert.deepEqual(eff.fill, { type: 'solid', color: { type: 'scheme', value: 'accent1' } });
  assert.equal(eff.line?.fill?.type, 'solid');
  assert.ok((eff.line?.width ?? 0) > 0);
  shape.fill = { type: 'solid', color: rgb('112233') };
  assert.deepEqual(autoShape(effectiveShape(deck, slide, shape)).fill, { type: 'solid', color: { type: 'rgb', value: '112233' } });
});

test('arriere-plan, couleurs et formes du masque', () => {
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const slide = addSlide(deck, 'layout7');
  assert.deepEqual(effectiveBackground(deck, slide), { type: 'solid', color: { type: 'scheme', value: 'bg1' } });
  slide.background = { type: 'fill', fill: { type: 'solid', color: rgb('FF0000') } };
  assert.deepEqual(effectiveBackground(deck, slide), { type: 'solid', color: { type: 'rgb', value: 'FF0000' } });
  assert.equal(effectiveColorMap(deck, slide).bg1, 'lt1');
  slide.colorMapOverride = { ...effectiveColorMap(deck, slide), bg1: 'dk1', tx1: 'lt1' };
  assert.equal(effectiveColorMap(deck, slide).bg1, 'dk1');
  const master = deck.masters[0]!;
  master.shapes.push({ kind: 'shape', id: 50, name: 'Logo', xfrm: { x: 0, y: 0, width: 5, height: 5 }, geometry: { type: 'preset', preset: 'rect' } });
  assert.deepEqual(backgroundShapes(deck, slide).map((s) => s.name), ['Logo']);
  slide.showMasterShapes = false;
  assert.deepEqual(backgroundShapes(deck, slide), []);
});

test('heritage conserve apres enregistrement puis relecture', async () => {
  const deck = createBlankDeck('standard', { titleSlide: false });
  const slide = addSlide(deck, 'layout2');
  setText(slide.shapes[1], 'Un\n\tDeux');
  const before = autoShape(effectiveShape(deck, slide, slide.shapes[1]!));
  const back = await readPptx(await writePptx(deck));
  const slide2 = back.slides[0]!;
  assert.equal(slide2.shapes[1]?.xfrm, undefined, 'pas de position ecrite pour un espace reserve herite');
  const after = autoShape(effectiveShape(back, slide2, slide2.shapes[1]!));
  assert.deepEqual(after.xfrm, before.xfrm);
  assert.equal(firstRun(after.text?.paragraphs[1])?.size, firstRun(before.text?.paragraphs[1])?.size);
  assert.deepEqual(after.text?.paragraphs[0]?.props.bullet, before.text?.paragraphs[0]?.props.bullet);
});

test('fichier reel : espaces reserves d\'un fichier ONLYOFFICE resolus par disposition et masque', async () => {
  const deck = await readPptx(fixture('onlyoffice-office.pptx'));
  const slide = deck.slides[0]!;
  assert.deepEqual(slide.shapes.map((s) => s.placeholder?.type), ['ctrTitle', 'subTitle']);
  for (const shape of slide.shapes) {
    const eff = autoShape(effectiveShape(deck, slide, shape));
    assert.ok(eff.xfrm && eff.xfrm.width > 0 && eff.xfrm.height > 0, shape.name);
    const defaults = eff.text?.paragraphs[0]?.props.defaultRun;
    assert.ok((defaults?.size ?? 0) > 0, shape.name);
    assert.ok(defaults?.font && !defaults.font.startsWith('+'), shape.name);
  }
});
