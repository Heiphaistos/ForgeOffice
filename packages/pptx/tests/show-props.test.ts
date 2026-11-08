import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankDeck, readPptx, writePptx } from '../src/index.ts';

test('parametres du diaporama : aller-retour kiosque, boucle, plage, sans animation, minutages ignores', async () => {
  const deck = createBlankDeck('widescreen');
  deck.show = { mode: 'kiosk', loop: true, noAnimation: true, manual: true, from: 2, to: 4 };
  const back = await readPptx(await writePptx(deck));
  assert.deepEqual(back.show, { mode: 'kiosk', loop: true, noAnimation: true, manual: true, from: 2, to: 4 });
});

test('sans parametres : rien n est ecrit ni relu ; presentateur et toutes les diapositives par defaut', async () => {
  const back = await readPptx(await writePptx(createBlankDeck('widescreen')));
  assert.equal(back.show, undefined);
  const deck = createBlankDeck('widescreen');
  deck.show = { mode: 'speaker' };
  assert.deepEqual((await readPptx(await writePptx(deck))).show, { mode: 'speaker' });
});

test('les autres elements de presProps sont conserves', async () => {
  const deck = createBlankDeck('widescreen');
  deck.show = { mode: 'browse', loop: true };
  const once = await readPptx(await writePptx(deck));
  once.show = { mode: 'speaker', from: 3 };
  const twice = await readPptx(await writePptx(once));
  assert.deepEqual(twice.show, { mode: 'speaker', from: 3 });
  assert.ok(twice.preserved.presProps);
});

test('diaporamas personnalises : aller-retour avec ordre et repetitions, et choix dans p:showPr', async () => {
  const deck = createBlankDeck('widescreen');
  const a = deck.slides[0]?.id ?? 0;
  const { addSlide } = await import('../src/index.ts');
  const s2 = addSlide(deck, deck.masters[0]?.layouts[1]?.id ?? '');
  const s3 = addSlide(deck, deck.masters[0]?.layouts[1]?.id ?? '');
  deck.customShows = [{ id: 4, name: 'Court', slideIds: [s3.id, a, s3.id] }, { id: 7, name: 'Autre', slideIds: [s2.id] }];
  deck.show = { mode: 'speaker', customShowId: 4 };
  const back = await readPptx(await writePptx(deck));
  assert.deepEqual(back.customShows?.map((c) => [c.id, c.name, c.slideIds.map((id) => back.slides.findIndex((s) => s.id === id))]), [[4, 'Court', [2, 0, 2]], [7, 'Autre', [1]]]);
  assert.equal(back.show?.customShowId, 4);
});
