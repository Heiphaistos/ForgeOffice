// Protection « Formulaires » : seuls les contrôles de contenu (blocs et en ligne) restent modifiables.
import { Plugin } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { WordDocument } from '@forgeoffice/docx';

/** Vrai si toute la plage [from, to] est dans un controle de contenu (bloc ou texte portant la marque « control »). */
export function insideControl(doc: PMNode, from: number, to: number): boolean {
  const $from = doc.resolve(from);
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'control_block') return doc.resolve(to).sharedDepth(from) >= d || doc.resolve(to).depth >= d;
  if (from === to) {
    const here = $from.marks();
    return here.some((m) => m.type.name === 'control') || ($from.nodeBefore?.marks.some((m) => m.type.name === 'control') ?? false);
  }
  let all = true;
  let any = false;
  doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return true;
    any = true;
    if (!node.marks.some((m) => m.type.name === 'control')) all = false;
    return true;
  });
  return any && all;
}

/** Refuse toute modification du document hors controle de contenu tant que la protection « formulaires » est active. */
export function formsLockPlugin(getMeta: () => WordDocument): Plugin {
  return new Plugin({
    filterTransaction: (tr) => {
      const p = getMeta().settings.protection;
      if (!p?.enforced || p.kind !== 'forms' || !tr.docChanged || tr.getMeta('fo-notrack') === 'allow') return true;
      return tr.steps.every((step, i) => {
        const map = step.getMap();
        let ok = true;
        const before = tr.docs[i]!;
        map.forEach((oldStart, oldEnd) => { if (!insideControl(before, oldStart, oldEnd)) ok = false; });
        return ok;
      });
    },
  });
}
