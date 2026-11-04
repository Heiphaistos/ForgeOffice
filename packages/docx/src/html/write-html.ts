// Export HTML : page autonome (CSS des styles, mise en forme en ligne, images data:, notes, table des matieres).
// Tout texte venant du document est echappe ; les liens dangereux sont retires.
import type { Block, Inline, Paragraph, ParagraphProps, RunProps, Table, WordDocument } from '../model.ts';
import { cssFontStack } from '../blank.ts';
import { computeListLabels, effectiveParagraphProps, effectiveRunProps, numberingLevel } from '../resolve.ts';
import { sanitizeUrl } from '../security.ts';
import { GENERATED } from '../strings.ts';
import { HIGHLIGHT_RGB } from '../rtf/header.ts';

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const UNDERLINE_CSS: Readonly<Record<string, string>> = { double: 'double', dotted: 'dotted', dash: 'dashed', wave: 'wavy', wavyDouble: 'wavy' };

export function runCss(props: RunProps, doc: WordDocument): string[] {
  const css: string[] = [];
  const font = props.fontTheme ? (props.fontTheme === 'major' ? doc.theme.majorFont : doc.theme.minorFont) : props.font;
  if (font) css.push(`font-family:${cssFontStack(font)}`);
  if (props.size !== undefined) css.push(`font-size:${props.size}pt`);
  if (props.bold !== undefined) css.push(`font-weight:${props.bold ? 'bold' : 'normal'}`);
  if (props.italic !== undefined) css.push(`font-style:${props.italic ? 'italic' : 'normal'}`);
  const decorations: string[] = [];
  if (props.underline && props.underline !== 'none') decorations.push('underline');
  if (props.strike || props.doubleStrike) decorations.push('line-through');
  if (decorations.length) {
    css.push(`text-decoration:${decorations.join(' ')}`);
    const style = props.underline ? UNDERLINE_CSS[props.underline] : props.doubleStrike ? 'double' : undefined;
    if (style) css.push(`text-decoration-style:${style}`);
  }
  if (props.color && props.color.rgb !== 'auto') css.push(`color:#${props.color.rgb}`);
  if (props.highlight && props.highlight !== 'none') css.push(`background-color:#${HIGHLIGHT_RGB[props.highlight]}`);
  else if (props.shading && props.shading.fill !== 'auto') css.push(`background-color:#${props.shading.fill}`);
  if (props.vertAlign === 'superscript') css.push('vertical-align:super', 'font-size:smaller');
  if (props.vertAlign === 'subscript') css.push('vertical-align:sub', 'font-size:smaller');
  if (props.caps) css.push('text-transform:uppercase');
  if (props.smallCaps) css.push('font-variant:small-caps');
  if (props.spacing) css.push(`letter-spacing:${props.spacing}pt`);
  if (props.hidden) css.push('display:none');
  return css;
}

export function paragraphCss(props: ParagraphProps): string[] {
  const css: string[] = [];
  if (props.alignment) css.push(`text-align:${props.alignment === 'distribute' ? 'justify' : props.alignment}`);
  if (props.indentLeft) css.push(`margin-left:${props.indentLeft}pt`);
  if (props.indentRight) css.push(`margin-right:${props.indentRight}pt`);
  if (props.indentFirstLine) css.push(`text-indent:${props.indentFirstLine}pt`);
  if (props.spacingBefore !== undefined) css.push(`margin-top:${props.spacingBefore}pt`);
  if (props.spacingAfter !== undefined) css.push(`margin-bottom:${props.spacingAfter}pt`);
  const line = props.lineSpacing;
  if (line) css.push(`line-height:${line.rule === 'auto' ? Math.round(line.value * 115) / 100 : `${line.value}pt`}`);
  if (props.pageBreakBefore) css.push('break-before:page');
  if (props.shading && props.shading.fill !== 'auto') css.push(`background-color:#${props.shading.fill}`);
  const b = props.borders;
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    const border = b?.[side];
    if (border && border.style !== 'none') css.push(`border-${side}:${Math.max(0.5, border.width)}pt ${border.style === 'double' ? 'double' : border.style === 'dotted' ? 'dotted' : border.style === 'dashed' ? 'dashed' : 'solid'} ${border.color === 'auto' ? 'currentColor' : `#${border.color}`}`);
  }
  if (props.bidi) css.push('direction:rtl');
  return css;
}

const styleAttr = (css: string[]): string => (css.length ? ` style="${escapeHtml(css.join(';'))}"` : '');
const cssClass = (id: string): string => `s-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`;

const OL_TYPES: Readonly<Record<string, string>> = { lowerLetter: 'a', upperLetter: 'A', lowerRoman: 'i', upperRoman: 'I' };

class HtmlWriter {
  private readonly doc: WordDocument;
  private readonly notes: { id: number; html: string }[] = [];
  private readonly labels: Map<Paragraph, string>;
  private readonly usedStyles = new Set<string>();

  constructor(doc: WordDocument) {
    this.doc = doc;
    this.labels = computeListLabels(doc);
  }

  inlines(inlines: readonly Inline[], paragraph: Paragraph): string {
    let s = '';
    for (const inline of inlines) {
      if ('revision' in inline && inline.revision) {
        const deleted = inline.revision.kind === 'delete' || inline.revision.kind === 'moveFrom';
        const inner = this.inlines([{ ...inline, revision: undefined } as Inline], paragraph);
        s += deleted ? `<del>${inner}</del>` : `<ins>${inner}</ins>`;
        continue;
      }
      switch (inline.type) {
        case 'text': {
          const styleRun = inline.styleId ? effectiveRunProps(this.doc, { styleId: undefined }, { styleId: inline.styleId, props: {} }) : {};
          const css = runCss({ ...styleRun, ...inline.props }, this.doc);
          let text = escapeHtml(inline.text).replace(/\n/g, '<br>');
          if (inline.props.bold) text = `<strong>${text}</strong>`;
          if (inline.props.italic) text = `<em>${text}</em>`;
          const rest = css.filter((c) => !c.startsWith('font-weight') && !c.startsWith('font-style'));
          s += rest.length ? `<span${styleAttr(rest)}>${text}</span>` : text;
          break;
        }
        case 'tab': s += '<span class="tab">\t</span>'; break;
        case 'break': s += inline.kind === 'page' ? '<br class="page-break">' : '<br>'; break;
        case 'symbol': s += `&#${Number.parseInt(inline.char, 16) & 0xffff};`; break;
        case 'hyperlink': {
          const url = sanitizeUrl(inline.url);
          const href = url ?? (inline.anchor ? `#${inline.anchor}` : undefined);
          const inner = this.inlines(inline.inlines, paragraph);
          s += href ? `<a href="${escapeHtml(href)}"${inline.tooltip ? ` title="${escapeHtml(inline.tooltip)}"` : ''}${url ? ' rel="noopener noreferrer"' : ''}>${inner}</a>` : inner;
          break;
        }
        case 'field': s += this.inlines(inline.result, paragraph); break;
        case 'image': {
          const media = this.doc.media[inline.mediaId];
          if (!media || !/^image\/(png|jpeg|gif|bmp|webp|svg\+xml)$/.test(media.contentType)) break;
          let binary = '';
          for (let i = 0; i < media.bytes.length; i += 0x8000) binary += String.fromCharCode(...media.bytes.subarray(i, i + 0x8000));
          const float = inline.floating ? `;float:${inline.floating.horizontal.align === 'right' ? 'right' : 'left'};margin:0 9pt 6pt 0` : '';
          s += `<img src="data:${media.contentType};base64,${btoa(binary)}" alt="${escapeHtml(inline.alt ?? '')}"${inline.title ? ` title="${escapeHtml(inline.title)}"` : ''} style="width:${inline.width}pt;height:${inline.height}pt${float}">`;
          break;
        }
        case 'shape': if (inline.text) s += `<span class="text-box">${this.blocks(inline.text)}</span>`; break;
        case 'footnoteRef':
        case 'endnoteRef': {
          const list = inline.type === 'footnoteRef' ? this.doc.footnotes : this.doc.endnotes;
          const note = list.find((n) => n.id === inline.noteId);
          if (!note) break;
          const number = this.notes.length + 1;
          const html = this.blocks(note.blocks.map((b) => (b.type === 'paragraph' ? { ...b, inlines: b.inlines.filter((i) => i.type !== 'noteMark') } : b)));
          this.notes.push({ id: number, html });
          s += `<sup><a href="#note-${number}" id="ref-${number}">${escapeHtml(inline.customMark ?? String(number))}</a></sup>`;
          break;
        }
        case 'bookmarkStart': if (!inline.name.startsWith('_')) s += `<a id="${escapeHtml(inline.name)}"></a>`; break;
        case 'inlineControl': s += this.inlines(inline.inlines, paragraph); break;
        case 'equation': s += `<span class="equation">${escapeHtml(inline.text)}</span>`; break;
        default: break;
      }
    }
    return s;
  }

  private paragraph(p: Paragraph, inList: boolean): string {
    const effective = effectiveParagraphProps(this.doc, p);
    const level = effective.outlineLevel;
    const tag = level !== undefined && level < 6 && !inList ? `h${level + 1}` : inList ? 'span' : 'p';
    if (p.styleId) this.usedStyles.add(p.styleId);
    const direct = { ...p.props };
    delete direct.numbering;
    if (inList) {
      delete direct.indentLeft;
      delete direct.indentFirstLine;
    }
    const cls = p.styleId ? ` class="${cssClass(p.styleId)}"` : '';
    const content = this.inlines(p.inlines, p);
    return `<${tag}${cls}${styleAttr(paragraphCss(direct))}>${content || (inList ? '' : '<br>')}</${tag}>`;
  }

  private table(t: Table): string {
    let s = '<table>';
    if (t.props.caption) s += `<caption>${escapeHtml(t.props.caption)}</caption>`;
    s += `<colgroup>${t.grid.map((w) => `<col style="width:${w}pt">`).join('')}</colgroup>`;
    t.rows.forEach((row, r) => {
      s += '<tr>';
      let col = 0;
      for (const cell of row.cells) {
        const span = cell.props.gridSpan ?? 1;
        if (cell.props.vMerge === 'continue') {
          col += span;
          continue;
        }
        let rowspan = 1;
        if (cell.props.vMerge === 'restart') {
          for (let below = r + 1; below < t.rows.length; below++) {
            let c = 0;
            const next = t.rows[below]?.cells.find((x) => { const hit = c === col; c += x.props.gridSpan ?? 1; return hit; });
            if (next?.props.vMerge !== 'continue') break;
            rowspan++;
          }
        }
        const tag = row.props.header ? 'th' : 'td';
        const css: string[] = [];
        if (cell.props.shading && cell.props.shading.fill !== 'auto') css.push(`background-color:#${cell.props.shading.fill}`);
        if (cell.props.verticalAlign) css.push(`vertical-align:${cell.props.verticalAlign === 'center' ? 'middle' : cell.props.verticalAlign}`);
        s += `<${tag}${span > 1 ? ` colspan="${span}"` : ''}${rowspan > 1 ? ` rowspan="${rowspan}"` : ''}${styleAttr(css)}>${this.blocks(cell.blocks)}</${tag}>`;
        col += span;
      }
      s += '</tr>';
    });
    return `${s}</table>`;
  }

  private list(paragraphs: Paragraph[]): string {
    let s = '';
    const stack: { tag: string; level: number }[] = [];
    for (const p of paragraphs) {
      const numbering = effectiveParagraphProps(this.doc, p).numbering;
      const level = numbering?.level ?? 0;
      const def = numbering ? numberingLevel(this.doc, numbering.numId, level) : undefined;
      const tag = def?.format === 'bullet' ? 'ul' : 'ol';
      while (stack.length && (stack[stack.length - 1]?.level ?? 0) > level) s += `</li></${stack.pop()?.tag}>`;
      const top = stack[stack.length - 1];
      if (!top || top.level < level) {
        const type = def ? OL_TYPES[def.format] : undefined;
        const label = this.labels.get(p);
        const start = tag === 'ol' && label ? Number.parseInt(label, 10) : Number.NaN;
        s += `<${tag}${type ? ` type="${type}"` : ''}${Number.isFinite(start) && start !== 1 ? ` start="${start}"` : ''}>`;
        stack.push({ tag, level });
      } else s += '</li>';
      s += `<li>${this.paragraph(p, true)}`;
    }
    while (stack.length) s += `</li></${stack.pop()?.tag}>`;
    return s;
  }

  blocks(blocks: readonly Block[]): string {
    let s = '';
    let i = 0;
    while (i < blocks.length) {
      const block = blocks[i];
      if (!block) break;
      if (block.type === 'paragraph' && effectiveParagraphProps(this.doc, block).numbering?.numId) {
        const run: Paragraph[] = [];
        while (i < blocks.length) {
          const b = blocks[i];
          if (!b || b.type !== 'paragraph' || !effectiveParagraphProps(this.doc, b).numbering?.numId) break;
          run.push(b);
          i++;
        }
        s += this.list(run);
        continue;
      }
      if (block.type === 'paragraph') s += this.paragraph(block, false);
      else if (block.type === 'table') s += this.table(block);
      else if (block.type === 'toc') s += `<nav class="toc" aria-label="${escapeHtml(GENERATED.tocTitle)}">${this.blocks(block.blocks)}</nav>`;
      else if (block.type === 'contentControl') s += this.blocks(block.blocks);
      i++;
    }
    return s;
  }

  write(): string {
    const doc = this.doc;
    const body = this.blocks(doc.body);
    const notes = this.notes.length
      ? `<section class="notes"><hr><ol>${this.notes.map((n) => `<li id="note-${n.id}">${n.html} <a href="#ref-${n.id}" aria-label="Retour">↩</a></li>`).join('')}</ol></section>`
      : '';
    const base = runCss(effectiveRunProps(doc, { styleId: undefined }, { props: {} }), doc);
    const basePara = paragraphCss(effectiveParagraphProps(doc, { props: {} }));
    const styleRules = [...this.usedStyles].map((id) => {
      const css = [
        ...paragraphCss(effectiveParagraphProps(doc, { styleId: id, props: {} })),
        ...runCss(effectiveRunProps(doc, { styleId: id }, { props: {} }), doc),
      ];
      return `.${cssClass(id)}{${css.join(';')}}`;
    });
    const section = doc.finalSection;
    const title = escapeHtml(doc.properties.title ?? GENERATED.untitled);
    const meta = [
      doc.properties.creator ? `<meta name="author" content="${escapeHtml(doc.properties.creator)}">` : '',
      doc.properties.description ? `<meta name="description" content="${escapeHtml(doc.properties.description)}">` : '',
      doc.properties.keywords ? `<meta name="keywords" content="${escapeHtml(doc.properties.keywords)}">` : '',
    ].join('');
    const css = [
      `body{${base.join(';')};max-width:${section.pageWidth - section.margins.left - section.margins.right}pt;margin:2em auto;padding:0 1em}`,
      `p,h1,h2,h3,h4,h5,h6{${basePara.join(';')}}`,
      'table{border-collapse:collapse;margin:0 0 8pt}td,th{border:0.5pt solid #000;padding:2pt 5.4pt;vertical-align:top}',
      'td>p,th>p{margin:0}.tab{white-space:pre;display:inline-block;min-width:2em}.page-break{break-after:page}',
      '.notes{font-size:smaller}.equation{font-family:"Cambria Math",serif;font-style:italic}li>span{display:inline}',
      ...styleRules,
    ].join('\n');
    const lang = escapeHtml(doc.settings.language ?? 'fr-FR');
    return `<!DOCTYPE html>\n<html lang="${lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="generator" content="ForgeOffice Texte">\n<title>${title}</title>${meta}\n<style>\n${css}\n</style>\n</head>\n<body>\n${body}\n${notes}\n</body>\n</html>\n`;
  }
}

/** Page HTML autonome du document. */
export function documentToHtml(doc: WordDocument): string {
  return new HtmlWriter(doc).write();
}

export function writeHtml(doc: WordDocument): Uint8Array {
  return new TextEncoder().encode(documentToHtml(doc));
}
