// Lecture d'une partie de dessin (xl/drawings/drawingN.xml) : images, formes et graphiques ancres.
import { isElement, textOf, type OpcPackage, type XmlElement } from '@forgeoffice/opc';
import type { Anchor, AnchorPoint, DrawingBase, DrawingObject, ShapeObject } from '../model.ts';
import { readChart, readLine, solidColor } from './chart-read.ts';
import { kid, kids, localName, num, relAttr, str, walk } from './xml-util.ts';

const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml',
  emf: 'image/x-emf', wmf: 'image/x-wmf', tif: 'image/tiff', tiff: 'image/tiff', webp: 'image/webp',
};

/** Limite de dessins par feuille (fichier hostile). */
const MAX_DRAWINGS = 10_000;

function readPoint(node: XmlElement | undefined): AnchorPoint {
  return {
    col: Number(textOf(kid(node, 'col'))) || 0,
    colOffset: Number(textOf(kid(node, 'colOff'))) || 0,
    row: Number(textOf(kid(node, 'row'))) || 0,
    rowOffset: Number(textOf(kid(node, 'rowOff'))) || 0,
  };
}

function readAnchor(node: XmlElement): Anchor | undefined {
  const tag = localName(node.name);
  if (tag === 'twoCellAnchor') {
    const editAs = str(node, 'editAs');
    const anchor: Anchor = { type: 'twoCell', from: readPoint(kid(node, 'from')), to: readPoint(kid(node, 'to')) };
    if (editAs === 'oneCell' || editAs === 'absolute' || editAs === 'twoCell') anchor.editAs = editAs;
    return anchor;
  }
  const ext = kid(node, 'ext');
  const width = num(ext, 'cx') ?? 0;
  const height = num(ext, 'cy') ?? 0;
  if (tag === 'oneCellAnchor') return { type: 'oneCell', from: readPoint(kid(node, 'from')), width, height };
  if (tag === 'absoluteAnchor') {
    const pos = kid(node, 'pos');
    return { type: 'absolute', x: num(pos, 'x') ?? 0, y: num(pos, 'y') ?? 0, width, height };
  }
  return undefined;
}

function readBase(nvPr: XmlElement | undefined, anchor: Anchor, xfrm: XmlElement | undefined): DrawingBase {
  const cNvPr = kid(nvPr, 'cNvPr');
  const base: DrawingBase = { anchor, name: str(cNvPr, 'name') ?? '' };
  const descr = str(cNvPr, 'descr');
  if (descr) base.description = descr;
  const title = str(cNvPr, 'title');
  if (title) base.title = title;
  if (str(cNvPr, 'hidden') === '1') base.hidden = true;
  const rot = num(xfrm, 'rot');
  if (rot) base.rotation = rot / 60000;
  return base;
}

interface DrawingContext {
  pkg: OpcPackage;
  rels: Map<string, { target: string; external: boolean }>;
}

async function readObject(node: XmlElement, anchor: Anchor, ctx: DrawingContext, out: DrawingObject[]): Promise<void> {
  const tag = localName(node.name);
  if (tag === 'pic') {
    const embed = relAttr(walk(node, 'blipFill', 'blip'), 'embed');
    const rel = embed ? ctx.rels.get(embed) : undefined;
    if (!rel || rel.external || !ctx.pkg.has(rel.target)) return;
    const ext = rel.target.slice(rel.target.lastIndexOf('.') + 1).toLowerCase();
    const contentType = ctx.pkg.contentType(rel.target) ?? IMAGE_TYPES[ext] ?? 'application/octet-stream';
    const base = readBase(kid(node, 'nvPicPr'), anchor, walk(node, 'spPr', 'xfrm'));
    const image: DrawingObject = { ...base, kind: 'image', data: await ctx.pkg.readBytes(rel.target), contentType };
    const link = relAttr(walk(node, 'nvPicPr', 'cNvPr', 'hlinkClick'));
    const linkRel = link ? ctx.rels.get(link) : undefined;
    if (linkRel?.external && /^(https?:|mailto:)/i.test(linkRel.target)) image.link = linkRel.target;
    out.push(image);
    return;
  }
  if (tag === 'graphicFrame') {
    const chartRef = walk(node, 'graphic', 'graphicData', 'chart');
    const rid = relAttr(chartRef);
    const rel = rid ? ctx.rels.get(rid) : undefined;
    if (!rel || rel.external || !ctx.pkg.has(rel.target)) return;
    const base = readBase(kid(node, 'nvGraphicFramePr'), anchor, kid(node, 'xfrm'));
    out.push({ ...base, kind: 'chart', chart: readChart(await ctx.pkg.readXml(rel.target)) });
    return;
  }
  if (tag === 'sp' || tag === 'cxnSp') {
    const spPr = kid(node, 'spPr');
    const base = readBase(kid(node, tag === 'sp' ? 'nvSpPr' : 'nvCxnSpPr'), anchor, kid(spPr, 'xfrm'));
    const shape: ShapeObject = { ...base, kind: 'shape', geometry: str(kid(spPr, 'prstGeom'), 'prst') ?? 'rect' };
    if (tag === 'cxnSp') shape.connector = true;
    const fillColor = solidColor(spPr);
    if (kid(spPr, 'noFill')) shape.fill = { none: true };
    else if (fillColor) shape.fill = { color: fillColor };
    const line = readLine(kid(spPr, 'ln'));
    if (line) shape.line = line;
    const body = kid(node, 'txBody');
    if (body) {
      const paragraphs = kids(body, 'p');
      const text = paragraphs.map((p) => kids(p, 'r').map((r) => textOf(kid(r, 't'))).join('')).join('\n');
      if (text) shape.text = text;
      const rPr = kid(kid(paragraphs[0], 'r'), 'rPr');
      const size = num(rPr, 'sz');
      if (size) shape.fontSize = size / 100;
      if (str(rPr, 'b') === '1') shape.bold = true;
      const color = solidColor(rPr);
      if (color) shape.textColor = color;
      const algn = str(kid(paragraphs[0], 'pPr'), 'algn');
      if (algn === 'l' || algn === 'ctr' || algn === 'r' || algn === 'just') shape.horizontalAlign = algn;
      const anchorV = str(kid(body, 'bodyPr'), 'anchor');
      if (anchorV === 't' || anchorV === 'ctr' || anchorV === 'b') shape.verticalAlign = anchorV;
    }
    out.push(shape);
    return;
  }
  if (tag === 'grpSp') {
    for (const childNode of node.children) {
      if (isElement(childNode) && out.length < MAX_DRAWINGS) await readObject(childNode, anchor, ctx, out);
    }
  }
}

export async function readDrawing(pkg: OpcPackage, part: string): Promise<DrawingObject[]> {
  const root = await pkg.readXml(part);
  const rels = new Map((await pkg.relationships(part)).map((r) => [r.id, { target: r.target, external: r.external }]));
  const ctx: DrawingContext = { pkg, rels };
  const out: DrawingObject[] = [];
  for (const node of kids(root)) {
    if (out.length >= MAX_DRAWINGS) break;
    const anchor = readAnchor(node);
    if (!anchor) continue;
    for (const childNode of node.children) {
      if (!isElement(childNode)) continue;
      const tag = localName(childNode.name);
      if (tag === 'from' || tag === 'to' || tag === 'ext' || tag === 'pos' || tag === 'clientData') continue;
      await readObject(childNode, anchor, ctx, out);
    }
  }
  return out;
}
