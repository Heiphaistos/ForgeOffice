// Volet « Lecture à voix haute » et dictée : lire depuis le curseur (ou la sélection), pause, vitesse, voix ; dictée si le navigateur l'offre.
import { useEffect, useRef, useState } from 'react';
import { Button } from '@forgeoffice/ui';
import { TextSelection } from 'prosemirror-state';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { Row, Select } from '../dialogs/common.tsx';
import { Reader, type ReaderState, type SynthLike, type UtteranceLike } from './reader.ts';
import { sentencesFrom } from './sentences.ts';

const V = X.voice;

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start(): void;
  stop(): void;
}

const recognitionClass = (): (new () => RecognitionLike) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const speechAvailable = (): boolean => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

export function SpeechPane({ c }: { c: Ctl }) {
  const [state, setState] = useState<ReaderState>('idle');
  const [rate, setRate] = useState(1);
  const [voice, setVoice] = useState('');
  const [voices, setVoices] = useState<{ name: string; lang: string }[]>([]);
  const [dictating, setDictating] = useState(false);
  const reader = useRef<Reader | null>(null);
  const recognizer = useRef<RecognitionLike | null>(null);
  const ctl = useRef(c);
  ctl.current = c;

  useEffect(() => {
    if (!speechAvailable()) return undefined;
    const load = (): void => setVoices(speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr')).concat(speechSynthesis.getVoices().filter((v) => !v.lang.toLowerCase().startsWith('fr'))).map((v) => ({ name: v.name, lang: v.lang })));
    load();
    speechSynthesis.addEventListener?.('voiceschanged', load);
    const r = new Reader(speechSynthesis as unknown as SynthLike, (text) => new SpeechSynthesisUtterance(text) as unknown as UtteranceLike, (s) => {
      const v = ctl.current.view();
      if (v && s) v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, s.from, s.to)).scrollIntoView());
    }, setState);
    reader.current = r;
    return () => {
      speechSynthesis.removeEventListener?.('voiceschanged', load);
      r.stop(false);
      recognizer.current?.stop();
    };
  }, []);

  const play = (): void => {
    const state0 = ctl.current.state();
    if (!state0 || !reader.current) return;
    const { from, to, empty } = state0.selection;
    const rest = empty ? sentencesFrom(state0.doc, from) : sentencesFrom(state0.doc, from, to);
    // Curseur en fin de document : rien apres lui, on lit depuis le debut.
    reader.current.play(rest.length ? rest : sentencesFrom(state0.doc));
  };
  const toggleDictation = (): void => {
    const Rec = recognitionClass();
    if (!Rec) return ctl.current.notify(V.noDictation, 'warning');
    if (dictating) {
      recognizer.current?.stop();
      return;
    }
    const r = new Rec();
    r.lang = 'fr-FR';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (!res.isFinal) continue;
        const text = res[0]?.transcript.trim();
        const v = ctl.current.view();
        if (text && v) v.dispatch(v.state.tr.insertText(`${text} `).scrollIntoView());
      }
    };
    r.onend = () => setDictating(false);
    r.onerror = (e) => { ctl.current.notify(V.dictationError(e.error ?? ''), 'warning'); setDictating(false); };
    recognizer.current = r;
    r.start();
    setDictating(true);
  };

  if (!speechAvailable()) return <p className="fo-word-pane__empty">{V.unavailable}</p>;
  return (
    <div className="fo-word-speech">
      <div className="fo-word-tabbtns fo-word-spellbtns">
        {state === 'idle' && <Button onClick={play}>{V.play}</Button>}
        {state === 'playing' && <Button onClick={() => reader.current?.pause()}>{V.pause}</Button>}
        {state === 'paused' && <Button onClick={() => reader.current?.resume()}>{V.resume}</Button>}
        <Button disabled={state === 'idle'} onClick={() => reader.current?.stop()}>{V.stop}</Button>
      </div>
      <Row label={`${V.speed} : ${rate.toLocaleString('fr-FR')} ×`}>
        <input type="range" aria-label={V.speed} min={0.5} max={2} step={0.25} value={rate} onChange={(e) => { const v = Number(e.target.value); setRate(v); reader.current?.setRate(v); }} />
      </Row>
      <Row label={V.voice}>
        <Select value={voice} label={V.voice} options={[['', V.defaultVoice], ...voices.map((v): [string, string] => [v.name, `${v.name} (${v.lang})`])]} onChange={(name) => { setVoice(name); reader.current?.setVoice(name); }} />
      </Row>
      <fieldset className="fo-word-fieldset">
        <legend>{V.dictation}</legend>
        <Button onClick={toggleDictation} disabled={!recognitionClass()}>{dictating ? V.stopDictation : V.dictate}</Button>
        <p className="fo-word-hint">{recognitionClass() ? V.dictationHint : V.noDictation}</p>
      </fieldset>
    </div>
  );
}
