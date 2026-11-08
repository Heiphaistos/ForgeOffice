// Rendu d'une forme effective a sa position dans la page : forme predefinie ou libre, image, tableau, graphique, media.
import { useState, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { Icon, type IconName } from '@forgeoffice/ui';
import type { Fill, Line, Paragraph, Picture, Shape, TableShape } from '@forgeoffice/pptx';
import { css, fontFamily, isRenderableImage, mediaUrl, type PageContext } from '../context.ts';
import { buildGeometry, LINE_PRESETS } from '../geometry/index.ts';
import { renderChart } from '../chart/index.ts';
import type { Box } from '../math.ts';
import { cellLook } from '../table-style.ts';
import { effectsCss, fillPaint, lineEndMarker, strokeOf } from './paint.tsx';
import { svgNodeToReact } from './svg-node.tsx';
import { TextBlock } from './TextBlock.tsx';

/** Edition de texte en cours sur cette forme (ou une cellule de ce tableau). */
export interface TextEditing {
  cell?: { row: number; col: number };
  flowProps: HTMLAttributes<HTMLDivElement>;
  flowRef: Ref<HTMLDivElement>;
  /** Change pour reconstruire la zone (apres une composition IME / touche morte). */
  flowKey?: number;
}

export interface ShapeViewProps {
  shape: Shape;
  box: Box;
  ctx: PageContext;
  /** Prefixe unique des definitions SVG. */
  uid: string;
  groupFill?: Fill;
  /** Texte d'invite (espace reserve vide). */
  prompt?: Paragraph[];
  editing?: TextEditing;
  /** Diaporama : medias lisibles. */
  interactive?: boolean;
  /** Cellules selectionnees d'un tableau (surlignage). */
  selectedCells?: { r0: number; c0: number; r1: number; c1: number } | null;
  style?: CSSProperties;
}

function flipTransform(box: Box): string | undefined {
  if (!box.flipH && !box.flipV) return undefined;
  return `translate(${box.flipH ? box.width : 0} ${box.flipV ? box.height : 0}) scale(${box.flipH ? -1 : 1} ${box.flipV ? -1 : 1})`;
}

function GeometrySvg({ shape, box, ctx, uid, groupFill, fill, line }: { shape: Shape & { geometry: import('@forgeoffice/pptx').Geometry }; box: Box; ctx: PageContext; uid: string; groupFill?: Fill; fill?: Fill; line?: Line }) {
  const geo = buildGeometry(shape.geometry, box.width, box.height);
  const isLine = shape.geometry.type === 'preset' && LINE_PRESETS.has(shape.geometry.preset);
  const paint = fillPaint(isLine ? undefined : fill, ctx, `${uid}f`, groupFill);
  const stroke = strokeOf(line, ctx, `${uid}s`);
  const markers: ReactNode[] = [];
  let markerStart: string | undefined;
  let markerEnd: string | undefined;
  if (stroke && line) {
    const color = stroke.paint.value.startsWith('url') ? '#000' : stroke.paint.value;
    const head = lineEndMarker(line.head, color, stroke.width, `${uid}h`, true);
    const tail = lineEndMarker(line.tail, color, stroke.width, `${uid}t`, false);
    if (head) {
      markers.push(head);
      markerStart = `url(#${uid}h)`;
    }
    if (tail) {
      markers.push(tail);
      markerEnd = `url(#${uid}t)`;
    }
  }
  const shade: Record<string, number> = { darken: 0.4, darkenLess: 0.2, lighten: -0.4, lightenLess: -0.2 };
  return (
    <svg width={Math.max(box.width, 0.01)} height={Math.max(box.height, 0.01)} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
      <defs>
        {paint.defs}
        {stroke?.paint.defs}
        {markers}
      </defs>
      <g transform={flipTransform(box)}>
        {geo.paths.map((p, i) => {
          const tone = shade[p.fill];
          return (
            <g key={i}>
              {p.fill !== 'none' && paint.value !== 'none' && <path d={p.d} fill={paint.value} stroke="none" />}
              {tone !== undefined && p.fill !== 'none' && paint.value !== 'none' && <path d={p.d} fill={tone > 0 ? '#000' : '#fff'} fillOpacity={Math.abs(tone)} stroke="none" />}
              {p.stroke && stroke && (
                <path
                  d={p.d}
                  fill="none"
                  stroke={stroke.paint.value}
                  strokeWidth={stroke.width}
                  strokeDasharray={stroke.dasharray}
                  strokeLinecap={stroke.linecap}
                  strokeLinejoin={stroke.linejoin}
                  markerStart={markerStart}
                  markerEnd={markerEnd}
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function PictureSvg({ shape, box, ctx, uid }: { shape: Picture; box: Box; ctx: PageContext; uid: string }) {
  const geo = buildGeometry(shape.geometry, box.width, box.height);
  const item = ctx.media(shape.svgMediaId ?? shape.mediaId);
  const fallback = ctx.media(shape.mediaId);
  const usable = isRenderableImage(item) ? item : isRenderableImage(fallback) ? fallback : undefined;
  const href = mediaUrl(usable);
  const crop = shape.crop ?? { left: 0, top: 0, right: 0, bottom: 0 };
  const fw = 1 - (crop.left + crop.right) / 100 || 1;
  const fh = 1 - (crop.top + crop.bottom) / 100 || 1;
  const iw = box.width / fw;
  const ih = box.height / fh;
  const fx = shape.imageEffects ?? {};
  const filters: string[] = [];
  if (fx.grayscale) filters.push('grayscale(1)');
  if (fx.brightness) filters.push(`brightness(${1 + fx.brightness / 100})`);
  if (fx.contrast) filters.push(`contrast(${1 + fx.contrast / 100})`);
  if (fx.duotone) filters.push('grayscale(1) sepia(0.6)');
  const stroke = strokeOf(shape.line, ctx, `${uid}s`);
  return (
    <svg width={Math.max(box.width, 0.01)} height={Math.max(box.height, 0.01)} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
      <defs>
        <clipPath id={`${uid}c`}>
          {geo.paths.map((p, i) => (
            <path key={i} d={p.d} />
          ))}
        </clipPath>
        {stroke?.paint.defs}
      </defs>
      <g clipPath={`url(#${uid}c)`}>
        {href ? (
          <g transform={flipTransform(box)}>
            <image
              href={href}
              x={(-crop.left / 100) * iw}
              y={(-crop.top / 100) * ih}
              width={iw}
              height={ih}
              preserveAspectRatio="none"
              opacity={fx.alpha === undefined ? undefined : fx.alpha / 100}
              style={filters.length ? { filter: filters.join(' ') } : undefined}
            />
          </g>
        ) : (
          <rect width={box.width} height={box.height} fill="#E7E6E6" />
        )}
      </g>
      {stroke && geo.paths.map((p, i) => <path key={i} d={p.d} fill="none" stroke={stroke.paint.value} strokeWidth={stroke.width} strokeDasharray={stroke.dasharray} />)}
    </svg>
  );
}

function TableView({ shape, box, ctx, editing, selectedCells }: { shape: TableShape; box: Box; ctx: PageContext; editing?: TextEditing; selectedCells?: ShapeViewProps['selectedCells'] }) {
  const t = shape.table;
  const total = t.columns.reduce((a, b) => a + b, 0) || 1;
  const sx = box.width / total;
  return (
    <table style={{ position: 'absolute', left: 0, top: 0, width: box.width, borderCollapse: 'collapse', tableLayout: 'fixed' }} data-table="">
      <colgroup>
        {t.columns.map((w, i) => (
          <col key={i} style={{ width: w * sx }} />
        ))}
      </colgroup>
      <tbody>
        {t.rows.map((row, r) => (
          <tr key={r} style={{ height: row.height }}>
            {row.cells.map((cell, c) => {
              if (cell.hMerge || cell.vMerge) return null;
              const look = cellLook(t, r, c);
              const fill = cell.fill ?? look.fill;
              const bg = fill?.type === 'solid' ? css(ctx, fill.color) : undefined;
              const border = (l: Line | undefined): string | undefined => {
                if (!l?.fill || l.fill.type !== 'solid') return l?.fill?.type === 'none' ? 'none' : undefined;
                return `${l.width ?? 1}px solid ${css(ctx, l.fill.color)}`;
              };
              const b = cell.borders ?? {};
              const m = { left: 7.2, right: 7.2, top: 3.6, bottom: 3.6, ...(cell.margins ?? {}) };
              const body = {
                ...cell.text,
                paragraphs: cell.text.paragraphs.map((p) => ({
                  ...p,
                  runs: p.runs.map((run) => ({ ...run, props: { size: 18, ...(look.color ? { color: look.color } : {}), ...(look.bold ? { bold: true } : {}), ...run.props } })),
                  endProps: { size: 18, ...(look.color ? { color: look.color } : {}), ...(look.bold ? { bold: true } : {}), ...(p.endProps ?? {}) },
                })),
                props: { ...cell.text.props, insets: { left: m.left, right: m.right, top: m.top, bottom: m.bottom }, anchor: cell.anchor ?? 't' },
              };
              const editingHere = editing?.cell && editing.cell.row === r && editing.cell.col === c;
              const inSel = selectedCells && r >= selectedCells.r0 && r <= selectedCells.r1 && c >= selectedCells.c0 && c <= selectedCells.c1;
              const height = row.height;
              return (
                <td
                  key={c}
                  colSpan={cell.gridSpan}
                  rowSpan={cell.rowSpan}
                  data-cell={`${r}:${c}`}
                  style={{
                    background: bg,
                    borderLeft: border(b.left ?? look.left),
                    borderRight: border(b.right ?? look.right),
                    borderTop: border(b.top ?? look.top),
                    borderBottom: border(b.bottom ?? look.bottom),
                    padding: 0,
                    position: 'relative',
                    verticalAlign: 'top',
                    boxShadow: inSel ? 'inset 0 0 0 999px rgba(0, 0, 0, 0.12)' : undefined,
                  }}
                >
                  <TextBlock
                      inline
                      body={body}
                      ctx={ctx}
                      rect={{ x: 0, y: 0, width: (t.columns.slice(c, c + (cell.gridSpan ?? 1)).reduce((a, w) => a + w, 0)) * sx, height }}
                      editing={!!editingHere}
                      flowProps={editingHere ? editing?.flowProps : undefined}
                      flowRef={editingHere ? editing?.flowRef : undefined}
                      flowKey={editingHere ? editing?.flowKey : undefined}
                      className="fo-cell-text"
                    />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Icone affichee au centre des espaces reserves de contenu vides. */
const PLACEHOLDER_ICONS: Readonly<Partial<Record<string, IconName>>> = { pic: 'image', chart: 'chart_multiple', tbl: 'table', media: 'video', dgm: 'flow', clipArt: 'image' };

function MediaView({ shape, box, ctx, interactive }: { shape: Extract<Shape, { kind: 'media' }>; box: Box; ctx: PageContext; interactive?: boolean }) {
  const source = shape.mediaId ? mediaUrl(ctx.media(shape.mediaId)) : undefined;
  const poster = shape.posterMediaId ? mediaUrl(ctx.media(shape.posterMediaId)) : undefined;
  const pb = shape.playback;
  const [playing, setPlaying] = useState(false);
  const fill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
  if (interactive && source) {
    // Lecture : volume, demarrage automatique, boucle ; « masquer » cache l'icone audio, et la video tant qu'elle ne joue pas.
    const common = {
      src: source,
      controls: true,
      autoPlay: !!pb?.auto,
      loop: !!pb?.loop,
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      ref: (el: HTMLMediaElement | null) => {
        if (el) el.volume = Math.max(0, Math.min(1, (pb?.volume ?? 100) / 100));
      },
    };
    const hidden = !!pb?.hideInShow && (shape.mediaType === 'audio' || !playing);
    return shape.mediaType === 'video' ? (
      <video {...common} poster={poster} style={{ ...fill, objectFit: 'contain', background: '#000', visibility: hidden ? 'hidden' : undefined }} />
    ) : (
      <audio {...common} style={{ ...fill, height: 'auto', top: '50%', visibility: hidden ? 'hidden' : undefined }} />
    );
  }
  return (
    <div style={{ ...fill, background: poster ? `center / cover no-repeat url("${poster}")` : shape.mediaType === 'video' ? '#1F1F1F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: shape.mediaType === 'video' ? '#fff' : css(ctx, { type: 'scheme', value: 'accent1' }) }}>
      <Icon name={shape.mediaType === 'video' ? 'video' : 'speaker_2'} size={Math.max(16, Math.min(box.width, box.height) * 0.4)} />
    </div>
  );
}

/** Une forme a sa position (rotation comprise). Les groupes et rendus de repli sont developpes par PageView. */
export function ShapeView({ shape, box, ctx, uid, groupFill, prompt, editing, interactive, selectedCells, style }: ShapeViewProps) {
  const outer: CSSProperties = {
    position: 'absolute',
    left: box.x,
    top: box.y,
    width: Math.max(0, box.width),
    height: Math.max(0, box.height),
    transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
    ...('effects' in shape ? effectsCss(shape.effects, ctx) : {}),
    ...style,
  };
  const emptyPlaceholder = !!prompt && !editing && shape.kind === 'shape' && !shape.text?.paragraphs.some((p) => p.runs.some((r) => r.type !== 'text' || r.text));
  if (emptyPlaceholder) outer.outline = '1px dashed rgba(0, 0, 0, 0.35)';
  const placeholderIcon = shape.kind === 'shape' && shape.placeholder ? PLACEHOLDER_ICONS[shape.placeholder.type] : undefined;
  const showIcon = !!placeholderIcon && !editing && (emptyPlaceholder || !!ctx.placeholderIcons);
  let content: ReactNode = null;
  switch (shape.kind) {
    case 'shape':
    case 'connector':
      content = (
        <>
          <GeometrySvg shape={shape} box={box} ctx={ctx} uid={uid} groupFill={groupFill} fill={shape.kind === 'shape' ? shape.fill : undefined} line={shape.line} />
          {showIcon && placeholderIcon && (
            <div aria-hidden data-placeholder-icon="" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: 'rgba(0, 0, 0, 0.35)' }}>
              <Icon name={placeholderIcon} size={Math.max(16, Math.min(64, Math.min(box.width, box.height) * 0.35))} />
            </div>
          )}
          {shape.kind === 'shape' && (shape.text || prompt) && (
            <TextBlock
              body={shape.text ?? { props: {}, paragraphs: [] }}
              ctx={ctx}
              rect={buildGeometry(shape.geometry, box.width, box.height).textRect}
              prompt={prompt}
              wrapFloats={ctx.wrapFloats?.(shape)}
              editing={!!editing}
              flowProps={editing?.flowProps}
              flowRef={editing?.flowRef}
              flowKey={editing?.flowKey}
            />
          )}
        </>
      );
      break;
    case 'picture':
      content = <PictureSvg shape={shape} box={box} ctx={ctx} uid={uid} />;
      break;
    case 'table':
      content = <TableView shape={shape} box={box} ctx={ctx} editing={editing} selectedCells={selectedCells} />;
      break;
    case 'chart':
      content = svgNodeToReact(renderChart(shape.chart, box.width, box.height, { color: (c) => css(ctx, c) ?? '#000', fontFamily: fontFamily(ctx, undefined) }));
      break;
    case 'media':
      content = <MediaView shape={shape} box={box} ctx={ctx} interactive={interactive} />;
      break;
    default:
      content = null;
  }
  return (
    <div style={outer} data-shape-id={shape.id}>
      {content}
    </div>
  );
}
