// Geometrie des axes : description d'un axe calcule et conversion donnee -> position.
import type { ChartAxis } from '@forgeoffice/pptx';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectangle d'au moins 1 x 1 (une petite boite ne produit jamais de taille negative). */
export const fit = (r: Rect): Rect => ({ x: r.x, y: r.y, w: Math.max(1, r.w), h: Math.max(1, r.h) });

export type Side = 'b' | 't' | 'l' | 'r';

export interface AxisInfo {
  axis: ChartAxis;
  /** cat = categories discretes ; val = valeurs continues (dont l'axe X des nuages). */
  kind: 'cat' | 'val';
  /** Axe horizontal (le long de x). */
  horizontal: boolean;
  /** Cote des etiquettes. */
  side: Side;
  visible: boolean;
  /** Etendue des donnees (val). */
  lo: number;
  hi: number;
  includeZero: boolean;
  percent: boolean;
  format?: string;
  /** Categories (cat). */
  count: number;
  labels: string[];
  /** Points au milieu des intervalles (between) ou sur les graduations (midCat). */
  between: boolean;
  min: number;
  max: number;
  step: number;
  ticks: number[];
  /** Positions en points des extremites (min puis max, echangees si reverse). */
  start: number;
  end: number;
}

export function valPos(a: AxisInfo, v: number): number {
  const t = (Math.min(a.max, Math.max(a.min, v)) - a.min) / (a.max - a.min);
  return a.start + t * (a.end - a.start);
}

/** Largeur d'une categorie. */
export const band = (a: AxisInfo): number => Math.abs(a.end - a.start) / Math.max(1, a.between ? a.count : a.count - 1);

/** Position de la categorie i (ou de la valeur i sur un axe de valeurs). */
export function catPos(a: AxisInfo, i: number): number {
  if (a.kind === 'val') return valPos(a, i);
  const dir = a.end >= a.start ? 1 : -1;
  if (a.between) return a.start + dir * (i + 0.5) * band(a);
  return a.count > 1 ? a.start + dir * i * band(a) : (a.start + a.end) / 2;
}

/** Positions des graduations d'un axe de categories (limites des intervalles, ou points). */
export function catTicks(a: AxisInfo): number[] {
  const dir = a.end >= a.start ? 1 : -1;
  const n = a.between ? a.count + 1 : a.count;
  return Array.from({ length: n }, (_, i) => a.start + dir * i * band(a));
}

/** Valeur a laquelle un axe coupe l'axe de valeurs v (crosses). */
export function crossValue(crosses: ChartAxis['crosses'], v: AxisInfo): number {
  if (crosses === 'min') return v.min;
  if (crosses === 'max') return v.max;
  const x = typeof crosses === 'number' && Number.isFinite(crosses) ? crosses : 0;
  return Math.min(v.max, Math.max(v.min, x));
}
