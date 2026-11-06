// Correction automatique a la frappe (typographie francaise) : espaces insecables avant la ponctuation double, guillemets
// « » et apostrophe courbe, remplacements courants. Logique pure (texte avant le curseur + caractere tape), sans ProseMirror.

export const NBSP = ' ';
/** Espace fine insecable : avant ; ! ? (typographie francaise). */
export const NNBSP = ' ';

export interface Correction {
  /** Nombre de caracteres a supprimer avant le curseur. */
  remove: number;
  /** Texte a inserer a la place (contient le caractere tape). */
  insert: string;
}

export interface AutocorrectOptions {
  /** Typographie francaise (espaces insecables, guillemets « »). Faux : guillemets droits conserves. */
  french: boolean;
  /** Majuscule en debut de phrase. */
  capitalize?: boolean;
}

const isSpace = (c: string | undefined): boolean => c === ' ' || c === NBSP || c === NNBSP;
const isWordChar = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}%)\]»"’']/u.test(c);
const isOpening = (c: string | undefined): boolean => c === undefined || /[\s([{«  —–-]/u.test(c);

/** Remplacements declenches par un espace ou une ponctuation apres le motif. */
const REPLACEMENTS: readonly (readonly [string, string])[] = [
  ['(c)', '©'], ['(C)', '©'], ['(r)', '®'], ['(R)', '®'], ['(tm)', '™'], ['(TM)', '™'],
  ['...', '…'], ['-->', '→'], ['<--', '←'], ['==>', '⇒'], ['<==', '⇐'],
  ['1/2', '½'], ['1/4', '¼'], ['3/4', '¾'],
];

/**
 * Correction a appliquer quand `typed` est tape apres `before` (le texte du paragraphe avant le curseur), ou null.
 * `typed` est un seul caractere (la saisie par collage n'est jamais corrigee).
 */
export function correct(before: string, typed: string, opt: AutocorrectOptions): Correction | null {
  if (typed.length !== 1) return null;
  const prev = before.slice(-1) || undefined;

  // Apostrophe droite -> apostrophe courbe.
  if (typed === "'") return { remove: 0, insert: '’' };

  if (opt.french) {
    // Ponctuation double : espace insecable avant (fine avant ; ! ?, normale avant :).
    if (typed === ';' || typed === '!' || typed === '?' || typed === ':') {
      const space = typed === ':' ? NBSP : NNBSP;
      if (prev === undefined || /[\s  ]/u.test(prev) && before.trim() === '') return null; // debut de paragraphe
      if (isSpace(prev)) return prev === space ? null : { remove: 1, insert: space + typed };
      // Pas d'espace : on en ajoute une apres un mot ou un chiffre, jamais apres une autre ponctuation (« ?! », « ... »).
      if (isWordChar(prev)) {
        // Exceptions : adresses et heures (« 12:30 », « http: »), deux-points colles aux chiffres des deux cotes ne sont pas visibles ici.
        if (typed === ':' && /\d$/.test(before)) return null;
        // Schemas d'adresse (« https:// », « mailto: ») et lettres de lecteur (« C:\ ») : jamais d'espace avant les deux-points.
        if (typed === ':' && (/(?:^|[\s(])(?:https?|ftps?|mailto|file|tel|ssh|git)$/iu.test(before) || /(?:^|\s)[A-Za-z]$/u.test(before))) return null;
        return { remove: 0, insert: space + typed };
      }
      return null;
    }
    // Guillemets droits -> « » avec espaces insecables.
    if (typed === '"') {
      // Un « encore ouvert dans le paragraphe : ce guillemet le ferme (meme apres une espace tapee), sinon il ouvre.
      const open = (before.match(/«/g)?.length ?? 0) > (before.match(/»/g)?.length ?? 0);
      if (!open && isOpening(prev)) return { remove: 0, insert: `«${NBSP}` };
      return { remove: isSpace(prev) ? 1 : 0, insert: open ? `${NBSP}»` : `«${NBSP}` };
    }
    // « tape a la main : espace insecable apres ; » : espace insecable avant.
    if (typed === '«') return { remove: 0, insert: `«${NBSP}` };
    if (typed === '»') return { remove: isSpace(prev) ? 1 : 0, insert: `${NBSP}»` };
  } else if (typed === '"') {
    return { remove: 0, insert: isOpening(prev) ? '“' : '”' };
  }

  // Remplacements : declenches par une espace ou une ponctuation qui suit le motif.
  if (/[\s,;:!?)]/u.test(typed)) {
    for (const [pattern, to] of REPLACEMENTS) {
      if (before.endsWith(pattern)) {
        const start = before.length - pattern.length;
        // Fractions et symboles : seulement isoles (pas au milieu d'un mot ou d'un nombre).
        const lead = before[start - 1];
        if (/[\p{L}\p{N}]/u.test(lead ?? '') && /^\d/.test(pattern)) continue;
        return { remove: pattern.length, insert: to + typed };
      }
    }
  }
  return null;
}

export type AutoList = { kind: 'bullet'; char: string } | { kind: 'number'; text: string };

/**
 * Marqueur de liste tape en debut de paragraphe : « - », « * », « • » (puces) ou « 1. », « 1) » (numerotation).
 * `before` est le texte du paragraphe avant l'espace tapee ; renvoie null si ce n'est pas un marqueur.
 */
export function listMarker(before: string): AutoList | null {
  if (before === '-' || before === '*' || before === '•' || before === '–') return { kind: 'bullet', char: '•' };
  const n = before.match(/^(\d{1,3})([.)])$/);
  if (n) return { kind: 'number', text: n[2] === ')' ? '%1)' : '%1.' };
  return null;
}

/** Abreviations courantes (francais) qui se terminent par un point sans finir la phrase. */
const ABBREVIATIONS = new Set(['etc', 'cf', 'ex', 'm', 'mm', 'mme', 'mlle', 'dr', 'pr', 'me', 'st', 'ste', 'vs', 'av', 'apr', 'env', 'min', 'max', 'réf', 'ref', 'tél', 'tel', 'p', 'pp', 'n', 'no', 'fig', 'vol', 'éd', 'ed', 'art', 'al', 'resp', 'càd', 'cad', 'chap', 'sec', 'incl', 'excl', 'approx', 'cie', 'sté', 'mr', 'mrs', 'ms']);
const abbreviation = (sentence: string): boolean => ABBREVIATIONS.has((sentence.match(/(\p{L}+)\.$/u)?.[1] ?? '').toLowerCase());

/**
 * Majuscule en debut de phrase : quand une espace est tapee apres un mot en minuscules place en tete de paragraphe ou apres
 * « . ! ? … », ce mot prend une majuscule. Renvoie null s'il n'y a rien a faire (mot deja capitalise, « iPhone », abreviation...).
 */
export function capitalizeSentence(before: string, typed: string): Correction | null {
  if (typed !== ' ') return null;
  const word = before.match(/\p{L}+$/u)?.[0];
  if (!word || word !== word.toLowerCase() || word[0] === word[0]?.toUpperCase()) return null;
  const head = before.slice(0, before.length - word.length);
  const atStart = head === '';
  const afterEnd = /[.!?…][\s  ]+$/u.test(head);
  if (!atStart && !afterEnd) return null;
  if (!atStart) {
    const sentence = head.replace(/[\s  ]+$/u, '');
    // Numero de liste (« 1. »), abreviation (« etc. », « M. ») ou point entre deux nombres : la phrase continue.
    if (/(?:^|\s)\d+\.$/u.test(sentence) || abbreviation(sentence)) return null;
  }
  return { remove: word.length, insert: word[0]!.toUpperCase() + word.slice(1) + typed };
}

/** Adresse web ou e-mail tape juste avant l'espace : position (dans `before`) et texte, sans ponctuation finale ; null sinon. */
export function urlToken(before: string): { start: number; end: number; address: string } | null {
  const token = before.match(/(\S+)$/u)?.[1];
  if (!token) return null;
  const clean = token.replace(/[.,;:!?)»"'’\]]+$/u, '');
  const isUrl = /^https?:\/\/[^\s/$.?#][^\s]*$/iu.test(clean) || /^www\.[^\s.]+\.[^\s]{2,}$/iu.test(clean);
  const isMail = /^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/iu.test(clean);
  if (!isUrl && !isMail) return null;
  const start = before.length - token.length;
  return { start, end: start + clean.length, address: clean };
}
