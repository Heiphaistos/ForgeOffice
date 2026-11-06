// Poignees de l'image selectionnee, au doigt comme a la souris : coin bas-droit = redimensionner en gardant les proportions,
// poignee du haut = tourner par pas de 5 degres. Zone de toucher de 44 px autour d'une pastille visible de 16 px.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { rotationAngle } from '@forgeoffice/ui';
import type { Ctl } from '../app/types.ts';
import { updateAtom } from '../editor/commands.ts';
import { T } from '../strings.ts';

interface Box { left: number; top: number; width: number; height: number; clip: { left: number; top: number; right: number; bottom: number } }

export function ImageHandles({ c }: { c: Ctl }) {
  const img = c.sel.image;
  const [box, setBox] = useState<Box | null>(null);
  const drag = useRef<{ kind: 'size' | 'rotate'; x: number; y: number; w: number; h: number; ratio: number; cx: number; cy: number } | null>(null);
  const latest = useRef({ c, img });
  latest.current = { c, img };

  // Position de l'image a l'ecran : recalculee a chaque changement de selection, defilement ou redimensionnement.
  useLayoutEffect(() => {
    const measure = (): void => {
      const view = c.view();
      const dom = img && view ? view.nodeDOM(img.pos) : null;
      if (!(dom instanceof HTMLElement)) return setBox(null);
      const target = dom.matches('img') ? dom : (dom.querySelector('img') ?? dom);
      const r = target.getBoundingClientRect();
      // Les poignees ne depassent pas de la zone de la page (jamais par-dessus le ruban ni la barre d'etat).
      const area = (target.closest('.fo-word-canvas') ?? document.body).getBoundingClientRect();
      const clip = { left: area.left, top: area.top, right: area.right, bottom: area.bottom };
      setBox((prev) => (prev && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height && prev.clip.top === clip.top && prev.clip.bottom === clip.bottom ? prev : { left: r.left, top: r.top, width: r.width, height: r.height, clip }));
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  });
  useEffect(() => {
    if (!img) drag.current = null;
  }, [img]);

  if (!img || !box || box.width < 4) return null;
  const data = img.data;

  const start = (kind: 'size' | 'rotate') => (e: React.PointerEvent<HTMLElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind, x: e.clientX, y: e.clientY, w: data.width, h: data.height, ratio: data.width / Math.max(1, box.width), cx: box.left + box.width / 2, cy: box.top + box.height / 2 };
  };
  const move = (e: React.PointerEvent<HTMLElement>): void => {
    const d = drag.current;
    const cur = latest.current.img;
    if (!d || !cur) return;
    if (d.kind === 'size') {
      // La poignee suit le doigt : largeur en points = largeur de depart + deplacement horizontal converti par l'echelle de la page.
      const width = Math.max(12, d.w + (e.clientX - d.x) * d.ratio);
      latest.current.c.run(updateAtom(cur.pos, { ...cur.data, width, height: (width * d.h) / d.w }));
    } else {
      latest.current.c.run(updateAtom(cur.pos, { ...cur.data, rotation: rotationAngle(d.cx, d.cy, e.clientX, e.clientY, 5) || undefined }));
    }
  };
  const end = (): void => {
    drag.current = null;
  };
  const inside = (x: number, y: number): boolean => x >= box.clip.left && x <= box.clip.right && y >= box.clip.top && y <= box.clip.bottom;
  const dot = { width: 16, height: 16 } as const;
  const hit = (x: number, y: number): React.CSSProperties => ({ position: 'fixed', left: x - 22, top: y - 22, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', zIndex: 650, cursor: 'nwse-resize' });
  return (
    <div className="fo-imghandles" aria-hidden={false}>
      <div style={{ position: 'fixed', left: box.left, top: box.top, width: box.width, height: box.height, border: '1.5px solid var(--fo-accent)', pointerEvents: 'none', zIndex: 640, clipPath: `inset(${Math.max(0, box.clip.top - box.top)}px ${Math.max(0, box.left + box.width - box.clip.right)}px ${Math.max(0, box.top + box.height - box.clip.bottom)}px ${Math.max(0, box.clip.left - box.left)}px)` }} />
      {inside(box.left + box.width, box.top + box.height) && <div role="slider" aria-label={T.cmd.resizePicture} data-handle="size" style={hit(box.left + box.width, box.top + box.height)} onPointerDown={start('size')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <span style={{ ...dot, borderRadius: '50%', background: 'var(--fo-accent)', border: '2px solid #fff', boxShadow: '0 0 0 1px var(--fo-accent)' }} />
      </div>}
      {inside(box.left + box.width / 2, box.top - 30) && <div role="slider" aria-label={T.cmd.rotatePicture} data-handle="rotate" style={{ ...hit(box.left + box.width / 2, box.top - 30), cursor: 'grab' }} onPointerDown={start('rotate')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <span style={{ ...dot, borderRadius: '50%', background: '#fff', border: '2px solid var(--fo-accent)' }} />
      </div>}
    </div>
  );
}
