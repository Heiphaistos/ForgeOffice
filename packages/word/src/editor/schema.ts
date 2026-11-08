// Schema ProseMirror du module Texte : couvre le modele @forgeoffice/docx.
// - Proprietes de caracteres : une marque par propriete courante (rp_bold, rp_size...) + rp_rest pour le reste.
// - Elements en ligne non editables (images, champs, signets, notes, equations...) : noeud « atom » qui garde l'objet d'origine.
// - Paragraphes : attributs = styleId + proprietes directes ; le rendu des styles vient de la feuille documentStylesheet().
import { Schema, type DOMOutputSpec, type MarkSpec, type Mark, type Node as PMNode, type NodeSpec } from 'prosemirror-model';
import { tableNodes } from 'prosemirror-tables';
import {
  inlinesText, sanitizeUrl, type ContentControlProps, type ImageInline, type Inline, type ParagraphProps, type RunProps,
  type Floating, type TableCellProps, type TableProps, type TableRowProps,
} from '@forgeoffice/docx';
import { svgPoints } from '../objects/geometry.ts';
import { cellCss, paragraphCss, rowCss, runCss, tableCss } from './css.ts';

/** Proprietes de caracteres portees chacune par leur propre marque (basculables independamment). */
export const RUN_KEYS = [
  // underlineColor avant underline : sa marque enveloppe celle du soulignement et lui transmet --fo-ul.
  'underlineColor', 'kerning', 'bold', 'italic', 'underline', 'strike', 'doubleStrike', 'caps', 'smallCaps', 'font', 'fontTheme', 'size', 'color',
  'highlight', 'shading', 'vertAlign', 'spacing', 'hidden', 'lang', 'position', 'scale', 'outline', 'shadow', 'emboss',
  'imprint', 'border',
] as const satisfies readonly (keyof RunProps)[];

export type RunKey = (typeof RUN_KEYS)[number];

export const markName = (key: RunKey): string => `rp_${key}`;

/** Acces aux medias et aux URL depuis le rendu (fourni par l'application). */
export interface RenderContext {
  mediaUrl(mediaId: string): string | null;
  /** Enregistre une image collee (data:) et renvoie son identifiant de media, ou null si refusee. */
  addMedia(dataUrl: string): string | null;
}

export const NULL_CONTEXT: RenderContext = { mediaUrl: () => null, addMedia: () => null };

type Attrs = Record<string, unknown>;

const strip = (o: Attrs): Attrs => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));

/** Valeur JSON d'un attribut (relecture du DOM de l'editeur ou collage interne). Rejet si illisible. */
function jsonAttr(el: HTMLElement, name: string): unknown {
  const raw = el.getAttribute(name);
  if (raw === null || raw.length > 20_000) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined; // attribut abime : la marque est ignoree
  }
}

/** Regle de relecture d'une marque dont les attributs sont serialises en JSON dans `data-*`. */
function jsonRule(tag: string, attr: string, key: string): NonNullable<MarkSpec['parseDOM']>[number] {
  return {
    tag,
    getAttrs: (el: HTMLElement) => {
      const v = jsonAttr(el, attr);
      return v === undefined || v === null ? false : { [key]: v };
    },
  };
}

function runKeyMark(key: RunKey): MarkSpec {
  return {
    attrs: { v: {} },
    // data-v garde la valeur exacte : la relecture du DOM (frappe, collage interne) ne perd aucune mise en forme.
    parseDOM: [jsonRule(`span[data-rp="${key}"]`, 'data-v', 'v')],
    toDOM: (m: Mark): DOMOutputSpec => ['span', strip({ style: runCss({ [key]: m.attrs.v } as Partial<RunProps>), 'data-rp': key, 'data-v': JSON.stringify(m.attrs.v), lang: key === 'lang' && typeof m.attrs.v === 'string' ? m.attrs.v : null }), 0],
  };
}

function boolParse(tags: string[]): MarkSpec['parseDOM'] {
  return tags.map((tag) => ({ tag, getAttrs: () => ({ v: true }) }));
}

const sizeOf = (w: number, h: number): string => `width:${w}pt;height:${h}pt`;

/** Style CSS d'un objet flottant (image, forme, zone de texte) : habillage, ancrage, decalage. */
export function floatStyle(f: Floating | undefined): string[] {
  const style: string[] = [];
  if (f && f.wrap !== 'none' && f.wrap !== 'topAndBottom') {
    const right = f.horizontal.align === 'right' || f.horizontal.align === 'outside';
    style.push(`float:${right ? 'right' : 'left'}`, `margin:${f.distance.top}pt ${f.distance.right}pt ${f.distance.bottom}pt ${f.distance.left}pt`);
  } else if (f?.wrap === 'topAndBottom') style.push('display:block', 'margin:6pt auto');
  else if (f) {
    // Derriere / devant le texte : hors du flux, a sa place d'ancrage verticale ; horizontalement selon l'alignement ou le decalage.
    style.push('position:absolute', f.behindText ? 'z-index:-1' : 'z-index:2');
    const a = f.horizontal.align;
    if (a === 'center') style.push('left:50%', 'translate:-50% 0');
    else if (a === 'right' || a === 'outside') style.push('right:0');
    else if (a === 'left' || a === 'inside') style.push('left:0');
  }
  // Decalage fin (fleches du clavier, deplacement) : translation visuelle, sans reflux du texte.
  if (f && (f.horizontal.offset || f.vertical.offset)) style.push(`translate:${f.horizontal.offset ?? 0}pt ${f.vertical.offset ?? 0}pt`);
  return style;
}

function imageDOM(img: ImageInline, ctx: RenderContext): DOMOutputSpec {
  const src = ctx.mediaUrl(img.mediaId);
  const style: string[] = [sizeOf(img.width, img.height)];
  if (img.rotation) style.push(`transform:rotate(${img.rotation}deg)`);
  if (img.flipH || img.flipV) style.push(`scale:${img.flipH ? -1 : 1} ${img.flipV ? -1 : 1}`);
  style.push(...floatStyle(img.floating));
  return ['img', strip({ class: 'fo-img', src: src ?? '', alt: img.alt ?? '', title: img.title ?? null, style: style.join(';'), draggable: 'true' })];
}

/** Rendu d'un element en ligne conserve (atome). */
function atomDOM(data: Inline, ctx: RenderContext): DOMOutputSpec {
  switch (data.type) {
    case 'image': return imageDOM(data, ctx);
    case 'field':
      return ['span', { class: 'fo-fld', 'data-code': data.code, title: data.instruction, style: data.props ? runCss(data.props) : '' }, inlinesText(data.result) || '\u200b'];
    case 'break':
      return ['span', { class: data.kind === 'page' ? 'fo-pbreak' : 'fo-cbreak', 'data-break': data.kind }];
    case 'symbol': {
      const code = Number.parseInt(data.char, 16);
      const ch = Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code >= 0xf000 && code <= 0xf0ff ? code - 0xf000 : code) : '\ufffd';
      return ['span', { class: 'fo-sym', style: `font-family:"${data.font.replace(/["\\]/g, '')}"` }, ch];
    }
    case 'footnoteRef':
    case 'endnoteRef':
      return ['sup', { class: data.type === 'footnoteRef' ? 'fo-fnref' : 'fo-enref', 'data-note': String(data.noteId), 'data-custom': data.customMark ?? null }, data.customMark ?? ''];
    case 'noteMark': return ['sup', { class: 'fo-notemark' }];
    case 'equation': return ['span', { class: data.display ? 'fo-eq fo-eq--display' : 'fo-eq' }, data.text || '\u200b'];
    case 'shape': {
      const points = svgPoints(data.geometry);
      // Polygone : fond et contour sont dessines par un SVG (le contour n'est plus coupe par une decoupe CSS).
      const style = [sizeOf(data.width, data.height), !points && data.fill ? `background:#${data.fill}` : '', !points && data.line ? `border:${data.line.width}pt solid #${data.line.color}` : ''];
      style.push(...floatStyle(data.floating));
      if (data.rotation) style.push(`transform:rotate(${data.rotation}deg)`);
      if (data.geometry === 'ellipse') style.push('border-radius:50%');
      if (data.geometry === 'roundRect') style.push('border-radius:10pt');
      const text = data.text ? data.text.map((b) => (b.type === 'paragraph' ? inlinesText(b.inlines) : '')).join('\n') : '';
      const attrs = { class: 'fo-shape', 'data-geometry': data.geometry, style: style.filter(Boolean).join(';') };
      if (!points) return ['span', attrs, text || '\u200b'];
      const SVG = 'http://www.w3.org/2000/svg';
      const polygon: DOMOutputSpec = [`${SVG} polygon`, { points, fill: data.fill ? `#${data.fill}` : 'none', stroke: data.line ? `#${data.line.color}` : 'none', 'stroke-width': String(data.line ? data.line.width * 4 / 3 : 0), 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }];
      return ['span', attrs, [`${SVG} svg`, { class: 'fo-shape__svg', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, polygon], ['span', { class: 'fo-shape__text' }, text || '\u200b']];
    }
    case 'bookmarkStart': return ['span', { class: 'fo-marker fo-bm', 'data-bm': data.name }];
    case 'commentStart':
    case 'commentEnd':
    case 'commentRef':
      return ['span', { class: `fo-marker fo-${data.type}`, 'data-comment': String(data.commentId) }];
    case 'raw': return ['span', { class: 'fo-raw', title: data.xml.name }, '\u25c6'];
    default: return ['span', { class: 'fo-marker', 'data-kind': data.type }];
  }
}

const isDataImage = (src: string): boolean => /^data:image\/(png|jpe?g|gif|webp|bmp);base64,/i.test(src);

export function createSchema(ctx: RenderContext = NULL_CONTEXT): Schema {
  const tables = tableNodes({
    tableGroup: 'block',
    cellContent: 'block+',
    cellAttributes: {
      props: { default: {} },
    },
  });
  const cellSpec = (tag: string): NodeSpec => {
    const base = tag === 'td' ? tables.table_cell : tables.table_header;
    return {
      ...base,
      toDOM: (node: PMNode): DOMOutputSpec => {
        const a = node.attrs;
        const attrs: Attrs = { style: cellCss(a.props as TableCellProps) };
        if (a.colspan !== 1) attrs.colspan = String(a.colspan);
        if (a.rowspan !== 1) attrs.rowspan = String(a.rowspan);
        if (Array.isArray(a.colwidth)) attrs['data-colwidth'] = (a.colwidth as number[]).join(',');
        return [tag, strip(attrs), 0];
      },
    };
  };
  const nodes: Record<string, NodeSpec> = {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: { styleId: { default: null }, props: { default: {} }, markProps: { default: null }, markRevision: { default: null }, formatChange: { default: null }, sectionBreak: { default: null }, paraId: { default: null } },
      parseDOM: [
        { tag: 'p', getAttrs: (el: HTMLElement) => ({ styleId: el.getAttribute('data-style') || null }) },
        ...[1, 2, 3, 4, 5, 6].map((n) => ({ tag: `h${n}`, attrs: { styleId: `Heading${n}` } })),
        { tag: 'blockquote', attrs: { styleId: 'Quote' } },
        { tag: 'li', attrs: { styleId: 'ListParagraph' } },
        { tag: 'pre', attrs: { styleId: 'NoSpacing' }, preserveWhitespace: 'full' as const },
      ],
      toDOM: (node: PMNode): DOMOutputSpec => {
        const a = node.attrs;
        return ['p', strip({
          'data-style': a.styleId as string | null,
          style: paragraphCss(a.props as ParagraphProps),
          'data-sect': a.sectionBreak ? (a.sectionBreak as { breakType: string }).breakType : null,
          'data-tleader': (a.props as ParagraphProps).tabs?.[0]?.leader ?? null,
        }), 0];
      },
    },
    table: {
      ...tables.table,
      attrs: { styleId: { default: 'TableGrid' }, props: { default: {} }, grid: { default: [] } },
      parseDOM: [{ tag: 'table', attrs: { styleId: 'TableGrid' } }],
      toDOM: (node: PMNode): DOMOutputSpec => ['table', strip({ 'data-tstyle': node.attrs.styleId as string | null, style: tableCss(node.attrs.props as TableProps), title: (node.attrs.props as TableProps).caption ?? null }), ['tbody', 0]],
    },
    table_row: {
      ...tables.table_row,
      attrs: { props: { default: {} } },
      toDOM: (node: PMNode): DOMOutputSpec => ['tr', strip({ style: rowCss(node.attrs.props as TableRowProps) }), 0],
    },
    table_cell: cellSpec('td'),
    table_header: cellSpec('th'),
    toc: {
      group: 'block', content: 'block+', defining: true,
      attrs: { instruction: { default: 'TOC \\o "1-3" \\h \\z \\u' }, id: { default: null } },
      toDOM: (): DOMOutputSpec => ['div', { class: 'fo-toc' }, 0],
      parseDOM: [{ tag: 'div.fo-toc' }],
    },
    control_block: {
      group: 'block', content: 'block+', defining: true,
      attrs: { props: { default: { kind: 'richText' } } },
      toDOM: (node: PMNode): DOMOutputSpec => ['div', { class: 'fo-cc', 'data-alias': (node.attrs.props as ContentControlProps).alias ?? '' }, 0],
    },
    raw_block: {
      group: 'block', atom: true, selectable: true,
      attrs: { block: { default: null } },
      toDOM: (): DOMOutputSpec => ['div', { class: 'fo-rawblock', contenteditable: 'false' }, '\u25c6'],
    },
    text: { group: 'inline' },
    hard_break: {
      inline: true, group: 'inline', selectable: false,
      attrs: { data: { default: { type: 'break', kind: 'line' } } },
      parseDOM: [{ tag: 'br' }],
      toDOM: (): DOMOutputSpec => ['br'],
    },
    atom: {
      inline: true, group: 'inline', atom: true, selectable: true, draggable: true,
      attrs: { data: { default: { type: 'raw', xml: { name: 'raw', attrs: {}, children: [] } } } },
      parseDOM: [{
        tag: 'img[src]',
        getAttrs: (el: HTMLElement) => {
          const src = el.getAttribute('src') ?? '';
          const mediaId = isDataImage(src) ? ctx.addMedia(src) : null;
          if (!mediaId) return false;
          const w = Number(el.getAttribute('width')) || (el as HTMLImageElement).naturalWidth || 240;
          const h = Number(el.getAttribute('height')) || (el as HTMLImageElement).naturalHeight || 160;
          const scale = Math.min(1, 450 / (w * 0.75));
          const image: ImageInline = { type: 'image', mediaId, width: w * 0.75 * scale, height: h * 0.75 * scale, alt: el.getAttribute('alt') ?? undefined };
          return { data: image };
        },
      }],
      toDOM: (node: PMNode): DOMOutputSpec => atomDOM(node.attrs.data as Inline, ctx),
    },
  };
  const marks: Record<string, MarkSpec> = {
    // Lien : enveloppe exterieure (rang le plus haut), puis controle de contenu en ligne.
    link: {
      attrs: { url: { default: null }, anchor: { default: null }, tooltip: { default: null }, revision: { default: null } },
      inclusive: false,
      parseDOM: [{
        tag: 'a[href]',
        getAttrs: (el: HTMLElement) => {
          const href = el.getAttribute('href') ?? '';
          if (href.startsWith('#')) return { anchor: href.slice(1) };
          const url = sanitizeUrl(href);
          return url ? { url } : false;
        },
      }],
      toDOM: (m: Mark): DOMOutputSpec => ['a', strip({ class: 'fo-link', 'data-href': (m.attrs.url as string | null) ?? `#${String(m.attrs.anchor ?? '')}`, title: m.attrs.tooltip as string | null })],
    },
    control: {
      attrs: { props: { default: { kind: 'richText' } } },
      parseDOM: [jsonRule('span[data-cc]', 'data-cc', 'props')],
      toDOM: (m: Mark): DOMOutputSpec => ['span', { class: 'fo-icc', 'data-cc': JSON.stringify(m.attrs.props) }, 0],
    },
    revision: {
      attrs: { rev: {} },
      inclusive: false,
      excludes: '',
      parseDOM: [jsonRule('ins[data-rev]', 'data-rev', 'rev'), jsonRule('del[data-rev]', 'data-rev', 'rev')],
      toDOM: (m: Mark): DOMOutputSpec => {
        const rev = m.attrs.rev as { kind: string; author: string };
        return [rev.kind === 'delete' || rev.kind === 'moveFrom' ? 'del' : 'ins', { class: 'fo-rev', title: rev.author, 'data-rev': JSON.stringify(rev) }, 0];
      },
    },
    fmtchange: {
      attrs: { change: {} },
      parseDOM: [jsonRule('span[data-fc]', 'data-fc', 'change')],
      toDOM: (m: Mark): DOMOutputSpec => ['span', { class: 'fo-fmtchange', 'data-fc': JSON.stringify(m.attrs.change) }, 0],
    },
    cstyle: {
      attrs: { id: {} },
      parseDOM: [{ tag: 'span[data-cstyle]', getAttrs: (el: HTMLElement) => ({ id: el.getAttribute('data-cstyle') }) }],
      toDOM: (m: Mark): DOMOutputSpec => ['span', { 'data-cstyle': String(m.attrs.id) }, 0],
    },
    rp_rest: {
      attrs: { props: {} },
      parseDOM: [jsonRule('span[data-rest]', 'data-rest', 'props')],
      toDOM: (m: Mark): DOMOutputSpec => ['span', strip({ style: runCss(m.attrs.props as RunProps), 'data-rest': JSON.stringify(m.attrs.props), spellcheck: (m.attrs.props as RunProps).noProof ? 'false' : null }), 0],
    },
  };
  for (const key of RUN_KEYS) marks[markName(key)] = runKeyMark(key);
  const parse = (key: RunKey, spec: MarkSpec['parseDOM']): void => {
    const m = marks[markName(key)];
    if (m) m.parseDOM = [...(m.parseDOM ?? []), ...(spec ?? [])];
  };
  parse('bold', [...(boolParse(['strong', 'b']) ?? []), { style: 'font-weight', getAttrs: (v: string) => (/^(bold|[6-9]00)$/.test(v) ? { v: true } : false) }]);
  parse('italic', boolParse(['em', 'i']));
  parse('strike', boolParse(['s', 'strike', 'del']));
  parse('underline', [{ tag: 'u', getAttrs: () => ({ v: 'single' }) }]);
  parse('vertAlign', [{ tag: 'sup', getAttrs: () => ({ v: 'superscript' }) }, { tag: 'sub', getAttrs: () => ({ v: 'subscript' }) }]);
  return new Schema({ nodes, marks });
}
