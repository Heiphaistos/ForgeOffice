// Correspondance entre la selection DOM d'une zone de texte rendue par TextBlock et les positions du modele.
import type { TextPos, TextRange } from './text.ts';

const len = (el: Element): number => Number(el.getAttribute('data-len') ?? (el.textContent ?? '').length);

/** Position du modele pour un point DOM (noeud + decalage) a l'interieur de `root` (zone data-text-flow). */
export function domToPos(root: HTMLElement, node: Node, offset: number): TextPos | null {
  if (!root.contains(node)) return null;
  if (node === root) {
    const paras = root.querySelectorAll(':scope > [data-p]');
    const index = Math.min(offset, paras.length);
    if (index >= paras.length && paras.length) {
      const last = paras[paras.length - 1] as HTMLElement;
      return { p: paras.length - 1, o: paragraphEnd(last) };
    }
    return { p: index, o: 0 };
  }
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const para = element?.closest('[data-p]');
  if (!element || !para || !root.contains(para)) return null;
  const p = Number(para.getAttribute('data-p'));
  if (element.closest('[data-bullet]')) return { p, o: 0 };
  const run = element.closest('[data-o]');
  if (run && para.contains(run)) {
    const start = Number(run.getAttribute('data-o'));
    if (node.nodeType === Node.TEXT_NODE && !run.hasAttribute('data-field')) return { p, o: start + Math.min(offset, (node.textContent ?? '').length) };
    return { p, o: start + (offset > 0 || run.hasAttribute('data-field') ? (run.hasAttribute('data-field') && offset === 0 ? 0 : len(run)) : 0) };
  }
  if (element === para) {
    const kids = Array.from(para.childNodes);
    for (let i = offset; i < kids.length; i++) {
      const kid = kids[i];
      if (kid instanceof Element && kid.hasAttribute('data-o')) return { p, o: Number(kid.getAttribute('data-o')) };
    }
    return { p, o: paragraphEnd(para) };
  }
  return { p, o: 0 };
}

function paragraphEnd(para: Element): number {
  let end = 0;
  para.querySelectorAll('[data-o]').forEach((run) => {
    end = Math.max(end, Number(run.getAttribute('data-o')) + len(run));
  });
  return end;
}

/** Point DOM pour une position du modele. */
export function posToDom(root: HTMLElement, pos: TextPos): { node: Node; offset: number } | null {
  const para = root.querySelector(`:scope > [data-p="${pos.p}"]`);
  if (!para) return null;
  const runs = Array.from(para.querySelectorAll('[data-o]'));
  for (const run of runs) {
    const start = Number(run.getAttribute('data-o'));
    const length = len(run);
    if (pos.o < start || pos.o > start + length) continue;
    if (run.tagName === 'BR' || run.hasAttribute('data-field')) {
      if (pos.o === start) continue;
      const index = Array.from(para.childNodes).indexOf(run);
      return { node: para, offset: index + 1 };
    }
    const text = run.firstChild;
    if (text && text.nodeType === Node.TEXT_NODE) return { node: text, offset: pos.o - start };
    return { node: run, offset: 0 };
  }
  // Debut d'un paragraphe vide ou position devant un saut / champ : avant le premier segment concerne.
  const kids = Array.from(para.childNodes);
  const target = runs.find((r) => Number(r.getAttribute('data-o')) >= pos.o) ?? para.querySelector('[data-end]');
  const index = target ? kids.indexOf(target as ChildNode) : kids.length;
  return { node: para, offset: Math.max(0, index) };
}

/** Selection DOM courante convertie (null si hors de la zone). */
export function readSelection(root: HTMLElement): TextRange | null {
  const sel = root.ownerDocument.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode) return null;
  const start = domToPos(root, sel.anchorNode, sel.anchorOffset);
  const end = domToPos(root, sel.focusNode, sel.focusOffset);
  return start && end ? { start, end } : null;
}

/** Applique une plage du modele a la selection DOM. */
export function writeSelection(root: HTMLElement, range: TextRange): void {
  const sel = root.ownerDocument.getSelection();
  const a = posToDom(root, range.start);
  const b = posToDom(root, range.end);
  if (!sel || !a || !b) return;
  try {
    sel.setBaseAndExtent(a.node, a.offset, b.node, b.offset);
  } catch (err) {
    // Decalage hors limites (DOM pas encore a jour) : la selection sera reecrite au rendu suivant.
    if (!(err instanceof DOMException)) throw err;
  }
}

/** Position du modele sous un point de l'ecran (clic dans le texte). */
export function posFromPoint(root: HTMLElement, x: number, y: number): TextPos | null {
  const doc = root.ownerDocument as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null; caretRangeFromPoint?: (x: number, y: number) => Range | null };
  if (doc.caretPositionFromPoint) {
    const c = doc.caretPositionFromPoint(x, y);
    if (c) return domToPos(root, c.offsetNode, c.offset);
  }
  const r = doc.caretRangeFromPoint?.(x, y);
  return r ? domToPos(root, r.startContainer, r.startOffset) : null;
}
