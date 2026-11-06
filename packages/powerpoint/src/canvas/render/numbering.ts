// Libelles de puces et de numerotation, champs : logique pure du texte (sans React), partagee avec l'export PDF.
import type { Paragraph, Run } from '@forgeoffice/pptx';
import type { PageContext } from '../context.ts';

export const DEFAULT_INSETS = { left: 7.2, top: 3.6, right: 7.2, bottom: 3.6 };

const ROMAN: ReadonlyArray<[number, string]> = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

function roman(n: number): string {
  let out = '';
  let rest = n;
  for (const [v, s] of ROMAN) while (rest >= v) {
    out += s;
    rest -= v;
  }
  return out;
}

function alpha(n: number): string {
  let out = '';
  let rest = n;
  while (rest > 0) {
    rest--;
    out = String.fromCharCode(65 + (rest % 26)) + out;
    rest = Math.floor(rest / 26);
  }
  return out;
}

/** Libelle d'un numero automatique (arabicPeriod, alphaLcParenR, romanUcPeriod...). */
export function autoNumberLabel(scheme: string, n: number): string {
  const lower = /Lc/.test(scheme);
  let core = /^roman/.test(scheme) ? roman(n) : /^alpha/.test(scheme) ? alpha(n) : String(n);
  if (lower) core = core.toLowerCase();
  if (/ParenBoth$/.test(scheme)) return `(${core})`;
  if (/ParenR$/.test(scheme)) return `${core})`;
  if (/Period$/.test(scheme)) return `${core}.`;
  if (/Minus$/.test(scheme)) return `- ${core} -`;
  return core;
}

/** Numeros des paragraphes numerotes (une suite par niveau, interrompue par un paragraphe d'un niveau inferieur ou non numerote). */
export function paragraphNumbers(paragraphs: readonly Paragraph[]): Array<number | null> {
  const counters = new Map<number, number>();
  return paragraphs.map((p) => {
    const level = p.props.level ?? 0;
    const bullet = p.props.bullet;
    for (const key of [...counters.keys()]) if (key > level) counters.delete(key);
    if (bullet?.type !== 'auto') {
      counters.delete(level);
      return null;
    }
    const n = (counters.get(level) ?? (bullet.startAt ?? 1) - 1) + 1;
    counters.set(level, n);
    return n;
  });
}


export function formatField(run: Extract<Run, { type: 'field' }>, ctx: PageContext): string {
  if (run.fieldType === 'slidenum') return ctx.fields.slideNumber === undefined ? run.text : String(ctx.fields.slideNumber);
  if (run.fieldType.startsWith('datetime') && ctx.fields.date) {
    const d = ctx.fields.date;
    if (run.fieldType === 'datetime2') return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (run.fieldType === 'datetime10' || run.fieldType === 'datetime11') return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('fr-FR');
  }
  return run.text;
}


export /** Caracteres des polices de symboles (Wingdings, Symbol) vers leur equivalent Unicode le plus proche. */
function symbolChar(ch: string, font: string | undefined): string {
  if (!font || !/wingdings|symbol/i.test(font)) return ch;
  const map: Record<string, string> = { '§': '■', 'Ø': '➢', 'ü': '✓', 'q': '❑', 'v': '❖', 'n': '■', 'l': '●', 'o': '○', 'w': '◆', 'Ÿ': '•', '·': '•', 'ð': '➔', 'à': '➔', 'Ü': '➔' };
  return map[ch] ?? '•';
}

