// Decorations de mise en page : pose horizontale des blocs par section, largeur des tabulations (taquets personnalises).
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import type { WordDocument } from '@forgeoffice/docx';
import { horizontalDiffers, px, sectionSpans } from '../features/sections.ts';

/** Largeur de la plus large page du document (px). */
export function maxPageWidth(sections: readonly { pageWidth: number }[]): number {
  return px(Math.max(...sections.map((s) => s.pageWidth)));
}

/**
 * Quand les sections n'ont pas la meme pose horizontale, chaque bloc recoit ses marges gauche / droite (le corps occupe toute la largeur),
 * par variables CSS : les retraits des paragraphes (calc(var(--fo-sl) + retrait)) ne sont pas ecrases.
 */
export function sectionMarginDecorations(doc: PMNode, meta: WordDocument): Decoration[] {
  const spans = sectionSpans(doc, meta.finalSection);
  const sections = spans.map((s) => s.section);
  if (spans.length < 2 || !horizontalDiffers(sections)) return [];
  const maxW = maxPageWidth(sections);
  const out: Decoration[] = [];
  doc.forEach((node, offset) => {
    const span = spans.find((s) => offset < s.end) ?? spans[spans.length - 1]!;
    const s = span.section;
    const side = (maxW - px(s.pageWidth)) / 2;
    out.push(Decoration.node(offset, offset + node.nodeSize, { 'data-sx': '', style: `--fo-sl:${side + px(s.margins.left)}px;--fo-sr:${side + px(s.margins.right)}px` }));
  });
  return out;
}

export interface TabSpec {
  /** Position de la tabulation (un caractere). */
  pos: number;
  /** Largeur en pixels. */
  width: number;
  leader: 'none' | 'dot' | 'hyphen' | 'underscore' | 'heavy' | 'middleDot';
}

export const tabKey = new PluginKey<TabSpec[]>('fo-tabs');

const LEADER_CLASS: Readonly<Record<TabSpec['leader'], string>> = {
  none: 'fo-tab', dot: 'fo-tab fo-tab--dot', hyphen: 'fo-tab fo-tab--hyphen', underscore: 'fo-tab fo-tab--underscore', heavy: 'fo-tab fo-tab--underscore', middleDot: 'fo-tab fo-tab--middot',
};

export function sameTabs(a: readonly TabSpec[], b: readonly TabSpec[]): boolean {
  return a.length === b.length && a.every((t, i) => t.pos === b[i]!.pos && t.leader === b[i]!.leader && Math.abs(t.width - b[i]!.width) < 0.6);
}

/** Largeur des tabulations calculee par la mesure (taquets personnalises), posee par une transaction meta et suivie jusqu'a la prochaine mesure. */
export function tabPlugin(): Plugin<TabSpec[]> {
  return new Plugin<TabSpec[]>({
    key: tabKey,
    state: {
      init: () => [],
      apply: (tr: Transaction, tabs: TabSpec[]) => {
        const next = tr.getMeta(tabKey) as TabSpec[] | undefined;
        if (next) return next;
        if (!tr.docChanged) return tabs;
        return tabs.map((t) => ({ ...t, pos: tr.mapping.map(t.pos, 1) }));
      },
    },
    props: {
      decorations(state) {
        const tabs = tabKey.getState(state);
        if (!tabs?.length) return null;
        const size = state.doc.content.size;
        return DecorationSet.create(state.doc, tabs.filter((t) => t.pos >= 0 && t.pos < size).map((t) => Decoration.inline(t.pos, t.pos + 1, { class: LEADER_CLASS[t.leader], style: `width:${t.width}px` })));
      },
    },
  });
}
