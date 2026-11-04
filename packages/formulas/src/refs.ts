// Adresses de cellules : colonnes en lettres, references A1 (lignes/colonnes en base 0 en interne).

export const MAX_ROWS = 1048576;
export const MAX_COLS = 16384;

/** Zone rectangulaire sur une feuille (indices en base 0, bornes incluses). */
export interface Area {
  sheet: number;
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface CellAddress {
  row: number;
  col: number;
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function colToLetters(col: number): string {
  let n = col + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "A" -> 0, "aa" -> 26 ; -1 si invalide ou hors limites. */
export function lettersToCol(letters: string): number {
  if (letters.length === 0 || letters.length > 3) return -1;
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    const ch = letters.charCodeAt(i) & ~32;
    if (ch < 65 || ch > 90) return -1;
    n = n * 26 + (ch - 64);
  }
  return n - 1 < MAX_COLS ? n - 1 : -1;
}

const CELL_RE = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/;

/** Analyse "B12" ou "$B$12" ; undefined si invalide. */
export function parseCellAddress(text: string): CellAddress | undefined {
  const m = text.match(CELL_RE);
  if (!m) return undefined;
  const col = lettersToCol(m[1] ?? '');
  const row = Number(m[2]) - 1;
  if (col < 0 || row < 0 || row >= MAX_ROWS) return undefined;
  return { row, col };
}

export function formatCellAddress(row: number, col: number, absRow = false, absCol = false): string {
  return `${absCol ? '$' : ''}${colToLetters(col)}${absRow ? '$' : ''}${row + 1}`;
}

/** Analyse "A1:C3", "A:A", "1:3" ou une cellule seule (sans nom de feuille). */
export function parseRangeAddress(text: string): Omit<Area, 'sheet'> | undefined {
  const parts = text.split(':');
  if (parts.length === 1) {
    const c = parseCellAddress(text);
    return c ? { r1: c.row, c1: c.col, r2: c.row, c2: c.col } : undefined;
  }
  if (parts.length !== 2) return undefined;
  const a = (parts[0] ?? '').replace(/\$/g, '');
  const b = (parts[1] ?? '').replace(/\$/g, '');
  const ca = parseCellAddress(a);
  const cb = parseCellAddress(b);
  if (ca && cb) {
    return {
      r1: Math.min(ca.row, cb.row),
      c1: Math.min(ca.col, cb.col),
      r2: Math.max(ca.row, cb.row),
      c2: Math.max(ca.col, cb.col),
    };
  }
  if (/^[A-Za-z]{1,3}$/.test(a) && /^[A-Za-z]{1,3}$/.test(b)) {
    const x = lettersToCol(a);
    const y = lettersToCol(b);
    if (x < 0 || y < 0) return undefined;
    return { r1: 0, c1: Math.min(x, y), r2: MAX_ROWS - 1, c2: Math.max(x, y) };
  }
  if (/^\d{1,7}$/.test(a) && /^\d{1,7}$/.test(b)) {
    const x = Number(a) - 1;
    const y = Number(b) - 1;
    if (x < 0 || y < 0 || x >= MAX_ROWS || y >= MAX_ROWS) return undefined;
    return { r1: Math.min(x, y), c1: 0, r2: Math.max(x, y), c2: MAX_COLS - 1 };
  }
  return undefined;
}

export function formatRangeAddress(a: Omit<Area, 'sheet'>): string {
  if (a.r1 === 0 && a.r2 === MAX_ROWS - 1) return `${colToLetters(a.c1)}:${colToLetters(a.c2)}`;
  if (a.c1 === 0 && a.c2 === MAX_COLS - 1) return `${a.r1 + 1}:${a.r2 + 1}`;
  const s = formatCellAddress(a.r1, a.c1);
  return a.r1 === a.r2 && a.c1 === a.c2 ? s : `${s}:${formatCellAddress(a.r2, a.c2)}`;
}

/** Cle numerique d'une cellule dans une feuille. */
export function cellKey(row: number, col: number): number {
  return row * MAX_COLS + col;
}

export function keyRow(key: number): number {
  return Math.floor(key / MAX_COLS);
}

export function keyCol(key: number): number {
  return key % MAX_COLS;
}

export function areaContains(a: Area, sheet: number, row: number, col: number): boolean {
  return a.sheet === sheet && row >= a.r1 && row <= a.r2 && col >= a.c1 && col <= a.c2;
}

export function areasOverlap(a: Area, b: Area): boolean {
  return a.sheet === b.sheet && a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;
}

/** Nom de feuille a entourer d'apostrophes dans une formule ? */
export function sheetNeedsQuotes(name: string): boolean {
  if (!/^[A-Za-z_À-￿][A-Za-z0-9_.À-￿]*$/.test(name)) return true;
  if (/^[A-Za-z]{1,3}\d+$/.test(name)) return true;
  if (/^(R|C|RC|L|LC)(\d+)?$/i.test(name) || /^R\d*C\d*$/i.test(name)) return true;
  const up = name.toUpperCase();
  return up === 'TRUE' || up === 'FALSE' || up === 'VRAI' || up === 'FAUX';
}

export function quoteSheetName(name: string): string {
  return sheetNeedsQuotes(name) ? `'${name.replace(/'/g, "''")}'` : name;
}
