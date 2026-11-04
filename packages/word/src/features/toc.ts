// Titres du document (volet de navigation, mode Plan) et table des matieres automatique.
import type { Node as PMNode } from 'prosemirror-model';
import { effectiveParagraphProps, type Block, type Paragraph, type WordDocument } from '@forgeoffice/docx';

export interface Heading {
  /** 1..9. */
  level: number;
  text: string;
  /** Position ProseMirror du paragraphe. */
  pos: number;
}

/** Titres du corps (niveau hierarchique effectif 0..8), hors table des matieres. */
export function collectHeadings(doc: PMNode, meta: WordDocument, maxLevel = 9): Heading[] {
  const out: Heading[] = [];
  doc.forEach((node, pos) => {
    if (node.type.name !== 'paragraph') return;
    const model: Pick<Paragraph, 'styleId' | 'props'> = { styleId: (node.attrs.styleId as string | null) ?? undefined, props: node.attrs.props as Paragraph['props'] };
    const lvl = effectiveParagraphProps(meta, model).outlineLevel;
    if (lvl === undefined || lvl < 0 || lvl >= Math.min(9, maxLevel)) return;
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (text) out.push({ level: lvl + 1, text, pos });
  });
  return out;
}

/** Contenu d'une table des matieres : « TM n » + lien vers le signet du titre + tabulation + numero de page. */
export function tocBlocks(headings: readonly Heading[], pageOf: (pos: number) => number, anchorOf: (h: Heading, i: number) => string, title: string): Block[] {
  const blocks: Block[] = [{ type: 'paragraph', styleId: 'TOCHeading', props: {}, inlines: [{ type: 'text', text: title, props: {} }] }];
  headings.forEach((h, i) => {
    blocks.push({
      type: 'paragraph', styleId: `TOC${h.level}`, props: { tabs: [{ position: 453.6, align: 'right', leader: 'dot' }] },
      inlines: [
        { type: 'hyperlink', anchor: anchorOf(h, i), inlines: [{ type: 'text', text: h.text, props: {} }] },
        { type: 'tab' },
        { type: 'text', text: String(pageOf(h.pos)), props: {} },
      ],
    });
  });
  if (!headings.length) blocks.push({ type: 'paragraph', props: {}, inlines: [] });
  return blocks;
}

/** Nom de signet Word d'un titre (« _Toc » + numero). */
export const tocAnchor = (i: number): string => `_Toc${String(100000 + i)}`;

/** Plan hierarchique en texte (export, impression du plan). */
export function outlineText(headings: readonly Heading[]): string {
  return headings.map((h) => `${'  '.repeat(h.level - 1)}${h.text}`).join('\n');
}
