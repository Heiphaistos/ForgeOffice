import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AutoShape, Deck, RunProps } from '@forgeoffice/pptx';
import { linkBoxes, reflow } from '../src/chain.ts';
import { blank } from '../src/templates/index.ts';
import { addText, para } from '../src/build.ts';
import { remeasureWhenFontsReady, type FontSetLike } from '../../ui/src/logic/fontsReady.ts';

const firstLength = (deck: Deck, page: number, id: number): number =>
  ((deck.slides[page]?.shapes.find((s) => s.id === id) as AutoShape | undefined)?.text?.paragraphs ?? []).reduce((n, p) => n + p.runs.reduce((m, r) => m + (r.type === 'break' ? 1 : r.text.length), 0), 0);

test('composition faite avant le chargement des polices refaite apres (nouvelle mesure)', async () => {
  const doc = blank('a5');
  doc.deck.slides.push({ ...structuredClone(doc.deck.slides[0]!), id: 999 });
  const [p1, p2] = doc.deck.slides;
  assert.ok(p1 && p2);
  const long = Array.from({ length: 60 }, (_, i) => `mot${i}`).join(' ');
  const a = addText(p1.shapes, [0, 0, 120, 60], [para(long, { size: 10 })]);
  const b = addText(p2.shapes, [0, 0, 120, 60], [para('', { size: 10 })]);
  const linked = linkBoxes(doc.deck, doc.pub, { page: p1.id, shape: a.id }, { page: p2.id, shape: b.id });
  assert.equal(typeof linked, 'object');
  if (typeof linked === 'string') return;

  let factor = 0.7; // police de repli, large ; la vraie (Carlito) est plus etroite
  const measure = (text: string, props: RunProps): number => text.length * (props.size ?? 18) * factor;
  let current = reflow(doc.deck, linked, measure).deck;
  const before = firstLength(current, 0, a.id);

  let open!: () => void;
  const gate = new Promise<void>((r) => { open = r; });
  const set: FontSetLike = { load: () => gate, ready: gate };
  remeasureWhenFontsReady(() => { current = reflow(current, linked, measure).deck; }, ['Calibri'], { set });
  factor = 0.45;
  open();
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(firstLength(current, 0, a.id) > before, 'plus de texte tient dans la premiere zone avec les vraies largeurs');
});
