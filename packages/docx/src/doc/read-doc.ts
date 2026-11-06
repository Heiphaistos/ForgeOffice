// Lecture des documents Word 97-2003 (.doc) : texte (table des pieces), mise en forme des caracteres et paragraphes,
// feuille de styles (heritage par UPX), listes (LST / LFO), sections, en-tetes et pieds, commentaires, images en
// ligne (flux Data), symboles Symbol / Wingdings, tableaux (imbriques aplatis), champs (liens surs), notes de bas de
// page et de fin, proprietes du document. Non recuperes : formes flottantes, objets OLE, zones de texte.
import type { Block, Comment, Inline, Paragraph, ReadResult, Section, Style, Table, TableCell, TextRun } from '../model.ts';
import { createBlankDocument } from '../blank.ts';
import { DocxError } from '../docx/reader.ts';
import { fieldCode } from '../docx/read-body.ts';
import { Budget, DEFAULT_READ_LIMITS, fieldHyperlink, Warnings, type ReadLimits } from '../security.ts';
import { ERRORS, WARNINGS } from '../strings.ts';
import { canonicalStyleName } from '../style-names.ts';
import { inlinesText } from '../text.ts';
import { twipsToPt } from '../units.ts';
import { CfbError, CfbFile } from './cfb.ts';
import {
  charFormat, decode1252, decodePieces, FC, findRange, paraFormat, plcCps, readChpx, readFib, readFontNames, readPapx,
  readPieces, readStyles, readSummary, type CharFormat, type FcRange, type Fib, type ParaFormat, type Papx, type StdInfo,
} from './structures.ts';
import {
  facingPages, readAuthors, readCommentRanges, readCommentRefs, readHeaderStories, readLists, readPicture, readSections,
  type SectionInfo,
} from './structures-ext.ts';
import { symbolToUnicode } from './symbols.ts';

export interface ReadDocOptions {
  limits?: Partial<ReadLimits>;
}

interface Frame {
  instruction: string;
  result: Inline[];
  phase: 'instr' | 'result';
  /** Champ coupe par une fin de paragraphe : son resultat continue dans le texte courant. */
  broken: boolean;
}

const NO_FORMAT: CharFormat = { props: {} };
const NO_PARA: ParaFormat = { props: {}, inTable: false, rowEnd: false, innerRowEnd: false, depth: 0 };
/** Largeur de texte d'une page A4 aux marges par defaut, pour les tableaux sans largeurs. */
const TEXT_WIDTH = 453.6;

class DocReader {
  readonly doc = createBlankDocument();
  readonly warnings = new Warnings();
  private readonly budget: Budget;
  private text = '';
  private fcs: Uint32Array = new Uint32Array(0);
  private chpx: FcRange<Uint8Array>[] = [];
  private papx: FcRange<Papx>[] = [];
  private fonts: string[] = [];
  private readonly charCache = new Map<Uint8Array, CharFormat>();
  private readonly paraCache = new Map<Papx, { styleId?: string; format: ParaFormat }>();
  private readonly styleIds = new Map<number, string | undefined>();
  private stds = new Map<number, StdInfo>();
  private data: Uint8Array = new Uint8Array(0);
  private sectionBreaks = new Map<number, Section>();
  private commentStarts = new Map<number, number[]>();
  private commentEnds = new Map<number, number[]>();
  private commentRefs = new Map<number, number>();
  private readonly media = new Map<number, string>();
  private readonly footRefs = new Map<number, number>();
  private readonly endRefs = new Map<number, number>();
  private revisionId = 0;
  private stopped = false;

  constructor(limits: ReadLimits) {
    this.budget = new Budget(limits, this.warnings);
    // Valeurs par defaut de Word 97 : Times New Roman 10 pt, sans espacement ; le style Normal du fichier les precise.
    this.doc.styles.docDefaults = { run: { font: 'Times New Roman', size: 10 }, paragraph: {} };
  }

  read(word: Uint8Array, table: Uint8Array | undefined, fib: Fib, data: Uint8Array): void {
    this.data = data;
    const pieces = table ? readPieces(table, fib.fcLcb(FC.clx).fc, fib.fcLcb(FC.clx).lcb) : [];
    if (!table || !pieces.length || fib.nFib < 0xc1) {
      this.warnings.add('doc-no-pieces', WARNINGS.docNoPieces);
      const end = Math.min(word.length, fib.fcMac > fib.fcMin ? fib.fcMac : word.length);
      this.plain(decode1252(word.subarray(Math.min(fib.fcMin, end), end)));
      return;
    }
    const at = (index: number): [Uint8Array, number, number] => [table, fib.fcLcb(index).fc, fib.fcLcb(index).lcb];
    ({ text: this.text, fcs: this.fcs } = decodePieces(word, pieces, Number.MAX_SAFE_INTEGER));
    this.fonts = readFontNames(...at(FC.sttbfFfn));
    this.stds = readStyles(...at(FC.stshf));
    this.chpx = readChpx(word, ...at(FC.plcfBteChpx));
    this.papx = readPapx(word, ...at(FC.plcfBtePapx));
    this.styleDef(0);
    const lst = fib.fcLcb(FC.plfLst);
    const lfo = fib.fcLcb(FC.plfLfo);
    this.doc.numbering = readLists(table, [lst.fc, lst.lcb], [lfo.fc, lfo.lcb], this.fonts);
    const mainEnd = Math.min(fib.ccpText, this.text.length);
    const sections = readSections(word, ...at(FC.plcfSed), this.doc.finalSection);
    this.indexSections(sections);
    this.indexComments(table, at);
    const footStart = fib.ccpText;
    const endStart = fib.ccpText + fib.ccpFtn + fib.ccpHdd + fib.ccpAtn;
    const footRanges = this.noteRanges(at(FC.plcffndRef), at(FC.plcffndTxt), footStart, this.footRefs);
    const endRanges = this.noteRanges(at(FC.plcfendRef), at(FC.plcfendTxt), endStart, this.endRefs);
    const body = this.blocks(0, mainEnd);
    this.doc.body = body.length ? body : [{ type: 'paragraph', props: {}, inlines: [] }];
    const last = sections[sections.length - 1];
    if (last) this.doc.finalSection = last.section;
    this.doc.settings.evenAndOddHeaders = facingPages(...at(FC.dop));
    this.headersFooters(fib, at, sections);
    this.doc.comments = this.readComments(fib, at);
    this.doc.footnotes = footRanges.map(([s, e], i) => ({ id: i + 1, blocks: this.blocks(s, e, 'footnote') }));
    this.doc.endnotes = endRanges.map(([s, e], i) => ({ id: i + 1, blocks: this.blocks(s, e, 'endnote') }));
  }

  /** Fins de section (caractere 0x0c) : CP -> proprietes de la section qui se termine. */
  private indexSections(sections: SectionInfo[]): void {
    sections.slice(0, -1).forEach((info) => this.sectionBreaks.set(info.cpEnd - 1, info.section));
  }

  /** En-tetes et pieds de page : histoire n -> HeaderFooter, references portees par chaque section. */
  private headersFooters(fib: Fib, at: (i: number) => [Uint8Array, number, number], sections: SectionInfo[]): void {
    const base = fib.ccpText + fib.ccpFtn;
    for (const story of readHeaderStories(...at(FC.plcfHdd))) {
      const section = sections[story.section]?.section;
      if (!section || (story.type === 'first' && !section.titlePage) || (story.type === 'even' && !this.doc.settings.evenAndOddHeaders)) continue;
      const blocks = this.blocks(base + story.start, Math.min(base + story.end, this.text.length));
      // L'histoire se termine par une marque de paragraphe supplementaire : le dernier paragraphe vide est retire.
      const tail = blocks[blocks.length - 1];
      if (blocks.length > 1 && tail?.type === 'paragraph' && !tail.inlines.length) blocks.pop();
      const only = blocks[0];
      if (!blocks.length || (blocks.length === 1 && only?.type === 'paragraph' && !only.inlines.length)) continue;
      const id = `${story.kind}${story.section + 1}-${story.type}`;
      this.doc.headersFooters[id] = { id, kind: story.kind, blocks };
      (story.kind === 'header' ? section.headers : section.footers)[story.type] = id;
    }
  }

  /** Repere les marques de commentaires et leurs zones dans le texte principal (CP -> numeros de commentaires). */
  private indexComments(table: Uint8Array, at: (i: number) => [Uint8Array, number, number]): void {
    const refs = readCommentRefs(...at(FC.plcfandRef));
    const bkf = at(FC.plcfAtnBkf);
    const bkl = at(FC.plcfAtnBkl);
    const sttb = at(FC.sttbfAtnBkmk);
    const ranges = readCommentRanges(table, [bkf[1], bkf[2]], [bkl[1], bkl[2]], [sttb[1], sttb[2]]);
    const push = (map: Map<number, number[]>, cp: number, id: number): void => {
      map.set(cp, [...(map.get(cp) ?? []), id]);
    };
    refs.forEach((ref, id) => {
      this.commentRefs.set(ref.cp, id);
      const range = ref.tag !== -1 ? ranges.get(ref.tag) : undefined;
      push(this.commentStarts, range ? range[0] : ref.cp, id);
      push(this.commentEnds, range ? range[1] : ref.cp, id);
    });
  }

  /** Texte des commentaires (histoire des annotations) : un par marque. */
  private readComments(fib: Fib, at: (i: number) => [Uint8Array, number, number]): Comment[] {
    const refs = readCommentRefs(...at(FC.plcfandRef));
    const texts = plcCps(...at(FC.plcfandTxt), 0);
    const authors = readAuthors(...at(FC.grpXstAtnOwners));
    const base = fib.ccpText + fib.ccpFtn + fib.ccpHdd;
    const out: Comment[] = [];
    refs.forEach((ref, id) => {
      const start = texts[id];
      const end = texts[id + 1];
      if (start === undefined || end === undefined || end < start) return;
      const comment: Comment = { id, author: authors[ref.ibst] ?? '', blocks: this.blocks(base + start, Math.min(base + end, this.text.length)) };
      if (ref.initials) comment.initials = ref.initials;
      out.push(comment);
    });
    return out;
  }

  /** Texte sans table des pieces (Word 6/95 ou fichier abime) : une ligne = un paragraphe. */
  private plain(text: string): void {
    const lines = text.split('\r').map((l) => l.replace(/[\u0000-\u0008\u000b-\u001f]/g, ''));
    if (lines[lines.length - 1] === '') lines.pop();
    const body: Block[] = [];
    for (const line of lines) {
      if (!this.budget.takeBlock()) break;
      body.push({ type: 'paragraph', props: {}, inlines: line ? [{ type: 'text', text: line, props: {} }] : [] });
    }
    this.doc.body = body.length ? body : [{ type: 'paragraph', props: {}, inlines: [] }];
  }

  /** Plages de texte des notes ; renseigne `refs` (CP de l'appel -> numero de note). */
  private noteRanges(ref: [Uint8Array, number, number], txt: [Uint8Array, number, number], base: number, refs: Map<number, number>): [number, number][] {
    const refCps = plcCps(...ref, 2).slice(0, -1);
    const txtCps = plcCps(...txt, 0);
    const out: [number, number][] = [];
    refCps.forEach((cp, i) => {
      const start = txtCps[i];
      const end = txtCps[i + 1];
      if (start === undefined || end === undefined || end < start) return;
      refs.set(cp, i + 1);
      out.push([base + start, Math.min(base + end, this.text.length)]);
    });
    return out;
  }

  private charAt(fc: number): CharFormat {
    const range = findRange(this.chpx, fc);
    if (!range || !range.value.length) return NO_FORMAT;
    let format = this.charCache.get(range.value);
    if (!format) {
      format = charFormat(range.value, this.fonts);
      this.charCache.set(range.value, format);
    }
    return format;
  }

  private paraAt(fc: number): { styleId?: string; format: ParaFormat } {
    const range = findRange(this.papx, fc);
    if (!range) return { format: NO_PARA };
    let info = this.paraCache.get(range.value);
    if (!info) {
      const styleId = this.styleId(range.value.istd);
      info = { format: paraFormat(range.value.grpprl) };
      if (styleId) info.styleId = styleId;
      this.paraCache.set(range.value, info);
    }
    return info;
  }

  /** Style d'un paragraphe (istd). */
  private styleId(istd: number): string | undefined {
    const std = this.stds.get(istd);
    if (!std || std.sti === 0) return undefined;
    return this.styleDef(istd);
  }

  /** Style de caracteres (istd) ; le style « Police par defaut » n'en est pas un. */
  private charStyleId(istd: number): string | undefined {
    const std = this.stds.get(istd);
    return std && std.stk === 2 && std.sti !== 65 ? this.styleDef(istd) : undefined;
  }

  /**
   * Cree (ou complete) la definition d'un style du fichier : proprietes de ses UPX, style de base et suivant.
   * Les styles integres du document vierge sont remplaces par ceux du fichier (leur aspect n'est pas celui de Word 97).
   */
  private styleDef(istd: number): string | undefined {
    if (this.styleIds.has(istd)) return this.styleIds.get(istd);
    const std = this.stds.get(istd);
    if (!std) return undefined;
    const paragraph = std.stk !== 2;
    const heading = paragraph && std.sti >= 1 && std.sti <= 9;
    const key = std.name.replace(/[^A-Za-z0-9]/g, '');
    const canonical = canonicalStyleName({ id: key, name: std.name });
    let id: string;
    if (std.sti === 0 && paragraph) id = 'Normal';
    else if (heading) id = `Heading${std.sti}`;
    else id = this.doc.styles.styles.find((s) => s.type === (paragraph ? 'paragraph' : 'character') && (s.id === key || s.name.toLowerCase() === canonical.toLowerCase()))?.id ?? (key || `Style${istd}`);
    this.styleIds.set(istd, id);
    if (std.stk !== 1 && std.stk !== 2) return id;
    const para = std.papx ? paraFormat(std.papx).props : {};
    const run = std.chpx ? charFormat(std.chpx, this.fonts).props : {};
    if (heading && para.outlineLevel === undefined) para.outlineLevel = std.sti - 1;
    const basedOn = std.istdBase !== 0xfff && std.istdBase !== istd ? this.styleDef(std.istdBase) : undefined;
    const next = std.istdNext !== istd && std.istdNext !== 0xfff ? this.styleDef(std.istdNext) : undefined;
    let style = this.doc.styles.styles.find((s) => s.id === id);
    const builtin = style !== undefined && !style.custom;
    if (!style) {
      style = { id, type: paragraph ? 'paragraph' : 'character', name: std.name, custom: true, quickFormat: true } as Style;
      this.doc.styles.styles.push(style);
    }
    if (builtin) {
      // Le style integre garde son nom canonique ; ses proprietes viennent du fichier.
      delete style.paragraph;
      delete style.run;
      delete style.basedOn;
    }
    if (Object.keys(para).length) style.paragraph = para;
    if (Object.keys(run).length) style.run = run;
    if (basedOn && basedOn !== id) style.basedOn = basedOn;
    else if (id !== 'Normal' && !style.basedOn && paragraph) style.basedOn = 'Normal';
    if (next) style.next = next;
    return id;
  }

  /** Convertit les caracteres [start, end) en blocs (paragraphes et tableaux). */
  private blocks(start: number, end: number, note?: 'footnote' | 'endnote'): Block[] {
    const out: Block[] = [];
    const frames: Frame[] = [];
    let inlines: Inline[] = [];
    let table: Table | undefined;
    let row: TableCell[] = [];
    let cell: Block[] = [];
    let runText = '';
    let runFormat: CharFormat = NO_FORMAT;

    const emit = (inline: Inline): void => {
      for (let i = frames.length - 1; i >= 0; i--) {
        const frame = frames[i];
        if (!frame) continue;
        if (frame.phase === 'instr') {
          frame.instruction += inlinesText([inline]);
          return;
        }
        if (!frame.broken) {
          frame.result.push(inline);
          return;
        }
      }
      inlines.push(inline);
    };
    const flushRun = (): void => {
      if (!runText) return;
      const run: TextRun = { type: 'text', text: runText, props: { ...runFormat.props } };
      const charStyle = runFormat.istd !== undefined ? this.charStyleId(runFormat.istd) : undefined;
      if (charStyle) run.styleId = charStyle;
      if (runFormat.revision) run.revision = { kind: runFormat.revision, id: ++this.revisionId, author: '' };
      runText = '';
      emit(run);
    };
    const flushTable = (): void => {
      if (!table) return;
      if (cell.length) row.push({ props: {}, blocks: cell });
      if (row.length) table.rows.push({ props: {}, cells: row });
      const columns = Math.max(1, ...table.rows.map((r) => r.cells.length));
      if (table.grid.length !== columns) table.grid = Array.from({ length: columns }, () => Math.round((TEXT_WIDTH / columns) * 100) / 100);
      out.push(table);
      table = undefined;
      row = [];
      cell = [];
    };
    const endParagraph = (cp: number, cellMark: boolean): Paragraph | undefined => {
      for (const frame of frames) {
        if (frame.phase !== 'result' || frame.broken) continue;
        inlines.push(...frame.result);
        frame.result = [];
        frame.broken = true;
      }
      const { styleId, format } = this.paraAt(this.fcs[cp] ?? 0);
      const paragraph: Paragraph = { type: 'paragraph', props: { ...format.props }, inlines };
      if (styleId) paragraph.styleId = styleId;
      inlines = [];
      if (!this.budget.takeBlock()) {
        this.stopped = true;
        return undefined;
      }
      if (!format.inTable) {
        flushTable();
        out.push(paragraph);
        return paragraph;
      }
      table ??= { type: 'table', styleId: 'TableGrid', props: {}, grid: [], rows: [] };
      if (format.innerRowEnd) return undefined;
      if (format.rowEnd && format.depth <= 1) {
        if (format.cellEdges && format.cellEdges.length > 1 && !table.grid.length) {
          table.grid = format.cellEdges.slice(1).map((edge, i) => twipsToPt(edge - (format.cellEdges?.[i] ?? 0)));
        }
        table.rows.push({ props: {}, cells: row });
        row = [];
        return undefined;
      }
      cell.push(paragraph);
      if (cellMark) {
        row.push({ props: {}, blocks: cell });
        cell = [];
      }
      return paragraph;
    };

    for (let cp = start; cp < end && !this.stopped; cp++) {
      const code = this.text.charCodeAt(cp);
      const closing = this.commentEnds.get(cp);
      const opening = this.commentStarts.get(cp);
      if (closing || opening) {
        flushRun();
        for (const id of closing ?? []) emit({ type: 'commentEnd', commentId: id });
        for (const id of opening ?? []) emit({ type: 'commentStart', commentId: id });
      }
      if (code >= 0x20 || code === 0x1e || code === 0x1f) {
        const format = this.charAt(this.fcs[cp] ?? 0);
        if (format !== runFormat) {
          flushRun();
          runFormat = format;
        }
        if (format.sym) {
          const symbol = this.symbolOf(format, runFormat.props);
          if (typeof symbol === 'string') runText += symbol;
          else {
            flushRun();
            emit(symbol);
          }
          continue;
        }
        runText += code === 0x1e ? '‑' : code === 0x1f ? '­' : this.text[cp];
        continue;
      }
      flushRun();
      switch (code) {
        case 0x01: {
          const format = this.charAt(this.fcs[cp] ?? 0);
          const image = format.special && !format.notPicture && format.picLocation !== undefined ? this.image(format.picLocation) : undefined;
          if (image) emit(image);
          break;
        }
        case 0x05: {
          const id = this.commentRefs.get(cp);
          if (id !== undefined && !note) emit({ type: 'commentRef', commentId: id });
          break;
        }
        case 0x0c: {
          const section = this.sectionBreaks.get(cp);
          if (!section) {
            emit({ type: 'break', kind: 'page' });
            break;
          }
          const ended = endParagraph(cp, false);
          if (ended) ended.sectionBreak = section;
          break;
        }
        case 0x0d: endParagraph(cp, false); break;
        case 0x07: endParagraph(cp, true); break;
        case 0x09: emit({ type: 'tab' }); break;
        case 0x0b: emit({ type: 'break', kind: 'line' }); break;
        case 0x0e: emit({ type: 'break', kind: 'column' }); break;
        case 0x13: frames.push({ instruction: '', result: [], phase: 'instr', broken: false }); break;
        case 0x14: { const top = frames[frames.length - 1]; if (top) top.phase = 'result'; break; }
        case 0x15: {
          const frame = frames.pop();
          if (frame && !frame.broken) emit(this.field(frame));
          break;
        }
        case 0x02: {
          if (note) emit({ type: 'noteMark', kind: note });
          const foot = this.footRefs.get(cp);
          const endnote = this.endRefs.get(cp);
          if (!note && foot) emit({ type: 'footnoteRef', noteId: foot });
          else if (!note && endnote) emit({ type: 'endnoteRef', noteId: endnote });
          break;
        }
        default: break;
      }
    }
    flushRun();
    if (inlines.length) {
      flushTable();
      out.push({ type: 'paragraph', props: {}, inlines });
    }
    flushTable();
    return out;
  }

  /** Caractere d'une police de symboles : Unicode equivalent si connu, sinon caractere symbole (police conservee). */
  private symbolOf(format: CharFormat, props: CharFormat['props']): string | Inline {
    const sym = format.sym;
    const font = this.fonts[sym?.ftc ?? -1] ?? '';
    const code = sym?.char ?? 0;
    const mapped = symbolToUnicode(font, code);
    if (mapped) return mapped;
    return { type: 'symbol', font: font || 'Symbol', char: (code < 0x100 ? 0xf000 | code : code).toString(16).toUpperCase().padStart(4, '0'), props: { ...props } };
  }

  /** Image en ligne (PICF du flux Data) : media enregistre une seule fois par position. */
  private image(location: number): Inline | undefined {
    const picture = readPicture(this.data, location);
    if (!picture || picture.blip.contentType === 'image/x-pict') return undefined;
    let id = this.media.get(location);
    if (!id) {
      id = `image${this.media.size + 1}`;
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/bmp': 'bmp', 'image/tiff': 'tif', 'image/x-emf': 'emf', 'image/x-wmf': 'wmf' }[picture.blip.contentType] ?? 'bin';
      this.media.set(location, id);
      this.doc.media[id] = { id, fileName: `${id}.${ext}`, contentType: picture.blip.contentType, bytes: picture.blip.bytes };
    }
    return { type: 'image', mediaId: id, width: picture.width, height: picture.height };
  }

  private field(frame: Frame): Inline {
    const instruction = frame.instruction.trim();
    const code = fieldCode(instruction);
    if (code === 'HYPERLINK') return fieldHyperlink(instruction, frame.result, this.warnings);
    return { type: 'field', instruction, code, result: frame.result };
  }
}

/** Lit un document Word 97-2003. Leve DocxError si le fichier n'est pas un .doc exploitable ou s'il est chiffre. */
export function readDoc(bytes: Uint8Array, options: ReadDocOptions = {}): ReadResult {
  const limits: ReadLimits = { ...DEFAULT_READ_LIMITS, ...options.limits };
  if (bytes.length > limits.maxInputBytes) throw new DocxError(ERRORS.tooLarge);
  let cfb: CfbFile;
  let word: Uint8Array | undefined;
  try {
    cfb = new CfbFile(bytes);
    word = cfb.stream('WordDocument');
  } catch (error) {
    if (error instanceof CfbError) throw new DocxError(ERRORS.notCfb);
    throw error;
  }
  const fib = word ? readFib(word) : undefined;
  if (!word || !fib) throw new DocxError(ERRORS.notCfb);
  if (fib.encrypted) throw new DocxError(WARNINGS.docEncrypted);
  const reader = new DocReader(limits);
  const safeStream = (name: string): Uint8Array | undefined => {
    try {
      return cfb.stream(name);
    } catch (error) {
      if (!(error instanceof CfbError)) throw error;
      reader.warnings.add('part-unreadable', WARNINGS.partUnreadable(name));
      return undefined;
    }
  };
  reader.read(word, safeStream(fib.tableStream), fib, safeStream('Data') ?? new Uint8Array(0));
  const summary = safeStream('\u0005SummaryInformation');
  if (summary) readSummary(summary, reader.doc.properties);
  reader.warnings.add('doc-text-only', WARNINGS.docTextOnly);
  return { document: reader.doc, warnings: reader.warnings.list };
}
