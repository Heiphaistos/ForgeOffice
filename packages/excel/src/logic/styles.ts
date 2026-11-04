// Mise en forme des cellules : application d'un correctif de style a une selection, bordures, fusion,
// styles de cellule predefinis (galerie Accueil > Styles de cellules).
import {
  MAX_COLS, MAX_ROWS, numberFormatCode, styleIdFor, type Alignment, type Border, type BorderEdge, type BorderStyle, type Cell,
  type CellFormat, type CellRange, type Fill, type Font, type Protection, type Sheet, type Workbook,
} from '@forgeoffice/xlsx';
import { forEachCell, type Draft } from './draft.ts';

export interface StylePatch {
  font?: Partial<Font>;
  /** null = aucun remplissage. */
  fill?: Fill | null;
  border?: Border;
  numberFormat?: string;
  alignment?: Partial<Alignment>;
  protection?: Protection;
}

export const NO_FILL: Fill = { type: 'pattern', pattern: 'none' };

export function solidFill(rgb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fg: { rgb: `FF${rgb.replace('#', '').toUpperCase()}` } };
}

/** Index de style resultant de l'application d'un correctif a un style existant. */
export function patchStyleId(wb: Workbook, base: number, patch: StylePatch): number {
  return styleIdFor(wb, {
    font: patch.font,
    fill: patch.fill === null ? NO_FILL : patch.fill,
    border: patch.border,
    numberFormat: patch.numberFormat,
    alignment: patch.alignment as Alignment | undefined,
    protection: patch.protection,
  }, base);
}

export function cellFormat(wb: Workbook, styleId: number | undefined): CellFormat {
  return wb.styles.cellXfs[styleId ?? 0] ?? wb.styles.cellXfs[0] ?? { numFmtId: 0, fontId: 0, fillId: 0, borderId: 0 };
}

export function fontOf(wb: Workbook, styleId: number | undefined): Font {
  const f = wb.styles.fonts[cellFormat(wb, styleId).fontId] ?? wb.styles.fonts[0];
  return f ?? { name: 'Aptos Narrow', size: 11 };
}

export function fillOf(wb: Workbook, styleId: number | undefined): Fill | undefined {
  return wb.styles.fills[cellFormat(wb, styleId).fillId];
}

export function borderOf(wb: Workbook, styleId: number | undefined): Border {
  return wb.styles.borders[cellFormat(wb, styleId).borderId] ?? {};
}

export function numFmtOf(wb: Workbook, styleId: number | undefined): string {
  return numberFormatCode(wb.styles, cellFormat(wb, styleId).numFmtId);
}

/** Style effectif d'une cellule vide : style de ligne, sinon de colonne. */
export function inheritedStyle(sh: Sheet, row: number, col: number): number | undefined {
  const r = sh.rows.get(row)?.styleId;
  if (r !== undefined) return r;
  for (const c of sh.cols) if (col >= c.min && col <= c.max) return c.styleId;
  return undefined;
}

/** Style effectif de la cellule (row, col). */
export function styleAt(sh: Sheet, row: number, col: number): number {
  const cell = sh.cells.get(row)?.get(col);
  return cell?.styleId ?? inheritedStyle(sh, row, col) ?? 0;
}

/**
 * Applique `mapStyle` a chaque cellule des plages. Les lignes/colonnes entieres recoivent aussi un style
 * de ligne/colonne (les cellules vides futures en heritent) ; seules les cellules existantes sont visitees.
 */
export function restyle(d: Draft, si: number, ranges: readonly CellRange[], mapStyle: (styleId: number, row: number, col: number) => number): void {
  const cache = new Map<number, number>();
  const positionDependent = mapStyle.length > 1;
  const map = (s: number, row: number, col: number): number => {
    if (positionDependent) return mapStyle(s, row, col);
    const hit = cache.get(s);
    if (hit !== undefined) return hit;
    const v = mapStyle(s, row, col);
    cache.set(s, v);
    return v;
  };
  for (const r of ranges) {
    const sh = d.sheet(si);
    const fullRows = r.c1 === 0 && r.c2 === MAX_COLS - 1;
    const fullCols = r.r1 === 0 && r.r2 === MAX_ROWS - 1;
    if (fullCols && !fullRows) {
      const cols = [...sh.cols];
      for (let c = r.c1; c <= r.c2; c++) {
        const s = map(inheritedColStyle(sh, c), 0, c);
        setColInfo(cols, c, { styleId: s });
      }
      sh.cols = cols;
    } else if (fullRows) {
      for (let row = r.r1; row <= r.r2 && row <= r.r1 + 100_000; row++) {
        const info = sh.rows.get(row);
        if (!info && fullCols) continue;
        sh.rows.set(row, { ...info, styleId: map(info?.styleId ?? 0, row, 0) });
      }
    }
    if (!fullRows && !fullCols) {
      // Cellules vides de la plage : creees pour porter le style (plage bornee comme Excel le fait en pratique).
      const area = (r.r2 - r.r1 + 1) * (r.c2 - r.c1 + 1);
      if (area <= 2_000_000) {
        for (let row = r.r1; row <= r.r2; row++) {
          for (let col = r.c1; col <= r.c2; col++) {
            const cell = d.get(si, row, col);
            const base = cell?.styleId ?? inheritedStyle(sh, row, col) ?? 0;
            const s = map(base, row, col);
            if (cell) {
              if (s !== (cell.styleId ?? 0)) d.set(si, row, col, withStyle(cell, s));
            } else if (s !== 0) d.set(si, row, col, { value: null, styleId: s });
          }
        }
        continue;
      }
    }
    const updates: [number, number, Cell][] = [];
    forEachCell(d.sheet(si), r, (row, col, cell) => updates.push([row, col, cell]));
    for (const [row, col, cell] of updates) d.set(si, row, col, withStyle(cell, map(cell.styleId ?? 0, row, col)));
  }
}

function withStyle(cell: Cell, styleId: number): Cell {
  const out: Cell = { ...cell, styleId };
  if (styleId === 0) delete out.styleId;
  return out;
}

function inheritedColStyle(sh: Sheet, col: number): number {
  for (const c of sh.cols) if (col >= c.min && col <= c.max && c.styleId !== undefined) return c.styleId;
  return 0;
}

/** Modifie les informations d'une colonne en scindant au besoin la plage min..max qui la contient. */
export function setColInfo(cols: Sheet['cols'], col: number, patch: Partial<Sheet['cols'][number]>): void {
  const idx = cols.findIndex((c) => col >= c.min && col <= c.max);
  if (idx < 0) {
    cols.push({ min: col, max: col, ...patch });
    cols.sort((a, b) => a.min - b.min);
    return;
  }
  const c = cols[idx];
  if (!c) return;
  const parts: Sheet['cols'] = [];
  if (c.min < col) parts.push({ ...c, max: col - 1 });
  parts.push({ ...c, min: col, max: col, ...patch });
  if (c.max > col) parts.push({ ...c, min: col + 1 });
  cols.splice(idx, 1, ...parts);
}

/** Applique un correctif de style a toutes les plages. */
export function applyPatch(d: Draft, si: number, ranges: readonly CellRange[], patch: StylePatch): void {
  restyle(d, si, ranges, (s) => patchStyleId(d.wb, s, patch));
}

// ---------------------------------------------------------------- Bordures

export type BorderPreset =
  | 'bottom' | 'top' | 'left' | 'right' | 'none' | 'all' | 'outside' | 'thickOutside' | 'bottomDouble' | 'bottomThick'
  | 'topBottom' | 'topBottomThick' | 'topBottomDouble' | 'inside';

export function applyBorders(d: Draft, si: number, ranges: readonly CellRange[], preset: BorderPreset, rgb = '000000', style: BorderStyle = 'thin'): void {
  const edge = (s: BorderStyle = style): BorderEdge => ({ style: s, color: { rgb: `FF${rgb}` } });
  for (const r of ranges) {
    restyle(d, si, [r], (s, row, col) => {
      const cur = d.wb.styles.borders[cellFormat(d.wb, s).borderId] ?? {};
      const top = row === r.r1;
      const bottom = row === r.r2;
      const left = col === r.c1;
      const right = col === r.c2;
      const b: Border = { ...cur };
      switch (preset) {
        case 'none': return patchStyleIdRaw(d.wb, s, {});
        case 'all': Object.assign(b, { top: edge(), bottom: edge(), left: edge(), right: edge() }); break;
        case 'inside':
          if (!top) b.top = edge();
          if (!bottom) b.bottom = edge();
          if (!left) b.left = edge();
          if (!right) b.right = edge();
          break;
        case 'outside':
        case 'thickOutside': {
          const st = preset === 'thickOutside' ? 'medium' : style;
          if (top) b.top = edge(st);
          if (bottom) b.bottom = edge(st);
          if (left) b.left = edge(st);
          if (right) b.right = edge(st);
          break;
        }
        case 'bottom': if (bottom) b.bottom = edge(); break;
        case 'top': if (top) b.top = edge(); break;
        case 'left': if (left) b.left = edge(); break;
        case 'right': if (right) b.right = edge(); break;
        case 'bottomDouble': if (bottom) b.bottom = edge('double'); break;
        case 'bottomThick': if (bottom) b.bottom = edge('medium'); break;
        case 'topBottom': if (top) b.top = edge(); if (bottom) b.bottom = edge(); break;
        case 'topBottomThick': if (top) b.top = edge(); if (bottom) b.bottom = edge('medium'); break;
        case 'topBottomDouble': if (top) b.top = edge(); if (bottom) b.bottom = edge('double'); break;
      }
      return patchStyleIdRaw(d.wb, s, b);
    });
  }
}

/** Remplace la bordure (et non fusion) : styleIdFor fusionnerait sinon avec la bordure du parent. */
function patchStyleIdRaw(wb: Workbook, base: number, border: Border): number {
  return styleIdFor(wb, { border }, base);
}

// ---------------------------------------------------------------- Fusion

export type MergeMode = 'center' | 'across' | 'merge' | 'unmerge';

/** Fusionne (en gardant la valeur en haut a gauche) ou annule les fusions touchees. Renvoie vrai si des donnees sont perdues. */
export function mergeCells(d: Draft, si: number, ranges: readonly CellRange[], mode: MergeMode): boolean {
  const sh = d.sheet(si);
  let lost = false;
  for (const r of ranges) {
    sh.merges = sh.merges.filter((m) => m.r1 > r.r2 || m.r2 < r.r1 || m.c1 > r.c2 || m.c2 < r.c1);
    if (mode === 'unmerge') continue;
    const targets = mode === 'across' ? rowsOf(r) : [r];
    for (const t of targets) {
      if (t.r1 === t.r2 && t.c1 === t.c2) continue;
      forEachCell(sh, t, (row, col, cell) => {
        if ((row !== t.r1 || col !== t.c1) && (cell.value !== null || cell.formula !== undefined)) {
          lost = true;
          d.set(si, row, col, cell.styleId ? { value: null, styleId: cell.styleId } : undefined);
        }
      });
      d.sheet(si).merges = [...d.sheet(si).merges, t];
    }
    if (mode === 'center') applyPatch(d, si, [r], { alignment: { horizontal: 'center' } });
  }
  return lost;
}

function rowsOf(r: CellRange): CellRange[] {
  const out: CellRange[] = [];
  for (let row = r.r1; row <= r.r2; row++) out.push({ r1: row, c1: r.c1, r2: row, c2: r.c2 });
  return out;
}

/** La fusion qui contient (row, col), s'il y en a une. */
export function mergeAt(merges: readonly CellRange[], row: number, col: number): CellRange | undefined {
  return merges.find((m) => row >= m.r1 && row <= m.r2 && col >= m.c1 && col <= m.c2);
}

// ---------------------------------------------------------------- Styles de cellule (galerie)

export interface CellStylePreset {
  id: string;
  group: 'good' | 'data' | 'titles' | 'themed' | 'number';
  patch: StylePatch;
}

const T = (theme: number, tint?: number): { theme: number; tint?: number } => (tint === undefined ? { theme } : { theme, tint });

/** Styles predefinis d'Excel (Satisfaisant, Calcul, Titre 1, Accent1...) appliques en mise en forme directe. */
export const CELL_STYLE_PRESETS: readonly CellStylePreset[] = [
  { id: 'normal', group: 'good', patch: { font: { bold: false, italic: false, color: T(1), size: 11 }, fill: null, border: {}, numberFormat: 'General' } },
  { id: 'bad', group: 'good', patch: { font: { color: { rgb: 'FF9C0006' } }, fill: solidFill('FFC7CE') } },
  { id: 'good', group: 'good', patch: { font: { color: { rgb: 'FF006100' } }, fill: solidFill('C6EFCE') } },
  { id: 'neutral', group: 'good', patch: { font: { color: { rgb: 'FF9C5700' } }, fill: solidFill('FFEB9C') } },
  { id: 'calculation', group: 'data', patch: { font: { bold: true, color: { rgb: 'FFFA7D00' } }, fill: solidFill('F2F2F2'), border: box('7F7F7F') } },
  { id: 'check', group: 'data', patch: { font: { bold: true, color: { rgb: 'FFFFFFFF' } }, fill: solidFill('A5A5A5'), border: box('3F3F3F', 'double') } },
  { id: 'explanatory', group: 'data', patch: { font: { italic: true, color: { rgb: 'FF7F7F7F' } } } },
  { id: 'input', group: 'data', patch: { font: { color: { rgb: 'FF3F3F76' } }, fill: solidFill('FFCC99'), border: box('7F7F7F') } },
  { id: 'linked', group: 'data', patch: { font: { color: { rgb: 'FFFA7D00' } }, border: { bottom: { style: 'double', color: { rgb: 'FFFF8001' } } } } },
  { id: 'note', group: 'data', patch: { fill: solidFill('FFFFCC'), border: box('B2B2B2') } },
  { id: 'output', group: 'data', patch: { font: { bold: true, color: { rgb: 'FF3F3F3F' } }, fill: solidFill('F2F2F2'), border: box('3F3F3F') } },
  { id: 'warning', group: 'data', patch: { font: { color: { rgb: 'FFFF0000' } } } },
  { id: 'heading1', group: 'titles', patch: { font: { bold: true, size: 15, color: T(3) }, border: { bottom: { style: 'thick', color: T(4) } } } },
  { id: 'heading2', group: 'titles', patch: { font: { bold: true, size: 13, color: T(3) }, border: { bottom: { style: 'thick', color: T(4, 0.5) } } } },
  { id: 'heading3', group: 'titles', patch: { font: { bold: true, size: 11, color: T(3) }, border: { bottom: { style: 'medium', color: T(4, 0.4) } } } },
  { id: 'heading4', group: 'titles', patch: { font: { bold: true, size: 11, color: T(3) } } },
  { id: 'title', group: 'titles', patch: { font: { size: 18, color: T(3), scheme: 'major' } } },
  { id: 'total', group: 'titles', patch: { font: { bold: true }, border: { top: { style: 'thin', color: T(4) }, bottom: { style: 'double', color: T(4) } } } },
  ...[4, 5, 6, 7, 8, 9].flatMap((theme, i): CellStylePreset[] => [
    { id: `accent${i + 1}-20`, group: 'themed', patch: { font: { color: T(1) }, fill: { type: 'pattern', pattern: 'solid', fg: T(theme, 0.7999816888943144) } } },
    { id: `accent${i + 1}-40`, group: 'themed', patch: { font: { color: T(1) }, fill: { type: 'pattern', pattern: 'solid', fg: T(theme, 0.5999938962981048) } } },
    { id: `accent${i + 1}-60`, group: 'themed', patch: { font: { color: T(0) }, fill: { type: 'pattern', pattern: 'solid', fg: T(theme, 0.3999755851924192) } } },
    { id: `accent${i + 1}`, group: 'themed', patch: { font: { color: T(0) }, fill: { type: 'pattern', pattern: 'solid', fg: T(theme) } } },
  ]),
  { id: 'comma', group: 'number', patch: { numberFormat: '_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-;_-@_-' } },
  { id: 'comma0', group: 'number', patch: { numberFormat: '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-' } },
  { id: 'currency', group: 'number', patch: { numberFormat: '_-* #,##0.00 [$€-40C]_-;-* #,##0.00 [$€-40C]_-;_-* "-"?? [$€-40C]_-;_-@_-' } },
  { id: 'currency0', group: 'number', patch: { numberFormat: '_-* #,##0 [$€-40C]_-;-* #,##0 [$€-40C]_-;_-* "-" [$€-40C]_-;_-@_-' } },
  { id: 'percent', group: 'number', patch: { numberFormat: '0%' } },
];

function box(rgb: string, style: BorderStyle = 'thin'): Border {
  const e: BorderEdge = { style, color: { rgb: `FF${rgb}` } };
  return { top: e, bottom: e, left: e, right: e };
}
