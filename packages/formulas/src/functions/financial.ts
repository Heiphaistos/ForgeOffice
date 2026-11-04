// Fonctions financieres : annuites (VPM, VA, VC, NPM, TAUX), flux (VAN, TRI, TRI.PAIEMENTS), amortissements.
import { collectNumbers, toMatrix, toNumber } from '../eval/coerce.ts';
import type { EvalContext } from '../eval/types.ts';
import { ERR, FormulaError } from '../values.ts';
import { define, numFn, type Arg } from './registry.ts';

const F = 'financial' as const;

// ---------- Annuites ----------

export function fvOf(r: number, n: number, pmt: number, pv: number, type: number): number {
  if (r === 0) return -(pv + pmt * n);
  const f = (1 + r) ** n;
  return -(pv * f + (pmt * (1 + r * type) * (f - 1)) / r);
}

export function pmtOf(r: number, n: number, pv: number, fv: number, type: number): number {
  if (r === 0) return -(pv + fv) / n;
  const f = (1 + r) ** n;
  return (-(pv * f + fv) * r) / ((1 + r * type) * (f - 1));
}

function pvOf(r: number, n: number, pmt: number, fv: number, type: number): number {
  if (r === 0) return -(fv + pmt * n);
  const f = (1 + r) ** n;
  return -(fv + (pmt * (1 + r * type) * (f - 1)) / r) / f;
}

function ipmtOf(r: number, per: number, n: number, pv: number, fv: number, type: number): number {
  const pmt = pmtOf(r, n, pv, fv, type);
  let ip: number;
  if (per === 1) ip = type === 1 ? 0 : -pv;
  else ip = type === 1 ? fvOf(r, per - 2, pmt, pv, 1) - pmt : fvOf(r, per - 1, pmt, pv, 0);
  return ip * r;
}

const typeOf = (t: number | undefined): number => (t === undefined || t === 0 ? 0 : 1);

numFn(F, 'PMT', 3, 5, ([r = 0, n = 0, pv = 0, fv = 0, t]) => (n === 0 ? ERR.NUM : pmtOf(r, n, pv, fv, typeOf(t))));
numFn(F, 'FV', 3, 5, ([r = 0, n = 0, pmt = 0, pv = 0, t]) => fvOf(r, n, pmt, pv, typeOf(t)));
numFn(F, 'PV', 3, 5, ([r = 0, n = 0, pmt = 0, fv = 0, t]) => pvOf(r, n, pmt, fv, typeOf(t)));
numFn(F, 'NPER', 3, 5, ([r = 0, pmt = 0, pv = 0, fv = 0, t]) => {
  const type = typeOf(t);
  if (r === 0) return pmt === 0 ? ERR.NUM : -(pv + fv) / pmt;
  const a = pmt * (1 + r * type);
  const v = (a - fv * r) / (a + pv * r);
  return v <= 0 ? ERR.NUM : Math.log(v) / Math.log(1 + r);
});
numFn(F, 'IPMT', 4, 6, ([r = 0, per = 0, n = 0, pv = 0, fv = 0, t]) =>
  per < 1 || per > n ? ERR.NUM : ipmtOf(r, per, n, pv, fv, typeOf(t)),
);
numFn(F, 'PPMT', 4, 6, ([r = 0, per = 0, n = 0, pv = 0, fv = 0, t]) => {
  if (per < 1 || per > n) return ERR.NUM;
  const type = typeOf(t);
  return pmtOf(r, n, pv, fv, type) - ipmtOf(r, per, n, pv, fv, type);
});
numFn(F, 'ISPMT', 4, 4, ([r = 0, per = 0, n = 0, pv = 0]) => (n === 0 ? ERR.DIV0 : pv * r * (per / n - 1)));

/** Resolution de Newton (derivee numerique) ; undefined si pas de convergence. */
export function solve(f: (x: number) => number, guess: number, maxIter = 100, tol = 1e-10): number | undefined {
  let x = guess;
  for (let i = 0; i < maxIter; i++) {
    const y = f(x);
    if (!Number.isFinite(y)) return undefined;
    if (Math.abs(y) < tol) return x;
    const h = Math.max(1e-7, Math.abs(x) * 1e-7);
    const d = (f(x + h) - y) / h;
    if (d === 0 || !Number.isFinite(d)) return undefined;
    const nx = x - y / d;
    if (Math.abs(nx - x) < tol) return nx;
    x = nx;
  }
  return undefined;
}

numFn(F, 'RATE', 3, 6, ([n = 0, pmt = 0, pv = 0, fv = 0, t, guess = 0.1]) => {
  const type = typeOf(t);
  const f = (r: number): number => {
    if (Math.abs(r) < 1e-12) return pv + pmt * n + fv;
    const g = (1 + r) ** n;
    return pv * g + (pmt * (1 + r * type) * (g - 1)) / r + fv;
  };
  const r = solve(f, guess);
  return r === undefined || r <= -1 ? ERR.NUM : r;
});

numFn(F, 'EFFECT', 2, 2, ([nom = 0, p = 0]) => {
  const n = Math.trunc(p);
  return nom <= 0 || n < 1 ? ERR.NUM : (1 + nom / n) ** n - 1;
});
numFn(F, 'NOMINAL', 2, 2, ([eff = 0, p = 0]) => {
  const n = Math.trunc(p);
  return eff <= 0 || n < 1 ? ERR.NUM : n * ((1 + eff) ** (1 / n) - 1);
});
numFn(F, 'PDURATION', 3, 3, ([r = 0, pv = 0, fv = 0]) =>
  r <= 0 || pv <= 0 || fv <= 0 ? ERR.NUM : (Math.log(fv) - Math.log(pv)) / Math.log(1 + r),
);
numFn(F, 'RRI', 3, 3, ([n = 0, pv = 0, fv = 0]) => (n <= 0 || pv === 0 ? ERR.NUM : (fv / pv) ** (1 / n) - 1));

function dollarFraction(name: string, toDecimal: boolean): void {
  numFn(F, name, 2, 2, ([x = 0, frac = 0]) => {
    const f = Math.trunc(frac);
    if (f < 0) return ERR.NUM;
    if (f === 0) return ERR.DIV0;
    const scale = 10 ** Math.ceil(Math.log10(f));
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const ip = Math.trunc(ax);
    const fp = ax - ip;
    return sign * (ip + (toDecimal ? (fp * scale) / f : (fp * f) / scale));
  });
}
dollarFraction('DOLLARDE', true);
dollarFraction('DOLLARFR', false);

define(F, 'CUMIPMT', { min: 6, max: 6 }, (args, ctx) => cumulative(args, ctx, true));
define(F, 'CUMPRINC', { min: 6, max: 6 }, (args, ctx) => cumulative(args, ctx, false));

function nums(args: Arg[], ctx: EvalContext): number[] | FormulaError {
  const out: number[] = [];
  for (const a of args) {
    const n = toNumber(a, ctx);
    if (n instanceof FormulaError) return n;
    out.push(n);
  }
  return out;
}

function cumulative(args: Arg[], ctx: EvalContext, interest: boolean): number | FormulaError {
  const v = nums(args, ctx);
  if (v instanceof FormulaError) return v;
  const [r = 0, n = 0, pv = 0, s = 0, e = 0, t = 0] = v;
  const start = Math.ceil(s);
  const end = Math.floor(e);
  if (r <= 0 || n <= 0 || pv <= 0 || start < 1 || end < start || end > n || (t !== 0 && t !== 1)) return ERR.NUM;
  const pmt = pmtOf(r, n, pv, 0, t);
  let total = 0;
  for (let p = start; p <= end; p++) {
    const ip = ipmtOf(r, p, n, pv, 0, t);
    total += interest ? ip : pmt - ip;
  }
  return total;
}

// ---------- Flux de tresorerie ----------

define(F, 'NPV', { min: 2, max: 255, kinds: 'SR' }, ([rate, ...rest], ctx) => {
  const r = toNumber(rate, ctx);
  if (r instanceof FormulaError) return r;
  if (r === -1) return ERR.DIV0;
  const vs = collectNumbers(rest, ctx);
  if (vs instanceof FormulaError) return vs;
  return vs.reduce((acc, v, i) => acc + v / (1 + r) ** (i + 1), 0);
});

/** Nombres d'une plage ou matrice de flux (textes et vides ignores, erreur propagee). */
function flows(a: Arg, ctx: EvalContext): number[] | FormulaError {
  const m = toMatrix(a, ctx);
  if (m instanceof FormulaError) return m;
  const out: number[] = [];
  for (const v of m.data) {
    if (v instanceof FormulaError) return v;
    if (typeof v === 'number') out.push(v);
  }
  return out;
}

const npvAt = (vs: number[], r: number): number => vs.reduce((acc, v, i) => acc + v / (1 + r) ** i, 0);

define(F, 'IRR', { min: 1, max: 2, kinds: 'VS' }, ([a, g], ctx) => {
  const vs = flows(a, ctx);
  if (vs instanceof FormulaError) return vs;
  const guess = g === undefined || g === null ? 0.1 : toNumber(g, ctx);
  if (guess instanceof FormulaError) return guess;
  if (!vs.some((v) => v > 0) || !vs.some((v) => v < 0)) return ERR.NUM;
  const r = solve((x) => npvAt(vs, x), guess, 50, 1e-12);
  return r === undefined || r <= -1 ? ERR.NUM : r;
});

define(F, 'MIRR', { min: 3, max: 3, kinds: 'VSS' }, ([a, fr, rr], ctx) => {
  const vs = flows(a, ctx);
  if (vs instanceof FormulaError) return vs;
  const f = toNumber(fr, ctx);
  if (f instanceof FormulaError) return f;
  const re = toNumber(rr, ctx);
  if (re instanceof FormulaError) return re;
  const n = vs.length;
  let pos = 0;
  let neg = 0;
  vs.forEach((v, i) => {
    if (v > 0) pos += v / (1 + re) ** i;
    else neg += v / (1 + f) ** i;
  });
  if (pos === 0 || neg === 0 || n < 2) return ERR.DIV0;
  return ((-pos * (1 + re) ** (n - 1)) / neg) ** (1 / (n - 1)) - 1;
});

function datedFlows(a: Arg, d: Arg, ctx: EvalContext): { v: number[]; d: number[] } | FormulaError {
  const vm = toMatrix(a, ctx);
  if (vm instanceof FormulaError) return vm;
  const dm = toMatrix(d, ctx);
  if (dm instanceof FormulaError) return dm;
  if (vm.data.length !== dm.data.length) return ERR.NUM;
  const v: number[] = [];
  const ds: number[] = [];
  for (let i = 0; i < vm.data.length; i++) {
    const x = vm.data[i] ?? null;
    const y = dm.data[i] ?? null;
    if (x instanceof FormulaError) return x;
    if (y instanceof FormulaError) return y;
    if (typeof x !== 'number') return ERR.VALUE;
    const dn = toNumber(y, ctx);
    if (dn instanceof FormulaError) return dn;
    v.push(x);
    ds.push(Math.trunc(dn));
  }
  const d0 = ds[0] ?? 0;
  if (ds.some((x) => x < d0)) return ERR.NUM;
  return { v, d: ds };
}

const xnpvAt = (f: { v: number[]; d: number[] }, r: number): number =>
  f.v.reduce((acc, v, i) => acc + v / (1 + r) ** (((f.d[i] ?? 0) - (f.d[0] ?? 0)) / 365), 0);

define(F, 'XNPV', { min: 3, max: 3, kinds: 'SVV' }, ([rate, a, d], ctx) => {
  const r = toNumber(rate, ctx);
  if (r instanceof FormulaError) return r;
  const f = datedFlows(a, d, ctx);
  if (f instanceof FormulaError) return f;
  return r <= -1 ? ERR.NUM : xnpvAt(f, r);
});

define(F, 'XIRR', { min: 2, max: 3, kinds: 'VVS' }, ([a, d, g], ctx) => {
  const f = datedFlows(a, d, ctx);
  if (f instanceof FormulaError) return f;
  const guess = g === undefined || g === null ? 0.1 : toNumber(g, ctx);
  if (guess instanceof FormulaError) return guess;
  if (!f.v.some((v) => v > 0) || !f.v.some((v) => v < 0)) return ERR.NUM;
  const r = solve((x) => xnpvAt(f, x), guess, 100, 1e-10);
  return r === undefined || r <= -1 ? ERR.NUM : r;
});

define(F, 'FVSCHEDULE', { min: 2, max: 2, kinds: 'SV' }, ([p, s], ctx) => {
  const pr = toNumber(p, ctx);
  if (pr instanceof FormulaError) return pr;
  const m = toMatrix(s, ctx);
  if (m instanceof FormulaError) return m;
  let v = pr;
  for (const x of m.data) {
    const r = toNumber(x, ctx);
    if (r instanceof FormulaError) return r;
    v *= 1 + r;
  }
  return v;
});

// ---------- Amortissements ----------

numFn(F, 'SLN', 3, 3, ([c = 0, s = 0, l = 0]) => (l === 0 ? ERR.DIV0 : (c - s) / l));
numFn(F, 'SYD', 4, 4, ([c = 0, s = 0, l = 0, p = 0]) =>
  l <= 0 || p <= 0 || p > l || s < 0 ? ERR.NUM : ((c - s) * (l - p + 1) * 2) / (l * (l + 1)),
);

numFn(F, 'DB', 4, 5, ([cost = 0, salvage = 0, life = 0, period = 0, month = 12]) => {
  const m = Math.trunc(month);
  if (cost < 0 || salvage < 0 || life <= 0 || period <= 0 || m < 1 || m > 12 || period > life + 1) return ERR.NUM;
  if (cost === 0) return 0;
  const rate = Math.round((1 - (salvage / cost) ** (1 / life)) * 1000) / 1000;
  let total = (cost * rate * m) / 12;
  if (Math.trunc(period) === 1) return total;
  for (let p = 2; p <= Math.trunc(period); p++) {
    const dep = p === Math.trunc(life) + 1 ? ((cost - total) * rate * (12 - m)) / 12 : (cost - total) * rate;
    if (p === Math.trunc(period)) return dep;
    total += dep;
  }
  return 0;
});

/** Amortissement degressif d'une periode (eventuellement fractionnaire), algorithme d'Excel. */
function ddbOf(cost: number, salvage: number, life: number, period: number, factor: number): number {
  let rate = factor / life;
  let oldValue: number;
  if (rate >= 1) {
    rate = 1;
    oldValue = period === 1 ? cost : 0;
  } else oldValue = cost * (1 - rate) ** (period - 1);
  const newValue = cost * (1 - rate) ** period;
  const d = newValue < salvage ? oldValue - salvage : oldValue - newValue;
  return d < 0 ? 0 : d;
}

numFn(F, 'DDB', 4, 5, ([c = 0, s = 0, l = 0, p = 0, f = 2]) =>
  c < 0 || s < 0 || l <= 0 || p <= 0 || f <= 0 || p > l ? ERR.NUM : ddbOf(c, s, l, p, f),
);

function interVdb(cost: number, salvage: number, life: number, life1: number, period: number, factor: number): number {
  let vdb = 0;
  const intEnd = Math.ceil(period);
  let salvageValue = cost - salvage;
  let nowSln = false;
  let sln = 0;
  for (let i = 1; i <= intEnd; i++) {
    let term: number;
    if (!nowSln) {
      const ddb = ddbOf(cost, salvage, life, i, factor);
      sln = salvageValue / (life1 - (i - 1));
      if (sln > ddb) {
        term = sln;
        nowSln = true;
      } else {
        term = ddb;
        salvageValue -= ddb;
      }
    } else term = sln;
    if (i === intEnd) term *= period + 1 - intEnd;
    vdb += term;
  }
  return vdb;
}

numFn(F, 'VDB', 5, 7, ([cost = 0, salvage = 0, life = 0, start = 0, end = 0, factor = 2, noSwitch = 0]) => {
  if (cost < 0 || salvage < 0 || life <= 0 || start < 0 || end < start || end > life || factor <= 0) return ERR.NUM;
  const intStart = Math.floor(start);
  const intEnd = Math.ceil(end);
  if (noSwitch !== 0) {
    let v = 0;
    for (let i = intStart + 1; i <= intEnd; i++) {
      let term = ddbOf(cost, salvage, life, i, factor);
      if (i === intStart + 1) term *= Math.min(end, intStart + 1) - start;
      else if (i === intEnd) term *= end + 1 - intEnd;
      v += term;
    }
    return v;
  }
  let part = 0;
  if (start !== intStart) {
    const value = cost - interVdb(cost, salvage, life, life, intStart, factor);
    part += (start - intStart) * interVdb(value, salvage, life, life - intStart, 1, factor);
  }
  if (end !== intEnd) {
    const tStart = intEnd - 1;
    const value = cost - interVdb(cost, salvage, life, life, tStart, factor);
    part += (intEnd - end) * interVdb(value, salvage, life, life - tStart, 1, factor);
  }
  const rest = cost - interVdb(cost, salvage, life, life, intStart, factor);
  return interVdb(rest, salvage, life, life - intStart, intEnd - intStart, factor) - part;
});
