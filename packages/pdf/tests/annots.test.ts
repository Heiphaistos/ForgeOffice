// Annotations deja presentes (relecture, modification, suppression), pages pivotees / CropBox, formulaires AcroForm reels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFArray, PDFBool, PDFDict, PDFDocument, PDFName, PDFRawStream, StandardFonts, decodePDFRawStream, degrees } from '@cantoo/pdf-lib';
import { applyItems } from '../src/apply.ts';
import { readAnnotations } from '../src/annots.ts';
import { inspectFlags, readFields, writeValues } from '../src/forms.ts';
import {
  fitInto, fromPdfPoint, fromPdfRect, fromScreenPoint, mergeExisting, newId, restyle, screenFrame, toNativeZone, toPdfPoint, toPdfRect, toScreenPoint, hasPending,
  type DocState, type Item, type PageGeom, type Point, type Rect,
} from '../src/model.ts';

const base = { author: 'Momo', at: Date.UTC(2026, 10, 4) };
const near = (a: number, b: number, eps = 0.004): boolean => Math.abs(a - b) <= eps;
const rectNear = (a: Rect, b: Rect): boolean => near(a.x, b.x) && near(a.y, b.y) && near(a.w, b.w) && near(a.h, b.h);
const pointNear = (a: Point, b: Point): boolean => near(a.x, b.x) && near(a.y, b.y);

async function sample(rotate = 0, crop?: [number, number, number, number]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p = doc.addPage([600, 800]);
  p.drawText('Bonjour page 1', { x: 60, y: 700, size: 20, font });
  p.setRotation(degrees(rotate));
  if (crop) p.setCropBox(...crop);
  return doc.save();
}

const state = (items: Item[], annotEdits: DocState['annotEdits'] = {}): Pick<DocState, 'items' | 'values' | 'annotEdits'> => ({ items, values: {}, annotEdits });

function samples(): Item[] {
  return [
    { ...base, id: newId(), page: 0, kind: 'mark', mark: 'highlight', rects: [{ x: 0.1, y: 0.1, w: 0.3, h: 0.03 }, { x: 0.1, y: 0.14, w: 0.2, h: 0.03 }], color: '#FFE500', text: 'Bonjour' },
    { ...base, id: newId(), page: 0, kind: 'mark', mark: 'underline', rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.03 }], color: '#185ABD', text: '' },
    { ...base, id: newId(), page: 0, kind: 'note', pos: { x: 0.7, y: 0.1 }, text: 'À revoir', color: '#FFE500' },
    { ...base, id: newId(), page: 0, kind: 'freetext', rect: { x: 0.1, y: 0.3, w: 0.5, h: 0.1 }, text: 'Texte libre', size: 14, color: '#185ABD' },
    { ...base, id: newId(), page: 0, kind: 'shape', shape: 'ellipse', rect: { x: 0.2, y: 0.5, w: 0.3, h: 0.2 }, from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, color: '#D13438', width: 2 },
    { ...base, id: newId(), page: 0, kind: 'shape', shape: 'arrow', rect: { x: 0.1, y: 0.6, w: 0.4, h: 0.1 }, from: { x: 0.1, y: 0.6 }, to: { x: 0.5, y: 0.7 }, color: '#185ABD', width: 2 },
    { ...base, id: newId(), page: 0, kind: 'ink', points: [{ x: 0.1, y: 0.8 }, { x: 0.2, y: 0.82 }, { x: 0.3, y: 0.79 }], color: '#000000', width: 2 },
    { ...base, id: newId(), page: 0, kind: 'stamp', stamp: 'confidentiel', rect: { x: 0.6, y: 0.85, w: 0.3, h: 0.06 } },
  ];
}

for (const rotate of [0, 90, 180, 270]) {
  test(`annotations existantes : relecture fidele, page tournee de ${rotate} degres + CropBox`, async () => {
    const written = await applyItems(await sample(rotate, [20, 30, 560, 760]), state(samples()), { coverTextEdits: false });
    const { items, display } = await readAnnotations(written);
    const orig = samples();
    assert.equal(items.length, orig.length);
    items.forEach((it, i) => {
      const o = orig[i]!;
      assert.equal(it.kind, o.kind);
      assert.equal(it.author, 'Momo');
      assert.match(it.id, /^a:\d+\.\d+$/);
      if (it.kind === 'mark' && o.kind === 'mark') {
        assert.equal(it.mark, o.mark);
        assert.equal(it.color.toLowerCase(), o.color.toLowerCase());
        assert.equal(it.text, o.text);
        // la page affichee est celle du CropBox : les rectangles lus sont ceux d'origine
        it.rects.forEach((r, k) => assert.ok(rectNear(r, o.rects[k]!), `rect ${k} ${JSON.stringify(r)}`));
      } else if (it.kind === 'note' && o.kind === 'note') {
        assert.ok(pointNear(it.pos, o.pos));
        assert.equal(it.text, 'À revoir');
      } else if (it.kind === 'freetext' && o.kind === 'freetext') {
        assert.ok(rectNear(it.rect, o.rect));
        assert.equal(it.text, 'Texte libre');
        assert.equal(it.size, 14);
        assert.equal(it.color.toLowerCase(), '#185abd');
      } else if (it.kind === 'shape' && o.kind === 'shape') {
        assert.equal(it.shape, o.shape);
        if (o.shape === 'ellipse') assert.ok(rectNear(it.rect, o.rect), JSON.stringify(it.rect));
        else assert.ok(pointNear(it.from, o.from) && pointNear(it.to, o.to));
      } else if (it.kind === 'ink' && o.kind === 'ink') {
        it.points.forEach((p, k) => assert.ok(pointNear(p, o.points[k]!)));
      } else if (it.kind === 'stamp' && o.kind === 'stamp') {
        assert.equal(it.stamp, 'confidentiel');
        assert.ok(rectNear(it.rect, o.rect));
      }
    });
    // L'affichage pdf.js n'a plus ces annotations (la couche d'edition les redessine).
    assert.equal((await PDFDocument.load(display)).getPage(0).node.Annots()?.size() ?? 0, 0);
  });
}

test('annotations existantes : ouvrir, modifier, supprimer, enregistrer, rouvrir', async () => {
  const written = await applyItems(await sample(), state(samples()), { coverTextEdits: false });
  const first = (await readAnnotations(written)).items;
  const by = <K extends Item['kind']>(k: K): Extract<Item, { kind: K }> => first.find((i) => i.kind === k) as Extract<Item, { kind: K }>;
  const hl = by('mark');
  const note = by('note');
  const free = by('freetext');
  const stamp = by('stamp');
  const edits: DocState['annotEdits'] = {
    [hl.id]: restyle(hl, { color: '#7FD13B' }),
    [note.id]: { ...note, pos: { x: 0.2, y: 0.9 }, text: 'Corrigé' },
    [free.id]: { ...free, text: 'Nouveau texte' },
    [stamp.id]: null,
  };
  assert.equal(hasPending({ bytes: written, items: [], values: {}, annotEdits: edits, log: [] }), true);
  assert.equal(mergeExisting(first, edits).length, first.length - 1);
  const saved = await applyItems(written, state([], edits), { coverTextEdits: false });
  const reopened = (await readAnnotations(saved)).items;
  assert.equal(reopened.length, first.length - 1, 'le tampon est supprime, les autres ne sont pas dupliques');
  assert.ok(!reopened.some((i) => i.kind === 'stamp'));
  assert.equal(reopened.filter((i) => i.kind === 'mark').length, 2);
  const hl2 = reopened.find((i) => i.kind === 'mark' && i.mark === 'highlight');
  assert.equal(hl2?.kind === 'mark' && hl2.color.toLowerCase(), '#7fd13b');
  const note2 = reopened.find((i) => i.kind === 'note');
  assert.ok(note2?.kind === 'note' && pointNear(note2.pos, { x: 0.2, y: 0.9 }) && note2.text === 'Corrigé');
  const free2 = reopened.find((i) => i.kind === 'freetext');
  assert.equal(free2?.kind === 'freetext' && free2.text, 'Nouveau texte');
  // une deuxieme passe sans modification ne change rien
  assert.equal((await readAnnotations(await applyItems(saved, state([]), { coverTextEdits: false }))).items.length, reopened.length);
});

const G90: PageGeom = { box: [20, 30, 560, 760], rotate: 90 };

test('coordonnees : aller-retour PDF <-> ecran pour chaque rotation, CropBox decale', () => {
  for (const rotate of [0, 90, 180, 270]) {
    const g: PageGeom = { box: [20, 30, 560, 760], rotate };
    const r: Rect = { x: 0.12, y: 0.31, w: 0.4, h: 0.22 };
    const back = fromPdfRect(toPdfRect(r, g), g);
    assert.ok(rectNear(back, r), `rotate ${rotate}`);
    const p: Point = { x: 0.7, y: 0.2 };
    assert.ok(pointNear(fromPdfPoint(toPdfPoint(p, g), g), p));
    // le coin haut gauche de la page affichee est un coin du CropBox
    const [cx, cy] = toPdfPoint({ x: 0, y: 0 }, g);
    assert.ok([20, 560].includes(cx) && [30, 760].includes(cy));
  }
});

test('rotation de l affichage : aller-retour et sens horaire', () => {
  for (const vr of [0, 90, 180, 270]) {
    const p: Point = { x: 0.2, y: 0.7 };
    assert.ok(pointNear(fromScreenPoint(toScreenPoint(p, vr), vr), p));
  }
  assert.deepEqual(toScreenPoint({ x: 0, y: 0 }, 90), { x: 1, y: 0 }, 'haut gauche -> haut droit apres 90 degres horaires');
  assert.deepEqual(toScreenPoint({ x: 0, y: 1 }, 90), { x: 0, y: 0 });
});

test('texte libre sur page pivotee : l apparence est tournee pour rester droite a l ecran', async () => {
  const r: Rect = { x: 0.1, y: 0.1, w: 0.4, h: 0.1 };
  const f = screenFrame(r, G90);
  // repere local -> PDF : l'axe « droite ecran » est l'axe y de la page, « haut ecran » est -x
  assert.ok(near(f.matrix[0], 0, 1e-9) && near(f.matrix[1], 1, 1e-9) && near(f.matrix[2], -1, 1e-9) && near(f.matrix[3], 0, 1e-9));
  assert.ok(near(f.w, 0.4 * 730, 1e-6) && near(f.h, 0.1 * 540, 1e-6), 'taille a l\'ecran = hauteur/largeur permutees');
  const out = await PDFDocument.load(await applyItems(await sample(90), state([{ ...base, id: newId(), page: 0, kind: 'freetext', rect: r, text: 'Pivot', size: 12, color: '#000000' }]), { coverTextEdits: false }));
  const annot = out.context.lookup(out.getPage(0).node.Annots()?.get(0), PDFDict);
  const ap = annot.lookup(PDFName.of('AP'), PDFDict).lookup(PDFName.of('N')) as PDFRawStream;
  const content = new TextDecoder('latin1').decode(decodePDFRawStream(ap).decode());
  assert.match(content, /^q 0 1 -1 0 [\d.]+ [\d.]+ cm/, content.slice(0, 60));
  const upright = await PDFDocument.load(await applyItems(await sample(0), state([{ ...base, id: newId(), page: 0, kind: 'freetext', rect: r, text: 'Droit', size: 12, color: '#000000' }]), { coverTextEdits: false }));
  const ap0 = upright.context.lookup(upright.getPage(0).node.Annots()?.get(0), PDFDict).lookup(PDFName.of('AP'), PDFDict).lookup(PDFName.of('N')) as PDFRawStream;
  assert.match(new TextDecoder('latin1').decode(decodePDFRawStream(ap0).decode()), /^q 1 0 0 1 /);
});

test('formulaire AcroForm : /V, apparence regeneree, NeedAppearances, lecture des widgets d une page pivotee', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  page.setRotation(degrees(90));
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  form.createTextField('Nom').addToPage(page, { x: 50, y: 700, width: 200, height: 20, font });
  form.createCheckBox('Accord').addToPage(page, { x: 50, y: 650, width: 14, height: 14 });
  const radio = form.createRadioGroup('Civilite');
  radio.addOptionToPage('Mme', page, { x: 50, y: 600, width: 14, height: 14 });
  radio.addOptionToPage('M', page, { x: 100, y: 600, width: 14, height: 14 });
  const dd = form.createDropdown('Ville');
  dd.addOptions(['Lyon', 'Paris']);
  dd.addToPage(page, { x: 50, y: 550, width: 120, height: 20, font });
  const list = form.createOptionList('Choix');
  list.addOptions(['A', 'B', 'C']);
  list.addToPage(page, { x: 50, y: 450, width: 120, height: 60, font });
  const bytes = await doc.save();

  const fields = await readFields(bytes);
  assert.deepEqual(fields.map((f) => f.type), ['texte', 'case', 'radio', 'liste', 'liste']);
  const nom = fields[0]!.widgets[0]!;
  // page tournee de 90 : le champ (x 50..250, y 700..720) apparait sous forme de colonne
  assert.ok(nom.rect.h > nom.rect.w, JSON.stringify(nom.rect));
  assert.deepEqual(fields[2]!.widgets.map((w) => w.option), ['Mme', 'M']);

  const edited = await PDFDocument.load(bytes);
  writeValues(edited, { Nom: 'Élodie Martin € ☃', Accord: true, Civilite: 'M', Ville: 'Paris', Choix: 'B' });
  const saved = await edited.save();
  const back = await readFields(saved);
  assert.deepEqual(back.map((f) => f.value), ['Élodie Martin € ?', true, 'M', 'Paris', 'B']);
  const reread = await PDFDocument.load(saved);
  const acro = reread.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
  assert.equal(acro.lookup(PDFName.of('NeedAppearances')), PDFBool.True);
  const nomField = reread.getForm().getTextField('Nom').acroField;
  assert.equal(nomField.dict.lookup(PDFName.of('V'))?.toString(), reread.getForm().getTextField('Nom').acroField.dict.get(PDFName.of('V'))?.toString());
  const widget = nomField.getWidgets()[0]!;
  assert.ok(widget.dict.lookup(PDFName.of('AP'), PDFDict).has(PDFName.of('N')), 'apparence du champ regeneree');
});

test('widgets crees sur une page pivotee : rotation de contenu MK/R', async () => {
  const items: Item[] = [{ ...base, id: newId(), page: 0, kind: 'field', field: 'texte', name: 'Nom', rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.03 }, options: [], value: '' }];
  const out = await applyItems(await sample(90), state(items), { coverTextEdits: false });
  const doc = await PDFDocument.load(out);
  const w = doc.getForm().getTextField('Nom').acroField.getWidgets()[0]!;
  assert.equal(w.dict.lookup(PDFName.of('MK'), PDFDict).get(PDFName.of('R'))?.toString(), '90');
  const [f] = await readFields(out);
  assert.ok(rectNear(f!.widgets[0]!.rect, { x: 0.1, y: 0.1, w: 0.3, h: 0.03 }), JSON.stringify(f!.widgets[0]!.rect));
});

test('XFA et JavaScript : detectes, jamais executes', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  assert.deepEqual(await inspectFlags(await doc.save()), { xfa: false, javascript: false });
  const js = doc.context.obj({ S: 'JavaScript', JS: 'app.alert(1)' });
  doc.catalog.set(PDFName.of('OpenAction'), js);
  doc.getForm().acroForm.dict.set(PDFName.of('XFA'), PDFArray.withContext(doc.context));
  const flags = await inspectFlags(await doc.save());
  assert.deepEqual(flags, { xfa: true, javascript: true });
});

test('zone native : relative a la zone visible (CropBox decale) et a la page non tournee', () => {
  const crop: PageGeom = { box: [20, 30, 520, 730], rotate: 0 };
  const z = toNativeZone({ x: 0, y: 0, w: 0.5, h: 0.5 }, 0, crop);
  assert.ok(near(z.x, 0, 1e-9) && near(z.y, 0, 1e-9) && near(z.largeur, 0.5, 1e-9) && near(z.hauteur, 0.5, 1e-9));
  for (const rotate of [90, 180, 270]) {
    const g: PageGeom = { box: [20, 30, 520, 730], rotate };
    // un rectangle affiche, converti en zone native puis relu depuis le PDF, retombe sur le meme rectangle
    const r: Rect = { x: 0.2, y: 0.3, w: 0.25, h: 0.1 };
    const [llx, lly, urx, ury] = toPdfRect(r, g);
    const zone = toNativeZone(r, 0, g);
    assert.ok(near(zone.x, (llx - 20) / 500, 1e-9) && near(zone.y, (730 - ury) / 700, 1e-9) && near(zone.largeur, (urx - llx) / 500, 1e-9) && near(zone.hauteur, (ury - lly) / 700, 1e-9), `rotate ${rotate}`);
  }
});

test('style d un element selectionne : couleur, epaisseur, taille', () => {
  const [hl, , note, free, shape, , ink, stamp] = samples();
  assert.equal(restyle(hl!, { color: '#7FD13B' })?.kind === 'mark' && (restyle(hl!, { color: '#7FD13B' }) as { color: string }).color, '#7FD13B');
  assert.equal((restyle(note!, { color: '#4CC2FF' }) as { color: string }).color, '#4CC2FF');
  assert.equal((restyle(free!, { size: 20 }) as { size: number; color: string }).size, 20);
  assert.equal((restyle(shape!, { width: 6 }) as { width: number }).width, 6);
  assert.equal((restyle(ink!, { color: '#000000', width: 3 }) as { width: number }).width, 3);
  assert.equal(restyle(stamp!, { color: '#000000' }), null, 'un tampon n a pas de couleur reglable');
  assert.equal(restyle(hl!, { width: 4 }), null, 'un surlignage n a pas d epaisseur');
});

test('signature dessinee posee dans un champ : proportions conservees, centree', () => {
  const target: Rect = { x: 0.1, y: 0.8, w: 0.4, h: 0.05 };
  const r = fitInto(target, 0.3, 600, 800); // image 3,33 fois plus large que haute ; cadre 240 x 40 pt (6 fois)
  assert.ok(near(r.h, target.h, 1e-9), 'limitee par la hauteur');
  assert.ok(near((r.w * 600) / (r.h * 800), 1 / 0.3, 1e-9), 'proportions de l image');
  assert.ok(near(r.x + r.w / 2, target.x + target.w / 2, 1e-9) && near(r.y + r.h / 2, target.y + target.h / 2, 1e-9));
  const tall = fitInto({ x: 0, y: 0, w: 0.1, h: 0.5 }, 0.3, 600, 800);
  assert.ok(near(tall.w, 0.1, 1e-9) && tall.h < 0.5, 'limitee par la largeur');
});
