// Moteur de geometrie DrawingML : formes predefinies et personnalisees -> chemins SVG, zone de texte,
// sites de connexion et poignees d'ajustement.
//
// Formes predefinies : unites = points, `adjust` = valeurs brutes OOXML.
// Formes personnalisees : valeurs brutes du fichier (EMU, comme les lit dml-read) ; un chemin sans
// width/height est donc en EMU de la forme. Un trace a main levee doit fixer path.width/height.
import { EMU_PER_PT, type Geometry } from '@forgeoffice/pptx';
import { compileCustom, compilePreset, isKnownPreset, type Compiled, type HandleDef } from './compile.ts';
import { builtinVars, evalGuides, valueOf, type Vars } from './formula.ts';
import { pathToSvg } from './path.ts';
import type { GeometryResult } from './types.ts';

export type { GeometryHandle, GeometryPathOut, GeometryResult } from './types.ts';

/** Formes lineaires, inserees sans remplissage. */
export const LINE_PRESETS: ReadonlySet<string> = new Set([
  'line', 'lineInv', 'straightConnector1',
  'bentConnector2', 'bentConnector3', 'bentConnector4', 'bentConnector5',
  'curvedConnector2', 'curvedConnector3', 'curvedConnector4', 'curvedConnector5',
  'arc', 'leftBracket', 'rightBracket', 'leftBrace', 'rightBrace', 'bracketPair', 'bracePair',
]);

export function isPresetKnown(preset: string): boolean {
  return isKnownPreset(preset);
}

interface Prepared {
  compiled: Compiled;
  /** Unites du modele par point (1 pour les presets, EMU_PER_PT pour les formes personnalisees). */
  unit: number;
  w: number;
  h: number;
  override?: Readonly<Record<string, number>>;
}

const size = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

function prepare(geometry: Geometry, width: number, height: number): Prepared {
  const custom = geometry.type === 'custom';
  const unit = custom ? EMU_PER_PT : 1;
  const prepared: Prepared = {
    compiled: custom ? compileCustom(geometry) : compilePreset(geometry.preset),
    unit,
    w: size(width) * unit,
    h: size(height) * unit,
  };
  if (!custom && geometry.adjust) prepared.override = geometry.adjust;
  return prepared;
}

function evaluate(p: Prepared, override = p.override): Vars {
  const vars = builtinVars(p.w, p.h);
  evalGuides(p.compiled.av, vars, override);
  evalGuides(p.compiled.gd, vars);
  return vars;
}

export function buildGeometry(geometry: Geometry, width: number, height: number): GeometryResult {
  const p = prepare(geometry, width, height);
  const { compiled, unit } = p;
  const vars = evaluate(p);
  const v = (t: string | number): number => valueOf(t, vars) / unit;
  const [l, t, r, b] = compiled.rect ? compiled.rect.map(v) : [0, 0, p.w / unit, p.h / unit];
  return {
    paths: compiled.paths.map((path) => {
      const sx = (path.width ? p.w / path.width : 1) / unit;
      const sy = (path.height ? p.h / path.height : 1) / unit;
      return { d: pathToSvg(path, vars, sx, sy), fill: path.fill ?? 'norm', stroke: path.stroke ?? true };
    }),
    textRect: { x: l ?? 0, y: t ?? 0, width: (r ?? 0) - (l ?? 0), height: (b ?? 0) - (t ?? 0) },
    connectionSites: compiled.cxn.map((c) => ({ x: v(c.x), y: v(c.y), angle: valueOf(c.angle, vars) / 60000 })),
    handles: compiled.ah.map((h) => ({ x: v(h.x), y: v(h.y) })),
  };
}

const SAMPLES = 64;
const REFINE = 60;
const GOLD = (Math.sqrt(5) - 1) / 2;

/** Minimum d'une fonction sur [lo, hi] : balayage puis section doree autour du meilleur echantillon. */
function minimize(lo: number, hi: number, f: (v: number) => number): number {
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi === lo) return lo;
  const step = (hi - lo) / SAMPLES;
  let best = lo;
  let bestErr = Infinity;
  for (let i = 0; i <= SAMPLES; i++) {
    const v = lo + step * i;
    const e = f(v);
    if (e < bestErr) [best, bestErr] = [v, e];
  }
  let a = Math.max(lo, best - step);
  let b = Math.min(hi, best + step);
  let c = b - GOLD * (b - a);
  let d = a + GOLD * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < REFINE; i++) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - GOLD * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + GOLD * (b - a);
      fd = f(d);
    }
  }
  const mid = (a + b) / 2;
  return f(mid) <= bestErr ? mid : best;
}

/**
 * Nouvelle table `adjust` (valeurs brutes) quand on glisse la poignee `index` au point local (x, y).
 * Chaque guide reference est cherche numeriquement sur [min, max] (bornes incluses).
 */
export function adjustFromPoint(geometry: Geometry, width: number, height: number, index: number, x: number, y: number): Record<string, number> {
  const p = prepare(geometry, width, height);
  const current: Record<string, number> = {};
  const base = evaluate(p);
  for (const g of p.compiled.av) current[g.name] = base.get(g.name) ?? 0;
  const handle: HandleDef | undefined = p.compiled.ah[index];
  if (!handle) return current;
  const tx = (Number.isFinite(x) ? x : 0) * p.unit;
  const ty = (Number.isFinite(y) ? y : 0) * p.unit;
  const error = (vars: Vars, axis: 1 | 2): number => {
    const hx = valueOf(handle.x, vars) - tx;
    const hy = valueOf(handle.y, vars) - ty;
    if (handle.polar) return Math.hypot(hx, hy);
    return Math.abs(axis === 1 ? hx : hy);
  };
  const solve = (ref: string, min: string, max: string, axis: 1 | 2): void => {
    const vars = evaluate(p, current);
    const lo = valueOf(min, vars);
    const hi = valueOf(max, vars);
    const best = minimize(lo, hi, (v) => error(evaluate(p, { ...current, [ref]: v }), axis));
    current[ref] = Math.round(Math.min(Math.max(best, Math.min(lo, hi)), Math.max(lo, hi)));
  };
  const rounds = handle.ref1 && handle.ref2 ? 2 : 1;
  for (let i = 0; i < rounds; i++) {
    if (handle.ref1) solve(handle.ref1, handle.min1, handle.max1, 1);
    if (handle.ref2) solve(handle.ref2, handle.min2, handle.max2, 2);
  }
  return current;
}
