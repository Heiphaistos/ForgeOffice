// Géométries prédéfinies des formes (noms DrawingML) : libellé français, groupe de menu, découpe CSS (clip-path) pour l'affichage.
export interface Geometry {
  id: string;
  label: string;
  group: 'basic' | 'arrows' | 'stars' | 'callouts';
  /** Points du polygone (pourcentages) ; absent = rectangle, arrondi ou ellipse gérés par le style. */
  polygon?: string;
}

export const GEOMETRIES: readonly Geometry[] = [
  { id: 'rect', label: 'Rectangle', group: 'basic' },
  { id: 'roundRect', label: 'Rectangle à coins arrondis', group: 'basic' },
  { id: 'ellipse', label: 'Ellipse', group: 'basic' },
  { id: 'line', label: 'Ligne', group: 'basic' },
  { id: 'triangle', label: 'Triangle', group: 'basic', polygon: '50% 0,100% 100%,0 100%' },
  { id: 'diamond', label: 'Losange', group: 'basic', polygon: '50% 0,100% 50%,50% 100%,0 50%' },
  { id: 'pentagon', label: 'Pentagone', group: 'basic', polygon: '50% 0,100% 38%,82% 100%,18% 100%,0 38%' },
  { id: 'hexagon', label: 'Hexagone', group: 'basic', polygon: '25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%' },
  { id: 'rightArrow', label: 'Flèche droite', group: 'arrows', polygon: '0 25%,60% 25%,60% 0,100% 50%,60% 100%,60% 75%,0 75%' },
  { id: 'leftArrow', label: 'Flèche gauche', group: 'arrows', polygon: '100% 25%,40% 25%,40% 0,0 50%,40% 100%,40% 75%,100% 75%' },
  { id: 'upArrow', label: 'Flèche haut', group: 'arrows', polygon: '25% 100%,25% 40%,0 40%,50% 0,100% 40%,75% 40%,75% 100%' },
  { id: 'downArrow', label: 'Flèche bas', group: 'arrows', polygon: '25% 0,75% 0,75% 60%,100% 60%,50% 100%,0 60%,25% 60%' },
  { id: 'star4', label: 'Étoile à 4 branches', group: 'stars', polygon: '50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%' },
  { id: 'star5', label: 'Étoile à 5 branches', group: 'stars', polygon: '50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%' },
  { id: 'wedgeRectCallout', label: 'Bulle rectangulaire', group: 'callouts', polygon: '0 0,100% 0,100% 75%,40% 75%,20% 100%,25% 75%,0 75%' },
  { id: 'wedgeRoundRectCallout', label: 'Bulle à coins arrondis', group: 'callouts', polygon: '3% 0,97% 0,100% 3%,100% 72%,97% 75%,40% 75%,20% 100%,25% 75%,3% 75%,0 72%,0 3%' },
];

export const GROUP_LABEL: Readonly<Record<Geometry['group'], string>> = { basic: 'Formes de base', arrows: 'Flèches pleines', stars: 'Étoiles et bannières', callouts: 'Bulles et légendes' };

/** Points d'un polygone pour un SVG de 100 x 100 (« 50,0 100,100 0,100 »), ou null pour les formes gerees par le style. */
export function svgPoints(id: string): string | null {
  const p = GEOMETRIES.find((g) => g.id === id)?.polygon;
  if (!p) return null;
  const n = (v: string): string => (v === '0' ? '0' : v.replace('%', ''));
  return p.split(',').map((pt) => pt.trim().split(' ').map(n).join(',')).join(' ');
}

export const geometryLabel = (id: string): string => GEOMETRIES.find((g) => g.id === id)?.label ?? id;
