// Barre d'objets flottante (tactile) au-dessus de la forme selectionnee : dupliquer, supprimer, premier plan, menu complet.
import { useLayoutEffect, useRef, type MouseEvent } from 'react';
import { Icon } from '@forgeoffice/ui';
import type { Shape } from '@forgeoffice/pptx';
import { boundsOf, unionRects, type Box } from './math.ts';
import { deleteShapes, duplicateShapes, reorder } from './ops.ts';
import type { CanvasSelection } from './types.ts';
import { S } from '../strings.ts';

export interface ObjectBarProps {
  boxes: readonly Box[];
  ids: readonly number[];
  /** Echelle page -> pixels et hauteur de la page en pixels. */
  scale: number;
  pageHeight: number;
  apply: (op: (draft: Shape[]) => void, group?: string) => void;
  onSelectionChange: (selection: CanvasSelection) => void;
  onMenu: (e: MouseEvent, shapeId: number | null) => void;
}

const BAR_H = 48;

export function ObjectBar({ boxes, ids, scale, pageHeight, apply, onSelectionChange, onMenu }: ObjectBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const u = unionRects(boxes.map(boundsOf));
  // La barre reste dans la zone visible, meme si la forme depasse de l'ecran.
  useLayoutEffect(() => {
    const el = ref.current;
    const view = el?.closest('.fo-canvas');
    if (!el || !view) return;
    el.style.setProperty('--fo-shift', '0px');
    const r = el.getBoundingClientRect();
    const v = view.getBoundingClientRect();
    const shift = r.left < v.left + 4 ? v.left + 4 - r.left : r.right > v.right - 4 ? v.right - 4 - r.right : 0;
    el.style.setProperty('--fo-shift', `${shift}px`);
  });
  if (!u) return null;
  const x = (u.x + u.width / 2) * scale;
  // Au-dessus de la forme ; en dessous si elle touche le haut de la page.
  const above = u.y * scale - BAR_H - 8 >= -BAR_H;
  const top = above ? u.y * scale - BAR_H - 8 : Math.min(pageHeight, (u.y + u.height) * scale + 8);
  const stop = (e: { stopPropagation: () => void }): void => e.stopPropagation();
  return (
    <div ref={ref} className="fo-objbar" role="toolbar" aria-label={S.canvas.objectBar} style={{ left: x, top }} onPointerDown={stop} onPointerUp={stop} onContextMenu={stop}>
      <button
        type="button"
        aria-label={S.canvas.duplicate}
        onClick={() => {
          let created: number[] = [];
          apply((d) => { created = duplicateShapes(d, ids, { x: 18, y: 18 }); }, 'duplicate');
          if (created.length) onSelectionChange({ ids: created, text: null, cells: null });
        }}
      >
        <Icon name="copy" size={22} />
      </button>
      <button type="button" aria-label={S.canvas.bringFront} onClick={() => apply((d) => reorder(d, ids, 'front'), 'order')}><Icon name="arrow_up" size={22} /></button>
      <button
        type="button"
        aria-label={S.canvas.deleteShape}
        onClick={() => {
          apply((d) => deleteShapes(d, ids), 'delete');
          onSelectionChange({ ids: [], text: null, cells: null });
        }}
      >
        <Icon name="delete" size={22} />
      </button>
      <button type="button" aria-label={S.canvas.moreActions} onClick={(e) => onMenu(e, ids[0] ?? null)}><Icon name="more_horizontal" size={22} /></button>
    </div>
  );
}
