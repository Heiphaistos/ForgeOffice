// Ecriture d'une partie de dessin : ancrages, images (parties media), formes, graphiques (parties chart).
import { el, type XmlElement } from '@forgeoffice/opc';
import type { OoxmlWriter } from './ooxml-writer.ts';
import type { Anchor, AnchorPoint, DrawingBase, DrawingObject, ShapeObject } from '../model.ts';
import { lineEl, writeChart } from './chart-write.ts';
import { CT_CHART, CT_DRAWING, NS_A, NS_C, NS_R, NS_XDR, REL_CHART, REL_HYPERLINK, REL_IMAGE } from './ns.ts';

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/svg+xml': 'svg',
  'image/x-emf': 'emf', 'image/x-wmf': 'wmf', 'image/tiff': 'tiff', 'image/webp': 'webp',
};

/** Compteurs globaux du paquet (noms de parties uniques). */
export interface DrawingCounters {
  drawing: number;
  chart: number;
  image: number;
}

function pointEl(tag: string, p: AnchorPoint): XmlElement {
  return el(tag, {}, [
    el('xdr:col', {}, [String(p.col)]),
    el('xdr:colOff', {}, [String(Math.round(p.colOffset))]),
    el('xdr:row', {}, [String(p.row)]),
    el('xdr:rowOff', {}, [String(Math.round(p.rowOffset))]),
  ]);
}

function anchorEl(anchor: Anchor, content: XmlElement): XmlElement {
  const tail = [content, el('xdr:clientData')];
  if (anchor.type === 'twoCell') {
    return el('xdr:twoCellAnchor', { editAs: anchor.editAs }, [pointEl('xdr:from', anchor.from), pointEl('xdr:to', anchor.to), ...tail]);
  }
  if (anchor.type === 'oneCell') {
    return el('xdr:oneCellAnchor', {}, [pointEl('xdr:from', anchor.from),
      el('xdr:ext', { cx: Math.round(anchor.width), cy: Math.round(anchor.height) }), ...tail]);
  }
  return el('xdr:absoluteAnchor', {}, [
    el('xdr:pos', { x: Math.round(anchor.x), y: Math.round(anchor.y) }),
    el('xdr:ext', { cx: Math.round(anchor.width), cy: Math.round(anchor.height) }), ...tail]);
}

function cNvPr(id: number, base: DrawingBase, extra: XmlElement[] = []): XmlElement {
  return el('xdr:cNvPr', {
    id,
    name: base.name || `Objet ${id}`,
    descr: base.description,
    title: base.title,
    hidden: base.hidden ? '1' : undefined,
  }, extra);
}

function xfrm(tag: string, base: DrawingBase): XmlElement {
  return el(tag, { rot: base.rotation ? Math.round(base.rotation * 60000) : undefined }, [
    el('a:off', { x: 0, y: 0 }),
    el('a:ext', { cx: 0, cy: 0 }),
  ]);
}

function shapeEl(id: number, shape: ShapeObject): XmlElement {
  const fill: XmlElement[] = shape.fill?.none
    ? [el('a:noFill')]
    : shape.fill?.color
      ? [el('a:solidFill', {}, [el('a:srgbClr', { val: shape.fill.color }, shape.fill.transparency
        ? [el('a:alpha', { val: Math.round((1 - shape.fill.transparency) * 100000) })] : [])])]
      : [];
  const spPr = el('xdr:spPr', {}, [
    ...(shape.rotation ? [xfrm('a:xfrm', shape)] : []),
    el('a:prstGeom', { prst: shape.geometry || 'rect' }, [el('a:avLst')]),
    ...fill,
    ...lineEl(shape.line),
  ]);
  if (shape.connector) {
    return el('xdr:cxnSp', { macro: '' }, [
      el('xdr:nvCxnSpPr', {}, [cNvPr(id, shape), el('xdr:cNvCxnSpPr')]),
      spPr,
    ]);
  }
  const runProps = el('a:rPr', {
    lang: 'fr-FR',
    sz: shape.fontSize ? Math.round(shape.fontSize * 100) : undefined,
    b: shape.bold ? '1' : undefined,
  }, shape.textColor ? [el('a:solidFill', {}, [el('a:srgbClr', { val: shape.textColor })])] : []);
  const paragraphs = (shape.text ?? '').split('\n').map((line) => el('a:p', {}, [
    el('a:pPr', { algn: shape.horizontalAlign }),
    ...(line ? [el('a:r', {}, [runProps, el('a:t', {}, [line])])] : [el('a:endParaRPr', { lang: 'fr-FR' })]),
  ]));
  const style = el('xdr:style', {}, [
    el('a:lnRef', { idx: 2 }, [el('a:schemeClr', { val: 'accent1' }, [el('a:shade', { val: 50000 })])]),
    el('a:fillRef', { idx: 1 }, [el('a:schemeClr', { val: 'accent1' })]),
    el('a:effectRef', { idx: 0 }, [el('a:schemeClr', { val: 'accent1' })]),
    el('a:fontRef', { idx: 'minor' }, [el('a:schemeClr', { val: 'lt1' })]),
  ]);
  return el('xdr:sp', { macro: '', textlink: '' }, [
    el('xdr:nvSpPr', {}, [cNvPr(id, shape), el('xdr:cNvSpPr')]),
    spPr,
    style,
    el('xdr:txBody', {}, [el('a:bodyPr', { vertOverflow: 'clip', horzOverflow: 'clip', rtlCol: '0', anchor: shape.verticalAlign ?? 't' }), el('a:lstStyle'), ...paragraphs]),
  ]);
}

/** Ajoute la partie de dessin d'une feuille au paquet et renvoie son chemin (undefined si rien a dessiner). */
export function writeDrawing(writer: OoxmlWriter, drawings: DrawingObject[], counters: DrawingCounters): string | undefined {
  if (drawings.length === 0) return undefined;
  counters.drawing++;
  const part = `xl/drawings/drawing${counters.drawing}.xml`;
  const anchors: XmlElement[] = [];
  drawings.forEach((object, index) => {
    const id = index + 2;
    if (object.kind === 'image') {
      counters.image++;
      const ext = EXTENSIONS[object.contentType] ?? 'png';
      const media = `xl/media/image${counters.image}.${ext}`;
      writer.addBytes(media, object.data);
      if (!['png', 'jpeg', 'gif', 'bmp', 'svg', 'emf', 'wmf', 'tiff'].includes(ext)) writer.setDefault(ext, object.contentType);
      const rid = writer.addRelationship(part, REL_IMAGE, media);
      const link = object.link && /^(https?:|mailto:)/i.test(object.link)
        ? [el('a:hlinkClick', { 'xmlns:r': NS_R, 'r:id': writer.addRelationship(part, REL_HYPERLINK, object.link, true) })]
        : [];
      anchors.push(anchorEl(object.anchor, el('xdr:pic', {}, [
        el('xdr:nvPicPr', {}, [cNvPr(id, object, link), el('xdr:cNvPicPr', {}, [el('a:picLocks', { noChangeAspect: '1' })])]),
        el('xdr:blipFill', {}, [el('a:blip', { 'xmlns:r': NS_R, 'r:embed': rid }), el('a:stretch', {}, [el('a:fillRect')])]),
        el('xdr:spPr', {}, [...(object.rotation ? [xfrm('a:xfrm', object)] : []), el('a:prstGeom', { prst: 'rect' }, [el('a:avLst')])]),
      ])));
    } else if (object.kind === 'chart') {
      counters.chart++;
      const chartPart = `xl/charts/chart${counters.chart}.xml`;
      writer.addXml(chartPart, writeChart(object.chart), CT_CHART);
      const rid = writer.addRelationship(part, REL_CHART, chartPart);
      anchors.push(anchorEl(object.anchor, el('xdr:graphicFrame', { macro: '' }, [
        el('xdr:nvGraphicFramePr', {}, [cNvPr(id, object), el('xdr:cNvGraphicFramePr')]),
        xfrm('xdr:xfrm', object),
        el('a:graphic', {}, [el('a:graphicData', { uri: NS_C }, [el('c:chart', { 'xmlns:c': NS_C, 'xmlns:r': NS_R, 'r:id': rid })])]),
      ])));
    } else {
      anchors.push(anchorEl(object.anchor, shapeEl(id, object)));
    }
  });
  writer.addXml(part, el('xdr:wsDr', { 'xmlns:xdr': NS_XDR, 'xmlns:a': NS_A }, anchors), CT_DRAWING);
  return part;
}
