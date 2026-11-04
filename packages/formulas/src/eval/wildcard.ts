// Jokers Excel (* ? ~) sans expression reguliere : parcours iteratif, jamais de retour arriere exponentiel.
// Les segments entre « * » sont places au plus tot (glouton) : O(texte x motif).

const ANY = -1;

/** Longueur maximale d'un motif a jokers (limite d'Excel pour les criteres). */
export const MAX_WILDCARD = 255;

/** Pliage de casse conservant la longueur (comparaison insensible a la casse, comme le drapeau « i »). */
function fold(s: string): string {
  let out = '';
  for (const ch of s) {
    const u = ch.toUpperCase();
    out += u.length === ch.length ? u : ch;
  }
  return out;
}

export interface WildcardMatcher {
  /** Le texte entier correspond-il au motif ? */
  test(text: string): boolean;
  /** Position (base 0) du debut de la premiere correspondance, -1 si aucune (motif non ancre, comme SEARCH). */
  search(text: string): number;
}

export function wildcardMatcher(pattern: string): WildcardMatcher {
  const segments: number[][] = [];
  let cur: number[] = [];
  let startsStar = false;
  let endsStar = false;
  let any = false;
  const flush = () => {
    if (cur.length) segments.push(cur);
    cur = [];
  };
  const src = fold(pattern);
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] ?? '';
    if (ch === '*') {
      if (!any && cur.length === 0) startsStar = true;
      any = true;
      flush();
      endsStar = true;
    } else {
      any = true;
      endsStar = false;
      if (ch === '~' && i + 1 < src.length) cur.push((src[++i] ?? '').charCodeAt(0));
      else cur.push(ch === '?' ? ANY : ch.charCodeAt(0));
    }
  }
  flush();

  const matchAt = (seg: number[], s: string, at: number): boolean => {
    if (at < 0 || at + seg.length > s.length) return false;
    for (let k = 0; k < seg.length; k++) if (seg[k] !== ANY && seg[k] !== s.charCodeAt(at + k)) return false;
    return true;
  };
  const find = (seg: number[], s: string, from: number, end: number): number => {
    for (let p = from; p + seg.length <= end; p++) if (matchAt(seg, s, p)) return p;
    return -1;
  };

  return {
    test(text) {
      const s = fold(text);
      if (segments.length === 0) return startsStar || s === '';
      const first = segments[0] as number[];
      const last = segments[segments.length - 1] as number[];
      let pos = 0;
      let i = 0;
      if (!startsStar) {
        if (!matchAt(first, s, 0)) return false;
        pos = first.length;
        i = 1;
        if (segments.length === 1 && !endsStar) return s.length === first.length;
      }
      let end = s.length;
      let stop = segments.length;
      if (!endsStar) {
        end = s.length - last.length;
        stop--;
        if (end < pos || !matchAt(last, s, end)) return false;
      }
      for (; i < stop; i++) {
        const seg = segments[i] as number[];
        const p = find(seg, s, pos, end);
        if (p < 0) return false;
        pos = p + seg.length;
      }
      return true;
    },
    search(text) {
      const s = fold(text);
      if (segments.length === 0) return 0;
      const first = segments[0] as number[];
      // Le debut le plus a gauche est faisable ssi n'importe quel debut l'est (le reste se place au plus tot).
      const start = startsStar ? 0 : find(first, s, 0, s.length);
      if (start < 0) return -1;
      let pos = startsStar ? 0 : start + first.length;
      for (let i = startsStar ? 0 : 1; i < segments.length; i++) {
        const seg = segments[i] as number[];
        const p = find(seg, s, pos, s.length);
        if (p < 0) return -1;
        pos = p + seg.length;
      }
      return start;
    },
  };
}
