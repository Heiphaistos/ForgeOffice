// Fenetre d'affichage de la grille : volets figes, defilement, zoom ; conversion cellule <-> pixels ecran.
import type { CellRange } from '@forgeoffice/xlsx';
import { axisIndexAt, axisPos, axisSize, type Axis } from './geometry.ts';

export interface Viewport {
  rows: Axis;
  cols: Axis;
  zoom: number;
  /** Taille de la zone de dessin (pixels CSS), en-tetes compris. */
  width: number;
  height: number;
  headerW: number;
  headerH: number;
  frozenRows: number;
  frozenCols: number;
  /** Defilement (pixels a 100 %) de la zone mobile, depuis la premiere ligne/colonne non figee. */
  scrollX: number;
  scrollY: number;
}

export interface Band {
  index: number;
  /** Position ecran (pixels CSS) et taille. */
  pos: number;
  size: number;
}

/** Largeur de l'en-tete de lignes selon le nombre de chiffres de la derniere ligne visible. */
export function rowHeaderWidth(lastRow: number, zoom: number): number {
  const digits = String(lastRow + 1).length;
  return Math.round(Math.max(26, digits * 7 + 12) * zoom);
}

function bands(axis: Axis, frozen: number, scroll: number, start: number, extent: number, zoom: number): { frozen: Band[]; moving: Band[]; frozenSize: number } {
  const z = zoom;
  const frozenBands: Band[] = [];
  for (let i = 0; i < frozen; i++) {
    const size = axisSize(axis, i) * z;
    frozenBands.push({ index: i, pos: start + axisPos(axis, i) * z, size });
  }
  const frozenSize = axisPos(axis, frozen) * z;
  const base = axisPos(axis, frozen);
  const moving: Band[] = [];
  let i = axisIndexAt(axis, base + scroll);
  if (i < frozen) i = frozen;
  const origin = start + frozenSize;
  while (i < axis.count) {
    const pos = origin + (axisPos(axis, i) - base - scroll) * z;
    if (pos >= extent) break;
    const size = axisSize(axis, i) * z;
    if (size > 0) moving.push({ index: i, pos, size });
    i++;
    if (moving.length > 2000) break;
  }
  return { frozen: frozenBands.filter((b) => b.size > 0), moving, frozenSize };
}

export interface Layout {
  rows: Band[];
  cols: Band[];
  frozenRowBands: Band[];
  frozenColBands: Band[];
  /** Debut ecran de la zone mobile. */
  bodyX: number;
  bodyY: number;
}

export function layout(v: Viewport): Layout {
  const r = bands(v.rows, v.frozenRows, v.scrollY, v.headerH, v.height, v.zoom);
  const c = bands(v.cols, v.frozenCols, v.scrollX, v.headerW, v.width, v.zoom);
  return {
    rows: [...r.frozen, ...r.moving],
    cols: [...c.frozen, ...c.moving],
    frozenRowBands: r.frozen,
    frozenColBands: c.frozen,
    bodyX: v.headerW + c.frozenSize,
    bodyY: v.headerH + r.frozenSize,
  };
}

/** Position ecran d'une ligne (meme hors de la fenetre). */
export function rowY(v: Viewport, row: number): number {
  if (row < v.frozenRows) return v.headerH + axisPos(v.rows, row) * v.zoom;
  return v.headerH + axisPos(v.rows, v.frozenRows) * v.zoom + (axisPos(v.rows, row) - axisPos(v.rows, v.frozenRows) - v.scrollY) * v.zoom;
}

export function colX(v: Viewport, col: number): number {
  if (col < v.frozenCols) return v.headerW + axisPos(v.cols, col) * v.zoom;
  return v.headerW + axisPos(v.cols, v.frozenCols) * v.zoom + (axisPos(v.cols, col) - axisPos(v.cols, v.frozenCols) - v.scrollX) * v.zoom;
}

/** Rectangle ecran d'une plage (coupe aux volets si elle est en partie sous les volets figes). */
export function rangeRect(v: Viewport, r: CellRange): { x: number; y: number; w: number; h: number } {
  const x = colX(v, r.c1);
  const y = rowY(v, r.r1);
  const x2 = colX(v, r.c2) + axisSize(v.cols, r.c2) * v.zoom;
  const y2 = rowY(v, r.r2) + axisSize(v.rows, r.r2) * v.zoom;
  return { x, y, w: x2 - x, h: y2 - y };
}

/** Ligne sous une ordonnee ecran (-1 = en-tete de colonnes). */
export function rowAt(v: Viewport, y: number): number {
  if (y < v.headerH) return -1;
  const frozenH = axisPos(v.rows, v.frozenRows) * v.zoom;
  if (y < v.headerH + frozenH) return axisIndexAt(v.rows, (y - v.headerH) / v.zoom);
  return axisIndexAt(v.rows, axisPos(v.rows, v.frozenRows) + v.scrollY + (y - v.headerH - frozenH) / v.zoom);
}

export function colAt(v: Viewport, x: number): number {
  if (x < v.headerW) return -1;
  const frozenW = axisPos(v.cols, v.frozenCols) * v.zoom;
  if (x < v.headerW + frozenW) return axisIndexAt(v.cols, (x - v.headerW) / v.zoom);
  return axisIndexAt(v.cols, axisPos(v.cols, v.frozenCols) + v.scrollX + (x - v.headerW - frozenW) / v.zoom);
}

/** Defilement minimal pour rendre la cellule visible (null si deja visible). */
export function scrollToShow(v: Viewport, row: number, col: number): { scrollX: number; scrollY: number } | null {
  let { scrollX, scrollY } = v;
  if (row >= v.frozenRows) {
    const top = axisPos(v.rows, row) - axisPos(v.rows, v.frozenRows);
    const bottom = top + axisSize(v.rows, row);
    const visibleH = (v.height - v.headerH) / v.zoom - axisPos(v.rows, v.frozenRows) - 18;
    if (top < scrollY) scrollY = top;
    else if (bottom > scrollY + visibleH) scrollY = Math.max(0, bottom - visibleH);
  }
  if (col >= v.frozenCols) {
    const left = axisPos(v.cols, col) - axisPos(v.cols, v.frozenCols);
    const right = left + axisSize(v.cols, col);
    const visibleW = (v.width - v.headerW) / v.zoom - axisPos(v.cols, v.frozenCols) - 18;
    if (left < scrollX) scrollX = left;
    else if (right > scrollX + visibleW) scrollX = Math.max(0, Math.min(left, right - visibleW));
  }
  return scrollX === v.scrollX && scrollY === v.scrollY ? null : { scrollX, scrollY };
}
