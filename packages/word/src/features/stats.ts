// Statistiques avancees (plus que Word) : lecture, elocution, lisibilite, richesse du vocabulaire, mots frequents.
import { countWords } from '@forgeoffice/docx';

export interface AdvancedStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  sentences: number;
  /** Minutes de lecture silencieuse (230 mots/min). */
  readingMinutes: number;
  /** Minutes de lecture a voix haute (140 mots/min). */
  speakingMinutes: number;
  avgWordsPerSentence: number;
  avgWordLength: number;
  uniqueWords: number;
  /** Lisibilite Kandel-Moles (Flesch adapte au francais) : 0 tres difficile .. 100 tres facile. */
  readability: number;
  longestSentenceWords: number;
  topWords: [string, number][];
}

const STOP = new Set(('le la les un une des de du d l et ou en au aux a à ce ces cet cette il elle ils elles on nous vous je tu me te se ' +
  'son sa ses leur leurs mon ma mes ton ta tes notre votre nos vos qui que quoi dont où ne pas plus par pour sur dans avec sans sous ' +
  'est sont être été avoir a ont fait faire comme mais donc or ni car si tout tous toute toutes y n s c j qu the of and to in is').split(' '));

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

/** Syllabes francaises approximatives : groupes de voyelles, e muet final retire. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/(?<=[^aeiouyàâäéèêëîïôöùûüÿœæ])e(s|nt)?$/u, '');
  const groups = w.match(/[aeiouyàâäéèêëîïôöùûüÿœæ]+/gu);
  return Math.max(1, groups?.length ?? 0);
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Statistiques d'un texte (paragraphes separes par des sauts de ligne). */
export function advancedStats(text: string): AdvancedStats {
  const words = text.match(WORD) ?? [];
  const sentences = text.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => /[\p{L}\p{N}]/u.test(s));
  const counts = new Map<string, number>();
  let letters = 0;
  let syll = 0;
  for (const w of words) {
    const lw = w.toLocaleLowerCase('fr');
    letters += [...w].length;
    syll += syllables(w);
    if (!STOP.has(lw) && lw.length > 2) counts.set(lw, (counts.get(lw) ?? 0) + 1);
  }
  const n = countWords(text);
  const s = Math.max(1, sentences.length);
  const wps = words.length ? words.length / s : 0;
  const spw = words.length ? syll / words.length : 0;
  const readability = words.length ? Math.max(0, Math.min(100, Math.round(207 - 1.015 * wps - 73.6 * spw))) : 0;
  return {
    words: n,
    characters: text.replace(/\n/g, '').length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    paragraphs: text.split('\n').filter((p) => p.trim()).length,
    sentences: sentences.length,
    readingMinutes: round1(n / 230),
    speakingMinutes: round1(n / 140),
    avgWordsPerSentence: round1(wps),
    avgWordLength: words.length ? round1(letters / words.length) : 0,
    uniqueWords: new Set(words.map((w) => w.toLocaleLowerCase('fr'))).size,
    readability,
    longestSentenceWords: sentences.reduce((m, x) => Math.max(m, countWords(x)), 0),
    topWords: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).slice(0, 10),
  };
}

/** Duree lisible (« 3 min 30 s », « 45 s »). */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes * 60);
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return sec ? `${m} min ${sec} s` : `${m} min`;
}
