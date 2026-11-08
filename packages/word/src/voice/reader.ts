// Lecteur à voix haute : file de phrases dite par SpeechSynthesis (injectable pour les tests), pause, reprise, arrêt, vitesse, voix.
import type { Sentence } from './sentences.ts';

export interface SynthLike {
  speak(u: UtteranceLike): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  getVoices(): { name: string; lang: string }[];
}

export interface UtteranceLike {
  text: string;
  rate: number;
  lang: string;
  voice: { name: string; lang: string } | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
}

export type ReaderState = 'idle' | 'playing' | 'paused';

export class Reader {
  private queue: Sentence[] = [];
  private index = 0;
  private generation = 0;
  state: ReaderState = 'idle';
  rate = 1;
  voiceName = '';

  private readonly synth: SynthLike;
  private readonly make: (text: string) => UtteranceLike;
  private readonly onSentence: (s: Sentence | null) => void;
  private readonly onState: (s: ReaderState) => void;

  constructor(synth: SynthLike, make: (text: string) => UtteranceLike, onSentence: (s: Sentence | null) => void, onState: (s: ReaderState) => void) {
    this.synth = synth;
    this.make = make;
    this.onSentence = onSentence;
    this.onState = onState;
  }

  private set(state: ReaderState): void {
    this.state = state;
    this.onState(state);
  }

  /** Lit la file de phrases depuis la première. */
  play(sentences: Sentence[]): void {
    this.stop(false);
    if (sentences.length === 0) return;
    this.queue = sentences;
    this.index = 0;
    this.set('playing');
    this.next(this.generation);
  }

  private next(gen: number): void {
    if (gen !== this.generation) return;
    const s = this.queue[this.index];
    if (!s) {
      this.set('idle');
      this.onSentence(null);
      return;
    }
    this.onSentence(s);
    const u = this.make(s.text);
    u.rate = this.rate;
    const voice = this.synth.getVoices().find((v) => v.name === this.voiceName) ?? null;
    u.voice = voice;
    if (voice) u.lang = voice.lang;
    u.onend = () => {
      if (gen !== this.generation || this.state === 'idle') return;
      this.index++;
      this.next(gen);
    };
    u.onerror = () => { if (gen === this.generation) this.stop(); };
    this.synth.speak(u);
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.synth.pause();
    this.set('paused');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.synth.resume();
    this.set('playing');
  }

  /** Nouvelle vitesse : appliquée à la phrase en cours (relue) puis aux suivantes. */
  setRate(rate: number): void {
    this.rate = Math.min(3, Math.max(0.5, rate));
    if (this.state === 'playing') this.restartCurrent();
  }

  setVoice(name: string): void {
    this.voiceName = name;
    if (this.state === 'playing') this.restartCurrent();
  }

  private restartCurrent(): void {
    this.generation++;
    this.synth.cancel();
    this.next(this.generation);
  }

  stop(notify = true): void {
    this.generation++;
    this.synth.cancel();
    if (this.state !== 'idle') this.set('idle');
    if (notify) this.onSentence(null);
  }
}
