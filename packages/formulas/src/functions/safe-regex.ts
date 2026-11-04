// Expressions regulieres venant de cellules : refus des motifs a retour arriere catastrophique (ReDoS).
// Analyse statique prudente : quantificateurs imbriques, alternatives qui se recouvrent sous une repetition,
// references arriere ; motif <= 200 caracteres, texte <= 10 000 caracteres (moins si plusieurs repetitions libres).
import { ERR, FormulaError } from '../values.ts';

export const MAX_PATTERN = 200;
export const MAX_TEXT_LENGTH = 10_000;

export interface SafeRegex {
  re: RegExp;
  /** Longueur de texte maximale acceptee pour ce motif. */
  maxText: number;
}

type Kind = 0 | 1 | 2 | 3; // aucun, optionnel (? {0,1}), borne ({n,m}), libre (* + {n,})

interface Group {
  inner: Kind;
  alts: string[];
  altStart: number;
}

const QUANT = /^\{(\d+)(?:(,)(\d*))?\}/;

function quantifierAt(p: string, i: number): { kind: Kind; len: number } | null {
  const c = p[i];
  let kind: Kind;
  let len = 1;
  if (c === '*' || c === '+') kind = 3;
  else if (c === '?') kind = 1;
  else if (c === '{') {
    const m = QUANT.exec(p.slice(i, i + 24));
    if (!m) return null;
    len = m[0].length;
    const min = Number(m[1]);
    const max = m[2] === undefined ? min : m[3] === '' ? Infinity : Number(m[3]);
    kind = max === Infinity || max > 20 ? 3 : max <= 1 ? 1 : 2;
    if (min > 20 && max !== Infinity) kind = 3;
  } else return null;
  if (p[i + len] === '?' || p[i + len] === '+') len++; // paresseux
  return { kind, len };
}

/** Longueur de texte maximale pour ce motif, ou 0 s'il est refuse. */
export function analyzePattern(p: string): number {
  const stack: Group[] = [{ inner: 0, alts: [], altStart: 0 }];
  let free = 0;
  const top = (): Group => stack[stack.length - 1] as Group;
  const note = (kind: Kind): void => {
    top().inner = Math.max(top().inner, kind) as Kind;
    if (kind === 3) free++;
  };
  if (p.length > MAX_PATTERN) return 0;
  let i = 0;
  while (i < p.length) {
    const c = p[i] as string;
    if (c === '(') {
      stack.push({ inner: 0, alts: [], altStart: 0 });
      i++;
      if (p[i] === '?') {
        i++;
        if (p[i] === '<' && p[i + 1] !== '=' && p[i + 1] !== '!') i = (p.indexOf('>', i) + 1) || p.length;
        else i += p[i] === '<' ? 2 : 1;
      }
      top().altStart = i;
    } else if (c === '|') {
      top().alts.push(p.slice(top().altStart, i));
      top().altStart = ++i;
    } else if (c === ')') {
      if (stack.length < 2) return 0;
      const g = stack.pop() as Group;
      g.alts.push(p.slice(g.altStart, i));
      i++;
      const q = quantifierAt(p, i);
      top().inner = Math.max(top().inner, g.inner) as Kind;
      if (q) {
        i += q.len;
        if (q.kind > 1) {
          if (q.kind === 3 && g.inner > 0) return 0; // (a+)+ (a?)* (a{1,3})*
          if (q.kind === 2 && g.inner === 3) return 0; // (.*a){5}
          if (g.alts.length > 1 && !disjointLiteralAlts(g.alts)) return 0; // (a|aa)+
        }
        note(q.kind);
      }
    } else {
      if (c === '\\') {
        const n = p[i + 1] ?? '';
        if (/[1-9k]/.test(n)) return 0; // reference arriere
        i += 2;
      } else if (c === '[') {
        i++;
        while (i < p.length && p[i] !== ']') i += p[i] === '\\' ? 2 : 1;
        i++;
      } else i++;
      const q = quantifierAt(p, i);
      if (q) {
        i += q.len;
        note(q.kind);
      }
    }
  }
  if (stack.length !== 1) return 0;
  if (free <= 2) return MAX_TEXT_LENGTH;
  if (free === 3) return 300;
  return free === 4 ? 100 : 0; // ponytail : borne grossiere (n^k), un moteur lineaire (RE2) la supprimerait
}

/** Alternatives sans repetition ni sous-groupe, commencant chacune par un caractere litteral distinct. */
function disjointLiteralAlts(alts: string[]): boolean {
  const seen = new Set<string>();
  for (const a of alts) {
    const f = a[0];
    if (f === undefined || /[\\[(.*+?{|^$)]/.test(f) || /[*+?{()[\\]/.test(a.slice(1).replace(/\\./g, ''))) return false;
    const k = f.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

/** Compile un motif de cellule ; FormulaError (#VALEUR!) si refuse ou invalide. */
export function safeRegex(pattern: string, flags: string): SafeRegex | FormulaError {
  const maxText = analyzePattern(pattern);
  if (maxText === 0) return ERR.VALUE;
  try {
    return { re: new RegExp(pattern, flags), maxText };
  } catch {
    return ERR.VALUE;
  }
}

/** Idem, et refuse aussi un texte trop long pour ce motif. */
export function regexFor(pattern: string, flags: string, text: string): RegExp | FormulaError {
  const s = safeRegex(pattern, flags);
  if (s instanceof FormulaError) return s;
  return text.length > s.maxText ? ERR.VALUE : s.re;
}
