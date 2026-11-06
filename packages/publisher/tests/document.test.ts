import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPptx, type AutoShape, type Deck, type RunProps } from '@forgeoffice/pptx';
import { checkDesign, imagePixels } from '../src/check.ts';
import { linkBoxes, reflow, unlinkAfter } from '../src/chain.ts';
import { readFopub, writeFopub } from '../src/fopub.ts';
import { fieldToken, fillFields, mergeDeck, parseCsv } from '../src/merge.ts';
import { defaultSettings, parseSettings } from '../src/model.ts';
import { withWrap } from '../src/pagectx.ts';
import type { PageContext } from '@forgeoffice/powerpoint/canvas';
import type { Shape } from '@forgeoffice/pptx';
import { pageCss } from '../src/pagecss.ts';
import { CATALOG, blank } from '../src/templates/index.ts';
import { addShape, addText, para, solid, hex } from '../src/build.ts';

const measure = (text: string, props: RunProps): number => text.length * (props.size ?? 18) * 0.5;
const textOf = (deck: Deck, page: number, id: number): string =>
  ((deck.slides[page]?.shapes.find((s) => s.id === id) as AutoShape | undefined)?.text?.paragraphs ?? []).map((p) => p.runs.map((r) => (r.type === 'break' ? '\n' : r.text)).join('')).join('|');

test('catalogue : chaque composition se construit et s aller-retour .fopub sans perte', async () => {
  for (const entry of CATALOG) {
    const doc = entry.build();
    assert.ok(doc.deck.slides.length >= 1, entry.kind);
    const bytes = await writeFopub(doc);
    const back = await readFopub(bytes);
    assert.equal(back.pub.kind, entry.kind);
    assert.equal(back.deck.slides.length, doc.deck.slides.length, entry.kind);
    assert.deepEqual(back.pub.imposition, doc.pub.imposition, entry.kind);
    assert.deepEqual(back.pub.chains, doc.pub.chains, entry.kind);
    assert.equal(back.deck.slides[0]?.shapes.length, doc.deck.slides[0]?.shapes.length, entry.kind);
    assert.ok(Math.abs((back.deck.size.width) - doc.deck.size.width) < 0.01, entry.kind);
  }
});

test('.fopub : reglages conserves, le paquet reste une presentation lisible', async () => {
  const doc = blank('a4');
  doc.pub = { ...defaultSettings('blank', { facing: true, bleed: 12, guides: { x: [100.5], y: [200] } }), dropCaps: {}, wraps: {} };
  const s = doc.deck.slides[0]?.shapes ?? [];
  const pic = addShape(s, [10, 10, 50, 50], solid(hex('FF0000')));
  const box = addText(s, [0, 0, 200, 100], [para('Bonjour', { size: 12 })]);
  const page = doc.deck.slides[0]?.id ?? 0;
  doc.pub.wraps[`${page}:${pic.id}`] = 'tight';
  doc.pub.dropCaps[`${page}:${box.id}`] = 3;
  const bytes = await writeFopub(doc);
  const back = await readFopub(bytes);
  assert.equal(back.pub.facing, true);
  assert.equal(back.pub.bleed, 12);
  assert.deepEqual(back.pub.guides, { x: [100.5], y: [200] });
  assert.equal(back.pub.wraps[`${page}:${pic.id}`], 'tight');
  assert.equal(back.pub.dropCaps[`${page}:${box.id}`], 3);
  const asPptx = await readPptx(bytes);
  assert.equal(asPptx.slides.length, 1);
  assert.equal(textOf(back.deck, 0, box.id), 'Bonjour');
});

test('publication.json hostile : valeurs bornees, types refuses', () => {
  const pub = parseSettings(JSON.stringify({ kind: 'virus', bleed: 1e9, margins: { top: 'x', bottom: -5 }, columns: { count: 999 }, wraps: { '1:2': 'square', 'x': 'square', '3:4': 'evil' }, chains: [{ boxes: [{ page: 1, shape: 2 }] }], dropCaps: { '1:2': 99 } }));
  assert.equal(pub.kind, 'blank');
  assert.equal(pub.bleed, 72);
  assert.equal(pub.margins.top, 36);
  assert.equal(pub.margins.bottom, 0);
  assert.equal(pub.columns.count, 24);
  assert.deepEqual(pub.wraps, { '1:2': 'square' });
  assert.deepEqual(pub.chains, []);
  assert.deepEqual(pub.dropCaps, {});
  assert.equal(parseSettings('{pas du json').kind, 'blank');
});

test('chainage dans la publication : liaison, repartition entre pages, rupture du lien', () => {
  const doc = blank('a5');
  doc.deck.slides.push({ ...structuredClone(doc.deck.slides[0]!), id: 999 });
  const [p1, p2] = doc.deck.slides;
  assert.ok(p1 && p2);
  const long = Array.from({ length: 40 }, (_, i) => `mot${i}`).join(' ');
  const a = addText(p1.shapes, [0, 0, 100, 60], [para(long, { size: 10 })]);
  const b = addText(p2.shapes, [0, 0, 100, 60], [para('', { size: 10 })]);
  const linked = linkBoxes(doc.deck, doc.pub, { page: p1.id, shape: a.id }, { page: p2.id, shape: b.id });
  assert.equal(typeof linked, 'object');
  if (typeof linked === 'string') return;
  assert.equal(linkBoxes(doc.deck, linked, { page: p1.id, shape: a.id }, { page: p2.id, shape: b.id }), 'alreadyLinked');
  const r = reflow(doc.deck, linked, measure);
  const first = textOf(r.deck, 0, a.id);
  const second = textOf(r.deck, 1, b.id);
  assert.ok(first.length > 0 && second.length > 0);
  assert.equal(`${first}${second}`, long);
  assert.equal(r.pub.chains[0]?.joins[0], true);
  // 40 mots de 10 pt dans 2 zones de 100 x 60 : debordement signale sur la derniere zone.
  assert.ok(r.overflow.has(`${p2.id}:${b.id}`));
  // Stabilite : un second calcul ne change rien.
  assert.equal(reflow(r.deck, r.pub, measure).deck, r.deck);
  const un = unlinkAfter(r.deck, r.pub, { page: p1.id, shape: a.id });
  assert.equal(un.pub.chains.length, 0);
  assert.equal(textOf(un.deck, 0, a.id), long);
  assert.equal(textOf(un.deck, 1, b.id), '');
});

test('habillage et lettrine : flottants du contexte de page et regles CSS de la page', () => {
  const doc = blank('a4');
  const slide = doc.deck.slides[0]!;
  const s = slide.shapes;
  const page = slide.id;
  const box = addText(s, [100, 100, 300, 300], [para('texte', { size: 12 })]);
  const pic = addShape(s, [90, 150, 120, 80], solid(hex('00FF00')));
  doc.pub.wraps[`${page}:${pic.id}`] = 'square';
  doc.pub.dropCaps[`${page}:${box.id}`] = 3;
  const css = pageCss(slide, doc.pub, '#077568');
  assert.ok(css.includes(`> [data-shape-id="${box.id}"] [data-text-flow] > [data-p="0"]::first-letter{initial-letter:3;`), css);
  assert.doesNotMatch(css, /float/, 'l habillage n est plus une regle CSS');
  // L'habillage est fourni au rendu par le contexte : un flottant a gauche de 110 pt de large, pour la zone seulement.
  const ctx = withWrap({ theme: {}, colorMap: {}, resolve: (x: Shape) => x, media: () => undefined, fields: {} } as unknown as PageContext, slide, doc.pub);
  const floats = ctx.wrapFloats?.(box);
  assert.equal(floats?.length, 1);
  assert.equal(floats?.[0]?.side, 'left');
  assert.ok(Math.abs((floats?.[0]?.width ?? 0) - 110) < 1e-6, String(floats?.[0]?.width));
  assert.equal(ctx.wrapFloats?.(pic), undefined, 'une image n est pas une zone de texte');
  // Objet sous la zone (ordre de superposition) : pas d'habillage.
  s.splice(s.indexOf(pic), 1);
  s.unshift(pic);
  assert.equal(withWrap({ resolve: (x: Shape) => x } as unknown as PageContext, slide, doc.pub).wrapFloats?.(box), undefined);
});

test('publipostage : CSV avec guillemets et point-virgule, champs remplis, une copie par enregistrement', () => {
  const src = parseCsv('﻿Nom;Ville\r\n"Dupont; Jean";Lyon\r\n"Martin ""Léa""";Paris\r\n\r\n');
  assert.deepEqual(src.fields, ['Nom', 'Ville']);
  assert.deepEqual(src.records, [['Dupont; Jean', 'Lyon'], ['Martin "Léa"', 'Paris']]);
  assert.equal(fillFields(`${fieldToken('Nom')} à ${fieldToken('Ville')} ${fieldToken('Inconnu')}`, src.fields, src.records[1]!), 'Martin "Léa" à Paris «Inconnu»');
  const doc = CATALOG.find((c) => c.kind === 'labels')!.build();
  const merged = mergeDeck(doc.deck, src);
  assert.equal(merged.slides.length, 2);
  assert.match(JSON.stringify(merged.slides[0]?.shapes), /Dupont; Jean/);
  assert.doesNotMatch(JSON.stringify(merged.slides[1]?.shapes), /«Nom»/);
  assert.equal(new Set(merged.slides.map((s) => s.id)).size, 2);
});

test('verification de la conception : debordement, basse resolution, hors page, police absente', () => {
  const doc = blank('a4');
  const s = doc.deck.slides[0]?.shapes ?? [];
  const page = doc.deck.slides[0]?.id ?? 0;
  const box = addText(s, [10, 10, 100, 100], [para('x', { size: 12, font: 'Police Inexistante' })]);
  addShape(s, [500, 10, 200, 50], solid(hex('000000')));
  // PNG 100 x 100 affiche sur 144 pt (2 pouces) = 50 ppp.
  const png = new Uint8Array(32);
  png.set([0x89, 0x50, 0x4e, 0x47], 0);
  png.set([0, 0, 0, 100, 0, 0, 0, 100], 16);
  assert.deepEqual(imagePixels(png), { width: 100, height: 100 });
  doc.deck.media.media1 = { id: 'media1', contentType: 'image/png', extension: 'png', bytes: png };
  s.push({ kind: 'picture', id: 50, name: 'Photo', mediaId: 'media1', fillMode: 'stretch', geometry: { type: 'preset', preset: 'rect' }, xfrm: { x: 10, y: 200, width: 144, height: 144 } });
  const issues = checkDesign(doc.deck, { overflow: new Set([`${page}:${box.id}`]), fontAvailable: (f) => f !== 'Police Inexistante', bleed: 9 });
  const kinds = issues.map((i) => i.kind).sort();
  assert.deepEqual(kinds, ['font', 'lowres', 'offpage', 'overflow']);
  assert.equal(issues.find((i) => i.kind === 'lowres')?.detail, '50');
});
