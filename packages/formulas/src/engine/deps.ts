// Graphe de dependances : precedents enregistres pendant l'evaluation et index inverse (qui depend de quoi).
import { MAX_COLS, type Area } from '../refs.ts';

/** Cle unique d'une cellule tous classeurs confondus (feuille, ligne, colonne). */
export const posKey = (sheet: number, row: number, col: number): number => sheet * 2 ** 34 + row * MAX_COLS + col;

/** Precedents lus pendant une evaluation. */
export class Recorder {
  readonly cells: number[] = [];
  readonly areas: Area[] = [];
  /** Feuilles dont l'etendue utilisee a ete lue (colonnes/lignes entieres). */
  readonly bounds: number[] = [];
}

interface AreaLink<T> {
  area: Area;
  node: T;
}

interface Links<T> {
  cells: number[];
  areas: AreaLink<T>[];
  bounds: number[];
}

/** Au-dela de cette largeur, une zone est rangee dans la liste des zones larges de la feuille. */
const WIDE = 32;
/** Au-dela de cette hauteur, une zone entre dans l'arbre d'intervalles de sa colonne. */
const TALL = 32;
/** Feuilles de l'arbre d'intervalles : 2^20 lignes (MAX_ROWS). */
const LEAF = 2 ** 20;
const NODES = LEAF * 2;

/**
 * Noeuds d'un arbre de segments (indices de tas) qui recouvrent exactement [r1, r2] : une zone y est rangee
 * dans au plus ~40 noeuds, et la ligne r est couverte si l'un des ancetres de la feuille r contient la zone.
 */
function coverNodes(r1: number, r2: number, cb: (node: number) => void): void {
  let lo = r1 + LEAF;
  let hi = r2 + LEAF + 1;
  while (lo < hi) {
    if (lo & 1) cb(lo++);
    if (hi & 1) cb(--hi);
    lo >>= 1;
    hi >>= 1;
  }
}

function addTo<K, V>(map: Map<K, Set<V>>, key: K, v: V): void {
  let s = map.get(key);
  if (!s) {
    s = new Set();
    map.set(key, s);
  }
  s.add(v);
}

function removeFrom<K, V>(map: Map<K, Set<V>>, key: K, v: V): void {
  const s = map.get(key);
  if (!s) return;
  s.delete(v);
  if (s.size === 0) map.delete(key);
}

function sameLinks<T>(l: Links<T>, rec: Recorder): boolean {
  if (l.cells.length !== rec.cells.length || l.areas.length !== rec.areas.length || l.bounds.length !== rec.bounds.length) {
    return false;
  }
  for (let i = 0; i < l.cells.length; i++) if (l.cells[i] !== rec.cells[i]) return false;
  for (let i = 0; i < l.bounds.length; i++) if (l.bounds[i] !== rec.bounds[i]) return false;
  for (let i = 0; i < l.areas.length; i++) {
    const a = l.areas[i]?.area;
    const b = rec.areas[i];
    if (!a || !b || a.sheet !== b.sheet || a.r1 !== b.r1 || a.c1 !== b.c1 || a.r2 !== b.r2 || a.c2 !== b.c2) return false;
  }
  return true;
}

/**
 * Index inverse. Les zones courtes (< 32 lignes) et etroites sont rangees par colonne et parcourues ;
 * les zones hautes (cumuls `SUM($A$1:A1)` sur des dizaines de milliers de lignes) vont dans un arbre
 * d'intervalles par colonne : une requete ne visite que les zones qui contiennent vraiment la ligne.
 */
export class DependencyIndex<T> {
  private readonly cells = new Map<number, Set<T>>();
  private readonly cols = new Map<number, Set<AreaLink<T>>>();
  /** (feuille, colonne) * NODES + noeud -> zones hautes qui couvrent ce noeud. */
  private readonly tree = new Map<number, Set<AreaLink<T>>>();
  /** (feuille, colonne) qui possedent au moins une zone dans l'arbre. */
  private readonly treeCols = new Map<number, number>();
  private readonly wide = new Map<number, Set<AreaLink<T>>>();
  private readonly bounds = new Map<number, Set<T>>();
  private readonly links = new Map<T, Links<T>>();

  /** Remplace les precedents de `node`. */
  set(node: T, rec: Recorder): void {
    const prev = this.links.get(node);
    if (prev && sameLinks(prev, rec)) return;
    this.remove(node);
    if (rec.cells.length === 0 && rec.areas.length === 0 && rec.bounds.length === 0) return;
    const l: Links<T> = { cells: rec.cells, areas: [], bounds: rec.bounds };
    for (const k of rec.cells) addTo(this.cells, k, node);
    for (const area of rec.areas) {
      const link = { area, node };
      l.areas.push(link);
      this.place(link, true);
    }
    for (const s of rec.bounds) addTo(this.bounds, s, node);
    this.links.set(node, l);
  }

  remove(node: T): void {
    const l = this.links.get(node);
    if (!l) return;
    for (const k of l.cells) removeFrom(this.cells, k, node);
    for (const link of l.areas) this.place(link, false);
    for (const s of l.bounds) removeFrom(this.bounds, s, node);
    this.links.delete(node);
  }

  private place(link: AreaLink<T>, add: boolean): void {
    const a = link.area;
    if (a.c2 - a.c1 >= WIDE) {
      if (add) addTo(this.wide, a.sheet, link);
      else removeFrom(this.wide, a.sheet, link);
      return;
    }
    const tall = a.r2 - a.r1 >= TALL;
    for (let c = a.c1; c <= a.c2; c++) {
      const col = a.sheet * MAX_COLS + c;
      if (!tall) {
        if (add) addTo(this.cols, col, link);
        else removeFrom(this.cols, col, link);
        continue;
      }
      const base = col * NODES;
      coverNodes(a.r1, Math.min(a.r2, LEAF - 1), (n) => (add ? addTo(this.tree, base + n, link) : removeFrom(this.tree, base + n, link)));
      const k = (this.treeCols.get(col) ?? 0) + (add ? 1 : -1);
      if (k > 0) this.treeCols.set(col, k);
      else this.treeCols.delete(col);
    }
  }

  /** Appelle `cb` pour chaque formule qui lit la cellule (directement ou via une zone). */
  dependents(sheet: number, row: number, col: number, cb: (n: T) => void): void {
    this.cells.get(posKey(sheet, row, col))?.forEach(cb);
    const hit = (link: AreaLink<T>): void => {
      const a = link.area;
      if (row >= a.r1 && row <= a.r2 && col >= a.c1 && col <= a.c2) cb(link.node);
    };
    const colKey = sheet * MAX_COLS + col;
    this.cols.get(colKey)?.forEach(hit);
    if (this.treeCols.has(colKey) && row < LEAF) {
      const base = colKey * NODES;
      for (let n = row + LEAF; n >= 1; n >>= 1) this.tree.get(base + n)?.forEach((link) => cb(link.node));
    }
    this.wide.get(sheet)?.forEach(hit);
  }

  /** Precedents enregistres lors du dernier calcul de `node` (cellules et zones). */
  precedents(node: T): { cells: readonly number[]; areas: readonly Area[] } {
    const l = this.links.get(node);
    return { cells: l?.cells ?? [], areas: l?.areas.map((a) => a.area) ?? [] };
  }

  /** Formules dont les precedents (cellules, zones ou etendue utilisee) touchent la feuille. */
  referencing(sheets: ReadonlySet<number>): T[] {
    const out: T[] = [];
    for (const [node, l] of this.links) {
      const hit = l.bounds.some((s) => sheets.has(s)) ||
        l.areas.some((a) => sheets.has(a.area.sheet)) ||
        l.cells.some((k) => sheets.has(Math.floor(k / 2 ** 34)));
      if (hit) out.push(node);
    }
    return out;
  }

  /** Formules qui dependent de l'etendue utilisee d'une feuille. */
  boundsDependents(sheet: number, cb: (n: T) => void): void {
    this.bounds.get(sheet)?.forEach(cb);
  }

  clear(): void {
    this.cells.clear();
    this.cols.clear();
    this.tree.clear();
    this.treeCols.clear();
    this.wide.clear();
    this.bounds.clear();
    this.links.clear();
  }
}
