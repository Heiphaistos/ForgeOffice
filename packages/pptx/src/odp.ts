// Lecture des presentations OpenDocument (.odp) : pages, cadres de texte, formes, images, tableaux, notes, styles de base.
import { attr, child, children, normalizePartPath, OpcPackage, textOf, type XmlElement, type XmlNode } from '@forgeoffice/opc';
import { createBlankDeck } from './blank.ts';
import { safeUrl } from './dml-read.ts';
import type { Fill, Line, Paragraph, ParagraphProps, Run, RunProps, TextBody, Transform } from './dml.ts';
import { addMedia, nextSlideId } from './edit.ts';
import type { AutoShape, Connector, Deck, GroupShape, Picture, PlaceholderType, Shape, Slide, TableCell, TableShape, Transition } from './model.ts';
import { PresentationError } from './pptx-read.ts';
import { STRINGS } from './strings.ts';
import { extensionOf } from './xmlns.ts';

const MAX_STYLE_DEPTH = 16;

/** Longueur ODF (cm, mm, in, pt, pc, px) en points. */
export function odfLength(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = raw.trim().match(/^(-?[\d.]+)\s*(cm|mm|in|pt|pc|px)?$/);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  switch (match[2]) {
    case 'cm':
      return (value / 2.54) * 72;
    case 'mm':
      return (value / 25.4) * 72;
    case 'in':
      return value * 72;
    case 'pc':
      return value * 12;
    case 'px':
      return value * 0.75;
    default:
      return value;
  }
}

interface OdfStyle {
  parent?: string;
  text: Record<string, string>;
  paragraph: Record<string, string>;
  graphic: Record<string, string>;
  page: Record<string, string>;
  listLevels?: Array<{ bullet?: string; numbered?: string }>;
}

class StyleSheet {
  private readonly styles = new Map<string, OdfStyle>();
  readonly fonts = new Map<string, string>();
  readonly pageLayouts = new Map<string, Record<string, string>>();
  readonly masterLayouts = new Map<string, string>();

  load(root: XmlElement | undefined): void {
    if (!root) return;
    for (const face of children(child(root, 'office:font-face-decls'), 'style:font-face')) {
      const name = attr(face, 'style:name');
      const family = attr(face, 'svg:font-family')?.replace(/^['"]|['"]$/g, '');
      if (name && family) this.fonts.set(name, family);
    }
    for (const section of ['office:styles', 'office:automatic-styles', 'office:master-styles']) {
      for (const node of children(child(root, section))) {
        const name = attr(node, 'style:name');
        if (!name) continue;
        if (node.name === 'style:style' || node.name === 'style:default-style') {
          const props = (tag: string): Record<string, string> => ({ ...(child(node, tag)?.attrs ?? {}) });
          this.styles.set(name, {
            parent: attr(node, 'style:parent-style-name'),
            text: props('style:text-properties'),
            paragraph: props('style:paragraph-properties'),
            graphic: { ...props('style:graphic-properties'), ...props('loext:graphic-properties') },
            page: props('style:drawing-page-properties'),
          });
        } else if (node.name === 'text:list-style') {
          const levels = children(node).map((lvl) => ({ bullet: attr(lvl, 'text:bullet-char'), numbered: lvl.name === 'text:list-level-style-number' ? attr(lvl, 'style:num-format') ?? '1' : undefined }));
          this.styles.set(name, { text: {}, paragraph: {}, graphic: {}, page: {}, listLevels: levels });
        } else if (node.name === 'style:page-layout') {
          this.pageLayouts.set(name, { ...(child(node, 'style:page-layout-properties')?.attrs ?? {}) });
        } else if (node.name === 'style:master-page') {
          const layout = attr(node, 'style:page-layout-name');
          if (layout) this.masterLayouts.set(name, layout);
        }
      }
    }
  }

  /** Proprietes fusionnees (parents d'abord) d'une famille. */
  resolve(name: string | undefined, family: 'text' | 'paragraph' | 'graphic' | 'page'): Record<string, string> {
    const chain: OdfStyle[] = [];
    let current = name;
    for (let depth = 0; current && depth < MAX_STYLE_DEPTH; depth++) {
      const style = this.styles.get(current);
      if (!style) break;
      chain.unshift(style);
      current = style.parent;
    }
    return Object.assign({}, ...chain.map((s) => s[family])) as Record<string, string>;
  }

  list(name: string | undefined): OdfStyle['listLevels'] {
    return name ? this.styles.get(name)?.listLevels : undefined;
  }
}

const hexColor = (raw: string | undefined): string | undefined => {
  const match = raw?.match(/^#([0-9a-fA-F]{6})$/);
  return match?.[1]?.toUpperCase();
};

function runProps(props: Record<string, string>, sheet: StyleSheet): RunProps {
  const out: RunProps = {};
  const size = props['fo:font-size'];
  const sizePt = size && !size.endsWith('%') ? odfLength(size) : undefined;
  if (sizePt !== undefined) out.size = sizePt;
  if (props['fo:font-weight'] && props['fo:font-weight'] !== 'normal') out.bold = props['fo:font-weight'] === 'bold' || Number(props['fo:font-weight']) >= 600;
  if (props['fo:font-style'] === 'italic' || props['fo:font-style'] === 'oblique') out.italic = true;
  const underline = props['style:text-underline-style'];
  if (underline && underline !== 'none') out.underline = props['style:text-underline-type'] === 'double' ? 'dbl' : 'sng';
  const strike = props['style:text-line-through-style'];
  if (strike && strike !== 'none') out.strike = 'sngStrike';
  const color = hexColor(props['fo:color']);
  if (color) out.color = { type: 'rgb', value: color };
  const highlight = hexColor(props['fo:background-color']);
  if (highlight) out.highlight = { type: 'rgb', value: highlight };
  const fontName = props['style:font-name'];
  const font = (fontName && sheet.fonts.get(fontName)) ?? props['fo:font-family']?.replace(/^['"]|['"]$/g, '');
  if (font) out.font = font;
  const position = props['style:text-position'];
  if (position?.startsWith('super')) out.baseline = 30;
  else if (position?.startsWith('sub')) out.baseline = -25;
  else if (position && /^-?\d/.test(position)) out.baseline = Number.parseFloat(position);
  const transform = props['fo:text-transform'];
  if (transform === 'uppercase') out.caps = 'all';
  if (props['fo:font-variant'] === 'small-caps') out.caps = 'small';
  return out;
}

const ALIGN: Readonly<Record<string, ParagraphProps['align']>> = { start: 'l', left: 'l', center: 'ctr', end: 'r', right: 'r', justify: 'just' };

function paragraphProps(props: Record<string, string>): ParagraphProps {
  const out: ParagraphProps = {};
  const align = ALIGN[props['fo:text-align'] ?? ''];
  if (align) out.align = align;
  const marginLeft = odfLength(props['fo:margin-left']);
  if (marginLeft) out.marginLeft = marginLeft;
  const indent = odfLength(props['fo:text-indent']);
  if (indent) out.indent = indent;
  const before = odfLength(props['fo:margin-top']);
  if (before) out.spaceBefore = { type: 'pts', value: before };
  const after = odfLength(props['fo:margin-bottom']);
  if (after) out.spaceAfter = { type: 'pts', value: after };
  const lineHeight = props['fo:line-height'];
  if (lineHeight?.endsWith('%')) out.lineSpacing = { type: 'pct', value: Number.parseFloat(lineHeight) };
  return out;
}

class OdpReader {
  readonly sheet = new StyleSheet();
  readonly deck: Deck;
  readonly pkg: OpcPackage;
  private nextId = 2;

  constructor(pkg: OpcPackage, deck: Deck) {
    this.pkg = pkg;
    this.deck = deck;
  }

  resetIds(): void {
    this.nextId = 2;
  }

  id(): number {
    return this.nextId++;
  }

  runs(node: XmlNode, props: RunProps, out: Run[]): void {
    if (typeof node === 'string') {
      const text = node.replace(/[\r\n\t]+/g, ' ');
      if (text) out.push({ type: 'text', text, props: { ...props } });
      return;
    }
    switch (node.name) {
      case 'text:span': {
        const merged = { ...props, ...runProps(this.sheet.resolve(attr(node, 'text:style-name'), 'text'), this.sheet) };
        for (const kid of node.children) this.runs(kid, merged, out);
        return;
      }
      case 'text:s':
        out.push({ type: 'text', text: ' '.repeat(Math.min(1000, Math.max(1, Number(attr(node, 'text:c') ?? '1') || 1))), props: { ...props } });
        return;
      case 'text:tab':
        out.push({ type: 'text', text: '\t', props: { ...props } });
        return;
      case 'text:line-break':
        out.push({ type: 'break', props: { ...props } });
        return;
      case 'text:a': {
        const url = safeUrl(attr(node, 'xlink:href') ?? '');
        const linked = url ? { ...props, link: { url } } : props;
        for (const kid of node.children) this.runs(kid, linked, out);
        return;
      }
      case 'text:page-number':
        out.push({ type: 'field', fieldType: 'slidenum', id: '{8B3D2A61-0F1B-4F5C-9E2B-4D7C1A2B3C02}', text: textOf(node), props: { ...props } });
        return;
      default:
        for (const kid of node.children) this.runs(kid, props, out);
    }
  }

  paragraph(node: XmlElement, level: number, bullet: ParagraphProps['bullet'] | undefined): Paragraph {
    const styleName = attr(node, 'text:style-name');
    const props: ParagraphProps = { ...paragraphProps(this.sheet.resolve(styleName, 'paragraph')) };
    if (level) props.level = level;
    if (bullet) props.bullet = bullet;
    const base = runProps(this.sheet.resolve(styleName, 'text'), this.sheet);
    const runs: Run[] = [];
    for (const kid of node.children) this.runs(kid, base, runs);
    return { props, runs };
  }

  paragraphs(container: XmlElement, level = 0, listStyle?: string, out: Paragraph[] = []): Paragraph[] {
    for (const node of children(container)) {
      if (node.name === 'text:p' || node.name === 'text:h') {
        out.push(this.paragraph(node, level, undefined));
      } else if (node.name === 'text:list') {
        const style = attr(node, 'text:style-name') ?? listStyle;
        const levels = this.sheet.list(style);
        for (const item of children(node, 'text:list-item')) {
          const def = levels?.[level];
          const bullet: ParagraphProps['bullet'] = def?.numbered ? { type: 'auto', scheme: def.numbered === 'a' ? 'alphaLcPeriod' : def.numbered === 'i' ? 'romanLcPeriod' : 'arabicPeriod' } : { type: 'char', char: def?.bullet ?? '•' };
          for (const kid of children(item)) {
            if (kid.name === 'text:p' || kid.name === 'text:h') out.push(this.paragraph(kid, level, bullet));
            else if (kid.name === 'text:list') this.paragraphs({ name: 'wrap', attrs: {}, children: [kid] }, level + 1, style, out);
          }
        }
      }
    }
    return out;
  }

  textBody(container: XmlElement, graphic: Record<string, string>): TextBody | undefined {
    const paragraphs = this.paragraphs(container);
    if (!paragraphs.length) return undefined;
    const body: TextBody = { props: { wrap: true }, paragraphs };
    const anchor = graphic['draw:textarea-vertical-align'];
    if (anchor === 'middle') body.props.anchor = 'ctr';
    else if (anchor === 'bottom') body.props.anchor = 'b';
    else if (anchor === 'top') body.props.anchor = 't';
    const pad = (key: string): number | undefined => odfLength(graphic[key]);
    const insets = { left: pad('fo:padding-left'), top: pad('fo:padding-top'), right: pad('fo:padding-right'), bottom: pad('fo:padding-bottom') };
    if (Object.values(insets).some((v) => v !== undefined)) body.props.insets = Object.fromEntries(Object.entries(insets).filter(([, v]) => v !== undefined));
    return body;
  }

  fillAndLine(graphic: Record<string, string>): { fill?: Fill; line?: Line } {
    const out: { fill?: Fill; line?: Line } = {};
    const fill = graphic['draw:fill'];
    const fillColor = hexColor(graphic['draw:fill-color']);
    if (fill === 'none') out.fill = { type: 'none' };
    else if (fillColor && (fill === 'solid' || fill === undefined)) out.fill = { type: 'solid', color: { type: 'rgb', value: fillColor } };
    const stroke = graphic['draw:stroke'];
    const strokeColor = hexColor(graphic['svg:stroke-color']);
    const width = odfLength(graphic['svg:stroke-width']);
    if (stroke === 'none') out.line = { fill: { type: 'none' } };
    else if (stroke || strokeColor || width) {
      out.line = {};
      if (strokeColor) out.line.fill = { type: 'solid', color: { type: 'rgb', value: strokeColor } };
      if (width) out.line.width = width;
      if (stroke === 'dash') out.line.dash = 'dash';
    }
    return out;
  }

  transform(node: XmlElement): Transform {
    const xfrm: Transform = {
      x: odfLength(attr(node, 'svg:x')) ?? 0,
      y: odfLength(attr(node, 'svg:y')) ?? 0,
      width: odfLength(attr(node, 'svg:width')) ?? 0,
      height: odfLength(attr(node, 'svg:height')) ?? 0,
    };
    const transform = attr(node, 'draw:transform');
    if (!transform) return xfrm;
    // Operations appliquees de gauche a droite au cadre local (0,0)-(w,h) ; rotate() en radians, sens antihoraire.
    let cx = xfrm.width / 2;
    let cy = xfrm.height / 2;
    let angle = 0;
    let translated = false;
    for (const op of transform.matchAll(/(rotate|translate|scale)\s*\(([^)]*)\)/g)) {
      const args = (op[2] ?? '').trim().split(/[\s,]+/);
      if (op[1] === 'rotate') {
        const t = Number(args[0]);
        if (!Number.isFinite(t)) continue;
        [cx, cy] = [cx * Math.cos(t) + cy * Math.sin(t), -cx * Math.sin(t) + cy * Math.cos(t)];
        angle += t;
      } else if (op[1] === 'translate') {
        cx += odfLength(args[0]) ?? 0;
        cy += odfLength(args[1]) ?? 0;
        translated = true;
      } else {
        const sx = Number(args[0]);
        const sy = args[1] === undefined ? sx : Number(args[1]);
        if (Number.isFinite(sx) && Number.isFinite(sy)) [cx, cy] = [cx * sx, cy * sy];
      }
    }
    if (!translated) {
      cx += xfrm.x;
      cy += xfrm.y;
    }
    xfrm.x = cx - xfrm.width / 2;
    xfrm.y = cy - xfrm.height / 2;
    const deg = (-angle * 180) / Math.PI;
    const rotation = ((deg % 360) + 360) % 360;
    if (rotation > 0.01 && rotation < 359.99) xfrm.rotation = Math.round(rotation * 1000) / 1000;
    return xfrm;
  }

  async image(href: string, xfrm: Transform, name: string, id: number): Promise<Picture | undefined> {
    if (/^[a-z]+:/i.test(href)) return undefined;
    let path: string;
    try {
      path = normalizePartPath(href);
    } catch {
      return undefined;
    }
    if (!this.pkg.has(path)) return undefined;
    const mediaId = addMedia(this.deck, await this.pkg.readBytes(path), extensionOf(path) || 'png');
    return { kind: 'picture', id, name: name || `${STRINGS.pictureName} ${id - 1}`, xfrm, mediaId, fillMode: 'stretch', geometry: { type: 'preset', preset: 'rect' } };
  }

  table(node: XmlElement, xfrm: Transform, id: number): TableShape {
    let columns = 0;
    for (const col of children(node, 'table:table-column')) columns += Math.min(1000, Number(attr(col, 'table:number-columns-repeated') ?? '1') || 1);
    const rowNodes = [...children(node, 'table:table-row'), ...children(child(node, 'table:table-header-rows'), 'table:table-row')];
    const rows = rowNodes.map((row) => {
      const cells: TableCell[] = [];
      for (const cell of children(row)) {
        if (cell.name !== 'table:table-cell' && cell.name !== 'table:covered-table-cell') continue;
        const out: TableCell = { text: this.textBody(cell, {}) ?? { props: {}, paragraphs: [{ props: {}, runs: [] }] } };
        const span = Number(attr(cell, 'table:number-columns-spanned') ?? '1');
        const rowSpan = Number(attr(cell, 'table:number-rows-spanned') ?? '1');
        if (span > 1) out.gridSpan = span;
        if (rowSpan > 1) out.rowSpan = rowSpan;
        if (cell.name === 'table:covered-table-cell') out.hMerge = true;
        cells.push(out);
      }
      return { height: xfrm.height / Math.max(1, rowNodes.length), cells };
    });
    const count = Math.max(columns, ...rows.map((r) => r.cells.length), 1);
    return { kind: 'table', id, name: `${STRINGS.tableName} ${id - 1}`, xfrm, table: { columns: Array.from({ length: count }, () => xfrm.width / count), rows, firstRow: true, bandRow: true, styleId: '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}' } };
  }

  async shape(node: XmlElement): Promise<Shape | undefined> {
    const graphic = this.sheet.resolve(attr(node, 'draw:style-name') ?? attr(node, 'presentation:style-name'), 'graphic');
    const name = attr(node, 'draw:name') ?? '';
    const cls = attr(node, 'presentation:class');
    switch (node.name) {
      case 'draw:frame': {
        const xfrm = this.transform(node);
        const id = this.id();
        const table = child(node, 'table:table');
        if (table) return this.table(table, xfrm, id);
        const image = child(node, 'draw:image');
        if (image) return this.image(attr(image, 'xlink:href') ?? '', xfrm, name, id);
        const box = child(node, 'draw:text-box');
        if (!box) return undefined;
        const shape: AutoShape = { kind: 'shape', id, name: name || `${STRINGS.textBoxName} ${id - 1}`, xfrm, geometry: { type: 'preset', preset: 'rect' }, ...this.fillAndLine(graphic) };
        const text = this.textBody(box, graphic);
        shape.text = text ?? { props: {}, paragraphs: [{ props: {}, runs: [] }] };
        const placeholder = PLACEHOLDER_CLASSES[cls ?? ''];
        if (placeholder) shape.placeholder = placeholder === 'title' || placeholder === 'ctrTitle' ? { type: placeholder } : { type: placeholder, index: 1 };
        else shape.textBox = true;
        return shape;
      }
      case 'draw:custom-shape':
      case 'draw:rect':
      case 'draw:ellipse':
      case 'draw:circle': {
        const type = node.name === 'draw:custom-shape' ? attr(child(node, 'draw:enhanced-geometry'), 'draw:type') ?? 'rectangle' : node.name === 'draw:rect' ? 'rectangle' : 'ellipse';
        const preset = PRESETS[type] ?? (type.startsWith('ooxml-') ? type.slice(6) : 'rect');
        const id = this.id();
        const xfrm = this.transform(node);
        const geometry = child(node, 'draw:enhanced-geometry');
        // Miroir de la geometrie ODF = retournement OOXML, dont la rotation se lit dans l'autre sens.
        const flipH = attr(geometry, 'draw:mirror-horizontal') === 'true';
        const flipV = attr(geometry, 'draw:mirror-vertical') === 'true';
        if (flipH) xfrm.flipH = true;
        if (flipV) xfrm.flipV = true;
        if (flipH !== flipV && xfrm.rotation) xfrm.rotation = 360 - xfrm.rotation;
        const shape: AutoShape = { kind: 'shape', id, name: name || `${preset} ${id - 1}`, xfrm, geometry: { type: 'preset', preset }, ...this.fillAndLine(graphic) };
        const text = this.textBody(node, graphic);
        if (text) shape.text = { ...text, props: { ...text.props, anchor: text.props.anchor ?? 'ctr' } };
        return shape;
      }
      case 'draw:line':
      case 'draw:connector': {
        const x1 = odfLength(attr(node, 'svg:x1')) ?? 0;
        const y1 = odfLength(attr(node, 'svg:y1')) ?? 0;
        const x2 = odfLength(attr(node, 'svg:x2')) ?? 0;
        const y2 = odfLength(attr(node, 'svg:y2')) ?? 0;
        const id = this.id();
        const connector: Connector = {
          kind: 'connector',
          id,
          name: name || `${STRINGS.connectorName} ${id - 1}`,
          xfrm: { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), flipH: x2 < x1 || undefined, flipV: y2 < y1 || undefined },
          geometry: { type: 'preset', preset: 'line' },
          line: this.fillAndLine(graphic).line ?? { fill: { type: 'solid', color: { type: 'rgb', value: '000000' } }, width: 1 },
        };
        if (!connector.xfrm?.flipH) delete connector.xfrm?.flipH;
        if (!connector.xfrm?.flipV) delete connector.xfrm?.flipV;
        return connector;
      }
      case 'draw:g': {
        const kids = await this.shapes(node);
        if (!kids.length) return undefined;
        const boxes = kids.map((k) => k.xfrm).filter((x): x is Transform => x !== undefined);
        const left = Math.min(...boxes.map((b) => b.x));
        const top = Math.min(...boxes.map((b) => b.y));
        const right = Math.max(...boxes.map((b) => b.x + b.width));
        const bottom = Math.max(...boxes.map((b) => b.y + b.height));
        const id = this.id();
        const group: GroupShape = {
          kind: 'group',
          id,
          name: name || `${STRINGS.groupName} ${id - 1}`,
          xfrm: { x: left, y: top, width: right - left, height: bottom - top },
          childOffset: { x: left, y: top },
          childExtent: { width: right - left, height: bottom - top },
          children: kids,
        };
        return group;
      }
      default:
        return undefined;
    }
  }

  async shapes(container: XmlElement): Promise<Shape[]> {
    const out: Shape[] = [];
    for (const node of children(container)) {
      if (node.name === 'presentation:notes' || node.name === 'office:forms') continue;
      if (attr(node, 'presentation:class') === 'notes' || attr(node, 'presentation:class') === 'page') continue;
      const shape = await this.shape(node);
      if (!shape) continue;
      const title = textOf(child(node, 'svg:title')).trim();
      const description = textOf(child(node, 'svg:desc')).trim();
      if (title) shape.title = title;
      if (description) shape.description = description;
      out.push(shape);
    }
    return out;
  }
}

const PLACEHOLDER_CLASSES: Readonly<Record<string, PlaceholderType>> = { title: 'title', subtitle: 'subTitle', outline: 'body', text: 'body' };

const PRESETS: Readonly<Record<string, string>> = {
  rectangle: 'rect',
  'round-rectangle': 'roundRect',
  ellipse: 'ellipse',
  circle: 'ellipse',
  'isosceles-triangle': 'triangle',
  'right-triangle': 'rtTriangle',
  diamond: 'diamond',
  pentagon: 'pentagon',
  hexagon: 'hexagon',
  octagon: 'octagon',
  parallelogram: 'parallelogram',
  trapezoid: 'trapezoid',
  'right-arrow': 'rightArrow',
  'left-arrow': 'leftArrow',
  'up-arrow': 'upArrow',
  'down-arrow': 'downArrow',
  'left-right-arrow': 'leftRightArrow',
  'up-down-arrow': 'upDownArrow',
  star5: 'star5',
  star4: 'star4',
  star8: 'star8',
  heart: 'heart',
  smiley: 'smileyFace',
  sun: 'sun',
  moon: 'moon',
  cloud: 'cloud',
  'flowchart-process': 'flowChartProcess',
  'flowchart-decision': 'flowChartDecision',
  'flowchart-terminator': 'flowChartTerminator',
  cross: 'plus',
  'block-arc': 'blockArc',
  can: 'can',
  cube: 'cube',
};

/** Sens SMIL -> sens OOXML (« fromBottom » : la diapositive entre par le bas, donc monte). */
const DIRECTIONS: Readonly<Record<string, string>> = { fromBottom: 'u', fromTop: 'd', fromLeft: 'r', fromRight: 'l' };

/** Duree ISO 8601 ODF (PT3S, PT1M2.5S, PT00H00M05S) en millisecondes. */
function odfDuration(raw: string | undefined): number | undefined {
  const match = raw?.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match || !raw || raw === 'PT') return undefined;
  const [, h, m, s] = match;
  return Math.round((Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0)) * 1000);
}

const TRANSITIONS: Readonly<Record<string, string>> = { fade: 'fade', barWipe: 'wipe', pushWipe: 'push', slideWipe: 'cover', irisWipe: 'zoom', clockWipe: 'wheel', fanWipe: 'wedge', randomBarWipe: 'randomBar', checkerBoardWipe: 'checker', dissolve: 'dissolve', blindsWipe: 'blinds' };

function chooseLayout(shapes: Shape[]): string {
  const types = new Set(shapes.map((s) => s.placeholder?.type));
  if (types.has('subTitle')) return 'layout1';
  if (types.has('title') && types.has('body')) return 'layout2';
  if (types.has('title')) return 'layout6';
  return 'layout7';
}

async function readMeta(pkg: OpcPackage, deck: Deck): Promise<void> {
  if (!pkg.has('meta.xml')) return;
  const meta = child(await pkg.readXml('meta.xml'), 'office:meta');
  const get = (tag: string): string | undefined => {
    const node = child(meta, tag);
    return node ? textOf(node) : undefined;
  };
  deck.properties = {
    ...deck.properties,
    title: get('dc:title') ?? deck.properties.title,
    subject: get('dc:subject'),
    description: get('dc:description'),
    creator: get('meta:initial-creator') ?? get('dc:creator') ?? deck.properties.creator,
    lastModifiedBy: get('dc:creator') ?? deck.properties.lastModifiedBy,
    created: get('meta:creation-date') ?? deck.properties.created,
    modified: get('dc:date') ?? deck.properties.modified,
    keywords: children(meta, 'meta:keyword').map(textOf).join(', ') || undefined,
    language: get('dc:language'),
  };
  for (const key of Object.keys(deck.properties) as Array<keyof Deck['properties']>) if (deck.properties[key] === undefined) delete deck.properties[key];
}

/** Lit une presentation OpenDocument. */
export async function readOdp(bytes: Uint8Array): Promise<Deck> {
  const pkg = await OpcPackage.open(bytes);
  if (!pkg.has('content.xml')) throw new PresentationError(STRINGS.errors.odpCorrupt);
  const content = await pkg.readXml('content.xml');
  const styles = pkg.has('styles.xml') ? await pkg.readXml('styles.xml') : undefined;
  const presentation = child(child(content, 'office:body'), 'office:presentation');
  if (!presentation) throw new PresentationError(STRINGS.errors.odpCorrupt);
  const pages = children(presentation, 'draw:page');
  const probe = new StyleSheet();
  probe.load(styles);
  probe.load(content);
  const masterName = attr(pages[0], 'draw:master-page-name') ?? 'Default';
  const layout = probe.pageLayouts.get(probe.masterLayouts.get(masterName) ?? '') ?? {};
  const width = odfLength(layout['fo:page-width']) ?? 793.7;
  const height = odfLength(layout['fo:page-height']) ?? 446.5;
  const deck = createBlankDeck({ width, height }, { titleSlide: false });
  const reader = new OdpReader(pkg, deck);
  reader.sheet.load(styles);
  reader.sheet.load(content);
  for (const page of pages) {
    reader.resetIds();
    const shapes = await reader.shapes(page);
    const slide: Slide = { id: nextSlideId(deck), layoutId: chooseLayout(shapes), shapes, animations: [], comments: [] };
    const name = attr(page, 'draw:name');
    if (name && !/^(page|slide)\d+$/i.test(name)) slide.name = name;
    const pageStyle = reader.sheet.resolve(attr(page, 'draw:style-name'), 'page');
    const background = hexColor(pageStyle['draw:fill-color']);
    if (pageStyle['draw:fill'] === 'solid' && background) slide.background = { type: 'fill', fill: { type: 'solid', color: { type: 'rgb', value: background } } };
    const smil = pageStyle['smil:type'];
    // transition-type (manual / automatic) ne decrit que l'avancement ; l'effet visuel vient de smil:type.
    const advanceAfter = pageStyle['presentation:transition-type'] === 'automatic' ? odfDuration(pageStyle['presentation:duration']) : undefined;
    if (smil || advanceAfter !== undefined) {
      const speed = pageStyle['presentation:transition-speed'];
      const transition: Transition = { type: smil ? (TRANSITIONS[smil] ?? 'fade') : 'cut', speed: speed === 'slow' ? 'slow' : speed === 'medium' ? 'med' : 'fast' };
      const dir = DIRECTIONS[pageStyle['smil:subtype'] ?? ''];
      if (smil && dir) transition.params = { dir };
      if (advanceAfter !== undefined) transition.advanceAfter = advanceAfter;
      slide.transition = transition;
    }
    if (pageStyle['presentation:visibility'] === 'hidden') slide.hidden = true;
    const notes = child(page, 'presentation:notes');
    if (notes) {
      const paragraphs = children(notes, 'draw:frame').flatMap((frame) => {
        const box = child(frame, 'draw:text-box');
        return box ? reader.paragraphs(box) : [];
      });
      if (paragraphs.some((p) => p.runs.length)) slide.notes = paragraphs;
    }
    deck.slides.push(slide);
  }
  await readMeta(pkg, deck);
  return deck;
}
