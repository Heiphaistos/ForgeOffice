// Mesure du flux (DOM) : blocs, lignes et rangees en coordonnees naturelles (sans les espaces de pagination).
import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { effectiveParagraphProps, type Inline, type Paragraph, type WordDocument } from '@forgeoffice/docx';
import type { FlowBlock, FlowLine } from './paginate.ts';
import { sectionIndexAt, sectionSpans, startParity, startsNewPage } from '../features/sections.ts';

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

/**
 * Position ProseMirror du debut du `frag`-ieme fragment de ligne d'un noeud texte : recherche dichotomique du premier caractere
 * dont le haut atteint celui de la ligne (posAtCoords parcourt tous les caracteres : trop lent sur de gros documents).
 */
function fragmentStart(view: EditorView, node: Text, frag: number, top: number): number | undefined {
  const len = node.length;
  let at = 0;
  if (frag > 0) {
    const r = document.createRange();
    let lo = 0;
    let hi = len - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      r.setStart(node, mid);
      r.setEnd(node, mid + 1);
      const rect = r.getBoundingClientRect();
      if (rect.height > 0 && rect.top >= top - 2) hi = mid;
      else lo = mid + 1;
    }
    at = lo;
  }
  try {
    return view.posAtDOM(node, at);
  } catch {
    return undefined; // noeud texte retire du DOM entre la mesure et la lecture : repli sur posAtCoords
  }
}

/** Lignes d'un paragraphe : rectangles des noeuds texte et images, regroupes par ligne. */
function paragraphLines(view: EditorView, el: HTMLElement, origin: DOMRect, scale: number, nat: (y: number) => number, key: string): FlowLine[] {
  const rects: DOMRect[] = [];
  const sources = new WeakMap<DOMRect, { node: Text; frag: number }>();
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
    let frag = 0;
    for (const r of range.getClientRects()) {
      if (r.height <= 0) continue;
      rects.push(r);
      sources.set(r, { node: n as Text, frag: frag++ });
    }
  }
  rects.sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: { top: number; bottom: number; left: number; src?: { node: Text; frag: number } }[] = [];
  for (const r of rects) {
    const last = lines[lines.length - 1];
    if (last && r.top < last.bottom - 2) {
      last.bottom = Math.max(last.bottom, r.bottom);
      if (r.left < last.left) {
        last.left = r.left;
        last.src = sources.get(r);
      }
    } else lines.push({ top: r.top, bottom: r.bottom, left: r.left, src: sources.get(r) });
  }
  const breaks = [...el.querySelectorAll<HTMLElement>('.fo-pbreak')].map((b) => b.getBoundingClientRect().top);
  return lines.map((l, k) => {
    const y = nat((l.top - origin.top) / scale);
    const forced = breaks.some((bt) => bt <= l.top + 1 && !lines.some((o) => o !== l && o.top < l.top && o.top >= bt - 1));
    // La position ProseMirror n'est cherchee (posAtCoords, couteux) que si la pagination coupe a cette ligne.
    let pos: number | undefined;
    return {
      y, h: (l.bottom - l.top) / scale, forced: forced || undefined, key: `${key}:${k}`,
      get pos(): number {
        pos ??= (l.src ? fragmentStart(view, l.src.node, l.src.frag, l.top) : undefined) ?? view.posAtCoords({ left: l.left + 1, top: (l.top + l.bottom) / 2 })?.pos ?? 0;
        return pos;
      },
    };
  });
}

const versions = new WeakMap<object, number>();
let nextVersion = 1;
/** Numero propre a chaque etat du document : deux mesures du meme etat donnent les memes cles de lignes. */
function docVersion(doc: PMNode): number {
  let v = versions.get(doc);
  if (!v) {
    v = nextVersion++;
    versions.set(doc, v);
  }
  return v;
}

/** Repere du flux : origine a l'ecran, echelle (zoom) et conversion en ordonnee naturelle. */
function flowFrame(view: EditorView): { origin: DOMRect; scale: number; nat: (y: number) => number } {
  const root = view.dom;
  const origin = root.getBoundingClientRect();
  const scale = root.offsetWidth ? origin.width / root.offsetWidth : 1;
  const gaps: Gap[] = [...root.querySelectorAll<HTMLElement>('[data-pgap]')].map((g) => ({ top: (g.getBoundingClientRect().top - origin.top) / scale, h: Number(g.dataset.h) || 0 }));
  return { origin, scale, nat: naturalizer(gaps) };
}

export interface NoteAnchorPos {
  y: number;
  noteId: number;
  custom?: string;
}

/** Appels de notes de bas de page, dans l'ordre du document (ordonnee naturelle). */
export function measureNoteAnchors(view: EditorView): NoteAnchorPos[] {
  const { origin, scale, nat } = flowFrame(view);
  return [...view.dom.querySelectorAll<HTMLElement>('.fo-fnref')].map((el) => ({ y: nat((el.getBoundingClientRect().top - origin.top) / scale), noteId: Number(el.dataset.note), custom: el.dataset.custom || undefined }));
}

/** Zone des notes de fin (apres le corps) vue comme un bloc de coupure par note, ou null. `ownGap` = espace deja ajoute au-dessus. */
export function measureTail(view: EditorView, el: HTMLElement | null, ownGap: number): FlowBlock | null {
  if (!el || !el.firstElementChild) return null;
  const { origin, scale, nat } = flowFrame(view);
  const r = el.getBoundingClientRect();
  const top = nat((r.top - origin.top) / scale) - ownGap;
  const kids = [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
  return {
    pos: view.state.doc.content.size, top, bottom: top + r.height / scale - ownGap, split: 'child',
    lines: () => kids.map((k) => ({ y: nat((k.getBoundingClientRect().top - origin.top) / scale) - ownGap, h: k.getBoundingClientRect().height / scale, pos: view.state.doc.content.size })),
  };
}

/** Blocs du flux pour paginate(). `meta` donne les proprietes effectives (solidaire du suivant, saut avant...). */
export function measureFlow(view: EditorView, meta: WordDocument): FlowBlock[] {
  const { origin, scale, nat } = flowFrame(view);
  const blocks: FlowBlock[] = [];
  let pendingBreak = false;
  const spans = sectionSpans(view.state.doc, meta.finalSection);
  const version = docVersion(view.state.doc);
  let parity: 'even' | 'odd' | undefined;
  view.state.doc.forEach((node, offset) => {
    const el = view.nodeDOM(offset);
    if (!(el instanceof HTMLElement)) return;
    const r = el.getBoundingClientRect();
    const top = nat((r.top - origin.top) / scale);
    const bottom = top + (r.height - (el.querySelector('[data-pgap]') ? gapsInside(el) : 0)) / scale;
    const sectionIndex = sectionIndexAt(spans, offset);
    const block: FlowBlock = { pos: offset, key: `${version}:${offset}`, top, bottom, breakBefore: pendingBreak || undefined, section: sectionIndex, parity: pendingBreak ? parity : undefined };
    pendingBreak = false;
    parity = undefined;
    if (node.type.name === 'paragraph') {
      const model: Pick<Paragraph, 'styleId' | 'props'> = { styleId: (node.attrs.styleId as string | null) ?? undefined, props: node.attrs.props as Paragraph['props'] };
      const pp = effectiveParagraphProps(meta, model);
      if (pp.pageBreakBefore) block.breakBefore = true;
      block.keepNext = pp.keepNext;
      block.keepLines = pp.keepLines;
      block.widowControl = pp.widowControl !== false;
      block.split = 'line';
      block.hasForced = hasManualBreak(node) || undefined;
      block.lines = () => paragraphLines(view, el, origin, scale, nat, `${version}:${offset}`);
      if (block.hasForced) {
        // Saut en fin de paragraphe : la page suivante commence au bloc suivant.
        const lastBreak = [...el.querySelectorAll('.fo-pbreak')].pop();
        if (lastBreak && !lastBreak.nextSibling?.textContent && !lastBreak.nextElementSibling) pendingBreak = true;
      }
      if (node.attrs.sectionBreak) {
        const next = spans[sectionIndex + 1];
        if (next && startsNewPage(spans[sectionIndex]!.section, next.section)) {
          pendingBreak = true;
          parity = startParity(next.section);
        }
      }
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
