// Ecriture RTF : lisible par Word, WordPad, LibreOffice. Styles, listes, tableaux, images PNG/JPEG/EMF/WMF,
// liens, champs, notes, en-tetes / pieds, sections.
import type {
  Block, Border, Inline, NumberingLevel, Paragraph, ParagraphProps, RunProps, Section, Style, Table, WordDocument,
} from '../model.ts';
import { effectiveRunProps } from '../resolve.ts';
import { sanitizeUrl } from '../security.ts';
import { sectionsOf } from '../text.ts';
import { ptToTwips } from '../units.ts';
import { FORMAT_TO_NFC, HIGHLIGHT_RGB, LANG_TO_LCID } from './header.ts';

const encoder1252 = (() => {
  const map = new Map<number, number>();
  const decoder = new TextDecoder('windows-1252');
  for (let b = 0x80; b <= 0xff; b++) map.set(decoder.decode(new Uint8Array([b])).charCodeAt(0), b);
  return map;
})();

/** Echappe un texte RTF (\'hh pour Windows-1252, \uN? au-dela). */
export function escapeRtf(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '\\' || ch === '{' || ch === '}') out += `\\${ch}`;
    else if (ch === '\t') out += '\\tab ';
    else if (ch === '\n') out += '\\line ';
    else if (ch === '\u00a0') out += '\\~';
    else if (ch === '\u00ad') out += '\\-';
    else if (ch === '\u2011') out += '\\_';
    else if (code < 0x20) continue;
    else if (code < 0x80) out += ch;
    else if (encoder1252.has(code)) out += `\\'${(encoder1252.get(code) ?? 0x3f).toString(16)}`;
    else if (code > 0xffff) {
      for (const unit of [Math.floor((code - 0x10000) / 0x400) + 0xd800, ((code - 0x10000) % 0x400) + 0xdc00]) out += `\\u${unit - 65536}?`;
    } else out += `\\u${code > 32767 ? code - 65536 : code}?`;
  }
  return out;
}

const BORDER_WORDS: Readonly<Record<string, string>> = {
  single: 'brdrs', thick: 'brdrth', double: 'brdrdb', dotted: 'brdrdot', dashed: 'brdrdash', triple: 'brdrtriple',
  wave: 'brdrwavy', inset: 'brdrinset', outset: 'brdroutset', none: 'brdrnone', dotDash: 'brdrdashd', dotDotDash: 'brdrdashdd',
};

const UNDERLINE_WORDS: Readonly<Record<string, string>> = {
  single: 'ul', dotted: 'uld', dash: 'uldash', dotDash: 'uldashd', dotDotDash: 'uldashdd', double: 'uldb', thick: 'ulth',
  words: 'ulw', wave: 'ulwave', wavyDouble: 'ululdbwave', wavyHeavy: 'ulhwave', dashLong: 'ulldash', dottedHeavy: 'ulthd',
  dashedHeavy: 'ulthdash', dashDotHeavy: 'ulthdashd', dashDotDotHeavy: 'ulthdashdd', dashLongHeavy: 'ulthldash',
};

class RtfWriter {
  private readonly doc: WordDocument;
  private readonly fonts: string[] = [];
  private readonly colors: string[] = [];
  private readonly styleNumbers = new Map<string, number>();
  private readonly out: string[] = [];
  /** Paragraphe de fin de section -> proprietes de la section suivante. */
  private readonly nextSection = new Map<Paragraph, Section>();

  constructor(doc: WordDocument) {
    this.doc = doc;
    let n = 0;
    for (const style of doc.styles.styles) {
      if (style.type === 'paragraph' || style.type === 'character') this.styleNumbers.set(style.id, style.isDefault && style.type === 'paragraph' ? 0 : ++n);
    }
  }

  private font(name: string | undefined): number {
    const font = name ?? this.doc.theme.minorFont;
    let i = this.fonts.indexOf(font);
    if (i < 0) i = this.fonts.push(font) - 1;
    return i;
  }

  private color(hex: string | undefined): number {
    if (!hex || hex === 'auto') return 0;
    let i = this.colors.indexOf(hex.toUpperCase());
    if (i < 0) i = this.colors.push(hex.toUpperCase()) - 1;
    return i + 1;
  }

  private border(prefix: string, border: Border | undefined): string {
    if (!border) return '';
    return `\\${prefix}\\${BORDER_WORDS[border.style] ?? 'brdrs'}\\brdrw${ptToTwips(border.width)}${border.color !== 'auto' ? `\\brdrcf${this.color(border.color)}` : ''}${border.space ? `\\brsp${ptToTwips(border.space)}` : ''}`;
  }

  runProps(props: RunProps): string {
    let s = '';
    const font = props.fontTheme ? (props.fontTheme === 'major' ? this.doc.theme.majorFont : this.doc.theme.minorFont) : props.font;
    if (font) s += `\\f${this.font(font)}`;
    if (props.size !== undefined) s += `\\fs${Math.round(props.size * 2)}`;
    if (props.bold !== undefined) s += props.bold ? '\\b' : '\\b0';
    if (props.italic !== undefined) s += props.italic ? '\\i' : '\\i0';
    if (props.underline) s += props.underline === 'none' ? '\\ulnone' : `\\${UNDERLINE_WORDS[props.underline] ?? 'ul'}`;
    if (props.strike) s += '\\strike';
    if (props.doubleStrike) s += '\\striked1';
    if (props.caps) s += '\\caps';
    if (props.smallCaps) s += '\\scaps';
    if (props.hidden) s += '\\v';
    if (props.outline) s += '\\outl';
    if (props.shadow) s += '\\shad';
    if (props.emboss) s += '\\embo';
    if (props.imprint) s += '\\impr';
    if (props.color && props.color.rgb !== 'auto') s += `\\cf${this.color(props.color.rgb)}`;
    if (props.highlight && props.highlight !== 'none') s += `\\highlight${this.color(HIGHLIGHT_RGB[props.highlight])}`;
    if (props.shading && props.shading.fill !== 'auto') s += `\\chcbpat${this.color(props.shading.fill)}`;
    if (props.vertAlign === 'superscript') s += '\\super';
    if (props.vertAlign === 'subscript') s += '\\sub';
    if (props.position) s += props.position > 0 ? `\\up${Math.round(props.position * 2)}` : `\\dn${Math.round(-props.position * 2)}`;
    if (props.spacing) s += `\\expndtw${ptToTwips(props.spacing)}`;
    if (props.scale && props.scale !== 100) s += `\\charscalex${Math.round(props.scale)}`;
    if (props.kerning) s += `\\kerning${Math.round(props.kerning * 2)}`;
    const lcid = props.lang ? LANG_TO_LCID[props.lang.toLowerCase()] : undefined;
    if (lcid) s += `\\lang${lcid}`;
    return s;
  }

  paragraphProps(props: ParagraphProps): string {
    let s = '';
    const align = { left: 'ql', center: 'qc', right: 'qr', justify: 'qj', distribute: 'qd' }[props.alignment ?? 'left'];
    if (props.alignment) s += `\\${align}`;
    if (props.indentLeft) s += `\\li${ptToTwips(props.indentLeft)}`;
    if (props.indentRight) s += `\\ri${ptToTwips(props.indentRight)}`;
    if (props.indentFirstLine) s += `\\fi${ptToTwips(props.indentFirstLine)}`;
    if (props.spacingBefore !== undefined) s += `\\sb${ptToTwips(props.spacingBefore)}`;
    if (props.spacingAfter !== undefined) s += `\\sa${ptToTwips(props.spacingAfter)}`;
    const line = props.lineSpacing;
    if (line) s += line.rule === 'auto' ? `\\sl${Math.round(line.value * 240)}\\slmult1` : `\\sl${line.rule === 'exact' ? -ptToTwips(line.value) : ptToTwips(line.value)}\\slmult0`;
    if (props.keepNext) s += '\\keepn';
    if (props.keepLines) s += '\\keep';
    if (props.pageBreakBefore) s += '\\pagebb';
    if (props.widowControl === false) s += '\\nowidctlpar';
    if (props.outlineLevel !== undefined) s += `\\outlinelevel${props.outlineLevel}`;
    if (props.contextualSpacing) s += '\\contextualspace';
    if (props.bidi) s += '\\rtlpar';
    for (const tab of props.tabs ?? []) {
      const align = { right: '\\tqr', center: '\\tqc', decimal: '\\tqdec' }[tab.align as 'right'] ?? '';
      const leader = tab.leader && tab.leader !== 'none' ? `\\tl${{ dot: 'dot', hyphen: 'hyph', underscore: 'ul', heavy: 'th', middleDot: 'mdot' }[tab.leader]}` : '';
      s += tab.align === 'bar' ? `\\tb${ptToTwips(tab.position)}` : `${align}${leader}\\tx${ptToTwips(tab.position)}`;
    }
    const b = props.borders;
    if (b) {
      s += this.border('brdrt', b.top) + this.border('brdrb', b.bottom) + this.border('brdrl', b.left) + this.border('brdrr', b.right) + this.border('brdrbtw', b.between);
    }
    if (props.shading && props.shading.fill !== 'auto') s += `\\cbpat${this.color(props.shading.fill)}`;
    if (props.numbering && props.numbering.numId) s += `\\ls${props.numbering.numId}\\ilvl${props.numbering.level}`;
    return s;
  }

  // ---- Contenu ----

  private inlines(inlines: readonly Inline[], paragraph: Paragraph): string {
    let s = '';
    for (const inline of inlines) {
      if ('revision' in inline && inline.revision && (inline.revision.kind === 'delete' || inline.revision.kind === 'moveFrom')) continue;
      switch (inline.type) {
        case 'text': {
          const style = inline.styleId ? this.styleNumbers.get(inline.styleId) : undefined;
          const props = inline.styleId ? effectiveRunProps(this.doc, { styleId: undefined }, { styleId: inline.styleId, props: inline.props }) : inline.props;
          const head = `${style !== undefined ? `\\cs${style}` : ''}${this.runProps(props)}`;
          s += `{${head}${head ? ' ' : ''}${escapeRtf(inline.text)}}`;
          break;
        }
        case 'tab': s += '\\tab '; break;
        case 'break': s += inline.kind === 'page' ? '\\page ' : inline.kind === 'column' ? '\\column ' : '\\line '; break;
        case 'symbol': s += `{\\f${this.font(inline.font)} \\u${Number.parseInt(inline.char, 16) & 0xff}?}`; break;
        case 'hyperlink': {
          const url = sanitizeUrl(inline.url);
          const target = url ? `"${url.replace(/"/g, '%22')}"` : '';
          const anchor = inline.anchor ? ` \\l "${inline.anchor}"` : '';
          s += `{\\field{\\*\\fldinst{HYPERLINK ${escapeRtf(target)}${escapeRtf(anchor)}}}{\\fldrslt{${this.inlines(inline.inlines, paragraph)}}}}`;
          break;
        }
        case 'field': s += `{\\field{\\*\\fldinst{${escapeRtf(inline.instruction)}}}{\\fldrslt{${this.inlines(inline.result, paragraph)}}}}`; break;
        case 'image': s += this.image(inline.mediaId, inline.width, inline.height); break;
        case 'footnoteRef':
        case 'endnoteRef': {
          const list = inline.type === 'footnoteRef' ? this.doc.footnotes : this.doc.endnotes;
          const note = list.find((n) => n.id === inline.noteId);
          if (!note) break;
          const alt = inline.type === 'endnoteRef' ? '\\ftnalt' : '';
          s += `{\\super\\chftn}{\\footnote${alt}\\pard\\plain ${this.blocks(note.blocks, true)}}`;
          break;
        }
        case 'noteMark': s += '{\\super\\chftn}'; break;
        case 'bookmarkStart': s += `{\\*\\bkmkstart ${escapeRtf(inline.name)}}`; break;
        case 'bookmarkEnd': {
          const start = paragraph.inlines.find((i) => i.type === 'bookmarkStart' && i.id === inline.id);
          if (start && start.type === 'bookmarkStart') s += `{\\*\\bkmkend ${escapeRtf(start.name)}}`;
          break;
        }
        case 'inlineControl': s += this.inlines(inline.inlines, paragraph); break;
        case 'equation': s += escapeRtf(inline.text); break;
        case 'shape': if (inline.text) s += this.blocks(inline.text, true).replace(/\\par\s*$/, ''); break;
        default: break;
      }
    }
    return s;
  }

  private image(mediaId: string, width: number, height: number): string {
    const media = this.doc.media[mediaId];
    if (!media) return '';
    const kind = { 'image/png': 'pngblip', 'image/jpeg': 'jpegblip', 'image/x-emf': 'emfblip', 'image/x-wmf': 'wmetafile8' }[media.contentType];
    if (!kind) return '';
    let hex = '';
    for (let i = 0; i < media.bytes.length; i++) {
      hex += (media.bytes[i] ?? 0).toString(16).padStart(2, '0');
      if (i % 64 === 63) hex += '\r\n';
    }
    const w = ptToTwips(width);
    const h = ptToTwips(height);
    return `{\\*\\shppict{\\pict\\${kind}\\picw${Math.round(width / 0.75)}\\pich${Math.round(height / 0.75)}\\picwgoal${w}\\pichgoal${h}\r\n${hex}}}`;
  }

  private paragraph(p: Paragraph, inTable: boolean, last: boolean): string {
    const style = p.styleId ? this.styleNumbers.get(p.styleId) : undefined;
    const styleDef = p.styleId ? this.doc.styles.styles.find((s) => s.id === p.styleId) : undefined;
    // Le style est repete en mise en forme directe (convention RTF : les lecteurs simples l'ignorent sinon).
    const props = { ...styleDef?.paragraph, ...p.props };
    const head = `\\pard\\plain${style !== undefined ? `\\s${style}` : ''}${inTable ? '\\intbl' : ''}${this.paragraphProps(props)}`;
    const styleRunProps = styleDef?.run ? this.runProps(styleDef.run) : '';
    const styleRun = styleRunProps ? `{${styleRunProps} ` : '';
    const body = styleRun ? `${styleRun}${this.inlines(p.inlines, p)}}` : this.inlines(p.inlines, p);
    let section = '';
    const next = this.nextSection.get(p);
    if (p.sectionBreak && next) section = `\\sect${this.section(next)}`;
    return `${head} ${body}${inTable && last ? '\\cell' : '\\par'}${section}\r\n`;
  }

  private table(t: Table): string {
    let s = '';
    for (const row of t.rows) {
      let def = `\\trowd\\trgaph108${t.props.indent ? `\\trleft${ptToTwips(t.props.indent)}` : ''}`;
      if (t.props.alignment === 'center') def += '\\trqc';
      if (t.props.alignment === 'right') def += '\\trqr';
      if (row.props.header) def += '\\trhdr';
      if (row.props.cantSplit) def += '\\trkeep';
      if (row.props.height) def += `\\trrh${row.props.height.rule === 'exact' ? -ptToTwips(row.props.height.value) : ptToTwips(row.props.height.value)}`;
      let x = ptToTwips(t.props.indent ?? 0);
      let col = 0;
      const tableBorders = t.props.borders ?? (t.styleId === 'TableGrid' ? { top: grid(), bottom: grid(), left: grid(), right: grid() } : undefined);
      for (const cell of row.cells) {
        const span = cell.props.gridSpan ?? 1;
        let width = 0;
        for (let i = 0; i < span; i++) width += t.grid[col + i] ?? 0;
        if (!width) width = cell.props.width?.type === 'pt' ? cell.props.width.value : 100;
        col += span;
        x += ptToTwips(width);
        if (cell.props.vMerge === 'restart') def += '\\clvmgf';
        if (cell.props.vMerge === 'continue') def += '\\clvmrg';
        const va = cell.props.verticalAlign;
        if (va) def += va === 'center' ? '\\clvertalc' : va === 'bottom' ? '\\clvertalb' : '\\clvertalt';
        const b = cell.props.borders ?? tableBorders;
        if (b) def += this.border('clbrdrt', b.top) + this.border('clbrdrl', b.left) + this.border('clbrdrb', b.bottom) + this.border('clbrdrr', b.right);
        if (cell.props.shading && cell.props.shading.fill !== 'auto') def += `\\clcbpat${this.color(cell.props.shading.fill)}`;
        def += `\\cellx${x}`;
      }
      s += `${def}\r\n`;
      for (const cell of row.cells) {
        const blocks = cell.blocks.filter((b): b is Paragraph => b.type === 'paragraph');
        if (!blocks.length) s += '\\pard\\intbl \\cell\r\n';
        blocks.forEach((p, i) => { s += this.paragraph(p, true, i === blocks.length - 1); });
      }
      s += `${def}\\row\r\n`;
    }
    return s;
  }

  blocks(blocks: readonly Block[], note = false): string {
    let s = '';
    for (const block of blocks) {
      if (block.type === 'paragraph') s += this.paragraph(block, false, false);
      else if (block.type === 'table') s += note ? '' : this.table(block);
      else if (block.type === 'contentControl' || block.type === 'toc') s += this.blocks(block.blocks, note);
    }
    return s;
  }

  section(section: Section): string {
    let s = '\\sectd';
    s += `\\pgwsxn${ptToTwips(section.pageWidth)}\\pghsxn${ptToTwips(section.pageHeight)}`;
    const m = section.margins;
    s += `\\marglsxn${ptToTwips(m.left)}\\margrsxn${ptToTwips(m.right)}\\margtsxn${ptToTwips(m.top)}\\margbsxn${ptToTwips(m.bottom)}`;
    s += `\\headery${ptToTwips(m.header)}\\footery${ptToTwips(m.footer)}`;
    if (m.gutter) s += `\\guttersxn${ptToTwips(m.gutter)}`;
    if (section.orientation === 'landscape') s += '\\lndscpsxn';
    if (section.columns.count > 1) s += `\\cols${section.columns.count}\\colsx${ptToTwips(section.columns.space)}${section.columns.separator ? '\\linebetcol' : ''}`;
    s += { continuous: '\\sbknone', nextColumn: '\\sbkcol', evenPage: '\\sbkeven', oddPage: '\\sbkodd', nextPage: '\\sbkpage' }[section.breakType];
    if (section.titlePage) s += '\\titlepg';
    if (section.pageNumbering?.start !== undefined) s += `\\pgnstarts${section.pageNumbering.start}\\pgnrestart`;
    if (section.verticalAlign === 'center') s += '\\vertalc';
    s += ' ';
    for (const [word, refs] of [['header', section.headers], ['footer', section.footers]] as const) {
      for (const [type, suffix] of [['default', ''], ['first', 'f'], ['even', 'l']] as const) {
        const id = refs[type];
        const hf = id ? this.doc.headersFooters[id] : undefined;
        if (hf) s += `{\\${word}${suffix} ${this.blocks(hf.blocks)}}`;
      }
    }
    return s;
  }

  private listTable(): string {
    const numbering = this.doc.numbering;
    if (!numbering.abstracts.length) return '';
    const level = (l: NumberingLevel): string => {
      const parts: string[] = [];
      const numbers: number[] = [];
      let text = '';
      for (let i = 0; i < l.text.length; i++) {
        const ch = l.text[i] ?? '';
        const next = l.text[i + 1] ?? '';
        if (ch === '%' && /[1-9]/.test(next)) {
          numbers.push(text.length + 1);
          text += String.fromCharCode(Number(next) - 1);
          i++;
        } else text += ch;
      }
      for (const ch of text) parts.push(ch.charCodeAt(0) < 9 ? `\\'0${ch.charCodeAt(0)}` : escapeRtf(ch));
      const len = `\\'${text.length.toString(16).padStart(2, '0')}`;
      const nums = numbers.map((n) => `\\'${n.toString(16).padStart(2, '0')}`).join('');
      const indent = l.paragraph ? `\\fi${ptToTwips(l.paragraph.indentFirstLine ?? 0)}\\li${ptToTwips(l.paragraph.indentLeft ?? 0)}` : `\\fi-360\\li${720 + l.level * 360}`;
      const nfc = FORMAT_TO_NFC[l.format] ?? 0;
      return `{\\listlevel\\levelnfc${nfc}\\levelnfcn${nfc}\\leveljc${l.alignment === 'center' ? 1 : l.alignment === 'right' ? 2 : 0}\\levelfollow${l.suffix === 'space' ? 1 : l.suffix === 'nothing' ? 2 : 0}\\levelstartat${l.start}{\\leveltext${len}${parts.join('')};}{\\levelnumbers${nums};}${indent}}`;
    };
    const lists = numbering.abstracts.map((a) => `{\\list\\listtemplateid${a.id + 1}${a.levels.length <= 1 ? '\\listsimple1' : ''}${a.levels.map(level).join('')}{\\listname ;}\\listid${a.id + 1}}`).join('');
    const overrides = numbering.instances.map((n) => `{\\listoverride\\listid${n.abstractId + 1}\\listoverridecount0\\ls${n.id}}`).join('');
    return `{\\*\\listtable ${lists}}\r\n{\\*\\listoverridetable ${overrides}}\r\n`;
  }

  private styleSheet(): string {
    const entries = this.doc.styles.styles.filter((st) => this.styleNumbers.has(st.id)).map((st: Style) => {
      const n = this.styleNumbers.get(st.id) ?? 0;
      const based = st.basedOn ? this.styleNumbers.get(st.basedOn) : undefined;
      const next = st.next ? this.styleNumbers.get(st.next) : undefined;
      const head = st.type === 'character' ? `\\*\\cs${n}\\additive` : `\\s${n}`;
      return `{${head}${based !== undefined ? `\\sbasedon${based}` : ''}${next !== undefined ? `\\snext${next}` : ''}${st.paragraph ? this.paragraphProps(st.paragraph) : ''}${st.run ? this.runProps(st.run) : ''} ${escapeRtf(st.name)};}`;
    });
    return `{\\stylesheet${entries.join('')}}\r\n`;
  }

  private info(): string {
    const p = this.doc.properties;
    const entry = (word: string, value: string | undefined): string => (value ? `{\\${word} ${escapeRtf(value)}}` : '');
    const date = (word: string, iso: string | undefined): string => {
      const d = iso ? new Date(iso) : undefined;
      if (!d || Number.isNaN(d.getTime())) return '';
      return `{\\${word}\\yr${d.getUTCFullYear()}\\mo${d.getUTCMonth() + 1}\\dy${d.getUTCDate()}\\hr${d.getUTCHours()}\\min${d.getUTCMinutes()}}`;
    };
    return `{\\info${entry('title', p.title)}${entry('subject', p.subject)}${entry('author', p.creator)}${entry('keywords', p.keywords)}${entry('doccomm', p.description)}${entry('operator', p.lastModifiedBy)}${entry('company', p.company)}${entry('manager', p.manager)}${entry('category', p.category)}${date('creatim', p.created)}${date('revtim', p.modified)}}\r\n`;
  }

  write(): string {
    const doc = this.doc;
    const defaults = doc.styles.docDefaults.run;
    const defaultFont = this.font(defaults.fontTheme ? (defaults.fontTheme === 'major' ? doc.theme.majorFont : doc.theme.minorFont) : defaults.font);
    // Le corps est ecrit d'abord : il remplit les tables de polices et de couleurs.
    const sections = sectionsOf(doc);
    sections.forEach((entry, i) => {
      const last = entry.blocks[entry.blocks.length - 1];
      const next = sections[i + 1];
      if (last?.type === 'paragraph' && next) this.nextSection.set(last, next.section);
    });
    const first = this.section(sections[0]?.section ?? doc.finalSection);
    const body = this.blocks(doc.body);
    const lists = this.listTable();
    const styles = this.styleSheet();
    const info = this.info();
    const lang = LANG_TO_LCID[(doc.settings.language ?? 'fr-FR').toLowerCase()] ?? 1036;
    const fontTable = this.fonts.map((f, i) => `{\\f${i}\\fnil\\fcharset0 ${escapeRtf(f)};}`).join('');
    const colorTable = `;${this.colors.map((c) => `\\red${Number.parseInt(c.slice(0, 2), 16)}\\green${Number.parseInt(c.slice(2, 4), 16)}\\blue${Number.parseInt(c.slice(4, 6), 16)};`).join('')}`;
    const s = doc.finalSection;
    const m = s.margins;
    this.out.push(
      `{\\rtf1\\ansi\\ansicpg1252\\deff${defaultFont}\\deflang${lang}\\uc1\r\n`,
      `{\\fonttbl${fontTable}}\r\n{\\colortbl${colorTable}}\r\n`,
      styles, lists, info,
      `{\\*\\generator ForgeOffice Texte;}\\viewkind4\\deftab${ptToTwips(doc.settings.defaultTabStop)}`,
      `\\paperw${ptToTwips(s.pageWidth)}\\paperh${ptToTwips(s.pageHeight)}\\margl${ptToTwips(m.left)}\\margr${ptToTwips(m.right)}\\margt${ptToTwips(m.top)}\\margb${ptToTwips(m.bottom)}`,
      `${s.orientation === 'landscape' ? '\\landscape' : ''}${doc.settings.evenAndOddHeaders ? '\\facingp' : ''}${doc.settings.mirrorMargins ? '\\margmirror' : ''}\r\n`,
      `${first}\r\n`,
      `${defaults.size ? `\\fs${Math.round(defaults.size * 2)}` : ''}\r\n`,
      body,
      '}',
    );
    return this.out.join('');
  }
}

const grid = (): Border => ({ style: 'single', width: 0.5, color: 'auto', space: 0 });

/** Ecrit le document en RTF (octets ASCII). */
export function writeRtf(doc: WordDocument): Uint8Array {
  return new TextEncoder().encode(new RtfWriter(doc).write());
}
