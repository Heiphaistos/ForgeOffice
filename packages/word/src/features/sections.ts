// Sections de page (sans DOM) : decoupage du document en sections, geometrie de chaque page, numerotation et references d'en-tetes.
// Une section se termine au paragraphe qui porte `sectionBreak` ; la derniere section est `finalSection`.
import type { Node as PMNode } from 'prosemirror-model';
import type { HeaderFooterRefs, NumberFormat, Section } from '@forgeoffice/docx';

export interface SectionSpan {
  index: number;
  section: Section;
  /** Position du paragraphe qui termine la section (null pour la derniere). */
  paraPos: number | null;
  /** Debut (inclus) et fin (exclue) des blocs de premier niveau de la section. */
  start: number;
  end: number;
}

export function sectionSpans(doc: PMNode, finalSection: Section): SectionSpan[] {
  const spans: SectionSpan[] = [];
  let start = 0;
  doc.forEach((node, offset) => {
    const sb = node.attrs.sectionBreak as Section | null | undefined;
    if (sb) {
      spans.push({ index: spans.length, section: sb, paraPos: offset, start, end: offset + node.nodeSize });
      start = offset + node.nodeSize;
    }
  });
  spans.push({ index: spans.length, section: finalSection, paraPos: null, start, end: doc.content.size });
  return spans;
}

/** Section contenant une position du document. */
export function sectionIndexAt(spans: readonly SectionSpan[], pos: number): number {
  for (const s of spans) if (pos < s.end) return s.index;
  return spans.length - 1;
}

export const px = (pt: number): number => (pt * 4) / 3;

/** Geometrie (pixels CSS) d'une section : page, zone de texte, pose horizontale. */
export interface SectionBox {
  pageW: number;
  pageH: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  contentHeight: number;
}

export function sectionBox(s: Section): SectionBox {
  return {
    pageW: px(s.pageWidth), pageH: px(s.pageHeight),
    marginTop: px(s.margins.top), marginBottom: px(s.margins.bottom), marginLeft: px(s.margins.left), marginRight: px(s.margins.right),
    contentHeight: Math.max(10, px(s.pageHeight - s.margins.top - s.margins.bottom)),
  };
}

/** Vrai si les sections ne partagent pas la meme pose horizontale (largeur de page ou marges gauche / droite). */
export function horizontalDiffers(sections: readonly Section[]): boolean {
  const a = sections[0];
  return !!a && sections.some((s) => Math.abs(s.pageWidth - a.pageWidth) > 0.5 || Math.abs(s.margins.left - a.margins.left) > 0.5 || Math.abs(s.margins.right - a.margins.right) > 0.5);
}

/** Une section qui continue sur la meme page doit avoir la meme taille de page, sinon Word ouvre une nouvelle page. */
export function startsNewPage(prev: Section, next: Section): boolean {
  return next.breakType !== 'continuous' || Math.abs(prev.pageWidth - next.pageWidth) > 0.5 || Math.abs(prev.pageHeight - next.pageHeight) > 0.5;
}

/** Parite imposee au debut de la section (pages paires / impaires), sinon undefined. */
export function startParity(s: Section): 'even' | 'odd' | undefined {
  return s.breakType === 'evenPage' ? 'even' : s.breakType === 'oddPage' ? 'odd' : undefined;
}

export interface PageLabel {
  /** Numero de page (nombre) et libelle mis en forme. */
  number: number;
  text: string;
  /** Premiere page de sa section. */
  firstOfSection: boolean;
  section: number;
}

/** Numerotation des pages : la section qui declare `start` redemarre, les autres continuent. */
export function pageLabels(pageSections: readonly number[], sections: readonly Section[], format: (n: number, f: NumberFormat) => string): PageLabel[] {
  const out: PageLabel[] = [];
  let n = 0;
  let prev = -1;
  pageSections.forEach((si) => {
    const s = sections[Math.min(si, sections.length - 1)]!;
    const first = si !== prev;
    if (first && s.pageNumbering?.start !== undefined) n = s.pageNumbering.start;
    else n++;
    prev = si;
    out.push({ number: n, text: format(n, s.pageNumbering?.format ?? 'decimal'), firstOfSection: first, section: si });
  });
  return out;
}

/** References d'en-tete / pied de chaque section : une section sans reference herite de la precedente (comme Word). */
export function resolveRefs(sections: readonly Section[], kind: 'headers' | 'footers'): HeaderFooterRefs[] {
  const out: HeaderFooterRefs[] = [];
  sections.forEach((s, i) => {
    const own = s[kind];
    const prev = out[i - 1] ?? {};
    out.push({ default: own.default ?? prev.default, first: own.first ?? prev.first, even: own.even ?? prev.even });
  });
  return out;
}
