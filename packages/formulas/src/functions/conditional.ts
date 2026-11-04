// Agregations conditionnelles (NB.SI, SOMME.SI.ENS...) et SOUS.TOTAL / AGREGAT.
import { effectiveArea, toMatrix, toNumber, toScalar } from '../eval/coerce.ts';
import { makeCriterion } from '../eval/criteria.ts';
import { RefValue, type EvalContext } from '../eval/types.ts';
import { ERR, FormulaError, Matrix, type Scalar } from '../values.ts';
import { percentileExc, percentileInc, sorted } from './numeric.ts';
import { define, type Arg } from './registry.ts';
import { avg, maxOf, medianOf, minOf, modeOf, productOf, stdevP, stdevS, varP, varS } from './stats.ts';

/** Masque des cellules satisfaisant tous les couples (plage, critere). */
function criteriaMask(pairs: [Arg, Arg][], ctx: EvalContext): { mask: boolean[]; rows: number; cols: number } | FormulaError {
  let mask: boolean[] | undefined;
  let rows = 0;
  let cols = 0;
  for (const [range, crit] of pairs) {
    const m = toMatrix(range, ctx);
    if (m instanceof FormulaError) return m;
    if (!mask) {
      rows = m.rows;
      cols = m.cols;
      mask = new Array<boolean>(m.data.length).fill(true);
    } else if (m.rows !== rows || m.cols !== cols) return ERR.VALUE;
    const test = makeCriterion(toScalar(crit, ctx), ctx);
    for (let i = 0; i < m.data.length; i++) if (mask[i] && !test(m.data[i] ?? null)) mask[i] = false;
  }
  return mask ? { mask, rows, cols } : ERR.VALUE;
}

/** Plage de valeurs alignee sur la plage de criteres (coin superieur gauche + memes dimensions). */
function alignedValues(values: Arg, rows: number, cols: number, ctx: EvalContext): Matrix | FormulaError {
  if (values instanceof RefValue) {
    const a = values.areas[0];
    if (!a || values.areas.length !== 1) return ERR.VALUE;
    return toMatrix(new RefValue([{ sheet: a.sheet, r1: a.r1, c1: a.c1, r2: a.r1 + rows - 1, c2: a.c1 + cols - 1 }]), ctx);
  }
  const m = toMatrix(values, ctx);
  if (m instanceof FormulaError) return m;
  return m.rows === rows && m.cols === cols ? m : ERR.VALUE;
}

function selectedNumbers(values: Matrix, mask: boolean[]): number[] | FormulaError {
  const out: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const v = values.data[i] ?? null;
    if (v instanceof FormulaError) return v;
    if (typeof v === 'number') out.push(v);
  }
  return out;
}

function pairsFrom(args: Arg[], start: number): [Arg, Arg][] {
  const pairs: [Arg, Arg][] = [];
  for (let i = start; i + 1 < args.length; i += 2) pairs.push([args[i], args[i + 1]]);
  return pairs;
}

define('stats', 'COUNTIF', { min: 2, max: 2, kinds: 'RS' }, ([r, c], ctx) => {
  const m = criteriaMask([[r, c]], ctx);
  return m instanceof FormulaError ? m : m.mask.filter(Boolean).length;
});
define('stats', 'COUNTIFS', { min: 2, max: 254, kinds: 'RS+' }, (args, ctx) => {
  if (args.length % 2) return ERR.VALUE;
  const m = criteriaMask(pairsFrom(args, 0), ctx);
  return m instanceof FormulaError ? m : m.mask.filter(Boolean).length;
});

function ifAgg(name: string, f: (xs: number[]) => number | FormulaError): void {
  define(name === 'SUMIF' ? 'math' : 'stats', name, { min: 2, max: 3, kinds: 'RSR' }, ([r, c, v], ctx) => {
    const m = criteriaMask([[r, c]], ctx);
    if (m instanceof FormulaError) return m;
    const vals = alignedValues(v === undefined ? r : v, m.rows, m.cols, ctx);
    if (vals instanceof FormulaError) return vals;
    const xs = selectedNumbers(vals, m.mask);
    return xs instanceof FormulaError ? xs : f(xs);
  });
}
function ifsAgg(name: string, f: (xs: number[]) => number | FormulaError): void {
  define(name === 'SUMIFS' ? 'math' : 'stats', name, { min: 3, max: 255, kinds: 'RRS+' }, (args, ctx) => {
    if (args.length % 2 === 0) return ERR.VALUE;
    const m = criteriaMask(pairsFrom(args, 1), ctx);
    if (m instanceof FormulaError) return m;
    const vals = alignedValues(args[0], m.rows, m.cols, ctx);
    if (vals instanceof FormulaError) return vals;
    const xs = selectedNumbers(vals, m.mask);
    return xs instanceof FormulaError ? xs : f(xs);
  });
}
const total = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
ifAgg('SUMIF', total);
ifAgg('AVERAGEIF', avg);
ifsAgg('SUMIFS', total);
ifsAgg('AVERAGEIFS', avg);
ifsAgg('MAXIFS', maxOf);
ifsAgg('MINIFS', minOf);

// ---------- SOUS.TOTAL et AGREGAT ----------

interface Gathered {
  numbers: number[];
  nonEmpty: number;
}

function isNestedAggregate(ctx: EvalContext, sheet: number, row: number, col: number): boolean {
  const f = ctx.wb.formulaText(sheet, row, col);
  return f !== undefined && /\b(SUBTOTAL|AGGREGATE)\s*\(/i.test(f);
}

function gather(
  refs: Arg[],
  ctx: EvalContext,
  opt: { skipNested: boolean; skipHidden: boolean; skipErrors: boolean },
): Gathered | FormulaError {
  const out: Gathered = { numbers: [], nonEmpty: 0 };
  let error: FormulaError | undefined;
  const take = (v: Scalar): boolean => {
    if (v instanceof FormulaError) {
      if (opt.skipErrors) return false;
      error = v;
      return true;
    }
    if (v !== null) out.nonEmpty++;
    if (typeof v === 'number') out.numbers.push(v);
    return false;
  };
  for (const ref of refs) {
    if (ref instanceof RefValue) {
      for (const area of ref.areas) {
        ctx.wb.forEachCell(effectiveArea(area, ctx), (r, c, v) => {
          if (opt.skipNested && isNestedAggregate(ctx, area.sheet, r, c)) return false;
          if (opt.skipHidden && ctx.wb.rowHidden?.(area.sheet, r)) return false;
          return take(v);
        });
        if (error) return error;
      }
    } else {
      const m = toMatrix(ref, ctx);
      if (m instanceof FormulaError) return m;
      for (const v of m.data) if (take(v)) return error ?? ERR.VALUE;
    }
  }
  return out;
}

function applyBasic(fn: number, g: Gathered): number | FormulaError {
  const xs = g.numbers;
  switch (fn) {
    case 1:
      return avg(xs);
    case 2:
      return xs.length;
    case 3:
      return g.nonEmpty;
    case 4:
      return maxOf(xs);
    case 5:
      return minOf(xs);
    case 6:
      return productOf(xs);
    case 7:
      return stdevS(xs);
    case 8:
      return stdevP(xs);
    case 9:
      return total(xs);
    case 10:
      return varS(xs);
    case 11:
      return varP(xs);
    case 12:
      return medianOf(xs);
    case 13:
      return modeOf(xs);
    default:
      return ERR.VALUE;
  }
}

define('math', 'SUBTOTAL', { min: 2, max: 255, kinds: 'SR' }, (args, ctx) => {
  const f = toNumber(args[0], ctx);
  if (f instanceof FormulaError) return f;
  const code = Math.trunc(f);
  const fn = code > 100 ? code - 100 : code;
  if (fn < 1 || fn > 11) return ERR.VALUE;
  const g = gather(args.slice(1), ctx, { skipNested: true, skipHidden: code > 100, skipErrors: false });
  return g instanceof FormulaError ? g : applyBasic(fn, g);
});

define('math', 'AGGREGATE', { min: 3, max: 255, kinds: 'SSR' }, (args, ctx) => {
  const f = toNumber(args[0], ctx);
  const o = toNumber(args[1], ctx);
  if (f instanceof FormulaError) return f;
  if (o instanceof FormulaError) return o;
  const fn = Math.trunc(f);
  const opt = Math.trunc(o);
  if (fn < 1 || fn > 19 || opt < 0 || opt > 7) return ERR.VALUE;
  const flags = {
    skipNested: opt <= 3,
    skipHidden: opt === 1 || opt === 3 || opt === 5 || opt === 7,
    skipErrors: opt === 2 || opt === 3 || opt === 6 || opt === 7,
  };
  if (fn <= 13) {
    const g = gather(args.slice(2), ctx, flags);
    return g instanceof FormulaError ? g : applyBasic(fn, g);
  }
  const g = gather([args[2]], ctx, flags);
  if (g instanceof FormulaError) return g;
  const kv = toNumber(args[3], ctx);
  if (kv instanceof FormulaError) return kv;
  const s = sorted(g.numbers);
  if (s.length === 0) return ERR.NUM;
  let r: number;
  switch (fn) {
    case 14:
    case 15: {
      const k = Math.ceil(kv);
      if (k < 1 || k > s.length) return ERR.NUM;
      r = (fn === 14 ? s[s.length - k] : s[k - 1]) ?? NaN;
      break;
    }
    case 16:
      if (kv < 0 || kv > 1) return ERR.NUM;
      r = percentileInc(s, kv);
      break;
    case 17:
      if (kv < 0 || kv > 4) return ERR.NUM;
      r = percentileInc(s, Math.trunc(kv) / 4);
      break;
    case 18:
      r = percentileExc(s, kv);
      break;
    default:
      r = percentileExc(s, Math.trunc(kv) / 4);
  }
  return Number.isNaN(r) ? ERR.NUM : r;
});
