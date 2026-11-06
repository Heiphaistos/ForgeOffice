// Hauteur de ligne automatique apres un changement de mise en forme (sans DOM : la mesure du texte est injectee).
// Excel ajuste seul les lignes sans hauteur imposee quand le texte est renvoye a la ligne, tourne ou agrandi.
import type { CellRange } from '@forgeoffice/xlsx';
import type { Scalar } from '@forgeoffice/formulas';
import type { Draft } from './draft.ts';
import { colWidthToPx, pxToRowHeight, rowHeightToPx } from './geometry.ts';
import { cellLook, type CellLook } from './look.ts';
import { toScalar } from './engine.ts';

export type Measure = (text: string, font: string) => number;

/** Nombre de lignes d'un texte renvoye a la ligne dans `width` pixels (memes regles que le dessin de la grille). */
export function wrapCount(text: string, width: number, measure: Measure, font: string): number {
  let count = 0;
  for (const para of text.split('\n')) {
    let line = '';
    count++;
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (measure(next, font) > width && line.trim() !== '') {
        count++;
        line = word.trimStart();
      } else line = next;
    }
  }
  return count;
}

/** Hauteur (pixels) dont une cellule a besoin dans une colonne de `colPx` pixels. */
export function neededPx(look: CellLook, colPx: number, measure: Measure): number {
  const lineH = look.fontPx * 1.31; // 14,4 pt pour une police de 11 pt (ligne par defaut), comme Excel
  const extra = 0;
  if (!look.text) return lineH + extra;
  if (look.rotation === 255) return [...look.text].length * lineH + extra;
  if (look.rotation) {
    const rad = ((look.rotation <= 90 ? look.rotation : look.rotation - 90) * Math.PI) / 180;
    return measure(look.text, look.font) * Math.sin(rad) + lineH * Math.cos(rad) + extra;
  }
  const lines = look.wrap ? wrapCount(look.text, Math.max(4, colPx - 6 - look.indent * 9), measure, look.font) : 1;
  return lines * lineH + extra;
}

const MAX_ROWS_FIT = 2000;

/** Agrandit les lignes des plages dont la hauteur n'est pas imposee et que leur contenu depasse ; renvoie le nombre de lignes changees. */
export function fitRows(d: Draft, si: number, ranges: readonly CellRange[], measure: Measure, valueOf: (row: number, col: number) => Scalar): number {
  const sh = d.wb.sheets[si];
  if (!sh) return 0;
  const def = rowHeightToPx(sh.defaultRowHeight || 15);
  const colPx = (col: number): number => {
    const c = sh.cols.find((k) => col >= k.min && col <= k.max);
    return c?.width !== undefined ? colWidthToPx(c.width) : sh.defaultColWidth !== undefined ? colWidthToPx(sh.defaultColWidth) : 64;
  };
  let changed = 0;
  for (const r of ranges) {
    for (let row = r.r1; row <= Math.min(r.r2, r.r1 + MAX_ROWS_FIT); row++) {
      const info = sh.rows.get(row);
      if (info?.height !== undefined || info?.hidden) continue;
      let need = 0;
      for (const [col, cell] of sh.cells.get(row) ?? []) {
        if (sh.merges.some((m) => row >= m.r1 && row <= m.r2 && col >= m.c1 && col <= m.c2)) continue;
        const value = cell.formula !== undefined ? valueOf(row, col) : toScalar(cell.value);
        need = Math.max(need, neededPx(cellLook(d.wb, cell, value, { colPx: colPx(col), styleId: cell.styleId ?? 0 }), colPx(col), measure));
      }
      if (need > def + 1) {
        d.sheet(si).rows.set(row, { ...info, height: pxToRowHeight(Math.ceil(need)) });
        changed++;
      }
    }
  }
  return changed;
}
