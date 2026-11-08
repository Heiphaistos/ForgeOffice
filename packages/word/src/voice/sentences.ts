// Lecture à voix haute : découpage du document en phrases (positions ProseMirror), à partir d'une position.
import type { Node as PMNode } from 'prosemirror-model';

export interface Sentence {
  from: number;
  to: number;
  text: string;
}

/** Phrases du document dont la fin est après `fromPos` ; la première commence à `fromPos` si celui-ci tombe dans une phrase. Les objets en ligne sont ignorés. */
export function sentencesFrom(doc: PMNode, fromPos = 0, toPos = doc.content.size): Sentence[] {
  const out: Sentence[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    node.forEach((child) => { text += child.isText ? child.text ?? '' : ' '; });
    const base = pos + 1;
    for (const m of text.matchAll(/[^.!?…]+[.!?…]*\s*/gu)) {
      const from = base + m.index;
      const to = from + m[0].length;
      if (to <= fromPos || from >= toPos) continue;
      const start = Math.max(from, fromPos);
      const end = Math.min(to, toPos);
      const spoken = text.slice(start - base, end - base).trim();
      if (spoken) out.push({ from: start, to: end, text: spoken });
    }
    return false;
  });
  return out;
}
