// Calculs numeriques purs : statistiques descriptives et fonctions speciales (erf, gamma, beta...).

export function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function mean(xs: readonly number[]): number {
  return sum(xs) / xs.length;
}

/** Somme des carres des ecarts (algorithme en deux passes). */
export function devsq(xs: readonly number[]): number {
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return s;
}

export function variance(xs: readonly number[], population: boolean): number {
  const n = xs.length;
  return devsq(xs) / (population ? n : n - 1);
}

export function sorted(xs: readonly number[]): number[] {
  return [...xs].sort((a, b) => a - b);
}

export function median(xs: readonly number[]): number {
  const s = sorted(xs);
  const n = s.length;
  const h = Math.floor(n / 2);
  return n % 2 ? (s[h] ?? NaN) : ((s[h - 1] ?? NaN) + (s[h] ?? NaN)) / 2;
}

/** Valeurs les plus frequentes dans l'ordre de premiere apparition (MODE.MULTIPLE). */
export function modes(xs: readonly number[]): number[] {
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best = 1;
  for (const c of counts.values()) best = Math.max(best, c);
  if (best < 2) return [];
  const out: number[] = [];
  for (const x of xs) if (counts.get(x) === best && !out.includes(x)) out.push(x);
  return out;
}

/** Centile inclusif (CENTILE.INCLURE) sur valeurs triees. */
export function percentileInc(s: readonly number[], p: number): number {
  const n = s.length;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const a = s[lo] ?? NaN;
  const b = s[Math.min(lo + 1, n - 1)] ?? NaN;
  return a + (h - lo) * (b - a);
}

/** Centile exclusif (CENTILE.EXCLURE) ; NaN si hors limites. */
export function percentileExc(s: readonly number[], p: number): number {
  const n = s.length;
  const h = (n + 1) * p;
  if (h < 1 || h > n) return NaN;
  const lo = Math.floor(h);
  const a = s[lo - 1] ?? NaN;
  const b = s[Math.min(lo, n - 1)] ?? NaN;
  return a + (h - lo) * (b - a);
}

function scaleBack(r: number, d: number): number {
  return d >= 0 ? r / 10 ** d : r * 10 ** -d;
}

function scaled(x: number, d: number): number {
  return Number((Math.abs(x) * 10 ** d).toPrecision(15));
}

/** Arrondi a n decimales, moitie loin de zero, robuste aux erreurs binaires (ARRONDI d'Excel). */
export function roundHalfAway(x: number, digits: number): number {
  const d = Math.trunc(digits);
  if (!Number.isFinite(x) || x === 0 || d > 15) return x;
  return Math.sign(x) * scaleBack(Math.floor(scaled(x, d) + 0.5), d);
}

export function roundDown(x: number, digits: number): number {
  const d = Math.trunc(digits);
  if (!Number.isFinite(x) || x === 0 || d > 15) return x;
  return Math.sign(x) * scaleBack(Math.floor(scaled(x, d)), d);
}

export function roundUp(x: number, digits: number): number {
  const d = Math.trunc(digits);
  if (!Number.isFinite(x) || x === 0 || d > 15) return x;
  return Math.sign(x) * scaleBack(Math.ceil(scaled(x, d)), d);
}

// ---------- Fonctions speciales ----------

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function gammaln(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - gammaln(1 - x);
  const xx = x - 1;
  let a = LANCZOS[0] ?? 1;
  const t = xx + 7.5;
  for (let i = 1; i < 9; i++) a += (LANCZOS[i] ?? 0) / (xx + i);
  return 0.5 * Math.log(2 * Math.PI) + (xx + 0.5) * Math.log(t) - t + Math.log(a);
}

export function gamma(x: number): number {
  if (Number.isInteger(x)) {
    if (x <= 0) return NaN;
    if (x <= 171) return factorial(x - 1);
  }
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  if (x > 171.6) return Infinity;
  const xx = x - 1;
  let a = LANCZOS[0] ?? 1;
  const t = xx + 7.5;
  for (let i = 1; i < 9; i++) a += (LANCZOS[i] ?? 0) / (xx + i);
  return Math.sqrt(2 * Math.PI) * t ** (xx + 0.5) * Math.exp(-t) * a;
}

const FACT_CACHE: number[] = [1];
export function factorial(n: number): number {
  if (n < 0) return NaN;
  if (n > 170) return Infinity;
  const k = Math.floor(n);
  for (let i = FACT_CACHE.length; i <= k; i++) FACT_CACHE[i] = (FACT_CACHE[i - 1] ?? 1) * i;
  return FACT_CACHE[k] ?? NaN;
}

export function combin(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= kk; i++) r = (r * (n - kk + i)) / i;
  return Math.round(r);
}

/** erf de W. J. Cody (precision ~1e-16). */
export function erf(x: number): number {
  const ax = Math.abs(x);
  if (ax < 0.5) {
    const t = x * x;
    const p = [3.1611237438705656, 113.86415415105016, 377.485237685302, 3209.3775891384694, 0.18577770618460315];
    const q = [23.601290952344122, 244.02463793444417, 1282.6165260773723, 2844.2368334391704];
    let num = (p[4] ?? 0) * t;
    let den = t;
    for (let i = 0; i < 3; i++) {
      num = (num + (p[i] ?? 0)) * t;
      den = (den + (q[i] ?? 0)) * t;
    }
    return (x * (num + (p[3] ?? 0))) / (den + (q[3] ?? 0));
  }
  const r = 1 - erfc(ax);
  return x < 0 ? -r : r;
}

export function erfc(x: number): number {
  const ax = Math.abs(x);
  if (ax < 0.5) return 1 - erf(x);
  let r: number;
  if (ax <= 4) {
    const p = [
      0.56418849698867008, 8.8831497943883759, 66.119190637141634, 298.63513819740013, 881.95222124176909,
      1712.0476126340707, 2051.0783778260716, 1230.339354797997, 2.1531153547440383e-8,
    ];
    const q = [
      15.744926110709835, 117.6939508913125, 537.18110186200986, 1621.3895745666903, 3290.7992357334842,
      4362.6190901432471, 3439.3676741437216, 1230.3393548037495,
    ];
    let num = (p[8] ?? 0) * ax;
    let den = ax;
    for (let i = 0; i < 7; i++) {
      num = (num + (p[i] ?? 0)) * ax;
      den = (den + (q[i] ?? 0)) * ax;
    }
    r = (num + (p[7] ?? 0)) / (den + (q[7] ?? 0));
  } else {
    const p = [0.30532663496123236, 0.36034489994980445, 0.12578172611122926, 0.016083785148742275, 6.587491615298378e-4, 0.016315387137302097];
    const q = [2.5685201922898682, 1.8729528499234604, 0.52790510295142217, 0.060518341312441320, 0.0023352049762686918];
    const z = 1 / (ax * ax);
    let num = (p[5] ?? 0) * z;
    let den = z;
    for (let i = 0; i < 4; i++) {
      num = (num + (p[i] ?? 0)) * z;
      den = (den + (q[i] ?? 0)) * z;
    }
    r = (z * (num + (p[4] ?? 0))) / (den + (q[4] ?? 0));
    r = (0.5641895835477563 - r) / ax;
  }
  const y = Math.trunc(ax * 16) / 16;
  const del = (ax - y) * (ax + y);
  r *= Math.exp(-y * y) * Math.exp(-del);
  return x < 0 ? 2 - r : r;
}

/** Fonction de repartition de la loi normale centree reduite. */
export function normCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

export function normPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/** Inverse de la loi normale (Acklam + raffinement de Halley). */
export function normInv(p: number): number {
  if (p <= 0 || p >= 1) return NaN;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const g = (arr: number[], i: number): number => arr[i] ?? 0;
  let x: number;
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((g(c, 0) * q + g(c, 1)) * q + g(c, 2)) * q + g(c, 3)) * q + g(c, 4)) * q + g(c, 5)) /
      ((((g(d, 0) * q + g(d, 1)) * q + g(d, 2)) * q + g(d, 3)) * q + 1);
  } else if (p <= 1 - 0.02425) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((g(a, 0) * r + g(a, 1)) * r + g(a, 2)) * r + g(a, 3)) * r + g(a, 4)) * r + g(a, 5)) * q) /
      (((((g(b, 0) * r + g(b, 1)) * r + g(b, 2)) * r + g(b, 3)) * r + g(b, 4)) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((g(c, 0) * q + g(c, 1)) * q + g(c, 2)) * q + g(c, 3)) * q + g(c, 4)) * q + g(c, 5)) /
      ((((g(d, 0) * q + g(d, 1)) * q + g(d, 2)) * q + g(d, 3)) * q + 1);
  }
  for (let i = 0; i < 2; i++) {
    const e = normCdf(x) - p;
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
    x -= u / (1 + (x * u) / 2);
  }
  return x;
}

/** Gamma incomplete reguliere inferieure P(a, x). */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let ap = a;
    let s = 1 / a;
    let del = s;
    for (let n = 0; n < 1000; n++) {
      ap += 1;
      del *= x / ap;
      s += del;
      if (Math.abs(del) < Math.abs(s) * 1e-16) break;
    }
    return s * Math.exp(-x + a * Math.log(x) - gammaln(a));
  }
  return 1 - gammaQcf(a, x);
}

function gammaQcf(a: number, x: number): number {
  const FPMIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}

export function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  return x < a + 1 ? 1 - gammaP(a, x) : gammaQcf(a, x);
}

function betacf(a: number, b: number, x: number): number {
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 3000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return h;
}

/** Beta incomplete reguliere I_x(a, b). */
export function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Inverse d'une fonction croissante sur [lo, hi] par dichotomie + secante. */
export function invert(f: (x: number) => number, p: number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  let fa = f(a) - p;
  let fb = f(b) - p;
  for (let k = 0; fa * fb > 0 && k < 200; k++) {
    if (Math.abs(fa) < Math.abs(fb)) {
      a -= (b - a) * 2;
      fa = f(a) - p;
    } else {
      b += (b - a) * 2;
      fb = f(b) - p;
    }
  }
  if (fa * fb > 0) return NaN;
  for (let i = 0; i < 300; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m) - p;
    if (fm === 0 || (b - a) / 2 < 1e-15 * Math.max(1, Math.abs(m))) return m;
    if (fa * fm < 0) {
      b = m;
    } else {
      a = m;
      fa = fm;
    }
  }
  return 0.5 * (a + b);
}

export function tCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  const tail = 0.5 * betaInc(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

export function tPdf(t: number, df: number): number {
  return Math.exp(gammaln((df + 1) / 2) - gammaln(df / 2) - 0.5 * Math.log(df * Math.PI) - ((df + 1) / 2) * Math.log(1 + (t * t) / df));
}

export function chiCdf(x: number, df: number): number {
  return gammaP(df / 2, x / 2);
}

export function fCdf(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0;
  return betaInc((d1 * x) / (d1 * x + d2), d1 / 2, d2 / 2);
}

/** Resout f(x) = 0 par Newton avec derivee numerique, repli sur la secante. */
export function newton(f: (x: number) => number, guess: number, maxIter = 100, tol = 1e-10): number {
  let x = guess;
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x);
    if (!Number.isFinite(fx)) return NaN;
    if (Math.abs(fx) < tol) return x;
    const h = Math.max(1e-7, Math.abs(x) * 1e-7);
    const d = (f(x + h) - fx) / h;
    if (d === 0 || !Number.isFinite(d)) return NaN;
    const nx = x - fx / d;
    if (Math.abs(nx - x) < tol * Math.max(1, Math.abs(x))) return nx;
    x = nx;
  }
  return NaN;
}
