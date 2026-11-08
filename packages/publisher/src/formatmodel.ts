// Modele pur de la boite Format (couleurs et traits) : remplissage et trait <-> valeurs du formulaire.
import type { Color, Fill, ImageEffects, Line } from '@forgeoffice/pptx';

/** Transparence (0 a 100 %) d'une couleur : complement de son canal alpha. */
export function transparencyOf(color: Color): number {
  const alpha = color.mods?.find((m) => m.name === 'alpha')?.val;
  return alpha === undefined ? 0 : Math.round(100 - Math.min(100000, Math.max(0, alpha)) / 1000);
}

/** Meme couleur avec la transparence donnee (0 = opaque). */
export function withTransparency(color: Color, percent: number): Color {
  const mods = (color.mods ?? []).filter((m) => m.name !== 'alpha');
  const p = Math.min(100, Math.max(0, Math.round(percent)));
  if (p > 0) mods.push({ name: 'alpha', val: (100 - p) * 1000 });
  return { ...color, mods: mods.length ? mods : undefined } as Color;
}

export interface PaintForm {
  /** none = aucun, solid = uni, gradient = degrade lineaire a 2 couleurs, pattern = motif, keep = remplissage d'origine conserve (image, degrade de chemin...). */
  mode: 'none' | 'solid' | 'gradient' | 'pattern' | 'keep';
  /** Couleur unie, premiere couleur du degrade, premier plan du motif. */
  color: string;
  /** Seconde couleur du degrade, arriere-plan du motif. */
  color2: string;
  /** Angle du degrade (degres). */
  angle: number;
  pattern: string;
  transparency: number;
}

export const PATTERNS = ['pct10', 'pct50', 'horz', 'vert', 'ltUpDiag', 'dkUpDiag', 'diagCross', 'smGrid', 'lgCheck'] as const;

export interface LineForm {
  mode: 'none' | 'solid' | 'keep';
  color: string;
  width: number;
  dash: string;
}

export const DASHES = ['solid', 'dash', 'dot', 'dashDot', 'lgDash'] as const;

export function fillForm(fill: Fill | undefined, hex: (c: Color) => string, fallback: string): PaintForm {
  const base: PaintForm = { mode: 'keep', color: fallback, color2: '#FFFFFF', angle: 90, pattern: 'pct50', transparency: 0 };
  if (!fill || fill.type === 'none') return { ...base, mode: 'none' };
  if (fill.type === 'solid') return { ...base, mode: 'solid', color: hex(fill.color), transparency: transparencyOf(fill.color) };
  if (fill.type === 'gradient' && fill.kind === 'linear' && fill.stops.length >= 2) {
    const first = fill.stops[0] as { color: Color };
    const last = fill.stops[fill.stops.length - 1] as { color: Color };
    return { ...base, mode: 'gradient', color: hex(first.color), color2: hex(last.color), angle: Math.round(fill.angle ?? 0) };
  }
  if (fill.type === 'pattern') return { ...base, mode: 'pattern', color: hex(fill.foreground), color2: hex(fill.background), pattern: fill.preset };
  return base;
}

export function lineForm(line: Line | undefined, hex: (c: Color) => string, fallback: string): LineForm {
  const fill = line?.fill;
  const width = line?.width ?? 1;
  const dash = line?.dash && (DASHES as readonly string[]).includes(line.dash) ? line.dash : 'solid';
  if (!line || !fill || fill.type === 'none') return { mode: 'none', color: fallback, width, dash };
  if (fill.type === 'solid') return { mode: 'solid', color: hex(fill.color), width, dash };
  return { mode: 'keep', color: fallback, width, dash };
}

/** Remplissage a ecrire (null = ne rien changer). */
export function fillOf(form: PaintForm, initial: PaintForm, toColor: (hex: string) => Color): Fill | null {
  if (form.mode === 'keep' || JSON.stringify(form) === JSON.stringify(initial)) return null;
  if (form.mode === 'none') return { type: 'none' };
  if (form.mode === 'gradient') {
    return { type: 'gradient', kind: 'linear', angle: ((Math.round(form.angle) % 360) + 360) % 360, stops: [{ position: 0, color: withTransparency(toColor(form.color), form.transparency) }, { position: 100, color: withTransparency(toColor(form.color2), form.transparency) }] };
  }
  if (form.mode === 'pattern') return { type: 'pattern', preset: (PATTERNS as readonly string[]).includes(form.pattern) ? form.pattern : 'pct50', foreground: toColor(form.color), background: toColor(form.color2) };
  return { type: 'solid', color: withTransparency(toColor(form.color), form.transparency) };
}

/** Modification du trait a ecrire : null = rien, {} avec fill none = aucun trait. */
export function lineOf(form: LineForm, initial: LineForm, toColor: (hex: string) => Color): Partial<Line> | null {
  if (form.mode === 'keep' || JSON.stringify(form) === JSON.stringify(initial)) return null;
  if (form.mode === 'none') return { fill: { type: 'none' } };
  return { fill: { type: 'solid', color: toColor(form.color) }, width: Math.max(0.25, form.width), dash: form.dash === 'solid' ? undefined : form.dash };
}

export interface ImageForm {
  brightness: number;
  contrast: number;
  grayscale: boolean;
  /** Transparence en % (0 = opaque). */
  transparency: number;
}

export function imageForm(fx: ImageEffects | undefined): ImageForm {
  return { brightness: fx?.brightness ?? 0, contrast: fx?.contrast ?? 0, grayscale: !!fx?.grayscale, transparency: fx?.alpha === undefined ? 0 : Math.round(100 - fx.alpha) };
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(v)));

/** Effets d'image resultants (duotone et autres effets conserves, valeurs neutres retirees) ; null si rien n'a change. */
export function imageEffectsOf(form: ImageForm, initial: ImageForm, current: ImageEffects | undefined): ImageEffects | null | undefined {
  if (JSON.stringify(form) === JSON.stringify(initial)) return null;
  const next: ImageEffects = { ...(current ?? {}) };
  delete next.alpha;
  delete next.grayscale;
  delete next.brightness;
  delete next.contrast;
  const alpha = 100 - clamp(form.transparency, 0, 100);
  if (alpha < 100) next.alpha = alpha;
  if (form.grayscale) next.grayscale = true;
  const brightness = clamp(form.brightness, -100, 100);
  const contrast = clamp(form.contrast, -100, 100);
  if (brightness) next.brightness = brightness;
  if (contrast) next.contrast = contrast;
  return Object.keys(next).length ? next : undefined;
}

/** Position (meme unite que les arguments) qui centre un objet de taille `size` sur une page de taille `page`, ou a un bord (marge `gap`). */
export function alignedOnPage(page: number, size: number, where: 'start' | 'center' | 'end', gap = 0): number {
  const at = where === 'start' ? gap : where === 'end' ? page - size - gap : (page - size) / 2;
  return Math.round(at * 100) / 100;
}
