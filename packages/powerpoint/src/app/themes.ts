// Themes, variantes et palettes de couleurs (onglet Creation), sans DOM.
import type { AutoShape, Color, Deck, Fill, Shape, SlideSize, ThemeColors } from '@forgeoffice/pptx';
import { S } from '../strings.ts';

export interface Palette {
  id: string;
  name: string;
  /** dk2, lt2, accent1..6, hlink, folHlink (hexadecimal sans #). */
  colors: [string, string, string, string, string, string, string, string, string, string];
}

const p = (id: string, name: string, colors: Palette['colors']): Palette => ({ id, name, colors });

/** Palettes de couleurs (Creation > Variantes > Couleurs). */
export const PALETTES: readonly Palette[] = [
  p('office', 'Office', ['0E2841', 'E8E8E8', '156082', 'E97132', '196B24', '0F9ED5', 'A02B93', '4EA72E', '467886', '96607D']),
  p('office2013', 'Office 2013 - 2022', ['44546A', 'E7E6E6', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '0563C1', '954F72']),
  p('office2007', 'Office 2007 - 2010', ['1F497D', 'EEECE1', '4F81BD', 'C0504D', '9BBB59', '8064A2', '4BACC6', 'F79646', '0000FF', '800080']),
  p('gray', S.palettes.gray, ['000000', 'F8F8F8', 'DDDDDD', 'B2B2B2', '969696', '808080', '5F5F5F', '4D4D4D', '5F5F5F', '919191']),
  p('blueWarm', S.palettes.blueWarm, ['242852', 'ACCBF9', '4A66AC', '629DD1', '297FD5', '7F8FA9', '5AA2AE', '9D90A0', '9454C3', '3EBBF0']),
  p('blue', S.palettes.blue, ['17406D', 'DBEFF9', '0F6FC6', '009DD9', '0BD0D9', '10CF9B', '7CCA62', 'A5C249', 'F49100', '85DFD0']),
  p('blue2', S.palettes.blue2, ['335B74', 'DFE3E5', '1CADE4', '2683C6', '27CED7', '42BA97', '3E8853', '62A39F', '6B9F25', 'B26B02']),
  p('blueGreen', S.palettes.blueGreen, ['373545', 'CEDBE6', '3494BA', '58B6C0', '75BDA7', '7A8C8E', '84ACB6', '2683C6', '6B9F25', '9F6715']),
  p('green', S.palettes.green, ['455F51', 'E3DED1', '549E39', '8AB833', 'C0CF3A', '029676', '4AB5C4', '0989B1', '6B9F25', 'BA6906']),
  p('yellow', S.palettes.yellow, ['39302A', 'E5DEDB', 'FFCA08', 'F8931D', 'CE8D3E', 'EC7016', 'E64823', '9C6A6A', '2998E3', '7F723D']),
  p('orange', S.palettes.orange, ['637052', 'CCDDEA', 'E48312', 'BD582C', '865640', '9B8357', 'C2BC80', '94A088', '2998E3', '8C8C8C']),
  p('red', S.palettes.red, ['323232', 'E5C243', 'A5300F', 'D55816', 'E19825', 'B19C7D', '7F5F52', 'B27D49', '6B9F25', 'B26B02']),
  p('violet', S.palettes.violet, ['373545', 'DCD8DC', 'AD84C6', '8784C7', '5D739A', '6997AF', '84ACB6', '6F8183', '69A020', '8C8C8C']),
  p('paper', S.palettes.paper, ['444D26', 'FEFAC9', 'A5B592', 'F3A447', 'E7BC29', 'D092A7', '9C85C0', '809EC2', '8E58B6', '7F6F6F']),
  p('marquee', S.palettes.marquee, ['5E5E5E', 'DDDDDD', '418AB3', 'A6B727', 'F69200', '838383', 'FEC306', 'DF5327', 'F59E00', 'B2B2B2']),
  p('slipstream', S.palettes.slipstream, ['212745', 'B4DCFA', '4E67C8', '5ECCF3', 'A7EA52', '5DCEAF', 'FF8021', 'F14124', '56C7AA', '59A8D1']),
  p('aspect', S.palettes.aspect, ['323232', 'E3DED1', 'F07F09', '9F2936', '1B587C', '4E8542', '604878', 'C19859', '6B9F25', 'B26B02']),
];

export interface FontPair {
  id: string;
  major: string;
  minor: string;
}

/** Jeux de polices (Creation > Variantes > Polices). */
export const FONT_PAIRS: readonly FontPair[] = [
  { id: 'office', major: 'Aptos Display', minor: 'Aptos' },
  { id: 'office2013', major: 'Calibri Light', minor: 'Calibri' },
  { id: 'office2007', major: 'Calibri', minor: 'Calibri' },
  { id: 'arial', major: 'Arial', minor: 'Arial' },
  { id: 'georgia', major: 'Georgia', minor: 'Georgia' },
  { id: 'segoe', major: 'Segoe UI Semibold', minor: 'Segoe UI' },
  { id: 'cambria', major: 'Cambria', minor: 'Calibri' },
  { id: 'trebuchet', major: 'Trebuchet MS', minor: 'Trebuchet MS' },
  { id: 'verdana', major: 'Verdana', minor: 'Verdana' },
  { id: 'garamond', major: 'Garamond', minor: 'Garamond' },
  { id: 'century', major: 'Century Gothic', minor: 'Century Gothic' },
  { id: 'tw', major: 'Tw Cen MT', minor: 'Tw Cen MT' },
];

/** Decor du masque (formes dessinees sous toutes les diapositives). */
type Decor = 'none' | 'leftBand' | 'bottomBar' | 'corner' | 'frame' | 'circles' | 'topBar' | 'diagonal';

export interface DesignTheme {
  id: string;
  name: string;
  palette: string;
  fonts: string;
  /** Arriere-plan du masque : cle de couleur (bg1, dk2...) ou degrade. */
  background: 'light' | 'dark' | 'soft' | 'gradient';
  decor: Decor;
  /** Palettes des 4 variantes. */
  variants: [string, string, string, string];
}

/** Themes (Creation > Themes). */
export const DESIGN_THEMES: readonly DesignTheme[] = [
  { id: 'office', name: S.themes.office, palette: 'office', fonts: 'office', background: 'light', decor: 'none', variants: ['office', 'office2013', 'gray', 'blueWarm'] },
  { id: 'horizon', name: S.themes.horizon, palette: 'blue2', fonts: 'segoe', background: 'light', decor: 'bottomBar', variants: ['blue2', 'green', 'red', 'violet'] },
  { id: 'ardoise', name: S.themes.ardoise, palette: 'slipstream', fonts: 'century', background: 'dark', decor: 'leftBand', variants: ['slipstream', 'blue', 'orange', 'marquee'] },
  { id: 'aurore', name: S.themes.aurore, palette: 'violet', fonts: 'trebuchet', background: 'gradient', decor: 'circles', variants: ['violet', 'blueWarm', 'aspect', 'paper'] },
  { id: 'galet', name: S.themes.galet, palette: 'paper', fonts: 'georgia', background: 'soft', decor: 'frame', variants: ['paper', 'green', 'yellow', 'gray'] },
  { id: 'retro', name: S.themes.retro, palette: 'aspect', fonts: 'cambria', background: 'soft', decor: 'topBar', variants: ['aspect', 'orange', 'red', 'office2007'] },
  { id: 'facettes', name: S.themes.facettes, palette: 'green', fonts: 'tw', background: 'light', decor: 'corner', variants: ['green', 'blueGreen', 'blue', 'yellow'] },
  { id: 'elan', name: S.themes.elan, palette: 'marquee', fonts: 'arial', background: 'light', decor: 'diagonal', variants: ['marquee', 'office', 'slipstream', 'red'] },
];

const rgb = (value: string): Color => ({ type: 'rgb', value });

export function paletteColors(palette: Palette, base: ThemeColors): ThemeColors {
  const [dk2, lt2, a1, a2, a3, a4, a5, a6, hlink, folHlink] = palette.colors;
  return { ...base, name: palette.name, dk2: rgb(dk2), lt2: rgb(lt2), accent1: rgb(a1), accent2: rgb(a2), accent3: rgb(a3), accent4: rgb(a4), accent5: rgb(a5), accent6: rgb(a6), hlink: rgb(hlink), folHlink: rgb(folHlink) };
}

/** Applique une palette a tous les masques. */
export function applyPalette(deck: Deck, paletteId: string): Deck {
  const palette = PALETTES.find((x) => x.id === paletteId);
  if (!palette) return deck;
  return { ...deck, masters: deck.masters.map((m) => ({ ...m, theme: { ...m.theme, colors: paletteColors(palette, m.theme.colors) } })) };
}

export function applyFonts(deck: Deck, pairId: string): Deck {
  const pair = FONT_PAIRS.find((x) => x.id === pairId);
  if (!pair) return deck;
  return {
    ...deck,
    masters: deck.masters.map((m) => ({
      ...m,
      theme: { ...m.theme, fonts: { ...m.theme.fonts, name: `${pair.major} / ${pair.minor}`, major: { ...m.theme.fonts.major, latin: pair.major }, minor: { ...m.theme.fonts.minor, latin: pair.minor } } },
    })),
  };
}

const DECOR_PREFIX = 'Décor';

function rect(id: number, name: string, x: number, y: number, width: number, height: number, fill: Fill, preset = 'rect', rotation?: number): AutoShape {
  return { kind: 'shape', id, name: `${DECOR_PREFIX} ${name}`, xfrm: rotation ? { x, y, width, height, rotation } : { x, y, width, height }, geometry: { type: 'preset', preset }, fill, line: { fill: { type: 'none' } } };
}

const accent = (slot: 'accent1' | 'accent2' | 'accent3', mods?: Array<[string, number]>): Fill => ({ type: 'solid', color: { type: 'scheme', value: slot, mods: mods?.map(([name, val]) => ({ name, val })) } });

/** Formes de decor d'un theme pour une taille de page. */
export function decorShapes(decor: Decor, size: SlideSize, firstId: number): Shape[] {
  const { width: w, height: h } = size;
  let id = firstId;
  const next = (): number => id++;
  switch (decor) {
    case 'leftBand':
      return [rect(next(), 'bande', 0, 0, w * 0.018, h, accent('accent1'))];
    case 'bottomBar':
      return [rect(next(), 'barre', 0, h - h * 0.035, w, h * 0.035, accent('accent1')), rect(next(), 'filet', 0, h - h * 0.045, w, h * 0.008, accent('accent2'))];
    case 'topBar':
      return [rect(next(), 'barre', 0, 0, w, h * 0.06, accent('accent1')), rect(next(), 'filet', 0, h * 0.06, w, h * 0.006, accent('accent2'))];
    case 'corner':
      return [rect(next(), 'angle', w * 0.82, 0, w * 0.18, h * 0.32, accent('accent1'), 'rtTriangle', 180), rect(next(), 'angle 2', w * 0.9, 0, w * 0.1, h * 0.18, accent('accent2'), 'rtTriangle', 180)];
    case 'frame':
      return [rect(next(), 'cadre', w * 0.02, h * 0.035, w * 0.96, h * 0.93, { type: 'none' }, 'rect')].map((s) => ({ ...s, line: { width: 1.5, fill: accent('accent1', [['lumMod', 60000], ['lumOff', 40000]]) } }));
    case 'circles':
      return [
        rect(next(), 'cercle', w * 0.78, -h * 0.18, h * 0.6, h * 0.6, accent('accent1', [['alpha', 35000]]), 'ellipse'),
        rect(next(), 'cercle 2', w * 0.88, h * 0.22, h * 0.32, h * 0.32, accent('accent2', [['alpha', 40000]]), 'ellipse'),
      ];
    case 'diagonal':
      return [rect(next(), 'diagonale', w * 0.7, h * 0.86, w * 0.36, h * 0.2, accent('accent1'), 'parallelogram'), rect(next(), 'diagonale 2', w * 0.86, h * 0.9, w * 0.2, h * 0.14, accent('accent2'), 'parallelogram')];
    default:
      return [];
  }
}

function backgroundFill(kind: DesignTheme['background']): Fill {
  switch (kind) {
    case 'dark':
      return { type: 'solid', color: { type: 'scheme', value: 'dk2' } };
    case 'soft':
      return { type: 'solid', color: { type: 'scheme', value: 'lt2', mods: [{ name: 'lumMod', val: 40000 }, { name: 'lumOff', val: 60000 }] } };
    case 'gradient':
      return { type: 'gradient', kind: 'linear', angle: 45, stops: [{ position: 0, color: { type: 'scheme', value: 'bg1' } }, { position: 100, color: { type: 'scheme', value: 'lt2' } }] };
    default:
      return { type: 'solid', color: { type: 'scheme', value: 'bg1' } };
  }
}

/** Applique un theme (palette, polices, arriere-plan, decor du masque) ; `variant` choisit la palette 0..3. */
export function applyDesignTheme(deck: Deck, themeId: string, variant = 0): Deck {
  const theme = DESIGN_THEMES.find((t) => t.id === themeId);
  if (!theme) return deck;
  let next = applyFonts(applyPalette(deck, theme.variants[variant] ?? theme.palette), theme.fonts);
  const dark = theme.background === 'dark';
  next = {
    ...next,
    masters: next.masters.map((m) => {
      const kept = m.shapes.filter((s) => !s.name.startsWith(DECOR_PREFIX));
      const firstId = Math.max(1, ...m.shapes.map((s) => s.id)) + 1;
      const colorMap = dark ? { ...m.colorMap, bg1: 'dk1' as const, tx1: 'lt1' as const, bg2: 'dk2' as const, tx2: 'lt2' as const } : { ...m.colorMap, bg1: 'lt1' as const, tx1: 'dk1' as const, bg2: 'lt2' as const, tx2: 'dk2' as const };
      return {
        ...m,
        theme: { ...m.theme, name: theme.name },
        background: { type: 'fill' as const, fill: backgroundFill(theme.background) },
        colorMap,
        shapes: [...decorShapes(theme.decor, deck.size, firstId), ...kept],
      };
    }),
  };
  return next;
}

/** Nom du theme courant d'apres le nom du theme du premier masque. */
export function currentThemeId(deck: Deck): string {
  const name = deck.masters[0]?.theme.name;
  return DESIGN_THEMES.find((t) => t.name === name)?.id ?? 'office';
}

/** Couleurs du theme en hexadecimal (10 couleurs du selecteur : lt1, dk1, lt2, dk2, accent1..6). */
export function themeSwatches(colors: ThemeColors): string[] {
  const hex = (c: Color): string => (c.type === 'rgb' ? `#${c.value}` : c.type === 'system' ? `#${c.last ?? '000000'}` : '#000000');
  return [colors.lt1, colors.dk1, colors.lt2, colors.dk2, colors.accent1, colors.accent2, colors.accent3, colors.accent4, colors.accent5, colors.accent6].map(hex);
}
