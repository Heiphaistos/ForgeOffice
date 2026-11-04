// Lecture d'un paquet PresentationML (.pptx, .pptm, .potx, .potm, .ppsx, .ppsm) vers le modele Deck.
import { attr, child, children, numAttr, OpcPackage, textOf, type XmlElement } from '@forgeoffice/opc';
import { pickTransition, readAnimations, readTransition } from './anim.ts';
import { DEFAULT_COLOR_MAP } from './color.ts';
import { bool, readListStyle, readParagraph } from './dml-read.ts';
import type { ListStyle, Paragraph } from './dml.ts';
import type { ColorMap, Comment, Deck, DeckFormat, DocProperties, Layout, LayoutType, Master, PreservedSource, Section, Slide } from './model.ts';
import { PartPreserver } from './preserve.ts';
import { MediaRegistry, readBackground, readShapeTree, ShapeReadContext } from './shapes-read.ts';
import { STRINGS } from './strings.ts';
import { readTheme, office2024Theme } from './theme.ts';
import { canonicalize, CT, RT } from './xmlns.ts';
import { emuToPt } from './units.ts';

export class PresentationError extends Error {}

interface ReadState {
  pkg: OpcPackage;
  registry: MediaRegistry;
  preserver: PartPreserver;
  slideIds: Map<string, number>;
  layoutIds: Map<string, string>;
}

async function readPart(pkg: OpcPackage, path: string): Promise<XmlElement> {
  return canonicalize(await pkg.readXml(path));
}

async function context(state: ReadState, part: string, root: XmlElement): Promise<ShapeReadContext> {
  const ctx = await ShapeReadContext.create(state.pkg, part, state.registry, state.preserver, state.slideIds);
  ctx.scope = { ...root.attrs };
  return ctx;
}

const COLOR_KEYS: Array<keyof ColorMap> = ['bg1', 'tx1', 'bg2', 'tx2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

function readColorMap(node: XmlElement | undefined): ColorMap | undefined {
  if (!node) return undefined;
  const map = { ...DEFAULT_COLOR_MAP };
  for (const key of COLOR_KEYS) {
    const value = attr(node, key);
    if (value) map[key] = value as ColorMap[typeof key];
  }
  return map;
}

function readOverride(root: XmlElement): ColorMap | undefined {
  return readColorMap(child(child(root, 'p:clrMapOvr'), 'a:overrideClrMapping'));
}

function transitionOf(root: XmlElement, ctx: ShapeReadContext): Slide['transition'] {
  const node = children(root).map(pickTransition).find((n) => n !== undefined);
  return node ? readTransition(node, (id) => ctx.media(id)) : undefined;
}

async function readLayout(state: ReadState, path: string, id: string): Promise<Layout> {
  const root = await readPart(state.pkg, path);
  const ctx = await context(state, path, root);
  const cSld = child(root, 'p:cSld');
  const type = (attr(root, 'type') ?? 'cust') as LayoutType;
  const layout: Layout = {
    id,
    name: attr(cSld, 'name') ?? '',
    type,
    shapes: await readShapeTree(child(cSld, 'p:spTree') ?? root, ctx, state.registry, state.slideIds),
  };
  const background = readBackground(cSld, ctx);
  if (background) layout.background = background;
  if (attr(root, 'showMasterSp') === '0') layout.showMasterShapes = false;
  if (bool(root, 'preserve')) layout.preserve = true;
  if (bool(root, 'userDrawn')) layout.userDrawn = true;
  const override = readOverride(root);
  if (override) layout.colorMapOverride = override;
  const transition = transitionOf(root, ctx);
  if (transition) layout.transition = transition;
  return layout;
}

async function readMaster(state: ReadState, path: string, index: number): Promise<Master> {
  const root = await readPart(state.pkg, path);
  const ctx = await context(state, path, root);
  const rels = ctx.rels;
  const themeRel = rels.find((r) => r.type === RT.theme && !r.external);
  let theme = office2024Theme();
  if (themeRel && state.pkg.has(themeRel.target)) {
    const themeRoot = await readPart(state.pkg, themeRel.target);
    theme = readTheme(themeRoot, await context(state, themeRel.target, themeRoot));
  }
  const cSld = child(root, 'p:cSld');
  const layouts: Layout[] = [];
  for (const entry of children(child(root, 'p:sldLayoutIdLst'), 'p:sldLayoutId')) {
    const rel = rels.find((r) => r.id === attr(entry, 'r:id'));
    if (!rel || !state.pkg.has(rel.target)) continue;
    const id = `layout${state.layoutIds.size + 1}`;
    state.layoutIds.set(rel.target.toLowerCase(), id);
    layouts.push(await readLayout(state, rel.target, id));
  }
  const txStyles = child(root, 'p:txStyles');
  const style = (name: string): ListStyle => readListStyle(child(txStyles, name), ctx) ?? { levels: {} };
  const master: Master = {
    id: `master${index + 1}`,
    theme,
    background: readBackground(cSld, ctx) ?? { type: 'ref', index: 1001, color: { type: 'scheme', value: 'bg1' } },
    shapes: await readShapeTree(child(cSld, 'p:spTree') ?? root, ctx, state.registry, state.slideIds),
    colorMap: readColorMap(child(root, 'p:clrMap')) ?? { ...DEFAULT_COLOR_MAP },
    textStyles: { title: style('p:titleStyle'), body: style('p:bodyStyle'), other: style('p:otherStyle') },
    layouts,
  };
  const name = attr(cSld, 'name');
  if (name) master.name = name;
  if (bool(root, 'preserve')) master.preserve = true;
  const hf = child(root, 'p:hf');
  if (hf) {
    const flag = (key: string): boolean => attr(hf, key) !== '0' && attr(hf, key) !== 'false';
    master.headerFooter = { slideNumber: flag('sldNum'), header: flag('hdr'), footer: flag('ftr'), date: flag('dt') };
  }
  const transition = transitionOf(root, ctx);
  if (transition) master.transition = transition;
  return master;
}

async function readNotes(state: ReadState, path: string): Promise<Paragraph[] | undefined> {
  const root = await readPart(state.pkg, path);
  const ctx = await context(state, path, root);
  const tree = child(child(root, 'p:cSld'), 'p:spTree');
  const bodies = children(tree, 'p:sp').filter((sp) => {
    const ph = child(child(child(sp, 'p:nvSpPr'), 'p:nvPr'), 'p:ph');
    const type = attr(ph, 'type');
    return ph !== undefined && type === 'body';
  });
  const body = bodies[0] ?? children(tree, 'p:sp').find((sp) => child(sp, 'p:txBody') && !child(child(child(sp, 'p:nvSpPr'), 'p:nvPr'), 'p:ph'));
  const txBody = child(body, 'p:txBody');
  if (!txBody) return undefined;
  const paragraphs = children(txBody, 'a:p').map((p) => readParagraph(p, ctx));
  return paragraphs.some((p) => p.runs.length) ? paragraphs : undefined;
}

interface Author {
  name: string;
  initials?: string;
}

async function readAuthors(state: ReadState, presentation: string): Promise<{ legacy: Map<string, Author>; modern: Map<string, Author> }> {
  const legacy = new Map<string, Author>();
  const modern = new Map<string, Author>();
  for (const rel of await state.pkg.relationships(presentation)) {
    if (rel.external || !state.pkg.has(rel.target)) continue;
    if (rel.type === RT.commentAuthors) {
      for (const node of children(await readPart(state.pkg, rel.target), 'p:cmAuthor')) {
        legacy.set(attr(node, 'id') ?? '', { name: attr(node, 'name') ?? '', initials: attr(node, 'initials') });
      }
    } else if (rel.type === RT.authors) {
      for (const node of children(await readPart(state.pkg, rel.target), 'p188:author')) {
        modern.set(attr(node, 'id') ?? '', { name: attr(node, 'name') ?? '', initials: attr(node, 'initials') });
      }
    }
  }
  return { legacy, modern };
}

function modernComment(node: XmlElement, authors: Map<string, Author>, ctx: ShapeReadContext): Comment {
  const author = authors.get(attr(node, 'authorId') ?? '');
  const text = children(child(node, 'p188:txBody'), 'a:p').map((p) => readParagraph(p, ctx).runs.map((r) => (r.type === 'break' ? '\n' : r.text)).join('')).join('\n');
  const comment: Comment = { author: author?.name ?? '', text };
  if (author?.initials) comment.initials = author.initials;
  const created = attr(node, 'created');
  if (created) comment.date = created;
  const pos = child(node, 'p188:pos');
  if (pos) comment.position = { x: emuToPt(numAttr(pos, 'x') ?? 0), y: emuToPt(numAttr(pos, 'y') ?? 0) };
  if (attr(node, 'status') === 'resolved') comment.resolved = true;
  const replies = children(child(node, 'p188:replyLst'), 'p188:reply').map((r) => modernComment(r, authors, ctx));
  if (replies.length) comment.replies = replies;
  return comment;
}

async function readComments(state: ReadState, ctx: ShapeReadContext, authors: Awaited<ReturnType<typeof readAuthors>>): Promise<Comment[]> {
  const out: Comment[] = [];
  for (const rel of ctx.rels) {
    if (rel.external || !state.pkg.has(rel.target)) continue;
    if (rel.type === RT.comments) {
      for (const node of children(await readPart(state.pkg, rel.target), 'p:cm')) {
        const author = authors.legacy.get(attr(node, 'authorId') ?? '');
        const comment: Comment = { author: author?.name ?? '', text: textOf(child(node, 'p:text')) };
        if (author?.initials) comment.initials = author.initials;
        const dt = attr(node, 'dt');
        if (dt) comment.date = dt;
        const pos = child(node, 'p:pos');
        // Les positions des commentaires historiques sont en 1/8 de point (unites maitre).
        if (pos) comment.position = { x: (numAttr(pos, 'x') ?? 0) / 8, y: (numAttr(pos, 'y') ?? 0) / 8 };
        out.push(comment);
      }
    } else if (rel.type === RT.modernComments) {
      const root = await readPart(state.pkg, rel.target);
      const commentCtx = await context(state, rel.target, root);
      for (const node of children(root, 'p188:cm')) out.push(modernComment(node, authors.modern, commentCtx));
    }
  }
  return out;
}

async function readSlide(state: ReadState, path: string, id: number, authors: Awaited<ReturnType<typeof readAuthors>>, fallbackLayout: string): Promise<Slide> {
  const root = await readPart(state.pkg, path);
  const ctx = await context(state, path, root);
  const cSld = child(root, 'p:cSld');
  const layoutRel = ctx.rels.find((r) => r.type === RT.layout && !r.external);
  const slide: Slide = {
    id,
    layoutId: (layoutRel && state.layoutIds.get(layoutRel.target.toLowerCase())) ?? fallbackLayout,
    shapes: await readShapeTree(child(cSld, 'p:spTree') ?? root, ctx, state.registry, state.slideIds),
    animations: [],
    comments: await readComments(state, ctx, authors),
  };
  const name = attr(cSld, 'name');
  if (name) slide.name = name;
  const background = readBackground(cSld, ctx);
  if (background) slide.background = background;
  if (attr(root, 'show') === '0' || attr(root, 'show') === 'false') slide.hidden = true;
  if (attr(root, 'showMasterSp') === '0') slide.showMasterShapes = false;
  const override = readOverride(root);
  if (override) slide.colorMapOverride = override;
  const transition = transitionOf(root, ctx);
  if (transition) slide.transition = transition;
  const timing = child(root, 'p:timing');
  if (timing) {
    slide.animations = readAnimations(timing);
    const raw = await state.preserver.raw(timing, ctx.rels, ctx.scope);
    const source: PreservedSource = { xml: raw.xml, rels: raw.rels, fingerprint: JSON.stringify(slide.animations) };
    slide.timing = source;
  }
  const notesRel = ctx.rels.find((r) => r.type === RT.notesSlide && !r.external);
  if (notesRel && state.pkg.has(notesRel.target)) {
    const notes = await readNotes(state, notesRel.target);
    if (notes) slide.notes = notes;
  }
  return slide;
}

async function readProperties(pkg: OpcPackage): Promise<DocProperties> {
  const props: DocProperties = {};
  const rels = await pkg.relationships('');
  const core = rels.find((r) => r.type === RT.coreProps)?.target;
  if (core && pkg.has(core)) {
    const root = await pkg.readXml(core);
    const map: Array<[keyof DocProperties, string]> = [
      ['title', 'dc:title'], ['subject', 'dc:subject'], ['creator', 'dc:creator'], ['keywords', 'cp:keywords'], ['description', 'dc:description'],
      ['lastModifiedBy', 'cp:lastModifiedBy'], ['revision', 'cp:revision'], ['created', 'dcterms:created'], ['modified', 'dcterms:modified'],
      ['category', 'cp:category'], ['contentStatus', 'cp:contentStatus'], ['language', 'dc:language'],
    ];
    for (const [key, tag] of map) {
      const node = child(root, tag);
      if (node) (props as Record<string, string>)[key] = textOf(node);
    }
  }
  const app = rels.find((r) => r.type === RT.appProps)?.target;
  if (app && pkg.has(app)) {
    const root = await pkg.readXml(app);
    for (const [key, tag] of [['company', 'Company'], ['manager', 'Manager'], ['application', 'Application'], ['appVersion', 'AppVersion']] as const) {
      const node = child(root, tag);
      if (node) props[key] = textOf(node);
    }
  }
  const custom = rels.find((r) => r.type === RT.customProps)?.target;
  if (custom && pkg.has(custom)) {
    const out: Record<string, string> = {};
    for (const node of children(await pkg.readXml(custom), 'property')) {
      const name = attr(node, 'name');
      if (name) out[name] = textOf(node);
    }
    if (Object.keys(out).length) props.custom = out;
  }
  return props;
}

function formatOf(contentType: string | undefined): DeckFormat {
  switch (contentType) {
    case CT.presentationMacro:
      return 'pptm';
    case CT.template:
      return 'potx';
    case CT.templateMacro:
      return 'potm';
    case CT.slideshow:
      return 'ppsx';
    case CT.slideshowMacro:
      return 'ppsm';
    default:
      return 'pptx';
  }
}

function readSections(root: XmlElement): Section[] {
  const sections: Section[] = [];
  for (const ext of children(child(root, 'p:extLst'), 'p:ext')) {
    for (const list of children(ext, 'p14:sectionLst')) {
      for (const section of children(list, 'p14:section')) {
        sections.push({
          name: attr(section, 'name') ?? '',
          id: attr(section, 'id') ?? '',
          slideIds: children(child(section, 'p14:sldIdLst'), 'p14:sldId').map((s) => numAttr(s, 'id') ?? 0),
        });
      }
    }
  }
  return sections;
}

/** Lit une presentation OOXML. */
export async function readPptx(bytes: Uint8Array): Promise<Deck> {
  const pkg = await OpcPackage.open(bytes);
  const main = await pkg.relatedPart('', '/officeDocument');
  if (!main || !pkg.has(main)) throw new PresentationError(STRINGS.errors.noPresentationPart);
  const root = await readPart(pkg, main);
  const rels = await pkg.relationships(main);
  const relTarget = (id: string | undefined): string | undefined => rels.find((r) => r.id === id && !r.external)?.target;
  const state: ReadState = { pkg, registry: new MediaRegistry(), preserver: new PartPreserver(pkg), slideIds: new Map(), layoutIds: new Map() };
  const slideEntries = children(child(root, 'p:sldIdLst'), 'p:sldId')
    .map((node) => ({ id: numAttr(node, 'id') ?? 0, path: relTarget(attr(node, 'r:id')) }))
    .filter((e): e is { id: number; path: string } => e.path !== undefined && pkg.has(e.path));
  for (const entry of slideEntries) state.slideIds.set(entry.path.toLowerCase(), entry.id);
  const masters: Master[] = [];
  for (const node of children(child(root, 'p:sldMasterIdLst'), 'p:sldMasterId')) {
    const path = relTarget(attr(node, 'r:id'));
    if (path && pkg.has(path)) masters.push(await readMaster(state, path, masters.length));
  }
  if (!masters.length) throw new PresentationError(STRINGS.errors.notPresentation);
  const authors = await readAuthors(state, main);
  const fallbackLayout = masters[0]?.layouts[0]?.id ?? '';
  const slides: Slide[] = [];
  for (const entry of slideEntries) slides.push(await readSlide(state, entry.path, entry.id, authors, fallbackLayout));
  const sldSz = child(root, 'p:sldSz');
  const notesSz = child(root, 'p:notesSz');
  const deck: Deck = {
    properties: await readProperties(pkg),
    size: { width: emuToPt(numAttr(sldSz, 'cx') ?? 12192000), height: emuToPt(numAttr(sldSz, 'cy') ?? 6858000) },
    notesSize: { width: emuToPt(numAttr(notesSz, 'cx') ?? 6858000), height: emuToPt(numAttr(notesSz, 'cy') ?? 9144000) },
    masters,
    slides,
    media: state.registry.media,
    defaultTextStyle: readListStyle(child(root, 'p:defaultTextStyle'), await context(state, main, root)) ?? { levels: {} },
    sections: readSections(root),
    format: formatOf(pkg.contentType(main)),
    preserved: {},
  };
  const sizeType = attr(sldSz, 'type');
  if (sizeType) deck.size.type = sizeType;
  const first = numAttr(root, 'firstSlideNum');
  if (first !== undefined && first !== 1) deck.firstSlideNumber = first;
  if (bool(root, 'rtl')) deck.rtl = true;
  for (const rel of rels) {
    if (rel.external || !pkg.has(rel.target)) continue;
    if (rel.type === RT.presProps) deck.preserved.presProps = await readPart(pkg, rel.target);
    else if (rel.type === RT.viewProps) deck.preserved.viewProps = await readPart(pkg, rel.target);
    else if (rel.type === RT.tableStyles) deck.preserved.tableStyles = await readPart(pkg, rel.target);
    else if (rel.type === RT.vba) deck.macros = await pkg.readBytes(rel.target);
  }
  return deck;
}
