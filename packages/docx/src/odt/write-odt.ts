// Ecriture OpenDocument Texte (.odt) : styles, listes, tableaux, images, liens, notes, commentaires, champs,
// signets, en-tetes / pieds, mise en page, metadonnees. Ouvrable par LibreOffice et Word.
import JSZip from 'jszip';
import { el, serializeXml, type XmlElement, type XmlNode } from '@forgeoffice/opc';
import type { Block, Inline, NumberingLevel, Paragraph, ParagraphProps, RunProps, Section, Table, WordDocument } from '../model.ts';
import { extensionOf } from '../docx/ns.ts';
import { effectiveParagraphProps, numberingLevel } from '../resolve.ts';
import { sanitizeUrl } from '../security.ts';
import { fmtCm, fmtPt } from '../units.ts';
import { formatOdfBorder, formatParagraphProps, formatTextProps } from './odf-props.ts';

const NS: Record<string, string> = {
  'xmlns:office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  'xmlns:style': 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  'xmlns:text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  'xmlns:table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  'xmlns:draw': 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  'xmlns:fo': 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  'xmlns:xlink': 'http://www.w3.org/1999/xlink',
  'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
  'xmlns:meta': 'urn:oasis:names:tc:opendocument:xmlns:meta:1.0',
  'xmlns:number': 'urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0',
  'xmlns:svg': 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
  'xmlns:loext': 'urn:org:documentfoundation:names:experimental:office:xmlns:loext:1.0',
  'office:version': '1.3',
};

const NUM_FORMAT: Readonly<Record<string, string>> = {
  decimal: '1', decimalZero: '1', lowerLetter: 'a', upperLetter: 'A', lowerRoman: 'i', upperRoman: 'I', none: '',
};

/** Nom de style ODF (espaces encodes « _20_ »). */
const odfName = (name: string): string => name.replace(/[^A-Za-z0-9-]/g, (c) => `_${c.charCodeAt(0).toString(16).padStart(2, '0')}_`);

class OdtWriter {
  private readonly doc: WordDocument;
  private readonly autoStyles: XmlElement[] = [];
  private readonly autoKeys = new Map<string, string>();
  private readonly fonts = new Set<string>();
  private readonly pictures = new Map<string, string>();
  private readonly listStyles = new Map<number, string>();
  private readonly bookmarks = new Map<number, string>();
  private frameCount = 0;
  private counters = { P: 0, T: 0, L: 0, Tab: 0, fr: 0 };

  constructor(doc: WordDocument) {
    this.doc = doc;
  }

  private fontName(font: string): string {
    this.fonts.add(font);
    return font;
  }

  private auto(family: string, prefix: 'P' | 'T' | 'Tab', kids: XmlElement[], attrs: Record<string, string | undefined> = {}): string {
    const key = `${family}|${JSON.stringify(attrs)}|${kids.map((k) => serializeXml(k)).join('')}`;
    const known = this.autoKeys.get(key);
    if (known) return known;
    this.counters[prefix] += 1;
    const name = `${prefix}${this.counters[prefix]}`;
    this.autoStyles.push(el('style:style', { 'style:name': name, 'style:family': family, ...attrs }, kids));
    this.autoKeys.set(key, name);
    return name;
  }

  private textStyle(props: RunProps): string | undefined {
    const attrs = formatTextProps(props, (f) => this.fontName(f));
    if (!Object.keys(attrs).length) return undefined;
    return this.auto('text', 'T', [el('style:text-properties', attrs)]);
  }

  private paragraphKids(props: ParagraphProps, run?: RunProps): XmlElement[] {
    const { attrs, tabs } = formatParagraphProps(props);
    const kids: XmlElement[] = [];
    if (Object.keys(attrs).length || tabs.length) {
      kids.push(el('style:paragraph-properties', attrs, tabs.length ? [el('style:tab-stops', {}, tabs.map((t) => el('style:tab-stop', {
        'style:position': fmtCm(t.position),
        'style:type': t.align === 'center' ? 'center' : t.align === 'right' ? 'right' : t.align === 'decimal' ? 'char' : undefined,
        'style:char': t.align === 'decimal' ? ',' : undefined,
        'style:leader-text': t.leader === 'dot' ? '.' : t.leader === 'hyphen' ? '-' : t.leader === 'underscore' ? '_' : undefined,
        'style:leader-style': t.leader && t.leader !== 'none' ? 'dotted' : undefined,
      })))] : []));
    }
    if (run) {
      const text = formatTextProps(run, (f) => this.fontName(f));
      if (Object.keys(text).length) kids.push(el('style:text-properties', text));
    }
    return kids;
  }

  private styleRef(styleId: string | undefined): string {
    const style = styleId ? this.doc.styles.styles.find((s) => s.id === styleId) : undefined;
    return style && style.id !== 'Normal' ? odfName(style.name) : 'Standard';
  }

  private listStyle(numId: number): string {
    const known = this.listStyles.get(numId);
    if (known) return known;
    this.counters.L += 1;
    const name = `L${this.counters.L}`;
    this.listStyles.set(numId, name);
    const levels: XmlElement[] = [];
    for (let level = 0; level < 9; level++) {
      const def: NumberingLevel | undefined = numberingLevel(this.doc, numId, level);
      if (!def) continue;
      const indent = def.paragraph?.indentLeft ?? 36 * (level + 1);
      const first = def.paragraph?.indentFirstLine ?? -18;
      const props = el('style:list-level-properties', { 'text:list-level-position-and-space-mode': 'label-alignment' }, [
        el('style:list-level-label-alignment', { 'text:label-followed-by': def.suffix === 'space' ? 'space' : def.suffix === 'nothing' ? 'nothing' : 'listtab', 'text:list-tab-stop-position': fmtCm(indent), 'fo:text-indent': fmtCm(first), 'fo:margin-left': fmtCm(indent) }),
      ]);
      if (def.format === 'bullet') {
        levels.push(el('text:list-level-style-bullet', { 'text:level': level + 1, 'text:bullet-char': def.text || '•' }, [props]));
      } else {
        const match = def.text.match(/^(.*?)%(\d)(?:.*%\d)?(.*)$/);
        const display = (def.text.match(/%\d/g) ?? []).length || 1;
        levels.push(el('text:list-level-style-number', {
          'text:level': level + 1, 'style:num-format': NUM_FORMAT[def.format] ?? '1',
          'style:num-prefix': match?.[1] || undefined, 'style:num-suffix': match?.[3] || undefined,
          'text:start-value': def.start !== 1 ? def.start : undefined, 'text:display-levels': display > 1 ? display : undefined,
        }, [props]));
      }
    }
    this.autoStyles.push(el('text:list-style', { 'style:name': name }, levels));
    return name;
  }

  // ---- Contenu ----

  private image(inline: Extract<Inline, { type: 'image' }>): XmlElement | undefined {
    const media = this.doc.media[inline.mediaId];
    if (!media) return undefined;
    let path = this.pictures.get(inline.mediaId);
    if (!path) {
      path = `Pictures/${this.pictures.size + 1}.${extensionOf(media.contentType, media.fileName)}`;
      this.pictures.set(inline.mediaId, path);
    }
    this.counters.fr += 1;
    const f = inline.floating;
    const kids: XmlElement[] = [el('draw:image', { 'xlink:href': path, 'xlink:type': 'simple', 'xlink:show': 'embed', 'xlink:actuate': 'onLoad', 'draw:mime-type': media.contentType })];
    if (inline.title) kids.push(el('svg:title', {}, [inline.title]));
    if (inline.alt) kids.push(el('svg:desc', {}, [inline.alt]));
    return el('draw:frame', {
      'draw:name': inline.name ?? `Image${this.counters.fr}`, 'text:anchor-type': f ? 'paragraph' : 'as-char',
      'svg:x': f ? fmtPt(f.horizontal.offset ?? 0) : undefined, 'svg:y': f ? fmtPt(f.vertical.offset ?? 0) : undefined,
      'svg:width': fmtPt(inline.width), 'svg:height': fmtPt(inline.height), 'draw:z-index': this.frameCount++,
    }, kids);
  }

  private span(text: string, props: RunProps | undefined): XmlNode[] {
    const nodes: XmlNode[] = [];
    let buffer = '';
    const flush = (): void => {
      if (buffer) nodes.push(buffer);
      buffer = '';
    };
    for (let i = 0; i < text.length; i++) {
      const ch = text.charAt(i);
      if (ch === '\t') { flush(); nodes.push(el('text:tab')); }
      else if (ch === '\n') { flush(); nodes.push(el('text:line-break')); }
      else if (ch === ' ' && (i === 0 || text.charAt(i - 1) === ' ' || i === text.length - 1)) {
        let count = 1;
        while (text.charAt(i + count) === ' ') count++;
        flush();
        nodes.push(el('text:s', count > 1 ? { 'text:c': count } : {}));
        i += count - 1;
      } else buffer += ch;
    }
    flush();
    const style = props ? this.textStyle(props) : undefined;
    return style ? [el('text:span', { 'text:style-name': style }, nodes)] : nodes;
  }

  inlines(inlines: readonly Inline[]): XmlNode[] {
    const out: XmlNode[] = [];
    for (const inline of inlines) {
      if ('revision' in inline && inline.revision && (inline.revision.kind === 'delete' || inline.revision.kind === 'moveFrom')) continue;
      switch (inline.type) {
        case 'text': {
          const style = inline.styleId ? this.doc.styles.styles.find((s) => s.id === inline.styleId) : undefined;
          out.push(...this.span(inline.text, { ...style?.run, ...inline.props }));
          break;
        }
        case 'tab': out.push(el('text:tab')); break;
        case 'break': out.push(inline.kind === 'line' ? el('text:line-break') : el('text:soft-page-break')); break;
        case 'symbol': out.push(...this.span(String.fromCodePoint(Number.parseInt(inline.char, 16) || 0x20), { font: inline.font })); break;
        case 'hyperlink': {
          const url = sanitizeUrl(inline.url);
          const href = url ?? (inline.anchor ? `#${inline.anchor}` : undefined);
          out.push(href ? el('text:a', { 'xlink:type': 'simple', 'xlink:href': href, 'office:title': inline.tooltip }, this.inlines(inline.inlines) as XmlElement[]) : el('text:span', {}, this.inlines(inline.inlines) as XmlElement[]));
          break;
        }
        case 'field': {
          const result = this.inlines(inline.result);
          const tag = { PAGE: 'text:page-number', NUMPAGES: 'text:page-count', DATE: 'text:date', TIME: 'text:time', TITLE: 'text:title', AUTHOR: 'text:author-name', FILENAME: 'text:file-name' }[inline.code];
          if (tag) out.push(el(tag, tag === 'text:page-number' ? { 'text:select-page': 'current' } : {}, result as XmlElement[]));
          else out.push(...result);
          break;
        }
        case 'image': { const frame = this.image(inline); if (frame) out.push(frame); break; }
        case 'shape':
          this.counters.fr += 1;
          out.push(el('draw:frame', { 'draw:name': inline.name ?? `Cadre${this.counters.fr}`, 'text:anchor-type': inline.floating ? 'paragraph' : 'as-char', 'svg:width': fmtPt(inline.width), 'svg:height': fmtPt(inline.height) }, [
            el('draw:text-box', {}, this.blocks(inline.text ?? [])),
          ]));
          break;
        case 'footnoteRef':
        case 'endnoteRef': {
          const endnote = inline.type === 'endnoteRef';
          const note = (endnote ? this.doc.endnotes : this.doc.footnotes).find((n) => n.id === inline.noteId);
          if (!note) break;
          const body = this.blocks(note.blocks.map((b) => (b.type === 'paragraph' ? { ...b, inlines: stripNoteMark(b.inlines) } : b)));
          out.push(el('text:note', { 'text:id': `ftn${inline.noteId}`, 'text:note-class': endnote ? 'endnote' : 'footnote' }, [
            el('text:note-citation', {}, [inline.customMark ?? String(inline.noteId)]),
            el('text:note-body', {}, body),
          ]));
          break;
        }
        case 'bookmarkStart': this.bookmarks.set(inline.id, inline.name); out.push(el('text:bookmark-start', { 'text:name': inline.name })); break;
        case 'bookmarkEnd': { const name = this.bookmarks.get(inline.id); if (name) out.push(el('text:bookmark-end', { 'text:name': name })); break; }
        case 'commentStart': {
          const comment = this.doc.comments.find((c) => c.id === inline.commentId);
          if (!comment) break;
          out.push(el('office:annotation', { 'office:name': `__Annotation__${comment.id}` }, [
            el('dc:creator', {}, [comment.author]),
            ...(comment.date ? [el('dc:date', {}, [comment.date])] : []),
            ...this.blocks(comment.blocks),
          ]));
          break;
        }
        case 'commentEnd': out.push(el('office:annotation-end', { 'office:name': `__Annotation__${inline.commentId}` })); break;
        case 'inlineControl': out.push(...this.inlines(inline.inlines)); break;
        case 'equation': out.push(...this.span(inline.text, { italic: true })); break;
        default: break;
      }
    }
    return out;
  }

  private paragraph(p: Paragraph): XmlElement {
    const effective = effectiveParagraphProps(this.doc, p);
    const heading = effective.outlineLevel !== undefined && effective.outlineLevel < 9 ? effective.outlineLevel + 1 : 0;
    const direct = { ...p.props };
    delete direct.numbering;
    if (p.inlines.some((i) => i.type === 'break' && i.kind === 'page')) direct.pageBreakBefore = true;
    const kids = this.paragraphKids(direct, p.markProps && !p.inlines.length ? p.markProps : undefined);
    const parent = this.styleRef(p.styleId);
    const style = kids.length ? this.auto('paragraph', 'P', kids, { 'style:parent-style-name': parent }) : parent;
    const content = this.inlines(p.inlines.filter((i) => !(i.type === 'break' && i.kind === 'page'))) as XmlElement[];
    return heading
      ? el('text:h', { 'text:style-name': style, 'text:outline-level': heading }, content)
      : el('text:p', { 'text:style-name': style }, content);
  }

  private table(t: Table): XmlElement {
    this.counters.Tab += 1;
    const name = `Tableau${this.counters.Tab}`;
    const total = t.grid.reduce((a, b) => a + b, 0);
    const tableStyle = this.auto('table', 'Tab', [el('style:table-properties', { 'style:width': fmtCm(total || 450), 'table:align': t.props.alignment === 'center' ? 'center' : t.props.alignment === 'right' ? 'right' : 'margins' })]);
    const columns = t.grid.map((w) => el('table:table-column', { 'table:style-name': this.auto('table-column', 'Tab', [el('style:table-column-properties', { 'style:column-width': fmtCm(w) })]) }));
    const borders = t.props.borders ?? (t.styleId === 'TableGrid' || !t.styleId ? { top: { style: 'single' as const, width: 0.5, color: '000000', space: 0 } } : undefined);
    const defaultBorder = borders ? formatOdfBorder(borders.top ?? borders.insideH) : undefined;
    const headerRows: XmlElement[] = [];
    const bodyRows: XmlElement[] = [];
    for (const row of t.rows) {
      const cells: XmlElement[] = [];
      for (const cell of row.cells) {
        const span = cell.props.gridSpan ?? 1;
        if (cell.props.vMerge === 'continue') {
          for (let i = 0; i < span; i++) cells.push(el('table:covered-table-cell'));
          continue;
        }
        let rowSpan = 1;
        if (cell.props.vMerge === 'restart') {
          const rowIndex = t.rows.indexOf(row);
          const colIndex = row.cells.slice(0, row.cells.indexOf(cell)).reduce((a, c) => a + (c.props.gridSpan ?? 1), 0);
          for (let r = rowIndex + 1; r < t.rows.length; r++) {
            let col = 0;
            const below = t.rows[r]?.cells.find((c) => { const hit = col === colIndex; col += c.props.gridSpan ?? 1; return hit; });
            if (below?.props.vMerge !== 'continue') break;
            rowSpan++;
          }
        }
        const cellAttrs: Record<string, string | undefined> = {
          'fo:border': cell.props.borders ? undefined : defaultBorder,
          'fo:border-top': cell.props.borders ? formatOdfBorder(cell.props.borders.top) : undefined,
          'fo:border-bottom': cell.props.borders ? formatOdfBorder(cell.props.borders.bottom) : undefined,
          'fo:border-left': cell.props.borders ? formatOdfBorder(cell.props.borders.left) : undefined,
          'fo:border-right': cell.props.borders ? formatOdfBorder(cell.props.borders.right) : undefined,
          'fo:background-color': cell.props.shading && cell.props.shading.fill !== 'auto' ? `#${cell.props.shading.fill}` : undefined,
          'style:vertical-align': cell.props.verticalAlign === 'center' ? 'middle' : cell.props.verticalAlign,
          'fo:padding': '0.1cm',
        };
        const cellStyle = this.auto('table-cell', 'Tab', [el('style:table-cell-properties', cellAttrs)]);
        cells.push(el('table:table-cell', {
          'table:style-name': cellStyle, 'office:value-type': 'string',
          'table:number-columns-spanned': span > 1 ? span : undefined, 'table:number-rows-spanned': rowSpan > 1 ? rowSpan : undefined,
        }, this.blocks(cell.blocks)));
        for (let i = 1; i < span; i++) cells.push(el('table:covered-table-cell'));
      }
      (row.props.header ? headerRows : bodyRows).push(el('table:table-row', {}, cells));
    }
    return el('table:table', { 'table:name': t.props.caption ?? name, 'table:style-name': tableStyle }, [
      ...columns,
      ...(headerRows.length ? [el('table:table-header-rows', {}, headerRows)] : []),
      ...bodyRows,
    ]);
  }

  /** Blocs ; les paragraphes de liste consecutifs sont regroupes en text:list imbriquees. */
  blocks(blocks: readonly Block[]): XmlElement[] {
    const out: XmlElement[] = [];
    let i = 0;
    while (i < blocks.length) {
      const block = blocks[i];
      if (!block) break;
      if (block.type === 'paragraph') {
        const numbering = effectiveParagraphProps(this.doc, block).numbering;
        if (numbering && numbering.numId) {
          const run: Paragraph[] = [];
          while (i < blocks.length) {
            const b = blocks[i];
            const n = b?.type === 'paragraph' ? effectiveParagraphProps(this.doc, b).numbering : undefined;
            if (!b || b.type !== 'paragraph' || !n || n.numId !== numbering.numId) break;
            run.push(b);
            i++;
          }
          out.push(this.list(run, numbering.numId));
          continue;
        }
        out.push(this.paragraph(block));
      } else if (block.type === 'table') out.push(this.table(block));
      else if (block.type === 'toc') {
        out.push(el('text:table-of-content', { 'text:name': 'Table des matières1', 'text:protected': 'true' }, [
          el('text:table-of-content-source', { 'text:outline-level': 3 }),
          el('text:index-body', {}, this.blocks(block.blocks)),
        ]));
      } else if (block.type === 'contentControl') out.push(...this.blocks(block.blocks));
      i++;
    }
    return out;
  }

  private list(paragraphs: Paragraph[], numId: number): XmlElement {
    const root = el('text:list', { 'text:style-name': this.listStyle(numId) });
    const level = (p: Paragraph): number => effectiveParagraphProps(this.doc, p).numbering?.level ?? 0;
    for (const p of paragraphs) {
      let parent = root;
      for (let l = 0; l < level(p); l++) {
        let item = parent.children[parent.children.length - 1];
        if (!item || typeof item === 'string') {
          item = el('text:list-item');
          parent.children.push(item);
        }
        let sub = item.children.find((c): c is XmlElement => typeof c !== 'string' && c.name === 'text:list');
        if (!sub) {
          sub = el('text:list');
          item.children.push(sub);
        }
        parent = sub;
      }
      parent.children.push(el('text:list-item', {}, [this.paragraph(p)]));
    }
    return root;
  }

  // ---- Parties ----

  private namedStyles(): XmlElement[] {
    const out: XmlElement[] = [];
    const defaults = this.doc.styles.docDefaults;
    const defaultRun = { ...defaults.run, font: defaults.run.fontTheme ? (defaults.run.fontTheme === 'major' ? this.doc.theme.majorFont : this.doc.theme.minorFont) : defaults.run.font };
    delete defaultRun.fontTheme;
    out.push(el('style:default-style', { 'style:family': 'paragraph' }, this.paragraphKids(defaults.paragraph, defaultRun)));
    for (const style of this.doc.styles.styles) {
      if (style.type !== 'paragraph') continue;
      const run = style.run ? { ...style.run } : undefined;
      if (run?.fontTheme) {
        run.font = run.fontTheme === 'major' ? this.doc.theme.majorFont : this.doc.theme.minorFont;
        delete run.fontTheme;
      }
      const level = style.paragraph?.outlineLevel;
      out.push(el('style:style', {
        'style:name': odfName(style.id === 'Normal' ? 'Standard' : style.name),
        'style:display-name': style.id === 'Normal' ? undefined : style.name,
        'style:family': 'paragraph',
        'style:parent-style-name': style.basedOn && style.basedOn !== style.id ? this.styleRef(style.basedOn) : undefined,
        'style:next-style-name': style.next ? this.styleRef(style.next) : undefined,
        'style:default-outline-level': level !== undefined && level < 9 ? level + 1 : undefined,
        'style:class': level !== undefined && level < 9 ? 'text' : undefined,
      }, this.paragraphKids(style.paragraph ?? {}, run)));
    }
    return out;
  }

  private pageLayout(section: Section): XmlElement {
    const m = section.margins;
    const cols = section.columns.count > 1
      ? [el('style:columns', { 'fo:column-count': section.columns.count, 'fo:column-gap': fmtCm(section.columns.space) })]
      : [];
    return el('style:page-layout', { 'style:name': 'pm1' }, [
      el('style:page-layout-properties', {
        'fo:page-width': fmtCm(section.pageWidth), 'fo:page-height': fmtCm(section.pageHeight),
        'style:print-orientation': section.orientation, 'fo:margin-top': fmtCm(m.header || m.top), 'fo:margin-bottom': fmtCm(m.footer || m.bottom),
        'fo:margin-left': fmtCm(m.left), 'fo:margin-right': fmtCm(m.right), 'style:writing-mode': 'lr-tb',
      }, cols),
      el('style:header-style', {}, [el('style:header-footer-properties', { 'fo:min-height': '0cm', 'fo:margin-bottom': fmtCm(Math.max(0, m.top - m.header - 14)) })]),
      el('style:footer-style', {}, [el('style:header-footer-properties', { 'fo:min-height': '0cm', 'fo:margin-top': fmtCm(Math.max(0, m.bottom - m.footer - 14)) })]),
    ]);
  }

  private masterPage(section: Section): XmlElement {
    const kids: XmlElement[] = [];
    const add = (tag: string, id: string | undefined): void => {
      const hf = id ? this.doc.headersFooters[id] : undefined;
      if (hf) kids.push(el(tag, {}, this.blocks(hf.blocks)));
    };
    add('style:header', section.headers.default);
    if (this.doc.settings.evenAndOddHeaders) add('style:header-left', section.headers.even);
    if (section.titlePage) add('style:header-first', section.headers.first);
    add('style:footer', section.footers.default);
    if (this.doc.settings.evenAndOddHeaders) add('style:footer-left', section.footers.even);
    if (section.titlePage) add('style:footer-first', section.footers.first);
    return el('style:master-page', { 'style:name': 'Standard', 'style:page-layout-name': 'pm1' }, kids);
  }

  private meta(): XmlElement {
    const p = this.doc.properties;
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, '');
    const text = (tag: string, value: string | undefined): XmlElement[] => (value ? [el(tag, {}, [value])] : []);
    return el('office:document-meta', NS, [el('office:meta', {}, [
      el('meta:generator', {}, ['ForgeOffice Texte']),
      ...text('dc:title', p.title),
      ...text('dc:description', p.description),
      ...text('dc:subject', p.subject),
      ...(p.keywords ? p.keywords.split(/\s*[,;]\s*/).filter(Boolean).map((k) => el('meta:keyword', {}, [k])) : []),
      ...text('meta:initial-creator', p.creator),
      ...text('dc:creator', p.lastModifiedBy ?? p.creator),
      el('meta:creation-date', {}, [p.created?.replace(/Z$/, '') ?? now]),
      el('dc:date', {}, [p.modified?.replace(/Z$/, '') ?? now]),
      ...text('dc:language', p.language ?? this.doc.settings.language),
      ...Object.entries(p.custom).map(([name, value]) => el('meta:user-defined', { 'meta:name': name }, [value])),
    ])]);
  }

  async write(): Promise<Uint8Array> {
    const body = this.blocks(this.doc.body);
    const named = this.namedStyles();
    const section = this.doc.finalSection;
    const master = this.masterPage(section);
    const fontDecls = el('office:font-face-decls', {}, [...this.fonts, this.doc.theme.minorFont, this.doc.theme.majorFont]
      .filter((f, i, a) => a.indexOf(f) === i)
      .map((f) => el('style:font-face', { 'style:name': f, 'svg:font-family': f.includes(' ') ? `'${f}'` : f })));
    const content = el('office:document-content', NS, [
      fontDecls,
      el('office:automatic-styles', {}, this.autoStyles),
      el('office:body', {}, [el('office:text', {}, body.length ? body : [el('text:p')])]),
    ]);
    const styles = el('office:document-styles', NS, [
      fontDecls,
      el('office:styles', {}, named),
      el('office:automatic-styles', {}, [this.pageLayout(section)]),
      el('office:master-styles', {}, [master]),
    ]);
    const manifestEntries = [
      el('manifest:file-entry', { 'manifest:full-path': '/', 'manifest:version': '1.3', 'manifest:media-type': 'application/vnd.oasis.opendocument.text' }),
      el('manifest:file-entry', { 'manifest:full-path': 'content.xml', 'manifest:media-type': 'text/xml' }),
      el('manifest:file-entry', { 'manifest:full-path': 'styles.xml', 'manifest:media-type': 'text/xml' }),
      el('manifest:file-entry', { 'manifest:full-path': 'meta.xml', 'manifest:media-type': 'text/xml' }),
    ];
    const zip = new JSZip();
    zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
    zip.file('content.xml', serializeXml(content));
    zip.file('styles.xml', serializeXml(styles));
    zip.file('meta.xml', serializeXml(this.meta()));
    for (const [mediaId, path] of this.pictures) {
      const media = this.doc.media[mediaId];
      if (!media) continue;
      zip.file(path, media.bytes);
      manifestEntries.push(el('manifest:file-entry', { 'manifest:full-path': path, 'manifest:media-type': media.contentType }));
    }
    zip.file('META-INF/manifest.xml', serializeXml(el('manifest:manifest', { 'xmlns:manifest': 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0', 'manifest:version': '1.3' }, manifestEntries)));
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.oasis.opendocument.text' });
  }
}

function stripNoteMark(inlines: readonly Inline[]): Inline[] {
  const out = inlines.filter((i) => i.type !== 'noteMark');
  const first = out[0];
  if (first?.type === 'text' && first.text.startsWith(' ')) out[0] = { ...first, text: first.text.slice(1) };
  return out;
}

/** Ecrit le document au format OpenDocument Texte. */
export function writeOdt(doc: WordDocument): Promise<Uint8Array> {
  return new OdtWriter(doc).write();
}
