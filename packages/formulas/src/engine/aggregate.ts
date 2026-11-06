// Statistiques de colonne en cache (somme par blocs, effectif, erreurs) : totaux cumules `SUM($A$1:A1)` sur
// des dizaines de milliers de lignes sans relire toute la zone a chaque formule. Le cache grandit a la demande
// et ne lit jamais une ligne hors des zones demandees (sinon il creerait de fausses references circulaires).
import type { Area } from '../refs.ts';
import { FormulaError, type Scalar } from '../values.ts';

/** Lignes par bloc de sommes partielles. */
const BLOCK = 128;
/** En dessous de cette hauteur, la lecture directe est aussi rapide que le cache. */
export const MIN_ROWS = 512;

export interface NumberStats {
  sum: number;
  count: number;
}

/** Valeurs numeriques d'une colonne a partir de la ligne `start` (NaN = pas un nombre). */
export class ColumnStats {
  private start = 0;
  private vals: number[] = [];
  /** counts[i] = nombre de nombres avant l'indice i ; errs[i] idem pour les erreurs. */
  private counts: number[] = [0];
  private errs: number[] = [0];
  private blocks: number[] = [];
  /** blockPrefix[b] = somme des blocs complets < b (requetes qui commencent a la premiere ligne du cache). */
  private blockPrefix: number[] = [0];

  private get end(): number {
    return this.start + this.vals.length;
  }

  private reset(start: number): void {
    this.start = start;
    this.vals = [];
    this.counts = [0];
    this.errs = [0];
    this.blocks = [];
    this.blockPrefix = [0];
  }

  /** Oublie les lignes a partir de `row` (la cellule a change ou va changer). */
  truncate(row: number): void {
    if (row >= this.end) return;
    if (row <= this.start) return this.reset(this.start);
    const n = row - this.start;
    this.vals.length = n;
    this.counts.length = n + 1;
    this.errs.length = n + 1;
    const nb = Math.ceil(n / BLOCK);
    this.blocks.length = nb;
    this.blockPrefix.length = Math.min(this.blockPrefix.length, Math.floor(n / BLOCK) + 1);
    if (n % BLOCK !== 0) {
      let s = 0;
      for (let i = (nb - 1) * BLOCK; i < n; i++) {
        const v = this.vals[i] ?? NaN;
        if (v === v) s += v;
      }
      this.blocks[nb - 1] = s;
    }
  }

  private append(v: Scalar): void {
    const i = this.vals.length;
    let n = 0;
    let e = 0;
    let x = NaN;
    if (typeof v === 'number') {
      x = v;
      n = 1;
      this.blocks[Math.floor(i / BLOCK)] = (this.blocks[Math.floor(i / BLOCK)] ?? 0) + v;
    } else if (v instanceof FormulaError) e = 1;
    else if (i % BLOCK === 0) this.blocks[i / BLOCK] = 0;
    this.vals.push(x);
    if ((i + 1) % BLOCK === 0) this.blockPrefix.push((this.blockPrefix[this.blockPrefix.length - 1] ?? 0) + (this.blocks[Math.floor(i / BLOCK)] ?? 0));
    this.counts.push((this.counts[i] ?? 0) + n);
    this.errs.push((this.errs[i] ?? 0) + e);
  }

  /** Somme et effectif des lignes [r1, r2] ; undefined si la zone contient une erreur. */
  query(r1: number, r2: number, read: (row: number) => Scalar): NumberStats | undefined {
    if (this.vals.length === 0 || r1 < this.start || r1 > this.end) this.reset(r1);
    while (this.end <= r2) {
      const r = this.end;
      const v = read(r);
      if (this.end === r) this.append(v);
    }
    const i1 = r1 - this.start;
    const i2 = r2 - this.start;
    if (i2 >= this.vals.length) return undefined;
    if ((this.errs[i2 + 1] ?? 0) - (this.errs[i1] ?? 0) > 0) return undefined;
    const count = (this.counts[i2 + 1] ?? 0) - (this.counts[i1] ?? 0);
    const b1 = Math.ceil(i1 / BLOCK);
    const b2 = Math.floor((i2 + 1) / BLOCK);
    let sum = 0;
    const edge = (from: number, to: number): void => {
      for (let i = from; i < to; i++) {
        const v = this.vals[i] ?? NaN;
        if (v === v) sum += v;
      }
    };
    if (i1 === 0) {
      sum = this.blockPrefix[b2] ?? 0;
      edge(b2 * BLOCK, i2 + 1);
    } else if (b2 <= b1) edge(i1, i2 + 1);
    else {
      edge(i1, b1 * BLOCK);
      for (let b = b1; b < b2; b++) sum += this.blocks[b] ?? 0;
      edge(b2 * BLOCK, i2 + 1);
    }
    return { sum, count };
  }
}

/** Statistiques d'une zone (au plus 16 colonnes) a partir des caches de colonne ; undefined = lecture directe. */
export function areaStats(
  area: Area,
  cache: Map<number, ColumnStats>,
  rows: number,
  read: (col: number, row: number) => Scalar,
): NumberStats | undefined {
  const r2 = Math.min(area.r2, rows - 1);
  if (r2 - area.r1 + 1 < MIN_ROWS || area.c2 - area.c1 >= 16) return undefined;
  let sum = 0;
  let count = 0;
  for (let c = area.c1; c <= area.c2; c++) {
    let s = cache.get(c);
    if (!s) {
      s = new ColumnStats();
      cache.set(c, s);
    }
    const q = s.query(area.r1, r2, (r) => read(c, r));
    if (!q) return undefined;
    sum += q.sum;
    count += q.count;
  }
  return { sum, count };
}
