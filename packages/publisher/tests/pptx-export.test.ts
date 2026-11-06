import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { parseXml } from '@forgeoffice/opc';
import { readPptx } from '@forgeoffice/pptx';
import { buildPptx, exportGuides, pptxLosses } from '../src/pptx-export.ts';
import { addShape, addText, hex, solid } from '../src/build.ts';
import { blank } from '../src/templates/single.ts';
import { defaultSettings } from '../src/model.ts';

function sample() {
  const doc = blank('a4');
  const slide = doc.deck.slides[0]!;
  const box = addText(slide.shapes, [60, 60, 300, 200], [{ props: {}, runs: [{ type: 'text', text: 'Texte «Nom»', props: { size: 12 } }] }]);
  const pic = addShape(slide.shapes, [40, 100, 100, 80], solid(hex('00FF00')));
  return { doc, slide, box, pic };
}

test('export pptx : ce qui est perdu est liste, rien n est perdu pour une publication simple', () => {
  const plain = blank('a4');
  assert.deepEqual(pptxLosses(plain.deck, defaultSettings('blank', { facing: false, bleed: 0 })), []);
  const { doc, slide, box, pic } = sample();
  const page = slide.id;
  const pub = {
    ...doc.pub,
    facing: true,
    bleed: 9,
    wraps: { [`${page}:${pic.id}`]: 'square' as const, [`${page}:9999`]: 'tight' as const, [`${page}:${box.id}`]: 'none' as const },
    dropCaps: { [`${page}:${box.id}`]: 3 },
    chains: [{ id: 'article1', boxes: [{ page, shape: box.id }, { page, shape: pic.id }], joins: [false], empty: [false, true] }],
    imposition: { kind: 'cards' as const, sheet: { width: 595, height: 842 }, cols: 2, rows: 5, gapX: 0, gapY: 0 },
  };
  const lost = Object.fromEntries(pptxLosses(doc.deck, pub).map((l) => [l.kind, l.count]));
  assert.deepEqual(lost, { wrap: 1, chain: 1, dropCap: 1, merge: 1, imposition: 1, facing: 1, bleed: 1 });
});

test('export pptx : les reperes (marges, colonnes, regle) deviennent des guides PowerPoint', async () => {
  const { doc } = sample();
  const pub = { ...doc.pub, facing: false, guides: { x: [123.5, 99999], y: [200] }, columns: { count: 2, gap: 12 } };
  const g = exportGuides(doc.deck, pub);
  assert.ok(g.x.includes(123.5) && !g.x.includes(99999), 'repere hors page ignore');
  assert.ok(g.y.includes(200));
  assert.ok(g.x.length >= 4, 'marges et colonnes');
  const out = await buildPptx(doc.deck, pub);
  assert.equal(out.guides, g.x.length + g.y.length);
  const zip = await JSZip.loadAsync(out.bytes);
  const presentation = await zip.file('ppt/presentation.xml')!.async('string');
  parseXml(presentation);
  assert.ok(presentation.includes('sldGuideLst') && presentation.includes(`pos="${123.5 * 8}"`), 'guides p15 de diapositive');
  assert.ok(presentation.includes('orient="horz" pos="1600"'), 'repere horizontal (200 pt x 8)');
  const view = await zip.file('ppt/viewProps.xml')!.async('string');
  parseXml(view);
  assert.ok(view.includes('<p:guideLst>') && view.includes('pos="988"'), 'guides de l affichage');
  // Le fichier reste une presentation lisible, sans rien changer au contenu.
  const back = await readPptx(out.bytes);
  assert.equal(back.slides.length, doc.deck.slides.length);
  // Sans reperes : aucune extension ajoutee.
  const none = await buildPptx(doc.deck, { ...pub, guides: { x: [], y: [] }, margins: { ...pub.margins, inside: 0, outside: 0, top: 0, bottom: 0 }, columns: { count: 1, gap: 0 }, rows: { count: 1, gap: 0 } });
  assert.equal(none.guides, 0);
  assert.ok(!(await (await JSZip.loadAsync(none.bytes)).file('ppt/presentation.xml')!.async('string')).includes('sldGuideLst'));
});
