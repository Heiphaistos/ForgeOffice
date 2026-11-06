// Point d'insertion tres visible : barre dessinee au-dessus du document (epaisseur, couleur et clignotement reglables).
import { useEffect, useLayoutEffect, useState } from 'react';
import type { EditorView } from 'prosemirror-view';
import { caretColor, type CaretPrefs } from '@forgeoffice/ui';

export interface CaretOverlayProps {
  view: EditorView | null;
  pagesRef: { current: HTMLElement | null };
  prefs: CaretPrefs;
  /** Couleur du papier (page coloree) ou null = blanc. */
  background: string | null;
  accent: string;
}

interface Box {
  left: number;
  top: number;
  height: number;
  key: number;
  scale: number;
}

export function CaretOverlay({ view, pagesRef, prefs, background, accent }: CaretOverlayProps) {
  const [box, setBox] = useState<Box | null>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const dom = view?.dom;
    if (!dom) return;
    const on = (): void => setFocused(view.hasFocus());
    on();
    dom.addEventListener('focus', on);
    dom.addEventListener('blur', on);
    return () => {
      dom.removeEventListener('focus', on);
      dom.removeEventListener('blur', on);
    };
  }, [view]);
  // Position relue a chaque rendu (la selection, la pagination et le zoom la deplacent).
  useLayoutEffect(() => {
    const pages = pagesRef.current;
    const sel = view?.state.selection;
    if (!view || !pages || !sel || !sel.empty || !focused || !view.editable) {
      setBox((b) => (b === null ? b : null));
      return;
    }
    try {
      const c = view.coordsAtPos(sel.head);
      const o = pages.getBoundingClientRect();
      const scale = pages.offsetWidth ? o.width / pages.offsetWidth : 1;
      const next = { left: (c.left - o.left) / scale, top: (c.top - o.top) / scale, height: Math.max(8, (c.bottom - c.top) / scale), key: sel.head, scale };
      setBox((b) => (b && Math.abs(b.left - next.left) < 0.3 && Math.abs(b.top - next.top) < 0.3 && b.height === next.height && b.key === next.key && b.scale === next.scale ? b : next));
    } catch {
      setBox(null); // position hors du document affiche (reconstruction en cours)
    }
  });
  if (!box) return null;
  const color = caretColor(prefs, background, accent);
  // Epaisseur constante a l'ecran quelle que soit l'echelle du zoom.
  const w = prefs.width / box.scale;
  return (
    <div key={box.key} className={`fo-caret${prefs.blink ? ' is-blink' : ''}`} aria-hidden="true"
      style={{ left: box.left - w / 2, top: box.top, height: box.height, width: w, background: color, boxShadow: color === '#FFFFFF' ? '0 0 0 1px rgba(0,0,0,.35)' : '0 0 0 1px rgba(255,255,255,.55)' }} />
  );
}
