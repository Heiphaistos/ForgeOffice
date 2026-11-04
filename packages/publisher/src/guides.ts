// Reperes de mise en page (sans DOM) : marges (miroir en vis-a-vis), colonnes et lignes, ligne de base,
// magnetisme, planches de pages en vis-a-vis.
import type { PubSettings } from './model.ts';

export interface Size {
  width: number;
  height: number;
}

import type { Rect } from './geom.ts';

export type { Rect };

/** Page de gauche d'une planche en vis-a-vis (la page 1 est seule, a droite). */
export const isLeftPage = (index: number, facing: boolean): boolean => facing && index % 2 === 1;

/** Zone imprimable d'une page : marges interieure / exterieure echangees sur les pages de gauche. */
export function marginBox(size: Size, pub: Pick<PubSettings, 'margins' | 'facing'>, index: number): Rect {
  const m = pub.margins;
  const left = isLeftPage(index, pub.facing) ? m.outside : m.inside;
  const right = isLeftPage(index, pub.facing) ? m.inside : m.outside;
  return { x: left, y: m.top, width: Math.max(0, size.width - left - right), height: Math.max(0, size.height - m.top - m.bottom) };
}

/** Bords des colonnes (ou des lignes) dans un intervalle : debut et fin de chaque piste, sans les bords exterieurs. */
function tracks(start: number, length: number, count: number, gap: number): number[] {
  if (count <= 1) return [];
  const track = (length - gap * (count - 1)) / count;
  const out: number[] = [];
  for (let i = 1; i < count; i++) {
    const end = start + i * track + (i - 1) * gap;
    out.push(end);
    if (gap > 0) out.push(end + gap);
  }
  return out;
}

export interface LayoutGuides {
  /** Reperes de marge (gauche, droite / haut, bas). */
  marginX: number[];
  marginY: number[];
  /** Reperes de colonnes et de lignes. */
  gridX: number[];
  gridY: number[];
}

export function layoutGuides(size: Size, pub: Pick<PubSettings, 'margins' | 'facing' | 'columns' | 'rows'>, index: number): LayoutGuides {
  const box = marginBox(size, pub, index);
  return {
    marginX: [box.x, box.x + box.width],
    marginY: [box.y, box.y + box.height],
    gridX: tracks(box.x, box.width, pub.columns.count, pub.columns.gap),
    gridY: tracks(box.y, box.height, pub.rows.count, pub.rows.gap),
  };
}

/** Lignes de base (repere horizontal tous les `spacing` points depuis la marge haute + decalage). */
export function baselines(size: Size, pub: Pick<PubSettings, 'margins' | 'baseline'>): number[] {
  const out: number[] = [];
  const step = Math.max(1, pub.baseline.spacing);
  for (let y = pub.margins.top + pub.baseline.offset; y <= size.height - pub.margins.bottom + 0.01 && out.length < 2000; y += step) out.push(y);
  return out;
}

/** Valeur aimantee au repere le plus proche (dans le seuil), sinon inchangee. */
export function snapValue(value: number, lines: readonly number[], threshold: number): number {
  let best = value;
  let dist = threshold;
  for (const l of lines) {
    const d = Math.abs(l - value);
    if (d <= dist) {
      dist = d;
      best = l;
    }
  }
  return best;
}

/** Aimante un rectangle : le bord ou le centre le plus proche d'un repere est recale (deplacement renvoye). */
export function snapRect(r: Rect, xs: readonly number[], ys: readonly number[], threshold: number): { dx: number; dy: number } {
  const axis = (edges: number[], lines: readonly number[]): number => {
    let best = 0;
    let dist = threshold + 1;
    for (const e of edges) {
      const s = snapValue(e, lines, threshold);
      if (s !== e && Math.abs(s - e) < dist) {
        dist = Math.abs(s - e);
        best = s - e;
      }
    }
    return best;
  };
  return { dx: axis([r.x, r.x + r.width / 2, r.x + r.width], xs), dy: axis([r.y, r.y + r.height / 2, r.y + r.height], ys) };
}

/** Pages affichees ensemble : en vis-a-vis, la page 1 seule puis 2-3, 4-5... */
export function spreadOf(index: number, count: number, facing: boolean): number[] {
  if (!facing || index === 0) return [index];
  const left = index % 2 === 1 ? index : index - 1;
  return left + 1 < count ? [left, left + 1] : [left];
}

/** Toutes les planches (pour le volet des pages). */
export function spreads(count: number, facing: boolean): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < count; ) {
    const s = spreadOf(i, count, facing);
    out.push(s);
    i = (s[s.length - 1] as number) + 1;
  }
  return out;
}
