// Polices : liste de repli, filtre, tailles standard.
import { fold } from './text.ts';

/** Polices de theme Office 2023+ (Aptos) : titres puis corps. */
export const THEME_FONTS = { headings: 'Aptos Display', body: 'Aptos' } as const;

/** Liste de repli quand le systeme ne peut pas enumerer ses polices (Local Font Access indisponible). */
export const FALLBACK_FONTS: readonly string[] = [
  'Aptos', 'Aptos Display', 'Arial', 'Arial Black', 'Bahnschrift', 'Book Antiqua', 'Bookman Old Style',
  'Calibri', 'Calibri Light', 'Cambria', 'Cambria Math', 'Candara', 'Cascadia Code', 'Cascadia Mono',
  'Century Gothic', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'DejaVu Sans',
  'DejaVu Serif', 'Ebrima', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'Garamond', 'Georgia',
  'Helvetica', 'Impact', 'Ink Free', 'Javanese Text', 'Leelawadee UI', 'Liberation Mono', 'Liberation Sans',
  'Liberation Serif', 'Lucida Console', 'Lucida Sans Unicode', 'Malgun Gothic', 'Microsoft Himalaya',
  'Microsoft JhengHei', 'Microsoft Sans Serif', 'Microsoft YaHei', 'MingLiU-ExtB', 'Mongolian Baiti',
  'MS Gothic', 'MV Boli', 'Myanmar Text', 'Nirmala UI', 'Noto Sans', 'Noto Serif', 'Palatino Linotype',
  'Roboto', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Black', 'Segoe UI Emoji',
  'Segoe UI Historic', 'Segoe UI Light', 'Segoe UI Semibold', 'Segoe UI Symbol', 'Segoe UI Variable Display',
  'SimSun', 'Sitka Text', 'Sylfaen', 'Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Ubuntu',
  'Verdana', 'Webdings', 'Wingdings', 'Yu Gothic',
];

/** Polices dont le nom contient la requete (insensible aux accents), prefixes d'abord. */
export function filterFonts(fonts: readonly string[], query: string): string[] {
  const q = fold(query);
  if (!q) return [...fonts];
  const starts = fonts.filter((f) => fold(f).startsWith(q));
  const contains = fonts.filter((f) => !fold(f).startsWith(q) && fold(f).includes(q));
  return [...starts, ...contains];
}

/** Liste triee sans doublon (insensible a la casse). */
export function uniqueFonts(fonts: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const f of fonts) {
    const name = f.trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

export const FONT_SIZES: readonly number[] = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

/** Saisie de taille de police : 1 a 1638 pt par demi-point, virgule acceptee ; null si invalide. */
export function parseFontSize(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 1 || n > 1638) return null;
  return Math.round(n * 2) / 2;
}

/** Taille suivante/precedente dans la liste standard (Agrandir/Reduire la police). */
export function nextFontSize(size: number, direction: 1 | -1): number {
  if (direction > 0) return FONT_SIZES.find((s) => s > size) ?? Math.min(1638, Math.floor(size / 10) * 10 + 10);
  const smaller = [...FONT_SIZES].reverse().find((s) => s < size);
  return smaller ?? Math.max(1, size - 1);
}

/** Ajoute une police en tete des recentes. */
export function pushRecentFont(recent: readonly string[], font: string, max = 8): string[] {
  return [font, ...recent.filter((f) => f.toLowerCase() !== font.toLowerCase())].slice(0, max);
}
