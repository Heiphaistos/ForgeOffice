// Courbes de tendance et barres d'erreur : calculs (purs) et tracé des superpositions d'une série.
import type { ChartErrorBars, ChartTrendline } from '@forgeoffice/pptx';

export interface Fit {
  /** Valeur de la tendance en x ; null hors du domaine (log, puissance pour x <= 0). */
  at: (x: number) => number | null;
  /** Equation affichable et coefficient de determination R2. */
  equation: string;
  r2: number | null;
}

const sum = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0);

/** Moindres carres d'un polynome de degre `order` (equations normales, elimination de Gauss). */
function polyFit(xs: readonly number[], ys: readonly number[], order: number): number[] | null {
  const n = order + 1;
  const a: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (j < n ? sum(xs.map((x) => x ** (i + j))) : sum(xs.map((x, k) => x ** i * (ys[k] as number)))) ));
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs((a[r] as number[])[i] as number) > Math.abs((a[p] as number[])[i] as number)) p = r;
    [a[i], a[p]] = [a[p] as number[], a[i] as number[]];
    const pivot = (a[i] as number[])[i] as number;
    if (Math.abs(pivot) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = ((a[r] as number[])[i] as number) / pivot;
      for (let c = i; c <= n; c++) (a[r] as number[])[c] = ((a[r] as number[])[c] as number) - f * ((a[i] as number[])[c] as number);
    }
  }
  return a.map((row, i) => (row[n] as number) / (row[i] as number));
}

const fmt = (v: number): string => String(Math.round(v * 10000) / 10000).replace('.', ',');

function r2Of(xs: readonly number[], ys: readonly number[], f: (x: number) => number | null): number | null {
  const mean = sum(ys) / ys.length;
  const tot = sum(ys.map((y) => (y - mean) ** 2));
  const res = sum(ys.map((y, i) => (y - (f(xs[i] as number) ?? mean)) ** 2));
  return tot === 0 ? null : 1 - res / tot;
}

/** Ajustement d'une tendance sur des points (x, y) numeriques ; null s'il y a trop peu de points ou si le modele est impossible. */
export function fitTrend(t: Pick<ChartTrendline, 'type' | 'order' | 'period' | 'intercept'>, xs: readonly number[], ys: readonly number[]): Fit | null {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  if (t.type === 'movingAvg') {
    const period = Math.max(2, Math.min(xs.length, Math.round(t.period ?? 2)));
    const avg = (x: number): number | null => {
      const i = xs.findIndex((v) => v === x);
      if (i < period - 1) return null;
      return sum(ys.slice(i - period + 1, i + 1)) / period;
    };
    return { at: avg, equation: '', r2: null };
  }
  if (t.type === 'linear' || t.type === 'poly') {
    const order = t.type === 'linear' ? 1 : Math.max(2, Math.min(6, Math.round(t.order ?? 2)));
    const c = polyFit(xs, ys, order);
    if (!c) return null;
    const at = (x: number): number => c.reduce((acc, k, i) => acc + k * x ** i, 0);
    const terms = c.map((k, i) => ({ k, i })).reverse().map(({ k, i }) => `${fmt(k)}${i === 0 ? '' : i === 1 ? 'x' : `x^${i}`}`);
    return { at, equation: `y = ${terms.join(' + ').replace(/\+ -/g, '- ')}`, r2: r2Of(xs, ys, at) };
  }
  if (t.type === 'exp') {
    if (ys.some((y) => y <= 0)) return null;
    const c = polyFit(xs, ys.map(Math.log), 1);
    if (!c) return null;
    const at = (x: number): number => Math.exp(c[0] as number) * Math.exp((c[1] as number) * x);
    return { at, equation: `y = ${fmt(Math.exp(c[0] as number))}e^${fmt(c[1] as number)}x`, r2: r2Of(xs, ys, at) };
  }
  if (t.type === 'log') {
    if (xs.some((x) => x <= 0)) return null;
    const c = polyFit(xs.map(Math.log), ys, 1);
    if (!c) return null;
    const at = (x: number): number | null => (x > 0 ? (c[0] as number) + (c[1] as number) * Math.log(x) : null);
    return { at, equation: `y = ${fmt(c[1] as number)}ln(x) + ${fmt(c[0] as number)}`, r2: r2Of(xs, ys, at) };
  }
  if (t.type === 'power') {
    if (xs.some((x) => x <= 0) || ys.some((y) => y <= 0)) return null;
    const c = polyFit(xs.map(Math.log), ys.map(Math.log), 1);
    if (!c) return null;
    const at = (x: number): number | null => (x > 0 ? Math.exp(c[0] as number) * x ** (c[1] as number) : null);
    return { at, equation: `y = ${fmt(Math.exp(c[0] as number))}x^${fmt(c[1] as number)}`, r2: r2Of(xs, ys, at) };
  }
  return null;
}

/** Ecart (plus, moins) des barres d'erreur de chaque point. */
export function errorAmounts(eb: Pick<ChartErrorBars, 'valueType' | 'value'>, values: ReadonlyArray<number | null>): Array<number | null> {
  const nums = values.filter((v): v is number => v !== null);
  const mean = nums.length ? sum(nums) / nums.length : 0;
  const sd = nums.length > 1 ? Math.sqrt(sum(nums.map((v) => (v - mean) ** 2)) / (nums.length - 1)) : 0;
  const v = eb.value ?? 1;
  return values.map((x) => {
    if (x === null) return null;
    switch (eb.valueType) {
      case 'percentage': return Math.abs(x) * (v / 100);
      case 'stdDev': return sd * v;
      case 'stdErr': return nums.length ? sd / Math.sqrt(nums.length) : 0;
      default: return v;
    }
  });
}
