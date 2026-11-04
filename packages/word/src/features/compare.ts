// Comparer deux documents : difference par paragraphes puis par mots, resultat en suivi des modifications.
import { paragraphText, type Block, type Inline, type Paragraph, type Revision } from '@forgeoffice/docx';

export type DiffOp<T> = { kind: 'equal' | 'insert' | 'delete'; items: T[] };

/** Plus longue sous-suite commune (programmation dynamique, bornee : au-dela tout est remplace). */
export function diff<T>(a: readonly T[], b: readonly T[], eq: (x: T, y: T) => boolean = (x, y) => x === y, limit = 4_000_000): DiffOp<T>[] {
  let start = 0;
  while (start < a.length && start < b.length && eq(a[start]!, b[start]!)) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && eq(a[endA - 1]!, b[endB - 1]!)) {
    endA--;
    endB--;
  }
  const ops: DiffOp<T>[] = [];
  const push = (kind: DiffOp<T>['kind'], item: T): void => {
    const last = ops[ops.length - 1];
    if (last?.kind === kind) last.items.push(item);
    else ops.push({ kind, items: [item] });
  };
  for (let i = 0; i < start; i++) push('equal', a[i]!);
  const n = endA - start;
  const m = endB - start;
  if (n * m > limit) {
    for (let i = start; i < endA; i++) push('delete', a[i]!);
    for (let j = start; j < endB; j++) push('insert', b[j]!);
  } else {
    const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        L[i]![j] = eq(a[start + i]!, b[start + j]!) ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && eq(a[start + i]!, b[start + j]!)) {
        push('equal', a[start + i]!);
        i++;
        j++;
      } else if (j < m && (i >= n || L[i]![j + 1]! >= L[i + 1]![j]!)) {
        push('insert', b[start + j]!);
        j++;
      } else {
        push('delete', a[start + i]!);
        i++;
      }
    }
  }
  for (let i = endA; i < a.length; i++) push('equal', a[i]!);
  return ops;
}

/** Mots et blancs (les blancs sont gardes pour reconstruire le texte). */
export const tokenize = (text: string): string[] => text.match(/\s+|[^\s]+/g) ?? [];

function revised(text: string, revision?: Revision): Inline {
  return revision ? { type: 'text', text, props: {}, revision } : { type: 'text', text, props: {} };
}

/** Paragraphe compare mot a mot (suppressions puis insertions, comme Word). */
export function compareParagraph(oldText: string, newP: Paragraph, rev: (kind: 'insert' | 'delete') => Revision): Paragraph {
  const ops = diff(tokenize(oldText), tokenize(paragraphText(newP)));
  if (ops.every((o) => o.kind === 'equal')) return newP;
  const inlines: Inline[] = ops.map((o) => revised(o.items.join(''), o.kind === 'equal' ? undefined : rev(o.kind)));
  return { ...newP, inlines };
}

/**
 * Document de comparaison : le texte revise avec les differences en marques de revision.
 * Les paragraphes modifies sont compares mot a mot ; les blocs non textuels sont repris de la version revisee.
 */
export function compareBlocks(original: readonly Block[], revisedBlocks: readonly Block[], author: string, date = new Date().toISOString()): Block[] {
  let id = 1;
  const rev = (kind: 'insert' | 'delete'): Revision => ({ kind, id: id++, author, date });
  const key = (b: Block): string => (b.type === 'paragraph' ? `p:${b.styleId ?? ''}:${paragraphText(b)}` : `${b.type}:${JSON.stringify(b).length}`);
  const ops = diff(original.map(key), revisedBlocks.map(key));
  const out: Block[] = [];
  let ia = 0;
  let ib = 0;
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k]!;
    if (op.kind === 'equal') {
      for (const _ of op.items) {
        out.push(revisedBlocks[ib]!);
        ia++;
        ib++;
      }
      continue;
    }
    const next = ops[k + 1];
    if (next && next.kind !== 'equal' && next.kind !== op.kind) {
      // Remplacement : paragraphes apparies un a un et compares mot a mot.
      const dels = (op.kind === 'delete' ? op : next).items.length;
      const ins = (op.kind === 'insert' ? op : next).items.length;
      for (let x = 0; x < Math.max(dels, ins); x++) {
        const a = x < dels ? original[ia + x] : undefined;
        const b = x < ins ? revisedBlocks[ib + x] : undefined;
        if (a?.type === 'paragraph' && b?.type === 'paragraph') out.push(compareParagraph(paragraphText(a), b, rev));
        else {
          if (a) out.push(markBlock(a, rev('delete')));
          if (b) out.push(markBlock(b, rev('insert')));
        }
      }
      ia += dels;
      ib += ins;
      k++;
      continue;
    }
    for (const _ of op.items) {
      if (op.kind === 'delete') out.push(markBlock(original[ia++]!, rev('delete')));
      else out.push(markBlock(revisedBlocks[ib++]!, rev('insert')));
    }
  }
  return out;
}

function markBlock(b: Block, revision: Revision): Block {
  if (b.type !== 'paragraph') return b;
  return {
    ...b,
    markRevision: revision,
    inlines: b.inlines.map((i) => (i.type === 'text' || i.type === 'tab' || i.type === 'break' ? { ...i, revision } : i)),
  };
}
