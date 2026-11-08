// Formes de la galerie « Formes » : geometrie DrawingML, trace SVG (viewBox 0 0 100 100) et creation d'une forme ancree sur une cellule.
import type { CellAddress, DrawingObject, ShapeObject } from '@forgeoffice/xlsx';

export interface ShapeDef {
  /** Geometrie predefinie DrawingML. */
  id: string;
  label: string;
  /** Points du polygone dans un carre 100 x 100 ; absent pour rect, roundRect, ellipse et line. */
  points?: string;
}

export const SHAPES: readonly ShapeDef[] = [
  { id: 'rect', label: 'Rectangle' },
  { id: 'roundRect', label: 'Rectangle : coins arrondis' },
  { id: 'ellipse', label: 'Ovale' },
  { id: 'triangle', label: 'Triangle isocèle', points: '50,0 100,100 0,100' },
  { id: 'diamond', label: 'Losange', points: '50,0 100,50 50,100 0,50' },
  { id: 'rightArrow', label: 'Flèche : droite', points: '0,30 60,30 60,5 100,50 60,95 60,70 0,70' },
  { id: 'star5', label: 'Étoile : 5 branches', points: '50,0 62,36 100,36 69,58 81,95 50,72 19,95 31,58 0,36 38,36' },
  { id: 'line', label: 'Ligne' },
];

export const shapeLabel = (id: string): string => SHAPES.find((s) => s.id === id)?.label ?? id;

const PX = 9525;

/** Nouvelle forme (ou zone de texte : `textBox`) posee sur la cellule `at`, 160 x 90 pixels. */
export function newShape(geometry: string, at: CellAddress, name: string, textBox = false): ShapeObject {
  const line = geometry === 'line';
  return {
    kind: 'shape', geometry: textBox ? 'rect' : geometry, name,
    anchor: { type: 'oneCell', from: { col: at.col, colOffset: 0, row: at.row, rowOffset: 0 }, width: (line ? 160 : textBox ? 160 : 140) * PX, height: (line ? 12 : textBox ? 40 : 90) * PX },
    ...(textBox ? { fill: { none: true }, line: { none: true }, text: '' } : line ? { line: { color: '156082', width: 2 }, connector: true } : { fill: { color: '156082' }, line: { color: '0F4761', width: 1 }, textColor: 'FFFFFF' }),
  };
}

/** Nom unique « Rectangle 1 », « Rectangle 2 »... parmi les dessins existants. */
export function shapeName(label: string, existing: readonly { name: string }[]): string {
  let n = 1;
  while (existing.some((d) => d.name === `${label} ${n}`)) n++;
  return `${label} ${n}`;
}

export type Arrange = 'front' | 'forward' | 'backward' | 'back';

/** Change l'ordre d'empilement d'un objet (premier plan, avancer, reculer, arriere-plan). */
export function arrangeDrawing(list: readonly DrawingObject[], index: number, how: Arrange): DrawingObject[] {
  const item = list[index];
  if (!item) return [...list];
  const rest = list.filter((_, k) => k !== index);
  const to = how === 'front' ? rest.length : how === 'back' ? 0 : how === 'forward' ? Math.min(rest.length, index + 1) : Math.max(0, index - 1);
  return [...rest.slice(0, to), item, ...rest.slice(to)];
}

/** Couleurs proposees pour le remplissage, le contour et le texte (accents Office et neutres). */
export const SHAPE_COLORS: readonly string[] = ['156082', 'E97132', '196B24', '0F9ED5', 'A02B93', '4EA72E', 'C00000', 'FFC000', '000000', '7F7F7F', 'FFFFFF'];
/** Epaisseurs de contour proposees, en points. */
export const SHAPE_WEIGHTS: readonly number[] = [0.75, 1, 1.5, 2.25, 3, 4.5, 6];

/** Applique des modifications a une forme ; `line` et `fill` sont fusionnes avec l'existant (un `none` ancien est retire si une couleur est donnee). */
export function editShape(shape: ShapeObject, patch: Partial<ShapeObject>): ShapeObject {
  const next: ShapeObject = { ...shape, ...patch };
  if (patch.fill && patch.fill.color && !patch.fill.none) next.fill = { ...patch.fill };
  return next;
}

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface Box { x: number; y: number; w: number; h: number }

/** Redimensionne un rectangle en tirant la poignee `h` de (dx, dy) ; le bord oppose reste fixe et la taille minimale est respectee. */
export function resizeBox(b: Box, h: Handle, dx: number, dy: number, minW = 24, minH = 16): Box {
  let { x, y, w, hgt } = { x: b.x, y: b.y, w: b.w, hgt: b.h };
  if (h.includes('e')) w = Math.max(minW, b.w + dx);
  if (h.includes('w')) {
    w = Math.max(minW, b.w - dx);
    x = b.x + b.w - w;
  }
  if (h.includes('s')) hgt = Math.max(minH, b.h + dy);
  if (h.includes('n')) {
    hgt = Math.max(minH, b.h - dy);
    y = b.y + b.h - hgt;
  }
  return { x, y, w, h: hgt };
}

/** Angle (degres, 0 a 359) du point par rapport au centre, 0 = vers le haut, sens horaire ; `snap` arrondit a ce pas (ex. 15). */
export function rotationFrom(center: { x: number; y: number }, point: { x: number; y: number }, snap = 0): number {
  const deg = (Math.atan2(point.x - center.x, -(point.y - center.y)) * 180) / Math.PI;
  const norm = ((deg % 360) + 360) % 360;
  const v = snap > 0 ? Math.round(norm / snap) * snap : Math.round(norm);
  return v % 360;
}
