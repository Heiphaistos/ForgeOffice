// Structure : insertion/suppression de lignes et colonnes (formules de tout le classeur reecrites),
// tailles et masquage, feuilles (ajout, renommage, suppression, deplacement, copie).
import { removeSheetInFormula, renameSheetInFormula, shiftFormula, type StructuralShift } from '@forgeoffice/formulas';
import {
  MAX_COLS, MAX_ROWS, createSheet, uniqueSheetName, type Cell, type CellRange, type Sheet, type Workbook,
} from '@forgeoffice/xlsx';
import type { Draft } from './draft.ts';
import { setColInfo } from './styles.ts';

/** Reecrit une formule sans jamais lever (une formule illisible est conservee telle quelle). */
export function safeRewrite(formula: string, fn: (f: string) => string): string {
  try {
    return fn(formula);
  } catch {
    return formula; // formule non analysable : on ne la touche pas (elle reste signalee par le moteur)
  }
}

/** Applique `fn` a toutes les formules du classeur (cellules et noms definis). */
export function rewriteFormulas(d: Draft, fn: (formula: string, sheetName: string | undefined) => string): void {
  d.wb.sheets.forEach((sh, si) => {
    const updates: [number, number, Cell][] = [];
    for (const [row, line] of sh.cells) {
      for (const [col, cell] of line) {
        if (cell.formula === undefined) continue;
        const next = safeRewrite(cell.formula, (f) => fn(f, sh.name));
        if (next !== cell.formula) updates.push([row, col, { ...cell, formula: next }]);
      }
    }
    for (const [row, col, cell] of updates) d.set(si, row, col, cell);
  });
  const names = d.wb.definedNames.map((n) => {
    const scope = n.localSheet === undefined ? undefined : d.wb.sheets[n.localSheet]?.name;
    const formula = safeRewrite(n.formula, (f) => fn(f, scope));
    return formula === n.formula ? n : { ...n, formula };
  });
  if (names.some((n, i) => n !== d.wb.definedNames[i])) d.wb.definedNames = names;
}

/** Nouvelles bornes [a, b] d'un intervalle apres insertion/suppression ; undefined s'il est detruit. */
export function shiftSpan(a: number, b: number, at: number, count: number, max: number): [number, number] | undefined {
  if (count > 0) {
    const na = a >= at ? a + count : a;
    if (na >= max) return undefined;
    return [na, Math.min(b >= at ? b + count : b, max - 1)];
  }
  const n = -count;
  const last = at + n - 1;
  const na = a < at ? a : a > last ? a - n : at;
  const nb = b < at ? b : b > last ? b - n : at - 1;
  return nb < na ? undefined : [na, nb];
}

function shiftRange(r: CellRange, axis: 'row' | 'col', at: number, count: number): CellRange | undefined {
  if (axis === 'row') {
    const s = shiftSpan(r.r1, r.r2, at, count, MAX_ROWS);
    return s ? { ...r, r1: s[0], r2: s[1] } : undefined;
  }
  const s = shiftSpan(r.c1, r.c2, at, count, MAX_COLS);
  return s ? { ...r, c1: s[0], c2: s[1] } : undefined;
}

function shiftIndex(i: number, at: number, count: number): number | undefined {
  if (count > 0) return i >= at ? i + count : i;
  const n = -count;
  if (i < at) return i;
  if (i < at + n) return undefined;
  return i - n;
}

/** Insere (count > 0) ou supprime (count < 0) des lignes ou colonnes a partir de `at`. */
export function shiftStructure(d: Draft, si: number, axis: 'row' | 'col', at: number, count: number): void {
  const sh = d.sheet(si);
  const shift: StructuralShift = { sheet: sh.name, axis, at, count };
  // Cellules
  const cells = new Map<number, Map<number, Cell>>();
  for (const [row, line] of sh.cells) {
    if (axis === 'row') {
      const nr = shiftIndex(row, at, count);
      if (nr !== undefined && nr < MAX_ROWS) cells.set(nr, new Map(line));
    } else {
      const next = new Map<number, Cell>();
      for (const [col, cell] of line) {
        const nc = shiftIndex(col, at, count);
        if (nc !== undefined && nc < MAX_COLS) next.set(nc, cell);
      }
      if (next.size) cells.set(row, next);
    }
  }
  d.replaceCells(si, cells);
  // Lignes / colonnes
  if (axis === 'row') {
    const rows = new Map<number, Sheet['rows'] extends Map<number, infer R> ? R : never>();
    for (const [r, info] of sh.rows) {
      const nr = shiftIndex(r, at, count);
      if (nr !== undefined && nr < MAX_ROWS) rows.set(nr, info);
    }
    sh.rows = rows;
  } else {
    sh.cols = sh.cols.flatMap((c) => {
      const s = shiftSpan(c.min, c.max, at, count, MAX_COLS);
      return s ? [{ ...c, min: s[0], max: s[1] }] : [];
    });
  }
  const mapRanges = (list: readonly CellRange[]): CellRange[] => list.flatMap((r) => {
    const n = shiftRange(r, axis, at, count);
    return n ? [n] : [];
  });
  sh.merges = mapRanges(sh.merges);
  sh.conditionalFormats = sh.conditionalFormats.flatMap((cf) => {
    const ranges = mapRanges(cf.ranges);
    return ranges.length ? [{ ...cf, ranges }] : [];
  });
  sh.dataValidations = sh.dataValidations.flatMap((v) => {
    const ranges = mapRanges(v.ranges);
    return ranges.length ? [{ ...v, ranges }] : [];
  });
  sh.hyperlinks = sh.hyperlinks.flatMap((h) => {
    const ref = shiftRange(h.ref, axis, at, count);
    return ref ? [{ ...h, ref }] : [];
  });
  const mapAddr = <T extends { ref: { row: number; col: number } }>(x: T): T[] => {
    const i = shiftIndex(axis === 'row' ? x.ref.row : x.ref.col, at, count);
    if (i === undefined) return [];
    return [{ ...x, ref: axis === 'row' ? { row: i, col: x.ref.col } : { row: x.ref.row, col: i } }];
  };
  sh.notes = sh.notes.flatMap(mapAddr);
  sh.threadedComments = sh.threadedComments.flatMap(mapAddr);
  sh.tables = sh.tables.flatMap((t) => {
    const ref = shiftRange(t.ref, axis, at, count);
    return ref ? [{ ...t, ref }] : [];
  });
  if (sh.autoFilter) {
    const ref = shiftRange(sh.autoFilter.ref, axis, at, count);
    if (ref) sh.autoFilter = { ...sh.autoFilter, ref };
    else delete sh.autoFilter;
  }
  sh.drawings = sh.drawings.map((dr) => {
    if (dr.anchor.type !== 'twoCell') return dr;
    const key = axis === 'row' ? 'row' : 'col';
    const from = { ...dr.anchor.from, [key]: shiftIndex(dr.anchor.from[key], at, count) ?? at };
    const to = { ...dr.anchor.to, [key]: Math.max(from[key], shiftIndex(dr.anchor.to[key], at, count) ?? at) };
    return { ...dr, anchor: { ...dr.anchor, from, to } };
  });
  if (sh.view.frozen) {
    const f = sh.view.frozen;
    const n = axis === 'row' ? f.rows : f.cols;
    const s = n > 0 ? shiftSpan(0, n - 1, at, count, axis === 'row' ? MAX_ROWS : MAX_COLS) : undefined;
    const v = s ? s[1] + 1 : 0;
    sh.view = { ...sh.view, frozen: axis === 'row' ? { ...f, rows: n > 0 ? v : 0 } : { ...f, cols: n > 0 ? v : 0 } };
  }
  rewriteFormulas(d, (f, sheetName) => shiftFormula(f, shift, sheetName));
}

// ---------------------------------------------------------------- Tailles et masquage

export function setColumnWidths(d: Draft, si: number, c1: number, c2: number, width: number | undefined, hidden?: boolean): void {
  const sh = d.sheet(si);
  const cols = [...sh.cols];
  if (c2 - c1 > 2000) {
    // Plage enorme (colonnes entieres) : une seule entree.
    const kept = cols.filter((c) => c.max < c1 || c.min > c2);
    kept.push({ min: c1, max: c2, ...(width !== undefined ? { width } : {}), ...(hidden ? { hidden } : {}) });
    sh.cols = kept.sort((a, b) => a.min - b.min);
    return;
  }
  for (let c = c1; c <= c2; c++) {
    const patch: Partial<Sheet['cols'][number]> = {};
    if (width !== undefined) patch.width = width;
    if (hidden !== undefined) patch.hidden = hidden;
    setColInfo(cols, c, patch);
  }
  sh.cols = cols;
}

export function setRowHeights(d: Draft, si: number, r1: number, r2: number, height: number | undefined, hidden?: boolean): void {
  const sh = d.sheet(si);
  const last = Math.min(r2, r1 + 200_000);
  for (let r = r1; r <= last; r++) {
    const info = { ...sh.rows.get(r) };
    if (height !== undefined) info.height = height;
    if (hidden !== undefined) {
      if (hidden) info.hidden = true;
      else delete info.hidden;
    }
    sh.rows.set(r, info);
  }
}

// ---------------------------------------------------------------- Feuilles

export function addSheetAt(d: Draft, index: number, name?: string): number {
  const sheet = createSheet(uniqueSheetName(d.wb, name ?? nextSheetName(d.wb)));
  d.wb.sheets.splice(index, 0, sheet);
  shiftLocalNames(d, index, 1);
  return index;
}

export function nextSheetName(wb: Workbook): string {
  let i = wb.sheets.length + 1;
  const taken = new Set(wb.sheets.map((s) => s.name.toLowerCase()));
  while (taken.has(`feuil${i}`)) i++;
  return `Feuil${i}`;
}

export function renameSheet(d: Draft, si: number, name: string): void {
  const old = d.wb.sheets[si]?.name;
  if (old === undefined || old === name) return;
  d.sheet(si).name = name;
  rewriteFormulas(d, (f) => renameSheetInFormula(f, old, name));
}

export function deleteSheet(d: Draft, si: number): void {
  const name = d.wb.sheets[si]?.name;
  if (name === undefined || d.wb.sheets.length <= 1) return;
  const order = d.wb.sheets.map((s) => s.name);
  d.wb.sheets.splice(si, 1);
  d.wb.definedNames = d.wb.definedNames.filter((n) => n.localSheet !== si);
  shiftLocalNames(d, si, -1);
  rewriteFormulas(d, (f) => removeSheetInFormula(f, name, order));
  d.wb.activeSheet = Math.min(d.wb.activeSheet, d.wb.sheets.length - 1);
}

export function moveSheet(d: Draft, from: number, to: number): void {
  const [s] = d.wb.sheets.splice(from, 1);
  if (!s) return;
  d.wb.sheets.splice(to, 0, s);
  d.wb.definedNames = d.wb.definedNames.map((n) => {
    if (n.localSheet === undefined) return n;
    let i = n.localSheet;
    if (i === from) i = to;
    else if (from < to && i > from && i <= to) i--;
    else if (from > to && i >= to && i < from) i++;
    return i === n.localSheet ? n : { ...n, localSheet: i };
  });
  d.wb.activeSheet = to;
}

export function duplicateSheet(d: Draft, si: number): number {
  const src = d.wb.sheets[si];
  if (!src) return si;
  const copy: Sheet = {
    ...src,
    name: uniqueSheetName(d.wb, src.name),
    cells: new Map([...src.cells].map(([r, l]) => [r, new Map(l)])),
    rows: new Map(src.rows),
    tables: [],
    view: { ...src.view, tabSelected: false },
  };
  d.wb.sheets.splice(si + 1, 0, copy);
  shiftLocalNames(d, si + 1, 1);
  return si + 1;
}

function shiftLocalNames(d: Draft, at: number, delta: number): void {
  d.wb.definedNames = d.wb.definedNames.map((n) => (n.localSheet !== undefined && n.localSheet >= at ? { ...n, localSheet: n.localSheet + delta } : n));
}
