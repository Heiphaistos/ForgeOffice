// Habillage du texte autour des objets (sans DOM) : pour une bande de lignes d'une colonne, largeur reservee a gauche et a droite
// par un nombre quelconque d'objets (carre, ajuste = contour reel du polygone ou du chemin, haut et bas).
// Le meme calcul sert a la mesure du texte (flow.ts) et au rendu : deux flottants CSS (gauche, droit) dont `shape-outside`
// est le profil de toutes les colonnes mises bout a bout (un flottant plus haut qu'une colonne est fragmente colonne par colonne).

/** Distance entre le texte et un objet habille. */
export const WRAP_GAP = 7.2;
/** Pas d'echantillonnage vertical du profil (points). */
const STEP = 3;
/** Largeur minimale laissee au texte entre deux objets, en dessous elle est consideree comme bloquee. */
const MIN_TEXT = 10;

export type Pt = readonly [number, number];

export type WrapShape = 'square' | 'tight' | 'topBottom';

/** Objet a contourner, en coordonnees de la zone de texte (origine = coin haut gauche apres les marges). */
export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  mode: WrapShape;
  /** Contour reel (mode ajuste) : un ou plusieurs polygones dans le meme repere que x, y. Absent = rectangle. */
  polygons?: ReadonlyArray<readonly Pt[]>;
}

export interface Insets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Frame {
  width: number;
  height: number;
  insets: Insets;
  columns: number;
  gap: number;
  obstacles: readonly Obstacle[];
}

export const columnWidth = (f: Frame): number => {
  const inner = f.width - f.insets.left - f.insets.right;
  const n = Math.max(1, f.columns);
  return Math.max(1, (inner - f.gap * (n - 1)) / n);
};

/** Hauteur utile d'une colonne. */
export const columnHeight = (f: Frame): number => Math.max(1, f.height - f.insets.top - f.insets.bottom);

/** Etendue horizontale d'un ensemble de polygones sur la bande [y0, y1] (null si la bande ne les touche pas). */
export function spanAt(polygons: ReadonlyArray<readonly Pt[]>, y0: number, y1: number, dx = 0): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  const take = (x: number): void => {
    if (x < min) min = x;
    if (x > max) max = x;
  };
  for (const poly of polygons) {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = poly[i] as Pt;
      const [bx, by] = poly[(i + 1) % n] as Pt;
      if (ay >= y0 && ay <= y1) take(ax - dx);
      for (const y of [y0, y1]) {
        if ((ay < y && by > y) || (ay > y && by < y)) take(ax + ((bx - ax) * (y - ay)) / (by - ay) - dx);
      }
    }
  }
  return min <= max ? { min, max } : null;
}

export interface Band {
  /** Largeur reservee depuis le bord gauche / droit de la colonne. */
  left: number;
  right: number;
  /** Bas de l'objet le plus bas qui bloque la bande (Infinity si aucun). */
  free: number;
}

/** Largeurs reservees dans la colonne `col` pour les lignes comprises entre `top` et `top + h`. */
export function bandAt(frame: Frame, col: number, top: number, h: number): Band {
  const cw = columnWidth(frame);
  const colX = col * (cw + frame.gap);
  const out: Band = { left: 0, right: 0, free: Infinity };
  for (const ob of frame.obstacles) {
    const x0 = ob.x - colX;
    const x1 = x0 + ob.width;
    const bottom = ob.y + ob.height + WRAP_GAP;
    // L'objet occupe [y - gap, bas + gap] : la ligne placee juste sous `bottom` n'est plus gênee.
    if (x1 <= 0 || x0 >= cw || top >= bottom || top + h <= ob.y - WRAP_GAP) continue;
    if (ob.mode === 'topBottom') {
      out.left = cw;
      out.free = Math.min(out.free, bottom);
      continue;
    }
    const span = ob.mode === 'tight' && ob.polygons ? spanAt(ob.polygons, top - WRAP_GAP, top + h + WRAP_GAP, colX) : { min: x0, max: x1 };
    if (!span || span.max <= 0 || span.min >= cw) continue;
    if ((x0 + x1) / 2 < cw / 2) out.left = Math.max(out.left, Math.min(cw, span.max + WRAP_GAP));
    else out.right = Math.max(out.right, Math.min(cw, cw - span.min + WRAP_GAP));
    out.free = Math.min(out.free, bottom);
  }
  // Objets des deux cotes qui ne laissent plus de place au texte : la bande est entierement reservee (le texte passe dessous).
  if (out.left + out.right > cw - MIN_TEXT) {
    out.left = cw;
    out.right = 0;
  }
  return out;
}

/** Flottant CSS equivalent a une plage d'objets d'un cote : le texte s'ecarte du profil donne par `polygon`. */
export interface WrapFloat {
  side: 'left' | 'right';
  /** Hauteur a laisser libre (flottant sans largeur) entre le flottant precedent du meme cote et celui-ci. */
  before: number;
  width: number;
  height: number;
  /** `shape-outside` : profil de la plage, dans le repere du flottant. */
  polygon: string;
}

const px = (v: number): string => `${Math.round(v * 100) / 100}px`;

interface Sample {
  y0: number;
  y1: number;
  w: number;
}

/** Plages continues de largeurs reservees non nulles, toutes colonnes mises bout a bout (coordonnees empilees). */
function runs(samples: readonly Sample[]): Sample[][] {
  const out: Sample[][] = [];
  let cur: Sample[] = [];
  for (const s of samples) {
    if (s.w <= 0.05) {
      if (cur.length) out.push(cur);
      cur = [];
      continue;
    }
    const last = cur[cur.length - 1];
    if (last && Math.abs(last.y1 - s.y0) > 0.01) {
      out.push(cur);
      cur = [];
    }
    cur.push(s);
  }
  if (cur.length) out.push(cur);
  return out;
}

function floatOf(side: 'left' | 'right', run: readonly Sample[], before: number): WrapFloat {
  const top = (run[0] as Sample).y0;
  const height = (run[run.length - 1] as Sample).y1 - top;
  const width = Math.max(...run.map((s) => s.w));
  const mirror = side === 'right';
  const x = (w: number): number => (mirror ? width - w : w);
  const pts: string[] = [`${px(mirror ? width : 0)} 0px`];
  let last = -1;
  for (const s of run) {
    if (Math.abs(s.w - last) < 0.05) {
      pts[pts.length - 1] = `${px(x(s.w))} ${px(s.y1 - top)}`;
      continue;
    }
    pts.push(`${px(x(s.w))} ${px(s.y0 - top)}`, `${px(x(s.w))} ${px(s.y1 - top)}`);
    last = s.w;
  }
  pts.push(`${px(mirror ? width : 0)} ${px(height)}`);
  return { side, before, width, height, polygon: `polygon(${pts.join(', ')})` };
}

/**
 * Flottants CSS de la zone : pour chaque cote, une suite de flottants (un par plage d'objets) separes par des espaces,
 * qui couvrent toutes les colonnes mises bout a bout (un flottant plus haut qu'une colonne est fragmente colonne par colonne).
 * Chaque flottant ne mesure que la hauteur de sa plage : deux objets de cotes opposes a des hauteurs differentes ne se genent pas.
 */
export function wrapFloats(frame: Frame): WrapFloat[] {
  if (!frame.obstacles.length) return [];
  const cols = Math.max(1, frame.columns);
  const ch = columnHeight(frame);
  const left: Sample[] = [];
  const right: Sample[] = [];
  for (let c = 0; c < cols; c++) {
    for (let y = 0; y < ch; y += STEP) {
      const h = Math.min(STEP, ch - y);
      const b = bandAt(frame, c, y, h);
      left.push({ y0: c * ch + y, y1: c * ch + y + h, w: b.left });
      right.push({ y0: c * ch + y, y1: c * ch + y + h, w: b.right });
    }
  }
  // Un flottant ne peut pas etre place plus haut qu'un flottant precedent dans le document (meme d'un autre cote) :
  // les plages des deux cotes sont donc ecrites par hauteur croissante, et l'espace libre est calcule depuis cette contrainte.
  const all = (['left', 'right'] as const)
    .flatMap((side) => runs(side === 'left' ? left : right).map((run) => ({ side, run, top: (run[0] as Sample).y0, bottom: (run[run.length - 1] as Sample).y1 })))
    .sort((p, q) => p.top - q.top);
  const out: WrapFloat[] = [];
  const bottom = { left: 0, right: 0 };
  let cursor = 0;
  for (const item of all) {
    const start = Math.max(bottom[item.side], cursor);
    out.push(floatOf(item.side, item.run, Math.max(0, item.top - start)));
    cursor = Math.max(cursor, item.top);
    bottom[item.side] = item.bottom;
  }
  return out;
}
