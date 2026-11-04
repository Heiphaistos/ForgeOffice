// Objets flottants de la feuille (graphiques, images, formes) positionnes sur la grille, selectionnables,
// deplacables et redimensionnables a la souris.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Scalar } from '@forgeoffice/formulas';
import { formatValue } from '@forgeoffice/formulas';
import type { DrawingObject, ImageObject, Sheet } from '@forgeoffice/xlsx';
import { axisPos } from '../logic/geometry.ts';
import { resolveChart, type ReadRef } from '../logic/charts.ts';
import { colAt, colX, rowAt, rowY, type Viewport } from '../logic/viewport.ts';
import { ChartView } from './ChartView.tsx';
import { EMU_PX } from './actions.ts';

export interface Box { x: number; y: number; w: number; h: number }

/** Rectangle ecran d'un objet ancre. */
export function drawingBox(v: Viewport, d: DrawingObject): Box {
  const a = d.anchor;
  const z = v.zoom;
  if (a.type === 'absolute') return { x: v.headerW + (a.x / EMU_PX - axisPos(v.cols, 0) - v.scrollX) * z, y: v.headerH + (a.y / EMU_PX - v.scrollY) * z, w: (a.width / EMU_PX) * z, h: (a.height / EMU_PX) * z };
  const x = colX(v, a.from.col) + (a.from.colOffset / EMU_PX) * z;
  const y = rowY(v, a.from.row) + (a.from.rowOffset / EMU_PX) * z;
  if (a.type === 'oneCell') return { x, y, w: (a.width / EMU_PX) * z, h: (a.height / EMU_PX) * z };
  const x2 = colX(v, a.to.col) + (a.to.colOffset / EMU_PX) * z;
  const y2 = rowY(v, a.to.row) + (a.to.rowOffset / EMU_PX) * z;
  return { x, y, w: Math.max(8, x2 - x), h: Math.max(8, y2 - y) };
}

/** Nouvel ancrage (deux cellules) pour un rectangle ecran. */
export function anchorFor(v: Viewport, b: Box): DrawingObject['anchor'] {
  const point = (px: number, py: number) => {
    const col = Math.max(0, colAt(v, Math.max(v.headerW + 1, px)));
    const row = Math.max(0, rowAt(v, Math.max(v.headerH + 1, py)));
    return { col, colOffset: Math.max(0, Math.round(((px - colX(v, col)) / v.zoom) * EMU_PX)), row, rowOffset: Math.max(0, Math.round(((py - rowY(v, row)) / v.zoom) * EMU_PX)) };
  };
  return { type: 'twoCell', from: point(b.x, b.y), to: point(b.x + b.w, b.y + b.h) };
}

const urls = new WeakMap<ImageObject, string>();
function imageUrl(img: ImageObject): string {
  let u = urls.get(img);
  if (!u) {
    u = URL.createObjectURL(new Blob([img.data as BlobPart], { type: img.contentType }));
    urls.set(img, u);
  }
  return u;
}

export interface DrawingsProps {
  v: Viewport;
  sheet: Sheet;
  selected: number | null;
  onSelect: (i: number | null) => void;
  onMove: (i: number, anchor: DrawingObject['anchor']) => void;
  read: ReadRef;
  text: (v: Scalar) => string;
}

export function Drawings({ v, sheet, selected, onSelect, onMove, read, text }: DrawingsProps) {
  const [live, setLive] = useState<{ i: number; box: Box } | null>(null);
  const drag = useRef<{ i: number; mode: 'move' | 'se' | 'e' | 's'; x: number; y: number; box: Box } | null>(null);
  useEffect(() => {
    const up = (): void => {
      const d = drag.current;
      if (d && live) onMove(d.i, anchorFor(v, live.box));
      drag.current = null;
      setLive(null);
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [live, v, onMove]);
  const num = useMemo(() => (n: number) => formatValue(n, Number.isInteger(n) && Math.abs(n) >= 1000 ? '#,##0' : 'General', 'fr-FR'), []);
  return (
    <>
      {sheet.drawings.map((d, i) => {
        if (d.hidden) return null;
        const box = live?.i === i ? live.box : drawingBox(v, d);
        if (box.x > v.width || box.y > v.height || box.x + box.w < 0 || box.y + box.h < 0) return null;
        const start = (mode: 'move' | 'se' | 'e' | 's') => (e: React.PointerEvent): void => {
          e.stopPropagation();
          e.preventDefault();
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          onSelect(i);
          drag.current = { i, mode, x: e.clientX, y: e.clientY, box };
        };
        const move = (e: React.PointerEvent): void => {
          const g = drag.current;
          if (!g || g.i !== i) return;
          const dx = e.clientX - g.x;
          const dy = e.clientY - g.y;
          const b = g.box;
          const next = g.mode === 'move' ? { ...b, x: b.x + dx, y: b.y + dy }
            : { ...b, w: Math.max(40, b.w + (g.mode === 's' ? 0 : dx)), h: Math.max(30, b.h + (g.mode === 'e' ? 0 : dy)) };
          setLive({ i, box: next });
        };
        return (
          <div
            key={`${d.name}-${i}`}
            className={`xl-drawing${selected === i ? ' is-selected' : ''}`}
            style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            onPointerDown={start('move')}
            onPointerMove={move}
            role="img"
            aria-label={d.description ?? d.name}
          >
            {d.kind === 'chart' && <ChartView model={d.chart} data={resolveChart(d.chart, read, text)} width={box.w} height={box.h} num={num} />}
            {d.kind === 'image' && <img src={imageUrl(d)} alt={d.description ?? d.name} draggable={false} />}
            {d.kind === 'shape' && (
              <div className="xl-shape" style={{ background: d.fill?.none ? 'transparent' : `#${d.fill?.color ?? 'FFFFFF'}`, border: d.line?.none ? 'none' : `1px solid #${d.line?.color ?? '156082'}`, color: `#${d.textColor ?? '000000'}`, borderRadius: d.geometry === 'ellipse' ? '50%' : d.geometry === 'roundRect' ? 8 : 0 }}>
                {d.text}
              </div>
            )}
            {selected === i && (
              <>
                <span className="xl-handle xl-handle--se" onPointerDown={start('se')} />
                <span className="xl-handle xl-handle--e" onPointerDown={start('e')} />
                <span className="xl-handle xl-handle--s" onPointerDown={start('s')} />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
