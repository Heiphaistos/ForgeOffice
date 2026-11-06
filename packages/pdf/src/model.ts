// Modele du module PDF (sans DOM, teste) : elements poses sur les pages (annotations, champs, corrections,
// caviardage, signature), conversions de coordonnees ecran <-> PDF, recherche, comparaison de texte.
// Coordonnees d'un element : normalisees 0..1 dans la page telle qu'affichee (avec son /Rotate), origine en haut a gauche.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export type Tool =
  | 'select' | 'hand' | 'highlight' | 'underline' | 'strike' | 'note' | 'freetext' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'ink'
  | 'stamp' | 'signature' | 'field' | 'edittext' | 'redact';

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow';
export type MarkKind = 'highlight' | 'underline' | 'strike';
export type FieldKind = 'texte' | 'zone_texte' | 'case' | 'radio' | 'liste_deroulante' | 'liste';
export type StampKind = 'approuve' | 'confidentiel' | 'brouillon' | 'vu' | 'rejete' | 'final';

interface Base {
  id: string;
  /** Page 0-based. */
  page: number;
  author: string;
  /** Millisecondes depuis l'epoque. */
  at: number;
}

export type Item =
  | (Base & { kind: 'mark'; mark: MarkKind; rects: Rect[]; color: string; text: string })
  | (Base & { kind: 'note'; pos: Point; text: string; color: string })
  | (Base & { kind: 'freetext'; rect: Rect; text: string; size: number; color: string })
  | (Base & { kind: 'shape'; shape: ShapeKind; rect: Rect; from: Point; to: Point; color: string; width: number })
  | (Base & { kind: 'ink'; points: Point[]; color: string; width: number })
  | (Base & { kind: 'stamp'; stamp: StampKind; rect: Rect })
  | (Base & { kind: 'signature'; rect: Rect; png: Uint8Array })
  | (Base & { kind: 'field'; field: FieldKind; name: string; rect: Rect; options: string[]; value: string })
  | (Base & { kind: 'textedit'; rect: Rect; text: string; size: number })
  | (Base & { kind: 'redact'; rect: Rect });

export type ItemKind = Item['kind'];

/** Couleurs proposees (Acrobat) : surligneur jaune par defaut. */
export const MARK_COLORS = ['#FFE500', '#7FD13B', '#4CC2FF', '#FF85C0', '#FF8C00'] as const;
export const INK_COLORS = ['#D13438', '#185ABD', '#107C41', '#000000', '#FFB900'] as const;

export const STAMP_COLORS: Readonly<Record<StampKind, string>> = {
  approuve: '#107C41', confidentiel: '#C50F1F', brouillon: '#616161', vu: '#185ABD', rejete: '#C50F1F', final: '#107C41',
};

let counter = 0;
export function newId(): string {
  counter++;
  return `i${Date.now().toString(36)}${counter.toString(36)}`;
}

const HEX = /^#?([0-9a-f]{6})$/i;

export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.trim().match(HEX);
  const n = m?.[1] ? parseInt(m[1], 16) : 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Epaisseur d'un trait au stylet : proportionnelle a la pression moyenne (0 = capteur absent : epaisseur de base). Doigt et souris : epaisseur de base. */
export function pressureWidth(base: number, pressures: readonly number[], pointerType: string): number {
  if (pointerType !== 'pen') return base;
  const real = pressures.filter((p) => p > 0);
  if (real.length === 0) return base;
  const avg = real.reduce((a, b) => a + b, 0) / real.length;
  return Math.round(base * (0.6 + 0.8 * Math.min(1, avg)) * 10) / 10;
}

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Rectangle normalise d'un glisser (deux points quelconques), borne a la page. */
export function rectFrom(a: Point, b: Point): Rect {
  const x = clamp01(Math.min(a.x, b.x));
  const y = clamp01(Math.min(a.y, b.y));
  return { x, y, w: clamp01(Math.max(a.x, b.x)) - x, h: clamp01(Math.max(a.y, b.y)) - y };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Boite de page PDF [x0, y0, x1, y1] et rotation /Rotate (0, 90, 180, 270). */
export interface PageGeom {
  box: readonly [number, number, number, number];
  rotate: number;
}

/** Point normalise affiche -> point PDF (espace utilisateur de la page). */
export function toPdfPoint(p: Point, g: PageGeom): [number, number] {
  const [x0, y0, x1, y1] = g.box;
  const W = x1 - x0;
  const H = y1 - y0;
  switch (((g.rotate % 360) + 360) % 360) {
    case 90: return [x0 + p.y * W, y0 + p.x * H];
    case 180: return [x1 - p.x * W, y0 + p.y * H];
    case 270: return [x1 - p.y * W, y1 - p.x * H];
    default: return [x0 + p.x * W, y1 - p.y * H];
  }
}

/** Rectangle normalise affiche -> rectangle PDF [llx, lly, urx, ury]. */
export function toPdfRect(r: Rect, g: PageGeom): [number, number, number, number] {
  const [ax, ay] = toPdfPoint({ x: r.x, y: r.y }, g);
  const [bx, by] = toPdfPoint({ x: r.x + r.w, y: r.y + r.h }, g);
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
}

/** Dimensions de la page telle qu'affichee (points), /Rotate compris. */
export function displaySize(g: PageGeom): { w: number; h: number } {
  const W = g.box[2] - g.box[0];
  const H = g.box[3] - g.box[1];
  return ((g.rotate % 180) + 180) % 180 === 90 ? { w: H, h: W } : { w: W, h: H };
}

/** Inverse de `toPdfPoint` : point PDF -> point normalise de la page affichee. */
export function fromPdfPoint([x, y]: readonly [number, number], g: PageGeom): Point {
  const [x0, y0, x1, y1] = g.box;
  const W = x1 - x0;
  const H = y1 - y0;
  switch (((g.rotate % 360) + 360) % 360) {
    case 90: return { x: (y - y0) / H, y: (x - x0) / W };
    case 180: return { x: (x1 - x) / W, y: (y - y0) / H };
    case 270: return { x: (y1 - y) / H, y: (x1 - x) / W };
    default: return { x: (x - x0) / W, y: (y1 - y) / H };
  }
}

/** Inverse de `toPdfRect`. */
export function fromPdfRect([llx, lly, urx, ury]: readonly [number, number, number, number], g: PageGeom): Rect {
  const a = fromPdfPoint([llx, lly], g);
  const b = fromPdfPoint([urx, ury], g);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/** Repere d'un rectangle affiche pose sur la page : `matrix` envoie le repere local (origine = bas gauche du rectangle
 *  a l'ecran, x vers la droite, y vers le haut, en points) dans l'espace PDF ; `w`/`h` = taille a l'ecran en points.
 *  Sert a dessiner un contenu droit a l'ecran sur une page pivotee. */
export function screenFrame(r: Rect, g: PageGeom): { w: number; h: number; matrix: [number, number, number, number, number, number] } {
  const { w: pw, h: ph } = displaySize(g);
  const w = r.w * pw;
  const h = r.h * ph;
  const o = toPdfPoint({ x: r.x, y: r.y + r.h }, g);
  const right = toPdfPoint({ x: r.x + r.w, y: r.y + r.h }, g);
  const up = toPdfPoint({ x: r.x, y: r.y }, g);
  const unit = (a: [number, number], len: number): [number, number] => (len > 0 ? [(a[0] - o[0]) / len, (a[1] - o[1]) / len] : [1, 0]);
  const ux = unit(right, w);
  const uy = unit(up, h);
  return { w, h, matrix: [ux[0], ux[1], uy[0], uy[1], o[0], o[1]] };
}

/** Rotation de l'AFFICHAGE (hors fichier) : les elements restent dans le repere de la page, la vue est tournee. */
export function toScreenPoint(p: Point, viewRotation: number): Point {
  switch (((viewRotation % 360) + 360) % 360) {
    case 90: return { x: 1 - p.y, y: p.x };
    case 180: return { x: 1 - p.x, y: 1 - p.y };
    case 270: return { x: p.y, y: 1 - p.x };
    default: return p;
  }
}

export function fromScreenPoint(p: Point, viewRotation: number): Point {
  switch (((viewRotation % 360) + 360) % 360) {
    case 90: return { x: p.y, y: 1 - p.x };
    case 180: return { x: 1 - p.x, y: 1 - p.y };
    case 270: return { x: 1 - p.y, y: p.x };
    default: return p;
  }
}

/** Image de signature posee dans un cadre sans etre deformee (cadre normalise ; `pw`, `ph` = taille de la page en points). */
export function fitInto(rect: Rect, ratio: number, pw: number, ph: number): Rect {
  const boxAspect = (rect.w * pw) / (rect.h * ph);
  const imgAspect = 1 / ratio;
  const w = boxAspect > imgAspect ? (rect.h * ph * imgAspect) / pw : rect.w;
  const h = boxAspect > imgAspect ? rect.h : (rect.w * pw) / imgAspect / ph;
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h };
}

/** Zone forge-convert (normalisee dans la page NON pivotee, origine en haut a gauche, page 1-based). */
export function toNativeZone(r: Rect, page: number, g: PageGeom): { page: number; x: number; y: number; largeur: number; hauteur: number } {
  const [x0, y0, x1, y1] = g.box;
  const [lx, ly, ux, uy] = toPdfRect(r, g);
  const W = x1 - x0;
  const H = y1 - y0;
  return { page: page + 1, x: (lx - x0) / W, y: (y1 - uy) / H, largeur: (ux - lx) / W, hauteur: (uy - ly) / H };
}

/** Morceau de texte d'une page (pdf.js), boite normalisee dans la page affichee. */
export interface TextBox {
  str: string;
  rect: Rect;
  /** Hauteur de police en points (pour la modification de texte). */
  size: number;
}

export function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Surlignage facon Acrobat : les lignes de texte touchees par le glisser, coupees a ses bords ; sinon le glisser lui-meme. */
export function snapToText(drag: Rect, boxes: readonly TextBox[]): Rect[] {
  const hit = boxes.filter((b) => b.str.trim() !== '' && intersects(drag, b.rect));
  if (hit.length === 0) return drag.w > 0.002 && drag.h > 0.002 ? [drag] : [];
  const lines = new Map<number, Rect>();
  for (const b of hit) {
    const key = Math.round((b.rect.y + b.rect.h / 2) * 400);
    const cur = lines.get(key);
    lines.set(key, cur ? union(cur, b.rect) : b.rect);
  }
  const sorted = [...lines.values()].sort((a, b) => a.y - b.y);
  const single = sorted.length === 1;
  return sorted.map((r, i) => {
    const left = single || i === 0 ? Math.max(r.x, drag.x) : r.x;
    const right = single || i === sorted.length - 1 ? Math.min(r.x + r.w, drag.x + drag.w) : r.x + r.w;
    return { x: left, y: r.y, w: Math.max(0, right - left), h: r.h };
  }).filter((r) => r.w > 0);
}

/** Texte couvert par des rectangles (contenu du commentaire d'un surlignage). */
export function textUnder(rects: readonly Rect[], boxes: readonly TextBox[]): string {
  return boxes.filter((b) => rects.some((r) => intersects(r, b.rect))).map((b) => b.str).join(' ').replace(/\s+/g, ' ').trim();
}

export { fold, hitRect, replaceIn, search, validPattern, type SearchHit, type SearchOptions } from './find.ts';

export interface DiffLine {
  kind: 'same' | 'add' | 'del';
  text: string;
}

/** Difference ligne a ligne (plus longue sous-suite commune ; 4000 lignes au plus de chaque cote). */
export function diffLines(a: readonly string[], b: readonly string[]): DiffLine[] {
  const A = a.slice(0, 4000);
  const B = b.slice(0, 4000);
  const n = A.length;
  const m = B.length;
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = lcs[i] as Uint32Array;
    const next = lcs[i + 1] as Uint32Array;
    for (let j = m - 1; j >= 0; j--) row[j] = A[i] === B[j] ? (next[j + 1] ?? 0) + 1 : Math.max(next[j] ?? 0, row[j + 1] ?? 0);
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) {
      out.push({ kind: 'same', text: A[i] ?? '' });
      i++;
      j++;
    } else if (j < m && (i >= n || (lcs[i]?.[j + 1] ?? 0) >= (lcs[i + 1]?.[j] ?? 0))) {
      out.push({ kind: 'add', text: B[j] ?? '' });
      j++;
    } else {
      out.push({ kind: 'del', text: A[i] ?? '' });
      i++;
    }
  }
  return out;
}

/** Etat du document dans l'historique : octets enregistrables + elements en attente + journal des actions. */
export interface DocState {
  bytes: Uint8Array;
  items: Item[];
  /** Valeurs saisies dans les champs existants (nom -> texte ou coche). */
  values: Record<string, string | boolean>;
  /** Annotations deja dans le fichier, modifiees (element) ou supprimees (null), par identifiant « a:objet.generation ». */
  annotEdits: Record<string, Item | null>;
  log: string[];
}

/** Prefixe des identifiants d'annotations lues dans le fichier. */
export const EXISTING = 'a:';
export const isExisting = (id: string): boolean => id.startsWith(EXISTING);

/** Annotations lues du fichier avec les modifications en attente appliquees (les supprimees disparaissent). */
export function mergeExisting(existing: readonly Item[], edits: Readonly<Record<string, Item | null>>): Item[] {
  const out: Item[] = [];
  for (const e of existing) {
    const edit = edits[e.id];
    if (edit === undefined) out.push(e);
    else if (edit !== null) out.push(edit);
  }
  return out;
}

/** Propriete de style d'un element selectionne (couleur, epaisseur, taille de texte). */
export interface StylePatch {
  color?: string;
  width?: number;
  size?: number;
}

/** Applique un style a un element ; null si l'element n'a pas cette propriete. */
export function restyle(item: Item, p: StylePatch): Item | null {
  switch (item.kind) {
    case 'mark':
    case 'note': return p.color ? { ...item, color: p.color } : null;
    case 'freetext': return p.color || p.size ? { ...item, color: p.color ?? item.color, size: p.size ?? item.size } : null;
    case 'shape':
    case 'ink': return p.color || p.width ? { ...item, color: p.color ?? item.color, width: p.width ?? item.width } : null;
    default: return null;
  }
}

export function withLog(s: DocState, label: string, patch: Partial<DocState>): DocState {
  return { ...s, ...patch, log: [...s.log, label] };
}

/** Il reste des modifications a ecrire dans les octets. */
export function hasPending(s: DocState): boolean {
  return s.items.length > 0 || Object.keys(s.values).length > 0 || Object.keys(s.annotEdits).length > 0;
}

/** Nom de champ unique (« Texte1 », « Texte2 »...). */
export function uniqueFieldName(base: string, taken: ReadonlySet<string>): string {
  for (let i = 1; ; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
}

/** Ordre apres glisser une miniature de `from` vers `to` (indices 0-based). */
export function moveIndex(count: number, from: number, to: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  const [moved] = order.splice(from, 1);
  if (moved === undefined) return order;
  order.splice(Math.min(Math.max(to, 0), order.length), 0, moved);
  return order;
}
