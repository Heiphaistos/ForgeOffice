// Lecture a voix haute (speechSynthesis du navigateur, voix francaise) : le texte d'une page est reconstitue dans l'ordre de lecture.
/** Texte d'une page dans l'ordre de lecture de pdf.js (ordre du contenu, fins de ligne conservees). */
export function speechText(items: readonly { str: string; hasEOL?: boolean }[]): string {
  let out = '';
  for (const it of items) out += it.hasEOL ? `${it.str}\n` : it.str === '' || it.str.endsWith(' ') ? it.str : `${it.str} `;
  return out.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
}

/** Voix francaise disponible (la premiere dont la langue commence par « fr »), sinon null. */
export function frenchVoice(voices: readonly { lang: string }[]): { lang: string } | null {
  return voices.find((v) => v.lang.toLowerCase().startsWith('fr')) ?? null;
}

export const speechAvailable = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** Lit le texte en francais ; `onEnd(true)` si la lecture est allee au bout, `onEnd(false)` si elle a ete interrompue. */
export function speak(text: string, onEnd: (completed: boolean) => void): void {
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  const voice = frenchVoice(synth.getVoices());
  if (voice) u.voice = voice as SpeechSynthesisVoice;
  u.onend = () => onEnd(true);
  u.onerror = () => onEnd(false);
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (speechAvailable()) window.speechSynthesis.cancel();
}
