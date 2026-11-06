// Outil de rognage d'une image dans la page : l'image entiere est affichee estompee, le cadre (partie visible) a huit poignees,
// glisser dans le cadre deplace l'image derriere lui ; barre de proportions, zoom de l'image, Entree = valider, Echap = annuler.
import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@forgeoffice/ui';
import type { Picture } from '@forgeoffice/pptx';
import { isRenderableImage, locate, mediaUrl } from '@forgeoffice/powerpoint/canvas';
import { applyCrop, CROP_RATIOS, frameForRatio, fullRect, moveImage, resizeFrame, zoomImage, type CropHandle, type Rect } from '../crop.ts';
import { S } from '../strings.ts';
import type { Editor } from './editor.ts';

const HANDLES: readonly CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface CropOverlayProps {
  ed: Editor;
  pic: Picture;
  /** Element de la page : l'overlay y est place en pixels (points x `scale`). */
  pageEl: HTMLElement;
  scale: number;
}

export function CropOverlay({ ed, pic, pageEl, scale }: CropOverlayProps) {
  const xfrm = pic.xfrm as NonNullable<Picture['xfrm']>;
  const origin = useMemo<Rect>(() => ({ x: xfrm.x, y: xfrm.y, width: xfrm.width, height: xfrm.height }), [xfrm.x, xfrm.y, xfrm.width, xfrm.height]);
  const rotation = xfrm.rotation ?? 0;
  const [frame, setFrame] = useState<Rect>(origin);
  const [full, setFull] = useState<Rect>(() => fullRect(origin, pic.crop));
  const [ratio, setRatio] = useState<number | null>(null);
  const item = ed.ctx.media(pic.svgMediaId ?? pic.mediaId);
  const fallback = ed.ctx.media(pic.mediaId);
  const url = mediaUrl(isRenderableImage(item) ? item : fallback);

  const finish = (apply: boolean): void => {
    if (apply) {
      ed.editShapes((shapes) => {
        const found = locate(shapes, pic.id);
        if (found?.shape.kind === 'picture' && found.shape.xfrm) applyCrop(found.shape, frame, full, origin);
      }, 'crop');
    }
    ed.setUi({ crop: null });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  /** Glissement : delta ecran -> delta dans le repere de l'image (rotation inverse, echelle du zoom). */
  const drag = (kind: 'image' | CropHandle) => (e: ReactPointerEvent<HTMLElement>): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const sx = e.clientX;
    const sy = e.clientY;
    const base = { frame, full };
    const a = (-rotation * Math.PI) / 180;
    const move = (ev: PointerEvent): void => {
      const rx = (ev.clientX - sx) / scale;
      const ry = (ev.clientY - sy) / scale;
      const dx = rx * Math.cos(a) - ry * Math.sin(a);
      const dy = rx * Math.sin(a) + ry * Math.cos(a);
      if (kind === 'image') setFull(moveImage(base.frame, base.full, dx, dy));
      else setFrame(resizeFrame(base.frame, base.full, kind, dx, dy, ratio));
    };
    const up = (): void => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  const pickRatio = (r: number | null): void => {
    setRatio(r);
    if (r) setFrame(frameForRatio(frame, full, r));
  };
  const place = (r: Rect): { left: number; top: number; width: number; height: number } => ({ left: (r.x - origin.x) * scale, top: (r.y - origin.y) * scale, width: r.width * scale, height: r.height * scale });
  const toolbarTop = origin.y * scale > 52 ? origin.y * scale - 46 : (origin.y + origin.height) * scale + 8;
  const share = `${Math.round((frame.width / full.width) * 100)} %`;

  return createPortal(
    <div className="pub-crop" data-testid="crop-overlay" onPointerDown={() => finish(true)}>
      <div className="pub-crop__bar" style={{ left: Math.max(0, origin.x * scale), top: toolbarTop }} onPointerDown={(e) => e.stopPropagation()} role="toolbar" aria-label={S.crop.title}>
        {CROP_RATIOS.map((r) => (
          <button key={r.id} type="button" className={ratio === r.ratio ? 'is-on' : ''} onClick={() => pickRatio(r.ratio)} title={r.ratio ? S.crop.ratio(r.id) : S.crop.free} aria-pressed={ratio === r.ratio}>
            {r.ratio ? r.id : S.crop.free}
          </button>
        ))}
        <span className="pub-crop__sep" />
        <button type="button" onClick={() => setFull(zoomImage(frame, full, 1 / 1.1))} title={S.crop.zoomOut} aria-label={S.crop.zoomOut}>
          <Icon name="zoom_out" size={16} />
        </button>
        <button type="button" onClick={() => setFull(zoomImage(frame, full, 1.1))} title={S.crop.zoomIn} aria-label={S.crop.zoomIn}>
          <Icon name="zoom_in" size={16} />
        </button>
        <span className="pub-crop__sep" />
        <button type="button" className="is-primary" onClick={() => finish(true)} data-testid="crop-done">
          {S.crop.done}
        </button>
        <button type="button" onClick={() => finish(false)}>
          {S.crop.cancel}
        </button>
        <span className="pub-crop__info" aria-live="polite">{S.crop.info(Math.round(frame.width / 72 * 2.54 * 10) / 10, Math.round(frame.height / 72 * 2.54 * 10) / 10, share)}</span>
      </div>
      <div
        className="pub-crop__rot"
        style={{ left: origin.x * scale, top: origin.y * scale, width: origin.width * scale, height: origin.height * scale, transform: rotation ? `rotate(${rotation}deg)` : undefined }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {url && <img className="pub-crop__full" src={url} alt="" draggable={false} style={place(full)} />}
        <div className="pub-crop__frame" style={place(frame)} onPointerDown={drag('image')} data-testid="crop-frame" title={S.crop.moveHint}>
          <div className="pub-crop__clip">
            {url && <img src={url} alt="" draggable={false} style={{ left: (full.x - frame.x) * scale, top: (full.y - frame.y) * scale, width: full.width * scale, height: full.height * scale }} />}
          </div>
          {HANDLES.map((h) => (
            <span key={h} className={`pub-crop__h is-${h}`} data-handle={h} onPointerDown={drag(h)} />
          ))}
        </div>
      </div>
    </div>,
    pageEl,
  );
}
