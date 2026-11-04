// Logique sans DOM du module PDF : coordonnees, surlignage, recherche, comparaison, ecriture des annotations et formulaires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, StandardFonts, degrees } from '@cantoo/pdf-lib';
import {
  diffLines, hitRect, moveIndex, newId, rectFrom, search, snapToText, textUnder, toNativeZone, toPdfPoint, toPdfRect, uniqueFieldName,
  type Item, type PageGeom, type TextBox,
} from '../src/model.ts';
import { applyItems, readFields } from '../src/apply.ts';

const g0: PageGeom = { box: [0, 0, 600, 800], rotate: 0 };
const base = { author: 'Momo', at: Date.UTC(2026, 10, 4) };

async function sample(rotate = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 2; i++) {
    const p = doc.addPage([600, 800]);
    p.setRotation(degrees(rotate));
    p.drawText(`Bonjour page ${i + 1}`, { x: 60, y: 700, size: 20, font });
  }
  return doc.save();
}

test('coordonnees ecran -> PDF selon /Rotate', () => {
  assert.deepEqual(toPdfPoint({ x: 0, y: 0 }, g0), [0, 800]);
  assert.deepEqual(toPdfPoint({ x: 1, y: 1 }, g0), [600, 0]);
  const g90: PageGeom = { box: [0, 0, 600, 800], rotate: 90 };
  assert.deepEqual(toPdfPoint({ x: 0, y: 0 }, g90), [0, 0], 'haut gauche affiche = bas gauche PDF');
  assert.deepEqual(toPdfPoint({ x: 1, y: 0 }, g90), [0, 800]);
  const g180: PageGeom = { box: [0, 0, 600, 800], rotate: 180 };
  assert.deepEqual(toPdfPoint({ x: 0, y: 0 }, g180), [600, 0]);
  const g270: PageGeom = { box: [0, 0, 600, 800], rotate: 270 };
  assert.deepEqual(toPdfPoint({ x: 0, y: 0 }, g270), [600, 800]);
  assert.deepEqual(toPdfRect({ x: 0.1, y: 0.1, w: 0.5, h: 0.25 }, g0), [60, 520, 360, 720]);
  const z = toNativeZone({ x: 0.1, y: 0.1, w: 0.5, h: 0.25 }, 0, g0);
  assert.equal(z.page, 1);
  assert.ok(Math.abs(z.x - 0.1) < 1e-9 && Math.abs(z.y - 0.1) < 1e-9 && Math.abs(z.largeur - 0.5) < 1e-9);
  const z90 = toNativeZone({ x: 0, y: 0, w: 0.5, h: 0.5 }, 1, g90);
  assert.ok(Math.abs(z90.y - 0.5) < 1e-9, 'zone ramenee dans la page non pivotee');
});

test('surlignage colle aux lignes de texte', () => {
  const boxes: TextBox[] = [
    { str: 'Première ligne de texte', rect: { x: 0.1, y: 0.1, w: 0.6, h: 0.02 }, size: 12 },
    { str: 'Deuxième ligne', rect: { x: 0.1, y: 0.13, w: 0.4, h: 0.02 }, size: 12 },
    { str: 'Loin', rect: { x: 0.1, y: 0.5, w: 0.1, h: 0.02 }, size: 12 },
  ];
  const one = snapToText(rectFrom({ x: 0.3, y: 0.105 }, { x: 0.5, y: 0.11 }), boxes);
  assert.equal(one.length, 1);
  assert.ok(Math.abs((one[0]?.x ?? 0) - 0.3) < 1e-9 && Math.abs((one[0]?.w ?? 0) - 0.2) < 1e-9);
  const two = snapToText(rectFrom({ x: 0.3, y: 0.105 }, { x: 0.2, y: 0.14 }), boxes);
  assert.equal(two.length, 2);
  assert.equal(textUnder(two, boxes), 'Première ligne de texte Deuxième ligne');
  assert.deepEqual(snapToText({ x: 0.8, y: 0.8, w: 0.1, h: 0.1 }, boxes), [{ x: 0.8, y: 0.8, w: 0.1, h: 0.1 }]);
});

test('recherche sans accents ni casse, comparaison, ordre des pages', () => {
  const pages: TextBox[][] = [[{ str: 'Rapport d’activité 2026', rect: { x: 0, y: 0, w: 1, h: 0.1 }, size: 12 }], [{ str: 'ACTIVITE et activité', rect: { x: 0, y: 0, w: 1, h: 0.1 }, size: 12 }]];
  const hits = search(pages, 'activite');
  assert.equal(hits.length, 3);
  assert.deepEqual(hits.map((h) => h.page), [0, 1, 1]);
  const r = hitRect(pages[1]![0]!, 0, 8);
  assert.ok(Math.abs(r.w - 8 / 20) < 1e-9);
  const d = diffLines(['a', 'b', 'c'], ['a', 'x', 'c', 'd']);
  assert.deepEqual(d.map((l) => `${l.kind}:${l.text}`), ['same:a', 'add:x', 'del:b', 'same:c', 'add:d']);
  assert.deepEqual(moveIndex(4, 0, 2), [1, 2, 0, 3]);
  assert.deepEqual(moveIndex(4, 3, 0), [3, 0, 1, 2]);
  assert.equal(uniqueFieldName('Texte', new Set(['Texte1', 'Texte2'])), 'Texte3');
});

test('ecriture des annotations reelles avec apparence', async () => {
  const items: Item[] = [
    { ...base, id: newId(), page: 0, kind: 'mark', mark: 'highlight', rects: [{ x: 0.1, y: 0.1, w: 0.3, h: 0.03 }], color: '#FFE500', text: 'Bonjour' },
    { ...base, id: newId(), page: 0, kind: 'mark', mark: 'strike', rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.03 }], color: '#D13438', text: '' },
    { ...base, id: newId(), page: 0, kind: 'note', pos: { x: 0.8, y: 0.1 }, text: 'À revoir', color: '#FFE500' },
    { ...base, id: newId(), page: 0, kind: 'freetext', rect: { x: 0.1, y: 0.3, w: 0.5, h: 0.1 }, text: 'Texte libre\nsur deux lignes', size: 14, color: '#185ABD' },
    { ...base, id: newId(), page: 1, kind: 'shape', shape: 'ellipse', rect: { x: 0.2, y: 0.2, w: 0.3, h: 0.2 }, from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, color: '#D13438', width: 2 },
    { ...base, id: newId(), page: 1, kind: 'shape', shape: 'arrow', rect: { x: 0, y: 0, w: 0, h: 0 }, from: { x: 0.1, y: 0.6 }, to: { x: 0.5, y: 0.7 }, color: '#185ABD', width: 2 },
    { ...base, id: newId(), page: 1, kind: 'ink', points: [{ x: 0.1, y: 0.8 }, { x: 0.2, y: 0.82 }, { x: 0.3, y: 0.79 }], color: '#000000', width: 2 },
    { ...base, id: newId(), page: 1, kind: 'stamp', stamp: 'confidentiel', rect: { x: 0.6, y: 0.05, w: 0.3, h: 0.06 } },
    { ...base, id: newId(), page: 0, kind: 'redact', rect: { x: 0, y: 0, w: 0.1, h: 0.1 } },
  ];
  const out = await PDFDocument.load(await applyItems(await sample(), { items, values: {} }, { coverTextEdits: true }));
  const subtypes = (i: number): string[] => {
    const annots = out.getPage(i).node.Annots();
    return Array.from({ length: annots?.size() ?? 0 }, (_, k) => {
      const dict = out.context.lookup(annots?.get(k));
      const d = dict as unknown as { get(n: PDFName): unknown };
      assert.ok(d.get(PDFName.of('AP')), 'apparence presente');
      return String(d.get(PDFName.of('Subtype')));
    });
  };
  assert.deepEqual(subtypes(0), ['/Highlight', '/StrikeOut', '/Text', '/FreeText']);
  assert.deepEqual(subtypes(1), ['/Circle', '/Line', '/Ink', '/Stamp']);
});

test('formulaire : creation de champs, valeurs, lecture et aplatissement', async () => {
  const items: Item[] = [
    { ...base, id: newId(), page: 0, kind: 'field', field: 'texte', name: 'Nom', rect: { x: 0.1, y: 0.5, w: 0.4, h: 0.03 }, options: [], value: '' },
    { ...base, id: newId(), page: 0, kind: 'field', field: 'case', name: 'Accord', rect: { x: 0.1, y: 0.55, w: 0.03, h: 0.02 }, options: [], value: '' },
    { ...base, id: newId(), page: 1, kind: 'field', field: 'liste_deroulante', name: 'Ville', rect: { x: 0.1, y: 0.6, w: 0.3, h: 0.03 }, options: ['Lyon', 'Paris'], value: '' },
  ];
  const withFields = await applyItems(await sample(), { items, values: {} }, { coverTextEdits: false });
  const fields = await readFields(withFields);
  assert.deepEqual(fields.map((f) => [f.name, f.type]), [['Nom', 'texte'], ['Accord', 'case'], ['Ville', 'liste']]);
  const nom = fields[0]!.widgets[0]!;
  assert.equal(nom.page, 0);
  assert.ok(Math.abs(nom.rect.x - 0.1) < 0.005 && Math.abs(nom.rect.y - 0.5) < 0.005 && Math.abs(nom.rect.w - 0.4) < 0.005, 'bordure du widget comprise');
  assert.equal(fields[2]!.widgets[0]!.page, 1);
  const filled = await applyItems(withFields, { items: [], values: { Nom: 'Élodie Martin', Accord: true, Ville: 'Lyon' } }, { coverTextEdits: false });
  const back = await readFields(filled);
  assert.deepEqual(back.map((f) => f.value), ['Élodie Martin', true, 'Lyon']);
  const flat = await PDFDocument.load(await applyItems(filled, { items: [], values: {} }, { coverTextEdits: false, flatten: true }));
  assert.equal(flat.getForm().getFields().length, 0);
});

test('pages pivotees : les annotations restent dans la page', async () => {
  const items: Item[] = [{ ...base, id: newId(), page: 0, kind: 'freetext', rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 }, text: 'Pivot', size: 12, color: '#000000' }];
  const out = await PDFDocument.load(await applyItems(await sample(90), { items, values: {} }, { coverTextEdits: false }));
  const annot = out.context.lookup(out.getPage(0).node.Annots()?.get(0)) as unknown as { get(n: PDFName): { asRectangle(): { x: number; y: number; width: number; height: number } } };
  const r = annot.get(PDFName.of('Rect')).asRectangle();
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 600 && r.y + r.height <= 800);
});
