import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addAutoShape, addSlide, createBlankDeck, type Animation, type Slide } from '@forgeoffice/pptx';
import { Rehearsal, ShowFollower, ShowLeader, parseDown, parseUp, type ShowCommand, type ShowSnapshot } from '../src/app/show-sync.ts';
import { applyTimings, clearTimings } from '../src/app/deck-ops.ts';
import { hiddenAtStep } from '../src/app/playback.ts';

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const until = async (cond: () => boolean, ms = 3000): Promise<void> => {
  const t = Date.now();
  while (!cond() && Date.now() - t < ms) await wait(15);
  assert.ok(cond(), 'condition non atteinte');
};

const snapshot = (over: Partial<ShowSnapshot> = {}): ShowSnapshot => ({ pos: 0, index: 0, order: [0, 1, 2], step: 0, startedAt: 1000, paused: null, blank: null, ended: false, ...over });

test('ecran du presentateur : le suiveur recoit la presentation puis l etat, et pilote le meneur', async () => {
  const channel = `test-show-${Date.now()}`;
  const commands: Array<[ShowCommand, number | undefined]> = [];
  const leader = new ShowLeader(async () => ({ bytes: new Uint8Array([1, 2, 3]), name: 'expose' }), (c, p) => commands.push([c, p]), channel);
  let deckName = '';
  let deckBytes = 0;
  const states: ShowSnapshot[] = [];
  const follower = new ShowFollower({ onDeck: (b, n) => { deckBytes = b.length; deckName = n; }, onState: (s) => states.push(s), onBye: () => undefined }, channel);
  try {
    leader.publish(snapshot({ pos: 1, index: 1, step: 2 }));
    follower.hello(50);
    await until(() => deckBytes === 3 && states.length > 0);
    assert.equal(deckName, 'expose');
    assert.equal(states.at(-1)?.pos, 1);
    assert.equal(states.at(-1)?.step, 2);
    // Une nouvelle position est diffusee, un etat identique ne l'est pas deux fois.
    const before = states.length;
    leader.publish(snapshot({ pos: 2, index: 2 }));
    leader.publish(snapshot({ pos: 2, index: 2 }));
    await until(() => states.length > before);
    await wait(60);
    assert.equal(states.length, before + 1);
    assert.equal(states.at(-1)?.index, 2);
    // Les commandes du presentateur arrivent au meneur.
    follower.send('next');
    follower.send('goto', 0);
    follower.send('pause');
    await until(() => commands.length === 3);
    assert.deepEqual(commands, [['next', undefined], ['goto', 0], ['pause', undefined]]);
    assert.equal(leader.connected, true);
  } finally {
    follower.close();
    leader.close();
  }
});

test('ecran du presentateur : invitation d une fenetre vide et fin du diaporama', async () => {
  const channel = `test-announce-${Date.now()}`;
  const leader = new ShowLeader(async () => ({ bytes: new Uint8Array(1), name: 'x' }), () => undefined, channel);
  let announced = 0;
  let bye = 0;
  const follower = new ShowFollower({ onDeck: () => undefined, onState: () => undefined, onBye: () => bye++, onAnnounce: () => announced++ }, channel);
  try {
    leader.announce(1000, 20);
    await until(() => announced >= 2);
    follower.hello(30);
    await until(() => leader.connected);
    const seen = announced;
    await wait(120);
    assert.ok(announced - seen <= 1, 'plus d invitation une fois connecte');
  } finally {
    leader.close();
    await until(() => bye === 1);
    follower.close();
  }
});

test('messages du canal : forme verifiee, contenu hostile ignore', () => {
  assert.equal(parseDown(null), null);
  assert.equal(parseDown({ kind: 'state', state: { pos: 'x' } }), null);
  assert.equal(parseDown({ kind: 'deck', bytes: 'pas un tableau', name: 'a' }), null);
  assert.equal(parseUp({ kind: 'cmd', cmd: 'format-c' }), null);
  assert.deepEqual(parseUp({ kind: 'cmd', cmd: 'goto', pos: 4 }), { kind: 'cmd', cmd: 'goto', pos: 4 });
  const ok = parseDown({ kind: 'state', state: { pos: 1, index: 1, order: [0, 'a', 1], step: 0, startedAt: 5, paused: 'x', blank: 'rouge', ended: true } });
  assert.deepEqual(ok, { kind: 'state', state: { pos: 1, index: 1, order: [0, 1], step: 0, startedAt: 5, paused: null, blank: null, ended: true } });
});

test('repetition du minutage : duree par diapositive, retour arriere cumule, repetition d une diapositive', () => {
  const r = new Rehearsal();
  r.enter(0, 1000);
  r.enter(1, 4200); // 3,2 s sur la diapositive 0
  r.enter(0, 9200); // 5 s sur la 1, retour sur la 0
  assert.equal(r.currentTime(9700), 3200 + 500);
  r.restartCurrent(10000);
  assert.equal(r.currentTime(10000), 0);
  r.leave(12000);
  assert.deepEqual(r.timings(), { 0: 2000, 1: 5000 });
  assert.equal(r.total(), 7000);
  // Une diapositive vue moins d'une seconde reste a une seconde (jamais d'avance instantanee).
  const quick = new Rehearsal();
  quick.enter(3, 0);
  quick.leave(120);
  assert.deepEqual(quick.timings(), { 3: 1000 });
});

test('minutage : applique a l avance automatique des diapositives, effacable', () => {
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const layout = deck.masters[0]?.layouts[0]?.id ?? '';
  addSlide(deck, layout);
  addSlide(deck, layout);
  addSlide(deck, layout);
  const withTransition = deck.slides[1] as Slide;
  withTransition.transition = { type: 'fade', duration: 700, advanceOnClick: true };
  const next = applyTimings(deck, { 0: 4000, 1: 2500 });
  assert.equal(next.slides[0]?.transition?.advanceAfter, 4000);
  assert.equal(next.slides[0]?.transition?.type, 'none');
  assert.equal(next.slides[1]?.transition?.advanceAfter, 2500);
  assert.equal(next.slides[1]?.transition?.type, 'fade', 'la transition existante est conservee');
  assert.equal(next.slides[2]?.transition, undefined);
  assert.equal(deck.slides[0]?.transition, undefined, 'la presentation d origine n est pas modifiee');
  const cleared = clearTimings(next);
  assert.equal(cleared.slides[0]?.transition?.advanceAfter, undefined);
  assert.equal(cleared.slides[1]?.transition?.duration, 700);
});

test('etapes d animation : formes visibles selon l etape jouee dans l ecran du presentateur', () => {
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const slide = addSlide(deck, deck.masters[0]?.layouts[0]?.id ?? '');
  const a = addAutoShape(slide, 'rect', { x: 0, y: 0, width: 10, height: 10 });
  const b = addAutoShape(slide, 'rect', { x: 20, y: 0, width: 10, height: 10 });
  const entry = (id: number): Animation => ({ shapeId: id, class: 'entr', presetId: 10, trigger: 'onClick', delay: 0, duration: 500 });
  slide.animations = [entry(a.id), entry(b.id)];
  assert.deepEqual([...hiddenAtStep(slide, 0)].sort(), [a.id, b.id].sort());
  assert.deepEqual([...hiddenAtStep(slide, 1)], [b.id]);
  assert.deepEqual([...hiddenAtStep(slide, 2)], []);
});
