// Elements de style SpreadsheetML : couleurs, polices, remplissages, bordures, alignement, protection, dxf.
import { el, type XmlElement } from '@forgeoffice/opc';
import type {
  Alignment, Border, BorderEdge, BorderStyle, Color, DifferentialFormat, Fill, Font, GradientStop, HorizontalAlignment,
  PatternType, Protection, UnderlineStyle, VerticalAlignment,
} from '../model.ts';
import { b1, flag, int, kid, kids, num, optBool, str, val } from './xml-util.ts';

// ---------------------------------------------------------------- Couleurs

export function readColor(node: XmlElement | undefined): Color | undefined {
  if (!node) return undefined;
  const color: Color = {};
  const rgb = str(node, 'rgb');
  if (rgb) color.rgb = normalizeArgb(rgb);
  const theme = int(node, 'theme');
  if (theme !== undefined) color.theme = theme;
  const indexed = int(node, 'indexed');
  if (indexed !== undefined) color.indexed = indexed;
  const tint = num(node, 'tint');
  if (tint !== undefined && tint !== 0) color.tint = tint;
  if (optBool(node, 'auto')) color.auto = true;
  return Object.keys(color).length ? color : undefined;
}

/** « FF0000 » -> « FFFF0000 » ; « #ff0000 » accepte. */
export function normalizeArgb(raw: string): string {
  const hex = raw.replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{6}$/.test(hex)) return `FF${hex}`;
  if (/^[0-9A-F]{8}$/.test(hex)) return hex;
  return 'FF000000';
}

export function colorEl(name: string, color: Color | undefined): XmlElement[] {
  if (!color) return [];
  return [el(name, {
    auto: b1(color.auto),
    indexed: color.indexed,
    rgb: color.rgb,
    theme: color.theme,
    tint: color.tint,
  })];
}

// ---------------------------------------------------------------- Polices

const UNDERLINES: readonly UnderlineStyle[] = ['single', 'double', 'singleAccounting', 'doubleAccounting'];

/** Police complete (styles.xml « font ») ou partielle (texte enrichi « rPr », dxf). */
export function readFontPartial(node: XmlElement | undefined): Partial<Font> {
  const font: Partial<Font> = {};
  if (!node) return font;
  const name = val(node, 'name') ?? val(node, 'rFont');
  if (name !== undefined) font.name = name;
  const size = num(kid(node, 'sz'), 'val');
  if (size !== undefined) font.size = size;
  const bold = flag(node, 'b');
  if (bold !== undefined) font.bold = bold;
  const italic = flag(node, 'i');
  if (italic !== undefined) font.italic = italic;
  const strike = flag(node, 'strike');
  if (strike !== undefined) font.strike = strike;
  const u = kid(node, 'u');
  if (u) {
    const style = (str(u, 'val') ?? 'single') as UnderlineStyle | 'none';
    if (UNDERLINES.includes(style as UnderlineStyle)) font.underline = style as UnderlineStyle;
  }
  const color = readColor(kid(node, 'color'));
  if (color) font.color = color;
  const vert = val(node, 'vertAlign');
  if (vert === 'superscript' || vert === 'subscript') font.vertAlign = vert;
  const family = num(kid(node, 'family'), 'val');
  if (family !== undefined) font.family = family;
  const charset = num(kid(node, 'charset'), 'val');
  if (charset !== undefined) font.charset = charset;
  const scheme = val(node, 'scheme');
  if (scheme === 'major' || scheme === 'minor') font.scheme = scheme;
  for (const key of ['outline', 'shadow', 'condense', 'extend'] as const) {
    const value = flag(node, key);
    if (value !== undefined) font[key] = value;
  }
  return font;
}

export function readFont(node: XmlElement | undefined): Font {
  const partial = readFontPartial(node);
  return { ...partial, name: partial.name ?? 'Calibri', size: partial.size ?? 11 };
}

/** Ecrit une police ; `rich` = balises de texte enrichi (« rFont » au lieu de « name »). */
export function fontEl(tag: string, font: Partial<Font>, rich = false): XmlElement {
  const kidsOut: XmlElement[] = [];
  if (font.bold) kidsOut.push(el('b'));
  if (font.italic) kidsOut.push(el('i'));
  if (font.strike) kidsOut.push(el('strike'));
  if (font.condense) kidsOut.push(el('condense'));
  if (font.extend) kidsOut.push(el('extend'));
  if (font.outline) kidsOut.push(el('outline'));
  if (font.shadow) kidsOut.push(el('shadow'));
  if (font.underline) kidsOut.push(el('u', { val: font.underline === 'single' ? undefined : font.underline }));
  if (font.vertAlign) kidsOut.push(el('vertAlign', { val: font.vertAlign }));
  if (font.size !== undefined) kidsOut.push(el('sz', { val: font.size }));
  kidsOut.push(...colorEl('color', font.color));
  if (font.name !== undefined) kidsOut.push(el(rich ? 'rFont' : 'name', { val: font.name }));
  if (font.family !== undefined) kidsOut.push(el('family', { val: font.family }));
  if (font.charset !== undefined) kidsOut.push(el('charset', { val: font.charset }));
  if (font.scheme) kidsOut.push(el('scheme', { val: font.scheme }));
  return el(tag, {}, kidsOut);
}

// ---------------------------------------------------------------- Remplissages

export function readFill(node: XmlElement | undefined): Fill {
  const gradient = kid(node, 'gradientFill');
  if (gradient) {
    const stops: GradientStop[] = kids(gradient, 'stop').map((stop) => ({
      position: num(stop, 'position') ?? 0,
      color: readColor(kid(stop, 'color')) ?? { rgb: 'FF000000' },
    }));
    const fill: Fill = { type: 'gradient', gradient: str(gradient, 'type') === 'path' ? 'path' : 'linear', stops };
    for (const key of ['degree', 'left', 'right', 'top', 'bottom'] as const) {
      const value = num(gradient, key);
      if (value !== undefined) fill[key] = value;
    }
    return fill;
  }
  const pattern = kid(node, 'patternFill');
  const type = (str(pattern, 'patternType') ?? (pattern && kid(pattern, 'fgColor') ? 'solid' : 'none')) as PatternType;
  const fill: Fill = { type: 'pattern', pattern: type };
  const fg = readColor(kid(pattern, 'fgColor'));
  if (fg) fill.fg = fg;
  const bg = readColor(kid(pattern, 'bgColor'));
  if (bg) fill.bg = bg;
  return fill;
}

export function fillEl(fill: Fill): XmlElement {
  if (fill.type === 'gradient') {
    return el('fill', {}, [el('gradientFill', {
      type: fill.gradient === 'path' ? 'path' : undefined,
      degree: fill.degree,
      left: fill.left,
      right: fill.right,
      top: fill.top,
      bottom: fill.bottom,
    }, fill.stops.map((stop) => el('stop', { position: stop.position }, colorEl('color', stop.color))))]);
  }
  return el('fill', {}, [el('patternFill', { patternType: fill.pattern }, [
    ...colorEl('fgColor', fill.fg),
    ...colorEl('bgColor', fill.bg),
  ])]);
}

// ---------------------------------------------------------------- Bordures

function readEdge(node: XmlElement | undefined): BorderEdge | undefined {
  const style = str(node, 'style') as BorderStyle | 'none' | undefined;
  if (!node || !style || style === 'none') return undefined;
  const edge: BorderEdge = { style };
  const color = readColor(kid(node, 'color'));
  if (color) edge.color = color;
  return edge;
}

export function readBorder(node: XmlElement | undefined): Border {
  const border: Border = {};
  const left = readEdge(kid(node, 'left') ?? kid(node, 'start'));
  if (left) border.left = left;
  const right = readEdge(kid(node, 'right') ?? kid(node, 'end'));
  if (right) border.right = right;
  for (const side of ['top', 'bottom', 'diagonal', 'vertical', 'horizontal'] as const) {
    const edge = readEdge(kid(node, side));
    if (edge) border[side] = edge;
  }
  if (optBool(node, 'diagonalUp')) border.diagonalUp = true;
  if (optBool(node, 'diagonalDown')) border.diagonalDown = true;
  if (optBool(node, 'outline') === false) border.outline = false;
  return border;
}

function edgeEl(name: string, edge: BorderEdge | undefined): XmlElement {
  if (!edge) return el(name);
  return el(name, { style: edge.style }, colorEl('color', edge.color));
}

/** `dxf` : les bordures interieures ne sont ecrites que si presentes. */
export function borderEl(border: Border, dxf = false): XmlElement {
  const list = [
    edgeEl('left', border.left),
    edgeEl('right', border.right),
    edgeEl('top', border.top),
    edgeEl('bottom', border.bottom),
  ];
  if (!dxf || border.diagonal) list.push(edgeEl('diagonal', border.diagonal));
  if (border.vertical) list.push(edgeEl('vertical', border.vertical));
  if (border.horizontal) list.push(edgeEl('horizontal', border.horizontal));
  return el('border', {
    diagonalUp: b1(border.diagonalUp),
    diagonalDown: b1(border.diagonalDown),
    outline: border.outline === false ? '0' : undefined,
  }, list);
}

// ---------------------------------------------------------------- Alignement et protection

export function readAlignment(node: XmlElement | undefined): Alignment | undefined {
  if (!node) return undefined;
  const a: Alignment = {};
  const h = str(node, 'horizontal');
  if (h) a.horizontal = h as HorizontalAlignment;
  const v = str(node, 'vertical');
  if (v) a.vertical = v as VerticalAlignment;
  if (optBool(node, 'wrapText')) a.wrapText = true;
  if (optBool(node, 'shrinkToFit')) a.shrinkToFit = true;
  if (optBool(node, 'justifyLastLine')) a.justifyLastLine = true;
  const indent = int(node, 'indent');
  if (indent) a.indent = indent;
  const rotation = int(node, 'textRotation');
  if (rotation) a.textRotation = rotation;
  const order = int(node, 'readingOrder');
  if (order) a.readingOrder = order;
  return Object.keys(a).length ? a : undefined;
}

export function alignmentEl(a: Alignment | undefined): XmlElement[] {
  if (!a || Object.keys(a).length === 0) return [];
  return [el('alignment', {
    horizontal: a.horizontal,
    vertical: a.vertical,
    textRotation: a.textRotation,
    wrapText: b1(a.wrapText),
    indent: a.indent,
    justifyLastLine: b1(a.justifyLastLine),
    shrinkToFit: b1(a.shrinkToFit),
    readingOrder: a.readingOrder,
  })];
}

export function readProtection(node: XmlElement | undefined): Protection | undefined {
  if (!node) return undefined;
  const p: Protection = {};
  const locked = optBool(node, 'locked');
  if (locked !== undefined) p.locked = locked;
  const hidden = optBool(node, 'hidden');
  if (hidden !== undefined) p.hidden = hidden;
  return Object.keys(p).length ? p : undefined;
}

export function protectionEl(p: Protection | undefined): XmlElement[] {
  if (!p || (p.locked === undefined && p.hidden === undefined)) return [];
  return [el('protection', {
    locked: p.locked === undefined ? undefined : p.locked ? '1' : '0',
    hidden: p.hidden === undefined ? undefined : p.hidden ? '1' : '0',
  })];
}

// ---------------------------------------------------------------- Formats differentiels

export function readDxf(node: XmlElement): DifferentialFormat {
  const dxf: DifferentialFormat = {};
  const font = kid(node, 'font');
  if (font) dxf.font = readFontPartial(font);
  const fill = kid(node, 'fill');
  if (fill) {
    const parsed = readFill(fill);
    // Dans un dxf, « bgColor » d'un motif plein est la couleur visible : on la garde telle quelle.
    if (parsed.type === 'pattern' && !str(kid(fill, 'patternFill'), 'patternType')) parsed.pattern = 'solid';
    dxf.fill = parsed;
  }
  const border = kid(node, 'border');
  if (border) dxf.border = readBorder(border);
  const numFmt = kid(node, 'numFmt');
  if (numFmt) dxf.numFmt = { id: int(numFmt, 'numFmtId') ?? 164, code: str(numFmt, 'formatCode') ?? 'General' };
  const alignment = readAlignment(kid(node, 'alignment'));
  if (alignment) dxf.alignment = alignment;
  const protection = readProtection(kid(node, 'protection'));
  if (protection) dxf.protection = protection;
  return dxf;
}

export function dxfEl(dxf: DifferentialFormat): XmlElement {
  const list: XmlElement[] = [];
  if (dxf.font) list.push(fontEl('font', dxf.font));
  if (dxf.numFmt) list.push(el('numFmt', { numFmtId: dxf.numFmt.id, formatCode: dxf.numFmt.code }));
  if (dxf.fill) list.push(fillEl(dxf.fill));
  list.push(...alignmentEl(dxf.alignment));
  if (dxf.border) list.push(borderEl(dxf.border, true));
  list.push(...protectionEl(dxf.protection));
  return el('dxf', {}, list);
}
