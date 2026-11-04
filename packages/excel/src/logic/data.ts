// Onglet Donnees : tri multi-cles, filtre automatique (valeurs, conditions, 10 premiers, au-dessus de la moyenne),
// suppression des doublons, conversion texte -> colonnes, sous-totaux, zone de donnees courante.
import { FormulaError, translateFormula, type Scalar } from '@forgeoffice/formulas';
import {
  MAX_COLS, type AutoFilter, type Cell, type CellRange, type ColumnFilter, type CustomFilterOperator, type Sheet,
} from '@forgeoffice/xlsx';
import type { Draft } from './draft.ts';
import { parseDelimited } from './clipboard.ts';
import { commitEntry, parseEntry } from './cells.ts';

export type ValueAt = (row: number, col: number) => Scalar;

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: false });

/** Rang de type dans l'ordre croissant d'Excel : nombres, textes, booleens, erreurs, vides (toujours a la fin). */
function typeRank(v: Scalar): number {
  if (typeof v === 'number') return 0;
  if (typeof v === 'string') return v === '' ? 4 : 1;
  if (typeof v === 'boolean') return 2;
  if (v instanceof FormulaError) return 3;
  return 4;
}

/** Comparaison de deux valeurs selon l'ordre croissant d'Excel. */
export function compareValues(a: Scalar, b: Scalar, caseSensitive = false): number {
  const ta = typeRank(a);
  const tb = typeRank(b);
  if (ta !== tb) return ta - tb;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') {
    const c = collator.compare(a, b);
    return c !== 0 || !caseSensitive ? c : a < b ? -1 : a > b ? 1 : 0;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return 0;
}

export interface SortKey {
  /** Colonne absolue (ou ligne absolue si `byColumns`). */
  index: number;
  descending: boolean;
  /** Ordre personnalise (liste de valeurs). */
  customList?: readonly string[];
}

/**
 * Trie les lignes de la plage (en-tete exclu si `header`) selon les cles. Les formules sont translatees
 * avec leur ligne. Les vides restent a la fin quel que soit le sens, comme dans Excel.
 */
export function sortRange(d: Draft, si: number, range: CellRange, keys: readonly SortKey[], header: boolean, valueAt: ValueAt, byColumns = false): void {
  const first = (byColumns ? range.c1 : range.r1) + (header ? 1 : 0);
  const last = byColumns ? range.c2 : range.r2;
  if (last <= first) return;
  const lines: number[] = [];
  for (let i = first; i <= last; i++) lines.push(i);
  const keyVal = (line: number, k: SortKey): Scalar => (byColumns ? valueAt(k.index, line) : valueAt(line, k.index));
  const sorted = [...lines].sort((x, y) => {
    for (const k of keys) {
      const a = keyVal(x, k);
      const b = keyVal(y, k);
      const ea = typeRank(a) === 4;
      const eb = typeRank(b) === 4;
      if (ea || eb) {
        if (ea && eb) continue;
        return ea ? 1 : -1;
      }
      let c: number;
      if (k.customList) {
        const ia = k.customList.findIndex((s) => collator.compare(s, String(a)) === 0);
        const ib = k.customList.findIndex((s) => collator.compare(s, String(b)) === 0);
        c = (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
      } else c = compareValues(a, b);
      if (c !== 0) return k.descending ? -c : c;
    }
    return x - y;
  });
  const sh = d.wb.sheets[si];
  if (!sh) return;
  const snapshot = new Map<number, Map<number, Cell>>();
  for (const line of lines) {
    const m = new Map<number, Cell>();
    if (byColumns) {
      for (let r = range.r1; r <= range.r2; r++) {
        const cell = sh.cells.get(r)?.get(line);
        if (cell) m.set(r, cell);
      }
    } else {
      for (let c = range.c1; c <= range.c2; c++) {
        const cell = sh.cells.get(line)?.get(c);
        if (cell) m.set(c, cell);
      }
    }
    snapshot.set(line, m);
  }
  sorted.forEach((srcLine, idx) => {
    const dstLine = lines[idx] ?? srcLine;
    const data = snapshot.get(srcLine) ?? new Map<number, Cell>();
    const from = byColumns ? range.r1 : range.c1;
    const to = byColumns ? range.r2 : range.c2;
    for (let k = from; k <= to; k++) {
      let cell = data.get(k);
      if (cell?.formula !== undefined && srcLine !== dstLine) {
        cell = { ...cell, formula: byColumns ? translateFormula(cell.formula, 0, dstLine - srcLine) : translateFormula(cell.formula, dstLine - srcLine, 0) };
      }
      if (byColumns) d.set(si, k, dstLine, cell);
      else d.set(si, dstLine, k, cell);
    }
  });
}

/** Zone de donnees courante (Ctrl+A / Ctrl+*) : bloc contigu de cellules non vides autour de (row, col). */
export function currentRegion(sh: Sheet, row: number, col: number): CellRange {
  const filled = (r: number, c: number): boolean => {
    const cell = sh.cells.get(r)?.get(c);
    return !!cell && (cell.value !== null || cell.formula !== undefined);
  };
  let r = { r1: row, c1: col, r2: row, c2: col };
  for (let guard = 0; guard < 1000; guard++) {
    const next = { ...r };
    const rowHas = (rr: number): boolean => {
      for (let c = Math.max(0, r.c1 - 1); c <= r.c2 + 1; c++) if (filled(rr, c)) return true;
      return false;
    };
    const colHas = (cc: number): boolean => {
      for (let rr = Math.max(0, r.r1 - 1); rr <= r.r2 + 1; rr++) if (filled(rr, cc)) return true;
      return false;
    };
    if (r.r1 > 0 && rowHas(r.r1 - 1)) next.r1--;
    if (rowHas(r.r2 + 1)) next.r2++;
    if (r.c1 > 0 && colHas(r.c1 - 1)) next.c1--;
    if (r.c2 < MAX_COLS - 1 && colHas(r.c2 + 1)) next.c2++;
    if (next.r1 === r.r1 && next.r2 === r.r2 && next.c1 === r.c1 && next.c2 === r.c2) break;
    r = next;
  }
  return r;
}

/** Vrai si la premiere ligne ressemble a des en-tetes (texte au-dessus de donnees non textuelles ou distinctes). */
export function guessHeader(range: CellRange, valueAt: ValueAt): boolean {
  if (range.r2 <= range.r1) return false;
  let textTop = 0;
  let numericBelow = 0;
  for (let c = range.c1; c <= range.c2; c++) {
    if (typeof valueAt(range.r1, c) === 'string') textTop++;
    if (typeof valueAt(range.r1 + 1, c) === 'number') numericBelow++;
  }
  return textTop === range.c2 - range.c1 + 1 && (numericBelow > 0 || range.c2 === range.c1 || textTop > 0);
}

// ---------------------------------------------------------------- Filtre automatique

/** Texte d'une valeur tel qu'il apparait dans la liste du filtre. */
export type DisplayAt = (row: number, col: number) => string;

function matchCustom(v: Scalar, text: string, op: CustomFilterOperator, value: string): boolean {
  const num = Number(value.replace(',', '.'));
  const isNum = value.trim() !== '' && Number.isFinite(num);
  if (isNum && typeof v === 'number') {
    switch (op) {
      case 'equal': return v === num;
      case 'notEqual': return v !== num;
      case 'lessThan': return v < num;
      case 'lessThanOrEqual': return v <= num;
      case 'greaterThan': return v > num;
      case 'greaterThanOrEqual': return v >= num;
    }
  }
  // Jokers * et ? (texte), comparaison insensible a la casse.
  const re = new RegExp(`^${value.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
  switch (op) {
    case 'equal': return re.test(text);
    case 'notEqual': return !re.test(text);
    case 'lessThan': return collator.compare(text, value) < 0;
    case 'lessThanOrEqual': return collator.compare(text, value) <= 0;
    case 'greaterThan': return collator.compare(text, value) > 0;
    case 'greaterThanOrEqual': return collator.compare(text, value) >= 0;
  }
}

/** Lignes masquees par le filtre automatique (les autres lignes de la plage sont visibles). */
export function filteredRows(af: AutoFilter, valueAt: ValueAt, displayAt: DisplayAt): Set<number> {
  const hidden = new Set<number>();
  const { ref } = af;
  for (const fc of af.columns) {
    const f = fc.filter;
    if (!f) continue;
    const col = ref.c1 + fc.colId;
    const rows: number[] = [];
    for (let r = ref.r1 + 1; r <= ref.r2; r++) rows.push(r);
    const keep = columnPredicate(f, rows.map((r) => valueAt(r, col)));
    rows.forEach((r) => {
      if (!keep(valueAt(r, col), displayAt(r, col))) hidden.add(r);
    });
  }
  return hidden;
}

function columnPredicate(f: ColumnFilter, all: readonly Scalar[]): (v: Scalar, text: string) => boolean {
  switch (f.kind) {
    case 'values': {
      const set = new Set(f.values.map((s) => s.toLowerCase()));
      return (v, text) => (v === null || text === '' ? !!f.blank : set.has(text.toLowerCase()));
    }
    case 'custom':
      return (v, text) => {
        const results = f.conditions.map((c) => matchCustom(v, text, c.operator, c.value));
        return f.and ? results.every(Boolean) : results.some(Boolean);
      };
    case 'top10': {
      const nums = all.filter((v): v is number => typeof v === 'number').sort((a, b) => (f.top ? b - a : a - b));
      const n = f.percent ? Math.max(1, Math.floor((nums.length * f.value) / 100)) : f.value;
      const threshold = nums[Math.min(nums.length, n) - 1];
      return (v) => typeof v === 'number' && threshold !== undefined && (f.top ? v >= threshold : v <= threshold);
    }
    case 'dynamic': {
      const nums = all.filter((v): v is number => typeof v === 'number');
      const avg = nums.reduce((s, v) => s + v, 0) / (nums.length || 1);
      if (f.type === 'aboveAverage') return (v) => typeof v === 'number' && v > avg;
      if (f.type === 'belowAverage') return (v) => typeof v === 'number' && v < avg;
      return () => true;
    }
    default:
      return () => true;
  }
}

/** Applique le filtre : masque/affiche les lignes de la plage filtree. */
export function applyAutoFilter(d: Draft, si: number, af: AutoFilter | undefined, valueAt: ValueAt, displayAt: DisplayAt): void {
  const sh = d.sheet(si);
  if (!af) return;
  const hidden = filteredRows(af, valueAt, displayAt);
  for (let r = af.ref.r1 + 1; r <= af.ref.r2; r++) {
    const info = sh.rows.get(r);
    const hide = hidden.has(r);
    if (!!info?.hidden === hide) continue;
    const next = { ...info };
    if (hide) next.hidden = true;
    else delete next.hidden;
    sh.rows.set(r, next);
  }
}

/** Valeurs distinctes d'une colonne filtree (liste a cocher), triees dans l'ordre d'Excel. */
export function distinctValues(ref: CellRange, col: number, valueAt: ValueAt, displayAt: DisplayAt): { text: string; value: Scalar }[] {
  const seen = new Map<string, { text: string; value: Scalar }>();
  for (let r = ref.r1 + 1; r <= ref.r2 && seen.size < 10_000; r++) {
    const text = displayAt(r, col);
    const key = text.toLowerCase();
    if (!seen.has(key)) seen.set(key, { text, value: valueAt(r, col) });
  }
  return [...seen.values()].sort((a, b) => compareValues(a.value, b.value));
}

// ---------------------------------------------------------------- Doublons, conversion, sous-totaux

/** Supprime les lignes dont les colonnes `cols` repetent une ligne precedente. Renvoie le nombre supprime. */
export function removeDuplicates(d: Draft, si: number, range: CellRange, cols: readonly number[], header: boolean, valueAt: ValueAt): number {
  const sh = d.wb.sheets[si];
  if (!sh) return 0;
  const start = range.r1 + (header ? 1 : 0);
  const seen = new Set<string>();
  const keep: number[] = [];
  for (let r = start; r <= range.r2; r++) {
    const key = cols.map((c) => {
      const v = valueAt(r, c);
      return typeof v === 'string' ? `s${v.toLowerCase()}` : `${typeof v}${String(v)}`;
    }).join('');
    if (seen.has(key)) continue;
    seen.add(key);
    keep.push(r);
  }
  const removed = range.r2 - start + 1 - keep.length;
  if (removed === 0) return 0;
  const rows = keep.map((r) => {
    const m = new Map<number, Cell>();
    for (let c = range.c1; c <= range.c2; c++) {
      const cell = sh.cells.get(r)?.get(c);
      if (cell) m.set(c, cell);
    }
    return { r, m };
  });
  for (let r = start; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) d.set(si, r, c, undefined);
  rows.forEach(({ r, m }, i) => {
    const dst = start + i;
    for (const [c, cell] of m) d.set(si, dst, c, cell.formula !== undefined && dst !== r ? { ...cell, formula: translateFormula(cell.formula, dst - r, 0) } : cell);
  });
  return removed;
}

/** Convertir (texte en colonnes) : decoupe la premiere colonne de la plage par separateur. */
export function textToColumns(d: Draft, si: number, range: CellRange, sep: string, valueAt: ValueAt): void {
  for (let r = range.r1; r <= range.r2; r++) {
    const v = valueAt(r, range.c1);
    if (typeof v !== 'string') continue;
    const parts = sep === ' ' ? v.split(/ +/) : parseDelimited(v, sep)[0] ?? [v];
    parts.forEach((text, i) => {
      const entry = parseEntry(text.trim(), d.wb.date1904);
      commitEntry(d, si, r, range.c1 + i, entry.ok ? entry : { ok: true, value: text });
    });
  }
}

/** Fonctions de SOUS.TOTAL (numero Excel). */
export const SUBTOTAL_FUNCTIONS = { sum: 9, count: 3, average: 1, max: 4, min: 5, product: 6 } as const;
export type SubtotalFn = keyof typeof SUBTOTAL_FUNCTIONS;

/**
 * Sous-totaux : a chaque changement de valeur de `groupCol`, insere une ligne « Total X » avec SOUS.TOTAL
 * sur les colonnes `sumCols`, puis une ligne « Total general ». Les lignes de detail recoivent le niveau de plan 1.
 * Renvoie la nouvelle plage.
 */
export function subtotals(d: Draft, si: number, range: CellRange, groupCol: number, sumCols: readonly number[], fn: SubtotalFn, valueAt: ValueAt, labels: { total: (v: string) => string; grand: string }): CellRange {
  const sh = d.wb.sheets[si];
  if (!sh) return range;
  const header = range.r1;
  const rows: { cells: Map<number, Cell>; key: string }[] = [];
  for (let r = header + 1; r <= range.r2; r++) {
    const m = new Map<number, Cell>();
    for (let c = range.c1; c <= range.c2; c++) {
      const cell = sh.cells.get(r)?.get(c);
      if (cell) m.set(c, cell);
    }
    rows.push({ cells: m, key: String(valueAt(r, groupCol) ?? '') });
  }
  for (let r = header + 1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) d.set(si, r, c, undefined);
  const code = SUBTOTAL_FUNCTIONS[fn];
  const colName = (c: number): string => {
    let n = c + 1;
    let out = '';
    while (n > 0) {
      out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  };
  let out = header + 1;
  let groupStart = out;
  const totals: number[] = [];
  const sheetRows = d.sheet(si).rows;
  rows.forEach((row, i) => {
    for (const [c, cell] of row.cells) d.set(si, out, c, cell);
    sheetRows.set(out, { ...sheetRows.get(out), outlineLevel: 2 });
    out++;
    const next = rows[i + 1];
    if (!next || next.key !== row.key) {
      d.set(si, out, groupCol, { value: labels.total(row.key) });
      for (const c of sumCols) d.set(si, out, c, { value: null, formula: `SUBTOTAL(${code},${colName(c)}${groupStart + 1}:${colName(c)}${out})` });
      sheetRows.set(out, { ...sheetRows.get(out), outlineLevel: 1 });
      totals.push(out);
      out++;
      groupStart = out;
    }
  });
  d.set(si, out, groupCol, { value: labels.grand });
  for (const c of sumCols) d.set(si, out, c, { value: null, formula: `SUBTOTAL(${code},${colName(c)}${header + 2}:${colName(c)}${out})` });
  return { ...range, r2: out };
}
