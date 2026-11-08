// Lecture du contenu WordprocessingML (corps, en-tetes, notes, commentaires) vers les blocs du modele.
import { attr, boolAttr, child, children, descendants, isElement, numAttr, textOf, type XmlElement } from '@forgeoffice/opc';
import type {
  Block, ContentControlKind, ContentControlProps, Field, FieldChar, Floating, FloatPosition, FormatChange, ImageInline,
  Inline, Paragraph, Revision, RunProps, ShapeInline, StoredRel, Table, TableCell, TableRow, WrapType,
} from '../model.ts';
import { Budget, checkedUrl, type Warnings } from '../security.ts';
import { emuToPt, twipsToPt } from '../units.ts';
import {
  compact, parseCellProps, parseParagraphProps, parseRowProps, parseRunProps, parseSection, parseTableProps,
} from './read-props.ts';

/** Contexte de lecture d'une partie de contenu. */
export interface PartContext {
  /** r:id -> relation conservee (cible chargee). */
  rels: Map<string, StoredRel>;
  /** r:id d'image -> identifiant de media. */
  images: Map<string, string>;
  /** r:id d'en-tete / pied -> identifiant de Document.headersFooters. */
  headerIds: Map<string, string>;
  budget: Budget;
  warnings: Warnings;
}

type Token = Inline | { type: 'instr'; text: string };

const revisionOf = (el: XmlElement, kind: Revision['kind']): Revision => compact({
  kind, id: numAttr(el, 'w:id') ?? 0, author: attr(el, 'w:author') ?? '', date: attr(el, 'w:date'),
});

const REVISION_TAGS: Readonly<Record<string, Revision['kind']>> = {
  'w:ins': 'insert', 'w:del': 'delete', 'w:moveFrom': 'moveFrom', 'w:moveTo': 'moveTo',
};

function formatChangeOf<P>(el: XmlElement | undefined, parse: (props: XmlElement | undefined) => P, inner: string): FormatChange<P> | undefined {
  if (!el) return undefined;
  return compact({ id: numAttr(el, 'w:id') ?? 0, author: attr(el, 'w:author') ?? '', date: attr(el, 'w:date'), previous: parse(child(el, inner)) });
}

/** Relations referencees par un element brut (r:id, r:embed, r:link...). */
function rawRels(xml: XmlElement, ctx: PartContext): Record<string, StoredRel> | undefined {
  const out: Record<string, StoredRel> = {};
  const visit = (node: XmlElement): void => {
    for (const [key, value] of Object.entries(node.attrs)) {
      const rel = key.startsWith('r:') ? ctx.rels.get(value) : undefined;
      if (rel) out[value] = rel;
    }
    for (const kid of node.children) if (isElement(kid)) visit(kid);
  };
  visit(xml);
  return Object.keys(out).length ? out : undefined;
}

const raw = (xml: XmlElement, ctx: PartContext): { type: 'raw'; xml: XmlElement; rels?: Record<string, StoredRel> } =>
  compact({ type: 'raw' as const, xml, rels: rawRels(xml, ctx) });

// ---- Controles de contenu ----

export function parseSdtProps(sdtPr: XmlElement | undefined): ContentControlProps {
  let kind: ContentControlKind = 'richText';
  if (!sdtPr) return { kind };
  const checkbox = child(sdtPr, 'w14:checkbox');
  const list = child(sdtPr, 'w:dropDownList') ?? child(sdtPr, 'w:comboBox');
  const date = child(sdtPr, 'w:date');
  const docPart = child(sdtPr, 'w:docPartObj') ?? child(sdtPr, 'w:docPartList');
  if (checkbox) kind = 'checkbox';
  else if (list) kind = list.name === 'w:comboBox' ? 'comboBox' : 'dropDown';
  else if (date) kind = 'date';
  else if (child(sdtPr, 'w:picture')) kind = 'picture';
  else if (child(sdtPr, 'w:group')) kind = 'group';
  else if (docPart) kind = 'docPart';
  else if (child(sdtPr, 'w:citation')) kind = 'citation';
  else if (child(sdtPr, 'w:bibliography')) kind = 'bibliography';
  else if (child(sdtPr, 'w15:repeatingSection')) kind = 'repeatingSection';
  else if (child(sdtPr, 'w:text')) kind = 'plainText';
  const lock = attr(child(sdtPr, 'w:lock'), 'w:val');
  return compact<ContentControlProps>({
    kind,
    id: numAttr(child(sdtPr, 'w:id'), 'w:val'),
    tag: attr(child(sdtPr, 'w:tag'), 'w:val'),
    alias: attr(child(sdtPr, 'w:alias'), 'w:val'),
    checked: checkbox ? attr(child(checkbox, 'w14:checked'), 'w14:val') === '1' : undefined,
    items: list ? children(list, 'w:listItem').map((li) => ({ display: attr(li, 'w:displayText') ?? attr(li, 'w:value') ?? '', value: attr(li, 'w:value') ?? '' })) : undefined,
    dateFormat: attr(child(date, 'w:dateFormat'), 'w:val'),
    docPartGallery: attr(child(docPart, 'w:docPartGallery'), 'w:val'),
    lock: lock as ContentControlProps['lock'],
    showingPlaceholder: child(sdtPr, 'w:showingPlcHdr') ? true : undefined,
  });
}

// ---- Dessins ----

const POS_RELATIVE = new Set<FloatPosition['relativeTo']>([
  'margin', 'page', 'column', 'character', 'paragraph', 'line', 'insideMargin', 'outsideMargin', 'leftMargin',
  'rightMargin', 'topMargin', 'bottomMargin',
]);

function parsePosition(el: XmlElement | undefined, fallback: FloatPosition['relativeTo']): FloatPosition {
  const rel = attr(el, 'relativeFrom') as FloatPosition['relativeTo'] | undefined;
  const align = child(el, 'wp:align');
  const offset = child(el, 'wp:posOffset');
  return compact<FloatPosition>({
    relativeTo: rel && POS_RELATIVE.has(rel) ? rel : fallback,
    align: align ? textOf(align).trim() : undefined,
    offset: offset ? emuToPt(Number(textOf(offset).trim()) || 0) : undefined,
  });
}

const isOn = (el: XmlElement | undefined, name: string): boolean => {
  const v = attr(el, name);
  return v === '1' || v === 'true' || v === 'on';
};

function parseFloating(anchor: XmlElement): Floating {
  let wrap: WrapType = 'none';
  let wrapSide: Floating['wrapSide'];
  for (const [tag, type] of [['wp:wrapSquare', 'square'], ['wp:wrapTight', 'tight'], ['wp:wrapThrough', 'through'], ['wp:wrapTopAndBottom', 'topAndBottom']] as const) {
    const w = child(anchor, tag);
    if (w) {
      wrap = type;
      wrapSide = attr(w, 'wrapText') as Floating['wrapSide'];
    }
  }
  const emu = (name: string): number => emuToPt(numAttr(anchor, name) ?? 0);
  return compact<Floating>({
    horizontal: parsePosition(child(anchor, 'wp:positionH'), 'column'),
    vertical: parsePosition(child(anchor, 'wp:positionV'), 'paragraph'),
    wrap,
    wrapSide,
    behindText: isOn(anchor, 'behindDoc'),
    distance: { top: emu('distT'), right: emu('distR'), bottom: emu('distB'), left: emu('distL') },
    allowOverlap: attr(anchor, 'allowOverlap') === undefined || isOn(anchor, 'allowOverlap'),
    lockAnchor: isOn(anchor, 'locked') || undefined,
    zIndex: numAttr(anchor, 'relativeHeight') ?? 0,
  });
}

function solidFill(parent: XmlElement | undefined): string | undefined {
  const color = child(child(parent, 'a:solidFill'), 'a:srgbClr');
  return attr(color, 'val')?.toUpperCase();
}

/** w:drawing -> image, forme ou element brut (graphique, SmartArt, groupe). */
function parseDrawing(drawing: XmlElement, run: XmlElement, props: RunProps, ctx: PartContext, depth: number): Inline {
  const frame = child(drawing, 'wp:inline') ?? child(drawing, 'wp:anchor');
  if (!frame) return raw(run, ctx);
  const extent = child(frame, 'wp:extent');
  const width = emuToPt(numAttr(extent, 'cx') ?? 0);
  const height = emuToPt(numAttr(extent, 'cy') ?? 0);
  const docPr = child(frame, 'wp:docPr');
  const floating = frame.name === 'wp:anchor' ? parseFloating(frame) : undefined;
  const data = child(child(frame, 'a:graphic'), 'a:graphicData');
  const uri = attr(data, 'uri') ?? '';
  const hlink = child(docPr, 'a:hlinkClick');
  const linkRel = hlink ? ctx.rels.get(attr(hlink, 'r:id') ?? '') : undefined;
  const decorative = docPr ? [...descendants(docPr)].some((e) => e.name.endsWith(':decorative') && attr(e, 'val') === '1') : false;
  const common = { alt: attr(docPr, 'descr'), name: attr(docPr, 'name') };
  if (uri.endsWith('/picture')) {
    const pic = child(data, 'pic:pic');
    const blipFill = child(pic, 'pic:blipFill');
    const blip = child(blipFill, 'a:blip');
    const mediaId = ctx.images.get(attr(blip, 'r:embed') ?? '');
    if (!mediaId) return raw(run, ctx);
    const src = child(blipFill, 'a:srcRect');
    const xfrm = child(child(pic, 'pic:spPr'), 'a:xfrm');
    const pct = (name: string): number => (numAttr(src, name) ?? 0) / 100000;
    const rot = numAttr(xfrm, 'rot');
    return compact<ImageInline>({
      type: 'image', mediaId, width, height, ...common,
      title: attr(docPr, 'title'),
      decorative: decorative || undefined,
      crop: src && Object.keys(src.attrs).length ? { top: pct('t'), right: pct('r'), bottom: pct('b'), left: pct('l') } : undefined,
      rotation: rot ? rot / 60000 : undefined,
      flipH: isOn(xfrm, 'flipH') || undefined,
      flipV: isOn(xfrm, 'flipV') || undefined,
      floating,
      link: linkRel?.external ? checkedUrl(linkRel.target, ctx.warnings) : undefined,
      props: Object.keys(props).length ? props : undefined,
    });
  }
  if (uri.endsWith('/wordprocessingShape')) {
    const wsp = child(data, 'wps:wsp');
    const spPr = child(wsp, 'wps:spPr');
    const ln = child(spPr, 'a:ln');
    const lineColor = solidFill(ln);
    const content = child(child(wsp, 'wps:txbx'), 'w:txbxContent');
    return compact<ShapeInline>({
      type: 'shape', geometry: attr(child(spPr, 'a:prstGeom'), 'prst') ?? 'rect', width, height, ...common,
      fill: solidFill(spPr),
      line: lineColor ? { color: lineColor, width: emuToPt(numAttr(ln, 'w') ?? 12700) } : undefined,
      text: content ? parseBlocks(content, ctx, depth + 1) : undefined,
      floating,
      rotation: ((numAttr(child(spPr, 'a:xfrm'), 'rot') ?? 0) / 60000) % 360 || undefined,
    });
  }
  return raw(run, ctx);
}

/** Dimension VML (« width:120pt;height:1in ») en points. */
function vmlDimension(style: string, name: string): number {
  for (const decl of style.split(';')) {
    const [key, value] = decl.split(':');
    if (key?.trim() !== name || !value) continue;
    const m = value.trim().match(/^([\d.]+)(pt|in|px|cm)?$/);
    if (!m) continue;
    const v = Number(m[1]);
    return m[2] === 'in' ? v * 72 : m[2] === 'px' ? v * 0.75 : m[2] === 'cm' ? (v * 72) / 2.54 : v;
  }
  return 72;
}

/** Image VML (w:pict / v:imagedata) des anciens documents. */
function parsePict(pict: XmlElement, run: XmlElement, ctx: PartContext): Inline {
  const shape = child(pict, 'v:shape');
  const imagedata = shape ? child(shape, 'v:imagedata') : undefined;
  const mediaId = ctx.images.get(attr(imagedata, 'r:id') ?? '');
  if (!shape || !mediaId) return raw(run, ctx);
  const style = attr(shape, 'style') ?? '';
  return compact<ImageInline>({
    type: 'image', mediaId, width: vmlDimension(style, 'width'), height: vmlDimension(style, 'height'),
    alt: attr(shape, 'alt'), title: attr(imagedata, 'o:title'),
  });
}

// ---- Elements en ligne ----

const REVISABLE = new Set<Inline['type']>(['text', 'tab', 'break', 'symbol', 'image', 'shape', 'hyperlink', 'field', 'fieldChar', 'footnoteRef', 'endnoteRef']);

type BeginChar = FieldChar & { dirty?: boolean; locked?: boolean };

function parseRun(run: XmlElement, revision: Revision | undefined, ctx: PartContext, depth: number, out: Token[]): void {
  const rPr = child(run, 'w:rPr');
  const props = parseRunProps(rPr);
  const styleId = attr(child(rPr, 'w:rStyle'), 'w:val');
  const formatChange = formatChangeOf(child(rPr, 'w:rPrChange'), parseRunProps, 'w:rPr');
  const withProps = Object.keys(props).length ? props : undefined;
  const wrapRaw = (node: XmlElement): Inline => raw({ ...run, children: [...(rPr ? [rPr] : []), node] }, ctx);
  const start = out.length;
  let text = '';
  const flush = (): void => {
    if (!text) return;
    out.push(compact({ type: 'text' as const, text, styleId, props, revision, formatChange }));
    text = '';
  };
  const push = (inline: Inline): void => {
    flush();
    if (revision && REVISABLE.has(inline.type)) Object.assign(inline, { revision });
    out.push(inline);
  };
  for (const node of run.children) {
    if (!isElement(node)) continue;
    switch (node.name) {
      case 'w:t':
      case 'w:delText': text += textOf(node); break;
      case 'w:softHyphen': text += '­'; break;
      case 'w:noBreakHyphen': text += '‑'; break;
      case 'w:tab':
      case 'w:ptab': push(compact({ type: 'tab' as const, props: withProps })); break;
      case 'w:br':
      case 'w:cr': {
        const type = attr(node, 'w:type');
        const clear = attr(node, 'w:clear');
        push(compact({
          type: 'break' as const,
          kind: type === 'page' ? 'page' as const : type === 'column' ? 'column' as const : 'line' as const,
          clear: clear === 'left' || clear === 'right' || clear === 'all' ? clear : undefined,
          props: withProps,
        }));
        break;
      }
      case 'w:sym': push(compact({ type: 'symbol' as const, font: attr(node, 'w:font') ?? 'Symbol', char: attr(node, 'w:char') ?? '0020', props: withProps })); break;
      case 'w:drawing': push(parseDrawing(node, run, props, ctx, depth)); break;
      case 'w:pict': push(parsePict(node, run, ctx)); break;
      case 'mc:AlternateContent': {
        const drawing = [...descendants(child(node, 'mc:Choice') ?? node, 'w:drawing')][0];
        const shell = { ...run, children: [...(rPr ? [rPr] : []), node] };
        push(drawing ? parseDrawing(drawing, shell, props, ctx, depth) : raw(shell, ctx));
        break;
      }
      case 'w:fldChar': {
        const kind = attr(node, 'w:fldCharType');
        if (kind === 'begin' || kind === 'separate' || kind === 'end') {
          const fc: BeginChar = compact({ type: 'fieldChar' as const, kind, props: withProps });
          if (kind === 'begin' && isOn(node, 'w:dirty')) fc.dirty = true;
          if (kind === 'begin' && isOn(node, 'w:fldLock')) fc.locked = true;
          push(fc);
        }
        break;
      }
      case 'w:instrText':
      case 'w:delInstrText': flush(); out.push({ type: 'instr', text: textOf(node) }); break;
      case 'w:footnoteReference':
      case 'w:endnoteReference':
        push(compact({
          type: node.name === 'w:footnoteReference' ? 'footnoteRef' as const : 'endnoteRef' as const,
          noteId: numAttr(node, 'w:id') ?? 0,
          customMark: isOn(node, 'w:customMarkFollows') ? '' : undefined,
          props: withProps,
        }));
        break;
      case 'w:footnoteRef':
      case 'w:endnoteRef': push(compact({ type: 'noteMark' as const, kind: node.name === 'w:footnoteRef' ? 'footnote' as const : 'endnote' as const, props: withProps })); break;
      case 'w:commentReference': push({ type: 'commentRef', commentId: numAttr(node, 'w:id') ?? 0 }); break;
      case 'w:rPr':
      case 'w:lastRenderedPageBreak': break;
      default: push(wrapRaw(node)); break;
    }
  }
  flush();
  // Une marque personnalisee de note suit l'appel dans le meme run.
  for (let i = start; i < out.length - 1; i++) {
    const ref = out[i];
    const next = out[i + 1];
    if (ref && next && (ref.type === 'footnoteRef' || ref.type === 'endnoteRef') && ref.customMark === '' && next.type === 'text') {
      ref.customMark = next.text;
      out.splice(i + 1, 1);
    }
  }
}

function parseInlineTokens(parent: XmlElement, ctx: PartContext, revision: Revision | undefined, depth: number, out: Token[]): void {
  for (const node of parent.children) {
    if (!isElement(node)) continue;
    const revKind = REVISION_TAGS[node.name];
    if (revKind) {
      parseInlineTokens(node, ctx, revisionOf(node, revKind), depth, out);
      continue;
    }
    switch (node.name) {
      case 'w:r': parseRun(node, revision, ctx, depth, out); break;
      case 'w:hyperlink': {
        const rel = ctx.rels.get(attr(node, 'r:id') ?? '');
        out.push(compact({
          type: 'hyperlink' as const,
          url: rel?.external ? checkedUrl(rel.target, ctx.warnings) : undefined,
          anchor: attr(node, 'w:anchor'), tooltip: attr(node, 'w:tooltip'),
          inlines: parseInlines(node, ctx, revision, depth), revision,
        }));
        break;
      }
      case 'w:fldSimple': {
        const instruction = (attr(node, 'w:instr') ?? '').trim();
        out.push(compact({
          type: 'field' as const, instruction, code: fieldCode(instruction), result: parseInlines(node, ctx, revision, depth),
          locked: isOn(node, 'w:fldLock') || undefined, dirty: isOn(node, 'w:dirty') || undefined, revision,
        }));
        break;
      }
      case 'w:bookmarkStart': out.push({ type: 'bookmarkStart', id: numAttr(node, 'w:id') ?? 0, name: attr(node, 'w:name') ?? '' }); break;
      case 'w:bookmarkEnd': out.push({ type: 'bookmarkEnd', id: numAttr(node, 'w:id') ?? 0 }); break;
      case 'w:commentRangeStart': out.push({ type: 'commentStart', commentId: numAttr(node, 'w:id') ?? 0 }); break;
      case 'w:commentRangeEnd': out.push({ type: 'commentEnd', commentId: numAttr(node, 'w:id') ?? 0 }); break;
      case 'w:sdt':
        out.push({ type: 'inlineControl', props: parseSdtProps(child(node, 'w:sdtPr')), inlines: parseInlines(child(node, 'w:sdtContent') ?? node, ctx, revision, depth) });
        break;
      case 'w:smartTag':
      case 'w:customXml':
      case 'w:dir':
      case 'w:bdo': parseInlineTokens(node, ctx, revision, depth, out); break;
      case 'm:oMath':
      case 'm:oMathPara': out.push({ type: 'equation', omml: node, display: node.name === 'm:oMathPara', text: equationText(node) }); break;
      case 'w:pPr':
      case 'w:proofErr':
      case 'w:permStart':
      case 'w:permEnd':
      case 'w:moveFromRangeStart':
      case 'w:moveFromRangeEnd':
      case 'w:moveToRangeStart':
      case 'w:moveToRangeEnd': break;
      default: out.push(raw(node, ctx)); break;
    }
  }
}

const wrapGroup = (s: string): string => (s.length > 1 ? `(${s})` : s);

/** Forme lineaire simple d'une equation OMML (texte des m:t, fractions, puissances, racines). */
export function equationText(node: XmlElement): string {
  const part = (el: XmlElement, name: string): string => walk(child(el, name) ?? { name: '', attrs: {}, children: [] });
  const walk = (el: XmlElement): string => {
    switch (el.name) {
      case 'm:t': return textOf(el);
      case 'm:f': return `(${part(el, 'm:num')})/(${part(el, 'm:den')})`;
      case 'm:sSup': return `${part(el, 'm:e')}^${wrapGroup(part(el, 'm:sup'))}`;
      case 'm:sSub': return `${part(el, 'm:e')}_${wrapGroup(part(el, 'm:sub'))}`;
      case 'm:rad': return `√(${part(el, 'm:e')})`;
      case 'm:fPr': case 'm:rPr': case 'm:radPr': case 'm:sSupPr': case 'm:sSubPr': case 'm:ctrlPr': case 'w:rPr':
      case 'm:oMathParaPr': case 'm:deg': return '';
      default: return children(el).map(walk).join('');
    }
  };
  return walk(node);
}

export function fieldCode(instruction: string): string {
  return (instruction.trim().split(/\s+/)[0] ?? '').toUpperCase();
}

interface FieldFrame {
  instruction: string;
  result: Inline[];
  phase: 'instr' | 'result';
  begin: BeginChar;
}

/** Regroupe begin / instrText / separate / end en champs ; les bornes qui traversent les paragraphes restent. */
function foldFields(tokens: Token[]): Inline[] {
  const output: Inline[] = [];
  const stack: FieldFrame[] = [];
  const emit = (inline: Inline): void => {
    const top = stack[stack.length - 1];
    if (!top) output.push(inline);
    else if (top.phase === 'result') top.result.push(inline);
  };
  for (const token of tokens) {
    if (token.type === 'instr') {
      const top = stack[stack.length - 1];
      if (top && top.phase === 'instr') top.instruction += token.text;
      continue;
    }
    if (token.type !== 'fieldChar') {
      emit(token);
      continue;
    }
    if (token.kind === 'begin') {
      stack.push({ instruction: '', result: [], phase: 'instr', begin: token });
    } else if (token.kind === 'separate') {
      const top = stack[stack.length - 1];
      if (top) top.phase = 'result';
      else output.push(token);
    } else {
      const frame = stack.pop();
      if (!frame) {
        output.push(token);
        continue;
      }
      const instruction = frame.instruction.trim();
      const field: Field = compact<Field>({
        type: 'field', instruction, code: fieldCode(instruction), result: frame.result,
        locked: frame.begin.locked, dirty: frame.begin.dirty, props: frame.begin.props, revision: frame.begin.revision,
      });
      const parent = stack[stack.length - 1];
      if (parent && parent.phase === 'instr') parent.instruction += instruction;
      else emit(field);
    }
  }
  // Champs non fermes dans ce paragraphe : bornes conservees, le resultat suit.
  for (const frame of stack) {
    output.push(compact({ ...frame.begin, instruction: frame.instruction.trim() }));
    if (frame.phase === 'result') {
      output.push({ type: 'fieldChar', kind: 'separate' });
      output.push(...frame.result);
    }
  }
  return output;
}

export function parseInlines(parent: XmlElement, ctx: PartContext, revision: Revision | undefined, depth: number): Inline[] {
  const tokens: Token[] = [];
  parseInlineTokens(parent, ctx, revision, depth, tokens);
  return foldFields(tokens);
}

// ---- Blocs ----

export function parseParagraph(p: XmlElement, ctx: PartContext, depth: number): Paragraph {
  const pPr = child(p, 'w:pPr');
  const markRPr = child(pPr, 'w:rPr');
  const markProps = parseRunProps(markRPr);
  let markRevision: Revision | undefined;
  for (const [tag, kind] of Object.entries(REVISION_TAGS)) {
    const mark = child(markRPr, tag);
    if (mark) markRevision = revisionOf(mark, kind);
  }
  const sectPr = child(pPr, 'w:sectPr');
  return compact<Paragraph>({
    type: 'paragraph',
    styleId: attr(child(pPr, 'w:pStyle'), 'w:val'),
    props: parseParagraphProps(pPr),
    markProps: Object.keys(markProps).length ? markProps : undefined,
    markRevision,
    formatChange: formatChangeOf(child(pPr, 'w:pPrChange'), parseParagraphProps, 'w:pPr'),
    inlines: parseInlines(p, ctx, undefined, depth),
    sectionBreak: sectPr ? parseSection(sectPr, (rid) => ctx.headerIds.get(rid)) : undefined,
    paraId: attr(p, 'w14:paraId'),
  });
}

/** Elements `tag` d'un conteneur, en traversant controles de contenu et customXml. */
function unwrapped(parent: XmlElement, tag: string): XmlElement[] {
  const out: XmlElement[] = [];
  for (const node of children(parent)) {
    if (node.name === tag) out.push(node);
    else if (node.name === 'w:sdt') out.push(...unwrapped(child(node, 'w:sdtContent') ?? node, tag));
    else if (node.name === 'w:customXml') out.push(...unwrapped(node, tag));
  }
  return out;
}

export function parseTable(tbl: XmlElement, ctx: PartContext, depth: number): Table {
  const tblPr = child(tbl, 'w:tblPr');
  const grid = children(child(tbl, 'w:tblGrid'), 'w:gridCol').map((g) => twipsToPt(numAttr(g, 'w:w') ?? 0));
  const rows: TableRow[] = unwrapped(tbl, 'w:tr').map((tr) => {
    const trPr = child(tr, 'w:trPr');
    const props = parseRowProps(trPr);
    for (const [tag, kind] of Object.entries(REVISION_TAGS)) {
      const mark = child(trPr, tag);
      if (mark) props.revision = revisionOf(mark, kind);
    }
    const cells: TableCell[] = unwrapped(tr, 'w:tc').map((tc) => {
      const blocks = parseBlocks(tc, ctx, depth + 1);
      return { props: parseCellProps(child(tc, 'w:tcPr')), blocks: blocks.length ? blocks : [{ type: 'paragraph', props: {}, inlines: [] }] };
    });
    return { props, cells };
  });
  return compact<Table>({ type: 'table', styleId: attr(child(tblPr, 'w:tblStyle'), 'w:val'), props: parseTableProps(tblPr), grid, rows });
}

function findTocInstruction(blocks: Block[]): string | undefined {
  for (const block of blocks) {
    if (block.type !== 'paragraph') continue;
    for (const inline of block.inlines) {
      if (inline.type === 'fieldChar' && inline.kind === 'begin' && inline.instruction && fieldCode(inline.instruction) === 'TOC') return inline.instruction;
      if (inline.type === 'field' && inline.code === 'TOC') return inline.instruction;
    }
  }
  return undefined;
}

/** Blocs d'un conteneur (w:body, w:tc, w:hdr, w:footnote, w:txbxContent, w:sdtContent...). */
export function parseBlocks(container: XmlElement, ctx: PartContext, depth: number): Block[] {
  const blocks: Block[] = [];
  if (!ctx.budget.depthOk(depth)) return blocks;
  // Signets / commentaires poses entre deux blocs : rattaches au paragraphe voisin.
  let pending: Inline[] = [];
  const attachPending = (paragraph: Paragraph): void => {
    if (pending.length) {
      paragraph.inlines.unshift(...pending);
      pending = [];
    }
  };
  for (const node of container.children) {
    if (!isElement(node)) continue;
    switch (node.name) {
      case 'w:p': {
        if (!ctx.budget.takeBlock()) return blocks;
        const paragraph = parseParagraph(node, ctx, depth);
        attachPending(paragraph);
        blocks.push(paragraph);
        break;
      }
      case 'w:tbl':
        if (!ctx.budget.takeBlock()) return blocks;
        blocks.push(parseTable(node, ctx, depth));
        break;
      case 'w:sdt': {
        const props = parseSdtProps(child(node, 'w:sdtPr'));
        const inner = parseBlocks(child(node, 'w:sdtContent') ?? node, ctx, depth + 1);
        if ((props.docPartGallery ?? '').toLowerCase().includes('table of contents')) {
          blocks.push(compact({ type: 'toc' as const, instruction: findTocInstruction(inner) ?? 'TOC \\o "1-3" \\h \\z \\u', blocks: inner, id: props.id }));
        } else {
          blocks.push({ type: 'contentControl', props, blocks: inner });
        }
        break;
      }
      case 'w:customXml':
      case 'w:smartTag':
      case 'w:ins':
      case 'w:del':
      case 'w:moveFrom':
      case 'w:moveTo':
        blocks.push(...parseBlocks(node, ctx, depth + 1));
        break;
      case 'w:bookmarkStart':
      case 'w:bookmarkEnd':
      case 'w:commentRangeStart':
      case 'w:commentRangeEnd': {
        const tokens: Token[] = [];
        parseInlineTokens({ ...container, children: [node] }, ctx, undefined, depth, tokens);
        const inlines = tokens.filter((t): t is Inline => t.type !== 'instr');
        const last = blocks[blocks.length - 1];
        if (node.name.endsWith('End') && last?.type === 'paragraph') last.inlines.push(...inlines);
        else pending.push(...inlines);
        break;
      }
      case 'w:sectPr':
      case 'w:tcPr':
      case 'w:sdtPr':
      case 'w:sdtEndPr':
      case 'w:proofErr':
      case 'w:permStart':
      case 'w:permEnd': break;
      default:
        blocks.push(raw(node, ctx));
        break;
    }
  }
  if (pending.length) {
    const paragraph: Paragraph = { type: 'paragraph', props: {}, inlines: [] };
    attachPending(paragraph);
    blocks.push(paragraph);
  }
  return blocks;
}
