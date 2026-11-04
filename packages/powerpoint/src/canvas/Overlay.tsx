// Calque de selection en coordonnees ecran : contours, poignees de taille, rotation, ajustement, extremites de ligne,
// reperes intelligents, lasso. Les poignees portent data-handle (lu par l'editeur au clic).
import type { CSSProperties } from 'react';
import type { Shape } from '@forgeoffice/pptx';
import { lineEnds } from './connectors.ts';
import { buildGeometry, LINE_PRESETS } from './geometry/index.ts';
import { fromLocal, HANDLES, handlePoint, type Box, type GuideLine, type Point, type Rect } from './math.ts';
import { S } from '../strings.ts';

export interface OverlayItem {
  id: number;
  shape: Shape;
  box: Box;
}

export const isLineShape = (shape: Shape): boolean =>
  shape.kind === 'connector' || (shape.kind === 'shape' && shape.geometry.type === 'preset' && LINE_PRESETS.has(shape.geometry.preset) && !shape.text?.paragraphs.some((p) => p.runs.length));

/** Points des poignees d'ajustement (jaunes) dans la page. */
export function adjustPoints(item: OverlayItem): Point[] {
  const shape = item.shape;
  if (!('geometry' in shape) || shape.kind === 'connector') return [];
  const geo = buildGeometry(shape.geometry, item.box.width, item.box.height);
  return geo.handles.map((h) => fromLocal(item.box, { x: item.box.flipH ? item.box.width - h.x : h.x, y: item.box.flipV ? item.box.height - h.y : h.y }));
}

const HANDLE = 9;

function Dot({ p, s, handle, cls, title }: { p: Point; s: number; handle: string; cls: string; title?: string }) {
  return <div className={`fo-ov__h ${cls}`} data-handle={handle} title={title} style={{ left: p.x * s - HANDLE / 2, top: p.y * s - HANDLE / 2 }} />;
}

export interface OverlayProps {
  scale: number;
  items: readonly OverlayItem[];
  /** Texte en edition : contour pointille seulement. */
  editingId?: number | null;
  guides: readonly GuideLine[];
  marquee: Rect | null;
  /** Reperes de dessin. */
  guidesX: readonly number[];
  guidesY: readonly number[];
  page: { width: number; height: number };
  /** Contour de previsualisation (trace d'une forme). */
  draft?: Box | null;
  draftLine?: [Point, Point] | null;
  ink?: Point[] | null;
  inkStyle?: { color: string; width: number; highlighter?: boolean };
  locked?: boolean;
}

export function Overlay({ scale: s, items, editingId, guides, marquee, guidesX, guidesY, page, draft, draftLine, ink, inkStyle, locked }: OverlayProps) {
  const single = items.length === 1;
  return (
    <div className="fo-ov" style={{ width: page.width * s, height: page.height * s }}>
      {guidesX.map((x, i) => (
        <div key={`gx${i}`} className="fo-ov__guide is-v" data-guide={`x:${i}`} style={{ left: x * s - 3, top: -4000, height: 8000 + page.height * s }} title={S.canvas.guide} />
      ))}
      {guidesY.map((y, i) => (
        <div key={`gy${i}`} className="fo-ov__guide is-h" data-guide={`y:${i}`} style={{ top: y * s - 3, left: -4000, width: 8000 + page.width * s }} title={S.canvas.guide} />
      ))}
      {items.map((item) => {
        const b = item.box;
        const frame: CSSProperties = {
          left: b.x * s,
          top: b.y * s,
          width: Math.max(1, b.width * s),
          height: Math.max(1, b.height * s),
          transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
        };
        if (isLineShape(item.shape)) {
          const [a, e] = lineEnds(b);
          return (
            <div key={item.id}>
              {!locked && <Dot p={a} s={s} handle={`start:${item.id}`} cls="is-end" />}
              {!locked && <Dot p={e} s={s} handle={`end:${item.id}`} cls="is-end" />}
            </div>
          );
        }
        const editing = editingId === item.id;
        const rotate = handlePoint({ ...b, y: b.y - 22 / s, height: b.height + 22 / s }, 'n');
        return (
          <div key={item.id}>
            <div className={`fo-ov__frame${editing ? ' is-editing' : ''}`} style={frame} />
            {!locked && (single || items.length <= 40) && (
              <>
                {HANDLES.map((h) => (
                  <Dot key={h} p={handlePoint(b, h)} s={s} handle={`${h}:${item.id}`} cls={`is-${h}`} />
                ))}
                {item.shape.kind !== 'table' && <Dot p={rotate} s={s} handle={`rot:${item.id}`} cls="is-rot" title={S.canvas.rotate} />}
                {single && adjustPoints(item).map((p, i) => <Dot key={`a${i}`} p={p} s={s} handle={`adj${i}:${item.id}`} cls="is-adj" />)}
              </>
            )}
          </div>
        );
      })}
      {guides.map((g, i) =>
        g.orientation === 'v' ? (
          <div key={`sg${i}`} className={`fo-ov__smart is-v${g.spacing ? ' is-spacing' : ''}`} style={{ left: g.at * s, top: g.from * s, height: (g.to - g.from) * s }} />
        ) : (
          <div key={`sg${i}`} className={`fo-ov__smart is-h${g.spacing ? ' is-spacing' : ''}`} style={{ top: g.at * s, left: g.from * s, width: (g.to - g.from) * s }} />
        ),
      )}
      {marquee && <div className="fo-ov__marquee" style={{ left: marquee.x * s, top: marquee.y * s, width: marquee.width * s, height: marquee.height * s }} />}
      {draft && <div className="fo-ov__draft" style={{ left: draft.x * s, top: draft.y * s, width: draft.width * s, height: draft.height * s }} />}
      {(draftLine || (ink && ink.length > 1)) && (
        <svg className="fo-ov__svg" width={page.width * s} height={page.height * s}>
          {draftLine && <line x1={draftLine[0].x * s} y1={draftLine[0].y * s} x2={draftLine[1].x * s} y2={draftLine[1].y * s} stroke="#444" strokeWidth={1} strokeDasharray="4 3" />}
          {ink && ink.length > 1 && (
            <polyline
              points={ink.map((p) => `${p.x * s},${p.y * s}`).join(' ')}
              fill="none"
              stroke={inkStyle?.color ?? '#000'}
              strokeOpacity={inkStyle?.highlighter ? 0.45 : 1}
              strokeWidth={(inkStyle?.width ?? 2) * s}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      )}
    </div>
  );
}
