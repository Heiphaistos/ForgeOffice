// Ecriture de l'arbre de formes (p:spTree) et contexte d'ecriture d'une partie (relations, medias, liens).
import { el, isElement, type PackageWriter, type XmlElement } from '@forgeoffice/opc';
import { buildChartWorkbook, writeChart } from './chart-write.ts';
import {
  writeBlipFill,
  writeColor,
  writeEffectList,
  writeEffects,
  writeFill,
  writeGeometry,
  writeLine,
  writeShapeStyle,
  writeTextBody,
  writeTransform,
  type DmlWriteContext,
} from './dml-write.ts';
import type { Hyperlink, Transform } from './dml.ts';
import type {
  AutoShape,
  Background,
  ChartShape,
  Connector,
  Deck,
  GroupShape,
  MediaShape,
  Picture,
  RawShape,
  Shape,
  ShapeBase,
  SmartArtShape,
  TableShape,
} from './model.ts';
import type { PartEmitter, PathAllocator } from './preserve.ts';
import { CT, MEDIA_TYPES, NS, RT, usedPrefixes } from './xmlns.ts';
import { pctToOoPct, ptToEmu } from './units.ts';

/** Etat partage par toutes les parties d'un enregistrement. */
export interface WriterState {
  deck: Deck;
  writer: PackageWriter;
  paths: PathAllocator;
  emitter: PartEmitter;
  /** Chemin de chaque diapositive par identifiant (pour les liens internes). */
  slidePaths: Map<number, string>;
  mediaPaths: Map<string, string>;
  /** Travaux asynchrones (classeurs de graphiques) a attendre avant de construire le paquet. */
  pending: Array<Promise<void>>;
}

/** Image PNG 1x1 grise : affiche par defaut d'une video sans image. */
const POSTER_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

export class PartWriteContext implements DmlWriteContext {
  readonly state: WriterState;
  readonly part: string;
  private readonly known = new Map<string, string>();

  constructor(state: WriterState, part: string) {
    this.state = state;
    this.part = part;
  }

  /** Relation depuis cette partie (dedoublonnee par type + cible). */
  addRel(type: string, target: string, external = false): string {
    const key = `${type}|${target}|${external}`;
    const known = this.known.get(key);
    if (known) return known;
    const id = this.state.writer.addRelationship(this.part, type, target, external);
    this.known.set(key, id);
    return id;
  }

  /** Chemin du media dans le paquet (ecrit une seule fois). */
  mediaPath(mediaId: string): string {
    const known = this.state.mediaPaths.get(mediaId);
    if (known) return known;
    const item = this.state.deck.media[mediaId];
    const extension = item?.extension ?? 'png';
    const path = this.state.paths.allocate(`ppt/media/${item ? 'media' : 'image'}1.${extension}`);
    const contentType = item?.contentType ?? MEDIA_TYPES[extension] ?? 'application/octet-stream';
    this.state.writer.setDefault(extension, contentType);
    this.state.writer.addBytes(path, item?.bytes ?? POSTER_PNG);
    this.state.mediaPaths.set(mediaId, path);
    return path;
  }

  mediaRel(mediaId: string, type: string = RT.image): string {
    return this.addRel(type, this.mediaPath(mediaId));
  }

  posterRel(): string {
    const path = this.state.paths.allocate('ppt/media/image1.png');
    this.state.writer.addBytes(path, POSTER_PNG);
    return this.addRel(RT.image, path);
  }

  hyperlinkRel(link: Hyperlink): string | undefined {
    if (link.url !== undefined) return this.addRel(RT.hyperlink, link.url, true);
    if (link.slideId !== undefined) {
      const path = this.state.slidePaths.get(link.slideId);
      return path ? this.addRel(RT.slide, path) : undefined;
    }
    return undefined;
  }
}

const EXTENSION_PREFIXES = ['p14', 'p15', 'p159', 'p188', 'a14', 'a16', 'asvg', 'v'];

/** Declare sur la racine tous les espaces de noms connus utilises dans l'arbre (et les rend ignorables si besoin). */
export function declareNamespaces(root: XmlElement): XmlElement {
  const used = usedPrefixes(root);
  for (const prefix of used) {
    const uri = NS[prefix];
    if (uri && root.attrs[`xmlns:${prefix}`] === undefined) root.attrs[`xmlns:${prefix}`] = uri;
  }
  const ignorable = EXTENSION_PREFIXES.filter((p) => used.has(p));
  if (ignorable.length) {
    root.attrs['xmlns:mc'] = NS.mc ?? '';
    root.attrs['mc:Ignorable'] = ignorable.join(' ');
  }
  return root;
}

// ---- Proprietes communes ----

function cNvPr(shape: ShapeBase, ctx: PartWriteContext, extra: XmlElement[] = []): XmlElement {
  const kids: XmlElement[] = [];
  if (shape.click) kids.push(hyperlinkNode('a:hlinkClick', shape.click, ctx));
  if (shape.hover) kids.push(hyperlinkNode('a:hlinkHover', shape.hover, ctx));
  kids.push(...extra);
  return el('p:cNvPr', { id: shape.id, name: shape.name, descr: shape.description, title: shape.title, hidden: shape.hidden ? '1' : undefined }, kids);
}

function hyperlinkNode(name: string, link: Hyperlink, ctx: PartWriteContext): XmlElement {
  const relId = ctx.hyperlinkRel(link);
  const action = link.action ?? (link.slideId !== undefined ? 'ppaction://hlinksldjump' : undefined);
  return el(name, { 'r:id': relId ?? '', action, tooltip: link.tooltip, highlightClick: link.highlightClick ? '1' : undefined });
}

function locks(name: string, values: Record<string, boolean> | undefined): XmlElement[] {
  if (!values || !Object.keys(values).length) return [];
  const attrs: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) attrs[key] = value ? '1' : '0';
  return [el(name, attrs)];
}

function nvPr(shape: ShapeBase, extra: XmlElement[] = []): XmlElement {
  const kids: XmlElement[] = [];
  const ph = shape.placeholder;
  if (ph) {
    kids.push(
      el('p:ph', {
        type: ph.type === 'obj' ? undefined : ph.type,
        orient: ph.orientation === 'vert' ? 'vert' : undefined,
        sz: ph.size && ph.size !== 'full' ? ph.size : undefined,
        idx: ph.index || undefined,
        hasCustomPrompt: ph.hasCustomPrompt ? '1' : undefined,
      }),
    );
  }
  kids.push(...extra);
  return el('p:nvPr', {}, kids);
}

function spPr(shape: { xfrm?: Transform; placeholder?: ShapeBase['placeholder'] }, geometry: XmlElement | undefined, rest: XmlElement[]): XmlElement {
  const kids: XmlElement[] = [];
  if (shape.xfrm) kids.push(writeTransform(shape.xfrm));
  if (geometry) kids.push(geometry);
  kids.push(...rest);
  return el('p:spPr', {}, kids);
}

const isDefaultRect = (shape: AutoShape | Picture): boolean => shape.geometry.type === 'preset' && shape.geometry.preset === 'rect' && !shape.geometry.adjust;

// ---- Formes ----

function writeAutoShape(shape: AutoShape, ctx: PartWriteContext): XmlElement {
  const rest: XmlElement[] = [];
  const fill = writeFill(shape.fill, ctx);
  if (fill) rest.push(fill);
  if (shape.line) rest.push(writeLine(shape.line, ctx));
  rest.push(...writeEffects(shape.effects));
  const geometry = shape.placeholder && isDefaultRect(shape) ? undefined : writeGeometry(shape.geometry);
  const kids = [
    el('p:nvSpPr', {}, [cNvPr(shape, ctx), el('p:cNvSpPr', { txBox: shape.textBox ? '1' : undefined }, locks('a:spLocks', shape.locks)), nvPr(shape)]),
    spPr(shape, geometry, rest),
  ];
  if (shape.style) kids.push(writeShapeStyle(shape.style));
  if (shape.text) kids.push(writeTextBody(shape.text, ctx));
  return el('p:sp', {}, kids);
}

function svgExtension(mediaId: string | undefined, ctx: PartWriteContext): XmlElement | undefined {
  if (!mediaId) return undefined;
  return el('a:extLst', {}, [el('a:ext', { uri: '{96DAC541-7B7A-43D3-8B79-37D633B846F1}' }, [el('asvg:svgBlip', { 'r:embed': ctx.mediaRel(mediaId) })])]);
}

function imageEffects(picture: Picture): XmlElement[] {
  const fx = picture.imageEffects;
  if (!fx) return [];
  const out: XmlElement[] = [];
  if (fx.alpha !== undefined) out.push(el('a:alphaModFix', { amt: pctToOoPct(fx.alpha) }));
  if (fx.duotone) out.push(el('a:duotone', {}, fx.duotone.map(writeColor)));
  if (fx.grayscale) out.push(el('a:grayscl'));
  if (fx.brightness !== undefined || fx.contrast !== undefined) out.push(el('a:lum', { bright: fx.brightness === undefined ? undefined : pctToOoPct(fx.brightness), contrast: fx.contrast === undefined ? undefined : pctToOoPct(fx.contrast) }));
  out.push(...(fx.extra ?? []));
  return out;
}

function writePicture(picture: Picture, ctx: PartWriteContext): XmlElement {
  const blipFill = writeBlipFill({ type: 'image', mediaId: picture.mediaId, mode: picture.fillMode, crop: picture.crop }, ctx, 'p:blipFill', imageEffects(picture), svgExtension(picture.svgMediaId, ctx));
  const rest: XmlElement[] = [];
  if (picture.line) rest.push(writeLine(picture.line, ctx));
  rest.push(...writeEffects(picture.effects));
  const kids = [
    el('p:nvPicPr', {}, [cNvPr(picture, ctx), el('p:cNvPicPr', {}, locks('a:picLocks', picture.locks ?? { noChangeAspect: true })), nvPr(picture)]),
    blipFill,
    spPr(picture, writeGeometry(picture.geometry), rest),
  ];
  if (picture.style) kids.push(writeShapeStyle(picture.style));
  return el('p:pic', {}, kids);
}

function writeMedia(media: MediaShape, ctx: PartWriteContext): XmlElement {
  const video = media.mediaType === 'video';
  const linkType = video ? RT.video : RT.audio;
  const linkId = media.mediaId ? ctx.mediaRel(media.mediaId, linkType) : media.link ? ctx.addRel(linkType, media.link, true) : undefined;
  const nvExtra: XmlElement[] = [];
  if (linkId) nvExtra.push(el(video ? 'a:videoFile' : 'a:audioFile', { 'r:link': linkId }));
  if (media.mediaId) {
    const p14Kids: XmlElement[] = [];
    if (media.trim) p14Kids.push(el('p14:trim', { st: media.trim.start, end: media.trim.end }));
    if (media.fadeIn !== undefined || media.fadeOut !== undefined) p14Kids.push(el('p14:fade', { in: media.fadeIn, out: media.fadeOut }));
    nvExtra.push(el('p:extLst', {}, [el('p:ext', { uri: '{DAA4B4D4-6D9C-4B8F-B3D3-0E9A8C4E0E8E}' }, [el('p14:media', { 'r:embed': ctx.mediaRel(media.mediaId, RT.media) }, p14Kids)])]));
  }
  if (media.playback && Object.keys(media.playback).length) {
    const p = media.playback;
    nvExtra.push(el('p:extLst', {}, [el('p:ext', { uri: '{3F1B0C52-8B7A-4D8E-9A52-5C0F6F0A7D11}' }, [el('fo:media', { 'xmlns:fo': 'urn:forgeoffice:media', volume: p.volume, auto: p.auto ? '1' : undefined, loop: p.loop ? '1' : undefined, hide: p.hideInShow ? '1' : undefined })])]));
  }
  const posterId = media.posterMediaId ? ctx.mediaRel(media.posterMediaId) : ctx.posterRel();
  const rest: XmlElement[] = [];
  if (media.line) rest.push(writeLine(media.line, ctx));
  rest.push(...writeEffects(media.effects));
  const base: ShapeBase = { ...media, click: media.click ?? { action: 'ppaction://media' } };
  return el('p:pic', {}, [
    el('p:nvPicPr', {}, [cNvPr(base, ctx), el('p:cNvPicPr', {}, locks('a:picLocks', media.locks ?? { noChangeAspect: true })), nvPr(media, nvExtra)]),
    el('p:blipFill', {}, [el('a:blip', { 'r:embed': posterId }), el('a:stretch', {}, [el('a:fillRect')])]),
    spPr(media, writeGeometry(media.geometry), rest),
  ]);
}

function frame(shape: ShapeBase, ctx: PartWriteContext, data: XmlElement): XmlElement {
  const xfrm = shape.xfrm ?? { x: 0, y: 0, width: 0, height: 0 };
  return el('p:graphicFrame', {}, [
    el('p:nvGraphicFramePr', {}, [cNvPr(shape, ctx), el('p:cNvGraphicFramePr', {}, locks('a:graphicFrameLocks', shape.locks ?? { noGrp: true })), nvPr(shape)]),
    writeTransform(xfrm, 'p:xfrm'),
    el('a:graphic', {}, [data]),
  ]);
}

function writeTable(shape: TableShape, ctx: PartWriteContext): XmlElement {
  const t = shape.table;
  const tblPrKids: XmlElement[] = [];
  const tableFill = writeFill(t.fill, ctx);
  if (tableFill) tblPrKids.push(tableFill);
  if (t.effects) tblPrKids.push(writeEffectList(t.effects));
  if (t.styleId) tblPrKids.push(el('a:tableStyleId', {}, [t.styleId]));
  const flag = (value: boolean | undefined): string | undefined => (value ? '1' : undefined);
  const tblPr = el('a:tblPr', { rtl: flag(t.rtl), firstRow: flag(t.firstRow), firstCol: flag(t.firstCol), lastRow: flag(t.lastRow), lastCol: flag(t.lastCol), bandRow: flag(t.bandRow), bandCol: flag(t.bandCol) }, tblPrKids);
  const grid = el('a:tblGrid', {}, t.columns.map((w) => el('a:gridCol', { w: ptToEmu(w) })));
  const rows = t.rows.map((row) =>
    el('a:tr', { h: ptToEmu(row.height) }, row.cells.map((cell) => {
      const tcKids: XmlElement[] = [];
      const borders = cell.borders ?? {};
      const sides = [['a:lnL', borders.left], ['a:lnR', borders.right], ['a:lnT', borders.top], ['a:lnB', borders.bottom], ['a:lnTlToBr', borders.diagonalDown], ['a:lnBlToTr', borders.diagonalUp]] as const;
      for (const [tag, line] of sides) if (line) tcKids.push(writeLine(line, ctx, tag));
      const cellFill = writeFill(cell.fill, ctx);
      if (cellFill) tcKids.push(cellFill);
      const m = cell.margins ?? {};
      const tcPr = el('a:tcPr', { marL: m.left === undefined ? undefined : ptToEmu(m.left), marR: m.right === undefined ? undefined : ptToEmu(m.right), marT: m.top === undefined ? undefined : ptToEmu(m.top), marB: m.bottom === undefined ? undefined : ptToEmu(m.bottom), vert: cell.vertical, anchor: cell.anchor, anchorCtr: cell.anchorCenter === undefined ? undefined : cell.anchorCenter ? '1' : '0' }, tcKids);
      return el('a:tc', { gridSpan: cell.gridSpan, rowSpan: cell.rowSpan, hMerge: flag(cell.hMerge), vMerge: flag(cell.vMerge) }, [writeTextBody(cell.text, ctx, 'a:txBody'), tcPr]);
    })),
  );
  return frame(shape, ctx, el('a:graphicData', { uri: 'http://schemas.openxmlformats.org/drawingml/2006/table' }, [el('a:tbl', {}, [tblPr, grid, ...rows])]));
}

function writeChartShape(shape: ChartShape, ctx: PartWriteContext): XmlElement {
  const state = ctx.state;
  const path = state.paths.allocate('ppt/charts/chart1.xml');
  const chartCtx = new PartWriteContext(state, path);
  const source = shape.source;
  if (source && source.fingerprint === JSON.stringify(shape.chart)) {
    for (const rel of source.rels) {
      if (rel.external !== undefined) state.writer.addRelationship(path, rel.type, rel.external, true, rel.id);
      else if (rel.part) state.writer.addRelationship(path, rel.type, state.emitter.emit(rel.part), false, rel.id);
    }
    state.writer.addXml(path, declareNamespaces(structuredClone(source.xml)), CT.chart);
  } else {
    const workbookPath = state.paths.allocate('ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx');
    const workbookRel = chartCtx.addRel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/package', workbookPath);
    state.writer.setDefault('xlsx', MEDIA_TYPES.xlsx ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const chart = structuredClone(shape.chart);
    state.pending.push(buildChartWorkbook(chart).then((bytes) => state.writer.addBytes(workbookPath, bytes)));
    state.writer.addXml(path, declareNamespaces(writeChart(chart, chartCtx, workbookRel)), CT.chart);
  }
  const relId = ctx.addRel(RT.chart, path);
  return frame(shape, ctx, el('a:graphicData', { uri: 'http://schemas.openxmlformats.org/drawingml/2006/chart' }, [el('c:chart', { 'r:id': relId })]));
}

function writeGroup(group: GroupShape, ctx: PartWriteContext): XmlElement {
  const xfrm = group.xfrm ?? { x: group.childOffset.x, y: group.childOffset.y, width: group.childExtent.width, height: group.childExtent.height };
  const props: XmlElement[] = [writeTransform(xfrm, 'a:xfrm', group)];
  const fill = writeFill(group.fill, ctx);
  if (fill) props.push(fill);
  props.push(...writeEffects(group.effects));
  return el('p:grpSp', {}, [
    el('p:nvGrpSpPr', {}, [cNvPr(group, ctx), el('p:cNvGrpSpPr', {}, locks('a:grpSpLocks', group.locks)), nvPr(group)]),
    el('p:grpSpPr', {}, props),
    ...writeShapes(group.children, ctx),
  ]);
}

function writeConnector(connector: Connector, ctx: PartWriteContext): XmlElement {
  const cNvKids = [...locks('a:cxnSpLocks', connector.locks)];
  if (connector.start) cNvKids.push(el('a:stCxn', { id: connector.start.shapeId, idx: connector.start.site }));
  if (connector.end) cNvKids.push(el('a:endCxn', { id: connector.end.shapeId, idx: connector.end.site }));
  const rest: XmlElement[] = [];
  if (connector.line) rest.push(writeLine(connector.line, ctx));
  rest.push(...writeEffects(connector.effects));
  const kids = [
    el('p:nvCxnSpPr', {}, [cNvPr(connector, ctx), el('p:cNvCxnSpPr', {}, cNvKids), nvPr(connector)]),
    spPr(connector, writeGeometry(connector.geometry), rest),
  ];
  if (connector.style) kids.push(writeShapeStyle(connector.style));
  return el('p:cxnSp', {}, kids);
}

const DIAGRAM_DRAWING = 'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing';

/** Reporte la position, l'identifiant et le nom du modele dans un graphicFrame conserve. */
function patchFrame(xml: XmlElement, shape: ShapeBase): void {
  if (xml.name !== 'p:graphicFrame') return;
  for (const kid of xml.children) {
    if (!isElement(kid)) continue;
    if (kid.name === 'p:xfrm' && shape.xfrm) Object.assign(kid, writeTransform(shape.xfrm, 'p:xfrm'));
    if (kid.name === 'p:nvGraphicFramePr') {
      const c = kid.children.find((n): n is XmlElement => isElement(n) && n.name === 'p:cNvPr');
      if (c) {
        c.attrs.id = String(shape.id);
        c.attrs.name = shape.name;
        if (shape.description) c.attrs.descr = shape.description;
      }
    }
  }
}

function writeRaw(shape: SmartArtShape | RawShape, ctx: PartWriteContext): XmlElement {
  const { xml, mapping } = ctx.state.emitter.emitRaw(shape.raw, (type, target, external) => ctx.addRel(type, target, external));
  if (shape.kind === 'smartart') {
    patchFrame(xml, shape);
    // Le dessin precalcule est reference par identifiant de relation depuis la partie de donnees.
    const drawing = shape.raw.rels.find((r) => r.type === DIAGRAM_DRAWING);
    const data = shape.raw.rels.find((r) => r.type.endsWith('/diagramData'));
    const newId = drawing ? mapping.get(drawing.id) : undefined;
    const dataPath = data?.part ? ctx.state.emitter.pathOf(data.part) : undefined;
    if (drawing && newId && data?.part && dataPath) {
      const text = new TextDecoder().decode(data.part.bytes).split(`relId="${drawing.id}"`).join(`relId="${newId}"`);
      ctx.state.writer.addBytes(dataPath, new TextEncoder().encode(text), data.part.contentType);
    }
  }
  return xml;
}

export function writeShape(shape: Shape, ctx: PartWriteContext): XmlElement {
  switch (shape.kind) {
    case 'shape':
      return writeAutoShape(shape, ctx);
    case 'picture':
      return writePicture(shape, ctx);
    case 'media':
      return writeMedia(shape, ctx);
    case 'table':
      return writeTable(shape, ctx);
    case 'chart':
      return writeChartShape(shape, ctx);
    case 'group':
      return writeGroup(shape, ctx);
    case 'connector':
      return writeConnector(shape, ctx);
    case 'smartart':
    case 'raw':
      return writeRaw(shape, ctx);
  }
}

export function writeShapes(shapes: readonly Shape[], ctx: PartWriteContext): XmlElement[] {
  return shapes.map((shape) => writeShape(shape, ctx));
}

/** p:spTree complet (proprietes de groupe racine obligatoires). */
export function writeShapeTree(shapes: readonly Shape[], ctx: PartWriteContext): XmlElement {
  return el('p:spTree', {}, [
    el('p:nvGrpSpPr', {}, [el('p:cNvPr', { id: 1, name: '' }), el('p:cNvGrpSpPr'), el('p:nvPr')]),
    el('p:grpSpPr', {}, [el('a:xfrm', {}, [el('a:off', { x: 0, y: 0 }), el('a:ext', { cx: 0, cy: 0 }), el('a:chOff', { x: 0, y: 0 }), el('a:chExt', { cx: 0, cy: 0 })])]),
    ...writeShapes(shapes, ctx),
  ]);
}

export function writeBackground(background: Background, ctx: DmlWriteContext): XmlElement {
  if (background.type === 'ref') return el('p:bg', {}, [el('p:bgRef', { idx: background.index }, [writeColor(background.color)])]);
  const fill = writeFill(background.fill, ctx) ?? el('a:noFill');
  return el('p:bg', {}, [el('p:bgPr', { shadeToTitle: background.shadeToTitle ? '1' : undefined }, [fill, el('a:effectLst')])]);
}
