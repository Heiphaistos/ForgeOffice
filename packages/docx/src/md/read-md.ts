// Import Markdown (CommonMark + GFM) : titres ATX / Setext, emphase, barre, code, blocs de code, citations,
// listes imbriquees et taches, tableaux alignes, liens (references comprises), images data:, notes, regles.
import type { Block, Inline, NumberFormat, Paragraph, ReadResult, RunProps, Style, Table } from '../model.ts';
import { createBlankDocument } from '../blank.ts';
import { sniffImageType } from '../docx/ns.ts';
import { Budget, checkedUrl, DEFAULT_READ_LIMITS, Warnings, type ReadLimits } from '../security.ts';
import { WARNINGS } from '../strings.ts';
import { decodeHtmlEntities } from '../html/parse-html.ts';

/** Styles ajoutes au document pour le code. */
export const CODE_STYLE: Style = {
  id: 'Code', type: 'paragraph', name: 'Code', basedOn: 'Normal', custom: true, uiPriority: 99,
  paragraph: { spacingAfter: 0, lineSpacing: { rule: 'auto', value: 1 }, shading: { fill: 'F2F2F2', pattern: 'clear', color: 'auto' } },
  run: { font: 'Consolas', size: 10 },
};

export const CODE_RUN: RunProps = { font: 'Consolas', shading: { fill: 'F2F2F2', pattern: 'clear', color: 'auto' } };

interface ListMarker {
  ordered: boolean;
  start: number;
  indent: number;
  contentIndent: number;
  text: string;
}

const LIST_RE = /^( {0,12})([-*+]|(\d{1,9})[.)])( +|$)(.*)$/;

function listMarker(line: string): ListMarker | undefined {
  const m = line.match(LIST_RE);
  if (!m) return undefined;
  const indent = (m[1] ?? '').length;
  const marker = m[2] ?? '';
  const spaces = Math.min(4, (m[4] ?? '').length || 1);
  return { ordered: m[3] !== undefined, start: Number(m[3] ?? 1), indent, contentIndent: indent + marker.length + spaces, text: m[5] ?? '' };
}

const isBlank = (line: string): boolean => line.trim() === '';
const isHr = (line: string): boolean => /^ {0,3}([-*_])( *\1){2,} *$/.test(line);
const fence = (line: string): string | undefined => line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
const isTableSeparator = (line: string): boolean => /^ *\|? *:?-{1,}:? *(\| *:?-{1,}:? *)*\|? *$/.test(line) && line.includes('-');

function splitRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < row.length; i++) {
    const ch = row.charAt(i);
    if (ch === '\\' && row.charAt(i + 1) === '|') { current += '|'; i++; }
    else if (ch === '|') { cells.push(current.trim()); current = ''; }
    else current += ch;
  }
  cells.push(current.trim());
  return cells;
}

class MdReader {
  readonly doc = createBlankDocument();
  readonly warnings = new Warnings();
  readonly budget: Budget;
  private readonly refs = new Map<string, { url: string; title?: string }>();
  private readonly footnoteIds = new Map<string, number>();
  private readonly footnoteBodies = new Map<string, string[]>();
  private bulletAbstract?: number;
  private orderedAbstract?: number;
  private imageCount = 0;
  private codeStyleAdded = false;

  constructor(limits: ReadLimits) {
    this.budget = new Budget(limits, this.warnings);
  }

  /** Premiere passe : definitions de liens et de notes (retirees du texte). */
  collectDefinitions(lines: string[]): string[] {
    const out: string[] = [];
    let inFence: string | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const f = fence(line);
      if (f && (!inFence || f.startsWith(inFence))) inFence = inFence ? undefined : f.slice(0, 3);
      if (!inFence) {
        const note = line.match(/^\[\^([^\]]+)\]:\s?(.*)$/);
        if (note?.[1]) {
          const body = [note[2] ?? ''];
          while (i + 1 < lines.length && (/^( {4}|\t)/.test(lines[i + 1] ?? '') || (isBlank(lines[i + 1] ?? '') && /^( {4}|\t)/.test(lines[i + 2] ?? '')))) {
            i++;
            body.push((lines[i] ?? '').replace(/^( {4}|\t)/, ''));
          }
          this.footnoteBodies.set(note[1].toLowerCase(), body);
          continue;
        }
        const ref = line.match(/^ {0,3}\[([^\]^][^\]]*)\]:\s*<?([^\s>]+)>?(?:\s+["'(](.*)["')])?\s*$/);
        if (ref?.[1] && ref[2]) {
          this.refs.set(ref[1].toLowerCase(), ref[3] ? { url: ref[2], title: ref[3] } : { url: ref[2] });
          continue;
        }
      }
      out.push(line);
    }
    return out;
  }

  private numId(ordered: boolean, start: number, existing?: number): number {
    if (existing !== undefined) return existing;
    const numbering = this.doc.numbering;
    let abstractId = ordered ? this.orderedAbstract : this.bulletAbstract;
    if (abstractId === undefined) {
      abstractId = numbering.abstracts.length + 1;
      const bullets = ['•', 'o', '▪'];
      numbering.abstracts.push({
        id: abstractId, multiLevelType: 'hybridMultilevel',
        levels: Array.from({ length: 9 }, (_, level) => ({
          level, format: (ordered ? (['decimal', 'lowerLetter', 'lowerRoman'] as NumberFormat[])[level % 3] : 'bullet') as NumberFormat,
          text: ordered ? `%${level + 1}.` : bullets[level % 3] ?? '•', start: 1, alignment: 'left' as const, suffix: 'tab' as const,
          paragraph: { indentLeft: 36 * (level + 1), indentFirstLine: -18 },
        })),
      });
      if (ordered) this.orderedAbstract = abstractId;
      else this.bulletAbstract = abstractId;
    }
    const id = numbering.instances.length + 1;
    numbering.instances.push({ id, abstractId, overrides: ordered ? [{ level: 0, startOverride: start }] : [] });
    return id;
  }

  private ensureCodeStyle(): void {
    if (this.codeStyleAdded) return;
    this.codeStyleAdded = true;
    if (!this.doc.styles.styles.some((s) => s.id === 'Code')) this.doc.styles.styles.push({ ...CODE_STYLE });
  }

  private paragraph(inlines: Inline[], extra: Partial<Paragraph> = {}): Paragraph | undefined {
    if (!this.budget.takeBlock()) return undefined;
    return { type: 'paragraph', props: {}, inlines, ...extra };
  }

  /** Analyse un ensemble de lignes en blocs. `list` = contexte de liste parent. */
  blocks(lines: string[], depth: number, quote = false): Block[] {
    const out: Block[] = [];
    if (!this.budget.depthOk(depth)) return out;
    const push = (p: Paragraph | undefined): void => {
      if (!p) return;
      if (quote && !p.styleId) p.styleId = 'Quote';
      out.push(p);
    };
    let i = 0;
    while (i < lines.length) {
      const line = lines[i] ?? '';
      if (isBlank(line)) { i++; continue; }
      const f = fence(line);
      if (f) {
        const code: string[] = [];
        i++;
        while (i < lines.length && !(lines[i] ?? '').trimStart().startsWith(f)) code.push(lines[i++] ?? '');
        i++;
        this.ensureCodeStyle();
        const inlines: Inline[] = [];
        code.forEach((c, k) => {
          if (k > 0) inlines.push({ type: 'break', kind: 'line' });
          if (c) inlines.push({ type: 'text', text: c, props: {} });
        });
        push(this.paragraph(inlines, { styleId: 'Code' }));
        continue;
      }
      const atx = line.match(/^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/);
      if (atx) {
        push(this.paragraph(this.inlines(atx[2] ?? ''), { styleId: `Heading${(atx[1] ?? '#').length}` }));
        i++;
        continue;
      }
      if (isHr(line)) {
        push(this.paragraph([], { props: { borders: { bottom: { style: 'single', width: 0.75, color: 'auto', space: 1 } } } }));
        i++;
        continue;
      }
      if (/^ {0,3}>/.test(line)) {
        const inner: string[] = [];
        while (i < lines.length && !isBlank(lines[i] ?? '') && (/^ {0,3}>/.test(lines[i] ?? '') || inner.length)) {
          inner.push((lines[i] ?? '').replace(/^ {0,3}> ?/, ''));
          i++;
        }
        for (const b of this.blocks(inner, depth + 1, true)) out.push(b);
        continue;
      }
      if (line.includes('|') && isTableSeparator(lines[i + 1] ?? '')) {
        const header = splitRow(line);
        const aligns = splitRow(lines[i + 1] ?? '').map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : undefined));
        i += 2;
        const body: string[][] = [];
        while (i < lines.length && !isBlank(lines[i] ?? '') && (lines[i] ?? '').includes('|')) body.push(splitRow(lines[i++] ?? ''));
        out.push(this.table(header, aligns, body));
        continue;
      }
      const marker = listMarker(line);
      if (marker && (marker.text || isBlank(lines[i + 1] ?? '') === false)) {
        i = this.list(lines, i, depth, out, undefined, quote);
        continue;
      }
      if (/^( {4}|\t)/.test(line)) {
        const code: string[] = [];
        while (i < lines.length && (/^( {4}|\t)/.test(lines[i] ?? '') || (isBlank(lines[i] ?? '') && /^( {4}|\t)/.test(lines[i + 1] ?? '')))) {
          code.push((lines[i] ?? '').replace(/^( {4}|\t)/, ''));
          i++;
        }
        this.ensureCodeStyle();
        const inlines: Inline[] = [];
        code.forEach((c, k) => {
          if (k > 0) inlines.push({ type: 'break', kind: 'line' });
          if (c) inlines.push({ type: 'text', text: c, props: {} });
        });
        push(this.paragraph(inlines, { styleId: 'Code' }));
        continue;
      }
      // Paragraphe (eventuellement titre Setext).
      const text: string[] = [line];
      i++;
      while (i < lines.length) {
        const next = lines[i] ?? '';
        if (isBlank(next) || fence(next) || /^ {0,3}(#{1,6})(\s|$)/.test(next) || /^ {0,3}>/.test(next)) break;
        if (/^ {0,3}=+\s*$/.test(next) || (/^ {0,3}-+\s*$/.test(next) && text.length)) {
          push(this.paragraph(this.inlines(text.join('\n')), { styleId: next.trim().startsWith('=') ? 'Heading1' : 'Heading2' }));
          text.length = 0;
          i++;
          break;
        }
        if (isHr(next) || (listMarker(next) && listMarker(next)?.text)) break;
        text.push(next);
        i++;
      }
      if (text.length) push(this.paragraph(this.inlines(text.join('\n'))));
    }
    return out;
  }

  /** Liste a partir de la ligne `start` ; renvoie l'index de la ligne suivante. */
  private list(lines: string[], start: number, depth: number, out: Block[], parent: { numId: number; level: number } | undefined, quote: boolean): number {
    const first = listMarker(lines[start] ?? '');
    if (!first) return start + 1;
    const level = parent ? Math.min(8, parent.level + 1) : 0;
    const numId = this.numId(first.ordered, first.start);
    let i = start;
    while (i < lines.length) {
      const marker = listMarker(lines[i] ?? '');
      if (!marker || marker.indent < first.indent || marker.ordered !== first.ordered) break;
      if (marker.indent >= first.contentIndent) break;
      // Contenu de l'element : la ligne du marqueur + lignes de suite indentees.
      const item: string[] = [marker.text];
      i++;
      while (i < lines.length) {
        const next = lines[i] ?? '';
        if (isBlank(next)) {
          const after = lines[i + 1] ?? '';
          if (after.length - after.trimStart().length >= marker.contentIndent && !isBlank(after)) {
            item.push('');
            i++;
            continue;
          }
          break;
        }
        const nextMarker = listMarker(next);
        const indent = next.length - next.trimStart().length;
        if (nextMarker && nextMarker.indent < marker.contentIndent) break;
        if (!nextMarker && indent < marker.contentIndent && (isHr(next) || /^ {0,3}(#|>|```|~~~)/.test(next))) break;
        item.push(indent >= marker.contentIndent ? next.slice(marker.contentIndent) : next.trimStart());
        i++;
      }
      // Case a cocher GFM.
      let task: string | undefined;
      const head = item[0] ?? '';
      const taskMatch = head.match(/^\[([ xX])\]\s+(.*)$/);
      if (taskMatch) {
        task = taskMatch[1] === ' ' ? '☐ ' : '☒ ';
        item[0] = taskMatch[2] ?? '';
      }
      // Premiere ligne(s) jusqu'a une sous-liste : paragraphe de l'element.
      let k = 0;
      const own: string[] = [];
      while (k < item.length && !listMarker(item[k] ?? '') && !isBlank(item[k] ?? '')) own.push(item[k++] ?? '');
      const inlines = this.inlines(own.join('\n'));
      if (task) inlines.unshift({ type: 'text', text: task, props: {} });
      const paragraph = this.paragraph(inlines, { props: { numbering: { numId, level } } });
      if (paragraph) {
        if (quote) paragraph.styleId = 'Quote';
        out.push(paragraph);
      }
      // Reste : sous-listes et paragraphes de suite.
      const rest = item.slice(k);
      let r = 0;
      while (r < rest.length) {
        if (isBlank(rest[r] ?? '')) { r++; continue; }
        if (listMarker(rest[r] ?? '')) {
          r = this.list(rest, r, depth + 1, out, { numId, level }, quote);
          continue;
        }
        const chunk: string[] = [];
        while (r < rest.length && !isBlank(rest[r] ?? '') && !listMarker(rest[r] ?? '')) chunk.push(rest[r++] ?? '');
        for (const b of this.blocks(chunk, depth + 1, quote)) {
          if (b.type === 'paragraph') b.props.indentLeft = 36 * (level + 1);
          out.push(b);
        }
      }
      while (i < lines.length && isBlank(lines[i] ?? '') && listMarker(lines[i + 1] ?? '')?.indent === first.indent && listMarker(lines[i + 1] ?? '')?.ordered === first.ordered) i++;
    }
    return i;
  }

  private table(header: string[], aligns: (string | undefined)[], body: string[][]): Table {
    const columns = Math.max(header.length, ...body.map((r) => r.length));
    const row = (cells: string[], head: boolean): Table['rows'][number] => ({
      props: head ? { header: true } : {},
      cells: Array.from({ length: columns }, (_, c) => {
        const align = aligns[c];
        const inlines = this.inlines(cells[c] ?? '');
        if (head) for (const inline of inlines) if (inline.type === 'text') inline.props = { ...inline.props, bold: true };
        const paragraph: Paragraph = { type: 'paragraph', props: { spacingAfter: 0, ...(align ? { alignment: align as 'center' | 'right' } : {}) }, inlines };
        return { props: {}, blocks: [paragraph] };
      }),
    });
    return {
      type: 'table', styleId: 'TableGrid', props: { width: { value: 100, type: 'pct' } },
      grid: Array.from({ length: columns }, () => Math.round((450 / columns) * 100) / 100),
      rows: [row(header, true), ...body.map((r) => row(r, false))],
    };
  }

  // ---- En ligne ----

  private image(alt: string, url: string, title: string | undefined, out: Inline[], run: RunProps): void {
    const m = url.match(/^data:([a-z/+.-]+);base64,(.*)$/is);
    if (!m) {
      const safe = checkedUrl(url, this.warnings);
      if (safe) out.push({ type: 'hyperlink', url: safe, inlines: [{ type: 'text', text: alt || safe, props: { ...run } }] });
      this.warnings.add('image-skipped', WARNINGS.imageSkipped(url));
      return;
    }
    const base64 = (m[2] ?? '').replace(/\s+/g, '');
    if ((base64.length * 3) / 4 > this.budget.limits.maxImageBytes) return;
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    } catch {
      return;
    }
    const contentType = sniffImageType(bytes) ?? m[1] ?? '';
    if (!contentType.startsWith('image/')) return;
    this.imageCount += 1;
    const id = `image${this.imageCount}.${contentType.split('/')[1]?.replace('+xml', '').replace('x-', '') ?? 'png'}`;
    this.doc.media[id] = { id, fileName: id, contentType, bytes };
    const image: Inline = { type: 'image', mediaId: id, width: 300, height: 225 };
    if (alt) image.alt = alt;
    if (title) image.title = title;
    out.push(image);
  }

  private addText(out: Inline[], text: string, run: RunProps): void {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.type === 'text' && JSON.stringify(last.props) === JSON.stringify(run)) last.text += text;
    else out.push({ type: 'text', text, props: { ...run } });
  }

  private footnote(label: string, out: Inline[]): void {
    const key = label.toLowerCase();
    let id = this.footnoteIds.get(key);
    if (id === undefined) {
      id = this.footnoteIds.size + 1;
      this.footnoteIds.set(key, id);
      const body = this.footnoteBodies.get(key) ?? [];
      const blocks = this.blocks(body, 2);
      const first = blocks[0];
      if (first?.type === 'paragraph') first.inlines.unshift({ type: 'noteMark', kind: 'footnote' }, { type: 'text', text: ' ', props: {} });
      this.doc.footnotes.push({ id, blocks: blocks.length ? blocks : [{ type: 'paragraph', props: {}, inlines: [{ type: 'noteMark', kind: 'footnote' }] }] });
    }
    out.push({ type: 'footnoteRef', noteId: id });
  }

  inlines(source: string, run: RunProps = {}, depth = 0): Inline[] {
    const out: Inline[] = [];
    if (depth > 20) {
      this.addText(out, source, run);
      return out;
    }
    let i = 0;
    let text = '';
    const flush = (): void => {
      this.addText(out, decodeHtmlEntities(text), run);
      text = '';
    };
    while (i < source.length) {
      const ch = source.charAt(i);
      const rest = source.slice(i);
      if (ch === '\\' && i + 1 < source.length) {
        const next = source.charAt(i + 1);
        if (next === '\n') { flush(); out.push({ type: 'break', kind: 'line' }); i += 2; continue; }
        if (/[!-/:-@[-`{-~]/.test(next)) { text += next; i += 2; continue; }
      }
      if (ch === '\n') {
        flush();
        if (/ {2,}$/.test(source.slice(0, i))) {
          const last = out[out.length - 1];
          if (last?.type === 'text') last.text = last.text.replace(/ +$/, '');
          out.push({ type: 'break', kind: 'line' });
        } else this.addText(out, ' ', run);
        i++;
        continue;
      }
      if (ch === '`') {
        const ticks = rest.match(/^`+/)?.[0] ?? '`';
        const end = source.indexOf(ticks, i + ticks.length);
        if (end > 0) {
          flush();
          let code = source.slice(i + ticks.length, end).replace(/\n/g, ' ');
          if (/^ .* $/.test(code)) code = code.slice(1, -1);
          this.addText(out, code, { ...run, ...CODE_RUN });
          i = end + ticks.length;
          continue;
        }
      }
      if (rest.startsWith('[^')) {
        const close = rest.indexOf(']');
        const label = close > 2 ? rest.slice(2, close) : '';
        if (label && this.footnoteBodies.has(label.toLowerCase())) {
          flush();
          this.footnote(label, out);
          i += close + 1;
          continue;
        }
      }
      if (ch === '!' && source.charAt(i + 1) === '[') {
        const link = parseLink(source, i + 1);
        if (link) {
          flush();
          const target = link.url ?? this.refs.get((link.ref ?? link.text).toLowerCase())?.url;
          if (target) this.image(link.text, target, link.title, out, run);
          else text += source.slice(i, link.end);
          i = link.end;
          continue;
        }
      }
      if (ch === '[') {
        const link = parseLink(source, i);
        if (link) {
          const ref = link.url === undefined ? this.refs.get((link.ref ?? link.text).toLowerCase()) : undefined;
          const target = link.url ?? ref?.url;
          if (target !== undefined) {
            flush();
            const hyperlink: Inline = { type: 'hyperlink', inlines: this.inlines(link.text, run, depth + 1) };
            if (target.startsWith('#')) hyperlink.anchor = target.slice(1);
            else {
              const url = checkedUrl(target, this.warnings);
              if (url) hyperlink.url = url;
            }
            const title = link.title ?? ref?.title;
            if (title) hyperlink.tooltip = title;
            out.push(hyperlink);
            i = link.end;
            continue;
          }
        }
      }
      if (ch === '<') {
        const auto = rest.match(/^<((?:https?|ftp|mailto):[^\s<>]+)>/i);
        if (auto?.[1]) {
          flush();
          out.push({ type: 'hyperlink', url: auto[1], inlines: [{ type: 'text', text: auto[1].replace(/^mailto:/i, ''), props: { ...run } }] });
          i += auto[0].length;
          continue;
        }
        const tag = rest.match(/^<(\/?)(br|u|sup|sub|mark|ins|del|s|kbd)\s*\/?>/i);
        if (tag) {
          flush();
          const name = (tag[2] ?? '').toLowerCase();
          if (name === 'br') out.push({ type: 'break', kind: 'line' });
          else if (!tag[1]) {
            const close = source.toLowerCase().indexOf(`</${name}>`, i + tag[0].length);
            if (close > 0) {
              const extra: RunProps = name === 'u' || name === 'ins' ? { underline: 'single' } : name === 'sup' ? { vertAlign: 'superscript' } : name === 'sub' ? { vertAlign: 'subscript' }
                : name === 'mark' ? { highlight: 'yellow' } : name === 'kbd' ? CODE_RUN : { strike: true };
              out.push(...this.inlines(source.slice(i + tag[0].length, close), { ...run, ...extra }, depth + 1));
              i = close + name.length + 3;
              continue;
            }
          }
          i += tag[0].length;
          continue;
        }
      }
      const bare = rest.match(/^(?:https?:\/\/|www\.)[^\s<]*[^\s<.,;:!?)"'*_~]/i);
      if (bare && (i === 0 || /[\s(]/.test(source.charAt(i - 1)))) {
        flush();
        const url = bare[0].startsWith('www.') ? `http://${bare[0]}` : bare[0];
        out.push({ type: 'hyperlink', url, inlines: [{ type: 'text', text: bare[0], props: { ...run } }] });
        i += bare[0].length;
        continue;
      }
      const delim = rest.match(/^(\*\*\*|___|\*\*|__|~~|==|\*|_)/)?.[0];
      if (delim) {
        const intraword = delim.startsWith('_') && i > 0 && /[\p{L}\p{N}]/u.test(source.charAt(i - 1));
        const close = intraword ? -1 : findClosing(source, i + delim.length, delim);
        if (close > i + delim.length) {
          flush();
          const extra: RunProps = delim.length === 3 ? { bold: true, italic: true } : delim === '**' || delim === '__' ? { bold: true }
            : delim === '~~' ? { strike: true } : delim === '==' ? { highlight: 'yellow' } : { italic: true };
          out.push(...this.inlines(source.slice(i + delim.length, close), { ...run, ...extra }, depth + 1));
          i = close + delim.length;
          continue;
        }
      }
      text += ch;
      i++;
    }
    flush();
    return mergeTexts(out);
  }
}

function mergeTexts(list: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const inline of list) {
    const last = out[out.length - 1];
    if (inline.type === 'text' && last?.type === 'text' && JSON.stringify(last.props) === JSON.stringify(inline.props)) last.text += inline.text;
    else out.push(inline);
  }
  return out;
}

/** Delimiteur fermant correspondant (non precede d'un blanc). */
function findClosing(source: string, from: number, delim: string): number {
  if (/\s/.test(source.charAt(from))) return -1;
  let i = from;
  while (i < source.length) {
    const at = source.indexOf(delim, i);
    if (at < 0) return -1;
    if (source.charAt(at - 1) === '\\') { i = at + 1; continue; }
    if (/\s/.test(source.charAt(at - 1))) { i = at + delim.length; continue; }
    // « ** » ne ferme pas un « * » simple.
    if (delim.length === 1 && source.charAt(at + 1) === delim) {
      if (source.charAt(at + 2) === delim && at + 2 < source.length) return at + 2;
      i = at + 2;
      continue;
    }
    if (delim.startsWith('_') && /[\p{L}\p{N}]/u.test(source.charAt(at + delim.length))) { i = at + delim.length; continue; }
    return at;
  }
  return -1;
}

/** [texte](url "titre") ou [texte][ref] ou [ref] a partir de `start` (sur « [ »). */
function parseLink(source: string, start: number): { text: string; url?: string; title?: string; ref?: string; end: number } | undefined {
  let depth = 0;
  let i = start;
  for (; i < source.length; i++) {
    const ch = source.charAt(i);
    if (ch === '\\') { i++; continue; }
    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (i >= source.length) return undefined;
  const text = source.slice(start + 1, i);
  const after = source.slice(i + 1);
  const inline = after.match(/^\(\s*<?([^\s>)]*)>?(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)/);
  if (inline) return { text, url: inline[1] ?? '', title: inline[2] ?? inline[3], end: i + 1 + inline[0].length };
  const ref = after.match(/^\[([^\]]*)\]/);
  if (ref) return { text, ref: ref[1] || text, end: i + 1 + ref[0].length };
  return { text, ref: text, end: i + 1 };
}

export interface ReadMarkdownOptions {
  limits?: Partial<ReadLimits>;
}

/** Importe un document Markdown. */
export function readMarkdown(input: Uint8Array | string, options: ReadMarkdownOptions = {}): ReadResult {
  const limits: ReadLimits = { ...DEFAULT_READ_LIMITS, ...options.limits };
  const source = typeof input === 'string' ? input : new TextDecoder('utf-8').decode(input).replace(/^﻿/, '');
  const reader = new MdReader(limits);
  let lines = source.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  // En-tete YAML (front matter) : titre et auteur.
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) {
      for (const line of lines.slice(1, end)) {
        const m = line.match(/^(title|author|description|keywords)\s*:\s*["']?(.*?)["']?\s*$/i);
        if (!m?.[2]) continue;
        const key = (m[1] ?? '').toLowerCase();
        if (key === 'title') reader.doc.properties.title = m[2];
        if (key === 'author') reader.doc.properties.creator = m[2];
        if (key === 'description') reader.doc.properties.description = m[2];
        if (key === 'keywords') reader.doc.properties.keywords = m[2];
      }
      lines = lines.slice(end + 1);
    }
  }
  lines = reader.collectDefinitions(lines);
  const blocks = reader.blocks(lines, 0);
  reader.doc.body = blocks.length ? blocks : [{ type: 'paragraph', props: {}, inlines: [] }];
  return { document: reader.doc, warnings: reader.warnings.list };
}
