// Suivi des modifications : les suppressions deviennent des marques « supprime », les insertions des marques « insere ».
import { ReplaceStep } from 'prosemirror-transform';
import { Fragment, Slice, type Mark, type Node as PMNode, type Schema } from 'prosemirror-model';
import { TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import type { Revision } from '@forgeoffice/docx';

export interface TrackOptions {
  author: string;
  date: string;
  /** Touche Suppr (le curseur passe apres le texte barre) plutot que Retour arriere. */
  forward?: boolean;
}

const revOf = (node: PMNode): Revision | null => (node.marks.find((m) => m.type.name === 'revision')?.attrs.rev as Revision | undefined) ?? null;

/** Plus grand identifiant de revision du document (pour en attribuer de nouveaux). */
export function maxRevisionId(doc: PMNode): number {
  let max = 0;
  doc.descendants((n) => {
    const r = revOf(n);
    if (r && r.id > max) max = r.id;
    return true;
  });
  return max;
}

function markSlice(fragment: Fragment, mark: Mark): Fragment {
  const nodes: PMNode[] = [];
  fragment.forEach((n) => {
    if (n.isInline) nodes.push(n.mark(mark.addToSet(n.marks)));
    else nodes.push(n.copy(markSlice(n.content, mark)));
  });
  return Fragment.from(nodes);
}

/**
 * Transforme une transaction d'edition en version suivie. Seules les transactions a une etape de remplacement
 * (frappe, suppression, collage) sont suivies ; les autres (mise en forme) passent telles quelles.
 */
export function trackTransaction(state: EditorState, tr: Transaction, o: TrackOptions): Transaction | null {
  if (!tr.docChanged || tr.steps.length !== 1 || tr.getMeta('fo-notrack')) return null;
  const step = tr.steps[0];
  if (!(step instanceof ReplaceStep)) return null;
  const { from, to, slice } = step as unknown as { from: number; to: number; slice: Slice };
  const schema: Schema = state.schema;
  const revType = schema.marks.revision!;
  const out = state.tr.setMeta('fo-notrack', true);
  let id = maxRevisionId(state.doc);
  // Suppressions : le texte insere par le meme auteur disparait vraiment, le reste est barre.
  const realDeletes: [number, number][] = [];
  if (to > from) {
    const del = revType.create({ rev: { kind: 'delete', id: ++id, author: o.author, date: o.date } satisfies Revision });
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isInline) return true;
      const a = Math.max(from, pos);
      const b = Math.min(to, pos + node.nodeSize);
      const rev = revOf(node);
      if (rev?.kind === 'insert' && rev.author === o.author) realDeletes.push([a, b]);
      else if (rev?.kind !== 'delete') out.addMark(a, b, del);
      return false;
    });
  }
  for (const [a, b] of realDeletes.reverse()) out.delete(a, b);
  const at = out.mapping.map(to);
  if (slice.size) {
    const $at = out.doc.resolve(at);
    const before = $at.nodeBefore ? revOf($at.nodeBefore) : null;
    const rev: Revision = before?.kind === 'insert' && before.author === o.author ? before : { kind: 'insert', id: ++id, author: o.author, date: o.date };
    out.replace(at, at, new Slice(markSlice(slice.content, revType.create({ rev })), slice.openStart, slice.openEnd));
    const end = out.mapping.slice(out.steps.length - 1).map(at, 1);
    out.setSelection(TextSelection.near(out.doc.resolve(end), -1));
  } else {
    const pos = o.forward ? out.mapping.map(to) : out.mapping.map(from, -1);
    out.setSelection(TextSelection.near(out.doc.resolve(pos)));
  }
  return out.scrollIntoView();
}

type Decision = 'accept' | 'reject';

/** Accepte ou refuse les revisions entre from et to (tout le document par defaut). */
export function resolveRevisions(state: EditorState, decision: Decision, from = 0, to = state.doc.content.size): Transaction {
  const tr = state.tr.setMeta('fo-notrack', true);
  const removals: [number, number][] = [];
  const revType = state.schema.marks.revision!;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'paragraph' && node.attrs.markRevision) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, markRevision: null });
    }
    if (!node.isInline) return true;
    const rev = revOf(node);
    if (!rev) return false;
    const a = Math.max(from, pos);
    const b = Math.min(to, pos + node.nodeSize);
    const keep = (rev.kind === 'insert' || rev.kind === 'moveTo') === (decision === 'accept');
    if (keep) tr.removeMark(a, b, revType);
    else removals.push([a, b]);
    return false;
  });
  for (const [a, b] of removals.reverse()) tr.delete(a, b);
  return tr;
}

/** Positions de debut des revisions (navigation Precedente / Suivante). */
export function revisionPositions(doc: PMNode): { from: number; to: number; rev: Revision }[] {
  const out: { from: number; to: number; rev: Revision }[] = [];
  doc.descendants((node, pos) => {
    const rev = node.isInline ? revOf(node) : null;
    if (rev) {
      const last = out[out.length - 1];
      if (last && last.to === pos && last.rev.id === rev.id) last.to = pos + node.nodeSize;
      else out.push({ from: pos, to: pos + node.nodeSize, rev });
    }
    return true;
  });
  return out;
}
