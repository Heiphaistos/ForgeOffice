// Echelles d'axes (graduations « rondes » a la maniere d'Excel), formats de nombre et mesure du texte.
import type { ChartAxis } from '@forgeoffice/pptx';
import { formatValue } from '@forgeoffice/formulas';

export interface Scale {
  min: number;
  max: number;
  step: number;
}

export function clamp(v: number, lo: number, hi: number, fallback = lo): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

/** Retire le bruit flottant (0,30000000000000004 -> 0,3). */
const clean = (v: number): number => Number(v.toPrecision(12));
const finite = (v: number | undefined): number | undefined => (v !== undefined && Number.isFinite(v) ? v : undefined);

/** Pas « rond » (1, 2, 5 x 10^n) superieur ou egal a `rough`. */
export function niceStep(rough: number): number {
  if (!(rough > 0) || !Number.isFinite(rough)) return 1;
  const exp = 10 ** Math.floor(Math.log10(rough));
  const f = rough / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

/** Graduations « rondes » d'un axe de valeurs (min, max, pas) a la maniere d'Excel (marge de 5 % au-dela des donnees). */
export function niceScale(min: number, max: number, maxTicks = 6): Scale {
  let lo = Number.isFinite(min) ? min : 0;
  let hi = Number.isFinite(max) ? max : 0;
  if (lo > hi) [lo, hi] = [hi, lo];
  if (lo === hi) {
    if (lo > 0) lo = 0;
    else if (hi < 0) hi = 0;
    else return { min: 0, max: 1, step: 0.2 };
  }
  const range = hi - lo;
  if (hi > 0) hi += range * 0.05;
  if (lo < 0) lo -= range * 0.05;
  const step = niceStep((hi - lo) / Math.max(1, Math.floor(maxTicks) || 1));
  return { min: clean(Math.floor(lo / step) * step), max: clean(Math.ceil(hi / step) * step), step };
}

/** Echelle d'un axe : donnees [lo, hi], zero inclus selon la regle d'Excel, bornes et pas imposes par le fichier. */
export function axisScale(lo: number, hi: number, axis: ChartAxis | undefined, maxTicks: number, includeZero: boolean, fixed?: { min: number; max: number }): Scale {
  if (!(lo <= hi)) {
    lo = 0;
    hi = 0;
  }
  if (includeZero || (lo > 0 && lo < (hi * 5) / 6)) lo = Math.min(lo, 0);
  if (includeZero || (hi < 0 && hi > (lo * 5) / 6)) hi = Math.max(hi, 0);
  const auto = niceScale(lo, hi, maxTicks);
  let min = finite(axis?.min) ?? fixed?.min ?? auto.min;
  let max = finite(axis?.max) ?? fixed?.max ?? auto.max;
  if (!(max > min)) ({ min, max } = auto);
  const unit = finite(axis?.majorUnit);
  const custom = min !== auto.min || max !== auto.max;
  const step = unit !== undefined && unit > 0 && (max - min) / unit <= 200 ? unit : custom ? niceStep((max - min) / Math.max(1, maxTicks)) : auto.step;
  return { min, max, step };
}

/** Valeurs des graduations de min a max (1000 au plus). */
export function ticks(s: Scale, step = s.step): number[] {
  const n = Math.min(1000, Math.floor((s.max - s.min) / step + 1e-9));
  return n >= 0 ? Array.from({ length: n + 1 }, (_, i) => clean(s.min + i * step)) : [];
}

/** Nombre formate en francais (General, 0, 0.0, 0%, # ##0...) par le moteur de formats du tableur. */
export function formatNumber(v: number, code: string | undefined): string {
  return formatValue(v, code && code.length <= 255 ? code : 'General', 'fr-FR');
}

/** Largeur estimee d'un texte (pas de DOM : chasse moyenne d'Aptos). */
export const textWidth = (s: string, size: number): number => s.length * size * 0.52;

export function truncate(s: string, maxW: number, size: number): string {
  if (textWidth(s, size) <= maxW) return s;
  const n = Math.floor(maxW / (size * 0.52)) - 1;
  return n > 0 ? `${s.slice(0, n)}…` : '';
}

/** Coupe un texte en lignes de largeur maxW (au plus maxLines). */
export function wrapText(s: string, maxW: number, size: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of s.slice(0, 1000).replace(/\s+/g, ' ').trim().split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && textWidth(next, size) > maxW) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines).map((l) => truncate(l, maxW, size));
}
