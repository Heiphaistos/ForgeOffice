// Fusion de catalogue (sans DOM) : plusieurs enregistrements par page. Les objets choisis forment une « cellule » repetee
// en grille (colonnes x lignes) ; le reste de la page (titre, pied) est conserve sur chaque page produite.
import type { Deck, Shape, Slide } from '@forgeoffice/pptx';
import { insertCopies } from '../../powerpoint/src/canvas/ops.ts';
import { boundsOfXfrm } from './geom.ts';
import { fillShapes } from './merge.ts';
import type { MergeSource } from './model.ts';

export interface CatalogOptions {
  cols: number;
  rows: number;
  /** Ecarts entre cellules (points). */
  gapX: number;
  gapY: number;
}

export const MAX_CELLS = 400;

/** Cadre englobant des objets (points), ou null si aucun n'a de position. */
export function cellBounds(shapes: readonly Shape[]): { x: number; y: number; width: number; height: number } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of shapes) {
    if (!s.xfrm) continue;
    const b = boundsOfXfrm(s.xfrm);
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** Nombre de pages produites pour `records` enregistrements. */
export const catalogPages = (records: number, options: CatalogOptions): number => Math.ceil(records / Math.max(1, options.cols * options.rows));

/** Les cellules de la grille tiennent-elles dans la page ? (message d'erreur sinon) */
export function catalogFits(page: { width: number; height: number }, cell: { x: number; y: number; width: number; height: number }, o: CatalogOptions): string | null {
  if (o.cols * o.rows < 1 || o.cols * o.rows > MAX_CELLS) return 'cells';
  const right = cell.x + o.cols * cell.width + (o.cols - 1) * o.gapX;
  const bottom = cell.y + o.rows * cell.height + (o.rows - 1) * o.gapY;
  return right > page.width + 0.5 || bottom > page.height + 0.5 ? 'overflow' : null;
}

/**
 * Publication de catalogue : la page `pageIndex` est remplacee par autant de pages que necessaire ; chacune porte une copie des
 * objets hors cellule et, dans la grille, une copie de la cellule par enregistrement (champs remplis). Les autres pages sont conservees.
 */
export function mergeCatalog(deck: Deck, source: MergeSource, pageIndex: number, cellIds: readonly number[], options: CatalogOptions): Deck {
  const template = deck.slides[pageIndex];
  if (!template) return deck;
  const cell = template.shapes.filter((s) => cellIds.includes(s.id));
  const box = cellBounds(cell);
  if (!box || catalogFits(deck.size, box, options)) return deck;
  const base = template.shapes.filter((s) => !cellIds.includes(s.id));
  const perPage = options.cols * options.rows;
  const generated: Slide[] = [];
  let id = Math.max(255, ...deck.slides.map((s) => s.id));
  for (let first = 0; first < source.records.length; first += perPage) {
    const page: Slide = { ...structuredClone(template), id: ++id, shapes: structuredClone(base) };
    source.records.slice(first, first + perPage).forEach((record, n) => {
      const offset = { x: (n % options.cols) * (box.width + options.gapX), y: Math.floor(n / options.cols) * (box.height + options.gapY) };
      const created = insertCopies(page.shapes, cell, offset);
      fillShapes(page.shapes.filter((s) => created.includes(s.id)), source.fields, record);
    });
    generated.push(page);
  }
  return { ...deck, slides: [...deck.slides.slice(0, pageIndex), ...generated, ...deck.slides.slice(pageIndex + 1)], sections: [] };
}
