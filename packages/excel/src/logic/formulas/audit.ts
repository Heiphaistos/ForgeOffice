// Repérage des antecedents et des dependants (Formules > Verification des formules) : fleches multi-niveaux, antecedents ou dependants
// situes sur d'autres feuilles (fleche pointillee depuis une icone de feuille), suppression niveau par niveau.
import type { TracedArea } from '@forgeoffice/formulas';
import type { CellRange } from '@forgeoffice/xlsx';

export type TraceDir = 'prec' | 'dep';

export interface TraceArrow {
  /** Cellules d'origine de la fleche (plage ou cellule). */
  from: CellRange;
  /** Cellule d'arrivee. */
  to: { row: number; col: number };
  dir: TraceDir;
  /** Cellule active au moment du reperage : les niveaux se comptent par cellule d'origine et par direction. */
  origin: { row: number; col: number };
  /** 1 = voisins directs de la cellule active, 2 = leurs voisins... */
  level: number;
  /** Autre feuille : la fleche part ou arrive sur une icone de feuille. */
  external?: boolean;
}

/** Partie du moteur utile au reperage (FormulaEngine y satisfait). */
export interface TraceSource {
  precedentsOf: (sheet: string, address: { row: number; col: number }) => TracedArea[];
  dependentsOf: (sheet: string, address: { row: number; col: number }) => { sheet: string; row: number; col: number }[];
}

/** Cellules examinees au plus par niveau (une zone de milliers de cellules ne multiplie pas les fleches). */
const MAX_SEEDS = 300;

const cell = (row: number, col: number): CellRange => ({ r1: row, c1: col, r2: row, c2: col });
const sameCell = (a: { row: number; col: number }, b: { row: number; col: number }): boolean => a.row === b.row && a.col === b.col;
const same = (a: TraceArrow, b: TraceArrow): boolean =>
  a.dir === b.dir && sameCell(a.origin, b.origin) && a.to.row === b.to.row && a.to.col === b.to.col && !!a.external === !!b.external
  && a.from.r1 === b.from.r1 && a.from.c1 === b.from.c1 && a.from.r2 === b.from.r2 && a.from.c2 === b.from.c2;

function cellsOf(r: CellRange, out: { row: number; col: number }[]): void {
  for (let row = r.r1; row <= r.r2 && out.length < MAX_SEEDS; row++) for (let col = r.c1; col <= r.c2 && out.length < MAX_SEEDS; col++) out.push({ row, col });
}

/** Niveau le plus eloigne deja trace dans une direction pour la cellule d'origine (0 si aucune fleche). */
export function traceLevel(arrows: readonly TraceArrow[], dir: TraceDir, origin: { row: number; col: number }): number {
  return arrows.reduce((m, a) => (a.dir === dir && sameCell(a.origin, origin) ? Math.max(m, a.level) : m), 0);
}

export interface TraceResult {
  arrows: TraceArrow[];
  /** Fleches ajoutees par ce clic (0 : rien a repérer). */
  added: number;
  /** Au moins une fleche part ou arrive sur une autre feuille. */
  external: boolean;
}

/** Un clic sur « Reperer les antecedents / dependants » : ajoute le niveau suivant. */
export function traceStep(arrows: readonly TraceArrow[], dir: TraceDir, active: { row: number; col: number }, sheet: string, src: TraceSource): TraceResult {
  const level = traceLevel(arrows, dir, active);
  const seeds: { row: number; col: number }[] = [];
  if (level === 0) seeds.push(active);
  else {
    for (const a of arrows) {
      if (a.dir !== dir || a.level !== level || a.external || !sameCell(a.origin, active)) continue;
      if (dir === 'prec') cellsOf(a.from, seeds);
      else seeds.push(a.to);
    }
  }
  const out = [...arrows];
  let added = 0;
  let external = false;
  const push = (a: TraceArrow): void => {
    if (out.some((b) => same(a, b))) return;
    out.push(a);
    added++;
    if (a.external) external = true;
  };
  for (const seed of seeds) {
    if (dir === 'prec') {
      for (const p of src.precedentsOf(sheet, seed)) {
        push({ from: { r1: p.r1, c1: p.c1, r2: p.r2, c2: p.c2 }, to: seed, dir, origin: active, level: level + 1, ...(p.sheet !== sheet ? { external: true } : {}) });
      }
    } else {
      for (const d of src.dependentsOf(sheet, seed)) {
        if (d.sheet !== sheet) push({ from: cell(seed.row, seed.col), to: seed, dir, origin: active, level: level + 1, external: true });
        else push({ from: cell(seed.row, seed.col), to: { row: d.row, col: d.col }, dir, origin: active, level: level + 1 });
      }
    }
  }
  return { arrows: out, added, external };
}

/** « Supprimer les fleches des antecedents / dependants » : retire le niveau le plus eloigne de la direction pour la cellule active. */
export function removeLevel(arrows: readonly TraceArrow[], dir: TraceDir, origin: { row: number; col: number }): TraceArrow[] {
  const level = traceLevel(arrows, dir, origin);
  return level === 0 ? [...arrows] : arrows.filter((a) => !(a.dir === dir && a.level === level && sameCell(a.origin, origin)));
}
