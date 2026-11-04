// Lecture des documents Word 97-2003 (.doc) : texte (table des pieces), mise en forme de base des caracteres et
// paragraphes, styles de titre, tableaux (imbriques aplatis), champs (liens surs), notes de bas de page et de fin,
// proprietes du document. Non recuperes : images, en-tetes / pieds, commentaires, numeros de listes, sections.
import type { Block, Inline, Paragraph, ReadResult, Table, TableCell, TextRun } from '../model.ts';
import { createBlankDocument } from '../blank.ts';
import { DocxError } from '../docx/reader.ts';
import { fieldCode } from '../docx/read-body.ts';
import { Budget, DEFAULT_READ_LIMITS, fieldHyperlink, Warnings, type ReadLimits } from '../security.ts';
import { ERRORS, WARNINGS } from '../strings.ts';
import { inlinesText } from '../text.ts';
import { twipsToPt } from '../units.ts';
import { CfbError, CfbFile } from './cfb.ts';
import {
  charFormat, decode1252, decodePieces, FC, findRange, paraFormat, plcCps, readChpx, readFib, readFontNames, readPapx,
  readPieces, readStyleNames, readSummary, type CharFormat, type FcRange, type Fib, type ParaFormat, type Papx,
} from './structures.ts';

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
  private styleNames = new Map<number, { sti: number; name: string }>();
  private readonly footRefs = new Map<number, number>();
  private readonly endRefs = new Map<number, number>();
  private revisionId = 0;
  private stopped = false;

  constructor(limits: ReadLimits) {
    this.budget = new Budget(limits, this.warnings);
  }

  read(word: Uint8Array, table: Uint8Array | undefined, fib: Fib): void {
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
    this.styleNames = readStyleNames(...at(FC.stshf));
    this.chpx = readChpx(word, ...at(FC.plcfBteChpx));
    this.papx = readPapx(word, ...at(FC.plcfBtePapx));
    const mainEnd = Math.min(fib.ccpText, this.text.length);
    const footStart = fib.ccpText;
    const endStart = fib.ccpText + fib.ccpFtn + fib.ccpHdd + fib.ccpAtn;
    const footRanges = this.noteRanges(at(FC.plcffndRef), at(FC.plcffndTxt), footStart, this.footRefs);
    const endRanges = this.noteRanges(at(FC.plcfendRef), at(FC.plcfendTxt), endStart, this.endRefs);
    const body = this.blocks(0, mainEnd);
    this.doc.body = body.length ? body : [{ type: 'paragraph', props: {}, inlines: [] }];
    this.doc.footnotes = footRanges.map(([s, e], i) => ({ id: i + 1, blocks: this.blocks(s, e, 'footnote') }));
    this.doc.endnotes = endRanges.map(([s, e], i) => ({ id: i + 1, blocks: this.blocks(s, e, 'endnote') }));
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

  /** Style de paragraphe : titres integres (sti 1..9), styles connus par leur nom, sinon style personnalise. */
  private styleId(istd: number): string | undefined {
    if (this.styleIds.has(istd)) return this.styleIds.get(istd);
    const info = this.styleNames.get(istd);
    let id: string | undefined;
    if (info && info.sti >= 1 && info.sti <= 9) id = `Heading${info.sti}`;
    else if (info && info.sti !== 0 && info.name) {
      const key = info.name.replace(/[^A-Za-z0-9]/g, '');
      const known = this.doc.styles.styles.find((s) => s.type === 'paragraph' && (s.id === key || s.name.toLowerCase() === info.name.toLowerCase()));
      id = known?.id ?? (key || `Style${istd}`);
      if (!known) this.doc.styles.styles.push({ id, type: 'paragraph', name: info.name, basedOn: 'Normal', custom: true, quickFormat: true });
    }
    this.styleIds.set(istd, id);
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
    const endParagraph = (cp: number, cellMark: boolean): void => {
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
        return;
      }
      if (!format.inTable) {
        flushTable();
        out.push(paragraph);
        return;
      }
      table ??= { type: 'table', styleId: 'TableGrid', props: {}, grid: [], rows: [] };
      if (format.innerRowEnd) return;
      if (format.rowEnd && format.depth <= 1) {
        if (format.cellEdges && format.cellEdges.length > 1 && !table.grid.length) {
          table.grid = format.cellEdges.slice(1).map((edge, i) => twipsToPt(edge - (format.cellEdges?.[i] ?? 0)));
        }
        table.rows.push({ props: {}, cells: row });
        row = [];
        return;
      }
      cell.push(paragraph);
      if (cellMark) {
        row.push({ props: {}, blocks: cell });
        cell = [];
      }
    };

    for (let cp = start; cp < end && !this.stopped; cp++) {
      const code = this.text.charCodeAt(cp);
      if (code >= 0x20 || code === 0x1e || code === 0x1f) {
        const format = this.charAt(this.fcs[cp] ?? 0);
        if (format !== runFormat) {
          flushRun();
          runFormat = format;
        }
        runText += code === 0x1e ? '‑' : code === 0x1f ? '­' : this.text[cp];
        continue;
      }
      flushRun();
      switch (code) {
        case 0x0d: endParagraph(cp, false); break;
        case 0x07: endParagraph(cp, true); break;
        case 0x09: emit({ type: 'tab' }); break;
        case 0x0b: emit({ type: 'break', kind: 'line' }); break;
        case 0x0c: emit({ type: 'break', kind: 'page' }); break;
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
  reader.read(word, safeStream(fib.tableStream), fib);
  const summary = safeStream('\u0005SummaryInformation');
  if (summary) readSummary(summary, reader.doc.properties);
  reader.warnings.add('doc-text-only', WARNINGS.docTextOnly);
  return { document: reader.doc, warnings: reader.warnings.list };
}
