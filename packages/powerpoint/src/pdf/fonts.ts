// Polices du PDF vectoriel : polices standard du PDF (aucune police incorporee : @cantoo/fontkit n'est pas installe).
// Une police du document est rattachee a la famille standard la plus proche (sans serif, serif, chasse fixe) ;
// la largeur de l'ecran (mesure injectee) est restituee par une mise a l'echelle horizontale du texte.
import { PDFDocument, StandardFonts, type PDFFont } from '@cantoo/pdf-lib';

export type Family = 'sans' | 'serif' | 'mono' | 'symbol';

export interface FontStyle {
  family: Family;
  bold: boolean;
  italic: boolean;
}

const SERIF = /times|georgia|cambria|garamond|palatino|book antiqua|bookman|century|baskerville|didot|serif(?!.*sans)|minion|constantia|liberation serif|noto serif/i;
const MONO = /courier|consolas|mono|lucida console|menlo|monaco|fixed|source code/i;

/** Famille standard d'une police du document. */
export function familyOf(name: string | undefined): Family {
  if (!name) return 'sans';
  if (MONO.test(name)) return 'mono';
  if (SERIF.test(name) && !/sans/i.test(name)) return 'serif';
  return 'sans';
}

const NAMES: Readonly<Record<Exclude<Family, 'symbol'>, readonly [string, string, string, string]>> = {
  sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
  serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
  mono: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
};

/** Caracteres courants hors WinAnsi, remplaces par un equivalent lisible. */
const SUBSTITUTES: Readonly<Record<string, string>> = {
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '‌': '', '‍': '', '﻿': '', '\t': ' ',
  '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '✓': 'v', '✔': 'v', '✗': 'x', '✘': 'x', '▪': '•', '■': '•', '●': '•', '◦': 'o', '○': 'o', '▶': '>', '►': '>', '➢': '>', '➔': '->',
  '−': '-', '‑': '-', '‒': '-', '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~', '…': '…', ' ': ' ',
};

export class FontBook {
  private readonly fonts = new Map<string, PDFFont>();
  private readonly sets = new Map<string, Set<number>>();
  /** Vrai des qu'un caractere n'a pu etre code (remplace par « ? »). */
  lossy = false;

  readonly pdf: PDFDocument;

  private constructor(pdf: PDFDocument) {
    this.pdf = pdf;
  }

  static async create(pdf: PDFDocument): Promise<FontBook> {
    const book = new FontBook(pdf);
    for (const family of ['sans', 'serif', 'mono'] as const) {
      for (let i = 0; i < 4; i++) await book.load(`${family}${i}`, NAMES[family][i] as string);
    }
    await book.load('symbol', StandardFonts.Symbol);
    return book;
  }

  private async load(key: string, name: string): Promise<void> {
    const font = await this.pdf.embedFont(name);
    this.fonts.set(key, font);
    this.sets.set(key, new Set(font.getCharacterSet()));
  }

  private key(style: FontStyle): string {
    if (style.family === 'symbol') return 'symbol';
    return `${style.family}${(style.bold ? 1 : 0) + (style.italic ? 2 : 0)}`;
  }

  font(style: FontStyle): PDFFont {
    return this.fonts.get(this.key(style)) as PDFFont;
  }

  has(style: FontStyle, ch: string): boolean {
    return this.sets.get(this.key(style))?.has(ch.codePointAt(0) ?? 0) ?? false;
  }

  /** Decoupe un texte en morceaux codables : police du style, police Symbol (grec, operateurs) ou « ? ». */
  split(text: string, style: FontStyle): Array<{ text: string; style: FontStyle }> {
    const out: Array<{ text: string; style: FontStyle }> = [];
    const push = (t: string, s: FontStyle): void => {
      if (!t) return;
      const last = out[out.length - 1];
      if (last && last.style.family === s.family) last.text += t;
      else out.push({ text: t, style: s });
    };
    const symbol: FontStyle = { family: 'symbol', bold: false, italic: false };
    for (const ch of text) {
      if (ch >= ' ' && this.has(style, ch)) {
        push(ch, style);
        continue;
      }
      const sub = SUBSTITUTES[ch];
      if (sub !== undefined) {
        push(sub, style);
        continue;
      }
      if (ch > '\u007F' && this.has(symbol, ch)) {
        push(ch, symbol);
        continue;
      }
      if (ch < ' ') continue;
      this.lossy = true;
      push('?', style);
    }
    return out;
  }

  /** Largeur en points d'un texte deja decoupe (une police par morceau). */
  width(text: string, style: FontStyle, size: number): number {
    return this.split(text, style).reduce((sum, part) => sum + this.font(part.style).widthOfTextAtSize(part.text, size), 0);
  }
}
