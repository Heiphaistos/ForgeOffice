// Base de donnees : BDSOMME, BCOMPTE, BDMOYENNE, BDLIRE... (base = plage avec ligne d'en-tetes).
import { compareText, textToNumber, toMatrix, toText } from '../eval/coerce.ts';
import { makeCriterion, type Criterion } from '../eval/criteria.ts';
import type { EvalContext } from '../eval/types.ts';
import { ERR, FormulaError, Matrix, type Scalar } from '../values.ts';
import { define, type Arg } from './registry.ts';
import { avg, maxOf, minOf, productOf, stdevP, stdevS, varP, varS } from './stats.ts';

const DB = 'database' as const;

function headerIndex(m: Matrix, label: string): number {
  for (let c = 0; c < m.cols; c++) {
    const h = m.get(0, c);
    if (h !== null && compareText(String(h).trim(), label.trim()) === 0) return c;
  }
  return -1;
}

/** Colonne designee par son en-tete ou son numero (base 1) ; -1 si le champ est omis. */
function fieldIndex(db: Matrix, f: Arg, ctx: EvalContext): number | FormulaError {
  if (f === undefined || f === null) return -1;
  if (typeof f === 'number') {
    const i = Math.trunc(f) - 1;
    return i >= 0 && i < db.cols ? i : ERR.VALUE;
  }
  const t = toText(f, ctx);
  if (t instanceof FormulaError) return t;
  const i = headerIndex(db, t);
  return i < 0 ? ERR.VALUE : i;
}

/** Critere de base de donnees : un texte simple vaut « commence par ». */
function dbCriterion(v: Scalar, ctx: EvalContext): Criterion {
  if (typeof v === 'string' && !/^[<>=]/.test(v) && textToNumber(v, ctx) === undefined && v !== '') {
    return makeCriterion(`${v}*`, ctx);
  }
  return makeCriterion(v, ctx);
}

/** Lignes (index dans la base, en-tete exclu) qui satisfont au moins une ligne de criteres. */
function matchingRows(db: Matrix, crit: Matrix, ctx: EvalContext): number[] | FormulaError {
  const rules: { col: number; test: Criterion }[][] = [];
  for (let r = 1; r < crit.rows; r++) {
    const rule: { col: number; test: Criterion }[] = [];
    for (let c = 0; c < crit.cols; c++) {
      const v = crit.get(r, c);
      if (v === null || v === '') continue;
      const h = crit.get(0, c);
      const col = h === null ? -1 : headerIndex(db, String(h));
      if (col < 0) return ERR.VALUE;
      rule.push({ col, test: dbCriterion(v, ctx) });
    }
    rules.push(rule);
  }
  if (rules.length === 0) rules.push([]);
  const out: number[] = [];
  for (let r = 1; r < db.rows; r++) {
    if (rules.some((rule) => rule.every((x) => x.test(db.get(r, x.col))))) out.push(r);
  }
  return out;
}

function prepare(
  [d, f, c]: Arg[],
  ctx: EvalContext,
): { db: Matrix; field: number; rows: number[] } | FormulaError {
  const db = toMatrix(d, ctx);
  if (db instanceof FormulaError) return db;
  const crit = toMatrix(c, ctx);
  if (crit instanceof FormulaError) return crit;
  if (db.rows < 1 || crit.rows < 2) return ERR.VALUE;
  const field = fieldIndex(db, f, ctx);
  if (field instanceof FormulaError) return field;
  const rows = matchingRows(db, crit, ctx);
  return rows instanceof FormulaError ? rows : { db, field, rows };
}

function dbAgg(name: string, f: (xs: number[]) => number | FormulaError): void {
  define(DB, name, { min: 3, kinds: 'VSV' }, (args, ctx) => {
    const p = prepare(args, ctx);
    if (p instanceof FormulaError) return p;
    if (p.field < 0) return ERR.VALUE;
    const xs: number[] = [];
    for (const r of p.rows) {
      const v = p.db.get(r, p.field);
      if (typeof v === 'number') xs.push(v);
    }
    return f(xs);
  });
}
dbAgg('DSUM', (xs) => xs.reduce((a, b) => a + b, 0));
dbAgg('DAVERAGE', avg);
dbAgg('DMAX', maxOf);
dbAgg('DMIN', minOf);
dbAgg('DPRODUCT', productOf);
dbAgg('DSTDEV', stdevS);
dbAgg('DSTDEVP', stdevP);
dbAgg('DVAR', varS);
dbAgg('DVARP', varP);

function dbCount(name: string, keep: (v: Scalar) => boolean): void {
  define(DB, name, { min: 3, kinds: 'VSV' }, (args, ctx) => {
    const p = prepare(args, ctx);
    if (p instanceof FormulaError) return p;
    if (p.field < 0) return p.rows.length;
    return p.rows.filter((r) => keep(p.db.get(r, p.field))).length;
  });
}
dbCount('DCOUNT', (v) => typeof v === 'number');
dbCount('DCOUNTA', (v) => v !== null && v !== '');

define(DB, 'DGET', { min: 3, kinds: 'VSV' }, (args, ctx) => {
  const p = prepare(args, ctx);
  if (p instanceof FormulaError) return p;
  if (p.field < 0 || p.rows.length === 0) return ERR.VALUE;
  if (p.rows.length > 1) return ERR.NUM;
  return p.db.get(p.rows[0] ?? 0, p.field);
});

