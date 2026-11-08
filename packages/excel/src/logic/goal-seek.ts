// Valeur cible : trouve la valeur d'une cellule variable pour qu'une cellule formule atteigne un resultat (secante, puis bissection).
import type { CellAddress, Workbook } from '@forgeoffice/xlsx';
import { WorkbookEngine } from './engine.ts';

export interface GoalResult {
  found: boolean;
  /** Valeur de la cellule variable. */
  x: number;
  /** Resultat de la formule pour `x`. */
  value: number;
  iterations: number;
}

/** Resout f(x) = target a partir de x0. `f` renvoie null si le calcul est invalide. */
export function solve(f: (x: number) => number | null, target: number, x0: number, maxIter = 100, tol = 1e-9): GoalResult {
  let iterations = 0;
  const g = (x: number): number | null => {
    iterations++;
    const v = f(x);
    return v === null ? null : v - target;
  };
  const near = (v: number): boolean => Math.abs(v) <= tol * Math.max(1, Math.abs(target));
  let a = x0;
  let ga = g(a);
  if (ga === null) return { found: false, x: a, value: NaN, iterations };
  if (near(ga)) return { found: true, x: a, value: ga + target, iterations };
  let b = x0 === 0 ? 1 : x0 * 1.1 + 0.1;
  let gb = g(b);
  for (let k = 0; k < maxIter && gb !== null; k++) {
    if (near(gb)) return { found: true, x: b, value: gb + target, iterations };
    if (gb === ga) break;
    const c = b - (gb * (b - a)) / (gb - ga);
    a = b;
    ga = gb;
    b = c;
    gb = g(b);
  }
  if (gb !== null && near(gb)) return { found: true, x: b, value: gb + target, iterations };
  // Repli : recherche d'un encadrement autour de x0 puis bissection.
  let lo = x0 - 1;
  let hi = x0 + 1;
  for (let s = 0; s < 40; s++) {
    const glo = g(lo);
    const ghi = g(hi);
    if (glo !== null && ghi !== null && glo * ghi <= 0) {
      for (let k = 0; k < 200; k++) {
        const mid = (lo + hi) / 2;
        const gm = g(mid);
        if (gm === null) break;
        if (near(gm)) return { found: true, x: mid, value: gm + target, iterations };
        if ((glo ?? 0) * gm <= 0) hi = mid;
        else lo = mid;
      }
      break;
    }
    const w = (hi - lo) * 2;
    lo = x0 - w;
    hi = x0 + w;
  }
  return { found: false, x: b, value: gb === null ? NaN : gb + target, iterations };
}

/** Copie du classeur ou la cellule variable vaut `x` (sans formule). */
function withValue(wb: Workbook, si: number, at: CellAddress, x: number): Workbook {
  return {
    ...wb,
    sheets: wb.sheets.map((s, i) => {
      if (i !== si) return s;
      const cells = new Map(s.cells);
      const line = new Map(cells.get(at.row) ?? []);
      const old = line.get(at.col);
      const { formula: _f, ...rest } = old ?? { value: null };
      line.set(at.col, { ...rest, value: x });
      cells.set(at.row, line);
      return { ...s, cells };
    }),
  };
}

/** Valeur cible sur le classeur : `formula` doit atteindre `target` en faisant varier `changing` (meme feuille `si`). */
export function goalSeek(wb: Workbook, si: number, formula: CellAddress, target: number, changing: CellAddress): GoalResult {
  const name = wb.sheets[si]?.name ?? '';
  const start = wb.sheets[si]?.cells.get(changing.row)?.get(changing.col)?.value;
  const engine = new WorkbookEngine(wb.date1904);
  return solve((x) => {
    engine.sync(withValue(wb, si, changing, x));
    const v = engine.value(name, formula.row, formula.col);
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }, target, typeof start === 'number' ? start : 0);
}
