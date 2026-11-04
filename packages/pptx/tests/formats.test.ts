import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  notesText,
  openPresentation,
  PresentationError,
  readOdp,
  readPpt,
  readPptx,
  slideText,
  textOfShape,
  writePptx,
  type Deck,
  type Picture,
  type TableShape,
} from '../src/index.ts';
import { autoShape, fixture, near } from './helpers.ts';

const texts = (deck: Deck): string[] => deck.slides.map(slideText);

test('slides.pptx (LibreOffice) : texte, image, notes', async () => {
  const deck = await readPptx(fixture('slides.pptx'));
  assert.ok(near(deck.size.width, 793.75) && near(deck.size.height, 446.5));
  assert.deepEqual(texts(deck), ['Corpus slide title\nFirst slide subtitle', 'Second slide heading\nContent line one\nContent line two']);
  assert.equal(notesText(deck.slides[0]!), 'Speaker note for the first slide');
  assert.equal(notesText(deck.slides[1]!), 'Speaker note for the second slide');
  const picture = deck.slides[1]!.shapes.find((s): s is Picture => s.kind === 'picture');
  assert.equal(deck.media[picture?.mediaId ?? '']?.extension, 'png');
  const heading = autoShape(deck.slides[1]!.shapes[0]);
  assert.equal(heading.text?.paragraphs[0]?.runs[0]?.props.bold, true);
  assert.equal(heading.text?.paragraphs[0]?.runs[0]?.props.size, 36);
  assert.deepEqual(heading.fill, { type: 'solid', color: { type: 'rgb', value: '729FCF' } });
});

test('fichiers ONLYOFFICE : dispositions, espaces reserves, aller-retour', async () => {
  for (const [name, layouts] of [['onlyoffice-lines.pptx', 9], ['onlyoffice-office.pptx', 11]] as const) {
    const deck = await readPptx(fixture(name));
    assert.deepEqual([deck.size.width, deck.size.height], [720, 405], name);
    assert.equal(deck.masters[0]?.layouts.length, layouts, name);
    assert.deepEqual(deck.slides[0]?.shapes.map((s) => s.placeholder?.type), ['ctrTitle', 'subTitle'], name);
    const back = await readPptx(await writePptx(deck));
    assert.equal(back.masters[0]?.layouts.length, layouts, name);
    assert.deepEqual(back.slides[0]?.shapes, deck.slides[0]?.shapes, name);
    assert.deepEqual(back.masters[0]?.theme.colors, deck.masters[0]?.theme.colors, name);
    assert.deepEqual(back.masters[0]?.theme.fonts, deck.masters[0]?.theme.fonts, name);
  }
});

test('.odp LibreOffice : pages, texte, image, notes', async () => {
  const basic = await readOdp(fixture('basic.odp'));
  assert.deepEqual(texts(basic), ['Basic ODP title\nBasic ODP subtitle']);
  const deck = await readOdp(fixture('slides.odp'));
  assert.ok(near(deck.size.width, 793.7) && near(deck.size.height, 446.46));
  assert.deepEqual(texts(deck), ['Corpus slide title\nFirst slide subtitle', 'Second slide heading\nContent line one\nContent line two']);
  assert.equal(notesText(deck.slides[1]!), 'Speaker note for the second slide');
  assert.equal(deck.slides[1]?.shapes.filter((s) => s.kind === 'picture').length, 1);
  // Conversion .odp -> .pptx : le texte survit.
  const converted = await readPptx(await writePptx(deck));
  assert.deepEqual(texts(converted), texts(deck));
  assert.equal(notesText(converted.slides[0]!), 'Speaker note for the first slide');
});

test('.odp exporte par PowerPoint : rotation + miroir, tableau fusionne, lien, transition, masquee', async () => {
  const deck = await readOdp(fixture('powerpoint-export.odp'));
  assert.ok(near(deck.size.width, 960) && near(deck.size.height, 540));
  assert.equal(deck.slides.length, 3);
  const slide = deck.slides[1]!;
  assert.deepEqual(slide.shapes.slice(0, 2).map((s) => s.placeholder?.type), ['title', 'body']);
  const rotated = autoShape(slide.shapes[2]);
  assert.ok(near(rotated.xfrm?.x, 10) && near(rotated.xfrm?.y, 20) && near(rotated.xfrm?.width, 100) && near(rotated.xfrm?.height, 50));
  assert.equal(rotated.xfrm?.rotation, 30);
  assert.equal(rotated.xfrm?.flipH, true);
  assert.equal(textOfShape(rotated), 'Gras\vsuite\npuce\nimage');
  assert.equal(rotated.text?.paragraphs[0]?.runs[0]?.props.link?.url, 'https://exemple.fr');
  const table = slide.shapes.find((s): s is TableShape => s.kind === 'table');
  assert.ok(table);
  assert.equal(table.table.rows.length, 3);
  assert.equal(table.table.rows[0]?.cells[0]?.gridSpan, 2);
  assert.equal(table.table.rows[0]?.cells[0]?.rowSpan, 2);
  assert.equal(textOfShape(table), 'a\t\tc\n\t\tf\ng\th\ti');
  assert.deepEqual(slide.transition, { type: 'push', speed: 'slow', params: { dir: 'u' }, advanceAfter: 3000 });
  assert.equal(notesText(slide), 'Note 1\nNote 2');
  assert.equal(deck.slides[2]?.hidden, true);
  assert.equal(deck.slides[2]?.transition, undefined);
  assert.equal(slide.shapes.filter((s) => s.kind === 'connector').length, 1);
  assert.equal(slide.shapes.filter((s) => s.kind === 'group').length, 1);
});

test('.ppt 97-2003 (enregistre par PowerPoint) : texte, niveaux, positions, image, notes', () => {
  const deck = readPpt(fixture('legacy.ppt'));
  assert.deepEqual([deck.size.width, deck.size.height], [720, 540]);
  assert.equal(deck.slides.length, 3);
  assert.deepEqual(deck.slides.map((s) => s.layoutId), ['layout1', 'layout2', 'layout7']);
  const [s1, s2, s3] = deck.slides;
  assert.deepEqual(s1?.shapes.map((s) => s.placeholder?.type), ['ctrTitle', 'subTitle']);
  assert.equal(slideText(s1!), 'Titre ancien format\nSous-titre accentué');
  assert.ok(near(s1?.shapes[0]?.xfrm?.x, 90) && near(s1?.shapes[0]?.xfrm?.width, 540));
  const body = autoShape(s2?.shapes[1]);
  assert.equal(textOfShape(body), 'Point un\vmême paragraphe\nSous-point\nPoint deux');
  assert.deepEqual(body.text?.paragraphs.map((p) => p.props.level ?? 0), [0, 1, 0]);
  assert.equal(notesText(s2!), 'Notes du présentateur');
  assert.equal(slideText(s3!), 'Zone de texte libre');
  assert.equal(autoShape(s3?.shapes[0]).textBox, true);
  const picture = s3?.shapes[1];
  assert.equal(picture?.kind, 'picture');
  assert.deepEqual(picture?.xfrm, { x: 400, y: 200, width: 100, height: 100 });
  const media = deck.media[(picture as Picture).mediaId];
  assert.equal(media?.extension, 'png');
  assert.deepEqual([...(media?.bytes.subarray(0, 4) ?? [])], [0x89, 0x50, 0x4e, 0x47]);
});

test('.ppt -> .pptx : conversion relisible', async () => {
  const deck = readPpt(fixture('legacy.ppt'));
  const back = await readPptx(await writePptx(deck));
  assert.deepEqual(texts(back), texts(deck));
  assert.equal(notesText(back.slides[1]!), 'Notes du présentateur');
  assert.equal(back.format, 'pptx');
});

test('ouverture par signature et fichiers hostiles', async () => {
  assert.equal((await openPresentation(fixture('slides.pptx'))).slides.length, 2);
  assert.equal((await openPresentation(fixture('slides.odp'))).slides.length, 2);
  assert.equal((await openPresentation(fixture('legacy.ppt'))).slides.length, 3);
  await assert.rejects(openPresentation(new TextEncoder().encode('pas une presentation')), PresentationError);
  await assert.rejects(openPresentation(new Uint8Array()), PresentationError);
  const legacy = fixture('legacy.ppt');
  assert.throws(() => readPpt(legacy.slice(0, 1024)), PresentationError);
  assert.throws(() => readPpt(new Uint8Array(4096)), PresentationError);
  await assert.rejects(readPptx(fixture('slides.pptx').slice(0, 2000)));
});
