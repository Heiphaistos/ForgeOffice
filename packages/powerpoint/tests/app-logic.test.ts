import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTable, createBlankDeck, type Animation, type Slide, type TableShape } from '@forgeoffice/pptx';
import { buildSteps, effectFrames, initiallyHidden, parseMotionPath, showOrder, transitionDuration, transitionFrames, triggerSteps } from '../src/app/playback.ts';
import { deleteColumns, deleteRows, distribute, insertColumn, insertRow, mergeRange, splitColumns, unmerge } from '../src/app/table-ops.ts';
import { addSection, applyHeaderFooter, editSlide, moveSlides, removeSection, resizeDeck, createInk } from '../src/app/deck-ops.ts';
import { applyDesignTheme, applyPalette, currentThemeId, DESIGN_THEMES, PALETTES } from '../src/app/themes.ts';
import { designIdeas } from '../src/app/designer.ts';

const anim = (shapeId: number, trigger: Animation['trigger'], cls: Animation['class'] = 'entr', extra: Partial<Animation> = {}): Animation => ({ shapeId, class: cls, presetId: 10, trigger, delay: 0, duration: 500, ...extra });

test('etapes d animation : clic, avec, apres, depart automatique', () => {
  const steps = buildSteps([anim(2, 'withPrevious'), anim(3, 'onClick'), anim(4, 'withPrevious', 'entr', { delay: 200 }), anim(5, 'afterPrevious'), anim(6, 'onClick', 'exit')]);
  assert.equal(steps.length, 3);
  assert.equal(steps[0]?.auto, true);
  assert.deepEqual(steps[1]?.effects.map((e) => e.start), [0, 200, 700]);
  assert.equal(steps[1]?.total, 1200);
  assert.equal(steps[2]?.auto, false);
});

test('formes cachees au depart, declencheurs, trajectoires', () => {
  const slide = { id: 1, layoutId: 'x', shapes: [], comments: [], animations: [anim(2, 'onClick'), anim(2, 'onClick', 'exit'), anim(3, 'onClick', 'emph'), anim(4, 'onClick', 'entr', { triggerShapeId: 9 })] } as Slide;
  assert.deepEqual([...initiallyHidden(slide)].sort(), [2, 4]);
  assert.equal(buildSteps(slide.animations).length, 3);
  assert.equal(triggerSteps(slide.animations).get(9)?.effects.length, 1);
  assert.deepEqual(parseMotionPath('M 0 0 L 0.25 -0.1 E'), [{ x: 0, y: 0 }, { x: 0.25, y: -0.1 }]);
  const path = effectFrames(anim(2, 'onClick', 'path', { path: 'M 0 0 L 0.5 0 E' }), { width: 960, height: 540 });
  assert.equal(path.keyframes[1]?.transform, 'translate(480px, 0px)');
  const exit = effectFrames(anim(2, 'onClick', 'exit'), { width: 1, height: 1 });
  assert.equal(exit.keyframes[0]?.opacity, 1);
});

test('transitions : durees et images cles', () => {
  assert.equal(transitionDuration(undefined), 0);
  assert.equal(transitionDuration({ type: 'cut' }), 0);
  assert.equal(transitionDuration({ type: 'fade', duration: 1200 }), 1200);
  assert.equal(transitionDuration({ type: 'fade', speed: 'slow' }), 1000);
  const push = transitionFrames({ type: 'push', params: { dir: 'u' } });
  assert.equal(push.incoming[0]?.transform, 'translate(0%, 100%)');
  for (const type of ['fade', 'push', 'wipe', 'split', 'circle', 'zoom', 'flip', 'vortex', 'reveal', 'randomBar', 'cover', 'pull', 'morph']) {
    const f = transitionFrames({ type, duration: 500 });
    assert.ok(f.incoming.length >= 2 && f.outgoing.length >= 2, type);
  }
  assert.deepEqual(showOrder([{ hidden: true }, {}, {}] as Slide[]), [1, 2]);
});

test('tableau : lignes, colonnes, fusion, fractionnement', () => {
  const slide = { shapes: [] } as unknown as Slide;
  const t = addTable(slide, 2, 2, { x: 0, y: 0, width: 200, height: 74 }) as TableShape;
  insertRow(t, 1);
  assert.equal(t.table.rows.length, 3);
  assert.equal(t.xfrm?.height, 111);
  insertColumn(t, 0);
  assert.equal(t.table.columns.length, 3);
  assert.equal(t.xfrm?.width, 300);
  mergeRange(t, 0, 0, 1, 1);
  assert.equal(t.table.rows[0]?.cells[0]?.gridSpan, 2);
  assert.equal(t.table.rows[1]?.cells[1]?.vMerge, true);
  unmerge(t, 0, 0);
  assert.equal(t.table.rows[0]?.cells[0]?.gridSpan, undefined);
  splitColumns(t, 0, 2, 2);
  assert.equal(t.table.columns.length, 4);
  assert.equal(t.table.rows[1]?.cells[2]?.gridSpan, 2);
  deleteRows(t, 0, 0);
  deleteColumns(t, 3, 3);
  assert.equal(t.table.rows.length, 2);
  assert.equal(t.table.columns.length, 3);
  t.table.columns = [10, 20, 30];
  distribute(t, 'columns');
  assert.deepEqual(t.table.columns, [20, 20, 20]);
});

test('sections, deplacement de diapositives, en-tete et pied', () => {
  let deck = createBlankDeck('widescreen');
  for (let i = 0; i < 3; i++) deck = { ...deck, slides: [...deck.slides, { ...structuredClone(deck.slides[0]), id: 300 + i } as Slide] };
  deck = addSection(deck, 301, 'Partie 2');
  assert.equal(deck.sections.length, 2);
  assert.deepEqual(deck.sections[1]?.slideIds, [301, 302]);
  deck = moveSlides(deck, [256], 3);
  assert.deepEqual(deck.slides.map((s) => s.id), [300, 301, 256, 302]);
  assert.ok(deck.sections[1]?.slideIds.includes(256));
  deck = removeSection(deck, deck.sections[1]?.id ?? '');
  assert.equal(deck.sections.length, 1);
  deck = applyHeaderFooter(deck, { date: false, slideNumber: true, footer: true, footerText: 'Pied', notOnTitle: true });
  const numbered = deck.slides.every((s) => s.shapes.some((x) => x.placeholder?.type === 'sldNum'));
  assert.equal(numbered, false, 'pas sur la diapositive de titre');
  const other = applyHeaderFooter(createBlankDeck(), { date: true, slideNumber: true, footer: true, footerText: 'Pied', notOnTitle: false });
  assert.equal(other.slides[0]?.shapes.filter((x) => ['dt', 'sldNum', 'ftr'].includes(x.placeholder?.type ?? '')).length, 3);
});

test('copie partielle : seule la diapositive modifiee est clonee', () => {
  const deck = createBlankDeck();
  const next = editSlide(deck, deck.slides[0]?.id ?? 0, (s) => { s.hidden = true; });
  assert.notEqual(next.slides[0], deck.slides[0]);
  assert.equal(next.masters, deck.masters);
  assert.equal(next.media, deck.media);
});

test('taille des diapositives, encre', () => {
  const deck = createBlankDeck('widescreen');
  const resized = resizeDeck(deck, { width: 720, height: 540 }, 'fit');
  assert.equal(resized.size.width, 720);
  const shapes: never[] = [];
  const id = createInk(shapes, [{ x: 10, y: 10 }, { x: 30, y: 20 }], '#FF0000', 2, false);
  assert.equal(id, 2);
});

test('themes, palettes et Concepteur', () => {
  const deck = createBlankDeck();
  for (const t of DESIGN_THEMES) {
    const themed = applyDesignTheme(deck, t.id, 1);
    assert.equal(currentThemeId(themed), t.id);
  }
  const pal = applyPalette(deck, PALETTES[3]?.id ?? '');
  assert.notDeepEqual(pal.masters[0]?.theme.colors.accent1, deck.masters[0]?.theme.colors.accent1);
  const slide = deck.slides[0];
  assert.ok(slide);
  const ideas = designIdeas(deck, slide, (s) => s.xfrm);
  assert.ok(ideas.length >= 3);
  assert.ok(ideas.every((i) => i.slide.shapes.length >= slide.shapes.length));
});
