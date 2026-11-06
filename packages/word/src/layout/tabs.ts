// Mesure des tabulations (DOM) : pour chaque tabulation d'un paragraphe a taquets personnalises, largeur qui amene le texte au taquet.
import type { EditorView } from 'prosemirror-view';
import { effectiveParagraphProps, type Paragraph, type WordDocument } from '@forgeoffice/docx';
import { nextStop, tabWidth, usableStops } from '../features/tabstops.ts';
import type { TabSpec } from '../editor/layout-deco.ts';

const PT_PX = 4 / 3;

/** Largeur affichee du texte entre deux positions (une seule ligne). */
function textWidth(view: EditorView, from: number, to: number): number {
  const a = view.domAtPos(from);
  const b = view.domAtPos(to);
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  const rects = [...range.getClientRects()].filter((r) => r.width > 0);
  return rects.length ? Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)) : 0;
}

/** Bord gauche (ecran) de la zone de texte qui contient le paragraphe : la cellule, ou la marge de sa section. */
function marginLeft(el: HTMLElement, rootLeft: number, scale: number): number {
  const cell = el.closest('td, th');
  if (cell instanceof HTMLElement) {
    const cs = getComputedStyle(cell);
    return cell.getBoundingClientRect().left + ((parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0)) * scale;
  }
  const block = el.closest('[data-sx]') ?? el;
  return rootLeft + (parseFloat(getComputedStyle(block).getPropertyValue('--fo-sl')) || 0) * scale;
}

export function measureTabs(view: EditorView, meta: WordDocument): TabSpec[] {
  const out: TabSpec[] = [];
  const root = view.dom.getBoundingClientRect();
  const scale = view.dom.offsetWidth ? root.width / view.dom.offsetWidth : 1;
  const left = (pos: number): number => view.coordsAtPos(pos).left;
  view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'toc') return false;
    if (node.type.name !== 'paragraph') return true;
    if (!node.textContent.includes('\t')) return false;
    const model: Pick<Paragraph, 'styleId' | 'props'> = { styleId: (node.attrs.styleId as string | null) ?? undefined, props: node.attrs.props as Paragraph['props'] };
    const stops = usableStops(effectiveParagraphProps(meta, model).tabs);
    if (!stops.length) return false;
    const el = view.nodeDOM(pos);
    if (!(el instanceof HTMLElement)) return false;
    const ref = marginLeft(el, root.left, scale);
    const tabs: number[] = [];
    node.forEach((child, offset) => {
      if (!child.isText || !child.text) return;
      for (let i = child.text.indexOf('\t'); i >= 0; i = child.text.indexOf('\t', i + 1)) tabs.push(pos + 1 + offset + i);
    });
    const end = pos + node.nodeSize - 1;
    // Abscisse (points depuis la marge) calculee de proche en proche : depart de la ligne + largeur des textes + largeur des tabulations deja resolues.
    // Elle ne depend pas de la largeur actuelle des tabulations (pas de point fixe errone quand une tabulation passe a la ligne).
    let x = (left(pos + 1) - ref) / scale / PT_PX;
    let from = pos + 1;
    tabs.forEach((at, k) => {
      x += textWidth(view, from, at) / scale / PT_PX;
      const stop = nextStop(x, stops, meta.settings.defaultTabStop);
      const segEnd = tabs[k + 1] ?? end;
      let segment = 0;
      let beforeDecimal = 0;
      if (stop.align !== 'left' && segEnd > at + 1) {
        // Largeur du texte qui suit, par un intervalle DOM.
        segment = textWidth(view, at + 1, segEnd) / scale / PT_PX;
        const dec = view.state.doc.textBetween(at + 1, segEnd).search(/[.,]/);
        beforeDecimal = dec >= 0 ? textWidth(view, at + 1, at + 1 + dec) / scale / PT_PX : segment;
      }
      const width = tabWidth(x, stop, segment, beforeDecimal);
      out.push({ pos: at, width: width * PT_PX, leader: stop.leader });
      x += width;
      from = at + 1;
    });
    return false;
  });
  return out;
}
