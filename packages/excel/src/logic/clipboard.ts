// Presse-papiers compatible Excel : texte tabule (TSV) et tableau HTML en sortie ; TSV, CSV et HTML
// en entree ; collage interne avec formules translatees et collage special (valeurs, formats, transposer, operations).
import { translateFormula } from '@forgeoffice/formulas';
import type { Cell, CellRange, CellValue, Workbook } from '@forgeoffice/xlsx';
import type { Draft } from './draft.ts';
import { commitEntry, parseEntry } from './cells.ts';
import { fillOf, fontOf } from './styles.ts';

/** Copie interne (conserve formules et styles). */
export interface ClipData {
  sheet: number;
  range: CellRange;
  /** cells[r][c] relatives a range.r1/c1. */
  cells: (Cell | undefined)[][];
  cut: boolean;
}

export function captureRange(wb: Workbook, si: number, range: CellRange, cut = false): ClipData {
  const sh = wb.sheets[si];
  const cells: (Cell | undefined)[][] = [];
  for (let r = range.r1; r <= range.r2; r++) {
    const line: (Cell | undefined)[] = [];
    for (let c = range.c1; c <= range.c2; c++) line.push(sh?.cells.get(r)?.get(c));
    cells.push(line);
  }
  return { sheet: si, range, cells, cut };
}

function quoteTsv(text: string): string {
  return /[\t\n\r"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Texte tabule (lignes CRLF comme Excel) a partir des textes affiches. */
export function toTsv(rows: readonly (readonly string[])[]): string {
  return `${rows.map((r) => r.map(quoteTsv).join('\t')).join('\r\n')}\r\n`;
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Tableau HTML (format lu par Excel, Word, les navigateurs) avec gras, italique, couleurs. */
export function toHtml(rows: readonly (readonly string[])[], styleOf?: (r: number, c: number) => string): string {
  const body = rows
    .map((line, r) => `<tr>${line.map((text, c) => {
      const css = styleOf ? styleOf(r, c) : '';
      return `<td${css ? ` style="${escapeHtml(css)}"` : ''}>${escapeHtml(text)}</td>`;
    }).join('')}</tr>`)
    .join('');
  return `<html><head><meta charset="utf-8"></head><body><table border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${body}</table></body></html>`;
}

/** Style CSS minimal d'une cellule pour le HTML copie. */
export function cssOfCell(wb: Workbook, cell: Cell | undefined): string {
  if (!cell?.styleId) return '';
  const f = fontOf(wb, cell.styleId);
  const parts: string[] = [];
  if (f.bold) parts.push('font-weight:700');
  if (f.italic) parts.push('font-style:italic');
  if (f.underline) parts.push('text-decoration:underline');
  if (f.color?.rgb) parts.push(`color:#${f.color.rgb.slice(-6)}`);
  const fill = fillOf(wb, cell.styleId);
  if (fill?.type === 'pattern' && fill.pattern === 'solid' && fill.fg?.rgb) parts.push(`background:#${fill.fg.rgb.slice(-6)}`);
  return parts.join(';');
}

/** Decoupe un texte delimite (guillemets doubles, retours a la ligne dans les champs). */
export function parseDelimited(text: string, sep = '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] ?? '';
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (/^#x/i.test(e)) return String.fromCodePoint(Number.parseInt(e.slice(2), 16) || 32);
    if (e.startsWith('#')) return String.fromCodePoint(Number(e.slice(1)) || 32);
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Lit le premier tableau d'un fragment HTML (Excel, navigateur, Word) sans DOM. Taille bornee. */
export function parseHtmlTable(html: string): string[][] | null {
  const start = html.search(/<table[\s>]/i);
  if (start < 0) return null;
  const src = html.slice(start, start + 20_000_000);
  const rows: string[][] = [];
  for (const rm of src.matchAll(/<tr[^>]*>([\s\S]*?)(?=<tr[\s>]|<\/table>|$)/gi)) {
    const cells: string[] = [];
    for (const cm of (rm[1] ?? '').matchAll(/<t[dh]([^>]*)>([\s\S]*?)(?=<t[dh][\s>]|<\/tr>|$)/gi)) {
      const attrs = cm[1] ?? '';
      const raw = (cm[2] ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
      cells.push(decodeEntities(raw).replace(/ /g, ' ').trim());
      const span = attrs.match(/colspan\s*=\s*"?(\d+)/i);
      for (let k = 1; k < Math.min(1000, Number(span?.[1] ?? 1)); k++) cells.push('');
    }
    rows.push(cells);
  }
  return rows.length ? rows : null;
}

export type PasteWhat = 'all' | 'values' | 'formulas' | 'formats' | 'noBorders' | 'valuesAndFormats';
export type PasteOp = 'none' | 'add' | 'subtract' | 'multiply' | 'divide';

export interface PasteOptions {
  what?: PasteWhat;
  op?: PasteOp;
  skipBlanks?: boolean;
  transpose?: boolean;
  /** Valeur calculee d'une cellule source (pour « Valeurs ») : indices relatifs. */
  computed?: (r: number, c: number) => CellValue;
}

/** Zone cible d'un collage : la taille de la source, repetee si la selection en est un multiple. */
export function pasteTarget(clip: { rows: number; cols: number }, sel: CellRange): CellRange {
  const h = sel.r2 - sel.r1 + 1;
  const w = sel.c2 - sel.c1 + 1;
  const rows = h > clip.rows && h % clip.rows === 0 ? h : clip.rows;
  const cols = w > clip.cols && w % clip.cols === 0 ? w : clip.cols;
  return { r1: sel.r1, c1: sel.c1, r2: sel.r1 + rows - 1, c2: sel.c1 + cols - 1 };
}

function applyOp(target: CellValue, source: CellValue, op: PasteOp): CellValue {
  if (op === 'none' || typeof source !== 'number') return source;
  const t = typeof target === 'number' ? target : target === null ? 0 : null;
  if (t === null) return source;
  switch (op) {
    case 'add': return t + source;
    case 'subtract': return t - source;
    case 'multiply': return t * source;
    case 'divide': return source === 0 ? { error: '#DIV/0!' } : t / source;
  }
}

/** Collage interne (Ctrl+V ou Collage special). Renvoie la zone collee. */
export function pasteClip(d: Draft, si: number, clip: ClipData, sel: CellRange, opt: PasteOptions = {}): CellRange {
  const srcRows = clip.cells.length;
  const srcCols = clip.cells[0]?.length ?? 0;
  const dims = opt.transpose ? { rows: srcCols, cols: srcRows } : { rows: srcRows, cols: srcCols };
  const target = pasteTarget(dims, sel);
  const what = opt.what ?? 'all';
  const inTarget = (r: number, c: number): boolean => r >= target.r1 && r <= target.r2 && c >= target.c1 && c <= target.c2;
  for (let r = target.r1; r <= target.r2; r++) {
    for (let c = target.c1; c <= target.c2; c++) {
      const dr = (r - target.r1) % dims.rows;
      const dc = (c - target.c1) % dims.cols;
      const [sr, sc] = opt.transpose ? [dc, dr] : [dr, dc];
      const src = clip.cells[sr]?.[sc];
      if (opt.skipBlanks && (!src || (src.value === null && src.formula === undefined))) continue;
      const existing = d.get(si, r, c);
      let next: Cell | undefined;
      if (what === 'formats') {
        next = existing || src?.styleId ? { ...(existing ?? { value: null }), styleId: src?.styleId ?? 0 } : undefined;
      } else {
        const base: Cell = { value: null };
        if (src?.formula !== undefined && (what === 'all' || what === 'formulas' || what === 'noBorders')) {
          base.formula = clip.cut ? src.formula : translateFormula(src.formula, r - clip.range.r1 - sr, c - clip.range.c1 - sc);
        } else {
          const v = src?.formula !== undefined ? (opt.computed?.(sr, sc) ?? src.value) : (src?.value ?? null);
          base.value = applyOp(existing?.value ?? null, v, opt.op ?? 'none');
        }
        const style = what === 'values' || what === 'formulas' ? existing?.styleId : src?.styleId;
        if (style) base.styleId = style;
        next = base.value === null && base.formula === undefined && !base.styleId ? undefined : base;
      }
      d.set(si, r, c, next);
    }
  }
  if (clip.cut) {
    // Couper-coller : la source est videe (hors de la zone d'arrivee sur la meme feuille).
    for (let r = clip.range.r1; r <= clip.range.r2; r++) {
      for (let c = clip.range.c1; c <= clip.range.c2; c++) {
        if (clip.sheet === si && inTarget(r, c)) continue;
        d.set(clip.sheet, r, c, undefined);
      }
    }
  }
  return target;
}

/** Collage de texte externe (TSV/CSV/HTML) : chaque champ est interprete comme une saisie (nombres francais, dates...). */
export function pasteText(d: Draft, si: number, rows: readonly (readonly string[])[], at: { row: number; col: number }): CellRange {
  let maxCols = 0;
  rows.forEach((line, r) => {
    maxCols = Math.max(maxCols, line.length);
    line.forEach((text, c) => {
      const entry = parseEntry(text, d.wb.date1904);
      commitEntry(d, si, at.row + r, at.col + c, entry.ok ? entry : { ok: true, value: text });
    });
  });
  return { r1: at.row, c1: at.col, r2: at.row + Math.max(0, rows.length - 1), c2: at.col + Math.max(0, maxCols - 1) };
}
