// Proprietes ODF (fo:, style:) <-> proprietes du modele. Partage par le lecteur et l'ecrivain .odt.
import { attr, child, children, type XmlElement } from '@forgeoffice/opc';
import type { Border, BorderStyle, ParagraphProps, RunProps, Shading, TabStop, TableCellProps, UnderlineType } from '../model.ts';
import { fmtCm, fmtPt, parseLength } from '../units.ts';

const color = (raw: string | undefined): string | undefined => {
  if (!raw || raw === 'transparent') return undefined;
  const m = raw.match(/^#([0-9a-fA-F]{6})$/);
  return m?.[1]?.toUpperCase();
};

const UNDERLINE_IN: Readonly<Record<string, UnderlineType>> = {
  solid: 'single', dotted: 'dotted', dash: 'dash', 'long-dash': 'dashLong', 'dot-dash': 'dotDash', 'dot-dot-dash': 'dotDotDash', wave: 'wave',
};

const UNDERLINE_OUT: Readonly<Record<string, string>> = {
  single: 'solid', double: 'solid', thick: 'solid', words: 'solid', dotted: 'dotted', dottedHeavy: 'dotted', dash: 'dash',
  dashedHeavy: 'dash', dashLong: 'long-dash', dashLongHeavy: 'long-dash', dotDash: 'dot-dash', dashDotHeavy: 'dot-dash',
  dotDotDash: 'dot-dot-dash', dashDotDotHeavy: 'dot-dot-dash', wave: 'wave', wavyHeavy: 'wave', wavyDouble: 'wave',
};

/** Bordure ODF « 0.5pt solid #000000 ». */
export function parseOdfBorder(raw: string | undefined): Border | undefined {
  if (!raw || raw === 'none') return undefined;
  const parts = raw.trim().split(/\s+/);
  let width = 0.5;
  let style: BorderStyle = 'single';
  let hex = 'auto';
  for (const part of parts) {
    const length = parseLength(part);
    if (length !== undefined) width = length;
    else if (part.startsWith('#')) hex = color(part) ?? 'auto';
    else if (part === 'double') style = 'double';
    else if (part === 'dotted') style = 'dotted';
    else if (part === 'dashed') style = 'dashed';
    else if (part === 'none' || part === 'hidden') style = 'none';
  }
  return { style, width, color: hex, space: 0 };
}

export function formatOdfBorder(border: Border | undefined): string | undefined {
  if (!border) return undefined;
  if (border.style === 'none') return 'none';
  const style = border.style === 'double' ? 'double' : border.style === 'dotted' ? 'dotted' : border.style === 'dashed' ? 'dashed' : 'solid';
  return `${fmtPt(border.width)} ${style} #${border.color === 'auto' ? '000000' : border.color}`;
}

/** style:text-properties -> RunProps. `fonts` traduit style:font-name en famille. */
export function parseTextProps(el: XmlElement | undefined, fonts: Map<string, string>): RunProps {
  const props: RunProps = {};
  if (!el) return props;
  const a = (name: string): string | undefined => attr(el, name);
  const weight = a('fo:font-weight');
  if (weight) props.bold = weight === 'bold' || Number(weight) >= 600;
  const fontStyle = a('fo:font-style');
  if (fontStyle) props.italic = fontStyle === 'italic' || fontStyle === 'oblique';
  const ul = a('style:text-underline-style');
  if (ul) {
    if (ul === 'none') props.underline = 'none';
    else {
      const type = a('style:text-underline-type');
      const bold = a('style:text-underline-width') === 'bold';
      props.underline = type === 'double' ? (ul === 'wave' ? 'wavyDouble' : 'double') : bold && ul === 'solid' ? 'thick' : UNDERLINE_IN[ul] ?? 'single';
      if (a('style:text-underline-mode') === 'skip-white-space') props.underline = 'words';
      const ulColor = color(a('style:text-underline-color'));
      if (ulColor) props.underlineColor = ulColor;
    }
  }
  const strike = a('style:text-line-through-style');
  if (strike && strike !== 'none') {
    if (a('style:text-line-through-type') === 'double') props.doubleStrike = true;
    else props.strike = true;
  }
  const size = a('fo:font-size');
  if (size && !size.endsWith('%')) {
    const pt = parseLength(size);
    if (pt) props.size = pt;
  }
  const fontName = a('style:font-name');
  const family = (fontName ? fonts.get(fontName) ?? fontName : undefined) ?? a('fo:font-family')?.replace(/^['"]|['"]$/g, '');
  if (family) props.font = family;
  const c = color(a('fo:color'));
  if (c) props.color = { rgb: c };
  if (a('style:use-window-font-color') === 'true') props.color = { rgb: 'auto' };
  const bg = color(a('fo:background-color'));
  if (bg) props.shading = { fill: bg, pattern: 'clear', color: 'auto' };
  const position = a('style:text-position');
  if (position) {
    const first = position.split(/\s+/)[0] ?? '';
    if (first === 'super' || (first.endsWith('%') && Number.parseFloat(first) > 0)) props.vertAlign = 'superscript';
    else if (first === 'sub' || (first.endsWith('%') && Number.parseFloat(first) < 0)) props.vertAlign = 'subscript';
  }
  if (a('fo:font-variant') === 'small-caps') props.smallCaps = true;
  if (a('fo:text-transform') === 'uppercase') props.caps = true;
  if (a('text:display') === 'none') props.hidden = true;
  const spacing = a('fo:letter-spacing');
  if (spacing && spacing !== 'normal') {
    const pt = parseLength(spacing);
    if (pt) props.spacing = pt;
  }
  const scale = a('style:text-scale');
  if (scale && scale !== '100%') props.scale = Number.parseFloat(scale);
  const lang = a('fo:language');
  const country = a('fo:country');
  if (lang && lang !== 'zxx' && lang !== 'none') props.lang = country && country !== 'none' ? `${lang}-${country}` : lang;
  if (a('style:text-outline') === 'true') props.outline = true;
  const shadow = a('fo:text-shadow');
  if (shadow && shadow !== 'none') props.shadow = true;
  const relief = a('style:font-relief');
  if (relief === 'embossed') props.emboss = true;
  if (relief === 'engraved') props.imprint = true;
  return props;
}

export function formatTextProps(props: RunProps, fontName: (font: string) => string): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  if (props.bold !== undefined) out['fo:font-weight'] = props.bold ? 'bold' : 'normal';
  if (props.italic !== undefined) out['fo:font-style'] = props.italic ? 'italic' : 'normal';
  if (props.underline) {
    out['style:text-underline-style'] = props.underline === 'none' ? 'none' : UNDERLINE_OUT[props.underline] ?? 'solid';
    if (props.underline !== 'none') {
      out['style:text-underline-width'] = props.underline.endsWith('Heavy') || props.underline === 'thick' ? 'bold' : 'auto';
      out['style:text-underline-color'] = props.underlineColor ? `#${props.underlineColor}` : 'font-color';
      if (props.underline === 'double' || props.underline === 'wavyDouble') out['style:text-underline-type'] = 'double';
      if (props.underline === 'words') out['style:text-underline-mode'] = 'skip-white-space';
    }
  }
  if (props.strike) out['style:text-line-through-style'] = 'solid';
  if (props.doubleStrike) {
    out['style:text-line-through-style'] = 'solid';
    out['style:text-line-through-type'] = 'double';
  }
  if (props.size !== undefined) out['fo:font-size'] = fmtPt(props.size);
  if (props.font) out['style:font-name'] = fontName(props.font);
  if (props.color) {
    if (props.color.rgb === 'auto') out['style:use-window-font-color'] = 'true';
    else out['fo:color'] = `#${props.color.rgb}`;
  }
  if (props.shading && props.shading.fill !== 'auto') out['fo:background-color'] = `#${props.shading.fill}`;
  if (props.vertAlign === 'superscript') out['style:text-position'] = 'super 58%';
  if (props.vertAlign === 'subscript') out['style:text-position'] = 'sub 58%';
  if (props.smallCaps) out['fo:font-variant'] = 'small-caps';
  if (props.caps) out['fo:text-transform'] = 'uppercase';
  if (props.hidden) out['text:display'] = 'none';
  if (props.spacing) out['fo:letter-spacing'] = fmtPt(props.spacing);
  if (props.scale && props.scale !== 100) out['style:text-scale'] = `${props.scale}%`;
  if (props.lang) {
    const [language, country] = props.lang.split('-');
    out['fo:language'] = language;
    out['fo:country'] = country ?? 'none';
  }
  if (props.outline) out['style:text-outline'] = 'true';
  if (props.shadow) out['fo:text-shadow'] = '1pt 1pt';
  if (props.emboss) out['style:font-relief'] = 'embossed';
  if (props.imprint) out['style:font-relief'] = 'engraved';
  return out;
}

const ALIGN_IN: Readonly<Record<string, ParagraphProps['alignment']>> = {
  start: 'left', left: 'left', center: 'center', end: 'right', right: 'right', justify: 'justify',
};

export function parseParagraphPropsOdf(el: XmlElement | undefined): ParagraphProps {
  const props: ParagraphProps = {};
  if (!el) return props;
  const a = (name: string): string | undefined => attr(el, name);
  const align = ALIGN_IN[a('fo:text-align') ?? ''];
  if (align) props.alignment = align === 'justify' && a('fo:text-align-last') === 'justify' ? 'distribute' : align;
  const len = (name: string): number | undefined => parseLength(a(name));
  const margin = len('fo:margin');
  const left = len('fo:margin-left') ?? margin;
  const right = len('fo:margin-right') ?? margin;
  const top = len('fo:margin-top') ?? margin;
  const bottom = len('fo:margin-bottom') ?? margin;
  if (left !== undefined) props.indentLeft = left;
  if (right !== undefined) props.indentRight = right;
  if (top !== undefined) props.spacingBefore = top;
  if (bottom !== undefined) props.spacingAfter = bottom;
  const indent = len('fo:text-indent');
  if (indent !== undefined) props.indentFirstLine = indent;
  const line = a('fo:line-height');
  if (line && line !== 'normal') {
    if (line.endsWith('%')) props.lineSpacing = { rule: 'auto', value: Math.round(Number.parseFloat(line)) / 100 };
    else {
      const pt = parseLength(line);
      if (pt) props.lineSpacing = { rule: 'exact', value: pt };
    }
  }
  const atLeast = parseLength(a('style:line-height-at-least'));
  if (atLeast) props.lineSpacing = { rule: 'atLeast', value: atLeast };
  if (a('fo:break-before') === 'page') props.pageBreakBefore = true;
  if (a('fo:keep-with-next') === 'always') props.keepNext = true;
  if (a('fo:keep-together') === 'always') props.keepLines = true;
  const bg = color(a('fo:background-color'));
  if (bg) props.shading = { fill: bg, pattern: 'clear', color: 'auto' } satisfies Shading;
  const all = parseOdfBorder(a('fo:border'));
  const borders = {
    top: parseOdfBorder(a('fo:border-top')) ?? all,
    bottom: parseOdfBorder(a('fo:border-bottom')) ?? all,
    left: parseOdfBorder(a('fo:border-left')) ?? all,
    right: parseOdfBorder(a('fo:border-right')) ?? all,
  };
  if (borders.top || borders.bottom || borders.left || borders.right) {
    props.borders = Object.fromEntries(Object.entries(borders).filter(([, v]) => v)) as ParagraphProps['borders'];
  }
  const widows = a('fo:widows');
  if (widows !== undefined) props.widowControl = Number(widows) > 0;
  if (a('style:writing-mode')?.startsWith('rl')) props.bidi = true;
  if (a('fo:hyphenate') === 'false') props.suppressAutoHyphens = true;
  const tabs = children(child(el, 'style:tab-stops'), 'style:tab-stop').map((t): TabStop => {
    const type = attr(t, 'style:type');
    const leader = attr(t, 'style:leader-text');
    const tab: TabStop = {
      position: parseLength(attr(t, 'style:position')) ?? 0,
      align: type === 'center' ? 'center' : type === 'right' ? 'right' : type === 'char' ? 'decimal' : 'left',
    };
    if (leader === '.') tab.leader = 'dot';
    else if (leader === '-') tab.leader = 'hyphen';
    else if (leader === '_') tab.leader = 'underscore';
    return tab;
  });
  if (tabs.length) props.tabs = tabs;
  return props;
}

export function formatParagraphProps(props: ParagraphProps): { attrs: Record<string, string | undefined>; tabs: TabStop[] } {
  const out: Record<string, string | undefined> = {};
  const align = props.alignment;
  if (align) {
    out['fo:text-align'] = align === 'left' ? 'start' : align === 'right' ? 'end' : align === 'center' ? 'center' : 'justify';
    if (align === 'distribute') out['fo:text-align-last'] = 'justify';
  }
  if (props.indentLeft !== undefined) out['fo:margin-left'] = fmtCm(props.indentLeft);
  if (props.indentRight !== undefined) out['fo:margin-right'] = fmtCm(props.indentRight);
  if (props.spacingBefore !== undefined) out['fo:margin-top'] = fmtCm(props.spacingBefore);
  if (props.spacingAfter !== undefined) out['fo:margin-bottom'] = fmtCm(props.spacingAfter);
  if (props.indentFirstLine !== undefined) out['fo:text-indent'] = fmtCm(props.indentFirstLine);
  if (props.contextualSpacing) out['style:contextual-spacing'] = 'true';
  const line = props.lineSpacing;
  if (line) {
    if (line.rule === 'auto') out['fo:line-height'] = `${Math.round(line.value * 100)}%`;
    else if (line.rule === 'exact') out['fo:line-height'] = fmtPt(line.value);
    else out['style:line-height-at-least'] = fmtPt(line.value);
  }
  if (props.pageBreakBefore) out['fo:break-before'] = 'page';
  if (props.keepNext) out['fo:keep-with-next'] = 'always';
  if (props.keepLines) out['fo:keep-together'] = 'always';
  if (props.shading && props.shading.fill !== 'auto') out['fo:background-color'] = `#${props.shading.fill}`;
  const b = props.borders;
  if (b) {
    out['fo:border-top'] = formatOdfBorder(b.top);
    out['fo:border-bottom'] = formatOdfBorder(b.bottom);
    out['fo:border-left'] = formatOdfBorder(b.left);
    out['fo:border-right'] = formatOdfBorder(b.right);
  }
  if (props.widowControl !== undefined) {
    out['fo:widows'] = props.widowControl ? '2' : '0';
    out['fo:orphans'] = props.widowControl ? '2' : '0';
  }
  if (props.bidi) out['style:writing-mode'] = 'rl-tb';
  return { attrs: out, tabs: props.tabs ?? [] };
}

export function parseCellPropsOdf(el: XmlElement | undefined): TableCellProps {
  const props: TableCellProps = {};
  if (!el) return props;
  const bg = color(attr(el, 'fo:background-color'));
  if (bg) props.shading = { fill: bg, pattern: 'clear', color: 'auto' };
  const va = attr(el, 'style:vertical-align');
  if (va === 'middle') props.verticalAlign = 'center';
  else if (va === 'bottom' || va === 'top') props.verticalAlign = va;
  const all = parseOdfBorder(attr(el, 'fo:border'));
  const borders = {
    top: parseOdfBorder(attr(el, 'fo:border-top')) ?? all,
    bottom: parseOdfBorder(attr(el, 'fo:border-bottom')) ?? all,
    left: parseOdfBorder(attr(el, 'fo:border-left')) ?? all,
    right: parseOdfBorder(attr(el, 'fo:border-right')) ?? all,
  };
  if (borders.top || borders.bottom || borders.left || borders.right) {
    props.borders = Object.fromEntries(Object.entries(borders).filter(([, v]) => v)) as TableCellProps['borders'];
  }
  return props;
}
