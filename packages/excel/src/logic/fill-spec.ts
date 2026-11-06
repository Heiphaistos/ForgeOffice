// Remplissages de la boite « Format de cellule » (sans DOM) : couleur d'arriere-plan + motif, degrades d'Excel
// (6 styles x 4 variantes), et motif en pixels (utilise par le dessin de la grille).
import type { Color, Fill, GradientFill, PatternType } from '@forgeoffice/xlsx';
import { NO_FILL } from './styles.ts';

/** Les 18 motifs d'Excel (hors « uni », qui est la couleur d'arriere-plan). */
export const PATTERNS: readonly PatternType[] = [
  'none', 'darkGray', 'mediumGray', 'lightGray', 'gray125', 'gray0625',
  'darkHorizontal', 'darkVertical', 'darkDown', 'darkUp', 'darkGrid', 'darkTrellis',
  'lightHorizontal', 'lightVertical', 'lightDown', 'lightUp', 'lightGrid', 'lightTrellis',
];

export interface FillParts {
  /** Couleur d'arriere-plan (null = aucune). */
  bg: Color | null;
  pattern: PatternType;
  patternColor: Color | null;
}

const BLACK: Color = { rgb: 'FF000000' };
const WHITE: Color = { rgb: 'FFFFFFFF' };

/** Remplissage -> couleur d'arriere-plan, motif et couleur du motif (un degrade n'a ni l'un ni l'autre). */
export function splitFill(fill: Fill): FillParts {
  if (fill.type === 'gradient') return { bg: null, pattern: 'none', patternColor: null };
  if (fill.pattern === 'none') return { bg: null, pattern: 'none', patternColor: null };
  if (fill.pattern === 'solid') return { bg: fill.fg ?? fill.bg ?? null, pattern: 'none', patternColor: null };
  return { bg: fill.bg ?? null, pattern: fill.pattern, patternColor: fill.fg ?? null };
}

/** Couleur d'arriere-plan + motif -> remplissage du modele. */
export function joinFill(p: FillParts): Fill {
  if (p.pattern === 'none') return p.bg ? { type: 'pattern', pattern: 'solid', fg: p.bg } : NO_FILL;
  return { type: 'pattern', pattern: p.pattern, fg: p.patternColor ?? BLACK, bg: p.bg ?? WHITE };
}

export type GradientKind = 'horizontal' | 'vertical' | 'diagUp' | 'diagDown' | 'corner' | 'center';
export const GRADIENT_KINDS: readonly GradientKind[] = ['horizontal', 'vertical', 'diagUp', 'diagDown', 'corner', 'center'];

/** Position des points d'arret selon la variante (1 : c1 -> c2, 2 : c2 -> c1, 3 : c1 c2 c1, 4 : c2 c1 c2). */
function stops(variant: number, c1: Color, c2: Color): GradientFill['stops'] {
  switch (variant) {
    case 2: return [{ position: 0, color: c2 }, { position: 1, color: c1 }];
    case 3: return [{ position: 0, color: c1 }, { position: 0.5, color: c2 }, { position: 1, color: c1 }];
    case 4: return [{ position: 0, color: c2 }, { position: 0.5, color: c1 }, { position: 1, color: c2 }];
    default: return [{ position: 0, color: c1 }, { position: 1, color: c2 }];
  }
}

/** Degrade d'Excel : style, variante (1 a 4) et deux couleurs. */
export function buildGradient(kind: GradientKind, variant: number, c1: Color, c2: Color): GradientFill {
  const v = Math.max(1, Math.min(4, Math.round(variant)));
  switch (kind) {
    case 'horizontal': return { type: 'gradient', gradient: 'linear', degree: 90, stops: stops(v, c1, c2) };
    case 'vertical': return { type: 'gradient', gradient: 'linear', degree: 0, stops: stops(v, c1, c2) };
    case 'diagUp': return { type: 'gradient', gradient: 'linear', degree: 135, stops: stops(v, c1, c2) };
    case 'diagDown': return { type: 'gradient', gradient: 'linear', degree: 45, stops: stops(v, c1, c2) };
    case 'corner': {
      // Variantes : coin haut-gauche, haut-droit, bas-gauche, bas-droit.
      const right = v === 2 || v === 4 ? 1 : 0;
      const bottom = v === 3 || v === 4 ? 1 : 0;
      return { type: 'gradient', gradient: 'path', left: right, right, top: bottom, bottom, stops: stops(1, c1, c2) };
    }
    case 'center': return { type: 'gradient', gradient: 'path', left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, stops: stops(v <= 2 ? v : 1, c1, c2) };
  }
}

// ---------------------------------------------------------------- Motifs en pixels

/** Vrai si le pixel (x, y) du motif est de la couleur du motif (sinon de l'arriere-plan). Tuile de 8 x 8. */
export function patternPixel(p: PatternType, x: number, y: number): boolean {
  const px = ((x % 8) + 8) % 8;
  const py = ((y % 8) + 8) % 8;
  const d1 = (px + py) % 4;
  const d2 = (((px - py) % 4) + 4) % 4;
  switch (p) {
    case 'solid': return true;
    case 'darkGray': return (px + py) % 2 === 0 || py % 2 === 0;
    case 'mediumGray': return (px + py) % 2 === 0;
    case 'lightGray': return px % 2 === 0 && py % 2 === 0 || (px % 4 === 1 && py % 4 === 1);
    case 'gray125': return px % 4 === 0 && py % 2 === 0;
    case 'gray0625': return px % 4 === 0 && py % 4 === 0;
    case 'darkHorizontal': return py % 4 < 2;
    case 'darkVertical': return px % 4 < 2;
    case 'darkDown': return d2 < 2;
    case 'darkUp': return d1 < 2;
    case 'darkGrid': return py % 4 < 2 || px % 4 < 2;
    case 'darkTrellis': return d1 < 2 || d2 < 2;
    case 'lightHorizontal': return py % 2 === 0;
    case 'lightVertical': return px % 2 === 0;
    case 'lightDown': return d2 === 0;
    case 'lightUp': return d1 === 0;
    case 'lightGrid': return py % 4 === 0 || px % 4 === 0;
    case 'lightTrellis': return d1 === 0 || d2 === 0;
    default: return false;
  }
}

// ---------------------------------------------------------------- Remplissage resolu pour le dessin

export type PaintFill =
  | { kind: 'pattern'; pattern: PatternType; fg: string; bg: string }
  | { kind: 'gradient'; path: boolean; degree: number; focus: { x: number; y: number }; stops: { position: number; color: string }[] };

/** Remplissage a dessiner (motif ou degrade) ; null pour « aucun » et « uni » (couleur plate deja geree). */
export function resolveFill(fill: Fill | undefined, hex: (c: Color | undefined, fallback: string) => string): PaintFill | null {
  if (!fill) return null;
  if (fill.type === 'gradient') {
    const stopsList = fill.stops.map((s) => ({ position: s.position, color: hex(s.color, '#FFFFFF') }));
    if (stopsList.length < 2) return null;
    return {
      kind: 'gradient',
      path: fill.gradient === 'path',
      degree: fill.degree ?? 0,
      focus: { x: ((fill.left ?? 0.5) + (fill.right ?? 0.5)) / 2, y: ((fill.top ?? 0.5) + (fill.bottom ?? 0.5)) / 2 },
      stops: stopsList,
    };
  }
  if (fill.pattern === 'none' || fill.pattern === 'solid') return null;
  return { kind: 'pattern', pattern: fill.pattern, fg: hex(fill.fg, '#000000'), bg: hex(fill.bg, '#FFFFFF') };
}
