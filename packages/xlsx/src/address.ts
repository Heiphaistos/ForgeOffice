// Adresses A1 : conversions colonne <-> lettres, cellules, plages et listes de plages (sqref).
import { MAX_COLS, MAX_ROWS, type CellAddress, type CellRange } from './model.ts';

/** 0 -> « A », 25 -> « Z », 26 -> « AA ». */
export function columnName(col: number): string {
  let n = col + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** « A » -> 0, « XFD » -> 16383 ; -1 si invalide. */
export function columnIndex(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    const code = letters.charCodeAt(i) & ~32;
    if (code < 65 || code > 90) return -1;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

/** Adresse A1 sans « $ » : (0,0) -> « A1 ». */
export function cellName(row: number, col: number): string {
  return `${columnName(col)}${row + 1}`;
}

/** Adresse absolue « $A$1 ». */
export function absoluteCellName(row: number, col: number): string {
  return `$${columnName(col)}$${row + 1}`;
}

/** Analyse « B12 » ou « $B$12 » (sans feuille). undefined si invalide ou hors limites. */
export function parseCell(ref: string): CellAddress | undefined {
  let i = 0;
  const len = ref.length;
  if (ref.charCodeAt(i) === 36) i++;
  let col = 0;
  const colStart = i;
  while (i < len) {
    const code = ref.charCodeAt(i) & ~32;
    if (code < 65 || code > 90) break;
    col = col * 26 + (code - 64);
    i++;
  }
  if (i === colStart || i - colStart > 3) return undefined;
  if (ref.charCodeAt(i) === 36) i++;
  let row = 0;
  const rowStart = i;
  while (i < len) {
    const code = ref.charCodeAt(i);
    if (code < 48 || code > 57) return undefined;
    row = row * 10 + (code - 48);
    i++;
  }
  if (i === rowStart || row < 1 || row > MAX_ROWS || col > MAX_COLS) return undefined;
  return { row: row - 1, col: col - 1 };
}

/** Analyse « A1:C3 », « A1 », « A:C » (colonnes entieres), « 2:5 » (lignes entieres). Feuille eventuelle ignoree. */
export function parseRange(ref: string): CellRange | undefined {
  const bang = ref.lastIndexOf('!');
  const local = (bang >= 0 ? ref.slice(bang + 1) : ref).replace(/\$/g, '');
  const parts = local.split(':');
  if (parts.length > 2) return undefined;
  const first = parts[0] ?? '';
  const last = parts[1] ?? first;
  if (/^[A-Za-z]{1,3}$/.test(first) && /^[A-Za-z]{1,3}$/.test(last)) {
    const c1 = columnIndex(first);
    const c2 = columnIndex(last);
    if (c1 < 0 || c2 < 0 || c1 >= MAX_COLS || c2 >= MAX_COLS) return undefined;
    return normalizeRange({ r1: 0, c1, r2: MAX_ROWS - 1, c2 });
  }
  if (/^\d+$/.test(first) && /^\d+$/.test(last)) {
    const r1 = Number(first) - 1;
    const r2 = Number(last) - 1;
    if (r1 < 0 || r2 < 0 || r1 >= MAX_ROWS || r2 >= MAX_ROWS) return undefined;
    return normalizeRange({ r1, c1: 0, r2, c2: MAX_COLS - 1 });
  }
  const a = parseCell(first);
  const b = parseCell(last);
  if (!a || !b) return undefined;
  return normalizeRange({ r1: a.row, c1: a.col, r2: b.row, c2: b.col });
}

export function normalizeRange(range: CellRange): CellRange {
  return {
    r1: Math.min(range.r1, range.r2),
    c1: Math.min(range.c1, range.c2),
    r2: Math.max(range.r1, range.r2),
    c2: Math.max(range.c1, range.c2),
  };
}

/** « A1:C3 » ; une seule cellule donne « A1 » ; colonnes / lignes entieres donnent « A:C » / « 2:5 ». */
export function rangeName(range: CellRange, absolute = false): string {
  const d = absolute ? '$' : '';
  if (range.r1 === 0 && range.r2 === MAX_ROWS - 1) return `${d}${columnName(range.c1)}:${d}${columnName(range.c2)}`;
  if (range.c1 === 0 && range.c2 === MAX_COLS - 1) return `${d}${range.r1 + 1}:${d}${range.r2 + 1}`;
  const start = `${d}${columnName(range.c1)}${d}${range.r1 + 1}`;
  if (range.r1 === range.r2 && range.c1 === range.c2) return start;
  return `${start}:${d}${columnName(range.c2)}${d}${range.r2 + 1}`;
}

/** Liste de plages separees par des espaces (« A1:B2 D4 ») ; les morceaux invalides sont ignores. */
export function parseSqref(sqref: string): CellRange[] {
  const out: CellRange[] = [];
  for (const part of sqref.trim().split(/\s+/)) {
    if (!part) continue;
    const range = parseRange(part);
    if (range) out.push(range);
  }
  return out;
}

export function sqrefName(ranges: readonly CellRange[]): string {
  return ranges.map((r) => rangeName(r)).join(' ');
}

export function rangeContains(range: CellRange, row: number, col: number): boolean {
  return row >= range.r1 && row <= range.r2 && col >= range.c1 && col <= range.c2;
}

export function rangesIntersect(a: CellRange, b: CellRange): boolean {
  return a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;
}

/** Nom de feuille cite si necessaire dans une formule : « 'Ventes 2024'!A1 ». */
export function quoteSheetName(name: string): string {
  if (/^[A-Za-z_À-￿][A-Za-z0-9_.À-￿]*$/.test(name) && !/^[A-Za-z]{1,3}\d+$/.test(name) && !/^R\d*C\d*$/i.test(name)) {
    return name;
  }
  return `'${name.replace(/'/g, "''")}'`;
}

/** Reference complete « Feuil1!$A$1:$B$2 ». */
export function sheetRangeRef(sheetName: string, range: CellRange, absolute = true): string {
  return `${quoteSheetName(sheetName)}!${rangeName(range, absolute)}`;
}

/** Separe « 'Ma feuille'!A1:B2 » en nom de feuille et reference locale. */
export function splitSheetRef(ref: string): { sheet?: string; local: string } {
  const bang = ref.lastIndexOf('!');
  if (bang < 0) return { local: ref };
  let sheet = ref.slice(0, bang);
  if (sheet.startsWith("'") && sheet.endsWith("'")) sheet = sheet.slice(1, -1).replace(/''/g, "'");
  return { sheet, local: ref.slice(bang + 1) };
}
