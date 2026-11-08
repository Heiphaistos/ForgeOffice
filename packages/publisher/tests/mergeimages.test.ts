import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import type { Picture } from '@forgeoffice/pptx';
import { mergeDeck } from '../src/merge.ts';
import { defaultSettings, parseSettings, serializeSettings, shapeKey } from '../src/model.ts';
import { imageFor, readImageZip, unmatchedImages, type ImageBank } from '../src/mergeimages.ts';
import { createPublication } from '../src/pubdeck.ts';

const png = (n: number): Uint8Array => Uint8Array.from([137, 80, 78, 71, n]);

function deckWithPicture() {
  const deck = createPublication({ width: 595, height: 842 }, 1);
  deck.media.base = { id: 'base', contentType: 'image/png', extension: 'png', bytes: png(0) };
  const pic: Picture = { kind: 'picture', id: 40, name: 'Photo', mediaId: 'base', xfrm: { x: 10, y: 10, width: 100, height: 100 } } as Picture;
  deck.slides[0]!.shapes.push(pic);
  return { deck, pic, slideId: deck.slides[0]!.id };
}

test('readImageZip / imageFor : sous-dossiers, extension facultative, casse ignorée, autres fichiers ignorés', async () => {
  const zip = new JSZip();
  zip.file('photos/Pomme.PNG', png(1));
  zip.file('poire.jpg', png(2));
  zip.file('notes.txt', 'rien');
  const bank = await readImageZip(await zip.generateAsync({ type: 'uint8array' }));
  assert.deepEqual([...bank.keys()].sort(), ['poire.jpg', 'pomme.png']);
  assert.equal(imageFor(bank, 'pomme')?.bytes[4], 1);
  assert.equal(imageFor(bank, ' POMME.png ')?.contentType, 'image/png');
  assert.equal(imageFor(bank, 'poire.jpg')?.contentType, 'image/jpeg');
  assert.equal(imageFor(bank, 'kiwi'), undefined);
  assert.equal(imageFor(bank, ''), undefined);
});

test('fusion : l image liée à un champ est remplacée par celle de chaque enregistrement', () => {
  const { deck, pic, slideId } = deckWithPicture();
  const bank: ImageBank = new Map([['pomme.png', { bytes: png(1), contentType: 'image/png', extension: 'png' }], ['poire.png', { bytes: png(2), contentType: 'image/png', extension: 'png' }]]);
  const source = { name: 'fruits', fields: ['Nom', 'Photo'], records: [['Pomme', 'pomme'], ['Poire', 'poire.png'], ['Kiwi', 'kiwi'], ['Vide', '']] };
  const imageFields = { [shapeKey(slideId, pic.id)]: 'Photo' };
  const merged = mergeDeck(deck, source, undefined, { fields: imageFields, bank });
  const medias = merged.slides.map((s) => (s.shapes.find((x) => x.id === pic.id) as Picture).mediaId);
  assert.equal(merged.media[medias[0]!]!.bytes[4], 1);
  assert.equal(merged.media[medias[1]!]!.bytes[4], 2);
  assert.equal(medias[2], 'base', 'image introuvable : image d origine conservée');
  assert.equal(medias[3], 'base', 'valeur vide : image d origine conservée');
  assert.equal(new Set(medias.slice(0, 2)).size, 2);
  assert.equal(deck.media.mergeimg1, undefined, 'le document d origine n est pas modifié');
  assert.deepEqual(unmatchedImages(deck, imageFields, source.fields, source.records, bank), ['kiwi']);
  const plain = mergeDeck(deck, source);
  assert.equal((plain.slides[0]!.shapes.find((x) => x.id === pic.id) as Picture).mediaId, 'base');
});

test('liaisons champ image : aller-retour et lecture défensive de publication.json', () => {
  const pub = defaultSettings('blank', { imageFields: { '256:40': 'Photo' } });
  assert.deepEqual(parseSettings(serializeSettings(pub)).imageFields, { '256:40': 'Photo' });
  assert.deepEqual(parseSettings('{"imageFields": {"x": "A", "1:2": 5, "3:4": "", "5:6": "ok"}}').imageFields, { '5:6': 'ok' });
  assert.deepEqual(parseSettings('{"imageFields": 3}').imageFields, {});
});
