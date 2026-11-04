// Nombres complexes d'Excel (COMPLEXE, COMPLEXE.SOMME...) : texte "a+bi" ou "a+bj".
import { toMatrix, toNumber, toText } from '../eval/coerce.ts';
import type { EvalContext } from '../eval/types.ts';
import { ERR, FormulaError, Matrix } from '../values.ts';
import { define, type Arg } from './registry.ts';

const E = 'engineering' as const;

interface Cx {
  re: number;
  im: number;
  /** '' quand le texte n'a pas de partie imaginaire. */
  sfx: '' | 'i' | 'j';
}

const NUM = /^[+-]?(?:\d+[.,]?\d*|[.,]\d+)(?:[eE][+-]?\d+)?$/;
const num = (s: string): number => Number(s.replace(',', '.'));

export function parseComplex(text: string): Cx | undefined {
  const s = text.trim();
  if (s === '') return { re: 0, im: 0, sfx: '' };
  const last = s[s.length - 1];
  if (last !== 'i' && last !== 'j') return NUM.test(s) ? { re: num(s), im: 0, sfx: '' } : undefined;
  const body = s.slice(0, -1);
  let k = -1;
  for (let i = body.length - 1; i > 0; i--) {
    const ch = body[i];
    if ((ch === '+' || ch === '-') && body[i - 1] !== 'e' && body[i - 1] !== 'E') {
      k = i;
      break;
    }
  }
  const reText = k < 0 ? '' : body.slice(0, k);
  const imText = k < 0 ? body : body.slice(k);
  if (reText !== '' && !NUM.test(reText)) return undefined;
  let im: number;
  if (imText === '' || imText === '+') im = 1;
  else if (imText === '-') im = -1;
  else if (NUM.test(imText)) im = num(imText);
  else return undefined;
  return { re: reText === '' ? 0 : num(reText), im, sfx: last };
}

function fmt(x: number, ctx: EvalContext): string {
  let s = String(Number(x.toPrecision(15))).toUpperCase();
  if (s.includes('E') && !s.includes('E-')) s = s.replace('E', 'E+').replace('E++', 'E+');
  return ctx.wb.locale === 'fr-FR' ? s.replace('.', ',') : s;
}

export function formatComplex(z: { re: number; im: number }, sfx: string, ctx: EvalContext): string | FormulaError {
  if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) return ERR.NUM;
  const re = Math.abs(z.re) < 1e-300 ? 0 : z.re;
  const im = Math.abs(z.im) < 1e-300 ? 0 : z.im;
  if (im === 0) return fmt(re, ctx);
  const imPart = im === 1 ? '' : im === -1 ? '-' : fmt(im, ctx);
  if (re === 0) return imPart + sfx;
  return fmt(re, ctx) + (im > 0 ? '+' : '') + imPart + sfx;
}

function cxArg(a: Arg, ctx: EvalContext): Cx | FormulaError {
  if (typeof a === 'number') return { re: a, im: 0, sfx: '' };
  if (typeof a === 'boolean') return ERR.VALUE;
  const t = toText(a, ctx);
  if (t instanceof FormulaError) return t;
  return parseComplex(t) ?? ERR.NUM;
}

function mergeSfx(zs: Cx[]): string | FormulaError {
  let s = '';
  for (const z of zs) {
    if (z.sfx === '') continue;
    if (s !== '' && s !== z.sfx) return ERR.VALUE;
    s = z.sfx;
  }
  return s === '' ? 'i' : s;
}

type C = { re: number; im: number };
const mul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const div = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
const cexp = (a: C): C => ({ re: Math.exp(a.re) * Math.cos(a.im), im: Math.exp(a.re) * Math.sin(a.im) });
const cln = (a: C): C => ({ re: Math.log(Math.hypot(a.re, a.im)), im: Math.atan2(a.im, a.re) });
const csin = (a: C): C => ({ re: Math.sin(a.re) * Math.cosh(a.im), im: Math.cos(a.re) * Math.sinh(a.im) });
const ccos = (a: C): C => ({ re: Math.cos(a.re) * Math.cosh(a.im), im: -Math.sin(a.re) * Math.sinh(a.im) });
const csinh = (a: C): C => ({ re: Math.sinh(a.re) * Math.cos(a.im), im: Math.cosh(a.re) * Math.sin(a.im) });
const ccosh = (a: C): C => ({ re: Math.cosh(a.re) * Math.cos(a.im), im: Math.sinh(a.re) * Math.sin(a.im) });
const ONE: C = { re: 1, im: 0 };
const isZero = (a: C): boolean => a.re === 0 && a.im === 0;

function cpow(z: C, n: number): C {
  const r = Math.hypot(z.re, z.im) ** n;
  const t = Math.atan2(z.im, z.re) * n;
  return { re: r * Math.cos(t), im: r * Math.sin(t) };
}

define(E, 'COMPLEX', { min: 2, max: 3 }, ([re, im, sfx], ctx) => {
  const a = toNumber(re, ctx);
  if (a instanceof FormulaError) return a;
  const b = toNumber(im, ctx);
  if (b instanceof FormulaError) return b;
  let s = 'i';
  if (sfx !== undefined && sfx !== null) {
    const t = toText(sfx, ctx);
    if (t instanceof FormulaError) return t;
    if (t !== 'i' && t !== 'j' && t !== '') return ERR.VALUE;
    if (t !== '') s = t;
  }
  return formatComplex({ re: a, im: b }, s, ctx);
});

function unary(name: string, f: (z: Cx, ctx: EvalContext) => number | C | FormulaError): void {
  define(E, name, { min: 1 }, ([a], ctx) => {
    const z = cxArg(a, ctx);
    if (z instanceof FormulaError) return z;
    const r = f(z, ctx);
    if (typeof r === 'number' || r instanceof FormulaError) return r;
    return formatComplex(r, z.sfx === '' ? 'i' : z.sfx, ctx);
  });
}
unary('IMREAL', (z) => z.re);
unary('IMAGINARY', (z) => z.im);
unary('IMABS', (z) => Math.hypot(z.re, z.im));
unary('IMARGUMENT', (z) => (isZero(z) ? ERR.DIV0 : Math.atan2(z.im, z.re)));
unary('IMCONJUGATE', (z) => ({ re: z.re, im: -z.im }));
unary('IMSQRT', (z) => cpow(z, 0.5));
unary('IMEXP', (z) => cexp(z));
unary('IMLN', (z) => (isZero(z) ? ERR.NUM : cln(z)));
unary('IMLOG10', (z) => (isZero(z) ? ERR.NUM : div(cln(z), { re: Math.LN10, im: 0 })));
unary('IMLOG2', (z) => (isZero(z) ? ERR.NUM : div(cln(z), { re: Math.LN2, im: 0 })));
unary('IMSIN', (z) => csin(z));
unary('IMCOS', (z) => ccos(z));
unary('IMTAN', (z) => div(csin(z), ccos(z)));
unary('IMCOT', (z) => (isZero(z) ? ERR.NUM : div(ccos(z), csin(z))));
unary('IMSEC', (z) => div(ONE, ccos(z)));
unary('IMCSC', (z) => (isZero(z) ? ERR.NUM : div(ONE, csin(z))));
unary('IMSINH', (z) => csinh(z));
unary('IMCOSH', (z) => ccosh(z));
unary('IMSECH', (z) => div(ONE, ccosh(z)));
unary('IMCSCH', (z) => (isZero(z) ? ERR.NUM : div(ONE, csinh(z))));

define(E, 'IMPOWER', { min: 2 }, ([a, n], ctx) => {
  const z = cxArg(a, ctx);
  if (z instanceof FormulaError) return z;
  const p = toNumber(n, ctx);
  if (p instanceof FormulaError) return p;
  if (isZero(z) && p <= 0) return ERR.NUM;
  return formatComplex(cpow(z, p), z.sfx === '' ? 'i' : z.sfx, ctx);
});

function binary(name: string, f: (a: C, b: C) => C | FormulaError): void {
  define(E, name, { min: 2 }, ([x, y], ctx) => {
    const a = cxArg(x, ctx);
    if (a instanceof FormulaError) return a;
    const b = cxArg(y, ctx);
    if (b instanceof FormulaError) return b;
    const s = mergeSfx([a, b]);
    if (s instanceof FormulaError) return s;
    const r = f(a, b);
    return r instanceof FormulaError ? r : formatComplex(r, s, ctx);
  });
}
binary('IMSUB', (a, b) => ({ re: a.re - b.re, im: a.im - b.im }));
binary('IMDIV', (a, b) => (isZero(b) ? ERR.NUM : div(a, b)));

function fold(name: string, init: C, f: (a: C, b: C) => C): void {
  define(E, name, { min: 1, max: 255, kinds: 'V' }, (args, ctx) => {
    const zs: Cx[] = [];
    for (const a of args) {
      const m = a instanceof Matrix ? a : toMatrix(a, ctx);
      if (m instanceof FormulaError) return m;
      for (const v of m.data) {
        if (v === null) continue;
        const z = cxArg(v, ctx);
        if (z instanceof FormulaError) return z;
        zs.push(z);
      }
    }
    const s = mergeSfx(zs);
    if (s instanceof FormulaError) return s;
    return formatComplex(zs.reduce<C>((acc, z) => f(acc, z), init), s, ctx);
  });
}
fold('IMSUM', { re: 0, im: 0 }, (a, b) => ({ re: a.re + b.re, im: a.im + b.im }));
fold('IMPRODUCT', ONE, mul);
