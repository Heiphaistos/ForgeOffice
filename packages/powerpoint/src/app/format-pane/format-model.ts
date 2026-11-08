// Modele pur du volet Format : transparence des couleurs, degrades, motifs, traits, effets parametrables.
import type { Color, Effects, Fill, GradientStop, Line, LineEnd, Reflection, Shadow } from '@forgeoffice/pptx';

export type GradientFill = Extract<Fill, { type: 'gradient' }>;

// ---- Transparence ----

/** Transparence (0..100 %) d'une couleur d'apres son modificateur alpha. */
export function transparencyOf(color: Color): number {
  const alpha = color.mods?.find((m) => m.name === 'alpha')?.val;
  return alpha === undefined ? 0 : Math.round(100 - alpha / 1000);
}

/** Couleur avec la transparence demandee (0 = opaque : le modificateur est retire). */
export function withTransparency(color: Color, pct: number): Color {
  const mods = (color.mods ?? []).filter((m) => m.name !== 'alpha');
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (clamped > 0) mods.push({ name: 'alpha', val: (100 - clamped) * 1000 });
  const out = { ...color } as Color;
  if (mods.length) out.mods = mods;
  else delete out.mods;
  return out;
}

// ---- Remplissages ----

export type FillKind = 'none' | 'solid' | 'gradient' | 'image' | 'pattern';

export const fillKind = (fill: Fill | undefined): FillKind => (!fill || fill.type === 'group' ? 'none' : fill.type);

export function defaultGradient(base: Color): GradientFill {
  return {
    type: 'gradient', kind: 'linear', angle: 90,
    stops: [{ position: 0, color: { ...base, mods: [{ name: 'lumMod', val: 60000 }, { name: 'lumOff', val: 40000 }] } }, { position: 100, color: base }],
  };
}

const sorted = (stops: readonly GradientStop[]): GradientStop[] => [...stops].sort((a, b) => a.position - b.position);

/** Ajoute un arret au milieu du plus grand intervalle, avec la couleur de l'arret precedent. */
export function addStop(fill: GradientFill): GradientFill {
  const stops = sorted(fill.stops);
  let at = 0;
  let widest = -1;
  for (let i = 0; i < stops.length - 1; i++) {
    const gap = (stops[i + 1] as GradientStop).position - (stops[i] as GradientStop).position;
    if (gap > widest) {
      widest = gap;
      at = i;
    }
  }
  const a = stops[at] as GradientStop;
  const b = stops[at + 1];
  const position = b ? Math.round((a.position + b.position) / 2) : Math.min(100, a.position + 10);
  return { ...fill, stops: sorted([...stops, { position, color: a.color }]) };
}

/** Retire un arret (deux au minimum). */
export function removeStop(fill: GradientFill, index: number): GradientFill {
  return fill.stops.length <= 2 ? fill : { ...fill, stops: fill.stops.filter((_, i) => i !== index) };
}

export function updateStop(fill: GradientFill, index: number, patch: Partial<GradientStop>): GradientFill {
  return { ...fill, stops: fill.stops.map((s, i) => (i === index ? { ...s, ...patch, position: Math.max(0, Math.min(100, patch.position ?? s.position)) } : s)) };
}

export function pattern(preset: string, foreground: Color, background: Color): Fill {
  return { type: 'pattern', preset, foreground, background };
}

// ---- Traits ----

export const DASH_CHOICES = ['solid', 'sysDot', 'sysDash', 'dash', 'dashDot', 'lgDash', 'lgDashDot', 'lgDashDotDot'] as const;
export const END_TYPES: ReadonlyArray<LineEnd['type']> = ['none', 'arrow', 'triangle', 'stealth', 'diamond', 'oval'];
export const END_SIZES: ReadonlyArray<NonNullable<LineEnd['width']>> = ['sm', 'med', 'lg'];

/** Patch de trait : `solid` retire les tirets, un bout `none` est retire. */
export function linePatch(patch: { dash?: string; cap?: Line['cap']; join?: Line['join']; compound?: Line['compound']; head?: LineEnd; tail?: LineEnd }): Partial<Line> {
  const out: Partial<Line> = { ...patch };
  if (patch.dash === 'solid') out.dash = undefined;
  if (patch.head?.type === 'none') out.head = undefined;
  if (patch.tail?.type === 'none') out.tail = undefined;
  return out;
}

// ---- Effets ----

export const BLACK: Color = { type: 'rgb', value: '000000' };

export function defaultShadow(): Shadow {
  return { color: withTransparency(BLACK, 60), blur: 6, distance: 4, direction: 45 };
}

export function defaultReflection(): Reflection {
  return { blur: 0.5, startAlpha: 50, startPosition: 0, endAlpha: 0, endPosition: 55, distance: 0, direction: 90, fadeDirection: 90, scaleX: 100, scaleY: -100 };
}

export type EffectName = 'outerShadow' | 'glow' | 'reflection' | 'softEdge';

/** Active (valeurs par defaut) ou retire un effet sans toucher aux autres. */
export function toggleEffect(effects: Effects | undefined, name: EffectName, on: boolean, accent: Color): Effects {
  const next: Effects = { ...(effects ?? {}) };
  if (!on) {
    delete next[name];
    return next;
  }
  if (name === 'outerShadow') next.outerShadow = defaultShadow();
  else if (name === 'glow') next.glow = { color: withTransparency(accent, 60), radius: 8 };
  else if (name === 'reflection') next.reflection = defaultReflection();
  else next.softEdge = 5;
  return next;
}
