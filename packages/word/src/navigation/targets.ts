// « Atteindre » : cibles du document par type (titres, signets, commentaires, notes, tableaux, images).
import type { Node as PMNode } from 'prosemirror-model';
import type { Inline, WordDocument } from '@forgeoffice/docx';
import { collectHeadings } from '../features/toc.ts';

export type TargetType = 'page' | 'heading' | 'bookmark' | 'comment' | 'footnote' | 'endnote' | 'table' | 'image' | 'field' | 'equation' | 'section';
export interface Target { label: string; pos: number }

const atomData = (n: PMNode): Inline | undefined => (n.type.name === 'atom' ? (n.attrs.data as Inline | undefined) : undefined);

/** Cibles d'un type (hors « page »), dans l'ordre du document. */
export function gotoTargets(doc: PMNode, meta: WordDocument, type: Exclude<TargetType, 'page'>): Target[] {
  if (type === 'heading') return collectHeadings(doc, meta).map((h) => ({ label: `${'  '.repeat(h.level - 1)}${h.text}`, pos: h.pos }));
  const out: Target[] = [];
  let n = 0;
  doc.descendants((node, pos) => {
    if (type === 'section') {
      if (node.type.name === 'paragraph' && node.attrs.sectionBreak) out.push({ label: `Section ${++n}`, pos });
      return true;
    }
    if (type === 'table') {
      if (node.type.name === 'table') out.push({ label: `Tableau ${++n}`, pos });
      return true;
    }
    const d = atomData(node);
    if (!d) return true;
    if (type === 'bookmark' && d.type === 'bookmarkStart' && !d.name.startsWith('_')) out.push({ label: d.name, pos });
    else if (type === 'comment' && d.type === 'commentStart') {
      const comment = meta.comments.find((c) => c.id === d.commentId);
      out.push({ label: `Commentaire ${++n}${comment ? ` — ${comment.author}` : ''}`, pos });
    } else if (type === 'footnote' && d.type === 'footnoteRef') out.push({ label: `Note de bas de page ${++n}`, pos });
    else if (type === 'endnote' && d.type === 'endnoteRef') out.push({ label: `Note de fin ${++n}`, pos });
    else if (type === 'image' && d.type === 'image') out.push({ label: `Image ${++n}`, pos });
    else if (type === 'field' && d.type === 'field') out.push({ label: `Champ ${++n} : ${d.instruction.trim().slice(0, 30)}`, pos });
    else if (type === 'equation' && d.type === 'equation') out.push({ label: `Équation ${++n}`, pos });
    return true;
  });
  return out;
}

/** Cible suivante (+1) ou precedente (-1) par rapport a une position, en boucle. */
export function stepTarget(targets: readonly Target[], from: number, dir: 1 | -1): Target | null {
  if (targets.length === 0) return null;
  if (dir === 1) return targets.find((t) => t.pos > from) ?? targets[0]!;
  return [...targets].reverse().find((t) => t.pos < from) ?? targets[targets.length - 1]!;
}
