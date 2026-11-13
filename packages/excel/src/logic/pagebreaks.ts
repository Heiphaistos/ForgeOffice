// Pagination de l'impression (sans DOM, testee) : zones d'impression multiples, lignes/colonnes a repeter, ajustement
// largeur x hauteur, echelle, sauts de page manuels, ordre des pages, pages de commentaires, lignes de l'apercu des sauts.
import { usedRange, type CellRange, type Sheet } from '@forgeoffice/xlsx';
import { axisSize, colAxis, rowAxis, type Axis } from './geometry.ts';
import { fitOf, pageDims } from './pagesetup.ts';

export interface PrintPage {
  /** Lignes imprimees (titres a repeter en tete). */
  rows: number[];
  cols: number[];
  /** Indice de la zone d'impression d'ou vient la page. */
  area: number;
  /** Numero imprime (premier numero de page compris) et nombre total de pages. */
  number: number;
  total: number;
  /** Page de fin de feuille qui liste les commentaires (Commentaires : A la fin de la feuille). */
  comments?: { cell: string; author: string; text: string }[];
}

export interface Pagination {
  pages: PrintPage[];
  /** Echelle appliquee (1 = 100 %). */
  scale: number;
  areas: CellRange[];
}

/** Zones imprimees : selection, sinon zones d'impression definies, sinon plage utilisee. */
export function printRanges(sheet: Sheet, selection?: CellRange): CellRange[] {
  if (selection) return [selection];
  const areas = sheet.pageSetup.printArea;
  if (areas?.length) return [...areas];
  const used = usedRange(sheet);
  return used ? [used] : [];
}

/** Premiere zone imprimee (compatibilite). */
export const printRange = (sheet: Sheet, selection?: CellRange): CellRange | null => printRanges(sheet, selection)[0] ?? null;

const MAX_LIST = 20000;
function visible(from: number, to: number, axis: Axis): number[] {
  const out: number[] = [];
  for (let i = from; i <= to && out.length < MAX_LIST; i++) if (axisSize(axis, i) > 0) out.push(i);
  return out;
}

/** Decoupe une liste de lignes (ou colonnes) en pages ; les titres a repeter sont places en tete des pages qui les suivent. */
export function chunkAxis(list: number[], size: (i: number) => number, avail: number, breaks: ReadonlySet<number>, titles: number[], scale: number): number[][] {
  const tLast = titles.length ? (titles[titles.length - 1] as number) : -1;
  const tSize = titles.reduce((a, i) => a + size(i) * scale, 0);
  const out: number[][] = [];
  let cur: number[] = [];
  let used = 0;
  const reserve = (i: number): number => (titles.length && i > tLast ? tSize : 0);
  for (const i of list) {
    const s = size(i) * scale;
    if (cur.length === 0) used = reserve(i);
    else if (used + s > avail || breaks.has(i - 1)) {
      out.push(cur);
      cur = [];
      used = reserve(i);
    }
    cur.push(i);
    used += s;
  }
  if (cur.length) out.push(cur);
  return out.map((ch) => (titles.length && (ch[0] as number) > tLast ? [...titles, ...ch] : ch));
}

interface AreaLists { rows: number[]; cols: number[]; w: number; h: number }

function commentItems(sheet: Sheet): { cell: string; author: string; text: string }[] {
  const out: { cell: string; author: string; text: string }[] = [];
  const name = (r: number, c: number): string => {
    let n = '';
    for (let k = c + 1; k > 0; k = Math.floor((k - 1) / 26)) n = String.fromCharCode(65 + ((k - 1) % 26)) + n;
    return `${n}${r + 1}`;
  };
  for (const n of sheet.notes) out.push({ cell: name(n.ref.row, n.ref.col), author: n.author, text: n.text });
  for (const t of sheet.threadedComments) out.push({ cell: name(t.ref.row, t.ref.col), author: t.personId, text: t.text });
  return out.sort((a, b) => a.cell.localeCompare(b.cell, 'fr', { numeric: true }));
}

/** Decoupe la feuille en pages. `ranges` = zones a imprimer (une zone commence toujours une nouvelle page). */
export function paginate(sheet: Sheet, ranges: CellRange | readonly CellRange[]): Pagination {
  const areas = 'r1' in ranges ? [ranges] : [...ranges];
  const ps = sheet.pageSetup;
  const { w, h } = pageDims(ps);
  const m = ps.margins;
  const availW = Math.max(48, w - (m.left + m.right) * 96);
  const availH = Math.max(48, h - (m.top + m.bottom) * 96);
  const rows = rowAxis(sheet, true);
  const cols = colAxis(sheet, true);
  const rowSize = (i: number): number => axisSize(rows, i);
  const colSize = (i: number): number => axisSize(cols, i);
  const titleRows = ps.printTitleRows ? visible(ps.printTitleRows.first, ps.printTitleRows.last, rows) : [];
  const titleCols = ps.printTitleCols ? visible(ps.printTitleCols.first, ps.printTitleCols.last, cols) : [];
  const lists: AreaLists[] = areas.map((a) => {
    const r = visible(a.r1, a.r2, rows);
    const c = visible(a.c1, a.c2, cols);
    return { rows: r, cols: c, h: r.reduce((s, i) => s + rowSize(i), 0), w: c.reduce((s, i) => s + colSize(i), 0) };
  });
  // Excel ignore les sauts manuels quand « Ajuster a » est actif.
  const noBreaks: ReadonlySet<number> = new Set();
  const rowBreaks: ReadonlySet<number> = ps.fitToPage ? noBreaks : new Set(ps.rowBreaks);
  const colBreaks: ReadonlySet<number> = ps.fitToPage ? noBreaks : new Set(ps.colBreaks);
  const chunks = (l: AreaLists, scale: number): { r: number[][]; c: number[][] } => ({
    r: chunkAxis(l.rows, rowSize, availH, rowBreaks, titleRows, scale),
    c: chunkAxis(l.cols, colSize, availW, colBreaks, titleCols, scale),
  });
  let scale = Math.min(4, Math.max(0.1, (ps.scale ?? 100) / 100));
  if (ps.fitToPage) {
    const fit = fitOf(ps);
    let s = 1;
    for (const l of lists) {
      if (fit.w > 0) s = Math.min(s, (availW * fit.w) / Math.max(1, l.w));
      if (fit.h > 0) s = Math.min(s, (availH * fit.h) / Math.max(1, l.h));
    }
    s = Math.max(0.1, Math.floor(s * 100) / 100);
    const tooMany = (k: number): boolean => lists.some((l) => {
      const c = chunks(l, k);
      return (fit.w > 0 && c.c.length > fit.w) || (fit.h > 0 && c.r.length > fit.h);
    });
    while (s > 0.1 && tooMany(s)) s = Math.max(0.1, Math.round((s - 0.01) * 100) / 100);
    scale = s;
  }
  const first = ps.firstPageNumber ?? 1;
  const pages: PrintPage[] = [];
  lists.forEach((l, area) => {
    const c = chunks(l, scale);
    const push = (r: number[], k: number[]): void => void pages.push({ rows: r, cols: k, area, number: 0, total: 0 });
    if (ps.pageOrder === 'overThenDown') for (const r of c.r) for (const k of c.c) push(r, k);
    else for (const k of c.c) for (const r of c.r) push(r, k);
  });
  if (ps.cellComments === 'atEnd' && pages.length) {
    const items = commentItems(sheet);
    const perPage = Math.max(1, Math.floor(availH / (22 * scale)) - 2);
    for (let i = 0; i < items.length; i += perPage) pages.push({ rows: [], cols: [], area: -1, number: 0, total: 0, comments: items.slice(i, i + perPage) });
  }
  pages.forEach((p, i) => {
    p.number = first + i;
    p.total = pages.length;
  });
  return { pages, scale, areas };
}

export interface BreakInfo {
  /** Premiere ligne / colonne de chaque page apres la premiere (ligne du trait). */
  rows: number[];
  cols: number[];
  /** Traits issus de sauts manuels (traits pleins). */
  manualRows: number[];
  manualCols: number[];
  areas: CellRange[];
  /** Traits automatiques propres a chaque zone (meme ordre que `areas`). */
  perArea: { rows: number[]; cols: number[] }[];
  /** Position du filigrane « Page n ». */
  labels: { row: number; col: number; n: number; area: number }[];
}

/** Traits de l'apercu des sauts de page : automatiques et manuels, zones imprimees, numeros de page. */
export function pageBreakInfo(sheet: Sheet): BreakInfo | null {
  const areas = printRanges(sheet);
  if (!areas.length) return null;
  const { pages } = paginate(sheet, areas);
  const rows = new Set<number>();
  const cols = new Set<number>();
  const perArea = areas.map(() => ({ rows: new Set<number>(), cols: new Set<number>() }));
  const labels: BreakInfo['labels'] = [];
  for (const p of pages) {
    if (p.comments) continue;
    const lastR = p.rows[p.rows.length - 1];
    const lastC = p.cols[p.cols.length - 1];
    if (lastR !== undefined) {
      rows.add(lastR + 1);
      perArea[p.area]?.rows.add(lastR + 1);
    }
    if (lastC !== undefined) {
      cols.add(lastC + 1);
      perArea[p.area]?.cols.add(lastC + 1);
    }
    const [r0, c0] = [p.rows[0], p.cols[0]];
    if (r0 !== undefined && c0 !== undefined) labels.push({ row: r0, col: c0, n: p.number, area: p.area });
  }
  const fit = !!sheet.pageSetup.fitToPage;
  return {
    rows: [...rows],
    cols: [...cols],
    manualRows: fit ? [] : sheet.pageSetup.rowBreaks.map((r) => r + 1),
    manualCols: fit ? [] : sheet.pageSetup.colBreaks.map((c) => c + 1),
    areas,
    perArea: perArea.map((a) => ({ rows: [...a.rows], cols: [...a.cols] })),
    labels,
  };
}

/** Sauts manuels apres insertion / suppression / reinitialisation autour de la cellule active. */
export function editBreaks(ps: Pick<Sheet['pageSetup'], 'rowBreaks' | 'colBreaks'>, op: 'insert' | 'remove' | 'reset', active: { row: number; col: number }): Pick<Sheet['pageSetup'], 'rowBreaks' | 'colBreaks'> {
  if (op === 'reset') return { rowBreaks: [], colBreaks: [] };
  const sorted = (list: number[]): number[] => [...new Set(list)].sort((a, b) => a - b);
  if (op === 'insert') {
    return {
      rowBreaks: active.row > 0 ? sorted([...ps.rowBreaks, active.row - 1]) : ps.rowBreaks,
      colBreaks: active.col > 0 ? sorted([...ps.colBreaks, active.col - 1]) : ps.colBreaks,
    };
  }
  return { rowBreaks: ps.rowBreaks.filter((r) => r !== active.row - 1), colBreaks: ps.colBreaks.filter((k) => k !== active.col - 1) };
}
