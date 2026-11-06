// Fonctions mathematiques et trigonometriques.
import { collectNumbers, splitFastStats, toMatrix, toNumber, toText } from '../eval/coerce.ts';
import { ERR, FormulaError, Matrix, type Scalar } from '../values.ts';
import { fromRows, numberPairs, numericMatrix } from './helpers.ts';
import { combin, factorial, roundDown, roundHalfAway, roundUp } from './numeric.ts';
import { define, numFn } from './registry.ts';

const TRIG_LIMIT = 134217728; // 2^27 : au-dela Excel renvoie #NOMBRE!

/** Quotient arrondi a 15 chiffres pour eviter les erreurs binaires (PLAFOND, PLANCHER...). */
function q15(a: number, b: number): number {
  return Number((a / b).toPrecision(15));
}

const trig = (name: string, f: (x: number) => number, guard?: (x: number) => FormulaError | undefined): void =>
  numFn('math', name, 1, 1, ([x = 0]) => {
    if (Math.abs(x) >= TRIG_LIMIT) return ERR.NUM;
    const g = guard?.(x);
    return g ?? f(x);
  });

trig('SIN', Math.sin);
trig('COS', Math.cos);
trig('TAN', Math.tan);
trig('COT', (x) => 1 / Math.tan(x), (x) => (x === 0 ? ERR.DIV0 : undefined));
trig('CSC', (x) => 1 / Math.sin(x), (x) => (x === 0 ? ERR.DIV0 : undefined));
trig('SEC', (x) => 1 / Math.cos(x));
numFn('math', 'ASIN', 1, 1, ([x = 0]) => (Math.abs(x) > 1 ? ERR.NUM : Math.asin(x)));
numFn('math', 'ACOS', 1, 1, ([x = 0]) => (Math.abs(x) > 1 ? ERR.NUM : Math.acos(x)));
numFn('math', 'ATAN', 1, 1, ([x = 0]) => Math.atan(x));
numFn('math', 'ATAN2', 2, 2, ([x = 0, y = 0]) => (x === 0 && y === 0 ? ERR.DIV0 : Math.atan2(y, x)));
numFn('math', 'ACOT', 1, 1, ([x = 0]) => Math.PI / 2 - Math.atan(x));
numFn('math', 'SINH', 1, 1, ([x = 0]) => Math.sinh(x));
numFn('math', 'COSH', 1, 1, ([x = 0]) => Math.cosh(x));
numFn('math', 'TANH', 1, 1, ([x = 0]) => Math.tanh(x));
numFn('math', 'COTH', 1, 1, ([x = 0]) => (x === 0 ? ERR.DIV0 : 1 / Math.tanh(x)));
numFn('math', 'CSCH', 1, 1, ([x = 0]) => (x === 0 ? ERR.DIV0 : 1 / Math.sinh(x)));
numFn('math', 'SECH', 1, 1, ([x = 0]) => 1 / Math.cosh(x));
numFn('math', 'ASINH', 1, 1, ([x = 0]) => Math.asinh(x));
numFn('math', 'ACOSH', 1, 1, ([x = 0]) => (x < 1 ? ERR.NUM : Math.acosh(x)));
numFn('math', 'ATANH', 1, 1, ([x = 0]) => (Math.abs(x) >= 1 ? ERR.NUM : Math.atanh(x)));
numFn('math', 'ACOTH', 1, 1, ([x = 0]) => (Math.abs(x) <= 1 ? ERR.NUM : 0.5 * Math.log((x + 1) / (x - 1))));
numFn('math', 'DEGREES', 1, 1, ([x = 0]) => (x * 180) / Math.PI);
numFn('math', 'RADIANS', 1, 1, ([x = 0]) => (x * Math.PI) / 180);
numFn('math', 'PI', 0, 0, () => Math.PI);

numFn('math', 'ABS', 1, 1, ([x = 0]) => Math.abs(x));
numFn('math', 'SIGN', 1, 1, ([x = 0]) => (x > 0 ? 1 : x < 0 ? -1 : 0));
numFn('math', 'SQRT', 1, 1, ([x = 0]) => (x < 0 ? ERR.NUM : Math.sqrt(x)));
numFn('math', 'SQRTPI', 1, 1, ([x = 0]) => (x < 0 ? ERR.NUM : Math.sqrt(x * Math.PI)));
numFn('math', 'EXP', 1, 1, ([x = 0]) => Math.exp(x));
numFn('math', 'LN', 1, 1, ([x = 0]) => (x <= 0 ? ERR.NUM : Math.log(x)));
numFn('math', 'LOG10', 1, 1, ([x = 0]) => (x <= 0 ? ERR.NUM : Math.log10(x)));
numFn('math', 'LOG', 1, 2, ([x = 0, b = 10]) => {
  if (x <= 0 || b <= 0) return ERR.NUM;
  if (b === 1) return ERR.DIV0;
  return b === 10 ? Math.log10(x) : Math.log(x) / Math.log(b);
});
numFn('math', 'POWER', 2, 2, ([a = 0, b = 0]) => {
  if (a === 0 && b === 0) return ERR.NUM;
  if (a === 0 && b < 0) return ERR.DIV0;
  return a ** b;
});
numFn('math', 'MOD', 2, 2, ([n = 0, d = 0]) => {
  if (d === 0) return ERR.DIV0;
  const r = n - d * Math.floor(q15(n, d));
  return Math.abs(r) < Math.abs(d) * 1e-15 ? 0 : r;
});
numFn('math', 'QUOTIENT', 2, 2, ([n = 0, d = 0]) => (d === 0 ? ERR.DIV0 : Math.trunc(q15(n, d))));
numFn('math', 'INT', 1, 1, ([x = 0]) => Math.floor(x));
numFn('math', 'TRUNC', 1, 2, ([x = 0, d = 0]) => roundDown(x, d));
numFn('math', 'ROUND', 2, 2, ([x = 0, d = 0]) => roundHalfAway(x, d));
numFn('math', 'ROUNDUP', 2, 2, ([x = 0, d = 0]) => roundUp(x, d));
numFn('math', 'ROUNDDOWN', 2, 2, ([x = 0, d = 0]) => roundDown(x, d));
numFn('math', 'MROUND', 2, 2, ([n = 0, m = 0]) => {
  if (m === 0 || n === 0) return 0;
  if (Math.sign(n) !== Math.sign(m)) return ERR.NUM;
  return roundHalfAway(q15(n, m), 0) * m;
});
numFn('math', 'CEILING', 2, 2, ([n = 0, s = 0]) => {
  if (s === 0 || n === 0) return 0;
  if (n > 0 && s < 0) return ERR.NUM;
  if (n < 0 && s < 0) return -Math.ceil(q15(-n, -s)) * -s;
  return Math.ceil(q15(n, s)) * s;
});
numFn('math', 'FLOOR', 2, 2, ([n = 0, s = 0]) => {
  if (n === 0) return 0;
  if (s === 0) return ERR.DIV0;
  if (n > 0 && s < 0) return ERR.NUM;
  if (n < 0 && s < 0) return -Math.floor(q15(-n, -s)) * -s;
  return Math.floor(q15(n, s)) * s;
});
numFn('math', 'CEILING.MATH', 1, 3, ([n = 0, sig = 1, mode = 0]) => {
  const s = Math.abs(sig);
  if (s === 0 || n === 0) return 0;
  if (n < 0 && mode !== 0) return -Math.ceil(q15(-n, s)) * s;
  return Math.ceil(q15(n, s)) * s;
});
numFn('math', 'FLOOR.MATH', 1, 3, ([n = 0, sig = 1, mode = 0]) => {
  const s = Math.abs(sig);
  if (s === 0 || n === 0) return 0;
  if (n < 0 && mode !== 0) return -Math.floor(q15(-n, s)) * s;
  return Math.floor(q15(n, s)) * s;
});
const ceilPrecise = ([n = 0, sig = 1]: number[]): number => {
  const s = Math.abs(sig);
  return s === 0 || n === 0 ? 0 : Math.ceil(q15(n, s)) * s;
};
numFn('math', 'CEILING.PRECISE', 1, 2, ceilPrecise);
numFn('math', 'ISO.CEILING', 1, 2, ceilPrecise);
numFn('math', 'ECMA.CEILING', 2, 2, ([n = 0, s = 0]) => (s === 0 ? 0 : Math.ceil(q15(n, s)) * s));
numFn('math', 'FLOOR.PRECISE', 1, 2, ([n = 0, sig = 1]) => {
  const s = Math.abs(sig);
  return s === 0 || n === 0 ? 0 : Math.floor(q15(n, s)) * s;
});
numFn('math', 'EVEN', 1, 1, ([x = 0]) => {
  const a = Math.ceil(Math.abs(x) / 2) * 2;
  return x < 0 ? -a : a;
});
numFn('math', 'ODD', 1, 1, ([x = 0]) => {
  let a = Math.ceil(Math.abs(x));
  if (a % 2 === 0) a += 1;
  return x < 0 ? -a : a;
});
numFn('math', 'FACT', 1, 1, ([x = 0]) => (x < 0 ? ERR.NUM : factorial(Math.floor(x))));
numFn('math', 'FACTDOUBLE', 1, 1, ([x = 0]) => {
  const n = Math.floor(x);
  if (n < -1) return ERR.NUM;
  let r = 1;
  for (let k = n; k > 1; k -= 2) r *= k;
  return r;
});
numFn('math', 'COMBIN', 2, 2, ([n = 0, k = 0]) => {
  const a = Math.trunc(n);
  const b = Math.trunc(k);
  return a < 0 || b < 0 || b > a ? ERR.NUM : combin(a, b);
});
numFn('math', 'COMBINA', 2, 2, ([n = 0, k = 0]) => {
  const a = Math.trunc(n);
  const b = Math.trunc(k);
  if (a < 0 || b < 0 || a < b) return ERR.NUM;
  return a === 0 && b === 0 ? 1 : combin(a + b - 1, b);
});
numFn('math', 'PERMUT', 2, 2, ([n = 0, k = 0]) => {
  const a = Math.trunc(n);
  const b = Math.trunc(k);
  if (a < 0 || b < 0 || b > a) return ERR.NUM;
  let r = 1;
  for (let i = 0; i < b; i++) r *= a - i;
  return r;
});
numFn('math', 'PERMUTATIONA', 2, 2, ([n = 0, k = 0]) => {
  const a = Math.trunc(n);
  const b = Math.trunc(k);
  return a < 0 || b < 0 ? ERR.NUM : a ** b;
});

function gcd2(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y) [x, y] = [y, x % y];
  return x;
}

define('math', 'GCD', { min: 1, max: 255, kinds: 'R' }, (args, ctx) => {
  const ns = collectNumbers(args, ctx);
  if (ns instanceof FormulaError) return ns;
  let g = 0;
  for (const n of ns) {
    if (n < 0) return ERR.NUM;
    g = gcd2(g, Math.trunc(n));
  }
  return g;
});
define('math', 'LCM', { min: 1, max: 255, kinds: 'R' }, (args, ctx) => {
  const ns = collectNumbers(args, ctx);
  if (ns instanceof FormulaError) return ns;
  let l = 1;
  for (const n of ns) {
    if (n < 0) return ERR.NUM;
    const k = Math.trunc(n);
    if (k === 0) return 0;
    l = (l / gcd2(l, k)) * k;
  }
  return l;
});
define('math', 'MULTINOMIAL', { min: 1, max: 255, kinds: 'R' }, (args, ctx) => {
  const ns = collectNumbers(args, ctx);
  if (ns instanceof FormulaError) return ns;
  let total = 0;
  let r = 1;
  for (const n of ns) {
    if (n < 0) return ERR.NUM;
    const k = Math.trunc(n);
    total += k;
    r *= combin(total, k);
  }
  return Number.isFinite(r) ? r : ERR.NUM;
});

define('math', 'RAND', { min: 0, volatile: true }, (_a, ctx) => ctx.wb.random());
numFn('math', 'RANDBETWEEN', 2, 2, ([lo = 0, hi = 0], ctx) => {
  const a = Math.ceil(lo);
  const b = Math.floor(hi);
  if (a > b) return ERR.NUM;
  return a + Math.floor(ctx.wb.random() * (b - a + 1));
});
define('math', 'RANDARRAY', { min: 0, max: 5, volatile: true }, (args, ctx) => {
  const ns: number[] = [];
  const defaults = [1, 1, 0, 1, 0];
  for (let i = 0; i < 5; i++) {
    const a = args[i];
    if (a === undefined || a === null) {
      ns.push(defaults[i] ?? 0);
      continue;
    }
    const n = toNumber(a, ctx);
    if (n instanceof FormulaError) return n;
    ns.push(n);
  }
  const [rows = 1, cols = 1, lo = 0, hi = 1, whole = 0] = ns;
  const r = Math.trunc(rows);
  const c = Math.trunc(cols);
  if (r < 1 || c < 1 || lo > hi) return r === 0 || c === 0 ? ERR.CALC : ERR.VALUE;
  if (whole && (!Number.isInteger(lo) || !Number.isInteger(hi))) return ERR.VALUE;
  const data: Scalar[] = [];
  for (let i = 0; i < r * c; i++) {
    const u = ctx.wb.random();
    data.push(whole ? lo + Math.floor(u * (hi - lo + 1)) : lo + u * (hi - lo));
  }
  return new Matrix(r, c, data);
});

define('math', 'SUM', { min: 1, max: 255, kinds: 'R' }, (args, ctx) => {
  const fast = splitFastStats(args, ctx);
  const ns = collectNumbers(fast.rest, ctx);
  if (ns instanceof FormulaError) return ns;
  let s = fast.sum;
  for (const n of ns) s += n;
  return s;
});
define('math', 'SUMSQ', { min: 1, max: 255, kinds: 'R' }, (args, ctx) => {
  const ns = collectNumbers(args, ctx);
  if (ns instanceof FormulaError) return ns;
  let s = 0;
  for (const n of ns) s += n * n;
  return s;
});
define('math', 'PRODUCT', { min: 1, max: 255, kinds: 'R' }, (args, ctx) => {
  const ns = collectNumbers(args, ctx);
  if (ns instanceof FormulaError) return ns;
  if (ns.length === 0) return 0;
  let p = 1;
  for (const n of ns) p *= n;
  return Number.isFinite(p) ? p : ERR.NUM;
});
define('math', 'SUMPRODUCT', { min: 1, max: 255, kinds: 'V' }, (args, ctx) => {
  const mats: Matrix[] = [];
  for (const a of args) {
    const m = toMatrix(a, ctx);
    if (m instanceof FormulaError) return m;
    mats.push(m);
  }
  const first = mats[0];
  if (!first) return ERR.VALUE;
  if (mats.some((m) => m.rows !== first.rows || m.cols !== first.cols)) return ERR.VALUE;
  let s = 0;
  for (let i = 0; i < first.data.length; i++) {
    let p = 1;
    for (const m of mats) {
      const v = m.data[i] ?? null;
      if (v instanceof FormulaError) return v;
      p *= typeof v === 'number' ? v : 0;
    }
    s += p;
  }
  return s;
});
const pairSum = (name: string, f: (x: number, y: number) => number): void =>
  define('math', name, { min: 2, max: 2, kinds: 'V' }, ([a, b], ctx) => {
    const p = numberPairs(a, b, ctx);
    if (p instanceof FormulaError) return p;
    let s = 0;
    for (let i = 0; i < p.x.length; i++) s += f(p.x[i] ?? 0, p.y[i] ?? 0);
    return s;
  });
pairSum('SUMX2MY2', (x, y) => x * x - y * y);
pairSum('SUMX2PY2', (x, y) => x * x + y * y);
pairSum('SUMXMY2', (x, y) => (x - y) ** 2);
define('math', 'SERIESSUM', { min: 4, max: 4, kinds: 'SSSV' }, ([x, n, m, c], ctx) => {
  const xv = toNumber(x, ctx);
  const nv = toNumber(n, ctx);
  const mv = toNumber(m, ctx);
  if (xv instanceof FormulaError) return xv;
  if (nv instanceof FormulaError) return nv;
  if (mv instanceof FormulaError) return mv;
  const coefs = numericMatrix(c, ctx);
  if (coefs instanceof FormulaError) return coefs;
  let s = 0;
  let k = 0;
  for (const row of coefs) for (const a of row) s += a * xv ** (nv + mv * k++);
  return Number.isFinite(s) ? s : ERR.NUM;
});

// ---------- Chiffres romains, bases ----------

const ROMAN_CHARS = 'MDCLXVI';
const ROMAN_VALUES = [1000, 500, 100, 50, 10, 5, 1];

/** ROMAIN avec les 5 formes d'Excel (0 classique ... 4 simplifiee). */
export function toRoman(value: number, mode: number): string {
  let val = value;
  let out = '';
  const maxIndex = ROMAN_VALUES.length - 1;
  for (let i = 0; i <= maxIndex / 2; i++) {
    let idx = 2 * i;
    const unit = ROMAN_VALUES[idx] ?? 1;
    const digit = Math.floor(val / unit);
    if (digit % 5 === 4) {
      const idx2 = digit === 4 ? idx - 1 : idx - 2;
      let steps = 0;
      while (steps < mode && idx < maxIndex) {
        steps++;
        if ((ROMAN_VALUES[idx2] ?? 0) - (ROMAN_VALUES[idx + 1] ?? 0) <= val) idx++;
        else steps = mode;
      }
      out += (ROMAN_CHARS[idx] ?? '') + (ROMAN_CHARS[idx2] ?? '');
      val = val + (ROMAN_VALUES[idx] ?? 0) - (ROMAN_VALUES[idx2] ?? 0);
    } else {
      if (digit > 4) out += ROMAN_CHARS[idx - 1] ?? '';
      out += (ROMAN_CHARS[idx] ?? '').repeat(digit % 5);
      val %= unit;
    }
  }
  return out;
}

define('math', 'ROMAN', { min: 1, max: 2 }, ([n, form], ctx) => {
  const v = toNumber(n, ctx);
  if (v instanceof FormulaError) return v;
  let mode = 0;
  if (typeof form === 'boolean') mode = form ? 0 : 4;
  else if (form !== undefined && form !== null) {
    const f = toNumber(form, ctx);
    if (f instanceof FormulaError) return f;
    mode = Math.trunc(f);
  }
  const k = Math.trunc(v);
  if (k < 0 || k > 3999 || mode < 0 || mode > 4) return ERR.VALUE;
  return toRoman(k, mode);
});
define('math', 'ARABIC', { min: 1 }, ([t], ctx) => {
  const s0 = toText(t, ctx);
  if (s0 instanceof FormulaError) return s0;
  let s = s0.trim().toUpperCase();
  if (s.length > 255) return ERR.VALUE;
  let sign = 1;
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1);
  }
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN_VALUES[ROMAN_CHARS.indexOf(s[i] ?? '')];
    if (v === undefined) return ERR.VALUE;
    const next = i + 1 < s.length ? (ROMAN_VALUES[ROMAN_CHARS.indexOf(s[i + 1] ?? '')] ?? 0) : 0;
    total += v < next ? -v : v;
  }
  return sign * total;
});
define('math', 'BASE', { min: 2, max: 3 }, ([n, r, len], ctx) => {
  const v = toNumber(n, ctx);
  const radix = toNumber(r, ctx);
  const ml = len === undefined || len === null ? 0 : toNumber(len, ctx);
  if (v instanceof FormulaError) return v;
  if (radix instanceof FormulaError) return radix;
  if (ml instanceof FormulaError) return ml;
  const k = Math.trunc(v);
  const rd = Math.trunc(radix);
  if (k < 0 || k >= 2 ** 53 || rd < 2 || rd > 36 || ml < 0 || ml > 255) return ERR.NUM;
  return k.toString(rd).toUpperCase().padStart(Math.trunc(ml), '0');
});
define('math', 'DECIMAL', { min: 2, max: 2 }, ([t, r], ctx) => {
  const s = toText(t, ctx);
  const radix = toNumber(r, ctx);
  if (s instanceof FormulaError) return s;
  if (radix instanceof FormulaError) return radix;
  const rd = Math.trunc(radix);
  if (rd < 2 || rd > 36 || s.length > 255) return ERR.NUM;
  let v = 0;
  for (const ch of s.trim().toLowerCase()) {
    const d = parseInt(ch, 36);
    if (Number.isNaN(d) || d >= rd) return ERR.NUM;
    v = v * rd + d;
  }
  return v;
});

// ---------- Matrices ----------

function determinant(m: number[][]): number {
  const n = m.length;
  const a = m.map((r) => r.slice());
  let det = 1;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r]?.[i] ?? 0) > Math.abs(a[p]?.[i] ?? 0)) p = r;
    if ((a[p]?.[i] ?? 0) === 0) return 0;
    if (p !== i) {
      [a[p], a[i]] = [a[i] ?? [], a[p] ?? []];
      det = -det;
    }
    const pivot = a[i]?.[i] ?? 1;
    det *= pivot;
    for (let r = i + 1; r < n; r++) {
      const f = (a[r]?.[i] ?? 0) / pivot;
      for (let c = i; c < n; c++) {
        const row = a[r];
        if (row) row[c] = (row[c] ?? 0) - f * (a[i]?.[c] ?? 0);
      }
    }
  }
  return det;
}

define('math', 'MDETERM', { min: 1, kinds: 'V' }, ([a], ctx) => {
  const m = numericMatrix(a, ctx);
  if (m instanceof FormulaError) return m;
  if (m.length === 0 || m.some((r) => r.length !== m.length)) return ERR.VALUE;
  return determinant(m);
});
define('math', 'MINVERSE', { min: 1, kinds: 'V' }, ([a], ctx) => {
  const m = numericMatrix(a, ctx);
  if (m instanceof FormulaError) return m;
  const n = m.length;
  if (n === 0 || m.some((r) => r.length !== n)) return ERR.VALUE;
  const aug = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(aug[r]?.[i] ?? 0) > Math.abs(aug[p]?.[i] ?? 0)) p = r;
    if (Math.abs(aug[p]?.[i] ?? 0) < 1e-15) return ERR.NUM;
    [aug[p], aug[i]] = [aug[i] ?? [], aug[p] ?? []];
    const row = aug[i] ?? [];
    const pivot = row[i] ?? 1;
    for (let c = 0; c < 2 * n; c++) row[c] = (row[c] ?? 0) / pivot;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const other = aug[r] ?? [];
      const f = other[i] ?? 0;
      for (let c = 0; c < 2 * n; c++) other[c] = (other[c] ?? 0) - f * (row[c] ?? 0);
    }
  }
  return fromRows(aug.map((r) => r.slice(n)));
});
define('math', 'MMULT', { min: 2, max: 2, kinds: 'V' }, ([a, b], ctx) => {
  const x = numericMatrix(a, ctx);
  if (x instanceof FormulaError) return x;
  const y = numericMatrix(b, ctx);
  if (y instanceof FormulaError) return y;
  const inner = x[0]?.length ?? 0;
  if (inner !== y.length) return ERR.VALUE;
  const cols = y[0]?.length ?? 0;
  return fromRows(
    x.map((row) => Array.from({ length: cols }, (_, c) => row.reduce((s, v, k) => s + v * (y[k]?.[c] ?? 0), 0))),
  );
});
define('math', 'MUNIT', { min: 1 }, ([n], ctx) => {
  const v = toNumber(n, ctx);
  if (v instanceof FormulaError) return v;
  const k = Math.trunc(v);
  if (k < 1) return ERR.VALUE;
  return fromRows(Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))));
});
