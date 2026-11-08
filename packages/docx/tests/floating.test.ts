// Objets flottants : formes et zones de texte ancrees, aller-retour .docx (position, habillage, ordre, texte).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankDocument, readDocx, writeDocx, type Floating, type ShapeInline } from '../src/index.ts';
import { findInline, para, run } from './helpers.ts';

const floating = (patch: Partial<Floating> = {}): Floating => ({
  horizontal: { relativeTo: 'column', offset: 30 }, vertical: { relativeTo: 'paragraph', offset: 12 }, wrap: 'square', wrapSide: 'bothSides',
  behindText: false, distance: { top: 3, right: 9, bottom: 3, left: 9 }, allowOverlap: true, zIndex: 5, ...patch,
});

async function roundTrip(shape: ShapeInline): Promise<ShapeInline> {
  const doc = createBlankDocument();
  doc.body = [para([run('avant '), shape, run(' apres')])];
  const { document } = await readDocx(await writeDocx(doc));
  const found = findInline(document.body, 'shape')[0];
  assert.ok(found, 'forme relue');
  return found as ShapeInline;
}

test('forme flottante : position, habillage carre, ordre', async () => {
  const back = await roundTrip({ type: 'shape', geometry: 'ellipse', width: 90, height: 60, fill: 'DAE9F7', line: { color: '156082', width: 1.5 }, floating: floating() });
  assert.equal(back.geometry, 'ellipse');
  assert.equal(back.width, 90);
  assert.equal(back.floating?.wrap, 'square');
  assert.equal(back.floating?.horizontal.offset, 30);
  assert.equal(back.floating?.horizontal.relativeTo, 'column');
  assert.equal(back.floating?.vertical.offset, 12);
  assert.equal(back.floating?.vertical.relativeTo, 'paragraph');
  assert.equal(back.floating?.zIndex, 5);
});

test('zone de texte flottante derriere le texte, alignee, avec son texte', async () => {
  const back = await roundTrip({
    type: 'shape', geometry: 'rect', width: 160, height: 72, fill: 'FFFFFF', line: { color: '000000', width: 1 },
    text: [para('Premiere ligne'), para('Seconde ligne')],
    floating: floating({ wrap: 'none', behindText: true, horizontal: { relativeTo: 'margin', align: 'right' }, zIndex: 1 }),
  });
  assert.equal(back.floating?.wrap, 'none');
  assert.equal(back.floating?.behindText, true);
  assert.equal(back.floating?.horizontal.align, 'right');
  assert.equal(back.text?.length, 2);
  assert.equal(back.text?.[0]?.type, 'paragraph');
});

test('forme dans le texte : pas d ancrage', async () => {
  const back = await roundTrip({ type: 'shape', geometry: 'rect', width: 50, height: 30 });
  assert.equal(back.floating, undefined);
});

test('rotation de forme et geometries (fleche, etoile, bulle)', async () => {
  for (const geometry of ['rightArrow', 'star5', 'wedgeRectCallout']) {
    const back = await roundTrip({ type: 'shape', geometry, width: 60, height: 40, rotation: 45 });
    assert.equal(back.geometry, geometry);
    assert.equal(back.rotation, 45);
  }
  assert.equal((await roundTrip({ type: 'shape', geometry: 'rect', width: 60, height: 40, rotation: -90 })).rotation, 270);
  assert.equal((await roundTrip({ type: 'shape', geometry: 'rect', width: 60, height: 40 })).rotation, undefined);
});

test('couleur de soulignement et crenage : aller-retour', async () => {
  const doc = createBlankDocument();
  doc.body = [para([{ type: 'text', text: 'souligne', props: { underline: 'double', underlineColor: 'C00000', kerning: 14 } }])];
  const { document } = await readDocx(await writeDocx(doc));
  const t = findInline(document.body, 'text')[0]!;
  assert.equal(t.props.underline, 'double');
  assert.equal(t.props.underlineColor, 'C00000');
  assert.equal(t.props.kerning, 14);
});
