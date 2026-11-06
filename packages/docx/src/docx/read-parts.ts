// Lecture des parties annexes : styles, numerotation, theme, reglages, proprietes, polices.
import { attr, boolAttr, child, children, descendants, numAttr, path, textOf, type XmlElement } from '@forgeoffice/opc';
import type {
  AbstractNumbering, DocumentProperties, DocumentSettings, NumberFormat, Numbering, NumberingLevel, Style, StyleSheet,
  StyleType, TableConditionalFormat, TableRegion, Theme, ThemeColorName, WordDocument,
} from '../model.ts';
import { createDefaultSettings, createOfficeTheme } from '../blank.ts';
import { canonicalStyleName, headingLevelOfStyle } from '../style-names.ts';
import { twipsToPt } from '../units.ts';
import { compact, parseCellProps, parseParagraphProps, parseRunProps, parseTableProps } from './read-props.ts';

const val = (el: XmlElement | undefined): string | undefined => attr(el, 'w:val');

const STYLE_TYPES = new Set<StyleType>(['paragraph', 'character', 'table', 'numbering']);

export function parseStyles(root: XmlElement): StyleSheet {
  const defaults = child(root, 'w:docDefaults');
  const styles: Style[] = [];
  for (const s of children(root, 'w:style')) {
    const type = (attr(s, 'w:type') ?? 'paragraph') as StyleType;
    const id = attr(s, 'w:styleId');
    if (!id || !STYLE_TYPES.has(type)) continue;
    const conditional: TableConditionalFormat[] = children(s, 'w:tblStylePr').map((c) => compact<TableConditionalFormat>({
      region: (attr(c, 'w:type') ?? 'wholeTable') as TableRegion,
      paragraph: child(c, 'w:pPr') ? parseParagraphProps(child(c, 'w:pPr')) : undefined,
      run: child(c, 'w:rPr') ? parseRunProps(child(c, 'w:rPr')) : undefined,
      table: child(c, 'w:tblPr') ? parseTableProps(child(c, 'w:tblPr')) : undefined,
      cell: child(c, 'w:tcPr') ? parseCellProps(child(c, 'w:tcPr')) : undefined,
    }));
    const flag = (name: string): boolean | undefined => (child(s, name) ? boolAttr(child(s, name)) : undefined);
    styles.push(compact<Style>({
      id, type,
      name: val(child(s, 'w:name')) ?? id,
      basedOn: val(child(s, 'w:basedOn')),
      next: val(child(s, 'w:next')),
      link: val(child(s, 'w:link')),
      isDefault: attr(s, 'w:default') === '1' || attr(s, 'w:default') === 'true' ? true : undefined,
      custom: attr(s, 'w:customStyle') === '1' || attr(s, 'w:customStyle') === 'true' ? true : undefined,
      uiPriority: numAttr(child(s, 'w:uiPriority'), 'w:val'),
      hidden: flag('w:hidden'),
      semiHidden: flag('w:semiHidden'),
      unhideWhenUsed: flag('w:unhideWhenUsed'),
      quickFormat: flag('w:qFormat'),
      paragraph: child(s, 'w:pPr') ? parseParagraphProps(child(s, 'w:pPr')) : undefined,
      run: child(s, 'w:rPr') ? parseRunProps(child(s, 'w:rPr')) : undefined,
      table: child(s, 'w:tblPr') ? parseTableProps(child(s, 'w:tblPr')) : undefined,
      tableCell: child(s, 'w:tcPr') ? parseCellProps(child(s, 'w:tcPr')) : undefined,
      tableConditional: conditional.length ? conditional : undefined,
    }));
  }
  // Styles integres localises (« Titre1 », nom « Titre 1 ») : nom canonique + niveau hierarchique des titres.
  for (const style of styles) {
    if (style.type !== 'paragraph' || style.custom) continue;
    const canonical = canonicalStyleName(style);
    if (canonical !== style.name && canonical === canonical.toLowerCase()) style.name = canonical;
    const level = headingLevelOfStyle(style);
    if (level && style.paragraph?.outlineLevel === undefined) style.paragraph = { ...style.paragraph, outlineLevel: level - 1 };
  }
  return compact<StyleSheet>({
    docDefaults: {
      run: parseRunProps(path(defaults, 'w:rPrDefault', 'w:rPr')),
      paragraph: parseParagraphProps(path(defaults, 'w:pPrDefault', 'w:pPr')),
    },
    styles,
    latentStyles: child(root, 'w:latentStyles'),
  });
}

function parseLevel(lvl: XmlElement): NumberingLevel {
  const fmt = val(child(lvl, 'w:numFmt')) ?? 'decimal';
  const jc = val(child(lvl, 'w:lvlJc'));
  const suff = val(child(lvl, 'w:suff'));
  const pPr = child(lvl, 'w:pPr');
  const rPr = child(lvl, 'w:rPr');
  return compact<NumberingLevel>({
    level: numAttr(lvl, 'w:ilvl') ?? 0,
    format: fmt as NumberFormat,
    text: val(child(lvl, 'w:lvlText')) ?? '',
    start: numAttr(child(lvl, 'w:start'), 'w:val') ?? 1,
    alignment: jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : 'left',
    suffix: suff === 'space' || suff === 'nothing' ? suff : 'tab',
    restartAfter: numAttr(child(lvl, 'w:lvlRestart'), 'w:val'),
    isLegal: child(lvl, 'w:isLgl') ? boolAttr(child(lvl, 'w:isLgl')) : undefined,
    styleId: val(child(lvl, 'w:pStyle')),
    paragraph: pPr ? parseParagraphProps(pPr) : undefined,
    run: rPr ? parseRunProps(rPr) : undefined,
  });
}

export function parseNumbering(root: XmlElement): Numbering {
  const abstracts: AbstractNumbering[] = children(root, 'w:abstractNum').map((a) => compact<AbstractNumbering>({
    id: numAttr(a, 'w:abstractNumId') ?? 0,
    name: val(child(a, 'w:name')),
    multiLevelType: val(child(a, 'w:multiLevelType')) as AbstractNumbering['multiLevelType'],
    levels: children(a, 'w:lvl').map(parseLevel),
    styleLink: val(child(a, 'w:styleLink')),
    numStyleLink: val(child(a, 'w:numStyleLink')),
  }));
  const instances = children(root, 'w:num').map((n) => ({
    id: numAttr(n, 'w:numId') ?? 0,
    abstractId: numAttr(child(n, 'w:abstractNumId'), 'w:val') ?? 0,
    overrides: children(n, 'w:lvlOverride').map((o) => compact({
      level: numAttr(o, 'w:ilvl') ?? 0,
      startOverride: numAttr(child(o, 'w:startOverride'), 'w:val'),
      definition: child(o, 'w:lvl') ? parseLevel(child(o, 'w:lvl') as XmlElement) : undefined,
    })),
  }));
  return { abstracts, instances };
}

const THEME_COLORS: readonly ThemeColorName[] = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

export function parseTheme(rawXml: string, root: XmlElement): Theme {
  const theme = createOfficeTheme();
  theme.rawXml = rawXml;
  theme.name = attr(root, 'name') ?? theme.name;
  const elements = child(root, 'a:themeElements');
  const scheme = child(elements, 'a:clrScheme');
  for (const name of THEME_COLORS) {
    const slot = child(scheme, `a:${name}`);
    const srgb = child(slot, 'a:srgbClr');
    const sys = child(slot, 'a:sysClr');
    const color = attr(srgb, 'val') ?? attr(sys, 'lastClr');
    if (color && /^[0-9a-fA-F]{6}$/.test(color)) theme.colors[name] = color.toUpperCase();
  }
  const fonts = child(elements, 'a:fontScheme');
  const latin = (kind: string, script: string): string | undefined => attr(path(fonts, kind, script), 'typeface') || undefined;
  theme.majorFont = latin('a:majorFont', 'a:latin') ?? theme.majorFont;
  theme.minorFont = latin('a:minorFont', 'a:latin') ?? theme.minorFont;
  theme.majorEastAsia = latin('a:majorFont', 'a:ea');
  theme.minorEastAsia = latin('a:minorFont', 'a:ea');
  if (!theme.majorEastAsia) delete theme.majorEastAsia;
  if (!theme.minorEastAsia) delete theme.minorEastAsia;
  return theme;
}

export function parseSettings(root: XmlElement): DocumentSettings {
  const settings = createDefaultSettings();
  delete settings.language;
  const tab = numAttr(child(root, 'w:defaultTabStop'), 'w:val');
  if (tab !== undefined) settings.defaultTabStop = twipsToPt(tab);
  const on = (name: string): boolean => (child(root, name) ? boolAttr(child(root, name)) === true : false);
  settings.evenAndOddHeaders = on('w:evenAndOddHeaders');
  settings.mirrorMargins = on('w:mirrorMargins');
  settings.trackRevisions = on('w:trackRevisions');
  settings.autoHyphenation = on('w:autoHyphenation');
  settings.updateFields = on('w:updateFields');
  settings.zoom = numAttr(child(root, 'w:zoom'), 'w:percent') ?? 100;
  for (const setting of children(path(root, 'w:compat'), 'w:compatSetting')) {
    if (attr(setting, 'w:name') === 'compatibilityMode') settings.compatibilityMode = Number(attr(setting, 'w:val')) || 15;
  }
  const lang = val(path(root, 'w:themeFontLang'));
  if (lang) settings.language = lang;
  const protection = child(root, 'w:documentProtection');
  if (protection) {
    settings.protection = { kind: attr(protection, 'w:edit') ?? 'none', enforced: attr(protection, 'w:enforcement') === '1' || attr(protection, 'w:enforcement') === 'true' };
  }
  return settings;
}

const text = (root: XmlElement, name: string): string | undefined => {
  const node = child(root, name);
  const value = node ? textOf(node).trim() : '';
  return value || undefined;
};

export function parseCoreProps(root: XmlElement, props: DocumentProperties): void {
  Object.assign(props, compact({
    title: text(root, 'dc:title'),
    subject: text(root, 'dc:subject'),
    creator: text(root, 'dc:creator'),
    keywords: text(root, 'cp:keywords'),
    description: text(root, 'dc:description'),
    category: text(root, 'cp:category'),
    contentStatus: text(root, 'cp:contentStatus'),
    lastModifiedBy: text(root, 'cp:lastModifiedBy'),
    revision: Number(text(root, 'cp:revision')) || undefined,
    created: text(root, 'dcterms:created'),
    modified: text(root, 'dcterms:modified'),
    lastPrinted: text(root, 'cp:lastPrinted'),
    language: text(root, 'dc:language'),
  }));
}

export function parseAppProps(root: XmlElement, props: DocumentProperties): void {
  Object.assign(props, compact({
    application: text(root, 'Application'),
    company: text(root, 'Company'),
    manager: text(root, 'Manager'),
    template: text(root, 'Template'),
    pages: Number(text(root, 'Pages')) || undefined,
    words: Number(text(root, 'Words')) || undefined,
    characters: Number(text(root, 'Characters')) || undefined,
  }));
}

export function parseCustomProps(root: XmlElement, props: DocumentProperties): void {
  for (const prop of children(root, 'property')) {
    const name = attr(prop, 'name');
    const value = children(prop)[0];
    if (name && value) props.custom[name] = textOf(value);
  }
}

export function parseFonts(root: XmlElement): WordDocument['fonts'] {
  const fonts: WordDocument['fonts'] = {};
  for (const font of children(root, 'w:font')) {
    const name = attr(font, 'w:name');
    if (name) fonts[name] = compact({ family: val(child(font, 'w:family')), altName: val(child(font, 'w:altName')) });
  }
  return fonts;
}

/** w15:commentEx : paraId -> { parent paraId, resolu }. */
export function parseCommentsExtended(root: XmlElement): Map<string, { parent?: string; done: boolean }> {
  const out = new Map<string, { parent?: string; done: boolean }>();
  for (const ex of descendants(root, 'w15:commentEx')) {
    const id = attr(ex, 'w15:paraId');
    if (id) out.set(id, compact({ parent: attr(ex, 'w15:paraIdParent'), done: attr(ex, 'w15:done') === '1' }));
  }
  return out;
}
