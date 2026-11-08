// Objets flottants de la feuille (graphiques, images, formes) positionnes sur la grille, selectionnables,
// deplacables et redimensionnables a la souris.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MenuItem } from '@forgeoffice/ui';
import type { Scalar } from '@forgeoffice/formulas';
import { formatValue } from '@forgeoffice/formulas';
import type { DrawingObject, ImageObject, Sheet, ShapeObject } from '@forgeoffice/xlsx';
import { axisPos } from '../logic/geometry.ts';
import { resolveChart, type ReadRef } from '../logic/charts.ts';
import { colAt, colX, rowAt, rowY, type Viewport } from '../logic/viewport.ts';
import { ChartView } from './ChartView.tsx';
import { EMU_PX } from './actions.ts';
import { HANDLES, SHAPES, resizeBox, rotationFrom, type Handle } from '../logic/shapes.ts';
import { S } from '../strings/index.ts';

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
  /** Texte saisi dans une forme (double-clic). */
  onText: (i: number, text: string) => void;
  /** Rotation libre (degres) d'un objet, validee a la fin du geste. */
  onRotate: (i: number, degrees: number) => void;
  /** Entrees du menu contextuel d'un objet (en plus de « Modifier le texte » des formes) ; ouverture du menu. */
  menu: (i: number) => MenuItem[];
  /** Double-clic sur le titre du graphique ou d'un axe : edition du texte (cible `title`, `left` ou `bottom`). */
  onChartText: (i: number, target: 'title' | 'left' | 'bottom') => void;
  openMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[]) => void;
  read: ReadRef;
  text: (v: Scalar) => string;
}

export function Drawings({ v, sheet, selected, onSelect, onMove, onText, onRotate, menu, openMenu, onChartText, read, text }: DrawingsProps) {
  const [typing, setTyping] = useState<number | null>(null);
  const [turning, setTurning] = useState<{ i: number; deg: number } | null>(null);
  const [live, setLive] = useState<{ i: number; box: Box } | null>(null);
  // Rotation libre : suivi par ecouteurs de fenetre (la capture du pointeur est levee par le re-rendu de la poignee).
  const turningRef = useRef(turning);
  turningRef.current = turning;
  const turningOn = turning !== null;
  useEffect(() => {
    if (!turningOn) return undefined;
    const move = (e: PointerEvent): void => {
      const cur = turningRef.current;
      const host = document.querySelector('.xl-drawing.is-selected')?.getBoundingClientRect();
      if (cur && host) setTurning({ i: cur.i, deg: rotationFrom({ x: host.x + host.width / 2, y: host.y + host.height / 2 }, { x: e.clientX, y: e.clientY }, e.shiftKey ? 15 : 0) });
    };
    const up = (): void => {
      const cur = turningRef.current;
      if (cur) onRotate(cur.i, cur.deg);
      setTurning(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [turningOn, onRotate]);
  const drag = useRef<{ i: number; mode: 'move' | Handle; x: number; y: number; box: Box } | null>(null);
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
        const start = (mode: 'move' | Handle) => (e: React.PointerEvent): void => {
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
          const next = g.mode === 'move' ? { ...b, x: b.x + dx, y: b.y + dy } : resizeBox(b, g.mode, dx, dy);
          setLive({ i, box: next });
        };
        return (
          <div
            key={`${d.name}-${i}`}
            className={`xl-drawing${selected === i ? ' is-selected' : ''}`}
            style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            onPointerDown={start('move')}
            onPointerMove={move}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(i);
              openMenu(e, [...(d.kind === 'shape' && !d.connector ? [{ id: 'edit', label: S.shapes.editText, onClick: () => setTyping(i) }] : []), ...menu(i)]);
            }}
            onDoubleClick={(e) => {
              // La capture du pointeur redirige le double-clic vers l'objet : on retrouve l'element du graphique par sa position.
              const part = d.kind === 'chart' ? document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.hasAttribute('data-chart-text'))?.getAttribute('data-chart-text') : null;
              if (part === 'title' || part === 'left' || part === 'bottom') onChartText(i, part);
              else if (d.kind === 'shape' && !d.connector) setTyping(i);
            }}
            role="img"
            aria-label={d.description ?? d.name}
          >
            {d.kind === 'chart' && <ChartView model={d.chart} data={resolveChart(d.chart, read, text)} width={box.w} height={box.h} num={num} />}
            {d.kind === 'image' && <img src={imageUrl(d)} alt={d.description ?? d.name} draggable={false} />}
            {d.kind === 'shape' && (
              <div className="xl-shape" style={{ color: `#${d.textColor ?? '000000'}`, fontSize: (d.fontSize ?? 11) * v.zoom, ...((turning?.i === i ? turning.deg : d.rotation) ? { transform: `rotate(${turning?.i === i ? turning.deg : d.rotation}deg)` } : {}) }}>
                <ShapeArt shape={d} />
                {typing === i ? (
                  <textarea className="xl-shape__edit" autoFocus defaultValue={d.text ?? ''} aria-label={S.shapes.textBoxHint}
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={(e) => { onText(i, e.target.value); setTyping(null); }}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setTyping(null); }} />
                ) : <span className="xl-shape__text">{d.text}</span>}
              </div>
            )}
            {selected === i && (
              <>
                {HANDLES.map((h) => <span key={h} className={`xl-handle xl-handle--${h}`} onPointerDown={start(h)} />)}
                {d.kind === 'shape' && (
                  <span className="xl-handle xl-handle--rot" aria-label={S.shapeFmt.rotateFree}
                    onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); setTurning({ i, deg: d.rotation ?? 0 }); }} />
                )}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

/** Trace SVG d'une forme (polygone, ovale, rectangle, ligne) ; epaisseur de trait constante a l'echelle. */
function ShapeArt({ shape }: { shape: ShapeObject }) {
  const fill = shape.fill?.none ? 'none' : `#${shape.fill?.color ?? 'FFFFFF'}`;
  const stroke = shape.line?.none ? 'none' : `#${shape.line?.color ?? '156082'}`;
  const common = { fill, stroke, strokeWidth: shape.line?.width ?? 1, vectorEffect: 'non-scaling-stroke' as const };
  const points = SHAPES.find((s) => s.id === shape.geometry)?.points;
  return (
    <svg className="xl-shape__art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {shape.geometry === 'line' || shape.connector ? <line x1="0" y1="50" x2="100" y2="50" {...common} />
        : shape.geometry === 'ellipse' ? <ellipse cx="50" cy="50" rx="50" ry="50" {...common} />
          : points ? <polygon points={points} {...common} />
            : <rect x="0" y="0" width="100" height="100" rx={shape.geometry === 'roundRect' ? 12 : 0} {...common} />}
    </svg>
  );
}
