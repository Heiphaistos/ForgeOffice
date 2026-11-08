// Conversions de couleurs du sélecteur : RVB, TSL (teinte, saturation, luminosité), TSV (spectre) et notation #RRGGBB.
export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export interface Hsl {
  /** 0..360, saturation et luminosite 0..100. */
  h: number;
  s: number;
  l: number;
}
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const byte = (v: number): number => clamp(Math.round(v), 0, 255);

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  let h = 0;
  if (d) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: Math.round(((h * 60 + 360) % 360) * 10) / 10, s: max ? Math.round((d / max) * 1000) / 10 : 0, v: Math.round(max * 1000) / 10 };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const S = clamp(s, 0, 100) / 100;
  const V = clamp(v, 0, 100) / 100;
  const f = (n: number): number => {
    const k = (n + h / 60) % 6;
    return V - V * S * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: byte(f(5) * 255), g: byte(f(3) * 255), b: byte(f(1) * 255) };
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const v = rgbToHsv({ r, g, b });
  const l = (v.v * (2 - v.s / 100)) / 2;
  const s = l === 0 || l === 100 ? 0 : ((v.v - l) / Math.min(l, 100 - l)) * 100;
  return { h: v.h, s: Math.round(s * 10) / 10, l: Math.round(l * 10) / 10 };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const L = clamp(l, 0, 100);
  const v = L + (clamp(s, 0, 100) * Math.min(L, 100 - L)) / 100;
  return hsvToRgb({ h, s: v === 0 ? 0 : 200 * (1 - L / v), v });
}

export const toHex = ({ r, g, b }: Rgb): string => `#${[r, g, b].map((x) => byte(x).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** #RGB ou #RRGGBB (avec ou sans #) vers RVB ; null si invalide. */
export function parseHex(text: string): Rgb | null {
  const m = text.trim().replace(/^#/, '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = (m[1] as string).length === 3 ? (m[1] as string).split('').map((c) => c + c).join('') : (m[1] as string);
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
