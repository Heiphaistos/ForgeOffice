// Volet des verifications : liste des modifications suivies (type, auteur, texte) et decompte.
import type { Node as PMNode } from 'prosemirror-model';
import { revisionPositions } from '../editor/track.ts';

export interface RevisionItem {
  id: number;
  kind: 'insert' | 'delete' | 'move';
  author: string;
  date?: string;
  text: string;
  from: number;
  to: number;
}

/** Modifications suivies dans l'ordre du document ; `author` filtre un relecteur. */
export function listRevisions(doc: PMNode, author?: string): RevisionItem[] {
  return revisionPositions(doc)
    .filter((r) => !author || r.rev.author === author)
    .map((r) => ({
      id: r.rev.id, kind: r.rev.kind === 'insert' ? 'insert' : r.rev.kind === 'delete' ? 'delete' : 'move', author: r.rev.author, date: r.rev.date,
      text: doc.textBetween(r.from, r.to, ' ', ' ').slice(0, 80), from: r.from, to: r.to,
    }));
}

export const countByKind = (items: readonly RevisionItem[]): { insert: number; delete: number; move: number } => ({
  insert: items.filter((i) => i.kind === 'insert').length, delete: items.filter((i) => i.kind === 'delete').length, move: items.filter((i) => i.kind === 'move').length,
});

export const reviewers = (items: readonly RevisionItem[]): string[] => [...new Set(items.map((i) => i.author))].sort((a, b) => a.localeCompare(b, 'fr'));
