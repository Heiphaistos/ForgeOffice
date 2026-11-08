import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMedia, addSlide, createBlankDeck, readPptx, writePptx, type MediaShape } from '../src/index.ts';

test('proprietes de lecture d un media : aller-retour (volume, automatique, boucle, masquage)', async () => {
  const deck = createBlankDeck('widescreen');
  const slide = addSlide(deck, deck.masters[0]?.layouts[1]?.id ?? '');
  const id = addMedia(deck, new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]), 'wav', 'audio/wav');
  const media: MediaShape = { kind: 'media', id: 90, name: 'Son', mediaType: 'audio', mediaId: id, geometry: { type: 'preset', preset: 'rect' }, xfrm: { x: 10, y: 10, width: 48, height: 48 }, playback: { volume: 35, auto: true, loop: true, hideInShow: true } };
  slide.shapes.push(media);
  const back = await readPptx(await writePptx(deck));
  const found = back.slides.at(-1)?.shapes.find((s) => s.kind === 'media');
  assert.ok(found && found.kind === 'media');
  assert.deepEqual(found.playback, { volume: 35, auto: true, loop: true, hideInShow: true });
});

test('sans propriete : rien n est ecrit', async () => {
  const deck = createBlankDeck('widescreen');
  const slide = addSlide(deck, deck.masters[0]?.layouts[1]?.id ?? '');
  const id = addMedia(deck, new Uint8Array([1, 2, 3]), 'wav', 'audio/wav');
  slide.shapes.push({ kind: 'media', id: 91, name: 'Son', mediaType: 'audio', mediaId: id, geometry: { type: 'preset', preset: 'rect' }, xfrm: { x: 0, y: 0, width: 10, height: 10 } });
  const found = (await readPptx(await writePptx(deck))).slides.at(-1)?.shapes.find((s) => s.kind === 'media');
  assert.ok(found && found.kind === 'media' && found.playback === undefined);
});
