// CELLULE("format"), ("parentheses"), ("couleur") : code court deduit du format de nombre (valide dans Excel 365).
import { compileFormat, type Part } from '../format/numfmt.ts';

export interface FormatInfo {
  /** Code court : G, F2, ,0, C2, P1, S2, D1..D9 (H1..H4 pour les heures en francais). */
  code: string;
  parentheses: number;
  color: number;
}

const isDatePart = (p: Part): p is Extract<Part, { k: 'date' }> => p.k === 'date';

/** Code d'un format de date ou d'heure (sections[0] contient des jetons date). */
function dateCode(parts: Part[]): string {
  const toks = parts.filter(isDatePart).map((p) => p.tok);
  if (toks.some((t) => t === '[h]' || t === '[m]' || t === '[s]')) return 'G';
  const day = toks.filter((t) => t[0] === 'd');
  const month = toks.filter((t) => t[0] === 'm' && !t.endsWith('i') && t !== 'mmmm' && t !== 'mmmmm');
  const fullMonth = toks.some((t) => t === 'mmmm' || t === 'mmmmm');
  const year = toks.filter((t) => t[0] === 'y');
  const ampm = toks.some((t) => t === 'ampm' || t === 'ap');
  const seconds = toks.some((t) => t === 's' || t === 'ss');
  if (day.length + month.length + year.length === 0 && !fullMonth) {
    if (!toks.some((t) => t === 'h' || t === 'hh')) return 'G';
    return ampm ? (seconds ? 'T1' : 'T2') : seconds ? 'T3' : 'T4';
  }
  if (fullMonth || day.some((t) => t === 'ddd' || t === 'dddd')) return 'G';
  const order = toks.filter((t) => t[0] === 'd' || t[0] === 'y' || (t[0] === 'm' && !t.endsWith('i'))).map((t) => t[0]);
  const key = order.join('');
  if (key === 'dmy') return 'D1';
  if (key === 'mdy') return 'D4';
  if (key === 'dm') return 'D2';
  if (key === 'my') return 'D3';
  if (key === 'md') return 'D5';
  return 'G';
}

/** Parties numeriques : decimales, milliers, pourcentage, exposant, monnaie. */
function numberCode(parts: Part[], currency: boolean): string {
  let decimals = 0;
  let seenDot = false;
  let seenDigit = false;
  let thousands = false;
  let percent = false;
  let exp = false;
  parts.forEach((p, i) => {
    if (p.k === 'dot') seenDot = true;
    else if (p.k === 'digit') {
      seenDigit = true;
      if (seenDot && !exp) decimals++;
    } else if (p.k === 'comma' && seenDigit && !seenDot && parts.slice(i + 1).some((q) => q.k === 'digit')) thousands = true;
    else if (p.k === 'pct') percent = true;
    else if (p.k === 'exp') exp = true;
  });
  if (exp) return `S${decimals}`;
  if (percent) return `P${decimals}`;
  if (currency) return `C${decimals}`;
  if (thousands) return `,${decimals}`;
  return `F${decimals}`;
}

const FR_LETTER: Record<string, string> = { ',': 'P', P: '%', C: 'M', G: 'S' };
const FR_TIME: Record<string, string> = { T1: 'H1', T2: 'H2', T3: 'H3', T4: 'H4' };
const EN_TIME: Record<string, string> = { T1: 'D6', T2: 'D7', T3: 'D8', T4: 'D9' };

export function cellFormatInfo(numFmt: string | undefined, french: boolean): FormatInfo {
  const compiled = compileFormat(numFmt === undefined || numFmt.trim() === '' ? 'General' : numFmt);
  const first = compiled.sections[0];
  if (!first) return { code: french ? 'S' : 'G', parentheses: 0, color: 0 };
  const parentheses = first.parts.some((p) => p.k === 'lit' && p.v.includes('(')) ? 1 : 0;
  const color = compiled.sections.length > 1 && compiled.sections[1]?.color !== undefined ? 1 : 0;
  let code: string;
  if (first.isDate) code = dateCode(first.parts);
  else if (!first.hasNumber || first.parts.some((p) => p.k === 'general') || first.hasText) code = 'G';
  else {
    const money = first.currency !== undefined || first.parts.some((p) => p.k === 'lit' && /[$€£¥]/.test(p.v));
    code = numberCode(first.parts, money);
    if (color === 1) code += '-';
  }
  if (code.startsWith('T')) return { code: (french ? FR_TIME : EN_TIME)[code] ?? code, parentheses, color };
  if (french) {
    const head = code[0] ?? 'G';
    if (head === 'S' && code.length === 1) return { code, parentheses, color };
    const mapped = FR_LETTER[head];
    if (mapped !== undefined && !(head === 'G' && code.length > 1)) code = mapped + code.slice(1);
  }
  return { code, parentheses, color };
}
