// Lecture OpenDocument Texte (.odt) : styles, listes, tableaux (fusions), images, liens, notes,
// commentaires, champs, signets, table des matieres, en-tetes / pieds, mise en page, metadonnees.
import {
  attr, pushAll, child, children, DEFAULT_LIMITS, isElement, OpcPackage, PackageError, parseXml, textOf, type PackageLimits, type XmlElement,
} from '@forgeoffice/opc';
import type {
  AbstractNumbering, Block, Comment, Inline, NumberFormat, NumberingLevel, Paragraph, ParagraphProps, ReadResult, RunProps,
  Style, Table, TableCellProps, TableRow, WordDocument,
} from '../model.ts';
import { builtinStyle, createBlankDocument } from '../blank.ts';
import { sniffImageType } from '../docx/ns.ts';
import { DocxError } from '../docx/reader.ts';
import { Budget, checkedUrl, DEFAULT_READ_LIMITS, Warnings, type ReadLimits } from '../security.ts';
import { ERRORS, WARNINGS } from '../strings.ts';
import { parseLength } from '../units.ts';
import { parseCellPropsOdf, parseParagraphPropsOdf, parseTextProps } from './odf-props.ts';

interface OdfStyle {
  name: string;
  family: string;
  parent?: string;
  displayName?: string;
  automatic: boolean;
  text: RunProps;
  para: ParagraphProps;
  cell: TableCellProps;
  columnWidth?: number;
  listStyle?: string;
}

/** Noms de styles ODF (LibreOffice, Word) -> styles integres. */
const ODF_BUILTIN: Readonly<Record<string, string>> = {
  'standard': 'Normal', 'default paragraph style': 'Normal', 'text body': 'Normal', 'body text': 'Normal', 'table contents': 'Normal',
  'title': 'Title', 'subtitle': 'Subtitle', 'quotations': 'Quote', 'quote': 'Quote', 'header': 'Header', 'footer': 'Footer',
  'footnote': 'FootnoteText', 'endnote': 'EndnoteText', 'caption': 'Caption', 'list paragraph': 'ListParagraph',
  'contents heading': 'TOCHeading', 'no spacing': 'NoSpacing', 'intense quote': 'IntenseQuote',
};

const NUM_FORMATS: Readonly<Record<string, NumberFormat>> = { '1': 'decimal', a: 'lowerLetter', A: 'upperLetter', i: 'lowerRoman', I: 'upperRoman', '': 'none' };

const decodeName = (name: string): string => name.replace(/_([0-9a-fA-F]{2})_/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));

class OdtReader {
  readonly doc: WordDocument = createBlankDocument();
  readonly warnings = new Warnings();
  readonly budget: Budget;
  private readonly pkg: OpcPackage;
  private readonly styles = new Map<string, OdfStyle>();
  private readonly fonts = new Map<string, string>();
  private readonly listStyles = new Map<string, XmlElement>();
  private readonly listAbstracts = new Map<string, number>();
  private readonly lastInstance = new Map<string, number>();
  private readonly usedStyles = new Map<string, string>();
  private readonly images = new Map<string, Uint8Array>();
  private readonly bookmarks = new Map<string, number>();
  private readonly openComments = new Map<string, number>();
  private noteCount = 0;

  constructor(pkg: OpcPackage, limits: ReadLimits) {
    this.pkg = pkg;
    this.budget = new Budget(limits, this.warnings);
    this.doc.styles.docDefaults = { run: { size: 12 }, paragraph: {} };
  }

  async load(): Promise<void> {
    for (const path of this.pkg.paths()) {
      if (path.startsWith('pictures/') || path.startsWith('media/') || path.startsWith('objectreplacements/')) {
        this.images.set(path, await this.pkg.readBytes(path));
      }
    }
  }

  async xml(path: string): Promise<XmlElement | undefined> {
    if (!this.pkg.has(path)) return undefined;
    try {
      return parseXml(await this.pkg.readText(path));
    } catch (error) {
      if (error instanceof PackageError) throw error;
      this.warnings.add('part-unreadable', WARNINGS.partUnreadable(path));
      return undefined;
    }
  }

  // ---- Styles ----

  registerStyles(container: XmlElement | undefined, automatic: boolean): void {
    for (const s of children(container, 'style:style')) {
      const name = attr(s, 'style:name');
      if (!name) continue;
      this.styles.set(name, {
        name, automatic,
        family: attr(s, 'style:family') ?? 'paragraph',
        parent: attr(s, 'style:parent-style-name'),
        displayName: attr(s, 'style:display-name'),
        text: parseTextProps(child(s, 'style:text-properties'), this.fonts),
        para: parseParagraphPropsOdf(child(s, 'style:paragraph-properties')),
        cell: parseCellPropsOdf(child(s, 'style:table-cell-properties')),
        columnWidth: parseLength(attr(child(s, 'style:table-column-properties'), 'style:column-width')),
        listStyle: attr(s, 'style:list-style-name'),
      });
    }
    for (const list of children(container, 'text:list-style')) {
      const name = attr(list, 'style:name');
      if (name) this.listStyles.set(name, list);
    }
    const defaults = children(container, 'style:default-style').find((d) => attr(d, 'style:family') === 'paragraph');
    if (defaults) {
      const run = parseTextProps(child(defaults, 'style:text-properties'), this.fonts);
      const para = parseParagraphPropsOdf(child(defaults, 'style:paragraph-properties'));
      this.doc.styles.docDefaults = { run: { ...this.doc.styles.docDefaults.run, ...run }, paragraph: { ...this.doc.styles.docDefaults.paragraph, ...para } };
    }
  }

  registerFonts(decls: XmlElement | undefined): void {
    for (const face of children(decls, 'style:font-face')) {
      const name = attr(face, 'style:name');
      const family = attr(face, 'svg:font-family')?.replace(/^['"]|['"]$/g, '');
      if (name) this.fonts.set(name, family ?? name);
    }
  }

  /** Style nomme -> identifiant de style du document (cree a la premiere utilisation). */
  private styleId(name: string | undefined): string | undefined {
    if (!name) return undefined;
    const known = this.usedStyles.get(name);
    if (known) return known;
    const style = this.styles.get(name);
    const display = style?.displayName ?? decodeName(name);
    const key = display.toLowerCase();
    const heading = key.match(/^heading\s*(\d+)$/);
    let id = ODF_BUILTIN[key] ?? (heading ? `Heading${Math.min(9, Number(heading[1]))}` : undefined);
    if (!id || !builtinStyle(id)) {
      id = display.replace(/[^A-Za-z0-9]/g, '') || name;
      if (!this.doc.styles.styles.some((s) => s.id === id)) {
        const created: Style = { id, type: 'paragraph', name: display, custom: true };
        if (style && Object.keys(style.para).length) created.paragraph = { ...style.para };
        if (style && Object.keys(style.text).length) created.run = { ...style.text };
        const parent = style?.parent ? this.styleId(style.parent) : undefined;
        if (parent && parent !== id) created.basedOn = parent;
        this.doc.styles.styles.push(created);
      }
    }
    this.usedStyles.set(name, id);
    return id;
  }

  /** Proprietes d'un style automatique (et de ses parents automatiques) + style nomme sous-jacent. */
  private resolve(name: string | undefined): { styleId?: string; para: ParagraphProps; run: RunProps; listStyle?: string } {
    let para: ParagraphProps = {};
    let run: RunProps = {};
    let listStyle: string | undefined;
    let current = name ? this.styles.get(name) : undefined;
    const seen = new Set<string>();
    while (current && current.automatic && !seen.has(current.name)) {
      seen.add(current.name);
      para = { ...current.para, ...para };
      run = { ...current.text, ...run };
      listStyle ??= current.listStyle;
      current = current.parent ? this.styles.get(current.parent) : undefined;
    }
    const styleId = current ? this.styleId(current.name) : name && !this.styles.has(name) ? this.styleId(name) : undefined;
    listStyle ??= current?.listStyle;
    return { styleId, para, run, listStyle };
  }

  /** Proprietes de caracteres effectives d'un style de texte (automatique ou nomme). */
  private textProps(name: string | undefined): RunProps {
    let run: RunProps = {};
    let current = name ? this.styles.get(name) : undefined;
    const seen = new Set<string>();
    while (current && !seen.has(current.name)) {
      seen.add(current.name);
      run = { ...current.text, ...run };
      current = current.parent ? this.styles.get(current.parent) : undefined;
    }
    return run;
  }

  // ---- Listes ----

  private abstractFor(listStyle: string): number {
    const known = this.listAbstracts.get(listStyle);
    if (known !== undefined) return known;
    const id = this.doc.numbering.abstracts.length + 1;
    const levels: NumberingLevel[] = [];
    const def = this.listStyles.get(listStyle);
    for (const lvl of children(def)) {
      const levelIndex = Number(attr(lvl, 'text:level') ?? 1) - 1;
      if (levelIndex < 0 || levelIndex > 8) continue;
      const props = child(lvl, 'style:list-level-properties');
      const alignment = child(props, 'style:list-level-label-alignment');
      const marginLeft = parseLength(attr(alignment, 'fo:margin-left')) ?? (parseLength(attr(props, 'text:space-before')) ?? 0) + (parseLength(attr(props, 'text:min-label-width')) ?? 18);
      const textIndent = parseLength(attr(alignment, 'fo:text-indent')) ?? -(parseLength(attr(props, 'text:min-label-width')) ?? 18);
      const level: NumberingLevel = { level: levelIndex, format: 'decimal', text: '', start: 1, alignment: 'left', suffix: 'tab', paragraph: { indentLeft: marginLeft, indentFirstLine: textIndent } };
      if (lvl.name === 'text:list-level-style-bullet') {
        level.format = 'bullet';
        level.text = attr(lvl, 'text:bullet-char') ?? '•';
      } else if (lvl.name === 'text:list-level-style-number') {
        level.format = NUM_FORMATS[attr(lvl, 'style:num-format') ?? '1'] ?? 'decimal';
        level.start = Number(attr(lvl, 'text:start-value') ?? 1) || 1;
        const display = Math.max(1, Math.min(levelIndex + 1, Number(attr(lvl, 'text:display-levels') ?? 1) || 1));
        const nums: string[] = [];
        for (let l = levelIndex + 2 - display; l <= levelIndex + 1; l++) nums.push(`%${l}`);
        level.text = `${attr(lvl, 'style:num-prefix') ?? ''}${nums.join('.')}${attr(lvl, 'style:num-suffix') ?? ''}`;
      } else continue;
      levels.push(level);
    }
    if (!levels.length) levels.push({ level: 0, format: 'bullet', text: '•', start: 1, alignment: 'left', suffix: 'tab', paragraph: { indentLeft: 36, indentFirstLine: -18 } });
    const abstract: AbstractNumbering = { id, multiLevelType: levels.length > 1 ? 'hybridMultilevel' : 'singleLevel', levels };
    this.doc.numbering.abstracts.push(abstract);
    this.listAbstracts.set(listStyle, id);
    return id;
  }

  /** Nouvelle instance de liste (la numerotation redemarre) ou suite de la precedente. */
  private instanceFor(listStyle: string, continueNumbering: boolean): number {
    const last = this.lastInstance.get(listStyle);
    if (continueNumbering && last !== undefined) return last;
    const abstractId = this.abstractFor(listStyle);
    const id = this.doc.numbering.instances.length + 1;
    const start = this.doc.numbering.abstracts.find((a) => a.id === abstractId)?.levels[0]?.start ?? 1;
    this.doc.numbering.instances.push({ id, abstractId, overrides: last !== undefined ? [{ level: 0, startOverride: start }] : [] });
    this.lastInstance.set(listStyle, id);
    return id;
  }

  // ---- Contenu ----

  blocks(container: XmlElement | undefined, depth: number, list?: { numId: number; level: number }): Block[] {
    const out: Block[] = [];
    if (!container || !this.budget.depthOk(depth)) return out;
    for (const node of children(container)) {
      switch (node.name) {
        case 'text:p':
        case 'text:h':
          if (!this.budget.takeBlock()) return out;
          out.push(this.paragraph(node, list));
          break;
        case 'text:list':
          pushAll(out, this.list(node, depth, list));
          break;
        case 'table:table':
          if (!this.budget.takeBlock()) return out;
          out.push(this.table(node, depth));
          break;
        case 'text:section':
        case 'text:index-body':
        case 'text:alphabetical-index':
        case 'text:bibliography':
        case 'text:illustration-index':
        case 'text:index-title':
          pushAll(out, this.blocks(node.name === 'text:alphabetical-index' || node.name === 'text:bibliography' || node.name === 'text:illustration-index' ? child(node, 'text:index-body') : node, depth + 1));
          break;
        case 'text:table-of-content':
          out.push({ type: 'toc', instruction: 'TOC \\o "1-3" \\h \\z \\u', blocks: this.blocks(child(node, 'text:index-body'), depth + 1) });
          break;
        default:
          break;
      }
    }
    return out;
  }

  private list(node: XmlElement, depth: number, parent?: { numId: number; level: number }): Block[] {
    const styleName = attr(node, 'text:style-name');
    let numId = parent?.numId;
    if (styleName && !parent) numId = this.instanceFor(styleName, attr(node, 'text:continue-numbering') === 'true' || attr(node, 'text:continue-list') !== undefined);
    if (numId === undefined) numId = this.instanceFor(styleName ?? '__defaut', false);
    const level = parent ? Math.min(8, parent.level + 1) : 0;
    const out: Block[] = [];
    for (const item of children(node)) {
      if (item.name !== 'text:list-item' && item.name !== 'text:list-header') continue;
      const blocks = this.blocks(item, depth + 1, { numId, level });
      if (item.name === 'text:list-header') {
        for (const b of blocks) if (b.type === 'paragraph') delete b.props.numbering;
      }
      pushAll(out, blocks);
    }
    return out;
  }

  private paragraph(node: XmlElement, list?: { numId: number; level: number }): Paragraph {
    const resolved = this.resolve(attr(node, 'text:style-name'));
    const paragraph: Paragraph = { type: 'paragraph', props: { ...resolved.para }, inlines: [] };
    if (node.name === 'text:h') {
      const level = Math.min(9, Math.max(1, Number(attr(node, 'text:outline-level') ?? 1) || 1));
      paragraph.styleId = resolved.styleId?.startsWith('Heading') || resolved.styleId === 'Title' ? resolved.styleId : `Heading${level}`;
    } else if (resolved.styleId && resolved.styleId !== 'Normal') {
      paragraph.styleId = resolved.styleId;
    }
    if (list) paragraph.props.numbering = { ...list };
    else if (resolved.listStyle && node.name === 'text:p') paragraph.props.numbering = { numId: this.instanceFor(resolved.listStyle, true), level: 0 };
    this.inlines(node, resolved.run, paragraph.inlines);
    return paragraph;
  }

  private addText(out: Inline[], text: string, props: RunProps): void {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.type === 'text' && JSON.stringify(last.props) === JSON.stringify(props)) last.text += text;
    else out.push({ type: 'text', text, props: { ...props } });
  }

  private inlines(node: XmlElement, props: RunProps, out: Inline[]): void {
    for (const item of node.children) {
      if (!isElement(item)) {
        this.addText(out, item.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' '), props);
        continue;
      }
      switch (item.name) {
        case 'text:span': this.inlines(item, { ...props, ...this.textProps(attr(item, 'text:style-name')) }, out); break;
        case 'text:s': this.addText(out, ' '.repeat(Math.min(1000, Number(attr(item, 'text:c') ?? 1) || 1)), props); break;
        case 'text:tab': out.push(Object.keys(props).length ? { type: 'tab', props: { ...props } } : { type: 'tab' }); break;
        case 'text:line-break': out.push({ type: 'break', kind: 'line' }); break;
        case 'text:a': {
          const href = attr(item, 'xlink:href') ?? '';
          const link: Inline = { type: 'hyperlink', inlines: [] };
          if (href.startsWith('#')) link.anchor = href.slice(1);
          else {
            const url = checkedUrl(href, this.warnings);
            if (url) link.url = url;
          }
          const title = attr(item, 'office:title');
          if (title) link.tooltip = title;
          this.inlines(item, { ...props, ...this.textProps(attr(item, 'text:style-name')) }, link.inlines);
          out.push(link);
          break;
        }
        case 'text:note': this.note(item, props, out); break;
        case 'text:bookmark': {
          const id = this.bookmarks.size;
          this.bookmarks.set(attr(item, 'text:name') ?? `b${id}`, id);
          out.push({ type: 'bookmarkStart', id, name: attr(item, 'text:name') ?? `b${id}` }, { type: 'bookmarkEnd', id });
          break;
        }
        case 'text:bookmark-start': {
          const id = this.bookmarks.size;
          const name = attr(item, 'text:name') ?? `b${id}`;
          this.bookmarks.set(name, id);
          out.push({ type: 'bookmarkStart', id, name });
          break;
        }
        case 'text:bookmark-end': {
          const id = this.bookmarks.get(attr(item, 'text:name') ?? '');
          if (id !== undefined) out.push({ type: 'bookmarkEnd', id });
          break;
        }
        case 'draw:frame': this.frame(item, props, out); break;
        case 'office:annotation': this.annotation(item, out); break;
        case 'office:annotation-end': {
          const id = this.openComments.get(attr(item, 'office:name') ?? '');
          if (id !== undefined) out.push({ type: 'commentEnd', commentId: id }, { type: 'commentRef', commentId: id });
          break;
        }
        case 'text:page-number': this.field(out, 'PAGE', item, props); break;
        case 'text:page-count': this.field(out, 'NUMPAGES', item, props); break;
        case 'text:date': this.field(out, 'DATE', item, props); break;
        case 'text:time': this.field(out, 'TIME', item, props); break;
        case 'text:title': this.field(out, 'TITLE', item, props); break;
        case 'text:author-name':
        case 'text:initial-creator': this.field(out, 'AUTHOR', item, props); break;
        case 'text:file-name': this.field(out, 'FILENAME', item, props); break;
        case 'text:bookmark-ref': this.field(out, `REF ${attr(item, 'text:ref-name') ?? ''} \\h`, item, props); break;
        case 'text:soft-page-break':
        case 'text:change-start':
        case 'text:change-end':
        case 'text:change':
        case 'text:reference-mark-start':
        case 'text:reference-mark-end': break;
        case 'text:ruby': this.inlines(child(item, 'text:ruby-base') ?? item, props, out); break;
        default: this.inlines(item, props, out); break;
      }
    }
  }

  private field(out: Inline[], instruction: string, node: XmlElement, props: RunProps): void {
    const code = instruction.split(' ')[0] ?? instruction;
    const result: Inline[] = [];
    this.addText(result, textOf(node), props);
    out.push({ type: 'field', instruction, code, result });
  }

  private note(node: XmlElement, props: RunProps, out: Inline[]): void {
    const endnote = attr(node, 'text:note-class') === 'endnote';
    this.noteCount += 1;
    const id = this.noteCount;
    const blocks = this.blocks(child(node, 'text:note-body'), 1);
    const first = blocks[0];
    if (first?.type === 'paragraph') first.inlines.unshift({ type: 'noteMark', kind: endnote ? 'endnote' : 'footnote' }, { type: 'text', text: ' ', props: {} });
    (endnote ? this.doc.endnotes : this.doc.footnotes).push({ id, blocks });
    const ref: Inline = { type: endnote ? 'endnoteRef' : 'footnoteRef', noteId: id };
    const rest = { ...props };
    delete rest.vertAlign;
    if (Object.keys(rest).length) ref.props = rest;
    out.push(ref);
  }

  private annotation(node: XmlElement, out: Inline[]): void {
    const id = this.doc.comments.length;
    const comment: Comment = { id, author: textOf(child(node, 'dc:creator')).trim(), blocks: this.blocks(node, 1) };
    const date = textOf(child(node, 'dc:date')).trim();
    if (date) comment.date = date;
    this.doc.comments.push(comment);
    const name = attr(node, 'office:name');
    out.push({ type: 'commentStart', commentId: id });
    if (name) this.openComments.set(name, id);
    else out.push({ type: 'commentEnd', commentId: id }, { type: 'commentRef', commentId: id });
  }

  private frame(node: XmlElement, props: RunProps, out: Inline[]): void {
    const width = parseLength(attr(node, 'svg:width')) ?? 72;
    const height = parseLength(attr(node, 'svg:height')) ?? 72;
    const anchor = attr(node, 'text:anchor-type');
    const floating = anchor && anchor !== 'as-char'
      ? {
        horizontal: { relativeTo: anchor === 'page' ? 'page' as const : 'column' as const, offset: parseLength(attr(node, 'svg:x')) ?? 0 },
        vertical: { relativeTo: anchor === 'page' ? 'page' as const : 'paragraph' as const, offset: parseLength(attr(node, 'svg:y')) ?? 0 },
        wrap: 'square' as const, behindText: false, distance: { top: 0, right: 9, bottom: 0, left: 9 }, allowOverlap: true, zIndex: Number(attr(node, 'draw:z-index') ?? 0) || 0,
      }
      : undefined;
    const image = child(node, 'draw:image');
    const textBox = child(node, 'draw:text-box');
    if (image) {
      const href = (attr(image, 'xlink:href') ?? '').replace(/^\.\//, '').toLowerCase();
      let bytes = this.images.get(href);
      const binary = child(image, 'office:binary-data');
      if (!bytes && binary) bytes = Uint8Array.from(atob(textOf(binary).replace(/\s+/g, '')), (c) => c.charCodeAt(0));
      if (!bytes) {
        this.warnings.add('missing-media', WARNINGS.missingMedia(href));
        return;
      }
      const fileName = href.slice(href.lastIndexOf('/') + 1) || 'image';
      let id = fileName;
      for (let n = 2; this.doc.media[id] && this.doc.media[id]?.bytes !== bytes; n++) id = `${n}-${fileName}`;
      this.doc.media[id] = { id, fileName, contentType: sniffImageType(bytes) ?? 'application/octet-stream', bytes };
      const inline: Inline = { type: 'image', mediaId: id, width, height };
      const title = textOf(child(node, 'svg:title')).trim();
      const desc = textOf(child(node, 'svg:desc')).trim();
      if (desc || title) inline.alt = desc || title;
      if (title && desc) inline.title = title;
      const name = attr(node, 'draw:name');
      if (name) inline.name = name;
      if (floating) inline.floating = floating;
      if (Object.keys(props).length) inline.props = { ...props };
      out.push(inline);
    } else if (textBox) {
      const shape: Inline = { type: 'shape', geometry: 'rect', width, height, text: this.blocks(textBox, 1) };
      if (floating) shape.floating = floating;
      out.push(shape);
    }
  }

  private table(node: XmlElement, depth: number): Table {
    const grid: number[] = [];
    const columns = (parent: XmlElement): void => {
      for (const c of children(parent)) {
        if (c.name === 'table:table-column') {
          const repeat = Math.min(1024, Number(attr(c, 'table:number-columns-repeated') ?? 1) || 1);
          const width = this.styles.get(attr(c, 'table:style-name') ?? '')?.columnWidth ?? 72;
          for (let i = 0; i < repeat; i++) grid.push(width);
        } else if (c.name === 'table:table-columns' || c.name === 'table:table-header-columns' || c.name === 'table:table-column-group') columns(c);
      }
    };
    columns(node);
    const rowNodes: { row: XmlElement; header: boolean }[] = [];
    const collect = (parent: XmlElement, header: boolean): void => {
      for (const c of children(parent)) {
        if (c.name === 'table:table-row') rowNodes.push({ row: c, header });
        else if (c.name === 'table:table-header-rows') collect(c, true);
        else if (c.name === 'table:table-rows' || c.name === 'table:table-row-group') collect(c, header);
      }
    };
    collect(node, false);
    const vertical = new Map<number, { remaining: number; span: number }>();
    const rows: TableRow[] = [];
    for (const { row, header } of rowNodes.slice(0, 100_000)) {
      const repeat = Math.min(100, Number(attr(row, 'table:number-rows-repeated') ?? 1) || 1);
      for (let r = 0; r < repeat; r++) {
        const cells: TableRow['cells'] = [];
        let col = 0;
        let skip = 0;
        for (const cell of children(row)) {
          if (cell.name !== 'table:table-cell' && cell.name !== 'table:covered-table-cell') continue;
          const repeated = Math.min(1024, Number(attr(cell, 'table:number-columns-repeated') ?? 1) || 1);
          for (let k = 0; k < repeated; k++) {
            if (cell.name === 'table:covered-table-cell') {
              const v = vertical.get(col);
              if (skip > 0) skip--;
              else if (v && v.remaining > 0) {
                cells.push({ props: { vMerge: 'continue', ...(v.span > 1 ? { gridSpan: v.span } : {}) }, blocks: [{ type: 'paragraph', props: {}, inlines: [] }] });
                v.remaining--;
                skip = v.span - 1;
              }
              col++;
              continue;
            }
            const colSpan = Math.max(1, Number(attr(cell, 'table:number-columns-spanned') ?? 1) || 1);
            const rowSpan = Math.max(1, Number(attr(cell, 'table:number-rows-spanned') ?? 1) || 1);
            const props: TableCellProps = { ...this.styles.get(attr(cell, 'table:style-name') ?? '')?.cell };
            if (colSpan > 1) props.gridSpan = colSpan;
            if (rowSpan > 1) {
              props.vMerge = 'restart';
              vertical.set(col, { remaining: rowSpan - 1, span: colSpan });
            }
            const blocks = this.blocks(cell, depth + 1);
            cells.push({ props, blocks: blocks.length ? blocks : [{ type: 'paragraph', props: {}, inlines: [] }] });
            skip = colSpan - 1;
            col++;
          }
        }
        rows.push({ props: header ? { header: true } : {}, cells });
      }
    }
    const table: Table = { type: 'table', styleId: 'TableGrid', props: { width: { value: 100, type: 'pct' } }, grid, rows };
    const name = attr(node, 'table:name');
    if (name) table.props.caption = name;
    return table;
  }

  // ---- Mise en page ----

  pageLayout(stylesRoot: XmlElement | undefined): void {
    const master = children(child(stylesRoot, 'office:master-styles'), 'style:master-page');
    const page = master.find((m) => attr(m, 'style:name') === 'Standard') ?? master[0];
    if (!page) return;
    const layoutName = attr(page, 'style:page-layout-name');
    const layouts = children(child(stylesRoot, 'office:automatic-styles'), 'style:page-layout');
    const layout = layouts.find((l) => attr(l, 'style:name') === layoutName);
    const props = child(layout, 'style:page-layout-properties');
    const section = this.doc.finalSection;
    const len = (el: XmlElement | undefined, name: string): number | undefined => parseLength(attr(el, name));
    section.pageWidth = len(props, 'fo:page-width') ?? section.pageWidth;
    section.pageHeight = len(props, 'fo:page-height') ?? section.pageHeight;
    if (attr(props, 'style:print-orientation') === 'landscape') section.orientation = 'landscape';
    const m = section.margins;
    section.margins = {
      ...m,
      top: len(props, 'fo:margin-top') ?? m.top, bottom: len(props, 'fo:margin-bottom') ?? m.bottom,
      left: len(props, 'fo:margin-left') ?? m.left, right: len(props, 'fo:margin-right') ?? m.right,
    };
    const cols = child(props, 'style:columns');
    const count = Number(attr(cols, 'fo:column-count') ?? 1);
    if (count > 1) section.columns = { ...section.columns, count, space: len(cols, 'fo:column-gap') ?? section.columns.space };
    let n = 0;
    for (const [tag, kind, type] of [
      ['style:header', 'header', 'default'], ['style:footer', 'footer', 'default'], ['style:header-first', 'header', 'first'],
      ['style:footer-first', 'footer', 'first'], ['style:header-left', 'header', 'even'], ['style:footer-left', 'footer', 'even'],
    ] as const) {
      const part = child(page, tag);
      if (!part || attr(part, 'style:display') === 'false') continue;
      n++;
      const id = `${kind}${n}`;
      this.doc.headersFooters[id] = { id, kind, blocks: this.blocks(part, 1) };
      (kind === 'header' ? section.headers : section.footers)[type] = id;
      if (type === 'first') section.titlePage = true;
      if (type === 'even') this.doc.settings.evenAndOddHeaders = true;
    }
  }

  meta(root: XmlElement | undefined): void {
    const meta = child(root, 'office:meta');
    if (!meta) return;
    const text = (name: string): string | undefined => {
      const value = textOf(child(meta, name)).trim();
      return value || undefined;
    };
    const p = this.doc.properties;
    const set = (key: 'title' | 'description' | 'subject' | 'creator' | 'lastModifiedBy' | 'created' | 'modified' | 'language', value: string | undefined): void => {
      if (value) p[key] = value;
    };
    set('title', text('dc:title'));
    set('description', text('dc:description'));
    set('subject', text('dc:subject'));
    set('creator', text('meta:initial-creator') ?? text('dc:creator'));
    set('lastModifiedBy', text('dc:creator'));
    set('created', text('meta:creation-date'));
    set('modified', text('dc:date'));
    set('language', text('dc:language'));
    const keywords = children(meta, 'meta:keyword').map((k) => textOf(k).trim()).filter(Boolean);
    if (keywords.length) p.keywords = keywords.join(', ');
    for (const user of children(meta, 'meta:user-defined')) {
      const name = attr(user, 'meta:name');
      if (name) p.custom[name] = textOf(user);
    }
  }
}

export interface ReadOdtOptions {
  limits?: Partial<ReadLimits>;
  packageLimits?: Partial<PackageLimits>;
}

/** Lit un document OpenDocument Texte. */
export async function readOdt(bytes: Uint8Array, options: ReadOdtOptions = {}): Promise<ReadResult> {
  const limits: ReadLimits = { ...DEFAULT_READ_LIMITS, ...options.limits };
  if (bytes.length > limits.maxInputBytes) throw new DocxError(ERRORS.tooLarge);
  let pkg: OpcPackage;
  try {
    pkg = await OpcPackage.open(bytes, { ...DEFAULT_LIMITS, ...options.packageLimits });
  } catch {
    throw new DocxError(ERRORS.notZip);
  }
  const reader = new OdtReader(pkg, limits);
  await reader.load();
  const stylesRoot = await reader.xml('styles.xml');
  const content = await reader.xml('content.xml');
  reader.registerFonts(child(stylesRoot, 'office:font-face-decls'));
  reader.registerFonts(child(content, 'office:font-face-decls'));
  reader.registerStyles(child(stylesRoot, 'office:styles'), false);
  reader.registerStyles(child(stylesRoot, 'office:automatic-styles'), true);
  reader.registerStyles(child(content, 'office:automatic-styles'), true);
  reader.meta(await reader.xml('meta.xml'));
  reader.pageLayout(stylesRoot);
  const text = child(child(content, 'office:body'), 'office:text');
  if (!content) reader.warnings.add('odt-no-content', WARNINGS.odtNoContent);
  const body = reader.blocks(text, 0);
  reader.doc.body = body.length ? body : [{ type: 'paragraph', props: {}, inlines: [] }];
  return { document: reader.doc, warnings: reader.warnings.list };
}
