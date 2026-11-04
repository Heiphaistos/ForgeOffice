// CONVERT : conversion d'unites (table d'Excel, prefixes decimaux et binaires).
import { toNumber, toText } from '../eval/coerce.ts';
import { ERR, FormulaError } from '../values.ts';
import { define } from './registry.ts';

interface Unit {
  /** Grandeur (deux unites ne se convertissent que dans la meme grandeur). */
  q: string;
  /** Valeur en unite de base de la grandeur. */
  f: number;
  /** Accepte les prefixes metriques (k, m, M...). */
  p?: boolean;
  /** Accepte les prefixes binaires (ki, Mi...). */
  b?: boolean;
}

const U: Record<string, Unit> = {};
function add(q: string, names: string, f: number, p = false, b = false): void {
  for (const n of names.split(' ')) U[n] = { q, f, p, b };
}

// Masse (gramme)
add('mass', 'g', 1, true);
add('mass', 'sg', 14593.902937206);
add('mass', 'lbm', 453.59237);
add('mass', 'u', 1.66053906660e-24, true);
add('mass', 'ozm', 28.349523125);
add('mass', 'grain', 0.06479891);
add('mass', 'cwt shweight', 45359.237);
add('mass', 'uk_cwt lcwt hweight', 50802.34544);
add('mass', 'stone', 6350.29318);
add('mass', 'ton', 907184.74);
add('mass', 'uk_ton LTON brton', 1016046.9088);
// Distance (metre)
add('dist', 'm', 1, true);
add('dist', 'mi', 1609.344);
add('dist', 'Nmi', 1852);
add('dist', 'in', 0.0254);
add('dist', 'ft', 0.3048);
add('dist', 'yd', 0.9144);
add('dist', 'ang', 1e-10, true);
add('dist', 'ell', 1.143);
add('dist', 'ly', 9.4607304725808e15, true);
add('dist', 'parsec pc', 3.08567758149137e16, true);
add('dist', 'Picapt Pica', 0.0254 / 72);
add('dist', 'pica', 0.0254 / 6);
add('dist', 'survey_mi', 1609.3472186944373);
// Temps (seconde)
add('time', 'yr', 31557600, true);
add('time', 'day d', 86400, true);
add('time', 'hr', 3600, true);
add('time', 'mn min', 60, true);
add('time', 'sec s', 1, true);
// Pression (pascal)
add('pres', 'Pa p', 1, true);
add('pres', 'atm at', 101325, true);
add('pres', 'mmHg', 133.322, true);
add('pres', 'psi', 6894.75729316836);
add('pres', 'Torr', 133.322368421053);
// Force (newton)
add('force', 'N', 1, true);
add('force', 'dyn dy', 1e-5, true);
add('force', 'lbf', 4.4482216152605);
add('force', 'pond', 0.00980665, true);
// Energie (joule)
add('energy', 'J', 1, true);
add('energy', 'e', 1e-7, true);
add('energy', 'c', 4.184, true);
add('energy', 'cal', 4.1868, true);
add('energy', 'eV ev', 1.602176634e-19, true);
add('energy', 'HPh hh', 2684519.53769617);
add('energy', 'Wh wh', 3600, true);
add('energy', 'flb', 1.3558179483314);
add('energy', 'BTU btu', 1055.05585262);
// Puissance (watt)
add('power', 'HP h', 745.69987158227);
add('power', 'PS', 735.49875);
add('power', 'W w', 1, true);
// Magnetisme (tesla)
add('mag', 'T', 1, true);
add('mag', 'ga', 1e-4, true);
// Volume (metre cube)
add('vol', 'l L lt', 0.001, true);
add('vol', 'tsp', 4.92892159375e-6);
add('vol', 'tspm', 5e-6);
add('vol', 'tbs', 1.478676478125e-5);
add('vol', 'oz', 2.95735295625e-5);
add('vol', 'cup', 2.365882365e-4);
add('vol', 'pt us_pt', 4.73176473e-4);
add('vol', 'uk_pt', 5.6826125e-4);
add('vol', 'qt', 9.46352946e-4);
add('vol', 'uk_qt', 1.1365225e-3);
add('vol', 'gal', 3.785411784e-3);
add('vol', 'uk_gal', 4.54609e-3);
add('vol', 'm3', 1, true);
add('vol', 'ang3', 1e-30, true);
add('vol', 'barrel', 0.158987294928);
add('vol', 'bushel', 0.03523907016688);
add('vol', 'ft3', 0.028316846592);
add('vol', 'in3', 1.6387064e-5);
add('vol', 'yd3', 0.764554857984);
add('vol', 'mi3', 4.16818182544058e9);
add('vol', 'ly3', 8.46786664623715e47);
add('vol', 'Nmi3', 6352182208);
add('vol', 'MTON', 1.13267386368);
add('vol', 'GRT regton', 2.8316846592);
// Surface (metre carre)
add('area', 'm2', 1, true);
add('area', 'ang2', 1e-20, true);
add('area', 'ar', 100, true);
add('area', 'ha', 10000);
add('area', 'ft2', 0.09290304);
add('area', 'in2', 0.00064516);
add('area', 'yd2', 0.83612736);
add('area', 'mi2', 2589988.110336);
add('area', 'Nmi2', 3429904);
add('area', 'uk_acre', 4046.8564224);
add('area', 'us_acre', 4046.87260987425);
add('area', 'Morgen', 2500);
add('area', 'ly2', 8.95054210748189e31);
add('area', 'Picapt2 Pica2', (0.0254 / 72) ** 2);
// Information (bit)
add('info', 'bit', 1, true, true);
add('info', 'byte', 8, true, true);
// Vitesse (metre par seconde)
add('speed', 'm/s m/sec', 1, true);
add('speed', 'm/h m/hr', 1 / 3600, true);
add('speed', 'mph', 0.44704);
add('speed', 'kn', 1852 / 3600);
add('speed', 'admkn', 0.514773333333333);

const PREFIX: Record<string, number> = {
  Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 1e1, e: 1e1,
  d: 1e-1, c: 1e-2, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18, z: 1e-21, y: 1e-24,
};
const BINARY: Record<string, number> = {
  ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40, Pi: 2 ** 50, Ei: 2 ** 60, Zi: 2 ** 70, Yi: 2 ** 80,
};

const TEMPS = new Set(['C', 'cel', 'F', 'fah', 'K', 'kel', 'Rank', 'Reau']);

/** Unite -> grandeur + facteur, prefixe compris ; undefined si inconnue. */
function resolve(name: string): { q: string; f: number } | undefined {
  const u = U[name];
  if (u) return u;
  for (const [table, binary] of [[BINARY, true], [PREFIX, false]] as const) {
    for (const [pre, mult] of Object.entries(table)) {
      if (!name.startsWith(pre)) continue;
      const base = U[name.slice(pre.length)];
      if (!base || (binary ? !base.b : !base.p)) continue;
      const power = base.q === 'area' ? 2 : base.q === 'vol' && name.endsWith('3') ? 3 : 1;
      return { q: base.q, f: base.f * mult ** power };
    }
  }
  return undefined;
}

function toKelvin(v: number, u: string): number | undefined {
  switch (u) {
    case 'C':
    case 'cel':
      return v + 273.15;
    case 'F':
    case 'fah':
      return ((v - 32) * 5) / 9 + 273.15;
    case 'K':
    case 'kel':
      return v;
    case 'Rank':
      return (v * 5) / 9;
    case 'Reau':
      return v * 1.25 + 273.15;
    default:
      return undefined;
  }
}

function fromKelvin(k: number, u: string): number {
  switch (u) {
    case 'C':
    case 'cel':
      return k - 273.15;
    case 'F':
    case 'fah':
      return ((k - 273.15) * 9) / 5 + 32;
    case 'Rank':
      return (k * 9) / 5;
    case 'Reau':
      return (k - 273.15) * 0.8;
    default:
      return k;
  }
}

/** Conversion d'une valeur d'une unite a l'autre ; #N/A si les unites sont inconnues ou incompatibles. */
export function convertUnits(v: number, from: string, to: string): number | FormulaError {
  if (TEMPS.has(from) || TEMPS.has(to)) {
    if (!TEMPS.has(from) || !TEMPS.has(to)) return ERR.NA;
    return fromKelvin(toKelvin(v, from) ?? 0, to);
  }
  const a = resolve(from);
  const b = resolve(to);
  if (!a || !b || a.q !== b.q) return ERR.NA;
  return Number(((v * a.f) / b.f).toPrecision(15));
}

define('engineering', 'CONVERT', { min: 3 }, ([n, from, to], ctx) => {
  const v = toNumber(n, ctx);
  if (v instanceof FormulaError) return v;
  const a = toText(from, ctx);
  if (a instanceof FormulaError) return a;
  const b = toText(to, ctx);
  if (b instanceof FormulaError) return b;
  return convertUnits(v, a, b);
});
