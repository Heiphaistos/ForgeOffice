// Lecture des proprietes OOXML (w:rPr, w:pPr, w:tblPr, w:trPr, w:tcPr, w:sectPr) vers le modele.
import { attr, boolAttr, child, children, numAttr, type XmlElement } from '@forgeoffice/opc';
import type {
  Alignment, Border, BorderStyle, CellMargins, Color, HeaderFooterRefs, HighlightColor, NumberFormat, ParagraphBorders,
  ParagraphProps, RunProps, Section, SectionBreakType, Shading, TabStop, TableBorders, TableCellProps, TableLook,
  TableProps, TableRowProps, ThemeColorRef, UnderlineType, Width,
} from '../model.ts';
import { createDefaultSection } from '../blank.ts';
import { eighthPtToPt, halfPtToPt, lineToMultiple, twipsToPt } from '../units.ts';

const val = (el: XmlElement | undefined): string | undefined => attr(el, 'w:val');

const twips = (el: XmlElement | undefined, name: string): number | undefined => {
  const n = numAttr(el, name);
  return n === undefined ? undefined : twipsToPt(n);
};

const flag = (parent: XmlElement, name: string): boolean | undefined => boolAttr(child(parent, name));

/** Copie seulement les cles definies (garde les objets du modele compacts). */
export function compact<T extends object>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) if (v !== undefined) out[key] = v;
  return out as T;
}

const hex = (raw: string | undefined): string | undefined => {
  if (raw === undefined) return undefined;
  if (raw.toLowerCase() === 'auto') return 'auto';
  return /^[0-9a-fA-F]{6}$/.test(raw) ? raw.toUpperCase() : undefined;
};

const byte = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined;
  const n = Number.parseInt(raw, 16);
  return Number.isFinite(n) ? n : undefined;
};

export function parseColor(el: XmlElement | undefined): Color | undefined {
  if (!el) return undefined;
  const rgb = hex(val(el));
  const theme = attr(el, 'w:themeColor') as ThemeColorRef | undefined;
  if (!rgb && !theme) return undefined;
  return compact({ rgb: rgb ?? 'auto', theme, tint: byte(attr(el, 'w:themeTint')), shade: byte(attr(el, 'w:themeShade')) });
}

export function parseBorder(el: XmlElement | undefined): Border | undefined {
  if (!el) return undefined;
  const style = (val(el) ?? 'none') as BorderStyle;
  if (style === 'none' || style === ('nil' as BorderStyle)) return { style: 'none', width: 0, color: 'auto', space: 0 };
  return compact({
    style,
    width: eighthPtToPt(numAttr(el, 'w:sz') ?? 4),
    color: hex(attr(el, 'w:color')) ?? 'auto',
    space: numAttr(el, 'w:space') ?? 0,
    themeColor: attr(el, 'w:themeColor') as ThemeColorRef | undefined,
  });
}

export function parseShading(el: XmlElement | undefined): Shading | undefined {
  if (!el) return undefined;
  return compact({
    fill: hex(attr(el, 'w:fill')) ?? 'auto',
    pattern: val(el),
    color: hex(attr(el, 'w:color')),
    themeFill: attr(el, 'w:themeFill') as ThemeColorRef | undefined,
  });
}

const RUN_HANDLED = new Set([
  'w:rStyle', 'w:b', 'w:bCs', 'w:i', 'w:iCs', 'w:u', 'w:strike', 'w:dstrike', 'w:caps', 'w:smallCaps', 'w:rFonts',
  'w:sz', 'w:szCs', 'w:color', 'w:highlight', 'w:shd', 'w:vertAlign', 'w:spacing', 'w:w', 'w:kern', 'w:position',
  'w:lang', 'w:vanish', 'w:emboss', 'w:imprint', 'w:outline', 'w:shadow', 'w:rtl', 'w:noProof', 'w:bdr',
  'w:rPrChange', 'w:ins', 'w:del', 'w:moveFrom', 'w:moveTo',
]);

export function parseRunProps(rPr: XmlElement | undefined): RunProps {
  if (!rPr) return {};
  const fonts = child(rPr, 'w:rFonts');
  const u = child(rPr, 'w:u');
  const lang = child(rPr, 'w:lang');
  const sz = numAttr(child(rPr, 'w:sz'), 'w:val');
  const szCs = numAttr(child(rPr, 'w:szCs'), 'w:val');
  const kern = numAttr(child(rPr, 'w:kern'), 'w:val');
  const position = numAttr(child(rPr, 'w:position'), 'w:val');
  const theme = attr(fonts, 'w:asciiTheme') ?? attr(fonts, 'w:hAnsiTheme');
  const extra = children(rPr).filter((e) => !RUN_HANDLED.has(e.name));
  const vert = val(child(rPr, 'w:vertAlign'));
  return compact<RunProps>({
    bold: flag(rPr, 'w:b'),
    boldCs: flag(rPr, 'w:bCs'),
    italic: flag(rPr, 'w:i'),
    italicCs: flag(rPr, 'w:iCs'),
    underline: u ? ((val(u) ?? 'single') as UnderlineType) : undefined,
    underlineColor: hex(attr(u, 'w:color')),
    strike: flag(rPr, 'w:strike'),
    doubleStrike: flag(rPr, 'w:dstrike'),
    caps: flag(rPr, 'w:caps'),
    smallCaps: flag(rPr, 'w:smallCaps'),
    font: attr(fonts, 'w:ascii') ?? attr(fonts, 'w:hAnsi'),
    fontEastAsia: attr(fonts, 'w:eastAsia'),
    fontComplex: attr(fonts, 'w:cs'),
    fontTheme: theme ? (theme.startsWith('major') ? 'major' : 'minor') : undefined,
    size: sz === undefined ? undefined : halfPtToPt(sz),
    sizeComplex: szCs === undefined ? undefined : halfPtToPt(szCs),
    color: parseColor(child(rPr, 'w:color')),
    highlight: val(child(rPr, 'w:highlight')) as HighlightColor | undefined,
    shading: parseShading(child(rPr, 'w:shd')),
    vertAlign: vert === 'superscript' || vert === 'subscript' || vert === 'baseline' ? vert : undefined,
    spacing: twips(child(rPr, 'w:spacing'), 'w:val'),
    scale: numAttr(child(rPr, 'w:w'), 'w:val'),
    kerning: kern === undefined ? undefined : halfPtToPt(kern),
    position: position === undefined ? undefined : halfPtToPt(position),
    lang: val(lang),
    langEastAsia: attr(lang, 'w:eastAsia'),
    langComplex: attr(lang, 'w:bidi'),
    hidden: flag(rPr, 'w:vanish'),
    emboss: flag(rPr, 'w:emboss'),
    imprint: flag(rPr, 'w:imprint'),
    outline: flag(rPr, 'w:outline'),
    shadow: flag(rPr, 'w:shadow'),
    rtl: flag(rPr, 'w:rtl'),
    noProof: flag(rPr, 'w:noProof'),
    border: parseBorder(child(rPr, 'w:bdr')),
    extra: extra.length ? extra : undefined,
  });
}

const ALIGN: Readonly<Record<string, Alignment>> = {
  left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', both: 'justify', justify: 'justify',
  distribute: 'distribute', thaiDistribute: 'distribute', lowKashida: 'justify', mediumKashida: 'justify', highKashida: 'justify',
};

function parseTabs(el: XmlElement | undefined): TabStop[] | undefined {
  if (!el) return undefined;
  return children(el, 'w:tab').map((t) => compact<TabStop>({
    position: twipsToPt(numAttr(t, 'w:pos') ?? 0),
    align: (({ start: 'left', end: 'right', num: 'decimal' } as Record<string, TabStop['align']>)[val(t) ?? ''] ?? (val(t) ?? 'left')) as TabStop['align'],
    leader: attr(t, 'w:leader') as TabStop['leader'],
  }));
}

function parseParagraphBorders(el: XmlElement | undefined): ParagraphBorders | undefined {
  if (!el) return undefined;
  return compact<ParagraphBorders>({
    top: parseBorder(child(el, 'w:top')),
    bottom: parseBorder(child(el, 'w:bottom')),
    left: parseBorder(child(el, 'w:left') ?? child(el, 'w:start')),
    right: parseBorder(child(el, 'w:right') ?? child(el, 'w:end')),
    between: parseBorder(child(el, 'w:between')),
    bar: parseBorder(child(el, 'w:bar')),
  });
}

const PARA_HANDLED = new Set([
  'w:pStyle', 'w:jc', 'w:ind', 'w:spacing', 'w:contextualSpacing', 'w:tabs', 'w:pBdr', 'w:shd', 'w:numPr', 'w:outlineLvl',
  'w:keepNext', 'w:keepLines', 'w:pageBreakBefore', 'w:widowControl', 'w:suppressLineNumbers', 'w:suppressAutoHyphens',
  'w:bidi', 'w:textDirection', 'w:rPr', 'w:sectPr', 'w:pPrChange',
]);

export function parseParagraphProps(pPr: XmlElement | undefined): ParagraphProps {
  if (!pPr) return {};
  const ind = child(pPr, 'w:ind');
  const spacing = child(pPr, 'w:spacing');
  const numPr = child(pPr, 'w:numPr');
  const firstLine = twips(ind, 'w:firstLine');
  const hanging = twips(ind, 'w:hanging');
  const line = numAttr(spacing, 'w:line');
  const lineRule = attr(spacing, 'w:lineRule') ?? 'auto';
  const frame = child(pPr, 'w:framePr');
  const dropCap = attr(frame, 'w:dropCap');
  const outline = numAttr(child(pPr, 'w:outlineLvl'), 'w:val');
  const numId = numAttr(child(numPr, 'w:numId'), 'w:val');
  const extra = children(pPr).filter((e) => !PARA_HANDLED.has(e.name));
  return compact<ParagraphProps>({
    alignment: ALIGN[val(child(pPr, 'w:jc')) ?? ''],
    indentLeft: twips(ind, 'w:left') ?? twips(ind, 'w:start'),
    indentRight: twips(ind, 'w:right') ?? twips(ind, 'w:end'),
    indentFirstLine: hanging !== undefined ? -hanging : firstLine,
    spacingBefore: twips(spacing, 'w:before'),
    spacingAfter: twips(spacing, 'w:after'),
    beforeAutospacing: spacing && attr(spacing, 'w:beforeAutospacing') !== undefined ? boolAttr(spacing, 'w:beforeAutospacing') : undefined,
    afterAutospacing: spacing && attr(spacing, 'w:afterAutospacing') !== undefined ? boolAttr(spacing, 'w:afterAutospacing') : undefined,
    lineSpacing: line === undefined ? undefined
      : lineRule === 'auto' ? { rule: 'auto', value: lineToMultiple(line) }
        : { rule: lineRule === 'exact' ? 'exact' : 'atLeast', value: twipsToPt(line) },
    contextualSpacing: flag(pPr, 'w:contextualSpacing'),
    tabs: parseTabs(child(pPr, 'w:tabs')),
    borders: parseParagraphBorders(child(pPr, 'w:pBdr')),
    shading: parseShading(child(pPr, 'w:shd')),
    numbering: numId === undefined ? undefined : { numId, level: numAttr(child(numPr, 'w:ilvl'), 'w:val') ?? 0 },
    outlineLevel: outline,
    keepNext: flag(pPr, 'w:keepNext'),
    keepLines: flag(pPr, 'w:keepLines'),
    pageBreakBefore: flag(pPr, 'w:pageBreakBefore'),
    widowControl: flag(pPr, 'w:widowControl'),
    suppressLineNumbers: flag(pPr, 'w:suppressLineNumbers'),
    suppressAutoHyphens: flag(pPr, 'w:suppressAutoHyphens'),
    bidi: flag(pPr, 'w:bidi'),
    textDirection: val(child(pPr, 'w:textDirection')),
    dropCap: dropCap === 'drop' || dropCap === 'margin' ? { kind: dropCap, lines: numAttr(frame, 'w:lines') ?? 3 } : undefined,
    extra: extra.length ? extra : undefined,
  });
}

export function parseWidth(el: XmlElement | undefined): Width | undefined {
  if (!el) return undefined;
  const type = attr(el, 'w:type') ?? 'dxa';
  const raw = attr(el, 'w:w') ?? '0';
  if (type === 'pct') {
    const value = raw.endsWith('%') ? Number(raw.slice(0, -1)) : Number(raw) / 50;
    return { value: Number.isFinite(value) ? value : 100, type: 'pct' };
  }
  if (type === 'auto' || type === 'nil') return { value: 0, type };
  const n = Number(raw);
  return { value: Number.isFinite(n) ? twipsToPt(n) : 0, type: 'pt' };
}

export function parseTableBorders(el: XmlElement | undefined): TableBorders | undefined {
  if (!el) return undefined;
  return compact<TableBorders>({
    top: parseBorder(child(el, 'w:top')),
    bottom: parseBorder(child(el, 'w:bottom')),
    left: parseBorder(child(el, 'w:left') ?? child(el, 'w:start')),
    right: parseBorder(child(el, 'w:right') ?? child(el, 'w:end')),
    insideH: parseBorder(child(el, 'w:insideH')),
    insideV: parseBorder(child(el, 'w:insideV')),
  });
}

function parseMargins(el: XmlElement | undefined): CellMargins | undefined {
  if (!el) return undefined;
  const side = (...names: string[]): number | undefined => {
    for (const n of names) {
      const w = parseWidth(child(el, n));
      if (w) return w.value;
    }
    return undefined;
  };
  return compact<CellMargins>({ top: side('w:top'), right: side('w:right', 'w:end'), bottom: side('w:bottom'), left: side('w:left', 'w:start') });
}

function parseLook(el: XmlElement | undefined): TableLook | undefined {
  if (!el) return undefined;
  const legacy = attr(el, 'w:val');
  const bits = legacy ? Number.parseInt(legacy, 16) : 0;
  const pick = (name: string, mask: number): boolean => {
    const raw = attr(el, name);
    return raw === undefined ? (bits & mask) !== 0 : raw === '1' || raw === 'true' || raw === 'on';
  };
  return {
    firstRow: pick('w:firstRow', 0x20), lastRow: pick('w:lastRow', 0x40), firstColumn: pick('w:firstColumn', 0x80),
    lastColumn: pick('w:lastColumn', 0x100), noHBand: pick('w:noHBand', 0x200), noVBand: pick('w:noVBand', 0x400),
  };
}

export function parseTableProps(tblPr: XmlElement | undefined): TableProps {
  if (!tblPr) return {};
  const jc = val(child(tblPr, 'w:jc'));
  const layout = attr(child(tblPr, 'w:tblLayout'), 'w:type');
  return compact<TableProps>({
    width: parseWidth(child(tblPr, 'w:tblW')),
    alignment: jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : jc ? 'left' : undefined,
    indent: parseWidth(child(tblPr, 'w:tblInd'))?.value,
    borders: parseTableBorders(child(tblPr, 'w:tblBorders')),
    cellMargins: parseMargins(child(tblPr, 'w:tblCellMar')),
    layout: layout === 'fixed' ? 'fixed' : layout === 'autofit' ? 'autofit' : undefined,
    look: parseLook(child(tblPr, 'w:tblLook')),
    shading: parseShading(child(tblPr, 'w:shd')),
    cellSpacing: parseWidth(child(tblPr, 'w:tblCellSpacing'))?.value,
    caption: val(child(tblPr, 'w:tblCaption')),
    description: val(child(tblPr, 'w:tblDescription')),
    floating: child(tblPr, 'w:tblpPr'),
    bidi: flag(tblPr, 'w:bidiVisual'),
  });
}

export function parseRowProps(trPr: XmlElement | undefined): TableRowProps {
  if (!trPr) return {};
  const h = child(trPr, 'w:trHeight');
  const rule = attr(h, 'w:hRule');
  return compact<TableRowProps>({
    height: h ? { value: twipsToPt(numAttr(h, 'w:val') ?? 0), rule: rule === 'exact' ? 'exact' : rule === 'auto' ? 'auto' : 'atLeast' } : undefined,
    header: flag(trPr, 'w:tblHeader'),
    cantSplit: flag(trPr, 'w:cantSplit'),
  });
}

export function parseCellProps(tcPr: XmlElement | undefined): TableCellProps {
  if (!tcPr) return {};
  const vMerge = child(tcPr, 'w:vMerge');
  const borders = child(tcPr, 'w:tcBorders');
  const va = val(child(tcPr, 'w:vAlign'));
  const tableBorders = parseTableBorders(borders);
  return compact<TableCellProps>({
    width: parseWidth(child(tcPr, 'w:tcW')),
    gridSpan: numAttr(child(tcPr, 'w:gridSpan'), 'w:val'),
    vMerge: vMerge ? (val(vMerge) === 'restart' ? 'restart' : 'continue') : undefined,
    borders: borders ? compact({ ...tableBorders, tl2br: parseBorder(child(borders, 'w:tl2br')), tr2bl: parseBorder(child(borders, 'w:tr2bl')) }) : undefined,
    shading: parseShading(child(tcPr, 'w:shd')),
    verticalAlign: va === 'center' || va === 'bottom' || va === 'top' ? va : undefined,
    margins: parseMargins(child(tcPr, 'w:tcMar')),
    textDirection: val(child(tcPr, 'w:textDirection')),
    noWrap: flag(tcPr, 'w:noWrap'),
  });
}

const SECTION_HANDLED = new Set([
  'w:pgSz', 'w:pgMar', 'w:cols', 'w:headerReference', 'w:footerReference', 'w:titlePg', 'w:type', 'w:pgNumType',
  'w:vAlign', 'w:lnNumType', 'w:pgBorders', 'w:sectPrChange',
]);

/** `refToId` traduit un r:id d'en-tete / pied en identifiant de Document.headersFooters. */
export function parseSection(sectPr: XmlElement | undefined, refToId: (rid: string) => string | undefined): Section {
  const section = createDefaultSection();
  if (!sectPr) return section;
  const pgSz = child(sectPr, 'w:pgSz');
  if (pgSz) {
    section.pageWidth = twips(pgSz, 'w:w') ?? section.pageWidth;
    section.pageHeight = twips(pgSz, 'w:h') ?? section.pageHeight;
    section.orientation = attr(pgSz, 'w:orient') === 'landscape' ? 'landscape' : 'portrait';
  }
  const mar = child(sectPr, 'w:pgMar');
  if (mar) {
    const m = section.margins;
    section.margins = {
      top: twips(mar, 'w:top') ?? m.top, right: twips(mar, 'w:right') ?? m.right, bottom: twips(mar, 'w:bottom') ?? m.bottom,
      left: twips(mar, 'w:left') ?? m.left, header: twips(mar, 'w:header') ?? m.header, footer: twips(mar, 'w:footer') ?? m.footer,
      gutter: twips(mar, 'w:gutter') ?? 0,
    };
  }
  const cols = child(sectPr, 'w:cols');
  if (cols) {
    const list = children(cols, 'w:col');
    section.columns = compact({
      count: numAttr(cols, 'w:num') ?? (list.length || 1),
      space: twips(cols, 'w:space') ?? 36,
      equalWidth: attr(cols, 'w:equalWidth') === undefined ? list.length === 0 : boolAttr(cols, 'w:equalWidth') === true,
      separator: attr(cols, 'w:sep') !== undefined && boolAttr(cols, 'w:sep') === true,
      widths: list.length ? list.map((c) => ({ width: twips(c, 'w:w') ?? 0, space: twips(c, 'w:space') ?? 0 })) : undefined,
    });
  }
  const refs = (name: string): HeaderFooterRefs => {
    const out: HeaderFooterRefs = {};
    for (const ref of children(sectPr, name)) {
      const id = refToId(attr(ref, 'r:id') ?? '');
      const type = attr(ref, 'w:type') ?? 'default';
      if (id && (type === 'default' || type === 'first' || type === 'even')) out[type] = id;
    }
    return out;
  };
  section.headers = refs('w:headerReference');
  section.footers = refs('w:footerReference');
  section.titlePage = boolAttr(child(sectPr, 'w:titlePg')) === true;
  const type = val(child(sectPr, 'w:type'));
  if (type) section.breakType = (['nextPage', 'continuous', 'evenPage', 'oddPage', 'nextColumn'].includes(type) ? type : 'nextPage') as SectionBreakType;
  const pgNum = child(sectPr, 'w:pgNumType');
  if (pgNum) {
    section.pageNumbering = compact({
      start: numAttr(pgNum, 'w:start'),
      format: attr(pgNum, 'w:fmt') as NumberFormat | undefined,
      chapterStyle: numAttr(pgNum, 'w:chapStyle'),
    });
  }
  const vAlign = val(child(sectPr, 'w:vAlign'));
  if (vAlign === 'top' || vAlign === 'center' || vAlign === 'bottom' || vAlign === 'both') section.verticalAlign = vAlign;
  const ln = child(sectPr, 'w:lnNumType');
  if (ln) {
    const restart = attr(ln, 'w:restart');
    section.lineNumbering = compact({
      countBy: numAttr(ln, 'w:countBy') ?? 1,
      start: numAttr(ln, 'w:start') ?? 0,
      restart: (restart === 'continuous' || restart === 'newSection' ? restart : 'newPage') as 'newPage' | 'newSection' | 'continuous',
      distance: twips(ln, 'w:distance'),
    });
  }
  const pgBorders = child(sectPr, 'w:pgBorders');
  if (pgBorders) {
    const offset = attr(pgBorders, 'w:offsetFrom');
    section.pageBorders = compact({ ...parseParagraphBorders(pgBorders), offsetFrom: offset === 'page' || offset === 'text' ? offset as 'page' | 'text' : undefined });
  }
  const extra = children(sectPr).filter((e) => !SECTION_HANDLED.has(e.name));
  if (extra.length) section.extra = extra;
  return section;
}
