// Lecture RTF (Rich Text Format) vers le modele : texte, mise en forme, styles, listes, tableaux, images,
// liens, champs, notes, en-tetes / pieds, sections, signets.
import type {
  Block, Border, HeaderFooterRefs, Inline, NumberFormat, Paragraph, ParagraphProps, ReadResult, RunProps, Section, Style,
  TableCellProps, TableRow, TabStop, UnderlineType, WordDocument,
} from '../model.ts';
import { builtinStyle, createBlankDocument, createDefaultStyleSheet } from '../blank.ts';
import { sniffImageType } from '../docx/ns.ts';
import { Budget, checkedUrl, DEFAULT_READ_LIMITS, Warnings, type ReadLimits } from '../security.ts';
import { WARNINGS } from '../strings.ts';
import { twipsToPt } from '../units.ts';
import { fieldCode } from '../docx/read-body.ts';
import {
  LCID_TO_LANG, nearestHighlight, readColorTable, readFontTable, readInfo, readListOverrides, readListTable, type FontEntry,
} from './header.ts';
import { destinationOf, groupText, tokenize, type RtfGroup, type RtfWord } from './tokens.ts';

interface CellDef {
  right: number;
  props: TableCellProps;
}

interface State {
  run: RunProps;
  charStyle?: string;
  para: ParagraphProps;
  paraStyle?: string;
  inTable: boolean;
  sl: number;
  slMult: boolean;
  tabAlign?: TabStop['align'];
  tabLeader?: TabStop['leader'];
  /** Bordure en cours de definition (\brdrX puis \brdrs, \brdrw...). */
  border?: Border;
}

const freshState = (): State => ({ run: {}, para: {}, inTable: false, sl: 0, slMult: false });

const cloneState = (s: State): State => ({
  ...s,
  run: { ...s.run },
  para: { ...s.para, tabs: s.para.tabs ? [...s.para.tabs] : undefined, borders: s.para.borders ? { ...s.para.borders } : undefined },
});

/** Destination de sortie : corps, cellule, en-tete, note. */
class Sink {
  blocks: Block[] = [];
  inlines: Inline[] = [];
  rows: TableRow[] = [];
  cells: { props: TableCellProps; blocks: Block[] }[] = [];
  cellBlocks: Block[] = [];
  readonly note: boolean;

  constructor(note = false) {
    this.note = note;
  }
}

const UNDERLINES: Readonly<Record<string, UnderlineType>> = {
  ul: 'single', uld: 'dotted', uldash: 'dash', uldashd: 'dotDash', uldashdd: 'dotDotDash', uldb: 'double', ulth: 'thick',
  ulw: 'words', ulwave: 'wave', ululdbwave: 'wavyDouble', ulhwave: 'wavyHeavy', ulldash: 'dashLong', ulthd: 'dottedHeavy',
  ulthdash: 'dashedHeavy', ulthdashd: 'dashDotHeavy', ulthdashdd: 'dashDotDotHeavy', ulthldash: 'dashLongHeavy',
};

const TOGGLES: Readonly<Record<string, keyof RunProps>> = {
  b: 'bold', i: 'italic', strike: 'strike', striked: 'doubleStrike', caps: 'caps', scaps: 'smallCaps', v: 'hidden',
  outl: 'outline', shad: 'shadow', embo: 'emboss', impr: 'imprint', noproof: 'noProof',
};

const SPECIAL: Readonly<Record<string, string>> = {
  emdash: '—', endash: '–', bullet: '•', lquote: '‘', rquote: '’', ldblquote: '“',
  rdblquote: '”', '~': ' ', '-': '­', _: '‑', emspace: ' ', enspace: ' ', qmspace: ' ',
  zwj: '‍', zwnj: '‌',
};

const BORDER_STYLES: Readonly<Record<string, Border['style']>> = {
  brdrs: 'single', brdrth: 'thick', brdrdb: 'double', brdrdot: 'dotted', brdrdash: 'dashed', brdrtriple: 'triple',
  brdrwavy: 'wave', brdrinset: 'inset', brdroutset: 'outset', brdrnone: 'none', brdrdashd: 'dotDash', brdrdashdd: 'dotDotDash',
};

const sameProps = (a: RunProps, b: RunProps): boolean => JSON.stringify(a) === JSON.stringify(b);

function hasWord(group: RtfGroup, word: string): boolean {
  return group.items.some((i) => (i.kind === 'word' && i.word === word) || (i.kind === 'group' && hasWord(i, word)));
}

function hexBytes(text: string, max: number): Uint8Array | undefined {
  const clean = text.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length / 2 > max) return undefined;
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

class RtfReader {
  readonly doc: WordDocument = createBlankDocument();
  readonly warnings = new Warnings();
  readonly budget: Budget;
  private fonts = new Map<number, FontEntry>();
  private colors: string[] = [];
  private readonly styleIds = new Map<number, string>();
  private readonly charStyleIds = new Map<number, string>();
  private lists = new Map<number, number>();
  private abstractsByListId = new Map<number, number>();
  private legacyLists = new Map<string, number>();
  private section: Section;
  private docSection: Section;
  private rowDefs: CellDef[] = [];
  private rowProps: TableRow['props'] = {};
  private tableProps: { indent?: number; alignment?: 'left' | 'center' | 'right'; gap?: number } = {};
  private headerCount = 0;
  private noteCount = 0;
  private bookmarks = new Map<string, number>();

  constructor(limits: ReadLimits) {
    this.budget = new Budget(limits, this.warnings);
    this.doc.body = [];
    const sheet = createDefaultStyleSheet();
    this.doc.styles = { docDefaults: { run: { size: 12 }, paragraph: {} }, styles: sheet.styles };
    this.section = { ...this.doc.finalSection, headers: {}, footers: {} };
    this.docSection = { ...this.section };
  }

  read(root: RtfGroup): void {
    const sink = new Sink();
    this.process(root, freshState(), sink, 0);
    this.finish(sink, freshState());
    this.doc.body = sink.blocks.length ? sink.blocks : [{ type: 'paragraph', props: {}, inlines: [] }];
    this.doc.finalSection = this.section;
  }

  private color(index: number | undefined): string | undefined {
    if (index === undefined) return undefined;
    const c = this.colors[index];
    return c && c !== 'auto' ? c : undefined;
  }

  // ---- Sortie ----

  private addInline(sink: Sink, inline: Inline): void {
    sink.inlines.push(inline);
  }

  private addText(sink: Sink, text: string, state: State): void {
    if (!text) return;
    const last = sink.inlines[sink.inlines.length - 1];
    if (last && last.type === 'text' && last.styleId === state.charStyle && sameProps(last.props, state.run)) {
      last.text += text;
      return;
    }
    const run: Inline = { type: 'text', text, props: { ...state.run } };
    if (state.charStyle) run.styleId = state.charStyle;
    sink.inlines.push(run);
  }

  private paragraphFrom(sink: Sink, state: State): Paragraph {
    const props: ParagraphProps = { ...state.para };
    if (state.sl !== 0) {
      props.lineSpacing = state.slMult
        ? { rule: 'auto', value: Math.round((state.sl / 240) * 100) / 100 }
        : state.sl < 0 ? { rule: 'exact', value: twipsToPt(-state.sl) } : { rule: 'atLeast', value: twipsToPt(state.sl) };
    }
    const paragraph: Paragraph = { type: 'paragraph', props, inlines: sink.inlines };
    if (state.paraStyle) paragraph.styleId = state.paraStyle;
    sink.inlines = [];
    return paragraph;
  }

  private endParagraph(sink: Sink, state: State): Paragraph | undefined {
    if (!this.budget.takeBlock()) {
      sink.inlines = [];
      return undefined;
    }
    const paragraph = this.paragraphFrom(sink, state);
    if (state.inTable) sink.cellBlocks.push(paragraph);
    else {
      this.closeTable(sink);
      sink.blocks.push(paragraph);
    }
    return paragraph;
  }

  private endCell(sink: Sink, state: State): void {
    if (sink.inlines.length || !sink.cellBlocks.length) {
      const inTable = state.inTable;
      state.inTable = true;
      this.endParagraph(sink, state);
      state.inTable = inTable;
    }
    const def = this.rowDefs[sink.cells.length];
    sink.cells.push({ props: { ...(def?.props ?? {}) }, blocks: sink.cellBlocks });
    sink.cellBlocks = [];
  }

  private endRow(sink: Sink): void {
    if (sink.cellBlocks.length || sink.inlines.length) this.endCell(sink, freshState());
    const lefts = [this.tableProps.indent ?? 0, ...this.rowDefs.map((d) => d.right)];
    const cells = sink.cells.map((cell, i) => {
      const def = this.rowDefs[i];
      const width = def ? def.right - (lefts[i] ?? 0) : 0;
      return { props: { ...cell.props, ...(width > 0 ? { width: { value: twipsToPt(width), type: 'pt' as const } } : {}) }, blocks: cell.blocks };
    });
    sink.rows.push({ props: { ...this.rowProps }, cells });
    sink.cells = [];
  }

  private closeTable(sink: Sink): void {
    if (!sink.rows.length) return;
    // Grille : toutes les limites de cellules rencontrees.
    const edges = new Set<number>();
    for (const row of sink.rows) {
      let x = 0;
      for (const cell of row.cells) {
        x += cell.props.width?.value ?? 0;
        edges.add(Math.round(x * 100) / 100);
      }
    }
    const sorted = [...edges].sort((a, b) => a - b);
    const grid = sorted.map((e, i) => Math.round((e - (sorted[i - 1] ?? 0)) * 100) / 100);
    for (const row of sink.rows) {
      let x = 0;
      for (const cell of row.cells) {
        const start = sorted.findIndex((e) => e > x + 0.01);
        x += cell.props.width?.value ?? 0;
        const end = sorted.findIndex((e) => Math.abs(e - Math.round(x * 100) / 100) < 0.02);
        if (start >= 0 && end > start) cell.props.gridSpan = end - start + 1;
      }
    }
    sink.blocks.push({
      type: 'table',
      props: {
        ...(this.tableProps.indent ? { indent: twipsToPt(this.tableProps.indent) } : {}),
        ...(this.tableProps.alignment ? { alignment: this.tableProps.alignment } : {}),
        ...(this.tableProps.gap !== undefined ? { cellMargins: { left: twipsToPt(this.tableProps.gap), right: twipsToPt(this.tableProps.gap) } } : {}),
      },
      grid,
      rows: sink.rows,
    });
    sink.rows = [];
  }

  private finish(sink: Sink, state: State): void {
    if (sink.cells.length || sink.cellBlocks.length) this.endRow(sink);
    if (sink.inlines.length) {
      state.inTable = false;
      this.endParagraph(sink, state);
    }
    this.closeTable(sink);
  }

  // ---- Groupes ----

  private process(group: RtfGroup, inherited: State, sink: Sink, depth: number): void {
    if (!this.budget.depthOk(depth)) return;
    const { word, ignorable } = destinationOf(group);
    switch (word) {
      case 'fonttbl': this.fonts = readFontTable(group); this.applyDefaultFont(); return;
      case 'colortbl': this.colors = readColorTable(group); return;
      case 'stylesheet': this.readStylesheet(group); return;
      case 'info': readInfo(group, this.doc.properties); return;
      case 'listtable': this.readLists(group); return;
      case 'listoverridetable': this.lists = readListOverrides(group); return;
      case 'pict': this.picture(group, inherited, sink); return;
      case 'field': this.field(group, inherited, sink, depth); return;
      case 'footnote': this.footnote(group, inherited, sink, depth); return;
      case 'header': case 'headerr': case 'headerl': case 'headerf':
      case 'footer': case 'footerr': case 'footerl': case 'footerf':
        this.headerFooter(word, group, depth);
        return;
      case 'bkmkstart':
      case 'bkmkend': this.bookmark(word, group, sink); return;
      case 'pn': this.legacyList(group, inherited); return;
      case 'shppict': case 'shp': case 'shpinst': case 'sp': case 'sv': break;
      case 'nonshppict': case 'pntext': case 'listtext': case 'fldinst': case 'themedata': case 'colorschememapping':
      case 'latentstyles': case 'datastore': case 'xmlnstbl': case 'rsidtbl': case 'generator': case 'mmathPr':
      case 'pgdsctbl': case 'annotation': case 'atnid': case 'atnauthor': case 'atrfstart': case 'atrfend': case 'atndate':
      case 'object': case 'objdata': case 'template': case 'userprops': case 'wgrffmtfilter': case 'fchars': case 'lchars':
      case 'panose': case 'falt': case 'docvar': case 'revtbl': case 'filetbl': case 'pnseclvl': case 'protusertbl':
      case 'ftnsep': case 'ftnsepc': case 'aftnsep': case 'aftnsepc': case 'blipuid': case 'picprop':
        return;
      default:
        if (ignorable) return;
    }
    const state = cloneState(inherited);
    for (const item of group.items) {
      if (item.kind === 'text') this.addText(sink, item.text, state);
      else if (item.kind === 'word') this.word(item, state, sink);
      else if (item.kind === 'group') this.process(item, state, sink, depth + 1);
    }
  }

  private applyDefaultFont(): void {
    const deff = this.deff;
    const font = deff !== undefined ? this.fonts.get(deff) : undefined;
    if (font?.name) this.doc.styles.docDefaults.run.font = font.name;
  }

  private deff: number | undefined;

  private readStylesheet(group: RtfGroup): void {
    const styles: Style[] = [];
    for (const item of group.items) {
      if (item.kind !== 'group') continue;
      const state = freshState();
      let number = 0;
      let type = 'paragraph' as Style['type'];
      let basedOn: number | undefined;
      let next: number | undefined;
      const scan = (g: RtfGroup): void => {
        for (const w of g.items) {
          if (w.kind === 'word') {
            if (w.word === 's') number = w.param ?? 0;
            else if (w.word === 'cs') { number = w.param ?? 0; type = 'character'; }
            else if (w.word === 'ts' || w.word === 'ds') { number = w.param ?? 0; type = w.word === 'ts' ? 'table' : 'paragraph'; }
            else if (w.word === 'sbasedon') basedOn = w.param;
            else if (w.word === 'snext') next = w.param;
            else this.word(w, state, new Sink());
          }
        }
      };
      scan(item);
      for (const sub of item.items) if (sub.kind === 'group' && destinationOf(sub).word === 'cs') scan(sub);
      if (type === 'table') continue;
      const name = groupText({ kind: 'group', items: item.items.filter((x) => x.kind === 'text') }).replace(/;\s*$/, '').trim();
      if (!name) continue;
      const builtin = builtinStyle(name.replace(/\s+(\d)$/, '$1').replace(/(^|\s)(\w)/g, (_, s: string, c: string) => s + c.toUpperCase()).replace(/\s+/g, ''));
      const id = builtin && builtin.type === type ? builtin.id : name.replace(/[^A-Za-z0-9]/g, '') || `Style${number}`;
      (type === 'character' ? this.charStyleIds : this.styleIds).set(number, id);
      const style: Style = { id, type, name: builtin?.name ?? name };
      if (Object.keys(state.run).length) style.run = { ...state.run };
      if (Object.keys(state.para).length && type === 'paragraph') style.paragraph = { ...state.para };
      if (!builtin) style.custom = true;
      (style as Style & { _based?: number; _next?: number })._based = basedOn;
      (style as Style & { _based?: number; _next?: number })._next = next;
      styles.push(style);
    }
    for (const style of styles) {
      const extra = style as Style & { _based?: number; _next?: number };
      if (extra._based !== undefined && extra._based !== 222) {
        const parent = this.styleIds.get(extra._based);
        if (parent && parent !== style.id) style.basedOn = parent;
      }
      if (extra._next !== undefined) {
        const nextId = this.styleIds.get(extra._next);
        if (nextId) style.next = nextId;
      }
      delete extra._based;
      delete extra._next;
      if (style.id === 'Normal') style.isDefault = true;
      const list = this.doc.styles.styles;
      const existing = list.findIndex((s) => s.id === style.id);
      if (existing >= 0) list[existing] = { ...list[existing], ...style };
      else list.push(style);
    }
  }

  private readLists(group: RtfGroup): void {
    const lists = readListTable(group, this.doc.numbering.abstracts.length + 1);
    for (const [listId, abstract] of lists) {
      this.doc.numbering.abstracts.push(abstract);
      this.abstractsByListId.set(listId, abstract.id);
    }
  }

  /** Numerotation \lsN : instance creee a la premiere utilisation. */
  private numIdFor(ls: number): number {
    const existing = this.doc.numbering.instances.find((n) => n.id === ls);
    if (existing) return ls;
    const listId = this.lists.get(ls);
    const abstractId = listId !== undefined ? this.abstractsByListId.get(listId) : undefined;
    if (abstractId === undefined) return this.legacyNumId('decimal');
    this.doc.numbering.instances.push({ id: ls, abstractId, overrides: [] });
    return ls;
  }

  /** Listes « \pn » (WordPad, Word 95) : une liste a puces et une liste numerotee partagees. */
  private legacyNumId(format: NumberFormat): number {
    const known = this.legacyLists.get(format);
    if (known !== undefined) return known;
    const numbering = this.doc.numbering;
    const abstractId = numbering.abstracts.reduce((m, a) => Math.max(m, a.id), 0) + 1;
    const id = numbering.instances.reduce((m, n) => Math.max(m, n.id), 1000) + 1;
    numbering.abstracts.push({
      id: abstractId, multiLevelType: 'singleLevel',
      levels: [{ level: 0, format, text: format === 'bullet' ? '•' : '%1.', start: 1, alignment: 'left', suffix: 'tab', paragraph: { indentLeft: 36, indentFirstLine: -18 } }],
    });
    numbering.instances.push({ id, abstractId, overrides: [] });
    this.legacyLists.set(format, id);
    return id;
  }

  private legacyList(group: RtfGroup, state: State): void {
    const words = new Set(group.items.filter((i): i is RtfWord => i.kind === 'word').map((w) => w.word));
    const format: NumberFormat = words.has('pnlvlblt') ? 'bullet' : words.has('pnlcltr') ? 'lowerLetter' : words.has('pnucltr') ? 'upperLetter'
      : words.has('pnlcrm') ? 'lowerRoman' : words.has('pnucrm') ? 'upperRoman' : 'decimal';
    state.para.numbering = { numId: this.legacyNumId(format), level: 0 };
  }

  private picture(group: RtfGroup, state: State, sink: Sink): void {
    const v: Record<string, number> = {};
    let type: string | undefined;
    let data = '';
    let binary: Uint8Array | undefined;
    for (const item of group.items) {
      if (item.kind === 'word') {
        if (item.word === 'pngblip') type = 'image/png';
        else if (item.word === 'jpegblip') type = 'image/jpeg';
        else if (item.word === 'emfblip') type = 'image/x-emf';
        else if (item.word === 'wmetafile') type = 'image/x-wmf';
        else if (item.param !== undefined) v[item.word] = item.param;
      } else if (item.kind === 'text') data += item.text;
      else if (item.kind === 'bin') binary = item.bytes;
    }
    const bytes = binary ?? hexBytes(data, this.budget.limits.maxImageBytes);
    if (!bytes || !bytes.length) return;
    const contentType = sniffImageType(bytes) ?? type;
    if (!contentType) return;
    const scaleX = (v['picscalex'] ?? 100) / 100;
    const scaleY = (v['picscaley'] ?? 100) / 100;
    const width = v['picwgoal'] ? twipsToPt(v['picwgoal']) * scaleX : (v['picw'] ?? 96) * 0.75 * scaleX;
    const height = v['pichgoal'] ? twipsToPt(v['pichgoal']) * scaleY : (v['pich'] ?? 96) * 0.75 * scaleY;
    const index = Object.keys(this.doc.media).length + 1;
    const ext = contentType.split('/')[1]?.replace('x-', '') ?? 'bin';
    const id = `image${index}.${ext}`;
    this.doc.media[id] = { id, fileName: id, contentType, bytes };
    const image: Inline = { type: 'image', mediaId: id, width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100 };
    if (Object.keys(state.run).length) image.props = { ...state.run };
    this.addInline(sink, image);
  }

  private field(group: RtfGroup, state: State, sink: Sink, depth: number): void {
    let instruction = '';
    let result: RtfGroup | undefined;
    for (const item of group.items) {
      if (item.kind !== 'group') continue;
      const dest = destinationOf(item).word;
      if (dest === 'fldinst') instruction = groupText(item).trim();
      else if (dest === 'fldrslt') result = item;
    }
    if (result && hasWord(result, 'par')) {
      this.process({ kind: 'group', items: result.items.filter((i) => !(i.kind === 'word' && i.word === 'fldrslt')) }, state, sink, depth + 1);
      return;
    }
    const sub = new Sink(sink.note);
    if (result) this.process({ kind: 'group', items: result.items.filter((i) => !(i.kind === 'word' && i.word === 'fldrslt')) }, state, sub, depth + 1);
    const code = fieldCode(instruction);
    if (code === 'HYPERLINK') {
      const anchor = instruction.match(/\\l\s+"([^"]*)"/)?.[1];
      const target = instruction.replace(/\\l\s+"[^"]*"/, '').match(/HYPERLINK\s+"([^"]*)"/i)?.[1] ?? instruction.match(/HYPERLINK\s+(\S+)/i)?.[1];
      const url = target ? checkedUrl(target, this.warnings) : undefined;
      const link: Inline = { type: 'hyperlink', inlines: sub.inlines };
      if (url) link.url = url;
      if (anchor) link.anchor = anchor;
      this.addInline(sink, link);
      return;
    }
    this.addInline(sink, { type: 'field', instruction, code, result: sub.inlines });
  }

  private footnote(group: RtfGroup, state: State, sink: Sink, depth: number): void {
    const endnote = hasWord(group, 'ftnalt');
    this.noteCount += 1;
    const id = this.noteCount;
    const sub = new Sink(true);
    this.process({ kind: 'group', items: group.items.filter((i) => !(i.kind === 'word' && i.word === 'footnote')) }, freshState(), sub, depth + 1);
    this.finish(sub, freshState());
    (endnote ? this.doc.endnotes : this.doc.footnotes).push({ id, blocks: sub.blocks });
    const ref: Inline = { type: endnote ? 'endnoteRef' : 'footnoteRef', noteId: id };
    const props = { ...state.run };
    delete props.vertAlign;
    if (Object.keys(props).length) ref.props = props;
    this.addInline(sink, ref);
  }

  private headerFooter(word: string, group: RtfGroup, depth: number): void {
    const kind = word.startsWith('header') ? 'header' : 'footer';
    const suffix = word.slice(kind.length);
    const type: keyof HeaderFooterRefs = suffix === 'f' ? 'first' : suffix === 'l' ? 'even' : 'default';
    const sub = new Sink();
    this.process({ kind: 'group', items: group.items.filter((i) => !(i.kind === 'word' && i.word === word)) }, freshState(), sub, depth + 1);
    this.finish(sub, freshState());
    this.headerCount += 1;
    const id = `${kind}${this.headerCount}`;
    this.doc.headersFooters[id] = { id, kind, blocks: sub.blocks };
    (kind === 'header' ? this.section.headers : this.section.footers)[type] = id;
  }

  private bookmark(word: string, group: RtfGroup, sink: Sink): void {
    const name = groupText(group).trim();
    if (!name) return;
    if (word === 'bkmkstart') {
      const id = this.bookmarks.size;
      this.bookmarks.set(name, id);
      this.addInline(sink, { type: 'bookmarkStart', id, name });
    } else {
      const id = this.bookmarks.get(name);
      if (id !== undefined) this.addInline(sink, { type: 'bookmarkEnd', id });
    }
  }

  // ---- Mots de controle ----

  private setBorder(state: State, side: string): void {
    const border: Border = { style: 'single', width: 0.5, color: 'auto', space: 0 };
    state.border = border;
    if (side.startsWith('clbrdr')) {
      const def = this.cellDraft;
      const key = ({ clbrdrt: 'top', clbrdrb: 'bottom', clbrdrl: 'left', clbrdrr: 'right' } as Record<string, 'top' | 'bottom' | 'left' | 'right'>)[side];
      if (key) def.props.borders = { ...def.props.borders, [key]: border };
      return;
    }
    const key = ({ brdrt: 'top', brdrb: 'bottom', brdrl: 'left', brdrr: 'right', brdrbtw: 'between', brdrbar: 'bar', box: 'top' } as Record<string, keyof NonNullable<ParagraphProps['borders']>>)[side];
    if (!key) return;
    state.para.borders = { ...state.para.borders, [key]: border };
    if (side === 'box') state.para.borders = { top: border, bottom: border, left: border, right: border };
  }

  private cellDraft: CellDef = { right: 0, props: {} };

  private sectionWord(w: RtfWord): boolean {
    const p = w.param ?? 0;
    const s = this.section;
    const both = (apply: (section: Section) => void): void => {
      apply(this.section);
      apply(this.docSection);
    };
    switch (w.word) {
      case 'paperw': both((x) => { x.pageWidth = twipsToPt(p); }); return true;
      case 'paperh': both((x) => { x.pageHeight = twipsToPt(p); }); return true;
      case 'margl': both((x) => { x.margins = { ...x.margins, left: twipsToPt(p) }; }); return true;
      case 'margr': both((x) => { x.margins = { ...x.margins, right: twipsToPt(p) }; }); return true;
      case 'margt': both((x) => { x.margins = { ...x.margins, top: twipsToPt(p) }; }); return true;
      case 'margb': both((x) => { x.margins = { ...x.margins, bottom: twipsToPt(p) }; }); return true;
      case 'gutter': both((x) => { x.margins = { ...x.margins, gutter: twipsToPt(p) }; }); return true;
      case 'landscape': both((x) => { x.orientation = 'landscape'; }); return true;
      case 'pgwsxn': s.pageWidth = twipsToPt(p); return true;
      case 'pghsxn': s.pageHeight = twipsToPt(p); return true;
      case 'marglsxn': s.margins = { ...s.margins, left: twipsToPt(p) }; return true;
      case 'margrsxn': s.margins = { ...s.margins, right: twipsToPt(p) }; return true;
      case 'margtsxn': s.margins = { ...s.margins, top: twipsToPt(p) }; return true;
      case 'margbsxn': s.margins = { ...s.margins, bottom: twipsToPt(p) }; return true;
      case 'guttersxn': s.margins = { ...s.margins, gutter: twipsToPt(p) }; return true;
      case 'headery': s.margins = { ...s.margins, header: twipsToPt(p) }; return true;
      case 'footery': s.margins = { ...s.margins, footer: twipsToPt(p) }; return true;
      case 'lndscpsxn': s.orientation = 'landscape'; return true;
      case 'cols': s.columns = { ...s.columns, count: Math.max(1, p) }; return true;
      case 'colsx': s.columns = { ...s.columns, space: twipsToPt(p) }; return true;
      case 'linebetcol': s.columns = { ...s.columns, separator: true }; return true;
      case 'sbknone': s.breakType = 'continuous'; return true;
      case 'sbkcol': s.breakType = 'nextColumn'; return true;
      case 'sbkpage': s.breakType = 'nextPage'; return true;
      case 'sbkeven': s.breakType = 'evenPage'; return true;
      case 'sbkodd': s.breakType = 'oddPage'; return true;
      case 'titlepg': s.titlePage = true; return true;
      case 'pgnstarts': s.pageNumbering = { ...s.pageNumbering, start: p }; return true;
      case 'pgnucrm': s.pageNumbering = { ...s.pageNumbering, format: 'upperRoman' }; return true;
      case 'pgnlcrm': s.pageNumbering = { ...s.pageNumbering, format: 'lowerRoman' }; return true;
      case 'pgnucltr': s.pageNumbering = { ...s.pageNumbering, format: 'upperLetter' }; return true;
      case 'pgnlcltr': s.pageNumbering = { ...s.pageNumbering, format: 'lowerLetter' }; return true;
      case 'vertalc': s.verticalAlign = 'center'; return true;
      case 'vertalb': s.verticalAlign = 'bottom'; return true;
      case 'vertalj': s.verticalAlign = 'both'; return true;
      case 'facingp': this.doc.settings.evenAndOddHeaders = true; return true;
      case 'margmirror': this.doc.settings.mirrorMargins = true; return true;
      case 'deftab': this.doc.settings.defaultTabStop = twipsToPt(p); return true;
      case 'deff': this.deff = p; return true;
      case 'deflang': this.doc.settings.language = LCID_TO_LANG[p] ?? this.doc.settings.language; return true;
      case 'sectd':
        this.section = { ...this.docSection, headers: {}, footers: {}, margins: { ...this.docSection.margins }, columns: { ...this.docSection.columns } };
        return true;
      default: return false;
    }
  }

  private tableWord(w: RtfWord): boolean {
    const p = w.param ?? 0;
    switch (w.word) {
      case 'trowd': this.rowDefs = []; this.rowProps = {}; this.cellDraft = { right: 0, props: {} }; return true;
      case 'trgaph': this.tableProps.gap = p; return true;
      case 'trleft': this.tableProps.indent = p; return true;
      case 'trqc': this.tableProps.alignment = 'center'; return true;
      case 'trqr': this.tableProps.alignment = 'right'; return true;
      case 'trql': this.tableProps.alignment = 'left'; return true;
      case 'trhdr': this.rowProps.header = true; return true;
      case 'trkeep': this.rowProps.cantSplit = true; return true;
      case 'trrh': if (p) this.rowProps.height = { value: twipsToPt(Math.abs(p)), rule: p < 0 ? 'exact' : 'atLeast' }; return true;
      case 'clvmgf': this.cellDraft.props.vMerge = 'restart'; return true;
      case 'clvmrg': this.cellDraft.props.vMerge = 'continue'; return true;
      case 'clvertalt': this.cellDraft.props.verticalAlign = 'top'; return true;
      case 'clvertalc': this.cellDraft.props.verticalAlign = 'center'; return true;
      case 'clvertalb': this.cellDraft.props.verticalAlign = 'bottom'; return true;
      case 'clcbpat': {
        const fill = this.color(p);
        if (fill) this.cellDraft.props.shading = { fill, pattern: 'clear', color: 'auto' };
        return true;
      }
      case 'cellx':
        this.cellDraft.right = p;
        this.rowDefs.push(this.cellDraft);
        this.cellDraft = { right: 0, props: {} };
        return true;
      default: return false;
    }
  }

  private word(w: RtfWord, state: State, sink: Sink): void {
    if (this.sectionWord(w) || this.tableWord(w)) return;
    const p = w.param;
    const on = p === undefined || p !== 0;
    const special = SPECIAL[w.word];
    if (special) {
      this.addText(sink, special, state);
      return;
    }
    const toggle = TOGGLES[w.word];
    if (toggle) {
      const run = state.run as Record<string, unknown>;
      if (w.word === 'striked' && p === 0) delete run[toggle];
      else if (on) run[toggle] = true;
      else delete run[toggle];
      return;
    }
    const underline = UNDERLINES[w.word];
    if (underline) {
      if (on) state.run.underline = underline;
      else delete state.run.underline;
      return;
    }
    const borderStyle = BORDER_STYLES[w.word];
    if (borderStyle && state.border) {
      state.border.style = borderStyle;
      return;
    }
    switch (w.word) {
      case 'par': this.endParagraph(sink, state); return;
      case 'sect': {
        const paragraph = sink.inlines.length || !sink.blocks.length ? this.endParagraph(sink, state) : undefined;
        const last = paragraph ?? [...sink.blocks].reverse().find((b): b is Paragraph => b.type === 'paragraph');
        if (last) last.sectionBreak = { ...this.section };
        this.section = { ...this.section, headers: { ...this.section.headers }, footers: { ...this.section.footers } };
        return;
      }
      case 'cell': case 'nestcell': this.endCell(sink, state); return;
      case 'row': case 'nestrow': this.endRow(sink); return;
      case 'tab': this.addInline(sink, Object.keys(state.run).length ? { type: 'tab', props: { ...state.run } } : { type: 'tab' }); return;
      case 'line': this.addInline(sink, { type: 'break', kind: 'line' }); return;
      case 'page': this.addInline(sink, { type: 'break', kind: 'page' }); return;
      case 'column': this.addInline(sink, { type: 'break', kind: 'column' }); return;
      case 'chftn': if (sink.note) this.addInline(sink, { type: 'noteMark', kind: 'footnote' }); return;
      case 'chpgn': this.addInline(sink, { type: 'field', instruction: 'PAGE', code: 'PAGE', result: [] }); return;
      case 'chdate': this.addInline(sink, { type: 'field', instruction: 'DATE', code: 'DATE', result: [] }); return;
      case 'chtime': this.addInline(sink, { type: 'field', instruction: 'TIME', code: 'TIME', result: [] }); return;
      case 'plain': state.run = {}; delete state.charStyle; return;
      case 'pard': state.para = {}; delete state.paraStyle; state.inTable = false; state.sl = 0; state.slMult = false; return;
      case 's': { const id = this.styleIds.get(p ?? 0); if (id) state.paraStyle = id; return; }
      case 'cs': { const id = this.charStyleIds.get(p ?? 0); if (id) state.charStyle = id; return; }
      case 'intbl': state.inTable = true; return;
      case 'f': { const font = this.fonts.get(p ?? 0); if (font?.name) state.run.font = font.name; return; }
      case 'fs': if (p) state.run.size = p / 2; return;
      case 'cf': { const c = this.color(p); if (c) state.run.color = { rgb: c }; else delete state.run.color; return; }
      case 'highlight': { const c = this.color(p); if (c) state.run.highlight = nearestHighlight(c); else delete state.run.highlight; return; }
      case 'cb': case 'chcbpat': { const c = this.color(p); if (c) state.run.shading = { fill: c, pattern: 'clear', color: 'auto' }; else delete state.run.shading; return; }
      case 'super': state.run.vertAlign = 'superscript'; return;
      case 'sub': state.run.vertAlign = 'subscript'; return;
      case 'nosupersub': delete state.run.vertAlign; return;
      case 'up': if (p) state.run.position = p / 2; return;
      case 'dn': if (p) state.run.position = -p / 2; return;
      case 'expndtw': if (p) state.run.spacing = twipsToPt(p); else delete state.run.spacing; return;
      case 'charscalex': if (p && p !== 100) state.run.scale = p; return;
      case 'kerning': if (p) state.run.kerning = p / 2; return;
      case 'lang': { const lang = LCID_TO_LANG[p ?? 0]; if (lang && lang !== 'x-none') state.run.lang = lang; return; }
      case 'ulnone': delete state.run.underline; return;
      case 'ql': state.para.alignment = 'left'; return;
      case 'qc': state.para.alignment = 'center'; return;
      case 'qr': state.para.alignment = 'right'; return;
      case 'qj': state.para.alignment = 'justify'; return;
      case 'qd': state.para.alignment = 'distribute'; return;
      case 'li': case 'lin': state.para.indentLeft = twipsToPt(p ?? 0); return;
      case 'ri': case 'rin': state.para.indentRight = twipsToPt(p ?? 0); return;
      case 'fi': state.para.indentFirstLine = twipsToPt(p ?? 0); return;
      case 'sb': state.para.spacingBefore = twipsToPt(p ?? 0); return;
      case 'sa': state.para.spacingAfter = twipsToPt(p ?? 0); return;
      case 'sbauto': state.para.beforeAutospacing = on; return;
      case 'saauto': state.para.afterAutospacing = on; return;
      case 'sl': state.sl = p ?? 0; return;
      case 'slmult': state.slMult = on; return;
      case 'keepn': state.para.keepNext = true; return;
      case 'keep': state.para.keepLines = true; return;
      case 'pagebb': state.para.pageBreakBefore = true; return;
      case 'widctlpar': state.para.widowControl = true; return;
      case 'nowidctlpar': state.para.widowControl = false; return;
      case 'outlinelevel': state.para.outlineLevel = p ?? 0; return;
      case 'contextualspace': state.para.contextualSpacing = true; return;
      case 'hyphpar': if (p === 0) state.para.suppressAutoHyphens = true; return;
      case 'rtlpar': state.para.bidi = true; return;
      case 'noline': state.para.suppressLineNumbers = true; return;
      case 'ls': state.para.numbering = { numId: this.numIdFor(p ?? 0), level: state.para.numbering?.level ?? 0 }; return;
      case 'ilvl': state.para.numbering = { numId: state.para.numbering?.numId ?? 0, level: p ?? 0 }; return;
      case 'tqr': state.tabAlign = 'right'; return;
      case 'tqc': state.tabAlign = 'center'; return;
      case 'tqdec': state.tabAlign = 'decimal'; return;
      case 'tldot': state.tabLeader = 'dot'; return;
      case 'tlhyph': state.tabLeader = 'hyphen'; return;
      case 'tlul': state.tabLeader = 'underscore'; return;
      case 'tlth': state.tabLeader = 'heavy'; return;
      case 'tlmdot': state.tabLeader = 'middleDot'; return;
      case 'tx': case 'tb': {
        const tab: TabStop = { position: twipsToPt(p ?? 0), align: w.word === 'tb' ? 'bar' : state.tabAlign ?? 'left' };
        if (state.tabLeader) tab.leader = state.tabLeader;
        state.para.tabs = [...(state.para.tabs ?? []), tab];
        delete state.tabAlign;
        delete state.tabLeader;
        return;
      }
      case 'brdrt': case 'brdrb': case 'brdrl': case 'brdrr': case 'brdrbtw': case 'brdrbar': case 'box':
      case 'clbrdrt': case 'clbrdrb': case 'clbrdrl': case 'clbrdrr':
        this.setBorder(state, w.word);
        return;
      case 'brdrw': if (state.border) state.border.width = twipsToPt(p ?? 10); return;
      case 'brdrcf': if (state.border) state.border.color = this.color(p) ?? 'auto'; return;
      case 'brsp': if (state.border) state.border.space = twipsToPt(p ?? 0); return;
      case 'cbpat': { const c = this.color(p); if (c) state.para.shading = { fill: c, pattern: 'clear', color: 'auto' }; return; }
      default: return;
    }
  }
}

export interface ReadRtfOptions {
  limits?: Partial<ReadLimits>;
}

/** Lit un document RTF. Un fichier qui n'est pas du RTF est lu comme du texte brut, avec avertissement. */
export function readRtf(bytes: Uint8Array, options: ReadRtfOptions = {}): ReadResult {
  const limits: ReadLimits = { ...DEFAULT_READ_LIMITS, ...options.limits };
  const reader = new RtfReader(limits);
  const start = new TextDecoder('latin1').decode(bytes.subarray(0, 16)).trimStart();
  if (!start.startsWith('{\\rtf')) reader.warnings.add('rtf-not-rtf', WARNINGS.rtfNotRtf);
  const { root, unbalanced } = tokenize(bytes);
  if (unbalanced) reader.warnings.add('rtf-unbalanced', WARNINGS.rtfUnbalanced);
  const top = root.items.find((i): i is RtfGroup => i.kind === 'group');
  reader.read(top ?? root);
  return { document: reader.doc, warnings: reader.warnings.list };
}
