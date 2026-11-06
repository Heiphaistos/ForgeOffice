// Ecriture .odp basique (OpenDocument Presentation 1.3) : pages, cadres de texte (mise en forme des caracteres et alignement),
// formes (rectangle, ellipse, rectangle arrondi, triangle, losange, ligne ; les autres en rectangle), chemins libres, images,
// tableaux (texte), notes du presentateur, titre. Les animations, transitions et graphiques ne sont pas ecrits.
import { el, serializeXml, type XmlElement, type XmlNode } from '@forgeoffice/opc';
import JSZip from 'jszip';
import { cssColor, DEFAULT_COLOR_MAP } from './color.ts';
import type { Fill, Geometry, Line, Paragraph, RunProps, TextBody } from './dml.ts';
import { effectiveShape } from './inherit.ts';
import type { Deck, Shape, Slide } from './model.ts';
import { deckTheme } from './model.ts';

const NS = {
  'xmlns:office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0', 'xmlns:style': 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  'xmlns:text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0', 'xmlns:table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  'xmlns:draw': 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0', 'xmlns:fo': 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  'xmlns:xlink': 'http://www.w3.org/1999/xlink', 'xmlns:svg': 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
  'xmlns:presentation': 'urn:oasis:names:tc:opendocument:xmlns:presentation:1.0', 'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
  'xmlns:meta': 'urn:oasis:names:tc:opendocument:xmlns:meta:1.0', 'xmlns:manifest': 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0',
  'office:version': '1.3',
};

const MIME = 'application/vnd.oasis.opendocument.presentation';
const cm = (pt: number): string => `${Math.round((pt / 72) * 2.54 * 10000) / 10000}cm`;

const PRESET_TYPES: Readonly<Record<string, string>> = {
  rect: 'rectangle', roundRect: 'round-rectangle', ellipse: 'ellipse', triangle: 'isosceles-triangle', rtTriangle: 'right-triangle',
  diamond: 'diamond', pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon', parallelogram: 'parallelogram', trapezoid: 'trapezoid',
  rightArrow: 'right-arrow', leftArrow: 'left-arrow',
};

class OdpWriter {
  private readonly deck: Deck;
  private readonly styles: XmlElement[] = [];
  private readonly styleKeys = new Map<string, string>();
  private readonly media = new Map<string, string>();
  private slide: Slide | undefined;
  readonly files = new Map<string, Uint8Array>();

  constructor(deck: Deck) {
    this.deck = deck;
  }

  private color(fill: Fill | Line | undefined): string | undefined {
    const f = fill && 'type' in fill ? fill : fill?.fill;
    if (!f || f.type !== 'solid') return undefined;
    const theme = deckTheme(this.deck);
    const css = cssColor(f.color, theme, DEFAULT_COLOR_MAP);
    return css.startsWith('#') ? css : undefined;
  }

  /** Style automatique (deduplique) ; renvoie son nom. */
  private style(family: 'graphic' | 'text' | 'paragraph', attrs: Record<string, string>): string | undefined {
    if (!Object.keys(attrs).length) return undefined;
    const key = `${family}${JSON.stringify(attrs)}`;
    let name = this.styleKeys.get(key);
    if (!name) {
      name = `${family === 'graphic' ? 'gr' : family === 'text' ? 'T' : 'P'}${this.styleKeys.size + 1}`;
      this.styleKeys.set(key, name);
      const props = el(`style:${family}-properties`, attrs);
      this.styles.push(el('style:style', { 'style:name': name, 'style:family': family === 'text' ? 'text' : family === 'paragraph' ? 'paragraph' : 'graphic' }, [props]));
    }
    return name;
  }

  private runStyle(props: RunProps): string | undefined {
    const a: Record<string, string> = {};
    if (props.size) a['fo:font-size'] = `${props.size}pt`;
    if (props.bold) a['fo:font-weight'] = 'bold';
    if (props.italic) a['fo:font-style'] = 'italic';
    if (props.underline && props.underline !== 'none') a['style:text-underline-style'] = 'solid';
    if (props.strike && props.strike !== 'noStrike') a['style:text-line-through-style'] = 'solid';
    if (props.font && !props.font.startsWith('+')) a['fo:font-family'] = props.font;
    const c = props.color ? this.color({ type: 'solid', color: props.color }) : undefined;
    if (c) a['fo:color'] = c;
    return this.style('text', a);
  }

  private paragraphs(body: TextBody | undefined): XmlElement[] {
    return (body?.paragraphs ?? []).map((p: Paragraph): XmlElement => {
      const align = ({ l: 'start', ctr: 'center', r: 'end', just: 'justify' } as Record<string, string>)[p.props.align ?? 'l'] ?? 'start';
      const pStyle = this.style('paragraph', p.props.align && p.props.align !== 'l' ? { 'fo:text-align': align } : {});
      const kids: XmlNode[] = [];
      for (const run of p.runs) {
        if (run.type === 'break') {
          kids.push(el('text:line-break'));
          continue;
        }
        const span = this.runStyle(run.props);
        kids.push(span ? el('text:span', { 'text:style-name': span }, [run.text]) : run.text);
      }
      return el('text:p', { 'text:style-name': pStyle }, kids);
    });
  }

  private frame(shape: Shape, attrs: Record<string, string | number | undefined>, kids: XmlNode[]): XmlElement {
    const x = shape.xfrm;
    const rotation = x?.rotation ? `rotate(${(-(x.rotation * Math.PI) / 180).toFixed(6)}) translate(${cm(x.x)} ${cm(x.y)})` : undefined;
    const first = kids[0];
    return el(first && typeof first !== 'string' && (first.name === 'draw:text-box' || first.name === 'draw:image') ? 'draw:frame' : 'draw:custom-shape', {
      'draw:name': shape.name,
      'svg:x': rotation ? undefined : cm(x?.x ?? 0), 'svg:y': rotation ? undefined : cm(x?.y ?? 0),
      'svg:width': cm(x?.width ?? 0), 'svg:height': cm(x?.height ?? 0), 'draw:transform': rotation, ...attrs,
    }, kids);
  }

  private shapeGraphic(shape: { fill?: Fill; line?: Line }): string | undefined {
    const a: Record<string, string> = {};
    const fill = this.color(shape.fill);
    a['draw:fill'] = fill ? 'solid' : 'none';
    if (fill) a['draw:fill-color'] = fill;
    const stroke = this.color(shape.line);
    a['draw:stroke'] = stroke ? 'solid' : 'none';
    if (stroke) {
      a['svg:stroke-color'] = stroke;
      if (shape.line?.width) a['svg:stroke-width'] = cm(shape.line.width);
    }
    return this.style('graphic', a);
  }

  private geometryOf(geometry: Geometry): XmlElement {
    if (geometry.type === 'preset') return el('draw:enhanced-geometry', { 'draw:type': PRESET_TYPES[geometry.preset] ?? 'rectangle' });
    const path = geometry.paths[0];
    const [w, h] = [path?.width ?? 100, path?.height ?? 100];
    const parts = (path?.commands ?? []).map((c) => {
      const n = (v: number | string): number => (typeof v === 'number' ? Math.round(v) : 0);
      switch (c.cmd) {
        case 'moveTo': return `M ${n(c.pt.x)} ${n(c.pt.y)}`;
        case 'lineTo': return `L ${n(c.pt.x)} ${n(c.pt.y)}`;
        case 'cubicBezTo': return `C ${c.pts.map((p) => `${n(p.x)} ${n(p.y)}`).join(' ')}`;
        case 'quadBezTo': return `Q ${c.pts.map((p) => `${n(p.x)} ${n(p.y)}`).join(' ')}`;
        case 'close': return 'Z';
        default: return '';
      }
    });
    return el('draw:enhanced-geometry', { 'svg:viewBox': `0 0 ${Math.round(w)} ${Math.round(h)}`, 'draw:type': 'non-primitive', 'draw:enhanced-path': `${parts.join(' ')} N` });
  }

  private image(mediaId: string): string | undefined {
    const item = this.deck.media[mediaId];
    if (!item) return undefined;
    let path = this.media.get(mediaId);
    if (!path) {
      path = `Pictures/${mediaId}.${item.extension}`;
      this.media.set(mediaId, path);
      this.files.set(path, item.bytes);
    }
    return path;
  }

  private shape(raw: Shape): XmlElement[] {
    if (!this.slide) return [];
    const shape = effectiveShape(this.deck, this.slide, raw);
    switch (shape.kind) {
      case 'shape': {
        const text = this.paragraphs(shape.text);
        const style = this.shapeGraphic(shape);
        if (shape.textBox || shape.placeholder) {
          const box = el('draw:text-box', {}, text.length ? text : [el('text:p')]);
          return [this.frame(shape, { 'draw:style-name': style, 'presentation:class': shape.placeholder?.type === 'title' || shape.placeholder?.type === 'ctrTitle' ? 'title' : undefined }, [box])];
        }
        return [this.frame(shape, { 'draw:style-name': style }, [...text, this.geometryOf(shape.geometry)])];
      }
      case 'picture': {
        const href = this.image(shape.mediaId);
        return href ? [this.frame(shape, {}, [el('draw:image', { 'xlink:href': href, 'xlink:type': 'simple', 'xlink:show': 'embed', 'xlink:actuate': 'onLoad' })])] : [];
      }
      case 'group': return shape.children.flatMap((c) => this.shape(c));
      case 'connector': {
        const x = shape.xfrm;
        if (!x) return [];
        const [x1, x2] = x.flipH ? [x.x + x.width, x.x] : [x.x, x.x + x.width];
        const [y1, y2] = x.flipV ? [x.y + x.height, x.y] : [x.y, x.y + x.height];
        return [el('draw:line', { 'draw:name': shape.name, 'draw:style-name': this.shapeGraphic({ line: shape.line }), 'svg:x1': cm(x1), 'svg:y1': cm(y1), 'svg:x2': cm(x2), 'svg:y2': cm(y2) })];
      }
      case 'table': {
        const rows = shape.table.rows.map((r) => el('table:table-row', {}, r.cells.map((c) => el('table:table-cell', { 'office:value-type': 'string' }, this.paragraphs(c.text)))));
        const cols = shape.table.columns.map((w) => el('table:table-column', { 'style:column-width': cm(w) }));
        const table = el('table:table', { 'table:name': shape.name }, [...cols, ...rows]);
        return [el('draw:frame', { 'draw:name': shape.name, 'svg:x': cm(shape.xfrm?.x ?? 0), 'svg:y': cm(shape.xfrm?.y ?? 0), 'svg:width': cm(shape.xfrm?.width ?? 0), 'svg:height': cm(shape.xfrm?.height ?? 0) }, [table])];
      }
      case 'smartart': case 'raw': return shape.fallback.flatMap((c) => this.shape(c));
      default: return [];
    }
  }

  private page(slide: Slide, index: number): XmlElement {
    this.slide = slide;
    const kids: XmlElement[] = slide.shapes.flatMap((s) => this.shape(s));
    if (slide.notes?.length) {
      kids.push(el('presentation:notes', {}, [el('draw:frame', { 'presentation:class': 'notes' }, [el('draw:text-box', {}, this.paragraphs({ props: {}, paragraphs: slide.notes }))])]));
    }
    return el('draw:page', { 'draw:name': slide.name ?? `page${index + 1}`, 'draw:master-page-name': 'Default', 'presentation:visibility': slide.hidden ? 'hidden' : undefined }, kids);
  }

  build(): void {
    const pages = this.deck.slides.map((s, i) => this.page(s, i));
    const { width, height } = this.deck.size;
    const layout = el('style:page-layout', { 'style:name': 'PM1' }, [el('style:page-layout-properties', { 'fo:page-width': cm(width), 'fo:page-height': cm(height), 'fo:margin-top': '0cm', 'fo:margin-bottom': '0cm', 'fo:margin-left': '0cm', 'fo:margin-right': '0cm' })]);
    const content = el('office:document-content', NS, [
      el('office:automatic-styles', {}, this.styles),
      el('office:body', {}, [el('office:presentation', {}, pages)]),
    ]);
    const styles = el('office:document-styles', NS, [
      el('office:automatic-styles', {}, [layout]),
      el('office:master-styles', {}, [el('style:master-page', { 'style:name': 'Default', 'style:page-layout-name': 'PM1' })]),
    ]);
    const p = this.deck.properties;
    const meta = el('office:document-meta', NS, [el('office:meta', {}, [
      ...(p.title ? [el('dc:title', {}, [p.title])] : []), ...(p.creator ? [el('meta:initial-creator', {}, [p.creator])] : []),
      ...(p.description ? [el('dc:description', {}, [p.description])] : []), ...(p.keywords ? [el('meta:keyword', {}, [p.keywords])] : []),
    ])]);
    const enc = (xml: XmlElement): Uint8Array => new TextEncoder().encode(serializeXml(xml));
    this.files.set('content.xml', enc(content));
    this.files.set('styles.xml', enc(styles));
    this.files.set('meta.xml', enc(meta));
  }
}

/** Ecrit la presentation au format OpenDocument (.odp), version basique : voir l'en-tete du fichier pour le perimetre. */
export async function writeOdp(deck: Deck): Promise<Uint8Array> {
  const writer = new OdpWriter(deck);
  writer.build();
  const zip = new JSZip();
  zip.file('mimetype', MIME, { compression: 'STORE' });
  const entries = [
    el('manifest:file-entry', { 'manifest:full-path': '/', 'manifest:version': '1.3', 'manifest:media-type': MIME }),
    ...[...writer.files.keys()].map((path) => el('manifest:file-entry', { 'manifest:full-path': path, 'manifest:media-type': path.endsWith('.xml') ? 'text/xml' : (deck.media[path.replace(/^Pictures\/(.*)\.[^.]+$/, '$1')]?.contentType ?? 'application/octet-stream') })),
  ];
  zip.file('META-INF/manifest.xml', serializeXml(el('manifest:manifest', { 'xmlns:manifest': NS['xmlns:manifest'], 'manifest:version': '1.3' }, entries)));
  for (const [path, bytes] of writer.files) zip.file(path, bytes);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
