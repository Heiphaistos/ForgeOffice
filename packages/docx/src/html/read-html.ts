// Import HTML nettoye : titres, paragraphes, listes imbriquees, tableaux (fusions), liens surs, images
// data: (bornees), citations, code, mise en forme CSS en ligne. Scripts, styles, cadres et evenements ignores.
import type {
  Block, Border, Inline, NumberFormat, Paragraph, ParagraphProps, ReadResult, RunProps, Table, TableCellProps, TableRow,
} from '../model.ts';
import { pushAll } from '@forgeoffice/opc';
import { createBlankDocument } from '../blank.ts';
import { sniffImageType } from '../docx/ns.ts';
import { Budget, checkedUrl, DEFAULT_READ_LIMITS, Warnings, type ReadLimits } from '../security.ts';
import { WARNINGS } from '../strings.ts';
import { parseLength } from '../units.ts';
import { findFirst, htmlText, parseHtml, parseStyleAttr, type HtmlElement, type HtmlNode } from './parse-html.ts';

const NAMED_COLORS: Readonly<Record<string, string>> = {
  black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', lime: '00FF00', blue: '0000FF', yellow: 'FFFF00',
  gray: '808080', grey: '808080', silver: 'C0C0C0', maroon: '800000', olive: '808000', navy: '000080', purple: '800080',
  teal: '008080', aqua: '00FFFF', cyan: '00FFFF', fuchsia: 'FF00FF', magenta: 'FF00FF', orange: 'FFA500', pink: 'FFC0CB',
  brown: 'A52A2A', gold: 'FFD700', darkred: '8B0000', darkblue: '00008B', darkgreen: '006400', lightgray: 'D3D3D3',
  lightgrey: 'D3D3D3', darkgray: 'A9A9A9', darkgrey: 'A9A9A9', indigo: '4B0082', violet: 'EE82EE', crimson: 'DC143C',
};

/** Couleur CSS -> « RRGGBB ». */
export function parseCssColor(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === 'transparent' || value === 'inherit' || value === 'initial') return undefined;
  const named = NAMED_COLORS[value];
  if (named) return named;
  let m = value.match(/^#([0-9a-f]{6})$/);
  if (m?.[1]) return m[1].toUpperCase();
  m = value.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (m) return `${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toUpperCase();
  m = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return [m[1], m[2], m[3]].map((v) => Math.min(255, Number(v)).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
}

const FONT_SIZES: Readonly<Record<string, number>> = {
  'xx-small': 7, 'x-small': 7.5, small: 10, medium: 12, large: 13.5, 'x-large': 18, 'xx-large': 24, smaller: 10, larger: 14,
};

const HTML_FONT_SIZES = [0, 7.5, 10, 12, 13.5, 18, 24, 36];

function runFromCss(css: Record<string, string>, base: RunProps): RunProps {
  const run: RunProps = { ...base };
  const color = parseCssColor(css['color']);
  if (color) run.color = { rgb: color };
  const bg = parseCssColor(css['background-color'] ?? css['background']);
  if (bg) run.shading = { fill: bg, pattern: 'clear', color: 'auto' };
  const weight = css['font-weight'];
  if (weight) run.bold = weight === 'bold' || weight === 'bolder' || Number(weight) >= 600;
  const style = css['font-style'];
  if (style) run.italic = style === 'italic' || style === 'oblique';
  const decoration = css['text-decoration'] ?? css['text-decoration-line'];
  if (decoration) {
    if (decoration.includes('underline')) run.underline = 'single';
    if (decoration.includes('line-through')) run.strike = true;
    if (decoration === 'none') { delete run.underline; delete run.strike; }
  }
  const size = css['font-size'];
  if (size) {
    const pt = FONT_SIZES[size] ?? (size.endsWith('%') ? (Number.parseFloat(size) / 100) * (base.size ?? 11) : parseLength(size, base.size ?? 11));
    if (pt && pt > 0 && pt < 1000) run.size = Math.round(pt * 2) / 2;
  }
  const family = css['font-family'];
  if (family) {
    const first = family.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
    if (first && !['serif', 'sans-serif', 'monospace', 'inherit', 'cursive', 'system-ui'].includes(first)) run.font = first;
    else if (first === 'monospace') run.font = 'Consolas';
  }
  const vertical = css['vertical-align'];
  if (vertical === 'super') run.vertAlign = 'superscript';
  if (vertical === 'sub') run.vertAlign = 'subscript';
  if (css['text-transform'] === 'uppercase') run.caps = true;
  if (css['font-variant'] === 'small-caps') run.smallCaps = true;
  const spacing = parseLength(css['letter-spacing']);
  if (spacing) run.spacing = spacing;
  if (css['display'] === 'none' || css['visibility'] === 'hidden') run.hidden = true;
  return run;
}

function cssBorder(raw: string | undefined): Border | undefined {
  if (!raw || raw === 'none' || raw === '0') return undefined;
  let width = 0.75;
  let style: Border['style'] = 'single';
  let color = 'auto';
  for (const part of raw.split(/\s+/)) {
    const len = parseLength(part);
    if (len !== undefined) width = len;
    else if (part === 'double') style = 'double';
    else if (part === 'dotted') style = 'dotted';
    else if (part === 'dashed') style = 'dashed';
    else color = parseCssColor(part) ?? color;
  }
  return { style, width, color, space: 1 };
}

function paragraphFromCss(css: Record<string, string>, base: ParagraphProps): ParagraphProps {
  const p: ParagraphProps = { ...base };
  const align = css['text-align'];
  if (align === 'center') p.alignment = 'center';
  else if (align === 'right' || align === 'end') p.alignment = 'right';
  else if (align === 'justify') p.alignment = 'justify';
  else if (align === 'left' || align === 'start') p.alignment = 'left';
  const left = parseLength(css['margin-left'] ?? css['padding-left']);
  if (left !== undefined) p.indentLeft = (base.indentLeft ?? 0) + left;
  const right = parseLength(css['margin-right']);
  if (right !== undefined) p.indentRight = right;
  const indent = parseLength(css['text-indent']);
  if (indent !== undefined) p.indentFirstLine = indent;
  const top = parseLength(css['margin-top']);
  if (top !== undefined) p.spacingBefore = top;
  const bottom = parseLength(css['margin-bottom']);
  if (bottom !== undefined) p.spacingAfter = bottom;
  const line = css['line-height'];
  if (line && line !== 'normal') {
    if (/^\d*\.?\d+$/.test(line)) p.lineSpacing = { rule: 'auto', value: Number(line) };
    else if (line.endsWith('%')) p.lineSpacing = { rule: 'auto', value: Number.parseFloat(line) / 100 };
    else {
      const pt = parseLength(line);
      if (pt) p.lineSpacing = { rule: 'atLeast', value: pt };
    }
  }
  if (css['page-break-before'] === 'always' || css['break-before'] === 'page') p.pageBreakBefore = true;
  const bg = parseCssColor(css['background-color']);
  if (bg) p.shading = { fill: bg, pattern: 'clear', color: 'auto' };
  const all = cssBorder(css['border']);
  const borders = { top: cssBorder(css['border-top']) ?? all, bottom: cssBorder(css['border-bottom']) ?? all, left: cssBorder(css['border-left']) ?? all, right: cssBorder(css['border-right']) ?? all };
  if (borders.top || borders.bottom || borders.left || borders.right) p.borders = Object.fromEntries(Object.entries(borders).filter(([, v]) => v));
  return p;
}

interface Ctx {
  para: ParagraphProps;
  styleId?: string;
  run: RunProps;
  list?: { numId: number; level: number };
  pre: boolean;
  depth: number;
}

const BLOCK_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'blockquote', 'pre', 'hr', 'section', 'article',
  'header', 'footer', 'nav', 'aside', 'figure', 'figcaption', 'main', 'body', 'html', 'center', 'dl', 'dt', 'dd', 'address',
  'form', 'fieldset', 'details', 'summary', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'legend',
]);

const isBlock = (node: HtmlNode): boolean => typeof node !== 'string' && BLOCK_TAGS.has(node.tag);

const BULLETS = ['•', 'o', '▪', '•', 'o', '▪', '•', 'o', '▪'];

class HtmlReader {
  readonly doc = createBlankDocument();
  readonly warnings = new Warnings();
  readonly budget: Budget;
  private readonly listAbstracts = new Map<string, number>();
  private bookmarkId = 0;
  private imageCount = 0;

  constructor(limits: ReadLimits) {
    this.budget = new Budget(limits, this.warnings);
  }

  private abstractFor(format: NumberFormat): number {
    const known = this.listAbstracts.get(format);
    if (known !== undefined) return known;
    const id = this.doc.numbering.abstracts.length + 1;
    // Comme les navigateurs : meme format a tous les niveaux d'une liste numerotee.
    const formats: NumberFormat[] = Array(9).fill(format);
    this.doc.numbering.abstracts.push({
      id, multiLevelType: 'hybridMultilevel',
      levels: formats.map((f, level) => ({
        level, format: f, text: f === 'bullet' ? BULLETS[level] ?? '•' : `%${level + 1}.`, start: 1, alignment: 'left', suffix: 'tab',
        paragraph: { indentLeft: 36 * (level + 1), indentFirstLine: -18 },
      })),
    });
    this.listAbstracts.set(format, id);
    return id;
  }

  private newList(format: NumberFormat, start: number): number {
    const abstractId = this.abstractFor(format);
    const id = this.doc.numbering.instances.length + 1;
    this.doc.numbering.instances.push({ id, abstractId, overrides: format !== 'bullet' ? [{ level: 0, startOverride: start }] : [] });
    return id;
  }

  private addText(out: Inline[], text: string, run: RunProps): void {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.type === 'text' && JSON.stringify(last.props) === JSON.stringify(run)) last.text += text;
    else out.push({ type: 'text', text, props: { ...run } });
  }

  private image(node: HtmlElement, run: RunProps, out: Inline[]): void {
    const src = node.attrs['src'] ?? '';
    const m = src.match(/^data:([a-z/+.-]+);base64,(.*)$/is);
    if (!m) {
      if (src) this.warnings.add('image-skipped', WARNINGS.imageSkipped(src));
      const alt = node.attrs['alt'];
      if (alt) this.addText(out, `[${alt}]`, run);
      return;
    }
    const base64 = (m[2] ?? '').replace(/\s+/g, '');
    if ((base64.length * 3) / 4 > this.budget.limits.maxImageBytes) {
      this.warnings.add('image-skipped', WARNINGS.imageSkipped('data:'));
      return;
    }
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    } catch {
      this.warnings.add('image-skipped', WARNINGS.imageSkipped('data:'));
      return;
    }
    const contentType = sniffImageType(bytes) ?? m[1] ?? 'application/octet-stream';
    if (!contentType.startsWith('image/')) return;
    this.imageCount += 1;
    const ext = contentType.split('/')[1]?.replace('+xml', '').replace('x-', '') ?? 'png';
    const id = `image${this.imageCount}.${ext}`;
    this.doc.media[id] = { id, fileName: id, contentType, bytes };
    const css = parseStyleAttr(node.attrs['style']);
    const width = parseLength(css['width'] ?? node.attrs['width']) ?? 150;
    const height = parseLength(css['height'] ?? node.attrs['height']) ?? width * 0.75;
    const image: Inline = { type: 'image', mediaId: id, width, height };
    if (node.attrs['alt']) image.alt = node.attrs['alt'];
    if (node.attrs['title']) image.title = node.attrs['title'];
    out.push(image);
  }

  private inlines(nodes: HtmlNode[], run: RunProps, out: Inline[], pre: boolean): void {
    for (const node of nodes) {
      if (typeof node === 'string') {
        const text = pre ? node : node.replace(/[\s\u000b]+/g, ' ');
        if (pre && text.includes('\n')) {
          text.split('\n').forEach((line, i) => {
            if (i > 0) out.push({ type: 'break', kind: 'line' });
            this.addText(out, line.replace(/\t/g, '    '), run);
          });
        } else this.addText(out, text, run);
        continue;
      }
      if (node.attrs['id'] && node.tag !== 'a') {
        this.bookmarkId += 1;
        out.push({ type: 'bookmarkStart', id: this.bookmarkId, name: node.attrs['id'] }, { type: 'bookmarkEnd', id: this.bookmarkId });
      }
      const css = parseStyleAttr(node.attrs['style']);
      let next = runFromCss(css, run);
      switch (node.tag) {
        case 'b': case 'strong': next = { ...next, bold: true }; break;
        case 'i': case 'em': case 'cite': case 'dfn': case 'var': next = { ...next, italic: true }; break;
        case 'u': case 'ins': next = { ...next, underline: 'single' }; break;
        case 's': case 'strike': case 'del': next = { ...next, strike: true }; break;
        case 'sup': next = { ...next, vertAlign: 'superscript' }; break;
        case 'sub': next = { ...next, vertAlign: 'subscript' }; break;
        case 'code': case 'kbd': case 'samp': case 'tt': next = { ...next, font: 'Consolas' }; break;
        case 'mark': next = { ...next, highlight: 'yellow' }; break;
        case 'small': next = { ...next, size: Math.round((run.size ?? 11) * 0.83 * 2) / 2 }; break;
        case 'big': next = { ...next, size: Math.round((run.size ?? 11) * 1.2 * 2) / 2 }; break;
        case 'font': {
          const color = parseCssColor(node.attrs['color']);
          if (color) next = { ...next, color: { rgb: color } };
          if (node.attrs['face']) next = { ...next, font: node.attrs['face'].split(',')[0]?.trim() };
          const size = HTML_FONT_SIZES[Number(node.attrs['size'])];
          if (size) next = { ...next, size };
          break;
        }
        case 'br': out.push({ type: 'break', kind: 'line' }); continue;
        case 'wbr': continue;
        case 'img': this.image(node, next, out); continue;
        case 'q': this.addText(out, '“', next); this.inlines(node.children, next, out, pre); this.addText(out, '”', next); continue;
        case 'input':
          if (node.attrs['type'] === 'checkbox') this.addText(out, 'checked' in node.attrs ? '☒ ' : '☐ ', next);
          continue;
        case 'a': {
          const href = node.attrs['href'];
          const name = node.attrs['name'] ?? node.attrs['id'];
          if (name) {
            this.bookmarkId += 1;
            out.push({ type: 'bookmarkStart', id: this.bookmarkId, name }, { type: 'bookmarkEnd', id: this.bookmarkId });
          }
          if (!href) break;
          const link: Inline = { type: 'hyperlink', inlines: [] };
          if (href.startsWith('#')) link.anchor = href.slice(1);
          else {
            const url = checkedUrl(href, this.warnings);
            if (!url) { this.inlines(node.children, next, out, pre); continue; }
            link.url = url;
          }
          if (node.attrs['title']) link.tooltip = node.attrs['title'];
          this.inlines(node.children, next, link.inlines, pre);
          out.push(link);
          continue;
        }
        default: break;
      }
      this.inlines(node.children, next, out, pre);
    }
  }

  private makeParagraph(inlines: Inline[], ctx: Ctx): Paragraph | undefined {
    // Espaces de bord retires (comme le rendu HTML).
    if (!ctx.pre) {
      const first = inlines[0];
      if (first?.type === 'text') first.text = first.text.replace(/^ +/, '');
      const last = inlines[inlines.length - 1];
      if (last?.type === 'text') last.text = last.text.replace(/ +$/, '');
      while (inlines[0]?.type === 'text' && inlines[0].text === '') inlines.shift();
      const tail = inlines[inlines.length - 1];
      if (tail?.type === 'text' && tail.text === '') inlines.pop();
    }
    if (!this.budget.takeBlock()) return undefined;
    const paragraph: Paragraph = { type: 'paragraph', props: { ...ctx.para }, inlines };
    if (ctx.styleId) paragraph.styleId = ctx.styleId;
    if (ctx.list) paragraph.props.numbering = { ...ctx.list };
    return paragraph;
  }

  blocks(nodes: HtmlNode[], ctx: Ctx): Block[] {
    const out: Block[] = [];
    if (!this.budget.depthOk(ctx.depth)) return out;
    let pending: Inline[] = [];
    const flush = (force = false): void => {
      const meaningful = pending.some((i) => i.type !== 'text' || i.text.trim() !== '');
      if (meaningful || force) {
        const p = this.makeParagraph(pending, ctx);
        if (p) out.push(p);
      }
      pending = [];
    };
    for (const node of nodes) {
      if (!isBlock(node)) {
        this.inlines([node], ctx.run, pending, ctx.pre);
        continue;
      }
      flush();
      pushAll(out, this.block(node as HtmlElement, ctx));
    }
    flush(out.length === 0 && ctx.list !== undefined);
    return out;
  }

  private block(node: HtmlElement, ctx: Ctx): Block[] {
    const css = parseStyleAttr(node.attrs['style']);
    const para = paragraphFromCss(css, ctx.para);
    if (node.attrs['align']) para.alignment = node.attrs['align'] === 'center' ? 'center' : node.attrs['align'] === 'right' ? 'right' : node.attrs['align'] === 'justify' ? 'justify' : 'left';
    const run = runFromCss(css, ctx.run);
    const inner: Ctx = { ...ctx, para, run, depth: ctx.depth + 1 };
    const heading = node.tag.match(/^h([1-6])$/);
    if (heading) return this.blocks(node.children, { ...inner, styleId: `Heading${heading[1]}`, list: undefined });
    switch (node.tag) {
      case 'p':
      case 'dt':
      case 'summary':
      case 'legend': {
        const blocks = this.blocks(node.children, node.tag === 'dt' ? { ...inner, run: { ...run, bold: true } } : inner);
        if (!blocks.length) {
          const empty = this.makeParagraph([], inner);
          return empty ? [empty] : [];
        }
        return blocks;
      }
      case 'dd': return this.blocks(node.children, { ...inner, para: { ...para, indentLeft: (para.indentLeft ?? 0) + 36 } });
      case 'center': return this.blocks(node.children, { ...inner, para: { ...para, alignment: 'center' } });
      case 'blockquote': return this.blocks(node.children, { ...inner, styleId: 'Quote' });
      case 'figcaption':
      case 'caption': return this.blocks(node.children, { ...inner, styleId: 'Caption' });
      case 'address': return this.blocks(node.children, { ...inner, run: { ...run, italic: true } });
      case 'pre': return this.blocks(node.children, { ...inner, pre: true, run: { ...run, font: 'Consolas', size: 10 }, para: { ...para, spacingAfter: 0, lineSpacing: { rule: 'auto', value: 1 } } });
      case 'hr': {
        const p = this.makeParagraph([], { ...inner, para: { ...para, borders: { bottom: { style: 'single', width: 0.75, color: 'auto', space: 1 } } } });
        return p ? [p] : [];
      }
      case 'ul':
      case 'ol': return this.list(node, inner);
      case 'li': return this.blocks(node.children, inner);
      case 'table': return this.table(node, inner);
      default: return this.blocks(node.children, inner);
    }
  }

  private list(node: HtmlElement, ctx: Ctx): Block[] {
    const type = node.attrs['type'];
    const format: NumberFormat = node.tag === 'ul' ? 'bullet'
      : type === 'a' ? 'lowerLetter' : type === 'A' ? 'upperLetter' : type === 'i' ? 'lowerRoman' : type === 'I' ? 'upperRoman' : 'decimal';
    const level = ctx.list ? Math.min(8, ctx.list.level + 1) : 0;
    const sameKind = ctx.list !== undefined && (format === 'bullet') === this.isBullet(ctx.list.numId);
    const numId = ctx.list && sameKind ? ctx.list.numId : this.newList(format, Number(node.attrs['start'] ?? 1) || 1);
    const out: Block[] = [];
    for (const item of node.children) {
      if (typeof item === 'string') continue;
      if (item.tag === 'ul' || item.tag === 'ol') {
        pushAll(out, this.list(item, { ...ctx, list: { numId, level } }));
        continue;
      }
      const itemCtx: Ctx = { ...ctx, list: { numId, level }, depth: ctx.depth + 1 };
      const blocks = this.blocks(item.tag === 'li' ? item.children : [item], itemCtx);
      // Seul le premier paragraphe d'un element porte la puce ; les suivants sont des paragraphes de suite.
      let first = true;
      for (const b of blocks) {
        if (b.type === 'paragraph' && b.props.numbering?.numId === numId && b.props.numbering.level === level) {
          if (!first) {
            delete b.props.numbering;
            b.props.indentLeft = 36 * (level + 1);
          }
          first = false;
        }
      }
      pushAll(out, blocks);
    }
    return out;
  }

  private isBullet(numId: number): boolean {
    const instance = this.doc.numbering.instances.find((n) => n.id === numId);
    const abstract = this.doc.numbering.abstracts.find((a) => a.id === instance?.abstractId);
    return abstract?.levels[0]?.format === 'bullet';
  }

  private table(node: HtmlElement, ctx: Ctx): Block[] {
    const rowsHtml: { row: HtmlElement; header: boolean }[] = [];
    const caption: Block[] = [];
    const collect = (el: HtmlElement, header: boolean): void => {
      for (const c of el.children) {
        if (typeof c === 'string') continue;
        if (c.tag === 'tr') rowsHtml.push({ row: c, header });
        else if (c.tag === 'thead') collect(c, true);
        else if (c.tag === 'tbody' || c.tag === 'tfoot') collect(c, false);
        else if (c.tag === 'caption') caption.push(...this.blocks(c.children, { ...ctx, styleId: 'Caption', list: undefined }));
      }
    };
    collect(node, false);
    const pendingSpans: { col: number; remaining: number; span: number }[] = [];
    const rows: TableRow[] = [];
    let columns = 0;
    for (const { row, header } of rowsHtml) {
      const cells: TableRow['cells'] = [];
      let col = 0;
      const cellNodes = row.children.filter((c): c is HtmlElement => typeof c !== 'string' && (c.tag === 'td' || c.tag === 'th'));
      const allTh = cellNodes.length > 0 && cellNodes.every((c) => c.tag === 'th');
      const insertContinuations = (): void => {
        for (let v = pendingSpans.find((s) => s.col === col && s.remaining > 0); v; v = pendingSpans.find((s) => s.col === col && s.remaining > 0)) {
          cells.push({ props: { vMerge: 'continue', ...(v.span > 1 ? { gridSpan: v.span } : {}) }, blocks: [{ type: 'paragraph', props: {}, inlines: [] }] });
          v.remaining--;
          col += v.span;
        }
      };
      for (const cell of cellNodes) {
        insertContinuations();
        const css = parseStyleAttr(cell.attrs['style']);
        const colspan = Math.max(1, Math.min(1000, Number(cell.attrs['colspan'] ?? 1) || 1));
        const rowspan = Math.max(1, Math.min(10000, Number(cell.attrs['rowspan'] ?? 1) || 1));
        const props: TableCellProps = {};
        if (colspan > 1) props.gridSpan = colspan;
        if (rowspan > 1) {
          props.vMerge = 'restart';
          pendingSpans.push({ col, remaining: rowspan - 1, span: colspan });
        }
        const bg = parseCssColor(css['background-color'] ?? cell.attrs['bgcolor']);
        if (bg) props.shading = { fill: bg, pattern: 'clear', color: 'auto' };
        const va = css['vertical-align'] ?? cell.attrs['valign'];
        if (va === 'middle') props.verticalAlign = 'center';
        else if (va === 'top' || va === 'bottom') props.verticalAlign = va;
        const cellCtx: Ctx = { ...ctx, list: undefined, styleId: undefined, para: paragraphFromCss(css, { spacingAfter: 0 }), run: cell.tag === 'th' ? { ...ctx.run, bold: true } : ctx.run, depth: ctx.depth + 1 };
        if (cell.tag === 'th') cellCtx.para.alignment ??= 'center';
        const blocks = this.blocks(cell.children, cellCtx);
        cells.push({ props, blocks: blocks.length ? blocks : [{ type: 'paragraph', props: { spacingAfter: 0 }, inlines: [] }] });
        col += colspan;
      }
      insertContinuations();
      columns = Math.max(columns, col);
      rows.push({ props: header || allTh ? { header: true } : {}, cells });
    }
    if (!rows.length) return caption;
    const width = 450;
    const table: Table = {
      type: 'table', styleId: 'TableGrid', props: { width: { value: 100, type: 'pct' } },
      grid: Array.from({ length: columns }, () => Math.round((width / Math.max(1, columns)) * 100) / 100), rows,
    };
    return [...caption, table];
  }
}

export interface ReadHtmlOptions {
  limits?: Partial<ReadLimits>;
}

/** Importe un document HTML (octets UTF-8 ou texte). */
export function readHtml(input: Uint8Array | string, options: ReadHtmlOptions = {}): ReadResult {
  const limits: ReadLimits = { ...DEFAULT_READ_LIMITS, ...options.limits };
  let source: string;
  if (typeof input === 'string') source = input;
  else {
    const head = new TextDecoder('latin1').decode(input.subarray(0, 2048));
    const charset = head.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]?.toLowerCase();
    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(charset && charset !== 'utf8' ? charset : 'utf-8');
    } catch {
      decoder = new TextDecoder('utf-8');
    }
    source = decoder.decode(input);
  }
  const reader = new HtmlReader(limits);
  const root = parseHtml(source, limits.maxDepth * 4);
  const title = findFirst(root, 'title');
  if (title) {
    const value = htmlText(title).trim();
    if (value) reader.doc.properties.title = value;
  }
  const visitMeta = (el: HtmlElement): void => {
    for (const c of el.children) {
      if (typeof c === 'string') continue;
      if (c.tag === 'meta') {
        const name = (c.attrs['name'] ?? '').toLowerCase();
        const content = c.attrs['content'];
        if (content && name === 'author') reader.doc.properties.creator = content;
        if (content && name === 'description') reader.doc.properties.description = content;
        if (content && name === 'keywords') reader.doc.properties.keywords = content;
      } else visitMeta(c);
    }
  };
  visitMeta(root);
  const body = findFirst(root, 'body') ?? root;
  const blocks = reader.blocks(body.children.filter((c) => typeof c === 'string' || (c.tag !== 'head' && c.tag !== 'title')), { para: {}, run: {}, pre: false, depth: 0 });
  reader.doc.body = blocks.length ? blocks : [{ type: 'paragraph', props: {}, inlines: [] }];
  return { document: reader.doc, warnings: reader.warnings.list };
}
