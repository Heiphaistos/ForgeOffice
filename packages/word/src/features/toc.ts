// Titres du document (volet de navigation, mode Plan) et table des matieres automatique.
import type { Node as PMNode } from 'prosemirror-model';
import { effectiveParagraphProps, type Block, type Inline, type Paragraph, type TabStop, type WordDocument } from '@forgeoffice/docx';

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

/** Options d'une table des matieres (boite « Table des matieres »). */
export interface TocOptions {
  /** Niveaux affiches : 1 a `levels`. */
  levels: number;
  pageNumbers: boolean;
  /** Numeros de page alignes a droite avec un caractere de suite. */
  rightAlign: boolean;
  leader: 'dot' | 'hyphen' | 'underscore' | 'none';
  hyperlinks: boolean;
}

export const DEFAULT_TOC: TocOptions = { levels: 3, pageNumbers: true, rightAlign: true, leader: 'dot', hyperlinks: true };

/** Instruction de champ TOC d'apres les options (\o niveaux, 
 sans numeros, \h liens). */
export function tocInstruction(o: TocOptions): string {
  return `TOC \\o "1-${o.levels}"${o.pageNumbers ? '' : ' \\n'}${o.hyperlinks ? ' \\h' : ''} \\z \\u`;
}

/** Options relues d'une instruction TOC (et des taquets de la premiere entree pour le caractere de suite / l'alignement). */
export function parseTocInstruction(instruction: string, tabs?: readonly TabStop[]): TocOptions {
  const levels = Number(instruction.match(/\\o\s+"1-([1-9])"/)?.[1] ?? DEFAULT_TOC.levels);
  const stop = tabs?.find((t) => t.align === 'right');
  const leader = stop?.leader === 'hyphen' ? 'hyphen' : stop?.leader === 'underscore' ? 'underscore' : stop?.leader === 'dot' || stop?.leader === 'middleDot' ? 'dot' : stop ? 'none' : DEFAULT_TOC.leader;
  return { levels, pageNumbers: !/\\n(\s|$)/.test(instruction), rightAlign: tabs === undefined ? true : !!stop, leader, hyperlinks: /\\h(\s|$)/.test(instruction) };
}

/** Contenu d'une table des matieres : « TM n » + lien vers le signet du titre + tabulation + numero de page. */
export function tocBlocks(headings: readonly Heading[], pageOf: (pos: number) => number, anchorOf: (h: Heading, i: number) => string, title: string, o: TocOptions = DEFAULT_TOC): Block[] {
  const blocks: Block[] = [{ type: 'paragraph', styleId: 'TOCHeading', props: {}, inlines: [{ type: 'text', text: title, props: {} }] }];
  headings.filter((h) => h.level <= o.levels).forEach((h, i) => {
    const label: Inline = { type: 'text', text: h.text, props: {} };
    blocks.push({
      type: 'paragraph', styleId: `TOC${h.level}`,
      // Le caractere de suite voyage dans les taquets du paragraphe (le rendu et la relecture des options le lisent).
      props: { tabs: [o.pageNumbers && !o.rightAlign ? { position: 36, align: 'left', leader: 'none' } : { position: 453.6, align: 'right', leader: o.pageNumbers ? o.leader : 'none' }] },
      inlines: [
        o.hyperlinks ? { type: 'hyperlink', anchor: anchorOf(h, i), inlines: [label] } : label,
        ...(o.pageNumbers ? [{ type: 'tab' } as Inline, { type: 'text', text: String(pageOf(h.pos)), props: {} } as Inline] : []),
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

/** Options de la table des matieres du document (premiere trouvee), ou null s'il n'y en a pas. */
export function existingTocOptions(doc: PMNode): TocOptions | null {
  let found: TocOptions | null = null;
  doc.forEach((node) => {
    if (node.type.name !== 'toc' || found) return;
    const entry = node.maybeChild(1);
    const tabs = entry && entry.type.name === 'paragraph' ? (entry.attrs.props as Paragraph['props']).tabs ?? [] : undefined;
    found = parseTocInstruction(String(node.attrs.instruction), tabs);
  });
  return found;
}
