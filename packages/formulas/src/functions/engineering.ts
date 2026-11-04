// Ingenierie : conversions de base (BINDEC, DECHEX...), operations bit a bit, ERF, Bessel, DELTA, SUP.SEUIL.
import { toNumber, toText } from '../eval/coerce.ts';
import type { EvalContext } from '../eval/types.ts';
import { ERR, FormulaError } from '../values.ts';
import { erf, erfc } from './numeric.ts';
import { define, numFn, type Arg } from './registry.ts';

const E = 'engineering' as const;

// ---------- Conversions de base ----------

interface Base {
  radix: number;
  /** Nombre de bits du complement a deux sur 10 chiffres. */
  bits: number;
  re: RegExp;
}
const BIN: Base = { radix: 2, bits: 10, re: /^[01]{1,10}$/ };
const OCT: Base = { radix: 8, bits: 30, re: /^[0-7]{1,10}$/ };
const DEC: Base = { radix: 10, bits: 0, re: /^$/ };
const HEX: Base = { radix: 16, bits: 40, re: /^[0-9A-Fa-f]{1,10}$/ };

function digitsArg(a: Arg, ctx: EvalContext): string | FormulaError {
  if (typeof a === 'boolean') return ERR.VALUE;
  const t = toText(a, ctx);
  return t instanceof FormulaError ? t : t.trim();
}

function parseBase(text: string, b: Base): number | FormulaError {
  if (text === '') return 0;
  if (!b.re.test(text)) return ERR.NUM;
  const v = parseInt(text, b.radix);
  const half = 2 ** (b.bits - 1);
  return text.length === 10 && v >= half ? v - 2 ** b.bits : v;
}

function formatBase(v: number, b: Base, places: number | undefined): string | FormulaError {
  const half = 2 ** (b.bits - 1);
  if (v < -half || v >= half) return ERR.NUM;
  if (v < 0) return (2 ** b.bits + v).toString(b.radix).toUpperCase();
  const s = v.toString(b.radix).toUpperCase();
  if (places === undefined) return s;
  if (places < s.length || places > 10) return ERR.NUM;
  return s.padStart(places, '0');
}

function placesArg(a: Arg, ctx: EvalContext): number | undefined | FormulaError {
  if (a === undefined || a === null) return undefined;
  const n = toNumber(a, ctx);
  if (n instanceof FormulaError) return n;
  const p = Math.trunc(n);
  return p <= 0 ? ERR.NUM : p;
}

function baseFn(name: string, from: Base, to: Base): void {
  define(E, name, { min: 1, max: to === DEC ? 1 : 2 }, ([x, p], ctx) => {
    let v: number | FormulaError;
    if (from === DEC) {
      const n = toNumber(x, ctx);
      v = n instanceof FormulaError ? n : Math.trunc(n);
    } else {
      const t = digitsArg(x, ctx);
      v = t instanceof FormulaError ? t : parseBase(t, from);
    }
    if (v instanceof FormulaError) return v;
    if (to === DEC) return v;
    const places = placesArg(p, ctx);
    if (places instanceof FormulaError) return places;
    return formatBase(v, to, places);
  });
}
const BASES: [string, Base][] = [
  ['BIN', BIN],
  ['OCT', OCT],
  ['DEC', DEC],
  ['HEX', HEX],
];
for (const [fn, fb] of BASES) {
  for (const [tn, tb] of BASES) if (fb !== tb) baseFn(`${fn}2${tn}`, fb, tb);
}

// ---------- Bit a bit (entiers de 0 a 2^48 - 1) ----------

const BIT_MAX = 2 ** 48;
const bitArg = (n: number): bigint | undefined =>
  Number.isInteger(n) && n >= 0 && n < BIT_MAX ? BigInt(n) : undefined;

function bitFn(name: string, op: (a: bigint, b: bigint) => bigint): void {
  numFn(E, name, 2, 2, ([x = 0, y = 0]) => {
    const a = bitArg(x);
    const b = bitArg(y);
    return a === undefined || b === undefined ? ERR.NUM : Number(op(a, b));
  });
}
bitFn('BITAND', (a, b) => a & b);
bitFn('BITOR', (a, b) => a | b);
bitFn('BITXOR', (a, b) => a ^ b);

function shiftFn(name: string, dir: 1 | -1): void {
  numFn(E, name, 2, 2, ([x = 0, s = 0]) => {
    const a = bitArg(x);
    const sh = Math.trunc(s) * dir;
    if (a === undefined || Math.abs(sh) > 53) return ERR.NUM;
    const r = sh >= 0 ? a << BigInt(sh) : a >> BigInt(-sh);
    return r >= BigInt(BIT_MAX) ? ERR.NUM : Number(r);
  });
}
shiftFn('BITLSHIFT', 1);
shiftFn('BITRSHIFT', -1);

// ---------- Divers ----------

numFn(E, 'DELTA', 1, 2, ([a = 0, b = 0]) => (a === b ? 1 : 0));
numFn(E, 'GESTEP', 1, 2, ([n = 0, s = 0]) => (n >= s ? 1 : 0));
numFn(E, 'ERF', 1, 2, (a) => (a.length === 2 ? erf(a[1] ?? 0) - erf(a[0] ?? 0) : erf(a[0] ?? 0)));
numFn(E, 'ERF.PRECISE', 1, 1, ([x = 0]) => erf(x));
numFn(E, 'ERFC', 1, 1, ([x = 0]) => erfc(x));
numFn(E, 'ERFC.PRECISE', 1, 1, ([x = 0]) => erfc(x));

// ---------- Bessel (integrales calculees par la methode des trapezes) ----------

/** Integrale sur [0, pi] (methode de Simpson, n pair). */
function periodic(f: (t: number) => number, n = 2000): number {
  const h = Math.PI / n;
  let s = f(0) + f(Math.PI);
  for (let i = 1; i < n; i++) s += (i % 2 === 1 ? 4 : 2) * f(i * h);
  return (s * h) / 3;
}

/** Integrale sur [0, +inf[ d'une fonction a decroissance rapide (methode de Simpson). */
function tail(f: (t: number) => number, h = 0.002): number {
  let s = f(0);
  for (let i = 1; ; i++) {
    const t = i * h;
    const v = f(t);
    s += (i % 2 === 1 ? 4 : 2) * v;
    if (i % 2 === 0 && (t > 40 || (t > 1 && Math.abs(v) < 1e-18))) {
      s -= v;
      break;
    }
  }
  return (s * h) / 3;
}

const besselJ = (x: number, n: number): number => periodic((t) => Math.cos(n * t - x * Math.sin(t))) / Math.PI;
const besselI = (x: number, n: number): number => periodic((t) => Math.exp(x * Math.cos(t)) * Math.cos(n * t)) / Math.PI;
const besselK = (x: number, n: number): number => tail((t) => Math.exp(-x * Math.cosh(t)) * Math.cosh(n * t));
const besselY = (x: number, n: number): number =>
  periodic((t) => Math.sin(x * Math.sin(t) - n * t)) / Math.PI -
  tail((t) => (Math.exp(n * t) + (n % 2 === 0 ? 1 : -1) * Math.exp(-n * t)) * Math.exp(-x * Math.sinh(t))) / Math.PI;

function besselFn(name: string, f: (x: number, n: number) => number, positive: boolean): void {
  numFn(E, name, 2, 2, ([x = 0, n = 0]) => {
    const k = Math.trunc(n);
    if (k < 0 || (positive && x <= 0)) return ERR.NUM;
    return f(x, k);
  });
}
besselFn('BESSELJ', besselJ, false);
besselFn('BESSELI', besselI, false);
besselFn('BESSELK', besselK, true);
besselFn('BESSELY', besselY, true);
