// Parcours du modele : texte brut, statistiques, sections, numeros de liste.
import type { Block, Inline, NumberFormat, Paragraph, Section, WordDocument } from './model.ts';

export interface PlainTextOptions {
  /** Inclure le texte des notes de bas de page / de fin a la suite (defaut : faux). */
  includeNotes?: boolean;
  /** Inclure le texte supprime en suivi de modifications (defaut : faux). */
  includeDeleted?: boolean;
  /** Separateur de cellules de tableau (defaut : tabulation). */
  cellSeparator?: string;
}

/** Texte d'une suite d'elements en ligne. */
export function inlinesText(inlines: readonly Inline[], options: PlainTextOptions = {}): string {
  let out = '';
  for (const inline of inlines) {
    if ('revision' in inline && inline.revision && (inline.revision.kind === 'delete' || inline.revision.kind === 'moveFrom') && !options.includeDeleted) continue;
    switch (inline.type) {
      case 'text': out += inline.text; break;
      case 'tab': out += '\t'; break;
      case 'break': out += inline.kind === 'line' ? '\n' : inline.kind === 'page' ? '\f' : '\n'; break;
      case 'symbol': out += String.fromCodePoint(symbolCodePoint(inline.char)); break;
      case 'hyperlink': out += inlinesText(inline.inlines, options); break;
      case 'field': out += inlinesText(inline.result, options); break;
      case 'inlineControl': out += inlinesText(inline.inlines, options); break;
      case 'equation': out += inline.text; break;
      case 'shape': if (inline.text) out += blocksText(inline.text, options); break;
      default: break;
    }
  }
  return out;
}

/** Code d'un symbole Word : la plage privee F0xx correspond au caractere xx de la police symbole. */
function symbolCodePoint(hex: string): number {
  const code = Number.parseInt(hex, 16);
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return 0xfffd;
  return code;
}

export function paragraphText(paragraph: Paragraph, options: PlainTextOptions = {}): string {
  return inlinesText(paragraph.inlines, options);
}

/** Texte de blocs, un paragraphe par ligne. */
export function blocksText(blocks: readonly Block[], options: PlainTextOptions = {}): string {
  const lines: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph': lines.push(paragraphText(block, options)); break;
      case 'table':
        for (const row of block.rows) {
          lines.push(row.cells.filter((c) => c.props.vMerge !== 'continue')
            .map((c) => blocksText(c.blocks, options).replace(/\n/g, ' ')).join(options.cellSeparator ?? '\t'));
        }
        break;
      case 'contentControl':
      case 'toc': lines.push(blocksText(block.blocks, options)); break;
      default: break;
    }
  }
  return lines.join('\n');
}

/** Texte brut du document (paragraphes separes par des sauts de ligne). */
export function plainText(doc: WordDocument, options: PlainTextOptions = {}): string {
  let text = blocksText(doc.body, options);
  if (options.includeNotes) {
    const notes = [...doc.footnotes, ...doc.endnotes].filter((n) => !n.special);
    if (notes.length) text += `\n\n${notes.map((n) => blocksText(n.blocks, options)).join('\n')}`;
  }
  return text;
}

export interface DocumentStatistics {
  words: number;
  /** Caracteres espaces compris. */
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  /** Lignes estimees (environ 75 caracteres par ligne de corps de texte). */
  lines: number;
  /** Pages estimees d'apres le nombre de lignes, de sauts de page et de sections. */
  pages: number;
}

/** Mots au sens de Word : suites separees par des blancs (la ponctuation isolee ne compte pas). */
export function countWords(text: string): number {
  let count = 0;
  for (const token of text.split(/[\s  -​　]+/)) {
    if (/[\p{L}\p{N}]/u.test(token)) count++;
  }
  return count;
}

interface Counter {
  paragraphs: number;
  lines: number;
  pageBreaks: number;
}

function countBlocks(blocks: readonly Block[], counter: Counter, charsPerLine: number): void {
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      const text = paragraphText(block);
      if (text.trim()) counter.paragraphs++;
      counter.lines += Math.max(1, Math.ceil(text.length / charsPerLine));
      if (block.props.pageBreakBefore) counter.pageBreaks++;
      for (const inline of block.inlines) if (inline.type === 'break' && inline.kind === 'page') counter.pageBreaks++;
      if (block.sectionBreak && block.sectionBreak.breakType !== 'continuous') counter.pageBreaks++;
    } else if (block.type === 'table') {
      for (const row of block.rows) {
        const before = counter.lines;
        let tallest = 0;
        for (const cell of row.cells) {
          const sub: Counter = { paragraphs: 0, lines: 0, pageBreaks: 0 };
          countBlocks(cell.blocks, sub, Math.max(10, Math.floor(charsPerLine / Math.max(1, row.cells.length))));
          counter.paragraphs += sub.paragraphs;
          tallest = Math.max(tallest, sub.lines);
        }
        counter.lines = before + Math.max(1, tallest);
      }
    } else if (block.type === 'contentControl' || block.type === 'toc') {
      countBlocks(block.blocks, counter, charsPerLine);
    }
  }
}

/** Statistiques (Revision > Statistiques dans Word). Les pages sont une estimation sans mise en page. */
export function statistics(doc: WordDocument): DocumentStatistics {
  const text = plainText(doc);
  const section = doc.finalSection;
  const usableWidth = Math.max(72, section.pageWidth - section.margins.left - section.margins.right);
  const usableHeight = Math.max(72, section.pageHeight - section.margins.top - section.margins.bottom);
  const charsPerLine = Math.max(20, Math.round(usableWidth / 5.5));
  const linesPerPage = Math.max(10, Math.floor(usableHeight / 15.5));
  const counter: Counter = { paragraphs: 0, lines: 0, pageBreaks: 0 };
  countBlocks(doc.body, counter, charsPerLine);
  // Chaque saut force commence une page ; on estime les lignes restantes reparties uniformement.
  const pages = Math.max(1, Math.ceil(counter.lines / linesPerPage), counter.pageBreaks + 1);
  return {
    words: countWords(text),
    characters: text.replace(/[\n\f]/g, '').length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    paragraphs: counter.paragraphs,
    lines: counter.lines,
    pages,
  };
}

/** Decoupe le corps en sections (chaque section avec ses proprietes et ses blocs). */
export function sectionsOf(doc: WordDocument): { section: Section; blocks: Block[] }[] {
  const out: { section: Section; blocks: Block[] }[] = [];
  let current: Block[] = [];
  for (const block of doc.body) {
    current.push(block);
    if (block.type === 'paragraph' && block.sectionBreak) {
      out.push({ section: block.sectionBreak, blocks: current });
      current = [];
    }
  }
  out.push({ section: doc.finalSection, blocks: current });
  return out;
}

const ROMAN: readonly [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(value: number): string {
  if (value <= 0 || value >= 4000) return String(value);
  let n = Math.floor(value);
  let out = '';
  for (const [unit, sym] of ROMAN) {
    while (n >= unit) {
      out += sym;
      n -= unit;
    }
  }
  return out;
}

/** a, b, ... z, aa, bb (convention Word : la lettre est repetee). */
export function toLetters(value: number): string {
  if (value <= 0) return String(value);
  const letter = String.fromCharCode(97 + ((value - 1) % 26));
  return letter.repeat(Math.floor((value - 1) / 26) + 1);
}

const FR_UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];

/** Nombre en toutes lettres (francais, 0..999), pour les formats cardinalText. */
export function toFrenchWords(value: number): string {
  const n = Math.floor(value);
  if (n < 0 || n > 999) return String(value);
  if (n < 20) return FR_UNITS[n] ?? String(n);
  if (n < 100) {
    const tensNames = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
    const t = Math.floor(n / 10);
    const rest = t === 7 || t === 9 ? n - t * 10 + 10 : n % 10;
    const base = tensNames[t] ?? '';
    if (rest === 0) return t === 8 ? 'quatre-vingts' : base;
    const joiner = n % 10 === 1 && t !== 8 && t !== 9 ? ' et ' : '-';
    return `${base}${joiner}${toFrenchWords(rest)}`;
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = h === 1 ? 'cent' : `${FR_UNITS[h] ?? ''} cent${rest === 0 ? 's' : ''}`;
  return rest === 0 ? head : `${head} ${toFrenchWords(rest)}`;
}

/** Valeur d'un numero de liste dans le format donne. */
export function formatNumber(value: number, format: NumberFormat): string {
  switch (format) {
    case 'decimal': return String(value);
    case 'decimalZero': return value < 10 ? `0${value}` : String(value);
    case 'lowerLetter': return toLetters(value);
    case 'upperLetter': return toLetters(value).toUpperCase();
    case 'lowerRoman': return toRoman(value).toLowerCase();
    case 'upperRoman': return toRoman(value);
    case 'ordinal': return value === 1 ? '1er' : `${value}e`;
    case 'cardinalText': return toFrenchWords(value);
    case 'ordinalText': return value === 1 ? 'premier' : `${toFrenchWords(value).replace(/e$/, '')}ième`;
    case 'decimalEnclosedCircle': return value >= 1 && value <= 20 ? String.fromCodePoint(0x245f + value) : String(value);
    case 'bullet':
    case 'none': return '';
  }
}
