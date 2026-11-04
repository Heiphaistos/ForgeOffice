// Ecriture des blocs et elements en ligne du modele en WordprocessingML.
import { el, isElement, type PackageWriter, type XmlElement, type XmlNode } from '@forgeoffice/opc';
import type {
  Block, ContentControlProps, Floating, FloatPosition, ImageInline, Inline, Paragraph, Revision, RunProps, ShapeInline,
  StoredPart, StoredRel, Table, WordDocument,
} from '../model.ts';
import { sanitizeUrl } from '../security.ts';
import { ptToEmu } from '../units.ts';
import { extensionOf, REL } from './ns.ts';
import {
  cellPropsChildren, paragraphPropsXml, rowPropsChildren, runPropsXml, sectionXml, tablePropsChildren,
} from './write-props.ts';

/** Etat partage par toutes les parties d'un meme fichier. */
export class PackageState {
  readonly writer: PackageWriter;
  readonly doc: WordDocument;
  /** Chemins deja ecrits (parties conservees, medias). */
  readonly written = new Set<string>();
  /** mediaId -> chemin de partie. */
  readonly mediaPaths = new Map<string, string>();
  private drawingId = 0;
  /** Reponses sans ancre propre, par commentaire parent : Word ignore une reponse non ancree, on l'ancre avec son parent. */
  readonly replyAnchors = new Map<number, number[]>();

  constructor(writer: PackageWriter, doc: WordDocument) {
    this.writer = writer;
    this.doc = doc;
    const anchored = new Set<number>();
    const walkInlines = (list: readonly Inline[]): void => {
      for (const i of list) {
        if (i.type === 'commentRef') anchored.add(i.commentId);
        else if (i.type === 'hyperlink' || i.type === 'inlineControl') walkInlines(i.inlines);
        else if (i.type === 'field') walkInlines(i.result);
      }
    };
    const walkBlocks = (list: readonly Block[]): void => {
      for (const b of list) {
        if (b.type === 'paragraph') walkInlines(b.inlines);
        else if (b.type === 'table') for (const r of b.rows) for (const c of r.cells) walkBlocks(c.blocks);
        else if (b.type === 'contentControl' || b.type === 'toc') walkBlocks(b.blocks);
      }
    };
    walkBlocks(doc.body);
    for (const hf of Object.values(doc.headersFooters)) walkBlocks(hf.blocks);
    for (const c of doc.comments) {
      if (c.parentId === undefined || anchored.has(c.id)) continue;
      this.replyAnchors.set(c.parentId, [...(this.replyAnchors.get(c.parentId) ?? []), c.id]);
    }
  }

  /** Commentaire et ses reponses non ancrees (ordre du fil). */
  commentIds(id: number): number[] {
    return [id, ...(this.replyAnchors.get(id) ?? [])];
  }

  nextDrawingId(): number {
    this.drawingId += 1;
    return this.drawingId;
  }

  /** Ecrit une partie conservee et ses relations (identifiants d'origine). */
  storePart(part: StoredPart): void {
    if (this.written.has(part.path.toLowerCase())) return;
    this.written.add(part.path.toLowerCase());
    this.writer.addBytes(part.path, part.bytes, part.contentType);
    for (const rel of part.rels) {
      this.writer.addRelationship(part.path, rel.type, rel.target, rel.external, rel.id);
      if (rel.part) this.storePart(rel.part);
    }
  }

  mediaPath(mediaId: string): string | undefined {
    const known = this.mediaPaths.get(mediaId);
    if (known) return known;
    const media = this.doc.media[mediaId];
    if (!media) return undefined;
    const base = (media.fileName.replace(/\.[^.]*$/, '') || 'image').replace(/[^A-Za-z0-9_-]/g, '_');
    const ext = extensionOf(media.contentType, media.fileName);
    let partPath = `word/media/${base}.${ext}`;
    for (let n = 2; this.written.has(partPath.toLowerCase()); n++) partPath = `word/media/${base}_${n}.${ext}`;
    this.written.add(partPath.toLowerCase());
    this.writer.addBytes(partPath, media.bytes);
    this.writer.setDefault(ext, media.contentType);
    this.mediaPaths.set(mediaId, partPath);
    return partPath;
  }
}

/** Relations d'une partie de contenu. */
export class PartWriter {
  readonly state: PackageState;
  readonly partPath: string;
  private counter = 0;
  private readonly reserved: Set<string>;
  private readonly imageRids = new Map<string, string>();
  private readonly linkRids = new Map<string, string>();
  /** Identifiants de paragraphes (w14:paraId) a poser : paragraphe -> paraId. */
  readonly paraIds: Map<Paragraph, string>;

  constructor(state: PackageState, partPath: string, reserved: Iterable<string> = [], paraIds = new Map<Paragraph, string>()) {
    this.state = state;
    this.partPath = partPath;
    this.reserved = new Set(reserved);
    this.paraIds = paraIds;
  }

  rel(type: string, target: string, external = false): string {
    let id: string;
    do {
      this.counter += 1;
      id = `rId${this.counter}`;
    } while (this.reserved.has(id));
    this.state.writer.addRelationship(this.partPath, type, target, external, id);
    return id;
  }

  image(mediaId: string): string | undefined {
    const known = this.imageRids.get(mediaId);
    if (known) return known;
    const target = this.state.mediaPath(mediaId);
    if (!target) return undefined;
    const rid = this.rel(REL.image, target);
    this.imageRids.set(mediaId, rid);
    return rid;
  }

  hyperlink(url: string): string {
    const known = this.linkRids.get(url);
    if (known) return known;
    const rid = this.rel(REL.hyperlink, url, true);
    this.linkRids.set(url, rid);
    return rid;
  }

  /** Recree les relations referencees par un element brut et renvoie une copie aux r:id remappes. */
  raw(xml: XmlElement, rels: Record<string, StoredRel> | undefined): XmlElement {
    if (!rels) return xml;
    const mapping = new Map<string, string>();
    for (const [oldId, rel] of Object.entries(rels)) {
      if (rel.part) this.state.storePart(rel.part);
      mapping.set(oldId, this.rel(rel.type, rel.target, rel.external));
    }
    const clone = (node: XmlElement): XmlElement => ({
      name: node.name,
      attrs: Object.fromEntries(Object.entries(node.attrs).map(([k, v]) => [k, k.startsWith('r:') ? (mapping.get(v) ?? v) : v])),
      children: node.children.map((c: XmlNode) => (isElement(c) ? clone(c) : c)),
    });
    return clone(xml);
  }
}

const revisionTag: Readonly<Record<Revision['kind'], string>> = { insert: 'w:ins', delete: 'w:del', moveFrom: 'w:moveFrom', moveTo: 'w:moveTo' };

const wrapRevision = (revision: Revision | undefined, nodes: XmlElement[]): XmlElement[] =>
  revision ? [el(revisionTag[revision.kind], { 'w:id': revision.id, 'w:author': revision.author, 'w:date': revision.date }, nodes)] : nodes;

const isDeleted = (revision: Revision | undefined): boolean => revision?.kind === 'delete' || revision?.kind === 'moveFrom';

function textNodes(text: string, deleted: boolean): XmlElement[] {
  const out: XmlElement[] = [];
  let buffer = '';
  const flush = (): void => {
    if (!buffer) return;
    const preserve = /^\s|\s$/.test(buffer) ? 'preserve' : undefined;
    out.push(el(deleted ? 'w:delText' : 'w:t', { 'xml:space': preserve }, [buffer]));
    buffer = '';
  };
  for (const ch of text) {
    if (ch === '\t') { flush(); out.push(el('w:tab')); }
    else if (ch === '\n' || ch === '\v') { flush(); out.push(el('w:br')); }
    else if (ch === '\f') { flush(); out.push(el('w:br', { 'w:type': 'page' })); }
    else if (ch === '­') { flush(); out.push(el('w:softHyphen')); }
    else if (ch === '‑') { flush(); out.push(el('w:noBreakHyphen')); }
    else if (ch !== '\r') buffer += ch;
  }
  flush();
  return out;
}

const run = (props: RunProps | undefined, kids: XmlElement[], styleId?: string, extra: XmlElement[] = []): XmlElement => {
  const rPr = runPropsXml(props, styleId, extra);
  return el('w:r', {}, rPr ? [rPr, ...kids] : kids);
};

function sdtPropsXml(props: ContentControlProps, extra: XmlElement[] = []): XmlElement {
  const kids: XmlElement[] = [];
  if (props.alias) kids.push(el('w:alias', { 'w:val': props.alias }));
  if (props.tag) kids.push(el('w:tag', { 'w:val': props.tag }));
  if (props.id !== undefined) kids.push(el('w:id', { 'w:val': props.id }));
  if (props.lock) kids.push(el('w:lock', { 'w:val': props.lock }));
  if (props.showingPlaceholder) kids.push(el('w:showingPlcHdr'));
  const items = (props.items ?? []).map((i) => el('w:listItem', { 'w:displayText': i.display, 'w:value': i.value }));
  switch (props.kind) {
    case 'plainText': kids.push(el('w:text')); break;
    case 'dropDown': kids.push(el('w:dropDownList', {}, items)); break;
    case 'comboBox': kids.push(el('w:comboBox', {}, items)); break;
    case 'date': kids.push(el('w:date', {}, [el('w:dateFormat', { 'w:val': props.dateFormat ?? 'dd/MM/yyyy' }), el('w:lid', { 'w:val': 'fr-FR' })])); break;
    case 'picture': kids.push(el('w:picture')); break;
    case 'group': kids.push(el('w:group')); break;
    case 'citation': kids.push(el('w:citation')); break;
    case 'bibliography': kids.push(el('w:bibliography')); break;
    case 'docPart': kids.push(el('w:docPartObj', {}, [el('w:docPartGallery', { 'w:val': props.docPartGallery ?? '' }), el('w:docPartUnique')])); break;
    case 'repeatingSection': kids.push(el('w15:repeatingSection')); break;
    case 'checkbox':
      kids.push(el('w14:checkbox', {}, [
        el('w14:checked', { 'w14:val': props.checked ? '1' : '0' }),
        el('w14:checkedState', { 'w14:val': '2612', 'w14:font': 'MS Gothic' }),
        el('w14:uncheckedState', { 'w14:val': '2610', 'w14:font': 'MS Gothic' }),
      ]));
      break;
    default: break;
  }
  return el('w:sdtPr', {}, [...kids, ...extra]);
}

function positionXml(tag: string, pos: FloatPosition): XmlElement {
  return el(tag, { relativeFrom: pos.relativeTo }, [
    pos.align !== undefined ? el('wp:align', {}, [pos.align]) : el('wp:posOffset', {}, [String(ptToEmu(pos.offset ?? 0))]),
  ]);
}

function frameXml(width: number, height: number, floating: Floating | undefined, docPr: XmlElement, graphic: XmlElement): XmlElement {
  const extent = el('wp:extent', { cx: ptToEmu(width), cy: ptToEmu(height) });
  const effect = el('wp:effectExtent', { l: 0, t: 0, r: 0, b: 0 });
  const cNv = el('wp:cNvGraphicFramePr');
  if (!floating) return el('wp:inline', { distT: 0, distB: 0, distL: 0, distR: 0 }, [extent, effect, docPr, cNv, graphic]);
  const d = floating.distance;
  const wrap = floating.wrap === 'none'
    ? el('wp:wrapNone')
    : floating.wrap === 'topAndBottom'
      ? el('wp:wrapTopAndBottom')
      : el(`wp:wrap${floating.wrap.charAt(0).toUpperCase()}${floating.wrap.slice(1)}`, { wrapText: floating.wrapSide ?? 'bothSides' },
        floating.wrap === 'square' ? [] : [el('wp:wrapPolygon', { edited: '0' }, [
          el('wp:start', { x: 0, y: 0 }), el('wp:lineTo', { x: 0, y: 21600 }), el('wp:lineTo', { x: 21600, y: 21600 }),
          el('wp:lineTo', { x: 21600, y: 0 }), el('wp:lineTo', { x: 0, y: 0 }),
        ])]);
  return el('wp:anchor', {
    distT: ptToEmu(d.top), distB: ptToEmu(d.bottom), distL: ptToEmu(d.left), distR: ptToEmu(d.right),
    simplePos: '0', relativeHeight: floating.zIndex, behindDoc: floating.behindText ? '1' : '0', locked: floating.lockAnchor ? '1' : '0',
    layoutInCell: '1', allowOverlap: floating.allowOverlap ? '1' : '0',
  }, [
    el('wp:simplePos', { x: 0, y: 0 }),
    positionXml('wp:positionH', floating.horizontal),
    positionXml('wp:positionV', floating.vertical),
    extent, effect, wrap, docPr, cNv, graphic,
  ]);
}

/** Contexte d'ecriture du contenu d'une partie. */
export class ContentWriter {
  readonly part: PartWriter;

  constructor(part: PartWriter) {
    this.part = part;
  }

  private styleExists(id: string): boolean {
    return this.part.state.doc.styles.styles.some((s) => s.id === id);
  }

  private docPr(inline: { name?: string; alt?: string }, title: string | undefined, decorative: boolean, link: string | undefined): XmlElement {
    const id = this.part.state.nextDrawingId();
    const kids: XmlElement[] = [];
    const url = sanitizeUrl(link);
    if (url) kids.push(el('a:hlinkClick', { 'r:id': this.part.hyperlink(url) }));
    if (decorative) {
      kids.push(el('a:extLst', {}, [el('a:ext', { uri: '{C183D7F6-B498-43B3-948B-1728B52AA6E4}' }, [
        el('adec:decorative', { 'xmlns:adec': 'http://schemas.microsoft.com/office/drawing/2017/decorative', val: '1' }),
      ])]));
    }
    return el('wp:docPr', { id, name: inline.name ?? `Image ${id}`, descr: inline.alt, title }, kids);
  }

  private image(image: ImageInline): XmlElement[] {
    const rid = this.part.image(image.mediaId);
    if (!rid) return [];
    const docPr = this.docPr(image, image.title, image.decorative === true, image.link);
    const id = docPr.attrs['id'] ?? '0';
    const crop = image.crop;
    const pct = (v: number): number => Math.round(v * 100000);
    const pic = el('pic:pic', {}, [
      el('pic:nvPicPr', {}, [el('pic:cNvPr', { id, name: docPr.attrs['name'], descr: image.alt }), el('pic:cNvPicPr')]),
      el('pic:blipFill', {}, [
        el('a:blip', { 'r:embed': rid }),
        ...(crop ? [el('a:srcRect', { l: pct(crop.left) || undefined, t: pct(crop.top) || undefined, r: pct(crop.right) || undefined, b: pct(crop.bottom) || undefined })] : []),
        el('a:stretch', {}, [el('a:fillRect')]),
      ]),
      el('pic:spPr', {}, [
        el('a:xfrm', { rot: image.rotation ? Math.round(image.rotation * 60000) : undefined, flipH: image.flipH ? '1' : undefined, flipV: image.flipV ? '1' : undefined }, [
          el('a:off', { x: 0, y: 0 }), el('a:ext', { cx: ptToEmu(image.width), cy: ptToEmu(image.height) }),
        ]),
        el('a:prstGeom', { prst: 'rect' }, [el('a:avLst')]),
      ]),
    ]);
    const graphic = el('a:graphic', {}, [el('a:graphicData', { uri: 'http://schemas.openxmlformats.org/drawingml/2006/picture' }, [pic])]);
    return [el('w:drawing', {}, [frameXml(image.width, image.height, image.floating, docPr, graphic)])];
  }

  private shape(shape: ShapeInline, depth: number): XmlElement[] {
    const docPr = this.docPr(shape, undefined, false, undefined);
    const spPr = el('wps:spPr', {}, [
      el('a:xfrm', {}, [el('a:off', { x: 0, y: 0 }), el('a:ext', { cx: ptToEmu(shape.width), cy: ptToEmu(shape.height) })]),
      el('a:prstGeom', { prst: shape.geometry }, [el('a:avLst')]),
      shape.fill ? el('a:solidFill', {}, [el('a:srgbClr', { val: shape.fill })]) : el('a:noFill'),
      shape.line ? el('a:ln', { w: ptToEmu(shape.line.width) }, [el('a:solidFill', {}, [el('a:srgbClr', { val: shape.line.color })])]) : el('a:ln', {}, [el('a:noFill')]),
    ]);
    const wsp = el('wps:wsp', {}, [
      el('wps:cNvSpPr', shape.text ? { txBox: '1' } : {}),
      spPr,
      ...(shape.text ? [el('wps:txbx', {}, [el('w:txbxContent', {}, this.blocks(shape.text, depth + 1))])] : []),
      el('wps:bodyPr', { rot: 0, vert: 'horz', wrap: 'square', lIns: 91440, tIns: 45720, rIns: 91440, bIns: 45720, anchor: 't' }),
    ]);
    const graphic = el('a:graphic', {}, [el('a:graphicData', { uri: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape' }, [wsp])]);
    return [el('w:drawing', {}, [frameXml(shape.width, shape.height, shape.floating, docPr, graphic)])];
  }

  private fieldRuns(instruction: string, props: RunProps | undefined, begin: Record<string, string | undefined>, result: XmlElement[] | undefined): XmlElement[] {
    const out = [
      run(props, [el('w:fldChar', { 'w:fldCharType': 'begin', ...begin })]),
      run(props, [el('w:instrText', { 'xml:space': 'preserve' }, [` ${instruction} `])]),
    ];
    if (result) out.push(run(props, [el('w:fldChar', { 'w:fldCharType': 'separate' })]), ...result);
    out.push(run(props, [el('w:fldChar', { 'w:fldCharType': 'end' })]));
    return out;
  }

  inlines(inlines: readonly Inline[], depth: number): XmlElement[] {
    const out: XmlElement[] = [];
    for (const inline of inlines) out.push(...this.inline(inline, depth));
    return out;
  }

  private inline(inline: Inline, depth: number): XmlElement[] {
    switch (inline.type) {
      case 'text': {
        const changed = inline.formatChange
          ? [el('w:rPrChange', { 'w:id': inline.formatChange.id, 'w:author': inline.formatChange.author, 'w:date': inline.formatChange.date }, [runPropsXml(inline.formatChange.previous) ?? el('w:rPr')])]
          : [];
        return wrapRevision(inline.revision, [run(inline.props, textNodes(inline.text, isDeleted(inline.revision)), inline.styleId, changed)]);
      }
      case 'tab': return wrapRevision(inline.revision, [run(inline.props, [el('w:tab')])]);
      case 'break':
        return wrapRevision(inline.revision, [run(inline.props, [el('w:br', { 'w:type': inline.kind === 'line' ? undefined : inline.kind, 'w:clear': inline.clear })])]);
      case 'symbol': return wrapRevision(inline.revision, [run(inline.props, [el('w:sym', { 'w:font': inline.font, 'w:char': inline.char })])]);
      case 'image': return wrapRevision(inline.revision, [run(inline.props, this.image(inline))]);
      case 'shape': return wrapRevision(inline.revision, [run(undefined, this.shape(inline, depth))]);
      case 'hyperlink': {
        const url = sanitizeUrl(inline.url);
        return [el('w:hyperlink', {
          'r:id': url ? this.part.hyperlink(url) : undefined, 'w:anchor': inline.anchor, 'w:tooltip': inline.tooltip, 'w:history': '1',
        }, this.inlines(inline.inlines, depth))];
      }
      case 'field':
        return wrapRevision(inline.revision, this.fieldRuns(inline.instruction, inline.props,
          { 'w:dirty': inline.dirty ? '1' : undefined, 'w:fldLock': inline.locked ? '1' : undefined }, this.inlines(inline.result, depth)));
      case 'fieldChar': {
        const runs = [run(inline.props, [el('w:fldChar', { 'w:fldCharType': inline.kind })])];
        if (inline.kind === 'begin' && inline.instruction) runs.push(run(inline.props, [el('w:instrText', { 'xml:space': 'preserve' }, [` ${inline.instruction} `])]));
        return wrapRevision(inline.revision, runs);
      }
      case 'bookmarkStart': return [el('w:bookmarkStart', { 'w:id': inline.id, 'w:name': inline.name })];
      case 'bookmarkEnd': return [el('w:bookmarkEnd', { 'w:id': inline.id })];
      case 'footnoteRef':
      case 'endnoteRef': {
        const style = inline.type === 'footnoteRef' ? 'FootnoteReference' : 'EndnoteReference';
        const tag = inline.type === 'footnoteRef' ? 'w:footnoteReference' : 'w:endnoteReference';
        const kids = [el(tag, { 'w:customMarkFollows': inline.customMark !== undefined ? '1' : undefined, 'w:id': inline.noteId })];
        if (inline.customMark) kids.push(...textNodes(inline.customMark, false));
        return wrapRevision(inline.revision, [run(inline.props, kids, this.styleExists(style) ? style : undefined)]);
      }
      case 'noteMark': {
        const style = inline.kind === 'footnote' ? 'FootnoteReference' : 'EndnoteReference';
        return [run(inline.props, [el(inline.kind === 'footnote' ? 'w:footnoteRef' : 'w:endnoteRef')], this.styleExists(style) ? style : undefined)];
      }
      case 'commentStart': return this.part.state.commentIds(inline.commentId).map((id) => el('w:commentRangeStart', { 'w:id': id }));
      case 'commentEnd': return this.part.state.commentIds(inline.commentId).map((id) => el('w:commentRangeEnd', { 'w:id': id }));
      case 'commentRef': {
        const style = this.styleExists('CommentReference') ? 'CommentReference' : undefined;
        return this.part.state.commentIds(inline.commentId).map((id) => run(undefined, [el('w:commentReference', { 'w:id': id })], style));
      }
      case 'equation': return [inline.omml];
      case 'inlineControl': return [el('w:sdt', {}, [sdtPropsXml(inline.props), el('w:sdtContent', {}, this.inlines(inline.inlines, depth))])];
      case 'raw': return [this.part.raw(inline.xml, inline.rels)];
    }
  }

  paragraph(p: Paragraph, depth: number, refRid: (id: string) => string | undefined): XmlElement {
    const markExtra: XmlElement[] = [];
    if (p.markRevision) markExtra.push(el(revisionTag[p.markRevision.kind], { 'w:id': p.markRevision.id, 'w:author': p.markRevision.author, 'w:date': p.markRevision.date }));
    const markRPr = runPropsXml(p.markProps, undefined, markExtra);
    const tailKids: XmlElement[] = [];
    if (markRPr) tailKids.push(markRPr);
    if (p.sectionBreak) tailKids.push(sectionXml(p.sectionBreak, refRid));
    if (p.formatChange) {
      const previous = paragraphPropsXml(p.formatChange.previous, undefined, []) ?? el('w:pPr');
      tailKids.push(el('w:pPrChange', { 'w:id': p.formatChange.id, 'w:author': p.formatChange.author, 'w:date': p.formatChange.date }, [previous]));
    }
    const pPr = paragraphPropsXml(p.props, p.styleId, tailKids);
    const paraId = this.part.paraIds.get(p) ?? p.paraId;
    return el('w:p', { 'w14:paraId': paraId, 'w14:textId': paraId ? '77777777' : undefined }, [...(pPr ? [pPr] : []), ...this.inlines(p.inlines, depth)]);
  }

  table(t: Table, depth: number, refRid: (id: string) => string | undefined): XmlElement {
    const tblPr = el('w:tblPr', {}, tablePropsChildren(t.props, t.styleId));
    const grid = el('w:tblGrid', {}, t.grid.map((w) => el('w:gridCol', { 'w:w': Math.round(w * 20) })));
    const rows = t.rows.map((row) => {
      const trKids = rowPropsChildren(row.props);
      if (row.props.revision) trKids.push(el(revisionTag[row.props.revision.kind], { 'w:id': row.props.revision.id, 'w:author': row.props.revision.author, 'w:date': row.props.revision.date }));
      const cells = row.cells.map((cell) => {
        const tcPr = cellPropsChildren(cell.props);
        const content = this.blocks(cell.blocks, depth + 1, refRid);
        // Une cellule doit se terminer par un paragraphe.
        if (!content.length || content[content.length - 1]?.name !== 'w:p') content.push(el('w:p'));
        return el('w:tc', {}, [...(tcPr.length ? [el('w:tcPr', {}, tcPr)] : []), ...content]);
      });
      return el('w:tr', {}, [...(trKids.length ? [el('w:trPr', {}, trKids)] : []), ...cells]);
    });
    return el('w:tbl', {}, [tblPr, grid, ...rows]);
  }

  blocks(blocks: readonly Block[], depth: number, refRid: (id: string) => string | undefined = () => undefined): XmlElement[] {
    const out: XmlElement[] = [];
    for (const block of blocks) {
      switch (block.type) {
        case 'paragraph': out.push(this.paragraph(block, depth, refRid)); break;
        case 'table': out.push(this.table(block, depth, refRid)); break;
        case 'contentControl':
          out.push(el('w:sdt', {}, [sdtPropsXml(block.props), el('w:sdtContent', {}, this.blocks(block.blocks, depth + 1, refRid))]));
          break;
        case 'toc': {
          const content = block.blocks.length ? this.blocks(block.blocks, depth + 1, refRid) : [
            el('w:p', {}, this.fieldRuns(block.instruction, undefined, { 'w:dirty': '1' }, [])),
          ];
          out.push(el('w:sdt', {}, [
            sdtPropsXml({ kind: 'docPart', id: block.id, docPartGallery: 'Table of Contents' }),
            el('w:sdtContent', {}, content),
          ]));
          break;
        }
        case 'raw': out.push(this.part.raw(block.xml, block.rels)); break;
      }
    }
    return out;
  }
}
