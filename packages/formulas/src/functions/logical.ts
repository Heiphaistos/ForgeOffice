// Fonctions logiques, LET, LAMBDA et fonctions d'ordre superieur (MAP, REDUCE, SCAN, BYROW, BYCOL, MAKEARRAY).
import { deref, forEachValue, toBool, toMatrix, toNumber, toScalar } from '../eval/coerce.ts';
import { broadcast, isOmitted } from '../eval/evaluator.ts';
import { LambdaValue, type EvalContext, type EvalValue, type Evaluator, type Scope } from '../eval/types.ts';
import type { Node } from '../parse/ast.ts';
import { canonicalIdentifier } from '../parse/syntax.ts';
import { ERR, FormulaError, Matrix, type Scalar, type Value } from '../values.ts';
import { define, defineLazy, type Arg } from './registry.ts';

function cond(v: Scalar, ctx: EvalContext): boolean | FormulaError {
  return toBool(v, ctx);
}

defineLazy('logical', 'IF', { min: 1, max: 3 }, (nodes, ctx, ev) => {
  const [c, t, f] = nodes;
  if (!c) return ERR.VALUE;
  const test = deref(ev.evaluate(c, ctx), ctx);
  const branch = (b: boolean): EvalValue => {
    const n = b ? t : f;
    if (!n) return b ? true : false;
    return ev.evaluate(n, ctx);
  };
  if (!(test instanceof Matrix)) {
    const b = cond(test, ctx);
    return b instanceof FormulaError ? b : branch(b);
  }
  const tv = deref(branch(true), ctx);
  const fv = deref(branch(false), ctx);
  return broadcast([test, tv, fv], ([x, y, z]) => {
    const b = cond(x ?? null, ctx);
    return b instanceof FormulaError ? b : b ? (y ?? null) : (z ?? null);
  });
});

defineLazy('logical', 'IFS', { min: 2, max: 254 }, (nodes, ctx, ev) => {
  if (nodes.length % 2) return ERR.VALUE;
  for (let i = 0; i < nodes.length; i += 2) {
    const cn = nodes[i];
    const vn = nodes[i + 1];
    if (!cn || !vn) return ERR.VALUE;
    const test = deref(ev.evaluate(cn, ctx), ctx);
    if (test instanceof Matrix) {
      const vals = nodes.map((n) => deref(ev.evaluate(n, ctx), ctx));
      return broadcast(vals, (xs) => {
        for (let k = 0; k < xs.length; k += 2) {
          const b = cond(xs[k] ?? null, ctx);
          if (b instanceof FormulaError) return b;
          if (b) return xs[k + 1] ?? null;
        }
        return ERR.NA;
      });
    }
    const b = cond(test, ctx);
    if (b instanceof FormulaError) return b;
    if (b) return ev.evaluate(vn, ctx);
  }
  return ERR.NA;
});

function onError(onlyNA: boolean) {
  return (nodes: Node[], ctx: EvalContext, ev: Evaluator): EvalValue => {
    const [vn, an] = nodes;
    if (!vn || !an) return ERR.VALUE;
    const v = ev.evaluate(vn, ctx);
    const hit = (x: unknown): boolean => x instanceof FormulaError && (!onlyNA || x.code === '#N/A');
    const d = deref(v, ctx);
    if (d instanceof Matrix) {
      if (!d.data.some(hit)) return d;
      const alt = deref(ev.evaluate(an, ctx), ctx);
      return broadcast([d, alt], ([x, y]) => (hit(x) ? (y ?? null) : (x ?? null)));
    }
    return hit(d) ? ev.evaluate(an, ctx) : v;
  };
}
defineLazy('logical', 'IFERROR', { min: 2, max: 2 }, onError(false));
defineLazy('logical', 'IFNA', { min: 2, max: 2 }, onError(true));

defineLazy('logical', 'SWITCH', { min: 3, max: 254 }, (nodes, ctx, ev) => {
  const [en, ...rest] = nodes;
  if (!en) return ERR.VALUE;
  const e = deref(ev.evaluate(en, ctx), ctx);
  const hasDefault = rest.length % 2 === 1;
  if (e instanceof Matrix) {
    const vals = rest.map((n) => deref(ev.evaluate(n, ctx), ctx));
    return broadcast([e, ...vals], ([x, ...vs]) => {
      if (x instanceof FormulaError) return x;
      for (let k = 0; k + 1 < vs.length; k += 2) if (equalScalars(x ?? null, vs[k] ?? null)) return vs[k + 1] ?? null;
      return hasDefault ? (vs[vs.length - 1] ?? null) : ERR.NA;
    });
  }
  if (e instanceof FormulaError) return e;
  for (let k = 0; k + 1 < rest.length; k += 2) {
    const cn = rest[k];
    const rn = rest[k + 1];
    if (!cn || !rn) break;
    const c = toScalar(ev.evaluate(cn, ctx), ctx);
    if (c instanceof FormulaError) return c;
    if (equalScalars(e, c)) return ev.evaluate(rn, ctx);
  }
  const last = rest[rest.length - 1];
  return hasDefault && last ? ev.evaluate(last, ctx) : ERR.NA;
});

function equalScalars(a: Scalar, b: Scalar): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a.toUpperCase() === b.toUpperCase();
  return a === b || (a === null && b === 0) || (a === 0 && b === null);
}

defineLazy('lookup', 'CHOOSE', { min: 2, max: 255 }, (nodes, ctx, ev) => {
  const [inode, ...vals] = nodes;
  if (!inode) return ERR.VALUE;
  const idx = deref(ev.evaluate(inode, ctx), ctx);
  if (idx instanceof Matrix) {
    const vs = vals.map((n) => deref(ev.evaluate(n, ctx), ctx));
    return broadcast([idx, ...vs], ([i, ...xs]) => {
      const n = toNumber(i ?? null, ctx);
      if (n instanceof FormulaError) return n;
      const k = Math.trunc(n);
      return k < 1 || k > xs.length ? ERR.VALUE : (xs[k - 1] ?? null);
    });
  }
  const n = toNumber(idx, ctx);
  if (n instanceof FormulaError) return n;
  const k = Math.trunc(n);
  const node = vals[k - 1];
  if (k < 1 || !node) return ERR.VALUE;
  return ev.evaluate(node, ctx);
});

function logicalFold(name: string, f: (trues: number, count: number) => boolean): void {
  define('logical', name, { min: 1, max: 255, kinds: 'R' }, (args, ctx) => {
    let trues = 0;
    let count = 0;
    let error: FormulaError | undefined;
    for (const a of args) {
      forEachValue(a, ctx, (v, direct) => {
        if (v instanceof FormulaError) {
          error = v;
          return true;
        }
        if (typeof v === 'boolean' || typeof v === 'number') {
          count++;
          if (v) trues++;
        } else if (typeof v === 'string' && direct) {
          const b = toBool(v, ctx);
          if (b instanceof FormulaError) {
            error = b;
            return true;
          }
          count++;
          if (b) trues++;
        }
        return false;
      });
      if (error) return error;
    }
    return count === 0 ? ERR.VALUE : f(trues, count);
  });
}
logicalFold('AND', (t, n) => t === n);
logicalFold('OR', (t) => t > 0);
logicalFold('XOR', (t) => t % 2 === 1);
define('logical', 'NOT', { min: 1 }, ([a], ctx) => {
  const b = toBool(a, ctx);
  return b instanceof FormulaError ? b : !b;
});
define('logical', 'TRUE', { min: 0 }, () => true);
define('logical', 'FALSE', { min: 0 }, () => false);

// ---------- LET / LAMBDA ----------

function paramName(n: Node | undefined): string | undefined {
  return n?.type === 'name' && n.sheet === undefined ? canonicalIdentifier(n.name).toUpperCase() : undefined;
}

defineLazy('logical', 'LET', { min: 3, max: 253 }, (nodes, ctx, ev) => {
  if (nodes.length % 2 === 0) return ERR.VALUE;
  const scope: Scope = { vars: new Map(), omitted: new Set(), parent: ctx.scope };
  const inner: EvalContext = { ...ctx, scope };
  for (let i = 0; i + 1 < nodes.length; i += 2) {
    const name = paramName(nodes[i]);
    const vn = nodes[i + 1];
    if (!name || !vn) return ERR.VALUE;
    scope.vars.set(name, ev.evaluate(vn, inner));
  }
  const body = nodes[nodes.length - 1];
  return body ? ev.evaluate(body, inner) : ERR.VALUE;
});

defineLazy('logical', 'LAMBDA', { min: 1, max: 254 }, (nodes, ctx) => {
  const params: string[] = [];
  for (const p of nodes.slice(0, -1)) {
    const n = paramName(p);
    if (!n || params.includes(n)) return ERR.VALUE;
    params.push(n);
  }
  return new LambdaValue(params, nodes[nodes.length - 1], ctx.scope);
});

defineLazy('logical', 'ISOMITTED', { min: 1, max: 1 }, (nodes, ctx) => {
  const n = paramName(nodes[0]);
  return n ? isOmitted(ctx.scope, n) : false;
});

function lambdaArg(a: Arg): LambdaValue | FormulaError {
  if (a instanceof LambdaValue) return a;
  return a instanceof FormulaError ? a : ERR.VALUE;
}

function scalarResult(v: EvalValue, ctx: EvalContext): Scalar {
  const d = deref(v, ctx);
  if (d instanceof Matrix) return d.rows === 1 && d.cols === 1 ? d.get(0, 0) : ERR.CALC;
  return d;
}

define('logical', 'MAP', { min: 2, max: 254, kinds: 'R' }, (args, ctx, ev) => {
  const fn = lambdaArg(args[args.length - 1]);
  if (fn instanceof FormulaError) return fn;
  const mats: Matrix[] = [];
  for (const a of args.slice(0, -1)) {
    const m = toMatrix(a, ctx);
    if (m instanceof FormulaError) return m;
    mats.push(m);
  }
  return broadcast(mats, (xs) => scalarResult(ev.callLambda(fn, xs, ctx), ctx));
});

function reduceLike(scan: boolean) {
  return (args: Arg[], ctx: EvalContext, ev: Evaluator): EvalValue => {
    const hasInit = args.length === 3;
    const fn = lambdaArg(args[args.length - 1]);
    if (fn instanceof FormulaError) return fn;
    const m = toMatrix(args[hasInit ? 1 : 0], ctx);
    if (m instanceof FormulaError) return m;
    let acc: EvalValue = hasInit ? deref(args[0], ctx) : null;
    const out: Scalar[] = [];
    for (const v of m.data) {
      acc = deref(ev.callLambda(fn, [acc ?? 0, v], ctx), ctx);
      if (scan) out.push(scalarResult(acc, ctx));
    }
    return scan ? new Matrix(m.rows, m.cols, out) : acc;
  };
}
define('logical', 'REDUCE', { min: 2, max: 3, kinds: 'R' }, reduceLike(false));
define('logical', 'SCAN', { min: 2, max: 3, kinds: 'R' }, reduceLike(true));

function byLine(rows: boolean) {
  return ([a, f]: Arg[], ctx: EvalContext, ev: Evaluator): Value => {
    const fn = lambdaArg(f);
    if (fn instanceof FormulaError) return fn;
    const m = toMatrix(a, ctx);
    if (m instanceof FormulaError) return m;
    const n = rows ? m.rows : m.cols;
    const out: Scalar[] = [];
    for (let i = 0; i < n; i++) {
      const line = rows ? Matrix.row(m.rowAt(i)) : Matrix.column(m.colAt(i));
      out.push(scalarResult(ev.callLambda(fn, [line], ctx), ctx));
    }
    return rows ? Matrix.column(out) : Matrix.row(out);
  };
}
define('logical', 'BYROW', { min: 2, max: 2, kinds: 'R' }, byLine(true));
define('logical', 'BYCOL', { min: 2, max: 2, kinds: 'R' }, byLine(false));

define('logical', 'MAKEARRAY', { min: 3, max: 3, kinds: 'SSR' }, ([r, c, f], ctx, ev) => {
  const fn = lambdaArg(f);
  if (fn instanceof FormulaError) return fn;
  const rows = toNumber(r, ctx);
  const cols = toNumber(c, ctx);
  if (rows instanceof FormulaError) return rows;
  if (cols instanceof FormulaError) return cols;
  const nr = Math.trunc(rows);
  const nc = Math.trunc(cols);
  if (nr < 1 || nc < 1 || nr * nc > 1_048_576) return ERR.VALUE;
  const out: Scalar[] = [];
  for (let i = 1; i <= nr; i++) for (let j = 1; j <= nc; j++) out.push(scalarResult(ev.callLambda(fn, [i, j], ctx), ctx));
  return new Matrix(nr, nc, out);
});
