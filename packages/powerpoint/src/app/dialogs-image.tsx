// Dialogue « Supprimer l'arriere-plan » : couleur de fond echantillonnee sur les bords (ou choisie dans l'image),
// tolerance, apercu sur damier, application en un seul pas annulable.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Checkbox, Dialog, NumberField } from '@forgeoffice/ui';
import { addMedia, type Picture } from '@forgeoffice/pptx';
import { locate } from '../canvas/ops.ts';
import { applyMask, backgroundMask, removedShare, sampleBackground, type RgbaImage, type Rgb } from './bg-remove.ts';
import { editPage } from './deck-ops.ts';
import type { Editor } from './editor.ts';
import { S2 } from '../strings2.ts';
import './dialogs.css';

const PREVIEW_MAX = 420;
const WORK_MAX = 2048;

/** Decode les octets d'une image en pixels, reduits a `max` pixels de cote au plus. */
async function decode(bytes: Uint8Array, type: string, max: number): Promise<RgbaImage> {
  const blob = new Blob([bytes.slice().buffer], { type });
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('canvas indisponible');
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const data = g.getImageData(0, 0, w, h);
  return { width: w, height: h, data: data.data };
}

async function encodePng(img: RgbaImage): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG impossible');
  return new Uint8Array(await blob.arrayBuffer());
}

const hex = (c: Rgb): string => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export function RemoveBackgroundDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const pic = ed.selectedShapes.find((s): s is Picture => s.kind === 'picture');
  const item = pic ? ed.ctx.media(pic.mediaId) : undefined;
  const [small, setSmall] = useState<RgbaImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(12);
  const [contiguous, setContiguous] = useState(true);
  const [color, setColor] = useState<Rgb | null>(null);
  const [picking, setPicking] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    if (!item) return;
    decode(item.bytes, item.contentType, PREVIEW_MAX).then(
      (img) => {
        if (!alive) return;
        setSmall(img);
        setColor(sampleBackground(img));
      },
      () => alive && setError(S2.removeBg.unreadable),
    );
    return () => {
      alive = false;
    };
  }, [item]);

  const mask = useMemo(() => (small && color ? backgroundMask(small, color, tolerance, contiguous) : null), [small, color, tolerance, contiguous]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !small || !mask) return;
    canvas.width = small.width;
    canvas.height = small.height;
    const g = canvas.getContext('2d');
    if (!g) return;
    const out = applyMask(small, mask);
    const tmp = document.createElement('canvas');
    tmp.width = small.width;
    tmp.height = small.height;
    tmp.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(out.data), out.width, out.height), 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(tmp, 0, 0);
  }, [small, mask]);

  const apply = async (): Promise<void> => {
    if (!pic || !item || !color) return;
    try {
      const full = await decode(item.bytes, item.contentType, WORK_MAX);
      const png = await encodePng(applyMask(full, backgroundMask(full, color, tolerance, contiguous)));
      const deck = { ...ed.deck, media: { ...ed.deck.media } };
      const mediaId = addMedia(deck, png, 'png', 'image/png');
      const next = editPage(deck, ed.page, (shapes) => {
        const found = locate(shapes, pic.id);
        if (found?.shape.kind === 'picture') {
          found.shape.mediaId = mediaId;
          delete found.shape.svgMediaId;
        }
      });
      ed.commit({ ...next, media: deck.media }, 'picture');
      onClose();
    } catch {
      setError(S2.removeBg.failed);
    }
  };

  const pick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!picking || !small) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(small.width - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * small.width)));
    const y = Math.min(small.height - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * small.height)));
    const i = (y * small.width + x) * 4;
    setColor([small.data[i] ?? 0, small.data[i + 1] ?? 0, small.data[i + 2] ?? 0]);
    setPicking(false);
  };

  const share = mask ? Math.round(removedShare(mask) * 100) : 0;
  return (
    <Dialog open title={S2.removeBg.title} onClose={onClose} onConfirm={() => void apply()} width={520} actions={[{ label: S2.removeBg.apply, primary: true, disabled: !mask, onClick: () => void apply() }, { label: S2.removeBg.cancel, onClick: onClose }]}>
      <div className="pp-stack">
        {error ? <p role="alert">{error}</p> : null}
        <div className="pp-checker" data-testid="removebg-preview">
          <canvas ref={canvasRef} onClick={pick} style={{ cursor: picking ? 'crosshair' : 'default' }} aria-label={S2.removeBg.preview} />
        </div>
        <div className="pp-form">
          <label>{S2.removeBg.color}</label>
          <div className="pp-form__row">
            <span className="pp-swatch" style={{ background: color ? hex(color) : 'transparent' }} data-testid="removebg-color" />
            <button type="button" className="pp-link-button" onClick={() => setPicking((v) => !v)} aria-pressed={picking}>{picking ? S2.removeBg.picking : S2.removeBg.pick}</button>
            <button type="button" className="pp-link-button" onClick={() => small && setColor(sampleBackground(small))}>{S2.removeBg.auto}</button>
          </div>
          <label>{S2.removeBg.tolerance}</label>
          <NumberField value={tolerance} min={0} max={80} step={1} unit="%" onChange={setTolerance} label={S2.removeBg.tolerance} />
        </div>
        <Checkbox label={S2.removeBg.contiguous} checked={contiguous} onChange={setContiguous} />
        <span className="pp-muted" data-testid="removebg-share">{S2.removeBg.share(share)}</span>
      </div>
    </Dialog>
  );
}
