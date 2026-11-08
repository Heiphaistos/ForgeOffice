// Lecture à voix haute : phrases à partir du curseur, file de lecture, pause, vitesse, voix, arrêt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchema } from '../src/editor/schema.ts';
import { sentencesFrom } from '../src/voice/sentences.ts';
import { Reader, type SynthLike, type UtteranceLike } from '../src/voice/reader.ts';

const schema = createSchema();
const p = (t: string) => schema.nodes.paragraph!.create(null, schema.text(t));
const doc = schema.nodes.doc!.create(null, [p('Bonjour tout le monde. Il fait beau ! Et demain ?'), p('Fin du texte')]);

test('phrases du document, à partir d une position', () => {
  const all = sentencesFrom(doc);
  assert.deepEqual(all.map((s) => s.text), ['Bonjour tout le monde.', 'Il fait beau !', 'Et demain ?', 'Fin du texte']);
  const mid = all[1]!.from + 3;
  const rest = sentencesFrom(doc, mid);
  assert.equal(rest[0]!.text, 'fait beau !');
  assert.equal(rest.length, 3);
  assert.deepEqual(sentencesFrom(doc, all[0]!.from, all[1]!.to).map((s) => s.text), ['Bonjour tout le monde.', 'Il fait beau !']);
});

function fake() {
  const spoken: { text: string; rate: number; voice: string | null }[] = [];
  const calls: string[] = [];
  let current: UtteranceLike | null = null;
  const synth: SynthLike = {
    speak: (u) => { current = u; spoken.push({ text: u.text, rate: u.rate, voice: u.voice?.name ?? null }); },
    cancel: () => { calls.push('cancel'); current = null; },
    pause: () => { calls.push('pause'); },
    resume: () => { calls.push('resume'); },
    getVoices: () => [{ name: 'Voix A', lang: 'fr-FR' }, { name: 'Voix B', lang: 'en-US' }],
  };
  const events: (string | null)[] = [];
  const reader = new Reader(synth, (text) => ({ text, rate: 1, lang: 'fr-FR', voice: null, onend: null, onerror: null }), (s) => events.push(s?.text ?? null), () => undefined);
  return { reader, spoken, calls, events, finish: () => (current as UtteranceLike | null)?.onend?.() };
}

test('lecture phrase par phrase, pause, reprise, fin', () => {
  const f = fake();
  f.reader.play(sentencesFrom(doc));
  assert.deepEqual(f.spoken.map((s) => s.text), ['Bonjour tout le monde.']);
  f.finish();
  assert.deepEqual(f.spoken.map((s) => s.text), ['Bonjour tout le monde.', 'Il fait beau !']);
  f.reader.pause();
  assert.equal(f.reader.state, 'paused');
  f.reader.resume();
  assert.equal(f.reader.state, 'playing');
  f.finish(); f.finish(); f.finish();
  assert.equal(f.reader.state, 'idle');
  assert.equal(f.events.at(-1), null);
  assert.deepEqual(f.calls.filter((c) => c !== 'cancel'), ['pause', 'resume']);
});

test('vitesse et voix : appliquées à la phrase relue, arrêt propre', () => {
  const f = fake();
  f.reader.play(sentencesFrom(doc));
  f.reader.setRate(1.5);
  f.reader.setVoice('Voix B');
  const last = f.spoken.at(-1)!;
  assert.equal(last.rate, 1.5);
  assert.equal(last.voice, 'Voix B');
  assert.equal(last.text, 'Bonjour tout le monde.');
  f.reader.setRate(9);
  assert.equal(f.reader.rate, 3);
  const n = f.spoken.length;
  f.reader.stop();
  f.finish();
  assert.equal(f.spoken.length, n);
  assert.equal(f.reader.state, 'idle');
});
