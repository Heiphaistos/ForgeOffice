// Couleurs : palette du theme Office avec nuances, couleurs standard, conversions.
import { S } from '../strings.ts';

export interface Swatch {
  color: string;
  label: string;
}

/** Couleurs du theme Office 2023+ (dans l'ordre de la palette Office). */
export const OFFICE_THEME_COLORS: readonly Swatch[] = [
  { color: '#FFFFFF', label: S.color.names.white },
  { color: '#000000', label: S.color.names.black },
  { color: '#E8E8E8', label: S.color.names.background2 },
  { color: '#0E2841', label: S.color.names.text2 },
  { color: '#156082', label: S.color.names.accent1 },
  { color: '#E97132', label: S.color.names.accent2 },
  { color: '#196B24', label: S.color.names.accent3 },
  { color: '#0F9ED5', label: S.color.names.accent4 },
  { color: '#A02B93', label: S.color.names.accent5 },
  { color: '#4EA72E', label: S.color.names.accent6 },
];

export const STANDARD_COLORS: readonly Swatch[] = [
  { color: '#C00000', label: S.color.names.darkRed },
  { color: '#FF0000', label: S.color.names.red },
  { color: '#FFC000', label: S.color.names.orange },
  { color: '#FFFF00', label: S.color.names.yellow },
  { color: '#92D050', label: S.color.names.lightGreen },
  { color: '#00B050', label: S.color.names.green },
  { color: '#00B0F0', label: S.color.names.lightBlue },
  { color: '#0070C0', label: S.color.names.blue },
  { color: '#002060', label: S.color.names.darkBlue },
  { color: '#7030A0', label: S.color.names.purple },
];

/** « #abc », « abc », « #AABBCC » -> « #AABBCC » ; null si invalide. */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${[...raw].map((c) => c + c).join('')}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toUpperCase();
  return null;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex) ?? '#000000';
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}

function toHex(v: number): string {
  return Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p: number, q: number, t: number): number => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
}

/** Applique un facteur de luminance a la maniere d'Office : > 0 eclaircit, < 0 assombrit. */
export function shade(hex: string, amount: number): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  const next = amount >= 0 ? l + (1 - l) * amount : l * (1 + amount);
  return rgbToHex(...hslToRgb(h, s, next));
}

/** Les 5 nuances affichees sous une couleur du theme (regles de la palette Office). */
export function themeShades(swatch: Swatch): Swatch[] {
  const [, , l] = rgbToHsl(...hexToRgb(swatch.color));
  let steps: number[];
  if (l >= 0.99) steps = [-0.05, -0.15, -0.25, -0.35, -0.5];
  else if (l <= 0.01) steps = [0.5, 0.35, 0.25, 0.15, 0.05];
  else if (l < 0.2) steps = [0.9, 0.75, 0.5, 0.25, 0.1];
  else if (l > 0.8) steps = [-0.1, -0.25, -0.5, -0.75, -0.9];
  else steps = [0.8, 0.6, 0.4, -0.25, -0.5];
  return steps.map((step) => {
    const pct = Math.round(Math.abs(step) * 100);
    const word = step >= 0 ? S.color.lighter : S.color.darker;
    return { color: shade(swatch.color, step), label: `${swatch.label}, ${word} ${pct} %` };
  });
}

/** Luminance relative WCAG d'une couleur. */
export function luminance(hex: string): number {
  const lin = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (lin[0] ?? 0) + 0.7152 * (lin[1] ?? 0) + 0.0722 * (lin[2] ?? 0);
}

/** Couleur de texte lisible (noir ou blanc) sur un fond donne. */
export function readableOn(hex: string): '#000000' | '#FFFFFF' {
  return luminance(hex) > 0.4 ? '#000000' : '#FFFFFF';
}

/** Ajoute une couleur en tete des recentes (sans doublon, 10 au plus). */
export function pushRecentColor(recent: readonly string[], color: string, max = 10): string[] {
  const c = normalizeHex(color);
  if (!c) return [...recent];
  return [c, ...recent.filter((r) => r !== c)].slice(0, max);
}
