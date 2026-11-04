// Geometrie virtualisee de la grille : tailles des lignes et colonnes en pixels (zoom 100 %),
// stockees en segments epars pour couvrir 1 048 576 lignes x 16 384 colonnes sans tableau geant.
import { MAX_COLS, MAX_ROWS, type Sheet } from '@forgeoffice/xlsx';

/** Segment [start, end] (inclus) de taille uniforme `size` ; `extra` = decalage cumule avant `start`. */
interface Segment {
  start: number;
  end: number;
  size: number;
  extra: number;
}

export interface Axis {
  /** Taille par defaut (pixels). */
  def: number;
  count: number;
  segs: readonly Segment[];
}

export const DEFAULT_COL_PX = 64;
export const MAX_DIGIT_PX = 7;

/** Largeur Excel (caracteres, padding compris) -> pixels. */
export function colWidthToPx(width: number): number {
  return Math.max(0, Math.round(width * MAX_DIGIT_PX));
}

export function pxToColWidth(px: number): number {
  return Math.round((px / MAX_DIGIT_PX) * 256) / 256;
}

/** Hauteur de ligne (points) -> pixels a 96 ppp. */
export function rowHeightToPx(points: number): number {
  return Math.max(0, Math.round((points * 4) / 3));
}

export function pxToRowHeight(px: number): number {
  return Math.round(((px * 3) / 4) * 100) / 100;
}

/** Construit un axe a partir de segments non tries (en cas de chevauchement, le premier l'emporte). */
export function makeAxis(def: number, count: number, raw: readonly { start: number; end: number; size: number }[]): Axis {
  const sorted = raw.filter((s) => s.end >= s.start && s.size !== def).slice().sort((a, b) => a.start - b.start);
  const segs: Segment[] = [];
  let extra = 0;
  for (const s of sorted) {
    const prev = segs[segs.length - 1];
    const start = prev && s.start <= prev.end ? prev.end + 1 : s.start;
    if (start > s.end) continue;
    if (prev && prev.end + 1 === start && prev.size === s.size) {
      extra += (s.end - start + 1) * (s.size - def);
      prev.end = s.end;
      continue;
    }
    segs.push({ start, end: s.end, size: s.size, extra });
    extra += (s.end - start + 1) * (s.size - def);
  }
  return { def, count, segs };
}

/** Dernier segment dont le debut est <= i (ou -1). */
function segBefore(axis: Axis, i: number): number {
  let lo = 0;
  let hi = axis.segs.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = axis.segs[mid];
    if (s && s.start <= i) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

export function axisSize(axis: Axis, i: number): number {
  const s = axis.segs[segBefore(axis, i)];
  return s && i <= s.end ? s.size : axis.def;
}

/** Position (pixels) du debut de l'index i. */
export function axisPos(axis: Axis, i: number): number {
  const s = axis.segs[segBefore(axis, i)];
  if (!s) return i * axis.def;
  const inside = Math.min(i, s.end + 1) - s.start;
  return i * axis.def + s.extra + inside * (s.size - axis.def);
}

export function axisTotal(axis: Axis): number {
  return axisPos(axis, axis.count);
}

/** Index dont la bande contient `offset` (bornes : 0..count-1). Les bandes de taille nulle sont sautees. */
export function axisIndexAt(axis: Axis, offset: number): number {
  if (offset <= 0) return firstVisible(axis, 0);
  let lo = 0;
  let hi = axis.segs.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = axis.segs[mid];
    if (s && s.start * axis.def + s.extra <= offset) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  let i: number;
  const s = axis.segs[found];
  if (!s) i = Math.floor(offset / axis.def);
  else {
    const startPos = s.start * axis.def + s.extra;
    const endPos = startPos + (s.end - s.start + 1) * s.size;
    if (offset < endPos && s.size > 0) i = s.start + Math.floor((offset - startPos) / s.size);
    else i = s.end + 1 + Math.floor((offset - endPos) / axis.def);
  }
  return Math.min(axis.count - 1, Math.max(0, i));
}

/** Premier index visible (taille > 0) a partir de i, dans le sens `dir`. */
export function firstVisible(axis: Axis, i: number, dir: 1 | -1 = 1): number {
  let k = i;
  while (k >= 0 && k < axis.count && axisSize(axis, k) === 0) {
    const s = axis.segs[segBefore(axis, k)];
    k = s && dir === 1 ? s.end + 1 : s && dir === -1 ? s.start - 1 : k + dir;
  }
  return Math.min(axis.count - 1, Math.max(0, k));
}

/** Axe des colonnes d'une feuille (largeurs et masquage). */
export function colAxis(sheet: Sheet): Axis {
  const def = sheet.defaultColWidth !== undefined ? colWidthToPx(sheet.defaultColWidth) : DEFAULT_COL_PX;
  const raw = sheet.cols.map((c) => ({ start: c.min, end: Math.min(c.max, MAX_COLS - 1), size: c.hidden ? 0 : c.width !== undefined ? colWidthToPx(c.width) : def }));
  return makeAxis(def, MAX_COLS, raw);
}

/** Axe des lignes d'une feuille (hauteurs et masquage). */
export function rowAxis(sheet: Sheet): Axis {
  const def = rowHeightToPx(sheet.defaultRowHeight || 15);
  const raw: { start: number; end: number; size: number }[] = [];
  for (const [r, info] of sheet.rows) {
    const size = info.hidden ? 0 : info.height !== undefined ? rowHeightToPx(info.height) : def;
    if (size !== def) raw.push({ start: r, end: r, size });
  }
  return makeAxis(def, MAX_ROWS, raw);
}
