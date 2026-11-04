// Lecture de l'arbre de formes (p:spTree) d'une diapositive, disposition ou masque.
import { attr, child, children, descendants, numAttr, textOf, type OpcPackage, type Relationship, type XmlElement } from '@forgeoffice/opc';
import { readChart } from './chart-read.ts';
import {
  bool,
  readBlipFill,
  readColor,
  readColorElement,
  readEffects,
  readFill,
  readGeometry,
  readHyperlink,
  readLine,
  readShapeStyle,
  readTextBody,
  readTransform,
  safeUrl,
  type DmlReadContext,
} from './dml-read.ts';
import type { Fill, Hyperlink, Insets, Transform } from './dml.ts';
import type {
  AutoShape,
  Background,
  ChartShape,
  Connector,
  GroupShape,
  ImageEffects,
  MediaItem,
  MediaShape,
  Picture,
  Placeholder,
  PlaceholderType,
  RawShape,
  Shape,
  ShapeBase,
  SmartArtShape,
  Table,
  TableCell,
  TableShape,
} from './model.ts';
import type { PartPreserver } from './preserve.ts';
import { canonicalize, cloneXml, extensionOf, MEDIA_TYPES } from './xmlns.ts';

/** Medias du paquet deja enregistres (un meme fichier = un meme identifiant). */
export class MediaRegistry {
  readonly media: Record<string, MediaItem> = {};
  private readonly byPath = new Map<string, string>();

  register(path: string, bytes: Uint8Array, contentType: string | undefined): string {
    const key = path.toLowerCase();
    const known = this.byPath.get(key);
    if (known) return known;
    const extension = extensionOf(path) || 'bin';
    const id = `media${this.byPath.size + 1}`;
    this.media[id] = { id, extension, contentType: contentType ?? MEDIA_TYPES[extension] ?? 'application/octet-stream', bytes };
    this.byPath.set(key, id);
    return id;
  }
}

const MEDIA_REL = /\/(image|media|video|audio)$/;

/** Contexte de lecture d'une partie : relations, medias et liens deja resolus. */
export class ShapeReadContext implements DmlReadContext {
  readonly pkg: OpcPackage;
  readonly part: string;
  readonly rels: Relationship[];
  readonly preserver: PartPreserver;
  /** Declarations d'espaces de noms de la racine de la partie (pour les fragments conserves). */
  scope: Record<string, string> = {};
  private readonly mediaByRel = new Map<string, string>();
  private readonly external = new Map<string, string>();
  private readonly slideIds: ReadonlyMap<string, number>;

  private constructor(pkg: OpcPackage, part: string, rels: Relationship[], preserver: PartPreserver, slideIds: ReadonlyMap<string, number>) {
    this.pkg = pkg;
    this.part = part;
    this.rels = rels;
    this.preserver = preserver;
    this.slideIds = slideIds;
  }

  static async create(pkg: OpcPackage, part: string, registry: MediaRegistry, preserver: PartPreserver, slideIds: ReadonlyMap<string, number>): Promise<ShapeReadContext> {
    const rels = await pkg.relationships(part);
    const ctx = new ShapeReadContext(pkg, part, rels, preserver, slideIds);
    for (const rel of rels) {
      if (rel.external) {
        ctx.external.set(rel.id, rel.target);
      } else if (MEDIA_REL.test(rel.type) && pkg.has(rel.target)) {
        ctx.mediaByRel.set(rel.id, registry.register(rel.target, await pkg.readBytes(rel.target), pkg.contentType(rel.target)));
      }
    }
    return ctx;
  }

  media(relId: string): string | undefined {
    return this.mediaByRel.get(relId);
  }

  externalTarget(relId: string): string | undefined {
    return this.external.get(relId);
  }

  rel(relId: string): Relationship | undefined {
    return this.rels.find((r) => r.id === relId);
  }

  hyperlink(relId: string): Pick<Hyperlink, 'url' | 'slideId'> | undefined {
    const rel = this.rel(relId);
    if (!rel) return undefined;
    if (rel.external) {
      const url = safeUrl(rel.target);
      return url === undefined ? undefined : { url };
    }
    const slideId = this.slideIds.get(rel.target.toLowerCase());
    return slideId === undefined ? undefined : { slideId };
  }
}

// ---- Proprietes communes ----

const PLACEHOLDER_TYPES = new Set<PlaceholderType>(['title', 'body', 'ctrTitle', 'subTitle', 'dt', 'sldNum', 'ftr', 'hdr', 'obj', 'chart', 'tbl', 'clipArt', 'dgm', 'media', 'sldImg', 'pic']);

function readPlaceholder(nvPr: XmlElement | undefined): Placeholder | undefined {
  const ph = child(nvPr, 'p:ph');
  if (!ph) return undefined;
  const raw = (attr(ph, 'type') ?? 'obj') as PlaceholderType;
  const placeholder: Placeholder = { type: PLACEHOLDER_TYPES.has(raw) ? raw : 'obj' };
  const index = numAttr(ph, 'idx');
  if (index !== undefined) placeholder.index = index;
  const orient = attr(ph, 'orient');
  if (orient) placeholder.orientation = orient as 'horz' | 'vert';
  const size = attr(ph, 'sz');
  if (size) placeholder.size = size as 'full' | 'half' | 'quarter';
  if (bool(ph, 'hasCustomPrompt')) placeholder.hasCustomPrompt = true;
  return placeholder;
}

function readLocks(node: XmlElement | undefined): Record<string, boolean> | undefined {
  const locks = children(node).find((n) => n.name.endsWith('Locks'));
  if (!locks) return undefined;
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(locks.attrs)) out[key] = value === '1' || value === 'true';
  return Object.keys(out).length ? out : undefined;
}

/** Proprietes de base depuis p:nvXxxPr (cNvPr, verrous, espace reserve). */
function readBase(nv: XmlElement | undefined, ctx: ShapeReadContext): ShapeBase {
  const cNvPr = child(nv, 'p:cNvPr');
  const base: ShapeBase = { id: numAttr(cNvPr, 'id') ?? 0, name: attr(cNvPr, 'name') ?? '' };
  const descr = attr(cNvPr, 'descr');
  if (descr) base.description = descr;
  const title = attr(cNvPr, 'title');
  if (title) base.title = title;
  if (bool(cNvPr, 'hidden')) base.hidden = true;
  const click = readHyperlink(child(cNvPr, 'a:hlinkClick'), ctx);
  if (click) base.click = click;
  const hover = readHyperlink(child(cNvPr, 'a:hlinkHover'), ctx);
  if (hover) base.hover = hover;
  const cNv = children(nv).find((n) => n.name.startsWith('p:cNv') && n.name !== 'p:cNvPr');
  const locks = readLocks(cNv);
  if (locks) base.locks = locks;
  const placeholder = readPlaceholder(child(nv, 'p:nvPr'));
  if (placeholder) base.placeholder = placeholder;
  return base;
}

function withXfrm<T extends ShapeBase>(shape: T, xfrm: Transform | undefined): T {
  if (xfrm) shape.xfrm = xfrm;
  return shape;
}

// ---- Formes ----

function readAutoShape(node: XmlElement, ctx: ShapeReadContext): AutoShape {
  const nv = child(node, 'p:nvSpPr');
  const spPr = child(node, 'p:spPr');
  const base = readBase(nv, ctx);
  const shape: AutoShape = withXfrm({ ...base, kind: 'shape', geometry: readGeometry(spPr) ?? { type: 'preset', preset: 'rect' } }, readTransform(child(spPr, 'a:xfrm')));
  if (bool(child(nv, 'p:cNvSpPr'), 'txBox')) shape.textBox = true;
  const fill = readFill(spPr, ctx);
  if (fill) shape.fill = fill;
  const line = readLine(child(spPr, 'a:ln'), ctx);
  if (line) shape.line = line;
  const effects = readEffects(spPr, spPr);
  if (effects) shape.effects = effects;
  const style = readShapeStyle(child(node, 'p:style'));
  if (style) shape.style = style;
  const text = readTextBody(child(node, 'p:txBody'), ctx);
  if (text) shape.text = text;
  return shape;
}

function readImageEffects(blip: XmlElement | undefined): ImageEffects | undefined {
  if (!blip) return undefined;
  const effects: ImageEffects = {};
  const extra: XmlElement[] = [];
  for (const node of children(blip)) {
    if (node.name === 'a:alphaModFix') effects.alpha = (numAttr(node, 'amt') ?? 100000) / 1000;
    else if (node.name === 'a:grayscl') effects.grayscale = true;
    else if (node.name === 'a:lum') {
      const bright = numAttr(node, 'bright');
      const contrast = numAttr(node, 'contrast');
      if (bright !== undefined) effects.brightness = bright / 1000;
      if (contrast !== undefined) effects.contrast = contrast / 1000;
    } else if (node.name === 'a:duotone') {
      const [first, second] = children(node).map(readColorElement);
      if (first && second) effects.duotone = [first, second];
    } else if (node.name !== 'a:extLst') extra.push(cloneXml(node));
  }
  if (extra.length) effects.extra = extra;
  return Object.keys(effects).length ? effects : undefined;
}

function readPicture(node: XmlElement, ctx: ShapeReadContext): Picture | MediaShape | undefined {
  const nv = child(node, 'p:nvPicPr');
  const spPr = child(node, 'p:spPr');
  const base = readBase(nv, ctx);
  const blipFill = child(node, 'p:blipFill');
  const blip = child(blipFill, 'a:blip');
  const posterId = ctx.media(attr(blip, 'r:embed') ?? '');
  const geometry = readGeometry(spPr) ?? { type: 'preset' as const, preset: 'rect' };
  const xfrm = readTransform(child(spPr, 'a:xfrm'));
  const line = readLine(child(spPr, 'a:ln'), ctx);
  const effects = readEffects(spPr, spPr);
  const nvPr = child(nv, 'p:nvPr');
  const video = child(nvPr, 'a:videoFile') ?? child(nvPr, 'a:quickTimeFile');
  const audio = child(nvPr, 'a:audioFile') ?? child(nvPr, 'a:wavAudioFile');
  if (video || audio) {
    const media: MediaShape = withXfrm({ ...base, kind: 'media', mediaType: video ? 'video' : 'audio', geometry }, xfrm);
    const p14 = nvPr ? [...descendants(nvPr, 'p14:media')][0] : undefined;
    const embedded = ctx.media(attr(p14, 'r:embed') ?? '') ?? ctx.media(attr(video ?? audio, 'r:link') ?? '') ?? ctx.media(attr(video ?? audio, 'r:embed') ?? '');
    if (embedded) media.mediaId = embedded;
    const link = ctx.externalTarget(attr(video ?? audio, 'r:link') ?? '');
    if (link && safeUrl(link)) media.link = link;
    if (posterId) media.posterMediaId = posterId;
    const trim = child(p14, 'p14:trim');
    if (trim) {
      const start = numAttr(trim, 'st');
      const end = numAttr(trim, 'end');
      media.trim = {};
      if (start !== undefined) media.trim.start = start;
      if (end !== undefined) media.trim.end = end;
    }
    const fade = child(p14, 'p14:fade');
    if (fade) {
      const fadeIn = numAttr(fade, 'in');
      const fadeOut = numAttr(fade, 'out');
      if (fadeIn !== undefined) media.fadeIn = fadeIn;
      if (fadeOut !== undefined) media.fadeOut = fadeOut;
    }
    if (line) media.line = line;
    if (effects) media.effects = effects;
    return media;
  }
  if (!posterId) return undefined;
  const fill = blipFill ? readBlipFill(blipFill, ctx) : undefined;
  const picture: Picture = withXfrm({ ...base, kind: 'picture', mediaId: posterId, fillMode: fill?.type === 'image' ? fill.mode : 'stretch', geometry }, xfrm);
  if (fill?.type === 'image' && fill.crop) picture.crop = fill.crop;
  const svg = [...descendants(blip ?? node, 'asvg:svgBlip')][0];
  const svgId = ctx.media(attr(svg, 'r:embed') ?? '');
  if (svgId) picture.svgMediaId = svgId;
  if (line) picture.line = line;
  if (effects) picture.effects = effects;
  const imageEffects = readImageEffects(blip);
  if (imageEffects) picture.imageEffects = imageEffects;
  const style = readShapeStyle(child(node, 'p:style'));
  if (style) picture.style = style;
  return picture;
}

function readConnector(node: XmlElement, ctx: ShapeReadContext): Connector {
  const nv = child(node, 'p:nvCxnSpPr');
  const spPr = child(node, 'p:spPr');
  const connector: Connector = withXfrm({ ...readBase(nv, ctx), kind: 'connector', geometry: readGeometry(spPr) ?? { type: 'preset', preset: 'line' } }, readTransform(child(spPr, 'a:xfrm')));
  const cNv = child(nv, 'p:cNvCxnSpPr');
  const st = child(cNv, 'a:stCxn');
  if (st) connector.start = { shapeId: numAttr(st, 'id') ?? 0, site: numAttr(st, 'idx') ?? 0 };
  const end = child(cNv, 'a:endCxn');
  if (end) connector.end = { shapeId: numAttr(end, 'id') ?? 0, site: numAttr(end, 'idx') ?? 0 };
  const line = readLine(child(spPr, 'a:ln'), ctx);
  if (line) connector.line = line;
  const effects = readEffects(spPr, spPr);
  if (effects) connector.effects = effects;
  const style = readShapeStyle(child(node, 'p:style'));
  if (style) connector.style = style;
  return connector;
}

function readMargins(tcPr: XmlElement | undefined): Partial<Insets> | undefined {
  const out: Partial<Insets> = {};
  const map = [['marL', 'left'], ['marR', 'right'], ['marT', 'top'], ['marB', 'bottom']] as const;
  for (const [key, side] of map) {
    const value = numAttr(tcPr, key);
    if (value !== undefined) out[side] = value / 12700;
  }
  return Object.keys(out).length ? out : undefined;
}

function readTable(tbl: XmlElement, ctx: ShapeReadContext): Table {
  const tblPr = child(tbl, 'a:tblPr');
  const table: Table = {
    columns: children(child(tbl, 'a:tblGrid'), 'a:gridCol').map((c) => (numAttr(c, 'w') ?? 0) / 12700),
    rows: children(tbl, 'a:tr').map((tr) => ({
      height: (numAttr(tr, 'h') ?? 0) / 12700,
      cells: children(tr, 'a:tc').map((tc): TableCell => {
        const tcPr = child(tc, 'a:tcPr');
        const cell: TableCell = { text: readTextBody(child(tc, 'a:txBody'), ctx) ?? { props: {}, paragraphs: [] } };
        const gridSpan = numAttr(tc, 'gridSpan');
        if (gridSpan && gridSpan > 1) cell.gridSpan = gridSpan;
        const rowSpan = numAttr(tc, 'rowSpan');
        if (rowSpan && rowSpan > 1) cell.rowSpan = rowSpan;
        if (bool(tc, 'hMerge')) cell.hMerge = true;
        if (bool(tc, 'vMerge')) cell.vMerge = true;
        const fill = readFill(tcPr, ctx);
        if (fill) cell.fill = fill;
        const borders: NonNullable<TableCell['borders']> = {};
        const map = [['a:lnL', 'left'], ['a:lnR', 'right'], ['a:lnT', 'top'], ['a:lnB', 'bottom'], ['a:lnTlToBr', 'diagonalDown'], ['a:lnBlToTr', 'diagonalUp']] as const;
        for (const [tag, side] of map) {
          const line = readLine(child(tcPr, tag), ctx);
          if (line) borders[side] = line;
        }
        if (Object.keys(borders).length) cell.borders = borders;
        const margins = readMargins(tcPr);
        if (margins) cell.margins = margins;
        const anchor = attr(tcPr, 'anchor');
        if (anchor) cell.anchor = anchor as 't' | 'ctr' | 'b';
        const anchorCtr = bool(tcPr, 'anchorCtr');
        if (anchorCtr !== undefined) cell.anchorCenter = anchorCtr;
        const vert = attr(tcPr, 'vert');
        if (vert) cell.vertical = vert;
        return cell;
      }),
    })),
  };
  const styleId = textOf(child(tblPr, 'a:tableStyleId')).trim();
  if (styleId) table.styleId = styleId;
  for (const key of ['firstRow', 'firstCol', 'lastRow', 'lastCol', 'bandRow', 'bandCol', 'rtl'] as const) {
    if (bool(tblPr, key)) table[key] = true;
  }
  const fill = readFill(tblPr, ctx);
  if (fill) table.fill = fill;
  const effects = child(tblPr, 'a:effectLst') ? readEffects(tblPr) : undefined;
  if (effects) table.effects = effects;
  return table;
}

const URI_TABLE = 'http://schemas.openxmlformats.org/drawingml/2006/table';
const URI_CHART = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const URI_DIAGRAM = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';
const DIAGRAM_DRAWING = 'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing';

/** Decale des formes de repli (coordonnees relatives au cadre) a la position du cadre. */
function offsetShapes(shapes: Shape[], dx: number, dy: number): Shape[] {
  for (const shape of shapes) {
    if (shape.xfrm) {
      shape.xfrm.x += dx;
      shape.xfrm.y += dy;
    }
  }
  return shapes;
}

async function readSmartArtFallback(frameXfrm: Transform | undefined, ctx: ShapeReadContext, registry: MediaRegistry, slideIds: ReadonlyMap<string, number>): Promise<{ shapes: Shape[]; rel?: Relationship }> {
  const rel = ctx.rels.find((r) => r.type === DIAGRAM_DRAWING && !r.external);
  if (!rel || !ctx.pkg.has(rel.target)) return { shapes: [] };
  const drawing = canonicalize(await ctx.pkg.readXml(rel.target));
  const tree = child(drawing, 'dsp:spTree');
  if (!tree) return { shapes: [], rel };
  // dsp:sp a la meme structure que p:sp : on renomme pour reutiliser la lecture.
  const renamed = cloneXml(tree);
  const rename = (node: XmlElement): void => {
    if (node.name.startsWith('dsp:')) node.name = `p:${node.name.slice(4)}`;
    for (const kid of node.children) if (typeof kid !== 'string') rename(kid);
  };
  rename(renamed);
  const drawingCtx = await ShapeReadContext.create(ctx.pkg, rel.target, registry, ctx.preserver, slideIds);
  const shapes = await readShapeTree(renamed, drawingCtx, registry, slideIds);
  return { shapes: offsetShapes(shapes, frameXfrm?.x ?? 0, frameXfrm?.y ?? 0), rel };
}

async function readGraphicFrame(node: XmlElement, ctx: ShapeReadContext, registry: MediaRegistry, slideIds: ReadonlyMap<string, number>): Promise<Shape> {
  const base = readBase(child(node, 'p:nvGraphicFramePr'), ctx);
  const xfrm = readTransform(child(node, 'p:xfrm'));
  const data = child(child(node, 'a:graphic'), 'a:graphicData');
  const uri = attr(data, 'uri');
  if (uri === URI_TABLE && child(data, 'a:tbl')) {
    const table: TableShape = withXfrm({ ...base, kind: 'table', table: readTable(child(data, 'a:tbl') as XmlElement, ctx) }, xfrm);
    return table;
  }
  if (uri === URI_CHART) {
    const relId = attr(child(data, 'c:chart'), 'r:id') ?? '';
    const rel = ctx.rel(relId);
    if (rel && !rel.external && ctx.pkg.has(rel.target)) {
      const root = canonicalize(await ctx.pkg.readXml(rel.target));
      const chartCtx = await ShapeReadContext.create(ctx.pkg, rel.target, registry, ctx.preserver, slideIds);
      const model = readChart(root, chartCtx);
      const rels = [];
      for (const r of chartCtx.rels) {
        const kept = await ctx.preserver.rel(r);
        if (kept) rels.push(kept);
      }
      const chart: ChartShape = withXfrm({ ...base, kind: 'chart', chart: model, source: { xml: root, rels, fingerprint: JSON.stringify(model) } }, xfrm);
      return chart;
    }
  }
  const raw = await ctx.preserver.raw(node, ctx.rels, ctx.scope);
  if (uri === URI_DIAGRAM) {
    const fallback = await readSmartArtFallback(xfrm, ctx, registry, slideIds);
    if (fallback.rel) {
      const kept = await ctx.preserver.rel(fallback.rel);
      if (kept) raw.rels.push(kept);
    }
    const smartart: SmartArtShape = withXfrm({ ...base, kind: 'smartart', raw, fallback: fallback.shapes }, xfrm);
    return smartart;
  }
  const pictures = [...descendants(node, 'p:pic')];
  const fallback: Shape[] = [];
  for (const pic of pictures) {
    const shape = readPicture(pic, ctx);
    if (shape) fallback.push(shape);
  }
  const rawShape: RawShape = withXfrm({ ...base, kind: 'raw', raw, fallback }, xfrm);
  return rawShape;
}

async function readGroup(node: XmlElement, ctx: ShapeReadContext, registry: MediaRegistry, slideIds: ReadonlyMap<string, number>): Promise<GroupShape> {
  const grpSpPr = child(node, 'p:grpSpPr');
  const xfrmNode = child(grpSpPr, 'a:xfrm');
  const xfrm = readTransform(xfrmNode);
  const chOff = child(xfrmNode, 'a:chOff');
  const chExt = child(xfrmNode, 'a:chExt');
  const group: GroupShape = withXfrm(
    {
      ...readBase(child(node, 'p:nvGrpSpPr'), ctx),
      kind: 'group',
      children: await readShapeTree(node, ctx, registry, slideIds),
      childOffset: { x: (numAttr(chOff, 'x') ?? 0) / 12700, y: (numAttr(chOff, 'y') ?? 0) / 12700 },
      childExtent: { width: (numAttr(chExt, 'cx') ?? 0) / 12700, height: (numAttr(chExt, 'cy') ?? 0) / 12700 },
    },
    xfrm,
  );
  const fill = readFill(grpSpPr, ctx);
  if (fill) group.fill = fill;
  const effects = readEffects(grpSpPr, grpSpPr);
  if (effects) group.effects = effects;
  return group;
}

async function readAlternate(node: XmlElement, ctx: ShapeReadContext, registry: MediaRegistry, slideIds: ReadonlyMap<string, number>): Promise<Shape | undefined> {
  const fallbackNode = child(node, 'mc:Fallback') ?? child(node, 'mc:Choice');
  const fallback = fallbackNode ? await readShapeTree(fallbackNode, ctx, registry, slideIds) : [];
  const first = fallback[0];
  const raw = await ctx.preserver.raw(node, ctx.rels, ctx.scope);
  const shape: RawShape = { kind: 'raw', id: first?.id ?? 0, name: first?.name ?? '', raw, fallback };
  if (first?.xfrm) shape.xfrm = { ...first.xfrm };
  return shape;
}

/** Lit les enfants d'un p:spTree / p:grpSp (et des dessins SmartArt renommes). */
export async function readShapeTree(tree: XmlElement, ctx: ShapeReadContext, registry: MediaRegistry, slideIds: ReadonlyMap<string, number>): Promise<Shape[]> {
  const shapes: Shape[] = [];
  for (const node of children(tree)) {
    let shape: Shape | undefined;
    switch (node.name) {
      case 'p:sp':
        shape = readAutoShape(node, ctx);
        break;
      case 'p:pic':
        shape = readPicture(node, ctx);
        break;
      case 'p:cxnSp':
        shape = readConnector(node, ctx);
        break;
      case 'p:grpSp':
        shape = await readGroup(node, ctx, registry, slideIds);
        break;
      case 'p:graphicFrame':
        shape = await readGraphicFrame(node, ctx, registry, slideIds);
        break;
      case 'mc:AlternateContent':
        shape = await readAlternate(node, ctx, registry, slideIds);
        break;
      case 'p:contentPart': {
        const raw = await ctx.preserver.raw(node, ctx.rels, ctx.scope);
        shape = { kind: 'raw', id: 0, name: '', raw, fallback: [] };
        break;
      }
      default:
        break;
    }
    if (shape) shapes.push(shape);
  }
  return shapes;
}

/** Arriere-plan d'un p:cSld. */
export function readBackground(cSld: XmlElement | undefined, ctx: DmlReadContext): Background | undefined {
  const bg = child(cSld, 'p:bg');
  if (!bg) return undefined;
  const bgPr = child(bg, 'p:bgPr');
  if (bgPr) {
    const fill: Fill = readFill(bgPr, ctx) ?? { type: 'none' };
    const background: Background = { type: 'fill', fill };
    if (bool(bgPr, 'shadeToTitle')) background.shadeToTitle = true;
    return background;
  }
  const ref = child(bg, 'p:bgRef');
  if (ref) return { type: 'ref', index: numAttr(ref, 'idx') ?? 1001, color: readColor(ref) ?? { type: 'scheme', value: 'bg1' } };
  return undefined;
}

