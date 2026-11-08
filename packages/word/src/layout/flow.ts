// Calcul complet de la mise en page en mode Page : mesure du flux -> sauts de page par section -> feuilles, notes, numeros de ligne.
import type { EditorView } from 'prosemirror-view';
import { formatNumber, type NumberFormat, type Section, type WordDocument } from '@forgeoffice/docx';
import { pageLabels, sectionBox } from '../features/sections.ts';
import { measureFlow, measureNoteAnchors, measureTail } from './measure.ts';
import { alignPages } from './valign.ts';
import { paginate, pageOf, type FlowAnchor, type PageGap, type PageGeometry } from './paginate.ts';
import type { Layout, PageNote } from '../ui/PageView.tsx';

/** Hauteur estimee d'une note non encore mesuree (px). */
const NOTE_ESTIMATE = 22;

export interface FlowInput {
  view: EditorView;
  meta: WordDocument;
  sections: readonly Section[];
  gapPx: number;
  /** Hauteurs mesurees des notes de bas de page rendues (px), par identifiant. */
  noteHeights: ReadonlyMap<number, number>;
  endnotesEl: HTMLElement | null;
  /** Espace deja pose au-dessus des notes de fin. */
  tailGap: number;
}

export interface FlowOutput {
  /** Espaces a poser dans l'editeur (sans l'espace de la zone de fin). */
  gaps: PageGap[];
  layout: Layout;
}

/** Geometrie de page de chaque section (pixels CSS). */
export function geometries(sections: readonly Section[], gapPx: number): PageGeometry[] {
  return sections.map((s) => {
    const b = sectionBox(s);
    return { contentHeight: b.contentHeight, stride: b.pageH + gapPx, top: b.marginTop };
  });
}

/** Notes de fin referencees, dans l'ordre du document. */
export function endnoteIds(view: EditorView): number[] {
  const ids: number[] = [];
  view.state.doc.descendants((node) => {
    if (node.type.name === 'atom' && (node.attrs.data as { type: string }).type === 'endnoteRef') ids.push((node.attrs.data as { noteId: number }).noteId);
    return true;
  });
  return ids;
}

export function computeFlow(inp: FlowInput): FlowOutput {
  const { view, meta, sections, gapPx } = inp;
  const blocks = measureFlow(view, meta);
  const tail = measureTail(view, inp.endnotesEl, inp.tailGap);
  if (tail) blocks.push(tail);
  const refs = measureNoteAnchors(view);
  const anchors: FlowAnchor[] = refs.map((r) => ({ y: r.y, h: inp.noteHeights.get(r.noteId) ?? NOTE_ESTIMATE }));
  const geoms = geometries(sections, gapPx);
  const paged = paginate(blocks, geoms, anchors);
  // Alignement vertical (centre / bas) : espaces corriges page par page.
  const sectionOf = (k: number): number => Math.min(paged.pageSections[k] ?? 0, sections.length - 1);
  const res = { ...paged, gaps: alignPages(blocks, paged, paged.pageStarts.map((_, k) => geoms[sectionOf(k)]!.contentHeight), paged.pageStarts.map((_, k) => sections[sectionOf(k)]!.verticalAlign ?? 'top')) };
  const size = view.state.doc.content.size;
  const tailGap = tail ? res.gaps.find((g) => g.at === 'child' && g.pos === size)?.height ?? 0 : 0;
  const gaps = tail ? res.gaps.filter((g) => !(g.at === 'child' && g.pos === size)) : res.gaps;
  const labels = pageLabels(res.pageSections, sections, formatNumber);
  const noteFmt = meta.settings.footnoteNumbering;
  const notes: PageNote[] = refs.map((r, i) => ({ page: pageOf(res, r.y), noteId: r.noteId, num: r.custom ?? formatNumber(i + (noteFmt?.start ?? 1), (noteFmt?.format ?? 'decimal') as NumberFormat) }));
  const lineNumbers: Layout['lineNumbers'] = [];
  const ln = sections[sections.length - 1]?.lineNumbering;
  if (ln) {
    const first = Math.max(0, (ln.start || 1) - 1);
    let n = first;
    let lastPage = 0;
    for (const b of blocks) {
      if (b.split !== 'line') continue;
      for (const line of b.lines?.() ?? []) {
        const page = pageOf(res, line.y);
        if (page !== lastPage && ln.restart === 'newPage') n = first;
        lastPage = page;
        n++;
        if (n % Math.max(1, ln.countBy) === 0) lineNumbers.push({ page, y: line.y - res.pageStarts[page]! + Math.max(0, line.h - 16), n });
      }
    }
  }
  const m0 = sectionBox(sections[0]!).marginTop;
  const sheets = res.pageTops.map((top, i) => ({ top, textTop: top + sectionBox(sections[Math.min(res.pageSections[i] ?? 0, sections.length - 1)]!).marginTop - m0, section: res.pageSections[i] ?? 0, number: labels[i]?.number ?? i + 1, label: labels[i]?.text ?? String(i + 1), first: labels[i]?.firstOfSection ?? i === 0 }));
  return { gaps, layout: { pages: res.pageCount, notes, lineNumbers, sheets, tailGap, endnotes: endnoteIds(view) } };
}

/** Feuilles du mode colonnes / hors mode Page : une seule geometrie, un nombre de pages donne. */
export function uniformSheets(count: number, section: Section, index: number, gapPx: number): Layout['sheets'] {
  const stride = sectionBox(section).pageH + gapPx;
  return Array.from({ length: count }, (_, i) => ({ top: i * stride, textTop: i * stride, section: index, number: i + 1, label: formatNumber(i + 1, section.pageNumbering?.format ?? 'decimal'), first: i === 0 }));
}
