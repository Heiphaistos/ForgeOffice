// Aides communes aux bibliotheques de fonctions.
import { toMatrix } from '../eval/coerce.ts';
import type { EvalContext, EvalValue } from '../eval/types.ts';
import { ERR, FormulaError, Matrix, type Scalar } from '../values.ts';

/** Matrice numerique stricte (MMULT, MDETERM...) : toute valeur non numerique -> #VALEUR!. */
export function numericMatrix(a: EvalValue | undefined, ctx: EvalContext): number[][] | FormulaError {
  const m = toMatrix(a, ctx);
  if (m instanceof FormulaError) return m;
  const out: number[][] = [];
  for (let r = 0; r < m.rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < m.cols; c++) {
      const v = m.get(r, c);
      if (v instanceof FormulaError) return v;
      if (typeof v !== 'number') return ERR.VALUE;
      row.push(v);
    }
    out.push(row);
  }
  return out;
}

export function fromRows(rows: number[][]): Matrix {
  return Matrix.from2D(rows);
}

/** Valeurs d'une matrice en liste (ordre ligne par ligne). */
export function flatValues(a: EvalValue | undefined, ctx: EvalContext): Scalar[] | FormulaError {
  const m = toMatrix(a, ctx);
  return m instanceof FormulaError ? m : m.data;
}

/** Premiere erreur d'une liste de valeurs. */
export function firstError(...vs: unknown[]): FormulaError | undefined {
  for (const v of vs) if (v instanceof FormulaError) return v;
  return undefined;
}

/** Paires de nombres de deux plages de meme taille (les paires incompletes sont ignorees). */
export function numberPairs(
  a: EvalValue | undefined,
  b: EvalValue | undefined,
  ctx: EvalContext,
  sizeError: FormulaError = ERR.NA,
): { x: number[]; y: number[] } | FormulaError {
  const ma = toMatrix(a, ctx);
  if (ma instanceof FormulaError) return ma;
  const mb = toMatrix(b, ctx);
  if (mb instanceof FormulaError) return mb;
  if (ma.data.length !== mb.data.length) return sizeError;
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < ma.data.length; i++) {
    const u = ma.data[i] ?? null;
    const v = mb.data[i] ?? null;
    if (u instanceof FormulaError) return u;
    if (v instanceof FormulaError) return v;
    if (typeof u === 'number' && typeof v === 'number') {
      x.push(u);
      y.push(v);
    }
  }
  return { x, y };
}

export function isNum(v: unknown): v is number {
  return typeof v === 'number';
}
