// Resolution des couleurs DrawingML (theme, correspondance, modificateurs) vers RVB + opacite.
import type { Color, ColorMod, SchemeColorName } from './dml.ts';
import type { ColorMap, Theme, ThemeColorSlot } from './model.ts';

export interface ResolvedColor {
  /** RRGGBB en majuscules. */
  hex: string;
  /** Opacite 0..1. */
  alpha: number;
}

export const DEFAULT_COLOR_MAP: ColorMap = {
  bg1: 'lt1',
  tx1: 'dk1',
  bg2: 'lt2',
  tx2: 'dk2',
  accent1: 'accent1',
  accent2: 'accent2',
  accent3: 'accent3',
  accent4: 'accent4',
  accent5: 'accent5',
  accent6: 'accent6',
  hlink: 'hlink',
  folHlink: 'folHlink',
};

const SYSTEM_COLORS: Readonly<Record<string, string>> = {
  windowText: '000000',
  window: 'FFFFFF',
  btnFace: 'F0F0F0',
  btnText: '000000',
  highlight: '0078D7',
  highlightText: 'FFFFFF',
  grayText: '6D6D6D',
  menu: 'F0F0F0',
  menuText: '000000',
  captionText: '000000',
  infoBk: 'FFFFE1',
  infoText: '000000',
  scrollBar: 'C8C8C8',
  windowFrame: '646464',
  '3dDkShadow': '696969',
  '3dLight': 'E3E3E3',
};

const PRESET_COLORS: Readonly<Record<string, string>> = {
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  green: '008000',
  blue: '0000FF',
  yellow: 'FFFF00',
  cyan: '00FFFF',
  magenta: 'FF00FF',
  gray: '808080',
  grey: '808080',
  silver: 'C0C0C0',
  orange: 'FFA500',
  purple: '800080',
  navy: '000080',
  maroon: '800000',
  olive: '808000',
  teal: '008080',
  lime: '00FF00',
  aqua: '00FFFF',
  fuchsia: 'FF00FF',
  brown: 'A52A2A',
  pink: 'FFC0CB',
  gold: 'FFD700',
  ltGray: 'D3D3D3',
  dkGray: 'A9A9A9',
  dkBlue: '00008B',
  dkRed: '8B0000',
  dkGreen: '006400',
};

const SLOTS = new Set<string>(['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']);

type Rgb = [number, number, number];

function parseHex(value: string): Rgb {
  const clean = /^[0-9a-fA-F]{6}$/.test(value) ? value : '000000';
  return [Number.parseInt(clean.slice(0, 2), 16) / 255, Number.parseInt(clean.slice(2, 4), 16) / 255, Number.parseInt(clean.slice(4, 6), 16) / 255];
}

function toHex([r, g, b]: Rgb): string {
  const part = (v: number): string => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return (part(r) + part(g) + part(b)).toUpperCase();
}

function rgbToHsl([r, g, b]: Rgb): Rgb {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

function hslToRgb([h, s, l]: Rgb): Rgb {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number): number => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const hn = h / 360;
  return [hue(hn + 1 / 3), hue(hn), hue(hn - 1 / 3)];
}

// Composantes lineaires (sRGB <-> lineaire) pour tint/shade, comme Office.
const toLinear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number): number => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

function applyMod(rgb: Rgb, alpha: number, mod: ColorMod): [Rgb, number] {
  const v = (mod.val ?? 0) / 100000;
  switch (mod.name) {
    case 'alpha':
      return [rgb, v];
    case 'alphaMod':
      return [rgb, alpha * v];
    case 'alphaOff':
      return [rgb, Math.min(1, Math.max(0, alpha + v))];
    case 'lumMod': {
      const [h, s, l] = rgbToHsl(rgb);
      return [hslToRgb([h, s, Math.min(1, l * v)]), alpha];
    }
    case 'lumOff': {
      const [h, s, l] = rgbToHsl(rgb);
      return [hslToRgb([h, s, Math.min(1, Math.max(0, l + v))]), alpha];
    }
    case 'satMod': {
      const [h, s, l] = rgbToHsl(rgb);
      return [hslToRgb([h, Math.min(1, s * v), l]), alpha];
    }
    case 'satOff': {
      const [h, s, l] = rgbToHsl(rgb);
      return [hslToRgb([h, Math.min(1, Math.max(0, s + v)), l]), alpha];
    }
    case 'hueOff': {
      const [h, s, l] = rgbToHsl(rgb);
      return [hslToRgb([(h + (mod.val ?? 0) / 60000 + 360) % 360, s, l]), alpha];
    }
    case 'hueMod': {
      const [h, s, l] = rgbToHsl(rgb);
      return [hslToRgb([(h * v) % 360, s, l]), alpha];
    }
    case 'tint':
      return [rgb.map((c) => toGamma(toLinear(c) * v + (1 - v))) as Rgb, alpha];
    case 'shade':
      return [rgb.map((c) => toGamma(toLinear(c) * v)) as Rgb, alpha];
    case 'comp': {
      const [h, s, l] = rgbToHsl(rgb);
      return [hslToRgb([(h + 180) % 360, s, l]), alpha];
    }
    case 'inv':
      return [rgb.map((c) => 1 - c) as Rgb, alpha];
    case 'gray': {
      const g = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2];
      return [[g, g, g], alpha];
    }
    default:
      return [rgb, alpha];
  }
}

/** Couleur du theme pour un nom de schema, apres passage par la correspondance (bg1 -> lt1...). */
export function schemeColorBase(name: SchemeColorName, theme: Theme, colorMap: ColorMap = DEFAULT_COLOR_MAP): Color | undefined {
  const mapped = (colorMap as Record<string, SchemeColorName>)[name] ?? name;
  return SLOTS.has(mapped) ? theme.colors[mapped as ThemeColorSlot] : undefined;
}

/**
 * Resout une couleur en RVB. `placeholder` remplace phClr (couleur d'une reference de style).
 * Une couleur introuvable devient noire.
 */
export function resolveColor(color: Color, theme: Theme, colorMap: ColorMap = DEFAULT_COLOR_MAP, placeholder?: Color): ResolvedColor {
  let base: Rgb;
  let alpha = 1;
  if (color.type === 'rgb') base = parseHex(color.value);
  else if (color.type === 'system') base = parseHex(color.last ?? SYSTEM_COLORS[color.value] ?? '000000');
  else if (color.type === 'preset') base = parseHex(PRESET_COLORS[color.value] ?? '000000');
  else if (color.value === 'phClr') {
    const resolved = placeholder ? resolveColor(placeholder, theme, colorMap) : { hex: '000000', alpha: 1 };
    base = parseHex(resolved.hex);
    alpha = resolved.alpha;
  } else {
    const themeColor = schemeColorBase(color.value, theme, colorMap);
    const resolved = themeColor && themeColor.type !== 'scheme' ? resolveColor(themeColor, theme, colorMap) : { hex: '000000', alpha: 1 };
    base = parseHex(resolved.hex);
    alpha = resolved.alpha;
  }
  let rgb = base;
  for (const mod of color.mods ?? []) [rgb, alpha] = applyMod(rgb, alpha, mod);
  return { hex: toHex(rgb), alpha };
}

/** Couleur CSS (#RRGGBB ou rgba()). */
export function cssColor(color: Color, theme: Theme, colorMap?: ColorMap, placeholder?: Color): string {
  const { hex, alpha } = resolveColor(color, theme, colorMap, placeholder);
  if (alpha >= 1) return `#${hex}`;
  const [r, g, b] = parseHex(hex).map((c) => Math.round(c * 255));
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`;
}

export const rgb = (value: string): Color => ({ type: 'rgb', value: value.replace(/^#/, '').toUpperCase() });
export const scheme = (value: SchemeColorName, mods?: ColorMod[]): Color => (mods ? { type: 'scheme', value, mods } : { type: 'scheme', value });
