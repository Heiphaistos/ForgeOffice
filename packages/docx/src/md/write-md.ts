// Export Markdown (CommonMark + GFM) : titres, emphase, code, listes imbriquees, citations, tableaux,
// liens, images data:, notes de bas de page, regles horizontales.
import type { Block, Inline, Paragraph, RunProps, Table, WordDocument } from '../model.ts';
import { computeListLabels, effectiveParagraphProps, effectiveRunProps, numberingLevel } from '../resolve.ts';
import { sanitizeUrl } from '../security.ts';
import { inlinesText } from '../text.ts';

const MONO = /consol|courier|mono|menlo|code/i;

/** Echappe les caracteres qui auraient un sens Markdown. */
export function escapeMarkdown(text: string, atLineStart = false): string {
  let out = text.replace(/([\\`*_[\]<>|~])/g, '\\$1');
  if (atLineStart) out = out.replace(/^(\s*)([#+-]|\d+[.)])(\s)/, '$1\\$2$3').replace(/^(\s*)(=+|-+)\s*$/, '$1\\$2');
  return out;
}

export interface WriteMarkdownOptions {
  /** Integrer les images en data: (defaut : vrai). Sinon, seul le texte de remplacement est ecrit. */
  embedImages?: boolean;
}

class MdWriter {
  private readonly doc: WordDocument;
  private readonly options: WriteMarkdownOptions;
  private readonly labels: Map<Paragraph, string>;
  private readonly notes: string[] = [];

  constructor(doc: WordDocument, options: WriteMarkdownOptions) {
    this.doc = doc;
    this.options = options;
    this.labels = computeListLabels(doc);
  }

  private isCode(props: RunProps): boolean {
    return MONO.test(props.font ?? '');
  }

  inlines(inlines: readonly Inline[], paragraph: Paragraph, lineStart = true): string {
    let s = '';
    for (const inline of inlines) {
      if ('revision' in inline && inline.revision && (inline.revision.kind === 'delete' || inline.revision.kind === 'moveFrom')) continue;
      const atStart = lineStart && s === '';
      switch (inline.type) {
        case 'text': {
          const props = inline.styleId ? { ...effectiveRunProps(this.doc, { styleId: undefined }, { styleId: inline.styleId, props: {} }), ...inline.props } : inline.props;
          s += this.formatText(inline.text, props, atStart);
          break;
        }
        case 'tab': s += '\t'; break;
        case 'break': s += inline.kind === 'line' ? '\\\n' : ''; break;
        case 'symbol': s += String.fromCodePoint(Number.parseInt(inline.char, 16) || 0x20); break;
        case 'hyperlink': {
          const url = sanitizeUrl(inline.url) ?? (inline.anchor ? `#${inline.anchor}` : undefined);
          const text = this.inlines(inline.inlines, paragraph, false);
          s += url ? `[${text}](${url.replace(/[()\s]/g, (c) => encodeURIComponent(c))}${inline.tooltip ? ` "${inline.tooltip.replace(/"/g, '\\"')}"` : ''})` : text;
          break;
        }
        case 'field': s += this.inlines(inline.result, paragraph, atStart); break;
        case 'image': {
          const media = this.doc.media[inline.mediaId];
          const alt = (inline.alt ?? '').replace(/[[\]]/g, '');
          if (media && this.options.embedImages !== false && media.contentType.startsWith('image/')) {
            let binary = '';
            for (let i = 0; i < media.bytes.length; i += 0x8000) binary += String.fromCharCode(...media.bytes.subarray(i, i + 0x8000));
            s += `![${alt}](data:${media.contentType};base64,${btoa(binary)})`;
          } else if (alt) s += `[${alt}]`;
          break;
        }
        case 'footnoteRef':
        case 'endnoteRef': {
          const list = inline.type === 'footnoteRef' ? this.doc.footnotes : this.doc.endnotes;
          const note = list.find((n) => n.id === inline.noteId);
          if (!note) break;
          const label = this.notes.length + 1;
          const body = note.blocks.filter((b): b is Paragraph => b.type === 'paragraph')
            .map((p) => this.inlines(p.inlines.filter((i) => i.type !== 'noteMark'), p, false).trim()).join('\n    ');
          this.notes.push(`[^${label}]: ${body}`);
          s += `[^${label}]`;
          break;
        }
        case 'inlineControl': s += this.inlines(inline.inlines, paragraph, atStart); break;
        case 'equation': s += `$${inline.text}$`; break;
        case 'shape': if (inline.text) s += inlinesText(inline.text.flatMap((b) => (b.type === 'paragraph' ? b.inlines : []))); break;
        default: break;
      }
    }
    return s;
  }

  private formatText(text: string, props: RunProps, atStart: boolean): string {
    if (!text) return '';
    if (this.isCode(props)) {
      const ticks = text.includes('`') ? '``' : '`';
      return `${ticks}${text.includes('`') ? ` ${text} ` : text}${ticks}`;
    }
    // Les blancs de bord restent hors des delimiteurs (sinon l'emphase n'est pas reconnue).
    const lead = text.match(/^\s*/)?.[0] ?? '';
    const trail = text.slice(lead.length).match(/\s*$/)?.[0] ?? '';
    const core = text.slice(lead.length, text.length - trail.length);
    if (!core) return text;
    let body = escapeMarkdown(core, atStart && !lead);
    if (props.strike || props.doubleStrike) body = `~~${body}~~`;
    if (props.bold && props.italic) body = `***${body}***`;
    else if (props.bold) body = `**${body}**`;
    else if (props.italic) body = `*${body}*`;
    if (props.highlight && props.highlight !== 'none') body = `==${body}==`;
    if (props.vertAlign === 'superscript') body = `<sup>${body}</sup>`;
    if (props.vertAlign === 'subscript') body = `<sub>${body}</sub>`;
    if (props.underline && props.underline !== 'none' && !props.bold) body = `<u>${body}</u>`;
    return `${lead}${body}${trail}`;
  }

  private paragraphText(p: Paragraph): string {
    return this.inlines(p.inlines, p).replace(/\s+$/, '');
  }

  private isCodeParagraph(p: Paragraph): boolean {
    if (p.styleId === 'Code' || p.styleId === 'HTMLPreformatted') return true;
    const runs = p.inlines.filter((i) => i.type === 'text');
    return runs.length > 0 && runs.every((r) => r.type === 'text' && this.isCode(effectiveRunProps(this.doc, p, r)));
  }

  private table(t: Table): string {
    const columns = Math.max(1, ...t.rows.map((r) => r.cells.reduce((a, c) => a + (c.props.gridSpan ?? 1), 0)));
    const cellText = (blocks: Block[]): string => blocks.filter((b): b is Paragraph => b.type === 'paragraph')
      .map((p) => this.inlines(p.inlines, p, false).replace(/\\\n/g, '<br>').replace(/\n/g, ' ')).join('<br>').replace(/\|/g, '\\|');
    const rows = t.rows.map((row) => {
      const cells: string[] = [];
      for (const cell of row.cells) {
        cells.push(cell.props.vMerge === 'continue' ? '' : cellText(cell.blocks));
        for (let i = 1; i < (cell.props.gridSpan ?? 1); i++) cells.push('');
      }
      while (cells.length < columns) cells.push('');
      return `| ${cells.join(' | ')} |`;
    });
    const firstRow = t.rows[0];
    const aligns = Array.from({ length: columns }, (_, c) => {
      const p = firstRow?.cells[c]?.blocks[0];
      const align = p?.type === 'paragraph' ? p.props.alignment : undefined;
      return align === 'center' ? ':---:' : align === 'right' ? '---:' : '---';
    });
    const header = rows[0] ?? `|${' |'.repeat(columns)}`;
    return [header, `| ${aligns.join(' | ')} |`, ...rows.slice(1)].join('\n');
  }

  blocks(blocks: readonly Block[]): string[] {
    const out: string[] = [];
    let i = 0;
    while (i < blocks.length) {
      const block = blocks[i];
      if (!block) break;
      if (block.type === 'table') out.push(this.table(block));
      else if (block.type === 'toc' || block.type === 'contentControl') out.push(...this.blocks(block.blocks));
      else if (block.type === 'paragraph') {
        const effective = effectiveParagraphProps(this.doc, block);
        if (this.isCodeParagraph(block)) {
          const code: string[] = [];
          while (i < blocks.length) {
            const b = blocks[i];
            if (!b || b.type !== 'paragraph' || !this.isCodeParagraph(b)) break;
            code.push(inlinesText(b.inlines));
            i++;
          }
          out.push(`\`\`\`\n${code.join('\n')}\n\`\`\``);
          continue;
        }
        if (effective.numbering?.numId) {
          const lines: string[] = [];
          const indents: number[] = [];
          while (i < blocks.length) {
            const b = blocks[i];
            const n = b?.type === 'paragraph' ? effectiveParagraphProps(this.doc, b).numbering : undefined;
            if (!b || b.type !== 'paragraph' || !n?.numId) break;
            const def = numberingLevel(this.doc, n.numId, n.level);
            const marker = def?.format === 'bullet' ? '-' : `${Number.parseInt(this.labels.get(b) ?? '1', 10) || 1}.`;
            indents.length = n.level;
            const pad = indents.reduce((a, v) => a + v, 0);
            indents[n.level] = marker.length + 1;
            lines.push(`${' '.repeat(pad)}${marker} ${this.paragraphText(b)}`);
            i++;
          }
          out.push(lines.join('\n'));
          continue;
        }
        const text = this.paragraphText(block);
        const level = effective.outlineLevel;
        const isRule = !text && effective.borders?.bottom && effective.borders.bottom.style !== 'none';
        if (isRule) out.push('---');
        else if (level !== undefined && level < 6 && text) out.push(`${'#'.repeat(level + 1)} ${text.replace(/\\\n/g, ' ')}`);
        else if (block.styleId === 'Quote' || block.styleId === 'IntenseQuote') out.push(text.split('\n').map((l) => `> ${l}`).join('\n'));
        else if (text) out.push(text);
      }
      i++;
    }
    return out;
  }

  write(): string {
    const parts = this.blocks(this.doc.body);
    const title = this.doc.properties.title;
    const head = title && !parts[0]?.startsWith('# ') ? [`---\ntitle: "${title.replace(/"/g, '\\"')}"${this.doc.properties.creator ? `\nauthor: "${this.doc.properties.creator.replace(/"/g, '\\"')}"` : ''}\n---`] : [];
    return `${[...head, ...parts, ...(this.notes.length ? [this.notes.join('\n')] : [])].join('\n\n')}\n`;
  }
}

export function documentToMarkdown(doc: WordDocument, options: WriteMarkdownOptions = {}): string {
  return new MdWriter(doc, options).write();
}

export function writeMarkdown(doc: WordDocument, options: WriteMarkdownOptions = {}): Uint8Array {
  return new TextEncoder().encode(documentToMarkdown(doc, options));
}
