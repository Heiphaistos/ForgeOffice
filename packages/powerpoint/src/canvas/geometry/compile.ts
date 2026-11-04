// Compilation des formes predefinies (tables compactes) et personnalisees vers une structure commune.
import type { Geometry, GeometryGuide, GeometryPath, PathCommand, PathPoint, PathValue } from '@forgeoffice/pptx';
import { compileFormula, type Guide } from './formula.ts';
import type { PresetDef } from './types.ts';
import { PRESETS_1 } from './presets-1.ts';
import { PRESETS_2 } from './presets-2.ts';
import { PRESETS_3 } from './presets-3.ts';
import { PRESETS_4 } from './presets-4.ts';
import { PRESETS_5 } from './presets-5.ts';

const PRESETS: Readonly<Record<string, PresetDef>> = { ...PRESETS_1, ...PRESETS_2, ...PRESETS_3, ...PRESETS_4, ...PRESETS_5 };

/** Noms de toutes les formes predefinies connues. */
export const PRESET_NAMES: readonly string[] = Object.keys(PRESETS);

export interface HandleDef {
  polar: boolean;
  /** xy : gdRefX / gdRefY ; polar : gdRefR / gdRefAng. */
  ref1?: string;
  min1: string;
  max1: string;
  ref2?: string;
  min2: string;
  max2: string;
  x: PathValue;
  y: PathValue;
}

export interface Compiled {
  av: Guide[];
  gd: Guide[];
  ah: HandleDef[];
  cxn: Array<{ angle: PathValue; x: PathValue; y: PathValue }>;
  rect?: [PathValue, PathValue, PathValue, PathValue];
  paths: GeometryPath[];
}

export const isKnownPreset = (name: string): boolean => Object.hasOwn(PRESETS, name);

const guide = (text: string): Guide => {
  const i = text.indexOf(' ');
  return { name: text.slice(0, i), formula: compileFormula(text.slice(i + 1)) };
};

const opt = (t: string | undefined): string | undefined => (t === undefined || t === '_' ? undefined : t);

function handle(text: string): HandleDef {
  const [kind, r1, mn1 = '0', mx1 = '0', r2, mn2 = '0', mx2 = '0', x = '0', y = '0'] = text.split(' ');
  const h: HandleDef = { polar: kind === 'polar', min1: mn1, max1: mx1, min2: mn2, max2: mx2, x, y };
  const ref1 = opt(r1);
  if (ref1) h.ref1 = ref1;
  const ref2 = opt(r2);
  if (ref2) h.ref2 = ref2;
  return h;
}

function presetPath(items: readonly string[]): GeometryPath {
  const path: GeometryPath = { commands: [] };
  for (const item of items) {
    const [letter = '', ...v] = item.split(' ');
    const p = (i: number): PathPoint => ({ x: v[i] ?? 0, y: v[i + 1] ?? 0 });
    let cmd: PathCommand | undefined;
    if (letter.includes('=')) {
      for (const attr of item.split(' ')) {
        const [key, val = ''] = attr.split('=');
        if (key === 'w') path.width = Number(val);
        else if (key === 'h') path.height = Number(val);
        else if (key === 'fill') path.fill = val as GeometryPath['fill'];
        else if (key === 'stroke') path.stroke = val !== '0';
      }
    } else if (letter === 'M') cmd = { cmd: 'moveTo', pt: p(0) };
    else if (letter === 'L') cmd = { cmd: 'lineTo', pt: p(0) };
    else if (letter === 'C') cmd = { cmd: 'cubicBezTo', pts: [p(0), p(2), p(4)] };
    else if (letter === 'Q') cmd = { cmd: 'quadBezTo', pts: [p(0), p(2)] };
    else if (letter === 'A') cmd = { cmd: 'arcTo', wR: v[0] ?? 0, hR: v[1] ?? 0, stAng: v[2] ?? 0, swAng: v[3] ?? 0 };
    else if (letter === 'Z') cmd = { cmd: 'close' };
    if (cmd) path.commands.push(cmd);
  }
  return path;
}

const cache = new Map<string, Compiled>();

/** Forme predefinie compilee (mise en cache) ; forme inconnue = rectangle. */
export function compilePreset(name: string): Compiled {
  const key = isKnownPreset(name) ? name : 'rect';
  const hit = cache.get(key);
  if (hit) return hit;
  const def = PRESETS[key] as PresetDef;
  const rect = def.rect?.split(' ');
  const compiled: Compiled = {
    av: (def.av ?? []).map(guide),
    gd: (def.gd ?? []).map(guide),
    ah: (def.ah ?? []).map(handle),
    cxn: (def.cxn ?? []).map((c) => {
      const [angle = '0', x = '0', y = '0'] = c.split(' ');
      return { angle, x, y };
    }),
    paths: def.path.map(presetPath),
  };
  if (rect) compiled.rect = [rect[0] ?? 'l', rect[1] ?? 't', rect[2] ?? 'r', rect[3] ?? 'b'];
  cache.set(key, compiled);
  return compiled;
}

const toGuides = (list: readonly GeometryGuide[] | undefined): Guide[] =>
  (list ?? []).map((g) => ({ name: g.name, formula: compileFormula(g.formula) }));

/** Geometrie personnalisee (custGeom) : pas de poignees (le modele ne conserve pas ahLst). */
export function compileCustom(geometry: Extract<Geometry, { type: 'custom' }>): Compiled {
  const compiled: Compiled = {
    av: toGuides(geometry.adjust),
    gd: toGuides(geometry.guides),
    ah: [],
    cxn: (geometry.connectionSites ?? []).map((c) => ({ angle: c.angle, x: c.pos.x, y: c.pos.y })),
    paths: geometry.paths,
  };
  const r = geometry.textRect;
  if (r) compiled.rect = [r.l, r.t, r.r, r.b];
  return compiled;
}
