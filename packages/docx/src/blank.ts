// Document vierge « Office 2024 » : theme Office, styles integres, section A4, reglages par defaut.
import type {
  Border, DocumentProperties, DocumentSettings, Paragraph, Section, Style, StyleSheet, Theme, ThemeColorName, WordDocument,
} from './model.ts';
import { BUILTIN_STYLE_NAMES, LINKED_CHAR_SUFFIX } from './strings.ts';

export const OFFICE_THEME_COLORS: Readonly<Record<ThemeColorName, string>> = {
  dk1: '000000', lt1: 'FFFFFF', dk2: '0E2841', lt2: 'E8E8E8',
  accent1: '156082', accent2: 'E97132', accent3: '196B24', accent4: '0F9ED5', accent5: 'A02B93', accent6: '4EA72E',
  hlink: '467886', folHlink: '96607D',
};

/** Polices de repli quand une police du theme manque sur la machine (Aptos -> Calibri...). */
export const FONT_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  'Aptos': ['Calibri', 'Carlito', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
  'Aptos Display': ['Calibri Light', 'Calibri', 'Carlito', 'Segoe UI', 'Arial', 'sans-serif'],
  'Aptos Mono': ['Consolas', 'Cascadia Mono', 'Courier New', 'monospace'],
  'Calibri': ['Carlito', 'Segoe UI', 'Arial', 'sans-serif'],
  'Calibri Light': ['Calibri', 'Carlito', 'Arial', 'sans-serif'],
  'Cambria': ['Caladea', 'Georgia', 'Times New Roman', 'serif'],
  'Times New Roman': ['Liberation Serif', 'Tinos', 'serif'],
  'Arial': ['Liberation Sans', 'Arimo', 'Helvetica', 'sans-serif'],
  'Courier New': ['Liberation Mono', 'Cousine', 'monospace'],
  'Consolas': ['Cascadia Mono', 'Courier New', 'monospace'],
};

/** Pile CSS d'une police avec ses replis (« "Aptos", "Calibri", ..., sans-serif »). */
export function cssFontStack(font: string): string {
  const generic = new Set(['serif', 'sans-serif', 'monospace']);
  const list = [font, ...(FONT_FALLBACKS[font] ?? ['sans-serif'])];
  return [...new Set(list)].map((f) => (generic.has(f) ? f : `"${f.replace(/"/g, '')}"`)).join(', ');
}

export function createOfficeTheme(): Theme {
  return { name: 'Office', majorFont: 'Aptos Display', minorFont: 'Aptos', colors: { ...OFFICE_THEME_COLORS }, rawXml: null };
}

/** Section A4 portrait, marges 2,5 cm (valeurs de Word en francais). */
export function createDefaultSection(): Section {
  return {
    pageWidth: 595.3,
    pageHeight: 841.9,
    orientation: 'portrait',
    margins: { top: 70.85, right: 70.85, bottom: 70.85, left: 70.85, header: 35.4, footer: 35.4, gutter: 0 },
    columns: { count: 1, space: 35.4, equalWidth: true, separator: false },
    headers: {},
    footers: {},
    titlePage: false,
    breakType: 'nextPage',
  };
}

export function createDefaultSettings(): DocumentSettings {
  return {
    defaultTabStop: 35.4,
    evenAndOddHeaders: false,
    mirrorMargins: false,
    trackRevisions: false,
    autoHyphenation: false,
    zoom: 100,
    updateFields: false,
    compatibilityMode: 15,
    language: 'fr-FR',
  };
}

export function createDefaultProperties(): DocumentProperties {
  return { custom: {} };
}

const ACCENT_DARK = '0F4761';

const thin = (): Border => ({ style: 'single', width: 0.5, color: 'auto', space: 0 });

const heading = (level: number): Style => {
  const sizes = [20, 16, 14, 12, 12, 11, 11, 11, 11];
  const major = level <= 3;
  const italic = level === 4 || level === 6 || level === 8;
  const color = level <= 5 ? ACCENT_DARK : level <= 7 ? '595959' : '272727';
  return {
    id: `Heading${level}`, type: 'paragraph', name: `heading ${level}`, basedOn: 'Normal', next: 'Normal',
    link: `Heading${level}Char`, uiPriority: 9, quickFormat: true, unhideWhenUsed: level > 1 ? true : undefined,
    semiHidden: level > 3 ? true : undefined,
    paragraph: {
      keepNext: true, keepLines: true, outlineLevel: level - 1,
      spacingBefore: level === 1 ? 18 : level <= 3 ? 8 : 4, spacingAfter: level <= 3 ? 4 : 2,
    },
    run: {
      fontTheme: major ? 'major' : 'minor', size: sizes[level - 1], italic: italic || undefined,
      color: { rgb: color, theme: level <= 5 ? 'accent1' : 'text1', shade: level <= 5 ? 0xbf : undefined },
    },
  };
};

const linkedChar = (paragraphStyle: Style): Style => ({
  id: `${paragraphStyle.id}Char`, type: 'character', name: `${paragraphStyle.name}${LINKED_CHAR_SUFFIX.toLowerCase()}`,
  basedOn: 'DefaultParagraphFont', link: paragraphStyle.id, uiPriority: paragraphStyle.uiPriority,
  run: paragraphStyle.run ? { ...paragraphStyle.run } : undefined,
});

/** Styles integres Office 2024 (identifiants anglais, noms internes Word ; noms affiches via styleDisplayName). */
export function createBuiltinStyles(): Style[] {
  const headings = Array.from({ length: 9 }, (_, i) => heading(i + 1));
  const title: Style = {
    id: 'Title', type: 'paragraph', name: 'Title', basedOn: 'Normal', next: 'Normal', link: 'TitleChar', uiPriority: 10, quickFormat: true,
    paragraph: { spacingAfter: 4, contextualSpacing: true },
    run: { fontTheme: 'major', size: 28, spacing: -0.5, kerning: 14 },
  };
  const subtitle: Style = {
    id: 'Subtitle', type: 'paragraph', name: 'Subtitle', basedOn: 'Normal', next: 'Normal', link: 'SubtitleChar', uiPriority: 11, quickFormat: true,
    paragraph: { spacingAfter: 8 },
    run: { fontTheme: 'major', size: 14, spacing: 0.75, color: { rgb: '595959', theme: 'text1', tint: 0xa6 } },
  };
  const quote: Style = {
    id: 'Quote', type: 'paragraph', name: 'Quote', basedOn: 'Normal', next: 'Normal', link: 'QuoteChar', uiPriority: 29, quickFormat: true,
    paragraph: { spacingBefore: 8, alignment: 'center' },
    run: { italic: true, color: { rgb: '404040', theme: 'text1', tint: 0xbf } },
  };
  const intenseQuote: Style = {
    id: 'IntenseQuote', type: 'paragraph', name: 'Intense Quote', basedOn: 'Normal', next: 'Normal', link: 'IntenseQuoteChar', uiPriority: 30, quickFormat: true,
    paragraph: {
      spacingBefore: 18, spacingAfter: 18, alignment: 'center', indentLeft: 43.2, indentRight: 43.2,
      borders: {
        top: { style: 'single', width: 0.5, color: ACCENT_DARK, space: 10, themeColor: 'accent1' },
        bottom: { style: 'single', width: 0.5, color: ACCENT_DARK, space: 10, themeColor: 'accent1' },
      },
    },
    run: { italic: true, color: { rgb: ACCENT_DARK, theme: 'accent1', shade: 0xbf } },
  };
  const styles: Style[] = [
    {
      id: 'Normal', type: 'paragraph', name: 'Normal', isDefault: true, uiPriority: 0, quickFormat: true,
    },
    { id: 'DefaultParagraphFont', type: 'character', name: 'Default Paragraph Font', isDefault: true, uiPriority: 1, semiHidden: true, unhideWhenUsed: true },
    {
      id: 'TableNormal', type: 'table', name: 'Normal Table', isDefault: true, uiPriority: 99, semiHidden: true, unhideWhenUsed: true,
      table: { indent: 0, cellMargins: { top: 0, left: 5.4, bottom: 0, right: 5.4 } },
    },
    { id: 'NoList', type: 'numbering', name: 'No List', isDefault: true, uiPriority: 99, semiHidden: true, unhideWhenUsed: true },
    ...headings,
    title,
    subtitle,
    quote,
    intenseQuote,
    ...headings.map(linkedChar),
    linkedChar(title),
    linkedChar(subtitle),
    linkedChar(quote),
    linkedChar(intenseQuote),
    { id: 'NoSpacing', type: 'paragraph', name: 'No Spacing', uiPriority: 1, quickFormat: true, paragraph: { spacingAfter: 0, lineSpacing: { rule: 'auto', value: 1 } } },
    { id: 'ListParagraph', type: 'paragraph', name: 'List Paragraph', basedOn: 'Normal', uiPriority: 34, quickFormat: true, paragraph: { indentLeft: 36, contextualSpacing: true } },
    { id: 'Emphasis', type: 'character', name: 'Emphasis', basedOn: 'DefaultParagraphFont', uiPriority: 20, quickFormat: true, run: { italic: true } },
    { id: 'Strong', type: 'character', name: 'Strong', basedOn: 'DefaultParagraphFont', uiPriority: 22, quickFormat: true, run: { bold: true } },
    { id: 'SubtleEmphasis', type: 'character', name: 'Subtle Emphasis', basedOn: 'DefaultParagraphFont', uiPriority: 19, quickFormat: true, run: { italic: true, color: { rgb: '404040', theme: 'text1', tint: 0xbf } } },
    { id: 'IntenseEmphasis', type: 'character', name: 'Intense Emphasis', basedOn: 'DefaultParagraphFont', uiPriority: 21, quickFormat: true, run: { italic: true, color: { rgb: ACCENT_DARK, theme: 'accent1', shade: 0xbf } } },
    { id: 'SubtleReference', type: 'character', name: 'Subtle Reference', basedOn: 'DefaultParagraphFont', uiPriority: 31, quickFormat: true, run: { smallCaps: true, color: { rgb: '5A5A5A', theme: 'text1', tint: 0xa5 } } },
    { id: 'IntenseReference', type: 'character', name: 'Intense Reference', basedOn: 'DefaultParagraphFont', uiPriority: 32, quickFormat: true, run: { bold: true, smallCaps: true, spacing: 0.25, color: { rgb: ACCENT_DARK, theme: 'accent1', shade: 0xbf } } },
    { id: 'BookTitle', type: 'character', name: 'Book Title', basedOn: 'DefaultParagraphFont', uiPriority: 33, quickFormat: true, run: { bold: true, italic: true, spacing: 0.25 } },
    { id: 'Hyperlink', type: 'character', name: 'Hyperlink', basedOn: 'DefaultParagraphFont', uiPriority: 99, unhideWhenUsed: true, run: { color: { rgb: '467886', theme: 'hyperlink' }, underline: 'single' } },
    { id: 'FollowedHyperlink', type: 'character', name: 'FollowedHyperlink', basedOn: 'DefaultParagraphFont', uiPriority: 99, semiHidden: true, unhideWhenUsed: true, run: { color: { rgb: '96607D', theme: 'followedHyperlink' }, underline: 'single' } },
    {
      id: 'TableGrid', type: 'table', name: 'Table Grid', basedOn: 'TableNormal', uiPriority: 39,
      paragraph: { spacingAfter: 0, lineSpacing: { rule: 'auto', value: 1 } },
      table: {
        borders: { top: thin(), left: thin(), bottom: thin(), right: thin(), insideH: thin(), insideV: thin() },
      },
    },
    { id: 'Header', type: 'paragraph', name: 'header', basedOn: 'Normal', link: 'HeaderChar', uiPriority: 99, unhideWhenUsed: true, paragraph: { spacingAfter: 0, lineSpacing: { rule: 'auto', value: 1 }, tabs: [{ position: 226.8, align: 'center' }, { position: 453.6, align: 'right' }] } },
    { id: 'Footer', type: 'paragraph', name: 'footer', basedOn: 'Normal', link: 'FooterChar', uiPriority: 99, unhideWhenUsed: true, paragraph: { spacingAfter: 0, lineSpacing: { rule: 'auto', value: 1 }, tabs: [{ position: 226.8, align: 'center' }, { position: 453.6, align: 'right' }] } },
    { id: 'FootnoteText', type: 'paragraph', name: 'footnote text', basedOn: 'Normal', uiPriority: 99, semiHidden: true, unhideWhenUsed: true, paragraph: { spacingAfter: 0, lineSpacing: { rule: 'auto', value: 1 } }, run: { size: 10 } },
    { id: 'FootnoteReference', type: 'character', name: 'footnote reference', basedOn: 'DefaultParagraphFont', uiPriority: 99, semiHidden: true, unhideWhenUsed: true, run: { vertAlign: 'superscript' } },
    { id: 'EndnoteText', type: 'paragraph', name: 'endnote text', basedOn: 'Normal', uiPriority: 99, semiHidden: true, unhideWhenUsed: true, paragraph: { spacingAfter: 0, lineSpacing: { rule: 'auto', value: 1 } }, run: { size: 10 } },
    { id: 'EndnoteReference', type: 'character', name: 'endnote reference', basedOn: 'DefaultParagraphFont', uiPriority: 99, semiHidden: true, unhideWhenUsed: true, run: { vertAlign: 'superscript' } },
    { id: 'CommentText', type: 'paragraph', name: 'annotation text', basedOn: 'Normal', uiPriority: 99, unhideWhenUsed: true, paragraph: { lineSpacing: { rule: 'auto', value: 1 } }, run: { size: 10 } },
    { id: 'CommentReference', type: 'character', name: 'annotation reference', basedOn: 'DefaultParagraphFont', uiPriority: 99, semiHidden: true, unhideWhenUsed: true, run: { size: 8 } },
    { id: 'Caption', type: 'paragraph', name: 'caption', basedOn: 'Normal', next: 'Normal', uiPriority: 35, unhideWhenUsed: true, quickFormat: true, paragraph: { spacingAfter: 10, lineSpacing: { rule: 'auto', value: 1 } }, run: { italic: true, size: 9, color: { rgb: '0E2841', theme: 'text2' } } },
    { id: 'TOCHeading', type: 'paragraph', name: 'TOC Heading', basedOn: 'Heading1', next: 'Normal', uiPriority: 39, unhideWhenUsed: true, quickFormat: true, paragraph: { outlineLevel: 9, spacingBefore: 12, spacingAfter: 0 } },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n): Style => ({
      id: `TOC${n}`, type: 'paragraph', name: `toc ${n}`, basedOn: 'Normal', next: 'Normal', uiPriority: 39, unhideWhenUsed: true,
      paragraph: { spacingAfter: 5, indentLeft: (n - 1) * 11 },
    })),
    { id: 'PlaceholderText', type: 'character', name: 'Placeholder Text', basedOn: 'DefaultParagraphFont', uiPriority: 99, semiHidden: true, run: { color: { rgb: '666666' } } },
  ];
  return styles;
}

export function createDefaultStyleSheet(): StyleSheet {
  return {
    docDefaults: {
      run: { fontTheme: 'minor', size: 11, kerning: 1, lang: 'fr-FR', langEastAsia: 'en-US', langComplex: 'ar-SA' },
      paragraph: { spacingAfter: 8, lineSpacing: { rule: 'auto', value: 1.08 } },
    },
    styles: createBuiltinStyles(),
  };
}

export function createParagraph(text = '', styleId?: string): Paragraph {
  return { type: 'paragraph', styleId, props: {}, inlines: text ? [{ type: 'text', text, props: {} }] : [] };
}

/** Document vierge Office 2024 : Aptos 11 pt (repli Calibri), interligne 1,08, 8 pt apres, A4.
 *  `'onlyoffice'` : valeurs d'un nouveau document d'OnlyOffice Desktop 10.0 (releve : Arial 11, interligne 1,15, 10 pt apres). */
export function createBlankDocument(profile?: 'onlyoffice'): WordDocument {
  const oo = profile === 'onlyoffice';
  const styles = createDefaultStyleSheet();
  if (oo) styles.docDefaults = { ...styles.docDefaults, paragraph: { spacingAfter: 10, lineSpacing: { rule: 'auto', value: 1.15 } } };
  return {
    kind: 'docx',
    properties: createDefaultProperties(),
    theme: oo ? { ...createOfficeTheme(), majorFont: 'Arial', minorFont: 'Arial' } : createOfficeTheme(),
    settings: createDefaultSettings(),
    styles,
    numbering: { abstracts: [], instances: [] },
    body: [createParagraph()],
    finalSection: createDefaultSection(),
    headersFooters: {},
    footnotes: [],
    endnotes: [],
    comments: [],
    media: {},
    fonts: {
      'Aptos': { family: 'swiss', altName: 'Calibri' },
      'Aptos Display': { family: 'swiss', altName: 'Calibri Light' },
      'Times New Roman': { family: 'roman' },
    },
    preserved: [],
  };
}

/** Nom affichable en francais d'un style (integre traduit, personnalise tel quel). */
export function styleDisplayName(style: Pick<Style, 'name' | 'id'>): string {
  const key = style.name.toLowerCase();
  const direct = BUILTIN_STYLE_NAMES[key];
  if (direct) return direct;
  const suffix = LINKED_CHAR_SUFFIX.toLowerCase();
  if (key.endsWith(suffix)) {
    const base = BUILTIN_STYLE_NAMES[key.slice(0, -suffix.length)];
    if (base) return `${base}${LINKED_CHAR_SUFFIX}`;
  }
  return style.name || style.id;
}

/** Style integre par identifiant (pour l'ajouter a un document qui ne l'a pas encore). */
export function builtinStyle(id: string): Style | undefined {
  return createBuiltinStyles().find((s) => s.id === id);
}
