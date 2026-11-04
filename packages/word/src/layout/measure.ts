// Mesure du flux (DOM) : blocs, lignes et rangees en coordonnees naturelles (sans les espaces de pagination).
import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { effectiveParagraphProps, type Inline, type Paragraph, type WordDocument } from '@forgeoffice/docx';
import type { FlowBlock, FlowLine } from './paginate.ts';

interface Gap {
  top: number;
  h: number;
}

/** Convertit une ordonnee affichee en ordonnee naturelle (retire les espaces de pagination situes au-dessus). */
function naturalizer(gaps: readonly Gap[]): (y: number) => number {
  return (y) => {
    let shift = 0;
    for (const g of gaps) if (g.top < y - 0.5) shift += g.h;
    return y - shift;
  };
}

function hasManualBreak(node: PMNode): boolean {
  let found = false;
  node.descendants((child) => {
    if (found) return false;
    if (child.type.name === 'atom') {
      const d = child.attrs.data as Inline;
      if (d.type === 'break' && d.kind !== 'line') found = true;
    }
    return !found;
  });
  return found;
}

/** Lignes d'un paragraphe : rectangles des noeuds texte et images, regroupes par ligne. */
function paragraphLines(view: EditorView, el: HTMLElement, origin: DOMRect, scale: number, nat: (y: number) => number): FlowLine[] {
  const rects: DOMRect[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n instanceof HTMLElement) {
      if (n.dataset.pgap !== undefined) continue;
      if (n.tagName === 'IMG' || n.classList.contains('fo-shape') || n.tagName === 'BR') rects.push(n.getBoundingClientRect());
      continue;
    }
    if (n.parentElement?.closest('[data-pgap]') || !n.textContent) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.height > 0) rects.push(r);
  }
  rects.sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: { top: number; bottom: number; left: number }[] = [];
  for (const r of rects) {
    const last = lines[lines.length - 1];
    if (last && r.top < last.bottom - 2) {
      last.bottom = Math.max(last.bottom, r.bottom);
      last.left = Math.min(last.left, r.left);
    } else lines.push({ top: r.top, bottom: r.bottom, left: r.left });
  }
  const breaks = [...el.querySelectorAll<HTMLElement>('.fo-pbreak')].map((b) => b.getBoundingClientRect().top);
  return lines.map((l) => {
    const hit = view.posAtCoords({ left: l.left + 1, top: (l.top + l.bottom) / 2 });
    const y = nat((l.top - origin.top) / scale);
    const forced = breaks.some((bt) => bt <= l.top + 1 && !lines.some((o) => o !== l && o.top < l.top && o.top >= bt - 1));
    return { y, h: (l.bottom - l.top) / scale, pos: hit?.pos ?? 0, forced: forced || undefined };
  });
}

/** Blocs du flux pour paginate(). `meta` donne les proprietes effectives (solidaire du suivant, saut avant...). */
export function measureFlow(view: EditorView, meta: WordDocument): FlowBlock[] {
  const root = view.dom;
  const origin = root.getBoundingClientRect();
  const scale = root.offsetWidth ? origin.width / root.offsetWidth : 1;
  const gaps: Gap[] = [...root.querySelectorAll<HTMLElement>('[data-pgap]')].map((g) => ({ top: (g.getBoundingClientRect().top - origin.top) / scale, h: Number(g.dataset.h) || 0 }));
  const nat = naturalizer(gaps);
  const blocks: FlowBlock[] = [];
  let pendingBreak = false;
  view.state.doc.forEach((node, offset) => {
    const el = view.nodeDOM(offset);
    if (!(el instanceof HTMLElement)) return;
    const r = el.getBoundingClientRect();
    const top = nat((r.top - origin.top) / scale);
    const bottom = top + (r.height - (el.querySelector('[data-pgap]') ? gapsInside(el) : 0)) / scale;
    const block: FlowBlock = { pos: offset, top, bottom, breakBefore: pendingBreak || undefined };
    pendingBreak = false;
    if (node.type.name === 'paragraph') {
      const model: Pick<Paragraph, 'styleId' | 'props'> = { styleId: (node.attrs.styleId as string | null) ?? undefined, props: node.attrs.props as Paragraph['props'] };
      const pp = effectiveParagraphProps(meta, model);
      if (pp.pageBreakBefore) block.breakBefore = true;
      block.keepNext = pp.keepNext;
      block.keepLines = pp.keepLines;
      block.widowControl = pp.widowControl !== false;
      block.split = 'line';
      block.hasForced = hasManualBreak(node) || undefined;
      block.lines = () => paragraphLines(view, el, origin, scale, nat);
      if (block.hasForced) {
        // Saut en fin de paragraphe : la page suivante commence au bloc suivant.
        const lastBreak = [...el.querySelectorAll('.fo-pbreak')].pop();
        if (lastBreak && !lastBreak.nextSibling?.textContent && !lastBreak.nextElementSibling) pendingBreak = true;
      }
      const sect = node.attrs.sectionBreak as { breakType: string } | null;
      if (sect && sect.breakType !== 'continuous') pendingBreak = true;
    } else if (node.type.name === 'table') {
      block.split = 'row';
      block.lines = () => {
        const out: FlowLine[] = [];
        let pos = offset + 1;
        node.forEach((row) => {
          const rowEl = view.nodeDOM(pos);
          if (rowEl instanceof HTMLElement) {
            const rr = rowEl.getBoundingClientRect();
            out.push({ y: nat((rr.top - origin.top) / scale), h: rr.height / scale - (rowEl.dataset.h ? Number(rowEl.dataset.h) : 0), pos });
          }
          pos += row.nodeSize;
        });
        return out;
      };
    } else if (node.type.name === 'toc' || node.type.name === 'control_block') {
      block.split = 'child';
      block.lines = () => {
        const out: FlowLine[] = [];
        let pos = offset + 1;
        node.forEach((child) => {
          const childEl = view.nodeDOM(pos);
          if (childEl instanceof HTMLElement) {
            const cr = childEl.getBoundingClientRect();
            out.push({ y: nat((cr.top - origin.top) / scale), h: cr.height / scale, pos });
          }
          pos += child.nodeSize;
        });
        return out;
      };
    }
    blocks.push(block);
  });
  return blocks;

  function gapsInside(el: HTMLElement): number {
    let h = 0;
    for (const g of el.querySelectorAll<HTMLElement>('[data-pgap]')) h += (Number(g.dataset.h) || 0) * scale;
    return h;
  }
}

/** Position verticale naturelle d'une position du document (page du curseur). */
export function naturalY(view: EditorView, pos: number): number {
  const root = view.dom;
  const origin = root.getBoundingClientRect();
  const scale = root.offsetWidth ? origin.width / root.offsetWidth : 1;
  try {
    return (view.coordsAtPos(pos).top - origin.top) / scale;
  } catch {
    return 0; // position hors du document affiche (vue en cours de reconstruction)
  }
}
