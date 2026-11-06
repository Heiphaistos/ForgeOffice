// Filigrane et couleur de page : vrais elements OOXML (visibles dans Word), alimentes par les proprietes personnalisees
// que l'application Texte manipule (WATERMARK_PROP « texte|#RRGGBB|diagonale », PAGE_COLOR_PROP « #RRGGBB »).
// Ecriture : forme VML « PowerPlusWaterMarkObject » dans les en-tetes + w:background / displayBackgroundShape.
// Lecture : l'operation inverse, les elements sont retires du modele (pas de doublon a la reecriture).
import { descendants, el, type XmlElement } from '@forgeoffice/opc';
import type { Block, HeaderFooter, Inline, Paragraph, Section, WordDocument } from '../model.ts';

export const WATERMARK_PROP = 'ForgeOffice.Filigrane';
export const PAGE_COLOR_PROP = 'ForgeOffice.CouleurPage';

const SHAPE_PREFIX = 'PowerPlusWaterMarkObject';
const HEX = /^#[0-9A-Fa-f]{6}$/;
const VML_COLORS: Readonly<Record<string, string>> = {
  silver: 'C0C0C0', gray: '808080', grey: '808080', black: '000000', white: 'FFFFFF', red: 'FF0000', lime: '00FF00', green: '008000',
  blue: '0000FF', yellow: 'FFFF00', navy: '000080', maroon: '800000', purple: '800080', teal: '008080', olive: '808000', orange: 'FFA500',
};

interface Watermark { text: string; color: string; diagonal: boolean }

function parseWatermark(raw: string | undefined): Watermark | undefined {
  if (!raw) return undefined;
  const [text, color, diagonal] = raw.split('|');
  if (!text) return undefined;
  return { text, color: HEX.test(color ?? '') ? (color as string) : '#C0C0C0', diagonal: diagonal !== '0' };
}

/** Forme du filigrane, telle que Word l'ecrit (Insertion > Filigrane), dans un run. */
function watermarkRun(wm: Watermark, index: number): XmlElement {
  const width = Math.max(150, Math.min(460, wm.text.length * 38));
  const height = Math.round(width / (wm.text.length * 0.6));
  const style = [
    'position:absolute', 'margin-left:0', 'margin-top:0', `width:${width}pt`, `height:${height}pt`, wm.diagonal ? 'rotation:315' : undefined,
    'z-index:-251658752', 'mso-position-horizontal:center', 'mso-position-horizontal-relative:margin', 'mso-position-vertical:center',
    'mso-position-vertical-relative:margin',
  ].filter(Boolean).join(';');
  const shapetype = el('v:shapetype', { id: '_x0000_t136', coordsize: '21600,21600', 'o:spt': 136, adj: 10800, path: 'm@7,l@8,m@5,21600l@6,21600e' }, [
    el('v:formulas', {}, ['sum #0 0 10800', 'prod #0 2 1', 'sum 21600 0 @1', 'sum 0 0 @2', 'sum 21600 0 @3', 'if @0 @3 0', 'if @0 21600 @1', 'if @0 0 @2', 'if @0 @4 21600',
      'mid @5 @6', 'mid @8 @5', 'mid @7 @8', 'mid @6 @7', 'sum @6 0 @5'].map((eqn) => el('v:f', { eqn }))),
    el('v:path', { textpathok: 't', 'o:connecttype': 'custom', 'o:connectlocs': '@9,0;@10,10800;@11,21600;@12,10800', 'o:connectangles': '270,180,90,0' }),
    el('v:textpath', { on: 't', fitshape: 't' }),
    el('v:handles', {}, [el('v:h', { position: '#0,bottomRight', xrange: '6629,14971' })]),
    el('o:lock', { 'v:ext': 'edit', text: 't', shapetype: 't' }),
  ]);
  const shape = el('v:shape', { id: `${SHAPE_PREFIX}${index}`, 'o:spid': `_x0000_s${2049 + index}`, type: '#_x0000_t136', style, 'o:allowincell': 'f', fillcolor: wm.color, stroked: 'f' }, [
    el('v:fill', { opacity: '.5' }),
    el('v:textpath', { style: 'font-family:"Calibri";font-size:1pt', string: wm.text }),
    el('w10:wrap', { anchorx: 'margin', anchory: 'margin' }),
  ]);
  return el('w:r', {}, [el('w:rPr', {}, [el('w:noProof')]), el('w:pict', {}, [shapetype, shape])]);
}

const emptyParagraph = (): Paragraph => ({ type: 'paragraph', props: {}, inlines: [] });

function withWatermark(blocks: Block[], run: XmlElement): Block[] {
  const list = [...blocks];
  const index = list.findIndex((b) => b.type === 'paragraph');
  const paragraph = index >= 0 ? (list[index] as Paragraph) : emptyParagraph();
  const patched: Paragraph = { ...paragraph, inlines: [{ type: 'raw', xml: run }, ...paragraph.inlines] };
  if (index >= 0) list[index] = patched;
  else list.unshift(patched);
  return list;
}

function sectionsOf(doc: WordDocument): Section[] {
  const out: Section[] = [];
  for (const b of doc.body) if (b.type === 'paragraph' && b.sectionBreak) out.push(b.sectionBreak);
  out.push(doc.finalSection);
  return out;
}

export interface Decorated {
  doc: WordDocument;
  /** Couleur de page « RRGGBB » a ecrire dans w:background. */
  background?: string;
}

/** Remplace les deux proprietes personnalisees par les vrais elements : filigrane dans les en-tetes, couleur de page. */
export function applyDecorations(doc: WordDocument): Decorated {
  const custom = { ...doc.properties.custom };
  const wm = parseWatermark(custom[WATERMARK_PROP]);
  const color = custom[PAGE_COLOR_PROP];
  delete custom[WATERMARK_PROP];
  delete custom[PAGE_COLOR_PROP];
  const background = color && HEX.test(color) ? color.slice(1).toUpperCase() : undefined;
  let next: WordDocument = { ...doc, properties: { ...doc.properties, custom } };
  if (wm) {
    let counter = 0;
    const headersFooters: Record<string, HeaderFooter> = { ...doc.headersFooters };
    for (const [id, hf] of Object.entries(headersFooters)) {
      if (hf.kind === 'header') headersFooters[id] = { ...hf, blocks: withWatermark(hf.blocks, watermarkRun(wm, ++counter)) };
    }
    // La premiere section doit avoir un en-tete pour chaque type de page utilise (les suivantes heritent).
    const first = sectionsOf(doc)[0];
    if (first) {
      const patch: Section = { ...first, headers: { ...first.headers } };
      const kinds: Array<'default' | 'first' | 'even'> = ['default'];
      if (first.titlePage) kinds.push('first');
      if (doc.settings.evenAndOddHeaders) kinds.push('even');
      for (const kind of kinds) {
        if (first.headers[kind]) continue;
        const id = `forge-watermark-${kind}`;
        headersFooters[id] = { id, kind: 'header', blocks: withWatermark([], watermarkRun(wm, ++counter)) };
        patch.headers[kind] = id;
      }
      next = {
        ...next,
        headersFooters,
        body: next.body.map((b) => (b.type === 'paragraph' && b.sectionBreak === first ? { ...b, sectionBreak: patch } : b)),
        finalSection: doc.finalSection === first ? patch : doc.finalSection,
      };
    }
  }
  return background ? { doc: next, background } : { doc: next };
}

function readShape(run: XmlElement): Watermark | undefined {
  for (const shape of descendants(run, 'v:shape')) {
    if (!(shape.attrs['id'] ?? '').startsWith(SHAPE_PREFIX)) continue;
    const text = [...descendants(shape, 'v:textpath')][0]?.attrs['string'];
    if (!text) return undefined;
    const fill = (shape.attrs['fillcolor'] ?? 'silver').split(' ')[0] ?? 'silver';
    const color = HEX.test(fill) ? fill.toUpperCase() : `#${VML_COLORS[fill.toLowerCase()] ?? 'C0C0C0'}`;
    const rotation = (shape.attrs['style'] ?? '').match(/rotation:\s*(-?\d+)/);
    return { text: text.replace(/\|/g, ' '), color, diagonal: rotation ? Number(rotation[1]) % 360 !== 0 : false };
  }
  return undefined;
}

/**
 * Extrait le filigrane des en-tetes (le retire du modele) et la couleur de page du w:background : renvoie les
 * proprietes personnalisees correspondantes.
 */
export function extractDecorations(headersFooters: Record<string, HeaderFooter>, backgroundColor: string | undefined): Record<string, string> {
  const props: Record<string, string> = {};
  for (const hf of Object.values(headersFooters)) {
    if (hf.kind !== 'header') continue;
    hf.blocks = hf.blocks.map((block) => {
      if (block.type !== 'paragraph') return block;
      const kept: Inline[] = [];
      for (const inline of block.inlines) {
        const wm = inline.type === 'raw' ? readShape(inline.xml) : undefined;
        if (!wm) {
          kept.push(inline);
          continue;
        }
        props[WATERMARK_PROP] ??= `${wm.text}|${wm.color}|${wm.diagonal ? 1 : 0}`;
      }
      return kept.length === block.inlines.length ? block : { ...block, inlines: kept };
    });
  }
  if (backgroundColor && /^[0-9A-Fa-f]{6}$/.test(backgroundColor)) props[PAGE_COLOR_PROP] = `#${backgroundColor.toUpperCase()}`;
  return props;
}
