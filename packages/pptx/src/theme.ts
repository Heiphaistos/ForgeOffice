// Theme (couleurs, polices, styles de mise en forme) : theme Office 2024 par defaut, lecture et ecriture de a:theme.
import { attr, child, children, el, type XmlElement } from '@forgeoffice/opc';
import { readColor, readEffects, readFillElement, readLine, type DmlReadContext } from './dml-read.ts';
import { writeColor, writeEffects, writeFill, writeLine, type DmlWriteContext } from './dml-write.ts';
import type { Color, ColorMod, Effects, Fill, Line } from './dml.ts';
import type { FontSet, Theme, ThemeColors, ThemeColorSlot } from './model.ts';
import { STRINGS } from './strings.ts';
import { rootNamespaces } from './xmlns.ts';

const ph = (...mods: Array<[string, number]>): Color => ({ type: 'scheme', value: 'phClr', mods: mods.map(([name, val]): ColorMod => ({ name, val })) });

/** Polices de repli quand Aptos n'est pas installee (Windows anterieur a 2023, Linux, macOS). */
export const APTOS_FALLBACKS: Readonly<Record<string, string[]>> = {
  Aptos: ['Aptos', 'Segoe UI', 'Calibri', 'Helvetica Neue', 'Liberation Sans', 'Arial', 'sans-serif'],
  'Aptos Display': ['Aptos Display', 'Aptos', 'Segoe UI Semibold', 'Calibri Light', 'Helvetica Neue', 'Liberation Sans', 'Arial', 'sans-serif'],
  Calibri: ['Calibri', 'Carlito', 'Segoe UI', 'Arial', 'sans-serif'],
  'Calibri Light': ['Calibri Light', 'Carlito', 'Segoe UI Light', 'Arial', 'sans-serif'],
  Cambria: ['Cambria', 'Caladea', 'Georgia', 'serif'],
};

const SCRIPT_FONTS_MAJOR: Readonly<Record<string, string>> = {
  Jpan: '游ゴシック Light',
  Hang: '맑은 고딕',
  Hans: '等线 Light',
  Hant: '新細明體',
  Arab: 'Times New Roman',
  Hebr: 'Times New Roman',
  Thai: 'Angsana New',
  Viet: 'Times New Roman',
};

const SCRIPT_FONTS_MINOR: Readonly<Record<string, string>> = {
  Jpan: '游ゴシック',
  Hang: '맑은 고딕',
  Hans: '等线',
  Hant: '新細明體',
  Arab: 'Arial',
  Hebr: 'Arial',
  Thai: 'Cordia New',
  Viet: 'Arial',
};

const line = (width: number): Line => ({ fill: { type: 'solid', color: ph() }, width, cap: 'flat', compound: 'sng', align: 'ctr', dash: 'solid', join: 'miter' });

/** Theme « Office » de Microsoft 365 / Office 2024 (Aptos, nouvelle palette 2023). */
export function office2024Theme(): Theme {
  const rgb = (value: string): Color => ({ type: 'rgb', value });
  return {
    name: STRINGS.themeName,
    colors: {
      name: 'Office',
      dk1: { type: 'system', value: 'windowText', last: '000000' },
      lt1: { type: 'system', value: 'window', last: 'FFFFFF' },
      dk2: rgb('0E2841'),
      lt2: rgb('E8E8E8'),
      accent1: rgb('156082'),
      accent2: rgb('E97132'),
      accent3: rgb('196B24'),
      accent4: rgb('0F9ED5'),
      accent5: rgb('A02B93'),
      accent6: rgb('4EA72E'),
      hlink: rgb('467886'),
      folHlink: rgb('96607D'),
    },
    fonts: {
      name: 'Office',
      major: { latin: 'Aptos Display', eastAsian: '', complex: '', scripts: { ...SCRIPT_FONTS_MAJOR } },
      minor: { latin: 'Aptos', eastAsian: '', complex: '', scripts: { ...SCRIPT_FONTS_MINOR } },
    },
    formatScheme: {
      name: 'Office',
      fills: [
        { type: 'solid', color: ph() },
        {
          type: 'gradient',
          kind: 'linear',
          angle: 90,
          scaled: false,
          rotateWithShape: true,
          stops: [
            { position: 0, color: ph(['lumMod', 110000], ['satMod', 105000], ['tint', 67000]) },
            { position: 50, color: ph(['lumMod', 105000], ['satMod', 103000], ['tint', 73000]) },
            { position: 100, color: ph(['lumMod', 105000], ['satMod', 109000], ['tint', 81000]) },
          ],
        },
        {
          type: 'gradient',
          kind: 'linear',
          angle: 90,
          scaled: false,
          rotateWithShape: true,
          stops: [
            { position: 0, color: ph(['satMod', 103000], ['lumMod', 102000], ['tint', 94000]) },
            { position: 50, color: ph(['satMod', 110000], ['lumMod', 100000], ['shade', 100000]) },
            { position: 100, color: ph(['lumMod', 99000], ['satMod', 120000], ['shade', 78000]) },
          ],
        },
      ],
      lines: [line(1), line(1.5), line(2)],
      effects: [
        {},
        {},
        {
          outerShadow: {
            color: { type: 'rgb', value: '000000', mods: [{ name: 'alpha', val: 63000 }] },
            blur: 4.5,
            distance: 1.5,
            direction: 90,
            align: 'ctr',
            rotateWithShape: false,
          },
        },
      ],
      backgroundFills: [
        { type: 'solid', color: ph() },
        { type: 'solid', color: ph(['tint', 95000], ['satMod', 170000]) },
        {
          type: 'gradient',
          kind: 'linear',
          angle: 90,
          scaled: false,
          rotateWithShape: true,
          stops: [
            { position: 0, color: ph(['tint', 93000], ['satMod', 150000], ['shade', 98000], ['lumMod', 102000]) },
            { position: 50, color: ph(['tint', 98000], ['satMod', 130000], ['shade', 90000], ['lumMod', 103000]) },
            { position: 100, color: ph(['shade', 63000], ['satMod', 120000]) },
          ],
        },
      ],
    },
    fontFallbacks: { ...APTOS_FALLBACKS },
  };
}

/** Pile de polices CSS pour un nom de police (avec repli). */
export function fontStack(font: string, theme?: Theme): string {
  const list = theme?.fontFallbacks?.[font] ?? APTOS_FALLBACKS[font] ?? [font, 'sans-serif'];
  return list.map((name) => (/^[a-z-]+$/.test(name) ? name : `"${name.replace(/"/g, '')}"`)).join(', ');
}

/** Resout une police de theme (+mj-lt, +mn-ea...) en nom de police. */
export function resolveThemeFont(font: string | undefined, theme: Theme): string | undefined {
  if (!font?.startsWith('+')) return font;
  const set = font.startsWith('+mj') ? theme.fonts.major : theme.fonts.minor;
  if (font.endsWith('-ea')) return set.eastAsian || set.latin;
  if (font.endsWith('-cs')) return set.complex || set.latin;
  return set.latin;
}

// ---- Lecture ----

const SLOTS: ThemeColorSlot[] = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

function readFontSet(node: XmlElement | undefined, fallback: FontSet): FontSet {
  if (!node) return fallback;
  const set: FontSet = {
    latin: attr(child(node, 'a:latin'), 'typeface') ?? fallback.latin,
    eastAsian: attr(child(node, 'a:ea'), 'typeface') ?? '',
    complex: attr(child(node, 'a:cs'), 'typeface') ?? '',
  };
  const scripts: Record<string, string> = {};
  for (const font of children(node, 'a:font')) {
    const script = attr(font, 'script');
    const face = attr(font, 'typeface');
    if (script && face !== undefined) scripts[script] = face;
  }
  if (Object.keys(scripts).length) set.scripts = scripts;
  return set;
}

function listOf<T>(node: XmlElement | undefined, read: (item: XmlElement) => T | undefined, fallback: T[]): T[] {
  const items = children(node).map(read).filter((x): x is T => x !== undefined);
  return items.length ? items : fallback;
}

/** Lit a:theme ; les valeurs absentes reprennent le theme Office 2024. */
export function readTheme(root: XmlElement, ctx: DmlReadContext): Theme {
  const base = office2024Theme();
  const elements = child(root, 'a:themeElements');
  const clr = child(elements, 'a:clrScheme');
  const colors: ThemeColors = { ...base.colors, name: attr(clr, 'name') ?? base.colors.name };
  for (const slot of SLOTS) {
    const color = readColor(child(clr, `a:${slot}`));
    if (color) colors[slot] = color;
  }
  const fontScheme = child(elements, 'a:fontScheme');
  const fmt = child(elements, 'a:fmtScheme');
  const fills = listOf(child(fmt, 'a:fillStyleLst'), (n) => readFillElement(n, ctx), base.formatScheme.fills);
  const lines = listOf(child(fmt, 'a:lnStyleLst'), (n) => readLine(n, ctx), base.formatScheme.lines);
  const effects = listOf<Effects>(child(fmt, 'a:effectStyleLst'), (n) => readEffects(n, n) ?? {}, base.formatScheme.effects);
  const backgroundFills = listOf(child(fmt, 'a:bgFillStyleLst'), (n) => readFillElement(n, ctx), base.formatScheme.backgroundFills);
  const theme: Theme = {
    name: attr(root, 'name') ?? base.name,
    colors,
    fonts: {
      name: attr(fontScheme, 'name') ?? base.fonts.name,
      major: readFontSet(child(fontScheme, 'a:majorFont'), base.fonts.major),
      minor: readFontSet(child(fontScheme, 'a:minorFont'), base.fonts.minor),
    },
    formatScheme: { name: attr(fmt, 'name') ?? base.formatScheme.name, fills, lines, effects, backgroundFills },
    fontFallbacks: { ...APTOS_FALLBACKS },
  };
  return theme;
}

// ---- Ecriture ----

function writeFontSet(name: string, set: FontSet): XmlElement {
  const kids = [el('a:latin', { typeface: set.latin, panose: set.latin.startsWith('Aptos') ? '02110004020202020204' : undefined }), el('a:ea', { typeface: set.eastAsian }), el('a:cs', { typeface: set.complex })];
  for (const [script, typeface] of Object.entries(set.scripts ?? {})) kids.push(el('a:font', { script, typeface }));
  return el(name, {}, kids);
}

/** Complete une liste a 3 elements (le schema en exige au moins 3). */
function three<T>(items: T[], fallback: T[]): T[] {
  const out = items.slice();
  while (out.length < 3) out.push(fallback[out.length] as T);
  return out;
}

export function writeTheme(theme: Theme, ctx: DmlWriteContext): XmlElement {
  const base = office2024Theme();
  const clr = el('a:clrScheme', { name: theme.colors.name }, SLOTS.map((slot) => el(`a:${slot}`, {}, [writeColor(theme.colors[slot])])));
  const fontScheme = el('a:fontScheme', { name: theme.fonts.name }, [writeFontSet('a:majorFont', theme.fonts.major), writeFontSet('a:minorFont', theme.fonts.minor)]);
  const fmt = theme.formatScheme;
  const fill = (f: Fill): XmlElement => writeFill(f, ctx) ?? el('a:noFill');
  const fmtScheme = el('a:fmtScheme', { name: fmt.name }, [
    el('a:fillStyleLst', {}, three(fmt.fills, base.formatScheme.fills).map(fill)),
    el('a:lnStyleLst', {}, three(fmt.lines, base.formatScheme.lines).map((l) => writeLine(l, ctx))),
    el('a:effectStyleLst', {}, three(fmt.effects, base.formatScheme.effects).map((e) => el('a:effectStyle', {}, writeEffects(e)))),
    el('a:bgFillStyleLst', {}, three(fmt.backgroundFills, base.formatScheme.backgroundFills).map(fill)),
  ]);
  return el('a:theme', { ...rootNamespaces('a', 'r'), name: theme.name }, [
    el('a:themeElements', {}, [clr, fontScheme, fmtScheme]),
    el('a:objectDefaults'),
    el('a:extraClrSchemeLst'),
  ]);
}
