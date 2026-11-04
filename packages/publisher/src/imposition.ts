// Imposition (sans DOM) : plusieurs cartes ou etiquettes par feuille, livret plie, traits de coupe.
import type { Rect, Size } from './guides.ts';

export interface CardGrid {
  cols: number;
  rows: number;
  /** Emplacement de chaque copie sur la feuille (ligne par ligne). */
  cells: Rect[];
}

/** Grille de copies centree sur la feuille, avec une marge minimale de feuille (zone non imprimable). */
export function cardGrid(card: Size, sheet: Size, gapX = 0, gapY = 0, minMargin = 28.35, cols?: number, rows?: number): CardGrid {
  const fit = (avail: number, item: number, gap: number): number => Math.max(1, Math.floor((avail + gap + 0.01) / (item + gap)));
  const c = cols ?? fit(sheet.width - 2 * minMargin, card.width, gapX);
  const r = rows ?? fit(sheet.height - 2 * minMargin, card.height, gapY);
  const totalW = c * card.width + (c - 1) * gapX;
  const totalH = r * card.height + (r - 1) * gapY;
  const x0 = (sheet.width - totalW) / 2;
  const y0 = (sheet.height - totalH) / 2;
  const cells: Rect[] = [];
  for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) cells.push({ x: x0 + i * (card.width + gapX), y: y0 + j * (card.height + gapY), width: card.width, height: card.height });
  return { cols: c, rows: r, cells };
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Traits de coupe autour d'un ensemble de rectangles : un trait par ligne de coupe, hors de la zone imprimee. */
export function cropMarks(rects: readonly Rect[], offset = 9, length = 18): Segment[] {
  if (!rects.length) return [];
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  const round = (v: number): number => Math.round(v * 100) / 100;
  const xs = [...new Set(rects.flatMap((r) => [round(r.x), round(r.x + r.width)]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((r) => [round(r.y), round(r.y + r.height)]))].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (const x of xs) {
    out.push({ x1: x, y1: minY - offset - length, x2: x, y2: minY - offset });
    out.push({ x1: x, y1: maxY + offset, x2: x, y2: maxY + offset + length });
  }
  for (const y of ys) {
    out.push({ x1: minX - offset - length, y1: y, x2: minX - offset, y2: y });
    out.push({ x1: maxX + offset, y1: y, x2: maxX + offset + length, y2: y });
  }
  return out;
}

/**
 * Ordre d'impression d'un livret pique (pages pliees en deux) : pour chaque face de feuille, [page gauche, page droite].
 * Le nombre de pages est complete a un multiple de 4 (null = page blanche).
 */
export function bookletOrder(pageCount: number): Array<[number | null, number | null]> {
  const n = Math.max(4, Math.ceil(pageCount / 4) * 4);
  const page = (i: number): number | null => (i < pageCount ? i : null);
  const out: Array<[number | null, number | null]> = [];
  for (let k = 0; k < n / 4; k++) {
    out.push([page(n - 1 - 2 * k), page(2 * k)]);
    out.push([page(2 * k + 1), page(n - 2 - 2 * k)]);
  }
  return out;
}

/** Taille d'une page exportee avec fond perdu et traits de coupe. */
export function bleedSheet(page: Size, bleed: number, marks: boolean): { width: number; height: number; pageX: number; pageY: number; markOffset: number } {
  const markOffset = bleed + 3;
  const extra = marks ? markOffset + 18 + 4 : bleed;
  return { width: page.width + 2 * extra, height: page.height + 2 * extra, pageX: extra, pageY: extra, markOffset };
}
