// Conception : themes (couleurs + polices), jeux de styles, espacement, filigrane et couleur de page.
import type { Color, Style, ThemeColorName, ThemeColorRef, WordDocument } from '@forgeoffice/docx';

export interface ThemePreset {
  id: string;
  colors: Record<ThemeColorName, string>;
  majorFont: string;
  minorFont: string;
}

const base = { dk1: '000000', lt1: 'FFFFFF', hlink: '467886', folHlink: '96607D' };

export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: 'office', majorFont: 'Aptos Display', minorFont: 'Aptos', colors: { ...base, dk2: '0E2841', lt2: 'E8E8E8', accent1: '156082', accent2: 'E97132', accent3: '196B24', accent4: '0F9ED5', accent5: 'A02B93', accent6: '4EA72E' } },
  { id: 'ion', majorFont: 'Century Gothic', minorFont: 'Century Gothic', colors: { ...base, dk2: '1E5155', lt2: 'EBEBEB', accent1: 'B01513', accent2: 'EA6312', accent3: 'E6B729', accent4: '6AAC90', accent5: '54849A', accent6: '9E5E9B' } },
  { id: 'retrospect', majorFont: 'Calibri Light', minorFont: 'Calibri', colors: { ...base, dk2: '637052', lt2: 'CCDDEA', accent1: 'E48312', accent2: 'BD582C', accent3: '865640', accent4: '9B8357', accent5: 'C2BC80', accent6: '94A088' } },
  { id: 'facette', majorFont: 'Trebuchet MS', minorFont: 'Trebuchet MS', colors: { ...base, dk2: '2C3C43', lt2: 'EBEBEB', accent1: '90C226', accent2: '54A021', accent3: 'E6B91E', accent4: 'E76618', accent5: 'C42F1A', accent6: '918655' } },
  { id: 'organic', majorFont: 'Garamond', minorFont: 'Garamond', colors: { ...base, dk2: '212121', lt2: 'DEDEDE', accent1: '83992A', accent2: '3C9770', accent3: '44709D', accent4: 'A23C33', accent5: 'D97828', accent6: 'DEB340' } },
  { id: 'slate', majorFont: 'Calisto MT', minorFont: 'Calisto MT', colors: { ...base, dk2: '212745', lt2: 'B4DCFA', accent1: 'BC451B', accent2: 'D3BA68', accent3: 'BB8640', accent4: 'AD9277', accent5: 'A55A43', accent6: 'AD9D7B' } },
  { id: 'aurore', majorFont: 'Calibri Light', minorFont: 'Calibri', colors: { ...base, dk2: '3B2A4A', lt2: 'F1E9F5', accent1: '8E44AD', accent2: 'E67E22', accent3: 'F1C40F', accent4: '16A085', accent5: 'C0392B', accent6: '2980B9' } },
  { id: 'ocean', majorFont: 'Segoe UI Semibold', minorFont: 'Segoe UI', colors: { ...base, dk2: '0B3C5D', lt2: 'E3F1F9', accent1: '1D6FA3', accent2: '2BA8C4', accent3: '5BC0BE', accent4: '3A506B', accent5: '6FFFE9', accent6: 'F4A259' } },
  { id: 'foret', majorFont: 'Georgia', minorFont: 'Georgia', colors: { ...base, dk2: '1F3D2B', lt2: 'E7EFE4', accent1: '2E7D32', accent2: '6B8E23', accent3: '8D6E63', accent4: 'A1887F', accent5: 'C0A062', accent6: '4E6E58' } },
  { id: 'sable', majorFont: 'Cambria', minorFont: 'Calibri', colors: { ...base, dk2: '5A4632', lt2: 'F6EEDF', accent1: 'C28E4D', accent2: 'A0522D', accent3: 'D9B382', accent4: '8B7355', accent5: 'B5651D', accent6: '6E8B3D' } },
  { id: 'lavande', majorFont: 'Trebuchet MS', minorFont: 'Trebuchet MS', colors: { ...base, dk2: '2D2A55', lt2: 'ECEAF8', accent1: '6C63B5', accent2: 'A29BE0', accent3: 'D291BC', accent4: '5F9EA0', accent5: '9370DB', accent6: 'E0B0FF' } },
  { id: 'braise', majorFont: 'Impact', minorFont: 'Arial', colors: { ...base, dk2: '3A1F14', lt2: 'F9E8DD', accent1: 'D2441C', accent2: 'F28C28', accent3: 'FFC145', accent4: '8C2F1B', accent5: 'B85042', accent6: '5C3D2E' } },
  { id: 'graphite', majorFont: 'Consolas', minorFont: 'Segoe UI', colors: { ...base, dk2: '263238', lt2: 'ECEFF1', accent1: '455A64', accent2: '78909C', accent3: '00838F', accent4: '5D4037', accent5: '8E24AA', accent6: 'F57C00' } },
  { id: 'menthe', majorFont: 'Verdana', minorFont: 'Verdana', colors: { ...base, dk2: '134E4A', lt2: 'E6F7F4', accent1: '14B8A6', accent2: '22C55E', accent3: '84CC16', accent4: '0EA5E9', accent5: '6366F1', accent6: 'F59E0B' } },
];

const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
const toHex = (n: number): string => clamp(n).toString(16).padStart(2, '0').toUpperCase();

/** Couleur effective d'une reference de theme (assombrie / eclaircie comme Word). */
export function themeColorHex(colors: Record<ThemeColorName, string>, ref: ThemeColorRef, tint?: number, shade?: number): string {
  const alias: Partial<Record<ThemeColorRef, ThemeColorName>> = {
    text1: 'dk1', dark1: 'dk1', text2: 'dk2', dark2: 'dk2', background1: 'lt1', light1: 'lt1', background2: 'lt2', light2: 'lt2',
    hyperlink: 'hlink', followedHyperlink: 'folHlink',
  };
  const name = (alias[ref] ?? ref) as ThemeColorName;
  const hex = colors[name] ?? '000000';
  let rgb = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  if (shade !== undefined) rgb = rgb.map((c) => c * (shade / 255));
  if (tint !== undefined) rgb = rgb.map((c) => c + (255 - c) * (1 - tint / 255));
  return rgb.map(toHex).join('');
}

function recolor(c: Color | undefined, colors: Record<ThemeColorName, string>): Color | undefined {
  return c?.theme ? { ...c, rgb: themeColorHex(colors, c.theme, c.tint, c.shade) } : c;
}

function restyle(s: Style, colors: Record<ThemeColorName, string>): Style {
  return s.run?.color?.theme ? { ...s, run: { ...s.run, color: recolor(s.run.color, colors) } } : s;
}

/** Applique couleurs et/ou polices d'un theme ; les couleurs de style liees au theme sont recalculees. */
export function applyTheme(doc: WordDocument, patch: { colors?: Record<ThemeColorName, string>; majorFont?: string; minorFont?: string }, name?: string): WordDocument {
  const colors = patch.colors ?? doc.theme.colors;
  return {
    ...doc,
    // Le XML d'origine ne correspond plus : le theme est regenere a l'ecriture.
    theme: { ...doc.theme, name: name ?? doc.theme.name, colors, majorFont: patch.majorFont ?? doc.theme.majorFont, minorFont: patch.minorFont ?? doc.theme.minorFont, rawXml: null },
    styles: { ...doc.styles, styles: doc.styles.styles.map((s) => restyle(s, colors)) },
  };
}

export type StyleSet = 'default' | 'classic' | 'modern' | 'elegant';

/** Jeux de styles : variations des titres. */
export function applyStyleSet(doc: WordDocument, set: StyleSet): WordDocument {
  const map = (s: Style): Style => {
    if (!(s.id === 'Title' || /^Heading[1-3]$/.test(s.id))) return s;
    const run = { ...s.run };
    const paragraph = { ...s.paragraph };
    delete run.caps;
    delete run.bold;
    delete paragraph.alignment;
    delete paragraph.borders;
    if (set === 'classic') run.bold = true;
    if (set === 'modern') {
      run.caps = true;
      run.spacing = 1;
      if (s.id === 'Heading1') paragraph.borders = { bottom: { style: 'single', width: 1, color: doc.theme.colors.accent1, space: 2 } };
    }
    if (set === 'elegant') {
      run.italic = s.id !== 'Title' ? true : undefined;
      if (s.id === 'Title') paragraph.alignment = 'center';
    }
    return { ...s, run, paragraph };
  };
  return { ...doc, styles: { ...doc.styles, styles: doc.styles.styles.map(map) } };
}

/** Espacement entre paragraphes (valeurs par defaut du document). */
export function applyParagraphSpacing(doc: WordDocument, after: number, line: number, before = 0): WordDocument {
  return {
    ...doc,
    styles: {
      ...doc.styles,
      docDefaults: { ...doc.styles.docDefaults, paragraph: { ...doc.styles.docDefaults.paragraph, spacingAfter: after, spacingBefore: before || undefined, lineSpacing: { rule: 'auto', value: line } } },
    },
  };
}

/** Filigrane et couleur de page : conserves dans les proprietes personnalisees (le fichier reste lisible partout). */
export const WATERMARK_PROP = 'ForgeOffice.Filigrane';
export const PAGE_COLOR_PROP = 'ForgeOffice.CouleurPage';

export function setCustomProp(doc: WordDocument, key: string, value: string | null): WordDocument {
  const custom = { ...doc.properties.custom };
  if (value) custom[key] = value;
  else delete custom[key];
  return { ...doc, properties: { ...doc.properties, custom } };
}

export interface Watermark {
  text: string;
  color: string;
  diagonal: boolean;
}

export function readWatermark(doc: WordDocument): Watermark | null {
  const raw = doc.properties.custom[WATERMARK_PROP];
  if (!raw) return null;
  const [text, color, diag] = raw.split('|');
  return text ? { text, color: /^#[0-9A-Fa-f]{6}$/.test(color ?? '') ? color! : '#C0C0C0', diagonal: diag !== '0' } : null;
}

export const writeWatermark = (w: Watermark | null): string | null => (w ? `${w.text.replace(/\|/g, ' ')}|${w.color}|${w.diagonal ? 1 : 0}` : null);

export function pageColor(doc: WordDocument): string | null {
  const c = doc.properties.custom[PAGE_COLOR_PROP];
  return c && /^#[0-9A-Fa-f]{6}$/.test(c) ? c : null;
}
