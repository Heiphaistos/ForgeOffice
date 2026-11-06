// Export .pptx de la publication : ce que PowerPoint sait garder (pages, textes, formes, images, page maitre, reperes de la page)
// et ce qu'il ne connait pas (habillage du texte, articles lies, lettrines, champs de fusion, imposition, vis-a-vis, fonds perdus),
// signale a l'utilisateur avant l'enregistrement. Sans DOM.
import JSZip from 'jszip';
import { parseXml } from '@forgeoffice/opc';
import { writePptx, type Deck } from '@forgeoffice/pptx';
import { hasFields } from './merge.ts';
import { layoutGuides } from './guides.ts';
import { shapeKey, type PubSettings } from './model.ts';

export type LostKind = 'wrap' | 'chain' | 'dropCap' | 'merge' | 'imposition' | 'facing' | 'bleed';

export interface LostItem {
  kind: LostKind;
  /** Nombre d'elements concernes (objets habilles, articles, lettrines, champs...). */
  count: number;
}

const WRAP_NS = 'http://schemas.microsoft.com/office/powerpoint/2012/main';
const GUIDE_EXT = '{EFAFB233-063F-42B5-8137-9DF3F51BA10A}';
/** Les reperes de PowerPoint sont en 1/8 de point. */
const UNITS = 8;
const MAX_GUIDES = 200;

/** Ce qui sera perdu a l'export .pptx pour cette publication (liste vide = rien n'est perdu). */
export function pptxLosses(deck: Deck, pub: PubSettings): LostItem[] {
  const exists = new Set<string>();
  for (const slide of deck.slides) for (const s of slide.shapes) exists.add(shapeKey(slide.id, s.id));
  const out: LostItem[] = [];
  const wraps = Object.entries(pub.wraps).filter(([k, mode]) => mode !== 'none' && exists.has(k)).length;
  if (wraps) out.push({ kind: 'wrap', count: wraps });
  if (pub.chains.length) out.push({ kind: 'chain', count: pub.chains.length });
  const drops = Object.keys(pub.dropCaps).filter((k) => exists.has(k)).length;
  if (drops) out.push({ kind: 'dropCap', count: drops });
  const fields = pub.merge?.fields.length ?? 0;
  if (fields || hasFields(deck)) out.push({ kind: 'merge', count: fields || 1 });
  if (pub.imposition) out.push({ kind: 'imposition', count: 1 });
  if (pub.facing) out.push({ kind: 'facing', count: 1 });
  if (pub.bleed > 0) out.push({ kind: 'bleed', count: 1 });
  return out;
}

/** Reperes de la page : marges et colonnes de la premiere page, puis reperes de regle (positions en points). */
export function exportGuides(deck: Deck, pub: PubSettings): { x: number[]; y: number[] } {
  const g = layoutGuides(deck.size, pub, 0);
  const uniq = (list: number[], max: number): number[] => [...new Set(list.filter((v) => v > 0.5 && v < max - 0.5).map((v) => Math.round(v * UNITS) / UNITS))].slice(0, MAX_GUIDES);
  return { x: uniq([...g.marginX, ...g.gridX, ...pub.guides.x], deck.size.width), y: uniq([...g.marginY, ...g.gridY, ...pub.guides.y], deck.size.height) };
}

const pos = (v: number): number => Math.round(v * UNITS);

/** Fichier de reglages d'affichage : reperes de diapositive (ancienne forme, lue par toutes les versions). */
function viewPropsWithGuides(guides: { x: number[]; y: number[] }) {
  const list = [...guides.y.map((v) => `<p:guide orient="horz" pos="${pos(v)}" userDrawn="1"/>`), ...guides.x.map((v) => `<p:guide pos="${pos(v)}" userDrawn="1"/>`)].join('');
  return parseXml(
    '<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      `<p:slideViewPr><p:cSldViewPr snapToGrid="0"><p:cViewPr varScale="1"><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr><p:guideLst>${list}</p:guideLst></p:cSldViewPr></p:slideViewPr>` +
      '<p:gridSpacing cx="76200" cy="76200"/></p:viewPr>',
  );
}

/** Reperes de diapositive de PowerPoint 2013 et suivants (presentation.xml, extension p15:sldGuideLst). */
function guideExtension(guides: { x: number[]; y: number[] }): string {
  const all = [...guides.y.map((v) => ({ orient: 'horz', v })), ...guides.x.map((v) => ({ orient: 'vert', v }))];
  const items = all.map((g, i) => `<p15:guide id="${i + 1}" ${g.orient === 'horz' ? 'orient="horz" ' : ''}pos="${pos(g.v)}" userDrawn="1"><p15:clr><a:srgbClr val="A4A3A4"/></p15:clr></p15:guide>`).join('');
  return `<p:extLst><p:ext uri="${GUIDE_EXT}"><p15:sldGuideLst xmlns:p15="${WRAP_NS}">${items}</p15:sldGuideLst></p:ext></p:extLst>`;
}

export interface PptxExport {
  bytes: Uint8Array;
  guides: number;
  lost: LostItem[];
}

/** Ecrit la publication en .pptx avec ses reperes ; `lost` liste ce que PowerPoint ne garde pas. */
export async function buildPptx(deck: Deck, pub: PubSettings): Promise<PptxExport> {
  const guides = exportGuides(deck, pub);
  const count = guides.x.length + guides.y.length;
  const withGuides: Deck = count ? { ...deck, format: 'pptx', preserved: { ...deck.preserved, viewProps: viewPropsWithGuides(guides) } } : { ...deck, format: 'pptx' };
  let bytes = await writePptx(withGuides, { format: 'pptx' });
  if (count) {
    const zip = await JSZip.loadAsync(bytes);
    const file = zip.file('ppt/presentation.xml');
    if (file) {
      const xml = await file.async('string');
      if (xml.includes('</p:presentation>') && !xml.includes(GUIDE_EXT)) {
        const patched = /<p:extLst>/.test(xml.slice(xml.lastIndexOf('</p:defaultTextStyle>'))) ? xml : xml.replace('</p:presentation>', `${guideExtension(guides)}</p:presentation>`);
        zip.file('ppt/presentation.xml', patched);
        bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      }
    }
  }
  return { bytes, guides: count, lost: pptxLosses(deck, pub) };
}
