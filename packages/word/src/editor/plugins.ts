// Greffons d'affichage : espaces de pagination, numeros de liste, surlignage de recherche et des commentaires.
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { computeListLabels, effectiveParagraphProps, numberingLevel, type Inline, type Paragraph, type WordDocument } from '@forgeoffice/docx';
import type { PageGap } from '../layout/paginate.ts';
import type { Match } from './find.ts';
import { paragraphCss } from './css.ts';

export const pageKey = new PluginKey<PageGap[]>('fo-pages');
export const searchKey = new PluginKey<SearchState>('fo-search');

export interface SearchState {
  matches: Match[];
  current: number;
}

function gapWidget(gap: PageGap): Decoration {
  const make = (): HTMLElement => {
    const el = document.createElement(gap.at === 'line' ? 'span' : 'div');
    el.className = 'fo-pgap';
    el.dataset.pgap = '';
    el.dataset.h = String(gap.height);
    el.style.height = `${gap.height}px`;
    el.contentEditable = 'false';
    return el;
  };
  return Decoration.widget(gap.pos, make, { side: -1, key: `gap-${gap.at}-${gap.pos}-${Math.round(gap.height)}`, ignoreSelection: true });
}

function gapDecorations(doc: PMNode, gaps: readonly PageGap[]): DecorationSet {
  const decos: Decoration[] = [];
  for (const gap of gaps) {
    if (gap.pos < 0 || gap.pos > doc.content.size) continue;
    if (gap.at === 'row') {
      const row = doc.nodeAt(gap.pos);
      if (row?.type.name === 'table_row') {
        decos.push(Decoration.node(gap.pos, gap.pos + row.nodeSize, { class: 'fo-rowgap', style: `--fo-gap:${gap.height}px`, 'data-pgap': '', 'data-h': String(gap.height) }));
      }
    } else decos.push(gapWidget(gap));
  }
  return DecorationSet.create(doc, decos);
}

/** Espaces inseres entre les pages (calcules par paginate() puis poses par une transaction meta). */
export function paginationPlugin(): Plugin<PageGap[]> {
  return new Plugin<PageGap[]>({
    key: pageKey,
    state: {
      init: () => [],
      apply: (tr: Transaction, gaps: PageGap[]) => {
        const next = tr.getMeta(pageKey) as PageGap[] | undefined;
        if (next) return next;
        if (!tr.docChanged) return gaps;
        // Les espaces suivent les positions jusqu'a la prochaine mesure.
        return gaps.map((g) => ({ ...g, pos: tr.mapping.map(g.pos, -1) }));
      },
    },
    props: {
      decorations(state: EditorState) {
        return gapDecorations(state.doc, pageKey.getState(state) ?? []);
      },
    },
  });
}

/** Caracteres de puces des polices symboles Word -> Unicode. */
const SYMBOL_BULLETS: Readonly<Record<string, string>> = {
  '': '•', '': '▪', '': '➢', '': '✓', '': '❖', '': '□', '': '■', '': '➤',
};

export function displayBullet(text: string): string {
  return [...text].map((c) => SYMBOL_BULLETS[c] ?? c).join('');
}

/** Decorations des numeros de liste : calculees comme Word (compteurs par liste abstraite). */
export function listDecorations(doc: PMNode, meta: WordDocument): Decoration[] {
  const paras: { node: PMNode; pos: number; model: Paragraph }[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return true;
    paras.push({ node, pos, model: { type: 'paragraph', styleId: (node.attrs.styleId as string | null) ?? undefined, props: node.attrs.props as Paragraph['props'], inlines: [] } });
    return false;
  });
  if (!meta.numbering.instances.length) return [];
  const labels = computeListLabels(meta, paras.map((p) => p.model));
  const out: Decoration[] = [];
  for (const p of paras) {
    const label = labels.get(p.model);
    if (label === undefined) continue;
    const num = effectiveParagraphProps(meta, p.model).numbering;
    const level = num ? numberingLevel(meta, num.numId, num.level) : undefined;
    const own = p.model.props;
    const lp = { ...level?.paragraph };
    for (const k of Object.keys(own)) delete (lp as Record<string, unknown>)[k];
    const hang = level?.paragraph?.indentFirstLine !== undefined && level.paragraph.indentFirstLine < 0 ? -level.paragraph.indentFirstLine : 18;
    const style = [paragraphCss(lp), `--fo-hang:${hang}pt`].filter(Boolean).join(';');
    out.push(Decoration.node(p.pos, p.pos + p.node.nodeSize, { class: 'fo-li', 'data-label': displayBullet(label), style }));
  }
  return out;
}

/** Plages commentees : entre commentStart et commentEnd du meme identifiant. */
export function commentDecorations(doc: PMNode, active: number | null): Decoration[] {
  const starts = new Map<number, number>();
  const out: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'atom') return true;
    const data = node.attrs.data as Inline;
    if (data.type === 'commentStart') starts.set(data.commentId, pos + 1);
    else if (data.type === 'commentEnd') {
      const from = starts.get(data.commentId);
      if (from !== undefined && from < pos) out.push(Decoration.inline(from, pos, { class: data.commentId === active ? 'fo-commented is-active' : 'fo-commented', 'data-comment': String(data.commentId) }));
    }
    return false;
  });
  return out;
}

/** Recherche : toutes les occurrences surlignees, l'occurrence courante plus marquee. */
export function searchPlugin(): Plugin<SearchState> {
  return new Plugin<SearchState>({
    key: searchKey,
    state: {
      init: () => ({ matches: [], current: -1 }),
      apply: (tr, value) => {
        const next = tr.getMeta(searchKey) as SearchState | undefined;
        if (next) return next;
        if (!tr.docChanged) return value;
        return { matches: value.matches.map((m) => ({ ...m, from: tr.mapping.map(m.from), to: tr.mapping.map(m.to) })).filter((m) => m.to > m.from), current: value.current };
      },
    },
    props: {
      decorations(state) {
        const s = searchKey.getState(state);
        if (!s?.matches.length) return null;
        return DecorationSet.create(state.doc, s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.current ? 'fo-hit is-current' : 'fo-hit' })));
      },
    },
  });
}

/** Decorations dependant du modele (listes, commentaires) : `getMeta` lit le modele courant de l'application. */
export function documentPlugin(getMeta: () => WordDocument, getActiveComment: () => number | null): Plugin {
  let cacheDoc: PMNode | null = null;
  let cacheMeta: WordDocument | null = null;
  let cacheActive: number | null = null;
  let cache = DecorationSet.empty;
  return new Plugin({
    props: {
      decorations(state) {
        const meta = getMeta();
        const active = getActiveComment();
        if (state.doc !== cacheDoc || meta !== cacheMeta || active !== cacheActive) {
          cacheDoc = state.doc;
          cacheMeta = meta;
          cacheActive = active;
          cache = DecorationSet.create(state.doc, [...listDecorations(state.doc, meta), ...commentDecorations(state.doc, active)]);
        }
        return cache;
      },
    },
  });
}
