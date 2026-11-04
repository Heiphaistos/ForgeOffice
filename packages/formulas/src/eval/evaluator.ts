// Evaluation d'un arbre de formule : operateurs, references, noms, tableaux, fonctions, LAMBDA.
import { getFunction, kindAt, type Arg, type FnDef } from '../functions/registry.ts';
import type { BinaryOp, CallNode, Node, RefNode, TableNode } from '../parse/ast.ts';
import { canonicalIdentifier } from '../parse/syntax.ts';
import type { Area } from '../refs.ts';
import { ERR, FormulaError, Matrix, err, type Scalar, type Value } from '../values.ts';
import {
  MAX_TEXT,
  checkNum,
  compareScalars,
  deref,
  scalarToText,
  toNumber,
  toScalar,
} from './coerce.ts';
import { LambdaValue, RefValue, type EvalContext, type EvalValue, type Evaluator, type Scope } from './types.ts';

const MAX_CALL_DEPTH = 180;

function lookupScope(scope: Scope | undefined, name: string): EvalValue | undefined {
  for (let s = scope; s; s = s.parent) {
    const v = s.vars.get(name);
    if (v !== undefined) return v;
  }
  return undefined;
}

export function isOmitted(scope: Scope | undefined, name: string): boolean {
  for (let s = scope; s; s = s.parent) {
    if (s.vars.has(name)) return s.omitted.has(name);
  }
  return false;
}

function refValue(n: RefNode, ctx: EvalContext): EvalValue {
  if (n.sheetError || n.book !== undefined) return ERR.REF;
  let sheet = ctx.sheet;
  if (n.sheet !== undefined) {
    const id = ctx.wb.sheetId(n.sheet);
    if (id === undefined) return ERR.REF;
    sheet = id;
  }
  const box = {
    r1: Math.min(n.r1, n.r2),
    c1: Math.min(n.c1, n.c2),
    r2: Math.max(n.r1, n.r2),
    c2: Math.max(n.c1, n.c2),
  };
  if (n.sheet2 === undefined) return new RefValue([{ sheet, ...box }]);
  const id2 = ctx.wb.sheetId(n.sheet2);
  if (id2 === undefined) return ERR.REF;
  const order = ctx.wb.sheetOrder();
  const i1 = order.indexOf(sheet);
  const i2 = order.indexOf(id2);
  const areas: Area[] = [];
  for (let i = Math.min(i1, i2); i <= Math.max(i1, i2); i++) {
    const s = order[i];
    if (s !== undefined) areas.push({ sheet: s, ...box });
  }
  return new RefValue(areas);
}

/** Zone d'un tableau structure (Tableau1[Colonne], [@Colonne], [#Tout]...). */
export function tableArea(t: TableNode, ctx: EvalContext): Area | FormulaError {
  const def = t.table === '' ? ctx.wb.tableAt(ctx.sheet, ctx.row, ctx.col) : ctx.wb.getTable(t.table);
  if (!def) return ERR.REF;
  const dataR1 = def.headerRow ? def.r1 + 1 : def.r1;
  const dataR2 = def.totalsRow ? def.r2 - 1 : def.r2;
  let r1 = dataR1;
  let r2 = dataR2;
  const sp = new Set(t.specials);
  if (sp.has('#All')) {
    r1 = def.r1;
    r2 = def.r2;
  } else if (sp.has('#This Row')) {
    if (ctx.sheet !== def.sheet || ctx.row < dataR1 || ctx.row > dataR2) return ERR.VALUE;
    r1 = ctx.row;
    r2 = ctx.row;
  } else if (sp.size > 0) {
    const h = sp.has('#Headers');
    const d = sp.has('#Data');
    const tt = sp.has('#Totals');
    if (h && !def.headerRow) return ERR.REF;
    if (tt && !def.totalsRow) return ERR.REF;
    r1 = h ? def.r1 : d ? dataR1 : def.r2;
    r2 = tt ? def.r2 : d ? dataR2 : def.r1;
  }
  let c1 = def.c1;
  let c2 = def.c2;
  if (t.col1 !== undefined) {
    const find = (name: string): number =>
      def.columns.findIndex((c) => c.trim().toUpperCase() === name.trim().toUpperCase());
    const i1 = find(t.col1);
    const i2 = t.col2 === undefined ? i1 : find(t.col2);
    if (i1 < 0 || i2 < 0) return ERR.REF;
    c1 = def.c1 + Math.min(i1, i2);
    c2 = def.c1 + Math.max(i1, i2);
  }
  if (r2 < r1) return ERR.REF;
  return { sheet: def.sheet, r1, c1, r2, c2 };
}

function evalName(name: string, sheetName: string | undefined, ctx: EvalContext): EvalValue {
  const up = canonicalIdentifier(name).toUpperCase();
  if (sheetName === undefined) {
    const v = lookupScope(ctx.scope, up);
    if (v !== undefined) return v;
  }
  let sheet = ctx.sheet;
  if (sheetName !== undefined) {
    const id = ctx.wb.sheetId(sheetName);
    if (id === undefined) return ERR.REF;
    sheet = id;
  }
  const def = ctx.wb.getName(name, sheet);
  if (def) {
    if (ctx.depth > MAX_CALL_DEPTH) return ERR.CALC;
    return evaluate(def.node, { ...ctx, sheet: def.sheet ?? ctx.sheet, scope: undefined, depth: ctx.depth + 1 });
  }
  const table = ctx.wb.getTable(name);
  if (table) {
    const a = tableArea({ type: 'table', table: table.name, specials: [] }, ctx);
    return a instanceof FormulaError ? a : new RefValue([a]);
  }
  // Fonction integree passee comme LAMBDA : BYROW(A1:C3;SOMME).
  if (sheetName === undefined && getFunction(up)) return new LambdaValue([], undefined, undefined, up);
  return ERR.NAME;
}

/** Operation scalaire d'un operateur binaire. */
export function scalarBinary(op: BinaryOp, x: Scalar, y: Scalar, ctx: EvalContext): Scalar {
  switch (op) {
    case '+':
    case '-':
    case '*':
    case '/':
    case '^': {
      const a = toNumber(x, ctx);
      if (a instanceof FormulaError) return a;
      const b = toNumber(y, ctx);
      if (b instanceof FormulaError) return b;
      switch (op) {
        case '+':
          return checkNum(a + b);
        case '-':
          return checkNum(a - b);
        case '*':
          return checkNum(a * b);
        case '/':
          return b === 0 ? ERR.DIV0 : checkNum(a / b);
        default:
          if (a === 0 && b === 0) return ERR.NUM;
          if (a === 0 && b < 0) return ERR.DIV0;
          return checkNum(a ** b);
      }
    }
    case '&': {
      const a = scalarToText(x, ctx);
      if (a instanceof FormulaError) return a;
      const b = scalarToText(y, ctx);
      if (b instanceof FormulaError) return b;
      return a.length + b.length > MAX_TEXT ? ERR.VALUE : a + b;
    }
    default: {
      if (x instanceof FormulaError) return x;
      if (y instanceof FormulaError) return y;
      const c = compareScalars(x, y);
      switch (op) {
        case '=':
          return c === 0;
        case '<>':
          return c !== 0;
        case '<':
          return c < 0;
        case '>':
          return c > 0;
        case '<=':
          return c <= 0;
        default:
          return c >= 0;
      }
    }
  }
}

/** Applique f elementairement avec la diffusion d'Excel. */
export function broadcast(values: Value[], f: (xs: Scalar[]) => Scalar): Value {
  let rows = 1;
  let cols = 1;
  let any = false;
  for (const v of values) {
    if (v instanceof Matrix) {
      any = true;
      rows = Math.max(rows, v.rows);
      cols = Math.max(cols, v.cols);
    }
  }
  if (!any) return f(values as Scalar[]);
  const data = new Array<Scalar>(rows * cols);
  const xs = new Array<Scalar>(values.length);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        xs[i] = v instanceof Matrix ? v.getBroadcast(r, c) : (v ?? null);
      }
      data[r * cols + c] = f(xs);
    }
  }
  return new Matrix(rows, cols, data);
}

function areaOf(v: EvalValue): Area | undefined {
  return v instanceof RefValue && v.areas.length === 1 ? v.areas[0] : undefined;
}

function referenceOp(op: ':' | ',' | ' ', l: EvalValue, r: EvalValue): EvalValue {
  if (l instanceof FormulaError) return l;
  if (r instanceof FormulaError) return r;
  if (!(l instanceof RefValue) || !(r instanceof RefValue)) return ERR.VALUE;
  if (op === ',') return new RefValue([...l.areas, ...r.areas]);
  if (op === ':') {
    const a = areaOf(l);
    const b = areaOf(r);
    if (!a || !b || a.sheet !== b.sheet) return ERR.VALUE;
    return new RefValue([
      { sheet: a.sheet, r1: Math.min(a.r1, b.r1), c1: Math.min(a.c1, b.c1), r2: Math.max(a.r2, b.r2), c2: Math.max(a.c2, b.c2) },
    ]);
  }
  const out: Area[] = [];
  for (const a of l.areas) {
    for (const b of r.areas) {
      if (a.sheet !== b.sheet) continue;
      const r1 = Math.max(a.r1, b.r1);
      const r2 = Math.min(a.r2, b.r2);
      const c1 = Math.max(a.c1, b.c1);
      const c2 = Math.min(a.c2, b.c2);
      if (r1 <= r2 && c1 <= c2) out.push({ sheet: a.sheet, r1, c1, r2, c2 });
    }
  }
  return out.length === 0 ? ERR.NULL : new RefValue(out);
}

/** Intersection implicite (@) : cellule de la plage sur la ligne/colonne de la formule. */
export function implicitIntersection(v: EvalValue, ctx: EvalContext): EvalValue {
  if (v instanceof RefValue) {
    const a = v.areas[0];
    if (v.areas.length !== 1 || !a) return ERR.VALUE;
    if (a.r1 === a.r2 && a.c1 === a.c2) return ctx.wb.getCell(a.sheet, a.r1, a.c1);
    let r = a.r1;
    let c = a.c1;
    if (a.r1 !== a.r2) {
      if (ctx.row < a.r1 || ctx.row > a.r2) return ERR.VALUE;
      r = ctx.row;
    }
    if (a.c1 !== a.c2) {
      if (ctx.col < a.c1 || ctx.col > a.c2) return ERR.VALUE;
      c = ctx.col;
    }
    return ctx.wb.getCell(a.sheet, r, c);
  }
  if (v instanceof Matrix) return v.get(0, 0);
  return v;
}

function evalBinary(n: Extract<Node, { type: 'binary' }>, ctx: EvalContext): EvalValue {
  if (n.op === ':' || n.op === ',' || n.op === ' ') {
    return referenceOp(n.op, evaluate(n.left, ctx), evaluate(n.right, ctx));
  }
  const l = deref(evaluate(n.left, ctx), ctx);
  const r = deref(evaluate(n.right, ctx), ctx);
  if (!(l instanceof Matrix) && !(r instanceof Matrix)) return scalarBinary(n.op, l, r, ctx);
  return broadcast([l, r], ([x, y]) => scalarBinary(n.op, x ?? null, y ?? null, ctx));
}

/** Evalue les arguments et appelle une fonction integree (diffusion des arguments scalaires). */
export function applyBuiltin(def: FnDef, args: Arg[], ctx: EvalContext): EvalValue {
  if (!def.impl) return ERR.CALC;
  const impl = def.impl;
  const prepared: Arg[] = [];
  const liftIdx: number[] = [];
  for (let i = 0; i < args.length; i++) {
    const kind = kindAt(def.kinds, i);
    const a = args[i];
    if (a === undefined) {
      prepared.push(undefined);
      continue;
    }
    if (kind === 'S' || kind === 'V') {
      const d = deref(a, ctx);
      if (kind === 'S' && d instanceof Matrix) liftIdx.push(i);
      prepared.push(d);
    } else prepared.push(a);
  }
  if (liftIdx.length === 0) return impl(prepared, ctx, EVALUATOR);
  const mats = liftIdx.map((i) => prepared[i] as Matrix);
  return broadcast(mats, (xs) => {
    const call = prepared.slice();
    liftIdx.forEach((idx, k) => {
      call[idx] = xs[k] ?? null;
    });
    return toScalar(impl(call, ctx, EVALUATOR), ctx);
  });
}

function callBuiltin(def: FnDef, nodes: Node[], ctx: EvalContext): EvalValue {
  if (nodes.length < def.min || nodes.length > def.max) return ERR.VALUE;
  if (def.lazy) return def.lazy(nodes, ctx, EVALUATOR);
  const args: Arg[] = nodes.map((nd) => (nd.type === 'missing' ? null : evaluate(nd, ctx)));
  return applyBuiltin(def, args, ctx);
}

/** Appelle une LAMBDA (ou une fonction integree passee comme LAMBDA). */
export function callLambda(fn: LambdaValue, args: EvalValue[], ctx: EvalContext): EvalValue {
  if (fn.builtin !== undefined) {
    const def = getFunction(fn.builtin);
    if (!def || def.lazy || args.length < def.min || args.length > def.max) return ERR.VALUE;
    return applyBuiltin(def, args, ctx);
  }
  if (args.length > fn.params.length || !fn.body) return ERR.VALUE;
  if (ctx.depth > MAX_CALL_DEPTH) return ERR.NUM;
  const scope: Scope = { vars: new Map(), omitted: new Set(), parent: fn.scope };
  fn.params.forEach((p, i) => {
    const a = args[i];
    if (a === undefined) {
      scope.vars.set(p, null);
      scope.omitted.add(p);
    } else scope.vars.set(p, a);
  });
  return evaluate(fn.body, { ...ctx, scope, depth: ctx.depth + 1 });
}

function invokeValue(callee: EvalValue, argNodes: Node[], ctx: EvalContext): EvalValue {
  if (callee instanceof FormulaError) return callee;
  if (!(callee instanceof LambdaValue)) return ERR.VALUE;
  const args = argNodes.map((nd) => (nd.type === 'missing' ? null : evaluate(nd, ctx)));
  return callLambda(callee, args, ctx);
}

function evalCall(n: CallNode, ctx: EvalContext): EvalValue {
  const scoped = lookupScope(ctx.scope, n.name);
  if (scoped !== undefined) return invokeValue(scoped, n.args, ctx);
  const def = getFunction(n.name);
  if (def) return callBuiltin(def, n.args, ctx);
  const named = ctx.wb.getName(n.name, ctx.sheet);
  if (named) return invokeValue(evalName(n.name, undefined, ctx), n.args, ctx);
  return ERR.NAME;
}

export function evaluate(node: Node, ctx: EvalContext): EvalValue {
  switch (node.type) {
    case 'num':
      return node.value;
    case 'str':
      return node.value;
    case 'bool':
      return node.value;
    case 'err':
      return err(node.code);
    case 'missing':
      return null;
    case 'ref':
      return refValue(node, ctx);
    case 'name':
      return evalName(node.name, node.sheet, ctx);
    case 'table': {
      const a = tableArea(node, ctx);
      return a instanceof FormulaError ? a : new RefValue([a]);
    }
    case 'array': {
      const rows = node.rows.map((r) => r.map((c) => toScalar(evaluate(c, ctx), ctx)));
      return Matrix.from2D(rows);
    }
    case 'paren':
      return evaluate(node.arg, ctx);
    case 'unary': {
      const v = evaluate(node.arg, ctx);
      if (node.op === '@') return implicitIntersection(v, ctx);
      if (node.op === '+') return v;
      const d = deref(v, ctx);
      return broadcast([d], ([x]) => {
        const n = toNumber(x ?? null, ctx);
        return n instanceof FormulaError ? n : 0 - n;
      });
    }
    case 'postfix': {
      const v = evaluate(node.arg, ctx);
      if (node.op === '#') {
        if (v instanceof FormulaError) return v;
        const a = areaOf(v);
        if (!a) return ERR.REF;
        const sp = ctx.wb.spillArea(a.sheet, a.r1, a.c1);
        return sp ? new RefValue([sp]) : ERR.REF;
      }
      return broadcast([deref(v, ctx)], ([x]) => {
        const n = toNumber(x ?? null, ctx);
        return n instanceof FormulaError ? n : n / 100;
      });
    }
    case 'binary':
      return evalBinary(node, ctx);
    case 'call':
      return evalCall(node, ctx);
    case 'invoke':
      return invokeValue(evaluate(node.callee, ctx), node.args, ctx);
  }
}

export const EVALUATOR: Evaluator = { evaluate, callLambda };

/** Valeur finale d'une cellule : reference lue, LAMBDA non appelee -> #CALC!, matrice 1x1 -> scalaire. */
export function finalValue(v: EvalValue, ctx: EvalContext): Value {
  if (v instanceof LambdaValue) return ERR.CALC;
  const d = deref(v, ctx);
  if (d instanceof Matrix) {
    if (d.rows === 0 || d.cols === 0) return ERR.CALC;
    return d.rows === 1 && d.cols === 1 ? d.get(0, 0) : d;
  }
  return d;
}
