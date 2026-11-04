// Rendu en lecture d'une page (diapositive, disposition, masque, page de publication) : arriere-plan,
// formes d'arriere-plan, formes. Unites : 1 px CSS = 1 point ; `scale` agrandit l'ensemble.
import { memo, type CSSProperties, type ReactNode } from 'react';
import type { Fill, GroupShape, Shape } from '@forgeoffice/pptx';
import type { PageContext } from './context.ts';
import { center, type Box } from './math.ts';
import { boxOfXfrm, childToParent } from './ops.ts';
import { backgroundCss } from './render/paint.tsx';
import { ShapeView, type TextEditing } from './render/ShapeView.tsx';

export interface PageLayer {
  shapes: readonly Shape[];
  ctx: PageContext;
}

export interface PageViewProps {
  width: number;
  height: number;
  background: Fill | undefined;
  ctx: PageContext;
  shapes: readonly Shape[];
  /** Formes du masque et de la disposition dessinees sous la page. */
  underlay?: readonly PageLayer[];
  /** Prefixe unique des identifiants SVG (plusieurs pages dans le meme document). */
  uid: string;
  /** Agrandissement CSS (miniatures, zoom, diaporama). */
  scale?: number;
  /** Formes masquees (animations d'entree pas encore jouees, edition en cours d'une copie). */
  hidden?: ReadonlySet<number>;
  /** Edition de texte en cours. */
  editing?: { shapeId: number; text: TextEditing };
  /** Medias lisibles (diaporama). */
  interactive?: boolean;
  /** Cellules selectionnees du tableau en cours d'edition. */
  selectedCells?: { shapeId: number; r0: number; c0: number; r1: number; c1: number } | null;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

interface Walk {
  ctx: PageContext;
  uid: string;
  hidden?: ReadonlySet<number>;
  editing?: PageViewProps['editing'];
  interactive?: boolean;
  selectedCells?: PageViewProps['selectedCells'];
}

/** Rend une liste de formes (les groupes sont developpes dans le repere de la page). */
function renderShapes(shapes: readonly Shape[], w: Walk, frames: GroupShape[], groupFill?: Fill): ReactNode[] {
  const out: ReactNode[] = [];
  for (const raw of shapes) {
    if (raw.hidden) continue;
    const shape = w.ctx.resolve(raw);
    if (!shape.xfrm && shape.kind !== 'smartart' && shape.kind !== 'raw') continue;
    let box: Box | null = shape.xfrm ? boxOfXfrm(shape.xfrm) : null;
    for (const g of frames) if (box) box = childToParent(g, box);
    const key = `${w.uid}-${raw.id}`;
    const hide = w.hidden?.has(raw.id) ? { visibility: 'hidden' as const } : undefined;
    if (shape.kind === 'group' || shape.kind === 'smartart' || shape.kind === 'raw') {
      const kids = shape.kind === 'group' ? renderShapes(shape.children, w, [shape, ...frames], shape.fill ?? groupFill) : renderShapes(shape.fallback, w, frames);
      const c = box ? center(box) : { x: 0, y: 0 };
      out.push(
        <div key={key} data-shape-id={raw.id} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', transformOrigin: `${c.x}px ${c.y}px`, ...hide }}>
          {kids}
        </div>,
      );
      continue;
    }
    if (!box) continue;
    const prompt = w.ctx.prompt && raw.placeholder ? w.ctx.prompt(raw) : undefined;
    const editing = w.editing?.shapeId === raw.id ? w.editing.text : undefined;
    const cells = w.selectedCells?.shapeId === raw.id ? w.selectedCells : null;
    out.push(<ShapeView key={key} shape={shape} box={box} ctx={w.ctx} uid={key} groupFill={groupFill} prompt={prompt} editing={editing} interactive={w.interactive} selectedCells={cells} style={hide} />);
  }
  return out;
}

function PageViewImpl({ width, height, background, ctx, shapes, underlay, uid, scale = 1, hidden, editing, interactive, selectedCells, className, style, children }: PageViewProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: '0 0',
        ...backgroundCss(background, ctx),
        ...style,
      }}
      data-page=""
    >
      {underlay?.map((layer, i) => renderShapes(layer.shapes, { ctx: layer.ctx, uid: `${uid}u${i}` }, []))}
      {renderShapes(shapes, { ctx, uid, hidden, editing, interactive, selectedCells }, [])}
      {children}
    </div>
  );
}

/** Page rendue ; memorisee (les miniatures ne se redessinent que si leur diapositive change). */
export const PageView = memo(PageViewImpl);
