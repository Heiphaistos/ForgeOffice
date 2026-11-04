// Codes de format localises : « jj/mm/aaaa », « # ##0,00 » (francais) <-> code canonique du fichier.
import type { NumberLocale } from './locale.ts';

type Mapper = (ch: string, prev: string, next: string, src: string, i: number) => string;

/** Applique `map` aux caracteres hors guillemets, crochets, echappements et mots General/Standard. */
function mapOutsideLiterals(code: string, map: Mapper): string {
  let out = '';
  for (let i = 0; i < code.length; i++) {
    const ch = code[i] ?? '';
    const word = code.slice(i, i + 8).toLowerCase();
    if (word.startsWith('general') || word === 'standard') {
      const len = word === 'standard' ? 8 : 7;
      out += code.slice(i, i + len);
      i += len - 1;
      continue;
    }
    if (ch === '"' || ch === '[') {
      const end = code.indexOf(ch === '"' ? '"' : ']', i + 1);
      const stop = end < 0 ? code.length : end + 1;
      out += code.slice(i, stop);
      i = stop - 1;
      continue;
    }
    if (ch === '\\' || ch === '_' || ch === '*') {
      out += ch + (code[i + 1] ?? '');
      i++;
      continue;
    }
    out += map(ch, code[i - 1] ?? '', code[i + 1] ?? '', code, i);
  }
  return out;
}

function isAmPm(src: string, i: number): boolean {
  const around = src.slice(Math.max(0, i - 3), i + 5).toUpperCase();
  return around.includes('AM/PM') || around.includes('A/P');
}

const DIGIT = /[0#?]/;
const SPACE = /[   ]/;

/** Code de format saisi en francais -> code canonique. */
export function formatCodeFromLocale(code: string, locale: NumberLocale): string {
  if (locale !== 'fr-FR') return code;
  return mapOutsideLiterals(code, (ch, prev, next, src, i) => {
    if (ch === 'j' || ch === 'J') return ch === 'j' ? 'd' : 'D';
    if ((ch === 'a' || ch === 'A') && !isAmPm(src, i)) return ch === 'a' ? 'y' : 'Y';
    if (ch === ',') return '.';
    if (SPACE.test(ch) && DIGIT.test(prev) && (DIGIT.test(next) || next === '' || /[;)"\s]/.test(next))) return ',';
    if (ch === '.') return '\\.';
    return ch;
  }).replace(/\bStandard\b/gi, 'General');
}

/** Code canonique -> code affiche dans la langue (boite de dialogue Format de cellule). */
export function formatCodeToLocale(code: string, locale: NumberLocale): string {
  if (locale !== 'fr-FR') return code;
  return mapOutsideLiterals(code, (ch, _prev, _next, src, i) => {
    if (ch === 'd' || ch === 'D') return ch === 'd' ? 'j' : 'J';
    if ((ch === 'y' || ch === 'Y') && !isAmPm(src, i)) return ch === 'y' ? 'a' : 'A';
    if (ch === '.') return ',';
    if (ch === ',') return ' ';
    return ch;
  }).replace(/\bGeneral\b/gi, 'Standard');
}
