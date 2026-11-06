// Poignees de l'image selectionnee : redimensionnement (8 poignees), menu d'habillage, deplacement des images flottantes.
import { useLayoutEffect, useState, type PointerEvent as RPointerEvent } from 'react';
import type { EditorView } from 'prosemirror-view';
import type { ImageInline } from '@forgeoffice/docx';
import { Icon } from '@forgeoffice/ui';
import { T } from '../strings.ts';
import { HANDLES, IMAGE_WRAPS, resizeBox, rotationFrom, wrapOf, type Handle, type ImageWrap } from '../editor/images.ts';

const LABELS: Readonly<Record<ImageWrap, string>> = {
  inline: T.cmd.wrapInline, square: T.cmd.wrapSquare, tight: T.cmd.wrapTight, topAndBottom: T.cmd.wrapTopBottom, behind: T.cmd.wrapBehind, front: T.cmd.wrapFront,
};

const CURSORS: Readonly<Record<Handle, string>> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ImageOverlayProps {
  view: EditorView | null;
  image: { pos: number; data: ImageInline };
  pagesRef: { current: HTMLElement | null };
  onSize: (size: { width: number; height: number }) => void;
  onWrap: (mode: ImageWrap) => void;
  onRotate: (degrees: number) => void;
  /** Deplacement d'une image flottante : point d'arrivee en coordonnees ecran. */
  onMove: (clientX: number, clientY: number) => void;
}

const sameBox = (a: Box | null, b: Box): boolean => !!a && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

/** Suit un glissement d'un element capture au pointeur ; `move` a chaque deplacement, `done` a la fin (avec false si annule). */
function track(target: HTMLElement, pointerId: number, move: (e: PointerEvent) => void, done: (e: PointerEvent, ok: boolean) => void): void {
  target.setPointerCapture(pointerId);
  const end = (ok: boolean) => (e: PointerEvent): void => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', cancel);
    done(e, ok);
  };
  const up = end(true);
  const cancel = end(false);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', cancel);
}

export function ImageOverlay({ view, image, pagesRef, onSize, onWrap, onMove, onRotate }: ImageOverlayProps) {
  const [box, setBox] = useState<Box | null>(null);
  const [menu, setMenu] = useState(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const scaleNow = (): number => {
    const pages = pagesRef.current;
    return pages && pages.offsetWidth ? pages.getBoundingClientRect().width / pages.offsetWidth : 1;
  };
  // Position de l'image dans la surface (pixels du document, sans le zoom) : relue a chaque rendu.
  useLayoutEffect(() => {
    const el = view?.nodeDOM(image.pos);
    const pages = pagesRef.current;
    if (!(el instanceof HTMLElement) || !pages) {
      setBox(null);
      return;
    }
    const scale = scaleNow();
    const r = el.getBoundingClientRect();
    const o = pages.getBoundingClientRect();
    const next = { left: (r.left - o.left) / scale, top: (r.top - o.top) / scale, width: r.width / scale, height: r.height / scale };
    setBox((prev) => (sameBox(prev, next) ? prev : next));
  });
  if (!box) return null;

  const startResize = (h: Handle) => (e: RPointerEvent<HTMLElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, w: image.data.width, h: image.data.height, scale: scaleNow() };
    track(e.currentTarget, e.pointerId, (ev) => {
      onSize(resizeBox(h, { width: start.w, height: start.h }, ((ev.clientX - start.x) / start.scale) * 0.75, ((ev.clientY - start.y) / start.scale) * 0.75, ev.shiftKey));
    }, () => undefined);
  };

  const startMove = (e: RPointerEvent<HTMLElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    track(e.currentTarget, e.pointerId, (ev) => setGhost({ x: ev.clientX, y: ev.clientY }), (ev, ok) => {
      setGhost(null);
      if (ok) onMove(ev.clientX, ev.clientY);
    });
  };

  const startRotate = (e: RPointerEvent<HTMLElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.parentElement!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    track(e.currentTarget, e.pointerId, (ev) => onRotate(rotationFrom(cx, cy, ev.clientX, ev.clientY, ev.shiftKey)), () => undefined);
  };

  const cur = wrapOf(image.data);
  const at = (h: Handle): { left: string; top: string } => ({
    left: h.includes('w') ? '0%' : h.includes('e') ? '100%' : '50%',
    top: h.includes('n') ? '0%' : h.includes('s') ? '100%' : '50%',
  });
  const s = scaleNow();
  return (
    <div className="fo-imgbox" style={{ left: box.left, top: box.top, width: box.width, height: box.height }} data-testid="image-overlay">
      {HANDLES.map((h) => (
        <span key={h} className={`fo-imgbox__h fo-imgbox__h--${h}`} role="presentation" title={T.cmd.resizeImage} style={{ ...at(h), cursor: CURSORS[h] }} onPointerDown={startResize(h)} />
      ))}
      <span className="fo-imgbox__rot" role="presentation" title={T.cmd.rotateHandle} onPointerDown={startRotate} />
      <div className="fo-imgbox__bar" style={{ top: box.top < 40 ? box.height + 8 : -36 }}>
        {image.data.floating && (
          <button type="button" className="fo-imgbox__btn" title={T.cmd.moveImage} aria-label={T.cmd.moveImage} onPointerDown={startMove}>✥</button>
        )}
        <button type="button" className="fo-imgbox__btn" aria-haspopup="menu" aria-expanded={menu} title={T.cmd.wrapText} onClick={() => setMenu(!menu)}>
          <Icon name="text_wrap" size={16} /><span>{LABELS[cur]}</span>
        </button>
        {menu && (
          <div className="fo-imgbox__menu" role="menu">
            {IMAGE_WRAPS.map((m) => (
              <button key={m} type="button" role="menuitemradio" aria-checked={m === cur} className={m === cur ? 'is-on' : ''} onClick={() => { setMenu(false); onWrap(m); }}>{LABELS[m]}</button>
            ))}
          </div>
        )}
      </div>
      {ghost && view && guides(view, ghost.x)}
      {ghost && <div className="fo-imgbox__ghost" style={{ position: 'fixed', left: ghost.x - (box.width * s) / 2, top: ghost.y - (box.height * s) / 2, width: box.width * s, height: box.height * s }} />}
    </div>
  );
}

/** Reperes d'alignement pendant le deplacement : gauche, centre et droite de la zone de texte, le plus proche du pointeur en evidence. */
function guides(view: EditorView, x: number) {
  const r = view.dom.getBoundingClientRect();
  const lines = [r.left, r.left + r.width / 2, r.right];
  const near = lines.reduce((best, l, i) => (Math.abs(l - x) < Math.abs(lines[best]! - x) ? i : best), 0);
  return lines.map((l, i) => <div key={i} className={`fo-imgbox__guide${i === near ? ' is-near' : ''}`} style={{ left: l }} />);
}
