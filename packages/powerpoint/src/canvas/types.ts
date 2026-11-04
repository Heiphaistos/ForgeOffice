// Contrats de l'editeur de page (reutilise par Presentation et Publication).
import type { Shape } from '@forgeoffice/pptx';
import type { Box, Point } from './math.ts';
import type { TextRange } from './text.ts';

/** Cible d'edition de texte : une forme, ou une cellule d'un tableau. */
export interface TextTarget {
  shapeId: number;
  cell?: { row: number; col: number };
  range: TextRange;
}

/** Plage de cellules selectionnee dans un tableau. */
export interface CellRange {
  shapeId: number;
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export interface CanvasSelection {
  /** Formes selectionnees (identifiants ; les enfants de groupe sont permis). */
  ids: number[];
  /** Texte en cours d'edition. */
  text?: TextTarget | null;
  cells?: CellRange | null;
}

export const EMPTY_SELECTION: CanvasSelection = { ids: [] };

/** Outil actif de l'editeur. */
export type CanvasTool =
  | { kind: 'select' }
  /** Trace d'une forme predefinie (rect, ellipse...) ; lignes et connecteurs se tracent d'un point a l'autre. */
  | { kind: 'shape'; preset: string }
  | { kind: 'textbox'; vertical?: boolean }
  /** Encre : stylet, surligneur. */
  | { kind: 'ink'; color: string; width: number; highlighter?: boolean }
  | { kind: 'eraser' }
  /** Placement d'un contenu (image, tableau, graphique...) par clic ou cadre. */
  | { kind: 'place'; what: string };

export type CreateRequest =
  | { kind: 'shape'; preset: string; box: Box; start?: { shapeId: number; site: number }; end?: { shapeId: number; site: number }; clicked: boolean }
  | { kind: 'textbox'; box: Box; vertical?: boolean; clicked: boolean }
  | { kind: 'ink'; points: Point[]; color: string; width: number; highlighter?: boolean }
  | { kind: 'place'; what: string; box: Box; clicked: boolean };

/** Modification du modele : la recette modifie un brouillon des formes de la page (execution synchrone). */
export type EditFn = (recipe: (shapes: Shape[]) => void, group?: string) => void;

export interface CanvasOptions {
  /** Afficher le quadrillage (pas en points), null = masque. */
  grid?: number | null;
  /** Aligner les objets sur la grille. */
  snapToGrid?: boolean;
  /** Reperes intelligents (alignement sur les autres formes et la page). */
  smartGuides?: boolean;
  /** Reperes de dessin (positions en points depuis le bord haut gauche). */
  guidesX?: readonly number[];
  guidesY?: readonly number[];
  onGuidesChange?: (guides: { x: number[]; y: number[] }) => void;
  rulers?: boolean;
}
