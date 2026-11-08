// Deplacer ou copier une plage en glissant sa bordure (geste Excel) : detection de la bordure et calcul de la destination.
import { MAX_COLS, MAX_ROWS, type CellRange } from '@forgeoffice/xlsx';
import { captureRange, pasteClip } from './clipboard.ts';
import type { Draft } from './draft.ts';

interface Rect { x: number; y: number; w: number; h: number }

/** Vrai si le point est sur la bordure (a `tol` pixels pres) du rectangle, hors coin bas-droit (poignee de recopie). */
export function onRectBorder(rect: Rect, x: number, y: number, tol = 3): boolean {
  const inOuter = x >= rect.x - tol && x <= rect.x + rect.w + tol && y >= rect.y - tol && y <= rect.y + rect.h + tol;
  const inInner = x > rect.x + tol && x < rect.x + rect.w - tol && y > rect.y + tol && y < rect.y + rect.h - tol;
  if (!inOuter || inInner) return false;
  return !(Math.abs(x - (rect.x + rect.w)) <= 6 && Math.abs(y - (rect.y + rect.h)) <= 6);
}

/** Destination d'une plage deplacee de (dr, dc) lignes/colonnes, bornee a la feuille. */
export function movedRange(src: CellRange, dr: number, dc: number): CellRange {
  const r = Math.max(-src.r1, Math.min(MAX_ROWS - 1 - src.r2, dr));
  const c = Math.max(-src.c1, Math.min(MAX_COLS - 1 - src.c2, dc));
  return { r1: src.r1 + r, c1: src.c1 + c, r2: src.r2 + r, c2: src.c2 + c };
}

/** Deplace (copy = false : couper-coller) ou copie la plage vers `to` ; renvoie la zone d'arrivee. */
export function moveRangeCells(d: Draft, si: number, src: CellRange, to: CellRange, copy: boolean): CellRange {
  return pasteClip(d, si, captureRange(d.wb, si, src, !copy), to);
}
