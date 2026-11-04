// Ecriture des proprietes du modele en XML WordprocessingML, dans l'ordre exige par le schema.
import { el, type XmlElement } from '@forgeoffice/opc';
import type {
  Border, CellMargins, Color, ParagraphBorders, ParagraphProps, RunProps, Section, Shading, TableBorders, TableCellProps,
  TableProps, TableRowProps, Width,
} from '../model.ts';
import { multipleToLine, ptToEighthPt, ptToHalfPt, ptToTwips } from '../units.ts';

/** Trie les enfants selon la sequence du schema ; les inconnus gardent leur ordre relatif, a la fin. */
export function ordered(kids: XmlElement[], order: readonly string[]): XmlElement[] {
  const rank = (name: string): number => {
    const i = order.indexOf(name);
    return i < 0 ? order.length : i;
  };
  return kids.map((k, i) => ({ k, i })).sort((a, b) => rank(a.k.name) - rank(b.k.name) || a.i - b.i).map((x) => x.k);
}

const RPR_ORDER = [
  'w:ins', 'w:del', 'w:moveFrom', 'w:moveTo', 'w:rStyle', 'w:rFonts', 'w:b', 'w:bCs', 'w:i', 'w:iCs', 'w:caps', 'w:smallCaps',
  'w:strike', 'w:dstrike', 'w:outline', 'w:shadow', 'w:emboss', 'w:imprint', 'w:noProof', 'w:snapToGrid', 'w:vanish',
  'w:webHidden', 'w:color', 'w:spacing', 'w:w', 'w:kern', 'w:position', 'w:sz', 'w:szCs', 'w:highlight', 'w:u', 'w:effect',
  'w:bdr', 'w:shd', 'w:fitText', 'w:vertAlign', 'w:rtl', 'w:cs', 'w:em', 'w:lang', 'w:eastAsianLayout', 'w:specVanish',
  'w:oMath', 'w14:glow', 'w14:shadow', 'w14:reflection', 'w14:textOutline', 'w14:textFill', 'w14:scene3d', 'w14:props3d',
  'w14:ligatures', 'w14:numForm', 'w14:numSpacing', 'w14:stylisticSets', 'w14:cntxtAlts', 'w:rPrChange',
];

const PPR_ORDER = [
  'w:pStyle', 'w:keepNext', 'w:keepLines', 'w:pageBreakBefore', 'w:framePr', 'w:widowControl', 'w:numPr',
  'w:suppressLineNumbers', 'w:pBdr', 'w:shd', 'w:tabs', 'w:suppressAutoHyphens', 'w:kinsoku', 'w:wordWrap',
  'w:overflowPunct', 'w:topLinePunct', 'w:autoSpaceDE', 'w:autoSpaceDN', 'w:bidi', 'w:adjustRightInd', 'w:snapToGrid',
  'w:spacing', 'w:ind', 'w:contextualSpacing', 'w:mirrorIndents', 'w:suppressOverlap', 'w:jc', 'w:textDirection',
  'w:textAlignment', 'w:textboxTightWrap', 'w:outlineLvl', 'w:divId', 'w:cnfStyle', 'w:rPr', 'w:sectPr', 'w:pPrChange',
];

const onOff = (name: string, value: boolean | undefined): XmlElement | undefined =>
  value === undefined ? undefined : value ? el(name) : el(name, { 'w:val': '0' });

const defined = (list: (XmlElement | undefined)[]): XmlElement[] => list.filter((x): x is XmlElement => x !== undefined);

const hexByte = (n: number | undefined): string | undefined => (n === undefined ? undefined : Math.max(0, Math.min(255, Math.round(n))).toString(16).toUpperCase().padStart(2, '0'));

export function colorXml(name: string, color: Color | undefined): XmlElement | undefined {
  if (!color) return undefined;
  return el(name, { 'w:val': color.rgb, 'w:themeColor': color.theme, 'w:themeTint': hexByte(color.tint), 'w:themeShade': hexByte(color.shade) });
}

export function borderXml(name: string, border: Border | undefined): XmlElement | undefined {
  if (!border) return undefined;
  return el(name, {
    'w:val': border.style === 'none' ? 'nil' : border.style,
    'w:sz': border.style === 'none' ? undefined : ptToEighthPt(border.width),
    'w:space': border.style === 'none' ? undefined : Math.round(border.space),
    'w:color': border.style === 'none' ? undefined : border.color,
    'w:themeColor': border.themeColor,
  });
}

export function shadingXml(shading: Shading | undefined): XmlElement | undefined {
  if (!shading) return undefined;
  return el('w:shd', { 'w:val': shading.pattern ?? 'clear', 'w:color': shading.color ?? 'auto', 'w:fill': shading.fill, 'w:themeFill': shading.themeFill });
}

/** Elements de proprietes de caracteres (sans l'enveloppe w:rPr). */
export function runPropsChildren(props: RunProps, styleId?: string): XmlElement[] {
  const half = (name: string, value: number | undefined): XmlElement | undefined => (value === undefined ? undefined : el(name, { 'w:val': ptToHalfPt(value) }));
  const theme = props.fontTheme;
  const fonts = props.font || props.fontEastAsia || props.fontComplex || theme
    ? el('w:rFonts', {
      'w:ascii': theme ? undefined : props.font,
      'w:hAnsi': theme ? undefined : props.font,
      'w:asciiTheme': theme ? `${theme}HAnsi` : undefined,
      'w:hAnsiTheme': theme ? `${theme}HAnsi` : undefined,
      'w:eastAsia': props.fontEastAsia,
      'w:cs': props.fontComplex,
    })
    : undefined;
  const lang = props.lang || props.langEastAsia || props.langComplex
    ? el('w:lang', { 'w:val': props.lang, 'w:eastAsia': props.langEastAsia, 'w:bidi': props.langComplex })
    : undefined;
  return ordered(defined([
    styleId ? el('w:rStyle', { 'w:val': styleId }) : undefined,
    fonts,
    onOff('w:b', props.bold), onOff('w:bCs', props.boldCs), onOff('w:i', props.italic), onOff('w:iCs', props.italicCs),
    onOff('w:caps', props.caps), onOff('w:smallCaps', props.smallCaps), onOff('w:strike', props.strike),
    onOff('w:dstrike', props.doubleStrike), onOff('w:outline', props.outline), onOff('w:shadow', props.shadow),
    onOff('w:emboss', props.emboss), onOff('w:imprint', props.imprint), onOff('w:noProof', props.noProof),
    onOff('w:vanish', props.hidden),
    colorXml('w:color', props.color),
    props.spacing === undefined ? undefined : el('w:spacing', { 'w:val': ptToTwips(props.spacing) }),
    props.scale === undefined ? undefined : el('w:w', { 'w:val': Math.round(props.scale) }),
    half('w:kern', props.kerning), half('w:position', props.position), half('w:sz', props.size), half('w:szCs', props.sizeComplex),
    props.highlight ? el('w:highlight', { 'w:val': props.highlight }) : undefined,
    props.underline ? el('w:u', { 'w:val': props.underline, 'w:color': props.underlineColor }) : undefined,
    borderXml('w:bdr', props.border),
    shadingXml(props.shading),
    props.vertAlign ? el('w:vertAlign', { 'w:val': props.vertAlign }) : undefined,
    onOff('w:rtl', props.rtl),
    lang,
    ...(props.extra ?? []),
  ]), RPR_ORDER);
}

export function runPropsXml(props: RunProps | undefined, styleId?: string, extra: XmlElement[] = []): XmlElement | undefined {
  const kids = ordered([...runPropsChildren(props ?? {}, styleId), ...extra], RPR_ORDER);
  return kids.length ? el('w:rPr', {}, kids) : undefined;
}

function paragraphBordersXml(name: string, borders: ParagraphBorders | undefined): XmlElement | undefined {
  if (!borders) return undefined;
  const kids = defined([
    borderXml('w:top', borders.top), borderXml('w:left', borders.left), borderXml('w:bottom', borders.bottom),
    borderXml('w:right', borders.right), borderXml('w:between', borders.between), borderXml('w:bar', borders.bar),
  ]);
  return kids.length ? el(name, {}, kids) : undefined;
}

const JC: Readonly<Record<string, string>> = { left: 'left', center: 'center', right: 'right', justify: 'both', distribute: 'distribute' };

/** Elements de proprietes de paragraphe (sans enveloppe ni w:rPr / w:sectPr). */
export function paragraphPropsChildren(props: ParagraphProps, styleId?: string): XmlElement[] {
  const tw = (v: number | undefined): number | undefined => (v === undefined ? undefined : ptToTwips(v));
  const line = props.lineSpacing;
  const spacing = props.spacingBefore !== undefined || props.spacingAfter !== undefined || line || props.beforeAutospacing !== undefined || props.afterAutospacing !== undefined
    ? el('w:spacing', {
      'w:before': tw(props.spacingBefore),
      'w:beforeAutospacing': props.beforeAutospacing === undefined ? undefined : props.beforeAutospacing ? '1' : '0',
      'w:after': tw(props.spacingAfter),
      'w:afterAutospacing': props.afterAutospacing === undefined ? undefined : props.afterAutospacing ? '1' : '0',
      'w:line': line ? (line.rule === 'auto' ? multipleToLine(line.value) : ptToTwips(line.value)) : undefined,
      'w:lineRule': line ? line.rule : undefined,
    })
    : undefined;
  const first = props.indentFirstLine;
  const ind = props.indentLeft !== undefined || props.indentRight !== undefined || first !== undefined
    ? el('w:ind', {
      'w:left': tw(props.indentLeft), 'w:right': tw(props.indentRight),
      'w:firstLine': first !== undefined && first >= 0 ? ptToTwips(first) : undefined,
      'w:hanging': first !== undefined && first < 0 ? ptToTwips(-first) : undefined,
    })
    : undefined;
  const hasFrame = (props.extra ?? []).some((e) => e.name === 'w:framePr');
  return ordered(defined([
    styleId ? el('w:pStyle', { 'w:val': styleId }) : undefined,
    onOff('w:keepNext', props.keepNext), onOff('w:keepLines', props.keepLines), onOff('w:pageBreakBefore', props.pageBreakBefore),
    props.dropCap && !hasFrame ? el('w:framePr', { 'w:dropCap': props.dropCap.kind, 'w:lines': props.dropCap.lines, 'w:wrap': 'around', 'w:vAnchor': 'text', 'w:hAnchor': 'text' }) : undefined,
    onOff('w:widowControl', props.widowControl),
    props.numbering ? el('w:numPr', {}, [el('w:ilvl', { 'w:val': props.numbering.level }), el('w:numId', { 'w:val': props.numbering.numId })]) : undefined,
    onOff('w:suppressLineNumbers', props.suppressLineNumbers),
    paragraphBordersXml('w:pBdr', props.borders),
    shadingXml(props.shading),
    props.tabs ? el('w:tabs', {}, props.tabs.map((t) => el('w:tab', { 'w:val': t.align, 'w:leader': t.leader, 'w:pos': ptToTwips(t.position) }))) : undefined,
    onOff('w:suppressAutoHyphens', props.suppressAutoHyphens),
    onOff('w:bidi', props.bidi),
    spacing,
    ind,
    onOff('w:contextualSpacing', props.contextualSpacing),
    props.alignment ? el('w:jc', { 'w:val': JC[props.alignment] ?? 'left' }) : undefined,
    props.textDirection ? el('w:textDirection', { 'w:val': props.textDirection }) : undefined,
    props.outlineLevel === undefined ? undefined : el('w:outlineLvl', { 'w:val': props.outlineLevel }),
    ...(props.extra ?? []),
  ]), PPR_ORDER);
}

export function paragraphPropsXml(props: ParagraphProps, styleId: string | undefined, tailKids: XmlElement[]): XmlElement | undefined {
  const kids = ordered([...paragraphPropsChildren(props, styleId), ...tailKids], PPR_ORDER);
  return kids.length ? el('w:pPr', {}, kids) : undefined;
}

export function widthXml(name: string, width: Width | undefined): XmlElement | undefined {
  if (!width) return undefined;
  if (width.type === 'pct') return el(name, { 'w:w': `${Math.round(width.value * 100) / 100}%`, 'w:type': 'pct' });
  if (width.type === 'auto' || width.type === 'nil') return el(name, { 'w:w': 0, 'w:type': width.type });
  return el(name, { 'w:w': ptToTwips(width.value), 'w:type': 'dxa' });
}

function tableBordersXml(name: string, b: (TableBorders & { tl2br?: Border; tr2bl?: Border }) | undefined): XmlElement | undefined {
  if (!b) return undefined;
  const kids = defined([
    borderXml('w:top', b.top), borderXml('w:left', b.left), borderXml('w:bottom', b.bottom), borderXml('w:right', b.right),
    borderXml('w:insideH', b.insideH), borderXml('w:insideV', b.insideV), borderXml('w:tl2br', b.tl2br), borderXml('w:tr2bl', b.tr2bl),
  ]);
  return kids.length ? el(name, {}, kids) : undefined;
}

function marginsXml(name: string, m: CellMargins | undefined): XmlElement | undefined {
  if (!m) return undefined;
  const side = (tag: string, v: number | undefined): XmlElement | undefined => (v === undefined ? undefined : el(tag, { 'w:w': ptToTwips(v), 'w:type': 'dxa' }));
  const kids = defined([side('w:top', m.top), side('w:left', m.left), side('w:bottom', m.bottom), side('w:right', m.right)]);
  return kids.length ? el(name, {}, kids) : undefined;
}

export function tablePropsChildren(props: TableProps, styleId?: string): XmlElement[] {
  const look = props.look;
  const b = (v: boolean): string => (v ? '1' : '0');
  return defined([
    styleId ? el('w:tblStyle', { 'w:val': styleId }) : undefined,
    props.floating,
    onOff('w:bidiVisual', props.bidi),
    widthXml('w:tblW', props.width),
    props.alignment ? el('w:jc', { 'w:val': props.alignment }) : undefined,
    props.cellSpacing === undefined ? undefined : el('w:tblCellSpacing', { 'w:w': ptToTwips(props.cellSpacing), 'w:type': 'dxa' }),
    props.indent === undefined ? undefined : el('w:tblInd', { 'w:w': ptToTwips(props.indent), 'w:type': 'dxa' }),
    tableBordersXml('w:tblBorders', props.borders),
    shadingXml(props.shading),
    props.layout ? el('w:tblLayout', { 'w:type': props.layout }) : undefined,
    marginsXml('w:tblCellMar', props.cellMargins),
    look ? el('w:tblLook', {
      'w:val': ((look.firstRow ? 0x20 : 0) | (look.lastRow ? 0x40 : 0) | (look.firstColumn ? 0x80 : 0) | (look.lastColumn ? 0x100 : 0)
        | (look.noHBand ? 0x200 : 0) | (look.noVBand ? 0x400 : 0)).toString(16).toUpperCase().padStart(4, '0'),
      'w:firstRow': b(look.firstRow), 'w:lastRow': b(look.lastRow), 'w:firstColumn': b(look.firstColumn),
      'w:lastColumn': b(look.lastColumn), 'w:noHBand': b(look.noHBand), 'w:noVBand': b(look.noVBand),
    }) : undefined,
    props.caption ? el('w:tblCaption', { 'w:val': props.caption }) : undefined,
    props.description ? el('w:tblDescription', { 'w:val': props.description }) : undefined,
  ]);
}

export function rowPropsChildren(props: TableRowProps): XmlElement[] {
  return defined([
    onOff('w:cantSplit', props.cantSplit),
    props.height ? el('w:trHeight', { 'w:val': ptToTwips(props.height.value), 'w:hRule': props.height.rule }) : undefined,
    onOff('w:tblHeader', props.header),
  ]);
}

export function cellPropsChildren(props: TableCellProps): XmlElement[] {
  return defined([
    widthXml('w:tcW', props.width),
    props.gridSpan && props.gridSpan > 1 ? el('w:gridSpan', { 'w:val': props.gridSpan }) : undefined,
    props.vMerge ? el('w:vMerge', props.vMerge === 'restart' ? { 'w:val': 'restart' } : {}) : undefined,
    tableBordersXml('w:tcBorders', props.borders),
    shadingXml(props.shading),
    onOff('w:noWrap', props.noWrap),
    marginsXml('w:tcMar', props.margins),
    props.textDirection ? el('w:textDirection', { 'w:val': props.textDirection }) : undefined,
    props.verticalAlign ? el('w:vAlign', { 'w:val': props.verticalAlign }) : undefined,
  ]);
}

const SECT_ORDER = [
  'w:headerReference', 'w:footerReference', 'w:footnotePr', 'w:endnotePr', 'w:type', 'w:pgSz', 'w:pgMar', 'w:paperSrc',
  'w:pgBorders', 'w:lnNumType', 'w:pgNumType', 'w:cols', 'w:formProt', 'w:vAlign', 'w:noEndnote', 'w:titlePg',
  'w:textDirection', 'w:bidi', 'w:rtlGutter', 'w:docGrid', 'w:printerSettings', 'w:sectPrChange',
];

/** w:sectPr ; `refRid` traduit un identifiant d'en-tete / pied en r:id du document. */
export function sectionXml(section: Section, refRid: (id: string) => string | undefined): XmlElement {
  const refs: XmlElement[] = [];
  for (const [tag, map] of [['w:headerReference', section.headers], ['w:footerReference', section.footers]] as const) {
    for (const type of ['default', 'first', 'even'] as const) {
      const id = map[type];
      const rid = id ? refRid(id) : undefined;
      if (rid) refs.push(el(tag, { 'w:type': type, 'r:id': rid }));
    }
  }
  const m = section.margins;
  const c = section.columns;
  const borders = section.pageBorders;
  const pageBorders = borders ? paragraphBordersXml('w:pgBorders', borders) : undefined;
  if (pageBorders && borders?.offsetFrom) pageBorders.attrs['w:offsetFrom'] = borders.offsetFrom;
  const ln = section.lineNumbering;
  return el('w:sectPr', {}, ordered(defined([
    ...refs,
    section.breakType !== 'nextPage' ? el('w:type', { 'w:val': section.breakType }) : undefined,
    el('w:pgSz', { 'w:w': ptToTwips(section.pageWidth), 'w:h': ptToTwips(section.pageHeight), 'w:orient': section.orientation === 'landscape' ? 'landscape' : undefined }),
    el('w:pgMar', {
      'w:top': ptToTwips(m.top), 'w:right': ptToTwips(m.right), 'w:bottom': ptToTwips(m.bottom), 'w:left': ptToTwips(m.left),
      'w:header': ptToTwips(m.header), 'w:footer': ptToTwips(m.footer), 'w:gutter': ptToTwips(m.gutter),
    }),
    pageBorders,
    ln ? el('w:lnNumType', { 'w:countBy': ln.countBy, 'w:start': ln.start || undefined, 'w:restart': ln.restart, 'w:distance': ln.distance === undefined ? undefined : ptToTwips(ln.distance) }) : undefined,
    section.pageNumbering ? el('w:pgNumType', { 'w:fmt': section.pageNumbering.format, 'w:start': section.pageNumbering.start, 'w:chapStyle': section.pageNumbering.chapterStyle }) : undefined,
    el('w:cols', {
      'w:num': c.count > 1 ? c.count : undefined,
      'w:space': ptToTwips(c.space),
      'w:equalWidth': c.equalWidth ? undefined : '0',
      'w:sep': c.separator ? '1' : undefined,
    }, (c.widths ?? []).map((w) => el('w:col', { 'w:w': ptToTwips(w.width), 'w:space': ptToTwips(w.space) }))),
    section.verticalAlign ? el('w:vAlign', { 'w:val': section.verticalAlign }) : undefined,
    section.titlePage ? el('w:titlePg') : undefined,
    ...(section.extra ?? []),
  ]), SECT_ORDER));
}
