import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addAutoShape, addSlide, addTable, addTextBox, createBlankDeck, type Deck, type Slide } from '@forgeoffice/pptx';
import { buildVectorPdf } from '../src/pdf/index.ts';
import { slidePageProps } from '../src/app/slide-render.ts';

async function textOf(bytes: Uint8Array): Promise<{ pages: string[]; sizes: Array<[number, number]> }> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const fonts = new URL('../../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).href;
  const task = getDocument({ data: bytes.slice(), standardFontDataUrl: fonts, verbosity: 0 });
  const doc = await task.promise;
  const pages: string[] = [];
  const sizes: Array<[number, number]> = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const v = page.getViewport({ scale: 1 });
    sizes.push([Math.round(v.width), Math.round(v.height)]);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : '')).join(''));
  }
  await task.destroy();
  return { pages, sizes };
}

function sampleDeck(): { deck: Deck; slide: Slide } {
  const deck = createBlankDeck();
  const layout = deck.masters[0]?.layouts.find((l) => l.type === 'titleOnly') ?? deck.masters[0]?.layouts[0];
  assert.ok(layout);
  const slide = addSlide(deck, layout.id);
  return { deck, slide };
}

test('PDF vectoriel : le texte est reel et extractible par pdf.js, page a la taille de la diapositive', async () => {
  const { deck, slide } = sampleDeck();
  const title = slide.shapes.find((s) => s.placeholder?.type === 'title');
  assert.ok(title && title.kind === 'shape');
  title.text = { props: {}, paragraphs: [{ props: {}, runs: [{ type: 'text', text: 'Bilan de l’année Été 2026', props: { lang: 'fr-FR' } }] }] };
  addTextBox(slide, { x: 60, y: 200, width: 400, height: 120 }, 'Première ligne avec des accents éàç€\nDeuxième paragraphe', { size: 20 });
  const box = addAutoShape(slide, 'roundRect', { x: 500, y: 200, width: 200, height: 100, rotation: 20 }, 'Carte');
  box.text = { props: { anchor: 'ctr' }, paragraphs: [{ props: { align: 'ctr' }, runs: [{ type: 'text', text: 'Carte', props: { size: 24 } }] }] };
  box.fill = { type: 'gradient', kind: 'linear', angle: 45, stops: [{ position: 0, color: { type: 'rgb', value: 'FF0000' } }, { position: 100, color: { type: 'rgb', value: '0000FF' } }] };
  const table = addTable(slide, 2, 2, { x: 60, y: 360, width: 400, height: 80 }, [['A1', 'B1'], ['A2', 'Texte B2']]);
  assert.equal(table.table.rows.length, 2);
  const result = await buildVectorPdf([slidePageProps(deck, slide, 0, 't0')]);
  assert.equal(result.pages, 1);
  assert.equal(result.stats.skipped, 0);
  const { pages, sizes } = await textOf(result.bytes);
  assert.deepEqual(sizes[0], [Math.round(deck.size.width), Math.round(deck.size.height)]);
  const text = (pages[0] ?? '').replace(/\s+/g, ' ');
  assert.ok(text.includes('Bilan de l’année Été 2026'), text);
  assert.ok(text.includes('Première ligne avec des accents éàç€'), text);
  assert.ok(text.includes('Deuxième paragraphe'), text);
  assert.ok(text.includes('Carte'), text);
  for (const cell of ['A1', 'B1', 'A2', 'Texte B2']) assert.ok(text.includes(cell), `${cell} dans ${text}`);
});

test('PDF vectoriel : plusieurs pages, puces numerotees, lettres grecques et texte long coupe', async () => {
  const { deck, slide } = sampleDeck();
  const long = 'Un texte assez long pour devoir passer à la ligne dans une zone étroite de la diapositive, sans jamais déborder. '.repeat(3);
  const box = addTextBox(slide, { x: 40, y: 40, width: 220, height: 300 }, long, { size: 16 });
  box.text = { ...(box.text as NonNullable<typeof box.text>), paragraphs: [
    { props: { bullet: { type: 'auto', scheme: 'arabicPeriod' } }, runs: [{ type: 'text', text: 'Premier point', props: {} }] },
    { props: { bullet: { type: 'auto', scheme: 'arabicPeriod' } }, runs: [{ type: 'text', text: 'Second point α β π', props: {} }] },
    { props: { align: 'just' }, runs: [{ type: 'text', text: long, props: { size: 14 } }] },
  ] };
  const second = addSlide(deck, deck.masters[0]?.layouts[0]?.id ?? '');
  addTextBox(second, { x: 50, y: 50, width: 300, height: 40 }, 'Page deux', {});
  const result = await buildVectorPdf([slidePageProps(deck, slide, 0, 'a'), slidePageProps(deck, second, 1, 'b')]);
  const { pages } = await textOf(result.bytes);
  assert.equal(pages.length, 2);
  const first = (pages[0] ?? '').replace(/\s+/g, ' ');
  assert.ok(first.includes('1.') && first.includes('Premier point') && first.includes('2.'), first);
  assert.ok(first.includes('Second point'), first);
  assert.ok(first.includes('Un texte assez long'), first);
  assert.ok((pages[1] ?? '').includes('Page deux'));
  assert.equal(result.lossyText, false);
});

test('PDF vectoriel : un caractere sans police standard est signale', async () => {
  const { deck, slide } = sampleDeck();
  addTextBox(slide, { x: 40, y: 40, width: 300, height: 40 }, '漢字', {});
  const result = await buildVectorPdf([slidePageProps(deck, slide, 0, 'c')]);
  assert.equal(result.lossyText, true);
});
