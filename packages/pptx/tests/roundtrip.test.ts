import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpcPackage } from '@forgeoffice/opc';
import {
  addAutoShape,
  addChart,
  addMedia,
  addPicture,
  addSlide,
  addTable,
  addTextBox,
  applyLayout,
  createBlankDeck,
  duplicateSlide,
  mergeCells,
  moveSlide,
  notesText,
  paragraphsFromText,
  readPptx,
  removeSlide,
  replaceText,
  rgb,
  scheme,
  setNotes,
  slideText,
  slideTitle,
  writePptx,
  type ChartShape,
  type Deck,
  type MediaShape,
  type Slide,
} from '../src/index.ts';
import { autoShape, PNG } from './helpers.ts';

const red = rgb('FF0000');

/** Presentation qui exerce tout le modele : formes, texte, tableau, graphique, groupe, connecteur, media, notes... */
function richDeck(): { deck: Deck; slide: Slide } {
  const deck = createBlankDeck('widescreen');
  const slide = addSlide(deck, 'layout2');
  autoShape(slide.shapes[0]).text = { props: {}, paragraphs: paragraphsFromText('Titre riche') };
  const box = addAutoShape(slide, 'roundRect', { x: 10, y: 20, width: 100, height: 50, rotation: 30, flipH: true });
  box.geometry = { type: 'preset', preset: 'roundRect', adjust: { adj: 25000 } };
  box.fill = { type: 'gradient', kind: 'linear', angle: 90, scaled: false, stops: [{ position: 0, color: red }, { position: 100, color: scheme('accent2', [{ name: 'lumMod', val: 75000 }]) }] };
  box.line = { width: 2, dash: 'dash', fill: { type: 'solid', color: red }, head: { type: 'triangle' }, tail: { type: 'oval', width: 'lg', length: 'sm' } };
  box.effects = { outerShadow: { color: rgb('000000'), blur: 4, distance: 3, direction: 45 }, glow: { color: red, radius: 5 }, softEdge: 2 };
  box.text = {
    props: { anchor: 'ctr', columns: 2, columnSpacing: 6, vertical: 'vert', autofit: { type: 'normal', fontScale: 90 }, insets: { left: 1, top: 2, right: 3, bottom: 4 } },
    paragraphs: [
      {
        props: { align: 'ctr', level: 1, marginLeft: 18, indent: -9, lineSpacing: { type: 'pct', value: 150 }, spaceBefore: { type: 'pts', value: 6 }, spaceAfter: { type: 'pts', value: 3 }, bullet: { type: 'auto', scheme: 'arabicPeriod', startAt: 3 } },
        runs: [
          { type: 'text', text: 'Gras', props: { bold: true, italic: true, underline: 'sng', strike: 'sngStrike', size: 20, font: 'Aptos', color: red, highlight: rgb('FFFF00'), baseline: 30, spacing: 1.5, link: { url: 'https://exemple.fr', tooltip: 'Lien' } } },
          { type: 'break', props: {} },
          { type: 'text', text: 'suite', props: {} },
        ],
      },
      { props: { bullet: { type: 'char', char: '–' }, bulletFont: 'Arial' }, runs: [{ type: 'text', text: 'puce', props: {} }] },
      { props: { bullet: { type: 'image', mediaId: addMedia(deck, PNG, 'png') } }, runs: [{ type: 'text', text: 'image', props: {} }] },
    ],
  };
  const star = addAutoShape(slide, 'star5', { x: 0, y: 0, width: 20, height: 20 });
  star.fill = { type: 'pattern', preset: 'dkDnDiag', foreground: red, background: rgb('FFFFFF') };
  const free = addAutoShape(slide, 'rect', { x: 0, y: 0, width: 20, height: 20 });
  free.geometry = {
    type: 'custom',
    paths: [{ width: 100, height: 100, commands: [{ cmd: 'moveTo', pt: { x: 0, y: 0 } }, { cmd: 'lineTo', pt: { x: 100, y: 0 } }, { cmd: 'cubicBezTo', pts: [{ x: 100, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 100 }] }, { cmd: 'close' }] }],
    textRect: { l: 'l', t: 't', r: 'r', b: 'b' },
  };
  const pic = addPicture(deck, slide, PNG, 'png', { x: 1, y: 2, width: 30, height: 40 }, 'Logo');
  pic.crop = { left: 10, top: 5, right: 0, bottom: 20 };
  pic.imageEffects = { grayscale: true, alpha: 50 };
  const filled = addAutoShape(slide, 'ellipse', { x: 0, y: 0, width: 20, height: 20 });
  filled.fill = { type: 'image', mediaId: pic.mediaId, mode: 'stretch' };
  const table = addTable(slide, 3, 3, { x: 50, y: 50, width: 300, height: 90 }, [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]);
  mergeCells(table, 0, 0, 2, 2);
  const corner = table.table.rows[2]!.cells[2]!;
  corner.fill = { type: 'solid', color: red };
  corner.borders = { left: { width: 1, fill: { type: 'solid', color: red } } };
  addChart(slide, 'bar', ['T1', 'T2'], [{ name: 'Ventes', values: [1, 2.5] }, { name: 'Couts', values: [3, null] }], { x: 0, y: 0, width: 200, height: 100 }, { title: 'Résultats', barDirection: 'col' });
  const a = addAutoShape(slide, 'rect', { x: 0, y: 0, width: 10, height: 10 });
  const b = addAutoShape(slide, 'rect', { x: 100, y: 0, width: 10, height: 10 });
  slide.shapes.push(
    { kind: 'connector', id: 99, name: 'Connecteur', xfrm: { x: 10, y: 5, width: 90, height: 0 }, geometry: { type: 'preset', preset: 'straightConnector1' }, line: { width: 1, tail: { type: 'triangle' } }, start: { shapeId: a.id, site: 3 }, end: { shapeId: b.id, site: 1 } },
    {
      kind: 'group',
      id: 100,
      name: 'Groupe',
      xfrm: { x: 0, y: 0, width: 50, height: 50 },
      childOffset: { x: 0, y: 0 },
      childExtent: { width: 50, height: 50 },
      children: [
        { kind: 'shape', id: 101, name: 'E1', xfrm: { x: 0, y: 0, width: 10, height: 10 }, geometry: { type: 'preset', preset: 'ellipse' }, fill: { type: 'solid', color: red } },
        { kind: 'shape', id: 102, name: 'E2', xfrm: { x: 20, y: 20, width: 10, height: 10 }, geometry: { type: 'preset', preset: 'triangle' } },
      ],
    },
    { kind: 'media', id: 103, name: 'Video', mediaType: 'video', mediaId: addMedia(deck, new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]), 'mp4'), posterMediaId: pic.mediaId, xfrm: { x: 0, y: 0, width: 160, height: 90 }, geometry: { type: 'preset', preset: 'rect' }, trim: { start: 1000 } },
  );
  setNotes(slide, 'Note 1\nNote 2');
  slide.transition = { type: 'push', params: { dir: 'u' }, duration: 1500, speed: 'slow', advanceAfter: 3000, advanceOnClick: true };
  slide.animations = [
    { shapeId: box.id, class: 'entr', presetId: 10, trigger: 'onClick', delay: 0, duration: 500 },
    { shapeId: star.id, class: 'emph', presetId: 8, trigger: 'afterPrevious', delay: 250, duration: 1000 },
    { shapeId: a.id, class: 'exit', presetId: 10, trigger: 'withPrevious', delay: 0, duration: 500 },
    { shapeId: b.id, class: 'path', presetId: 42, trigger: 'onClick', delay: 0, duration: 2000, path: 'M 0 0 L 0.25 0.1 E' },
  ];
  slide.comments = [{ author: 'Momo', initials: 'MO', date: '2026-11-04T10:00:00', text: 'Bravo', position: { x: 10, y: 20 } }];
  slide.background = { type: 'fill', fill: { type: 'solid', color: rgb('EEEEEE') } };
  const hidden = addSlide(deck, 'layout7');
  hidden.hidden = true;
  deck.sections = [
    { name: 'Intro', id: '{11111111-1111-1111-1111-111111111111}', slideIds: [deck.slides[0]!.id] },
    { name: 'Suite', id: '{22222222-2222-2222-2222-222222222222}', slideIds: [slide.id, hidden.id] },
  ];
  deck.properties.title = 'Essai';
  deck.properties.creator = 'Momo';
  deck.properties.custom = { Projet: 'Forge' };
  return { deck, slide };
}

test('aller-retour .pptx : chaque type de forme est relu a l\'identique', async () => {
  const { deck, slide } = richDeck();
  const back = await readPptx(await writePptx(deck));
  assert.equal(back.slides.length, 3);
  const slide2 = back.slides[1]!;
  assert.equal(slide2.shapes.length, slide.shapes.length);
  assert.deepEqual(slide2.shapes.map((s) => s.kind), slide.shapes.map((s) => s.kind));
  const chartIndex = slide.shapes.findIndex((s) => s.kind === 'chart');
  const mediaIndex = slide.shapes.findIndex((s) => s.kind === 'media');
  slide.shapes.forEach((shape, i) => {
    if (i === chartIndex || i === mediaIndex) return;
    assert.deepEqual(slide2.shapes[i], shape, `${shape.kind} ${shape.name}`);
  });
  // Graphique : donnees et type relus (Office ajoute ses valeurs par defaut).
  const chart = (slide2.shapes[chartIndex] as ChartShape).chart;
  const plot = chart.plots[0];
  assert.equal(plot?.type, 'bar');
  assert.equal(plot?.barDirection, 'col');
  assert.deepEqual(plot?.series.map((s) => s.name), ['Ventes', 'Couts']);
  assert.deepEqual(plot?.series[0]?.values.values, [1, 2.5]);
  assert.deepEqual(plot?.series[1]?.values.values, [3, null]);
  assert.deepEqual(plot?.series[0]?.categories?.labels, ['T1', 'T2']);
  assert.equal(chart.title?.text, 'Résultats');
  // Video : media incorpore, affiche, decoupage.
  const media = slide2.shapes[mediaIndex] as MediaShape;
  assert.equal(media.mediaType, 'video');
  assert.deepEqual(media.trim, { start: 1000 });
  assert.equal(back.media[media.mediaId ?? '']?.extension, 'mp4');
  assert.equal(back.media[media.posterMediaId ?? '']?.extension, 'png');
});

test('aller-retour .pptx : diapositive (notes, transition, animations, commentaires, arriere-plan, masquee)', async () => {
  const { deck, slide } = richDeck();
  const back = await readPptx(await writePptx(deck));
  const slide2 = back.slides[1]!;
  assert.equal(notesText(slide2), 'Note 1\nNote 2');
  assert.deepEqual(slide2.transition, slide.transition);
  assert.deepEqual(slide2.animations, slide.animations);
  assert.deepEqual(slide2.comments, slide.comments);
  assert.deepEqual(slide2.background, slide.background);
  assert.equal(slide2.layoutId, back.masters[0]?.layouts[1]?.id);
  assert.equal(back.slides[2]?.hidden, true);
  assert.equal(slide2.hidden, undefined);
  assert.equal(slideTitle(slide2), 'Titre riche');
  assert.deepEqual(back.sections.map((s) => [s.name, s.slideIds.length]), [['Intro', 1], ['Suite', 2]]);
  assert.equal(back.properties.title, 'Essai');
  assert.equal(back.properties.creator, 'Momo');
  assert.deepEqual(back.properties.custom, { Projet: 'Forge' });
});

test('animations modifiees : le minutage est regenere ; inchangees : XML d\'origine conserve', async () => {
  const { deck } = richDeck();
  const once = await readPptx(await writePptx(deck));
  assert.ok(once.slides[1]?.timing, 'minutage conserve a la lecture');
  const twice = await readPptx(await writePptx(once));
  assert.deepEqual(twice.slides[1]?.animations, once.slides[1]?.animations);
  once.slides[1]!.animations[0]!.duration = 2500;
  once.slides[1]!.animations.pop();
  const changed = await readPptx(await writePptx(once));
  assert.equal(changed.slides[1]?.animations.length, 3);
  assert.equal(changed.slides[1]?.animations[0]?.duration, 2500);
});

test('formats .pptx/.pptm/.potx/.ppsx : type de contenu principal et macros', async () => {
  const { deck } = richDeck();
  const expected = {
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
    pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml',
    potx: 'application/vnd.openxmlformats-officedocument.presentationml.template.main+xml',
    ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml',
  } as const;
  for (const format of ['pptx', 'pptm', 'potx', 'ppsx'] as const) {
    deck.format = format;
    deck.macros = format === 'pptm' ? new Uint8Array([1, 2, 3]) : undefined;
    const bytes = await writePptx(deck);
    const pkg = await OpcPackage.open(bytes);
    assert.equal(pkg.contentType('/ppt/presentation.xml'), expected[format], format);
    const back = await readPptx(bytes);
    assert.equal(back.format, format);
    assert.deepEqual(back.macros, format === 'pptm' ? new Uint8Array([1, 2, 3]) : undefined, format);
  }
});

test('securite : lien javascript: refuse a la lecture', async () => {
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const slide = addSlide(deck, 'layout7');
  const box = addTextBox(slide, { x: 0, y: 0, width: 100, height: 20 }, 'piege');
  const run = box.text!.paragraphs[0]!.runs[0]!;
  run.props.link = { url: 'javascript:alert(1)' };
  box.click = { url: 'https://ok.example' };
  const back = await readPptx(await writePptx(deck));
  const shape = autoShape(back.slides[0]?.shapes[0]);
  assert.equal(shape.text?.paragraphs[0]?.runs[0]?.props.link?.url, undefined);
  assert.equal(shape.click?.url, 'https://ok.example');
});

test('edition : dupliquer, deplacer, supprimer, changer de disposition, remplacer', async () => {
  const { deck, slide } = richDeck();
  const copy = duplicateSlide(deck, slide.id);
  assert.ok(copy && copy.id !== slide.id);
  assert.equal(deck.slides.length, 4);
  assert.equal(deck.slides[2], copy);
  assert.ok(moveSlide(deck, copy.id, 0));
  assert.equal(deck.slides[0], copy);
  assert.equal(replaceText(deck, 'Titre riche', 'Nouveau titre'), 2);
  assert.equal(slideTitle(copy), 'Nouveau titre');
  assert.ok(slideText(slide).includes('Nouveau titre'));
  applyLayout(deck, copy, 'layout6');
  assert.equal(copy.layoutId, 'layout6');
  assert.ok(removeSlide(deck, copy.id));
  assert.equal(deck.slides.length, 3);
  assert.equal(removeSlide(deck, 99999), false);
  const back = await readPptx(await writePptx(deck));
  assert.equal(slideTitle(back.slides[1]!), 'Nouveau titre');
});

test('ecriture stable : relire puis reecrire donne le meme modele', async () => {
  const { deck } = richDeck();
  const first = await readPptx(await writePptx(deck));
  const second = await readPptx(await writePptx(first));
  assert.deepEqual(second.slides.map((s) => s.shapes), first.slides.map((s) => s.shapes));
  assert.deepEqual(second.masters[0]?.layouts.map((l) => l.shapes.length), first.masters[0]?.layouts.map((l) => l.shapes.length));
  assert.deepEqual(Object.keys(second.media).length, Object.keys(first.media).length);
});
