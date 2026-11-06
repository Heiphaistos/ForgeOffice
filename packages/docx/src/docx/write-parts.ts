// Ecriture des parties annexes : styles, numerotation, reglages, polices, proprietes du document.
import { el, type XmlElement } from '@forgeoffice/opc';
import type {
  DocumentProperties, DocumentSettings, Inline, NumberingLevel, Numbering, Style, StyleSheet, WordDocument, Block,
} from '../model.ts';
import { ptToTwips } from '../units.ts';
import { NS } from './ns.ts';
import {
  cellPropsChildren, ordered, paragraphPropsXml, runPropsXml, tablePropsChildren,
} from './write-props.ts';

const STYLE_ORDER = [
  'w:name', 'w:aliases', 'w:basedOn', 'w:next', 'w:link', 'w:autoRedefine', 'w:hidden', 'w:uiPriority', 'w:semiHidden',
  'w:unhideWhenUsed', 'w:qFormat', 'w:locked', 'w:personal', 'w:rsid', 'w:pPr', 'w:rPr', 'w:tblPr', 'w:trPr', 'w:tcPr', 'w:tblStylePr',
];

const flag = (name: string, value: boolean | undefined): XmlElement | undefined =>
  value === undefined ? undefined : value ? el(name) : el(name, { 'w:val': '0' });

const defined = (list: (XmlElement | undefined)[]): XmlElement[] => list.filter((x): x is XmlElement => x !== undefined);

function styleXml(style: Style): XmlElement {
  const kids = defined([
    el('w:name', { 'w:val': style.name }),
    style.basedOn ? el('w:basedOn', { 'w:val': style.basedOn }) : undefined,
    style.next ? el('w:next', { 'w:val': style.next }) : undefined,
    style.link ? el('w:link', { 'w:val': style.link }) : undefined,
    flag('w:hidden', style.hidden),
    style.uiPriority === undefined ? undefined : el('w:uiPriority', { 'w:val': style.uiPriority }),
    flag('w:semiHidden', style.semiHidden),
    flag('w:unhideWhenUsed', style.unhideWhenUsed),
    flag('w:qFormat', style.quickFormat),
    style.paragraph ? (paragraphPropsXml(style.paragraph, undefined, []) ?? el('w:pPr')) : undefined,
    style.run ? (runPropsXml(style.run) ?? el('w:rPr')) : undefined,
    style.table ? el('w:tblPr', {}, tablePropsChildren(style.table)) : undefined,
    style.tableCell ? el('w:tcPr', {}, cellPropsChildren(style.tableCell)) : undefined,
    ...(style.tableConditional ?? []).map((c) => el('w:tblStylePr', { 'w:type': c.region }, defined([
      c.paragraph ? (paragraphPropsXml(c.paragraph, undefined, []) ?? el('w:pPr')) : undefined,
      c.run ? (runPropsXml(c.run) ?? el('w:rPr')) : undefined,
      c.table ? el('w:tblPr', {}, tablePropsChildren(c.table)) : undefined,
      c.cell ? el('w:tcPr', {}, cellPropsChildren(c.cell)) : undefined,
    ]))),
  ]);
  return el('w:style', {
    'w:type': style.type, 'w:default': style.isDefault ? '1' : undefined, 'w:customStyle': style.custom ? '1' : undefined, 'w:styleId': style.id,
  }, ordered(kids, STYLE_ORDER));
}

export function stylesXml(sheet: StyleSheet): XmlElement {
  return el('w:styles', { 'xmlns:mc': NS.mc, 'xmlns:r': NS.r, 'xmlns:w': NS.w, 'xmlns:w14': NS.w14, 'xmlns:w15': NS.w15, 'mc:Ignorable': 'w14 w15' }, [
    el('w:docDefaults', {}, [
      el('w:rPrDefault', {}, [runPropsXml(sheet.docDefaults.run) ?? el('w:rPr')]),
      el('w:pPrDefault', {}, [paragraphPropsXml(sheet.docDefaults.paragraph, undefined, []) ?? el('w:pPr')]),
    ]),
    ...(sheet.latentStyles ? [sheet.latentStyles] : []),
    ...sheet.styles.map(styleXml),
  ]);
}

function levelXml(level: NumberingLevel): XmlElement {
  return el('w:lvl', { 'w:ilvl': level.level }, defined([
    el('w:start', { 'w:val': level.start }),
    el('w:numFmt', { 'w:val': level.format }),
    level.restartAfter === undefined ? undefined : el('w:lvlRestart', { 'w:val': level.restartAfter }),
    level.styleId ? el('w:pStyle', { 'w:val': level.styleId }) : undefined,
    level.isLegal === undefined ? undefined : flag('w:isLgl', level.isLegal),
    level.suffix !== 'tab' ? el('w:suff', { 'w:val': level.suffix }) : undefined,
    el('w:lvlText', { 'w:val': level.text }),
    el('w:lvlJc', { 'w:val': level.alignment }),
    level.paragraph ? paragraphPropsXml(level.paragraph, undefined, []) : undefined,
    level.run ? runPropsXml(level.run) : undefined,
  ]));
}

export function numberingXml(numbering: Numbering): XmlElement {
  return el('w:numbering', { 'xmlns:mc': NS.mc, 'xmlns:r': NS.r, 'xmlns:w': NS.w, 'xmlns:w14': NS.w14, 'xmlns:w15': NS.w15, 'mc:Ignorable': 'w14 w15' }, [
    ...numbering.abstracts.map((a) => el('w:abstractNum', { 'w:abstractNumId': a.id }, defined([
      el('w:nsid', { 'w:val': (0x1a2b0000 + a.id).toString(16).toUpperCase().padStart(8, '0') }),
      a.multiLevelType ? el('w:multiLevelType', { 'w:val': a.multiLevelType }) : undefined,
      a.name ? el('w:name', { 'w:val': a.name }) : undefined,
      a.styleLink ? el('w:styleLink', { 'w:val': a.styleLink }) : undefined,
      a.numStyleLink ? el('w:numStyleLink', { 'w:val': a.numStyleLink }) : undefined,
      ...a.levels.map(levelXml),
    ]))),
    ...numbering.instances.map((n) => el('w:num', { 'w:numId': n.id }, [
      el('w:abstractNumId', { 'w:val': n.abstractId }),
      ...n.overrides.map((o) => el('w:lvlOverride', { 'w:ilvl': o.level }, defined([
        o.startOverride === undefined ? undefined : el('w:startOverride', { 'w:val': o.startOverride }),
        o.definition ? levelXml(o.definition) : undefined,
      ]))),
    ])),
  ]);
}

export function settingsXml(settings: DocumentSettings, hasNoteSeparators: { footnotes: boolean; endnotes: boolean; background?: boolean }): XmlElement {
  const p = settings.protection;
  return el('w:settings', { 'xmlns:mc': NS.mc, 'xmlns:r': NS.r, 'xmlns:m': NS.m, 'xmlns:w': NS.w, 'xmlns:w14': NS.w14, 'xmlns:w15': NS.w15, 'mc:Ignorable': 'w14 w15' }, defined([
    el('w:zoom', { 'w:percent': Math.round(settings.zoom) }),
    hasNoteSeparators.background ? el('w:displayBackgroundShape') : undefined,
    settings.mirrorMargins ? el('w:mirrorMargins') : undefined,
    el('w:proofState', { 'w:spelling': 'clean', 'w:grammar': 'clean' }),
    settings.trackRevisions ? el('w:trackRevisions') : undefined,
    p ? el('w:documentProtection', { 'w:edit': p.kind, 'w:enforcement': p.enforced ? '1' : '0' }) : undefined,
    el('w:defaultTabStop', { 'w:val': ptToTwips(settings.defaultTabStop) }),
    settings.autoHyphenation ? el('w:autoHyphenation') : undefined,
    el('w:hyphenationZone', { 'w:val': 425 }),
    settings.evenAndOddHeaders ? el('w:evenAndOddHeaders') : undefined,
    el('w:characterSpacingControl', { 'w:val': 'doNotCompress' }),
    settings.updateFields ? el('w:updateFields', { 'w:val': 'true' }) : undefined,
    hasNoteSeparators.footnotes ? el('w:footnotePr', {}, [el('w:footnote', { 'w:id': -1 }), el('w:footnote', { 'w:id': 0 })]) : undefined,
    hasNoteSeparators.endnotes ? el('w:endnotePr', {}, [el('w:endnote', { 'w:id': -1 }), el('w:endnote', { 'w:id': 0 })]) : undefined,
    el('w:compat', {}, [
      el('w:compatSetting', { 'w:name': 'compatibilityMode', 'w:uri': 'http://schemas.microsoft.com/office/word', 'w:val': settings.compatibilityMode }),
      el('w:compatSetting', { 'w:name': 'overrideTableStyleFontSizeAndJustification', 'w:uri': 'http://schemas.microsoft.com/office/word', 'w:val': '1' }),
      el('w:compatSetting', { 'w:name': 'enableOpenTypeFeatures', 'w:uri': 'http://schemas.microsoft.com/office/word', 'w:val': '1' }),
      el('w:compatSetting', { 'w:name': 'doNotFlipMirrorIndents', 'w:uri': 'http://schemas.microsoft.com/office/word', 'w:val': '1' }),
      el('w:compatSetting', { 'w:name': 'differentiateMultirowTableHeaders', 'w:uri': 'http://schemas.microsoft.com/office/word', 'w:val': '1' }),
    ]),
    el('m:mathPr', {}, [
      el('m:mathFont', { 'm:val': 'Cambria Math' }), el('m:brkBin', { 'm:val': 'before' }), el('m:brkBinSub', { 'm:val': '--' }),
      el('m:smallFrac', { 'm:val': '0' }), el('m:dispDef'), el('m:lMargin', { 'm:val': '0' }), el('m:rMargin', { 'm:val': '0' }),
      el('m:defJc', { 'm:val': 'centerGroup' }), el('m:wrapIndent', { 'm:val': '1440' }), el('m:intLim', { 'm:val': 'subSup' }), el('m:naryLim', { 'm:val': 'undOvr' }),
    ]),
    el('w:themeFontLang', { 'w:val': settings.language ?? 'fr-FR' }),
    el('w:clrSchemeMapping', {
      'w:bg1': 'light1', 'w:t1': 'dark1', 'w:bg2': 'light2', 'w:t2': 'dark2', 'w:accent1': 'accent1', 'w:accent2': 'accent2',
      'w:accent3': 'accent3', 'w:accent4': 'accent4', 'w:accent5': 'accent5', 'w:accent6': 'accent6', 'w:hyperlink': 'hyperlink',
      'w:followedHyperlink': 'followedHyperlink',
    }),
    el('w:decimalSymbol', { 'w:val': ',' }),
    el('w:listSeparator', { 'w:val': ';' }),
  ]));
}

export function webSettingsXml(): XmlElement {
  return el('w:webSettings', { 'xmlns:w': NS.w }, [el('w:optimizeForBrowser'), el('w:allowPNG')]);
}

function collectFonts(blocks: readonly Block[], out: Set<string>): void {
  const fromInlines = (inlines: readonly Inline[]): void => {
    for (const i of inlines) {
      if (i.type === 'text' && i.props.font) out.add(i.props.font);
      if (i.type === 'symbol') out.add(i.font);
      if (i.type === 'hyperlink') fromInlines(i.inlines);
      if (i.type === 'field') fromInlines(i.result);
      if (i.type === 'inlineControl') fromInlines(i.inlines);
      if (i.type === 'shape' && i.text) collectFonts(i.text, out);
    }
  };
  for (const b of blocks) {
    if (b.type === 'paragraph') fromInlines(b.inlines);
    else if (b.type === 'table') for (const r of b.rows) for (const c of r.cells) collectFonts(c.blocks, out);
    else if (b.type === 'contentControl' || b.type === 'toc') collectFonts(b.blocks, out);
  }
}

export function fontTableXml(doc: WordDocument): XmlElement {
  const names = new Set<string>(Object.keys(doc.fonts));
  names.add(doc.theme.majorFont);
  names.add(doc.theme.minorFont);
  for (const s of doc.styles.styles) if (s.run?.font) names.add(s.run.font);
  if (doc.styles.docDefaults.run.font) names.add(doc.styles.docDefaults.run.font);
  collectFonts(doc.body, names);
  return el('w:fonts', { 'xmlns:mc': NS.mc, 'xmlns:r': NS.r, 'xmlns:w': NS.w, 'xmlns:w14': NS.w14, 'mc:Ignorable': 'w14' },
    [...names].filter(Boolean).map((name) => {
      const info = doc.fonts[name];
      return el('w:font', { 'w:name': name }, defined([
        info?.altName ? el('w:altName', { 'w:val': info.altName }) : undefined,
        el('w:family', { 'w:val': info?.family ?? 'auto' }),
        el('w:pitch', { 'w:val': 'variable' }),
      ]));
    }));
}

const nowIso = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export function coreXml(props: DocumentProperties): XmlElement {
  const text = (name: string, value: string | number | undefined): XmlElement[] => (value === undefined || value === '' ? [] : [el(name, {}, [String(value)])]);
  const date = (name: string, value: string): XmlElement => el(name, { 'xsi:type': 'dcterms:W3CDTF' }, [value]);
  return el('cp:coreProperties', {
    'xmlns:cp': NS.cp, 'xmlns:dc': NS.dc, 'xmlns:dcterms': NS.dcterms, 'xmlns:dcmitype': NS.dcmitype, 'xmlns:xsi': NS.xsi,
  }, [
    ...text('dc:title', props.title),
    ...text('dc:subject', props.subject),
    ...text('dc:creator', props.creator),
    ...text('cp:keywords', props.keywords),
    ...text('dc:description', props.description),
    ...text('cp:lastModifiedBy', props.lastModifiedBy ?? props.creator),
    ...text('cp:revision', props.revision ?? 1),
    ...(props.lastPrinted ? [el('cp:lastPrinted', {}, [props.lastPrinted])] : []),
    date('dcterms:created', props.created ?? nowIso()),
    date('dcterms:modified', props.modified ?? nowIso()),
    ...text('cp:category', props.category),
    ...text('cp:contentStatus', props.contentStatus),
    ...text('dc:language', props.language),
  ]);
}

export function appXml(props: DocumentProperties, stats: { pages: number; words: number; characters: number; paragraphs: number; lines: number }): XmlElement {
  const text = (name: string, value: string | number | undefined): XmlElement[] => (value === undefined || value === '' ? [] : [el(name, {}, [String(value)])]);
  return el('Properties', { xmlns: NS.ep, 'xmlns:vt': NS.vt }, [
    ...text('Template', props.template ?? 'Normal.dotm'),
    el('TotalTime', {}, ['0']),
    el('Pages', {}, [String(stats.pages)]),
    el('Words', {}, [String(stats.words)]),
    el('Characters', {}, [String(stats.characters)]),
    el('Application', {}, [props.application ?? 'ForgeOffice Texte']),
    el('DocSecurity', {}, ['0']),
    el('Lines', {}, [String(stats.lines)]),
    el('Paragraphs', {}, [String(stats.paragraphs)]),
    el('ScaleCrop', {}, ['false']),
    ...text('Manager', props.manager),
    ...text('Company', props.company),
    el('LinksUpToDate', {}, ['false']),
    el('CharactersWithSpaces', {}, [String(stats.characters)]),
    el('SharedDoc', {}, ['false']),
    el('HyperlinksChanged', {}, ['false']),
    el('AppVersion', {}, ['16.0000']),
  ]);
}

export function customXml(custom: Record<string, string>): XmlElement {
  return el('Properties', { xmlns: NS.custom, 'xmlns:vt': NS.vt }, Object.entries(custom).map(([name, value], i) =>
    el('property', { fmtid: '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}', pid: i + 2, name }, [el('vt:lpwstr', {}, [value])])));
}
