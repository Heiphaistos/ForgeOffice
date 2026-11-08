// Boîte « Couleurs » : spectre (saturation / valeur) et teinte, valeurs RVB, TSL et hexadécimale, pipette (API EyeDropper).
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, Dialog, NumberField, TextField } from '@forgeoffice/ui';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import { hslToRgb, hsvToRgb, parseHex, rgbToHsl, rgbToHsv, toHex, type Hsv, type Rgb } from './color-model.ts';

interface EyeDropperLike {
  open(): Promise<{ sRGBHex: string }>;
}
type EyeDropperCtor = new () => EyeDropperLike;
const eyeDropper = (): EyeDropperCtor | undefined => (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

export interface ColorDialogProps {
  /** Couleur de depart (#RRGGBB). */
  value: string;
  onPick: (hex: string) => void;
  onClose: () => void;
}

export function ColorDialog({ value, onPick, onClose }: ColorDialogProps) {
  const start = parseHex(value) ?? { r: 0, g: 0, b: 0 };
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(start));
  const [hexText, setHexText] = useState(toHex(start));
  const area = useRef<HTMLDivElement>(null);
  const C = S3.colors;
  const rgb = hsvToRgb(hsv);
  const hsl = rgbToHsl(rgb);
  const hex = toHex(rgb);
  const set = (next: Hsv): void => {
    setHsv(next);
    setHexText(toHex(hsvToRgb(next)));
  };
  const fromRgb = (c: Rgb): void => set({ ...rgbToHsv(c), h: rgbToHsv(c).s === 0 ? hsv.h : rgbToHsv(c).h });
  const drag = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const r = area.current?.getBoundingClientRect();
    if (!r) return;
    set({ h: hsv.h, s: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), v: Math.min(100, Math.max(0, (1 - (e.clientY - r.top) / r.height) * 100)) });
  };
  const pipette = async (): Promise<void> => {
    const Ctor = eyeDropper();
    if (!Ctor) return;
    try {
      const picked = await new Ctor().open();
      const c = parseHex(picked.sRGBHex);
      if (c) fromRgb(c);
    } catch (err) {
      if (!(err instanceof DOMException)) throw err; // annulation par l'utilisateur
    }
  };
  const ok = (): void => {
    onPick(hex);
    onClose();
  };
  return (
    <Dialog open title={C.title} onClose={onClose} onConfirm={ok} width={480} actions={[{ label: S.common.ok, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-stack" data-testid="color-dialog">
        <div className="pp-form__row" style={{ alignItems: 'stretch' }}>
          <div
            ref={area}
            data-testid="color-spectrum"
            role="slider"
            aria-label={C.spectrum}
            aria-valuetext={hex}
            tabIndex={0}
            style={{ position: 'relative', width: 220, height: 170, cursor: 'crosshair', borderRadius: 4, touchAction: 'none', background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))` }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag(e);
            }}
            onPointerMove={(e) => e.buttons === 1 && drag(e)}
          >
            <span style={{ position: 'absolute', left: `${hsv.s}%`, top: `${100 - hsv.v}%`, width: 12, height: 12, margin: -6, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px #000', pointerEvents: 'none' }} />
          </div>
          <input type="range" aria-label={C.hue} min={0} max={359} value={Math.round(hsv.h)} onChange={(e) => set({ ...hsv, h: Number(e.target.value) })} style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 170, width: 24, accentColor: hex }} data-testid="color-hue" />
          <div className="pp-stack" style={{ flex: 1 }}>
            <div style={{ display: 'flex', height: 48, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--fo-border)' }}>
              <div style={{ flex: 1, background: toHex(start) }} title={C.before} />
              <div style={{ flex: 1, background: hex }} title={C.after} data-testid="color-after" />
            </div>
            <TextField label={C.hex} value={hexText} onChange={(e) => { setHexText(e.target.value); const c = parseHex(e.target.value); if (c) fromRgb(c); }} data-testid="color-hex" />
            {eyeDropper() && <Button size="small" icon="color" onClick={() => void pipette()}>{C.eyedropper}</Button>}
          </div>
        </div>
        <div className="pp-form__row">
          <fieldset className="pp-group" style={{ flex: 1 }}>
            <legend>{C.rgb}</legend>
            <div className="pp-form">
              {(['r', 'g', 'b'] as const).map((k) => (
                <span key={k} style={{ display: 'contents' }}>
                  <label>{C.channels[k]}</label>
                  <NumberField value={rgb[k]} min={0} max={255} step={1} width={90} onChange={(v) => fromRgb({ ...rgb, [k]: v })} label={C.channels[k]} />
                </span>
              ))}
            </div>
          </fieldset>
          <fieldset className="pp-group" style={{ flex: 1 }}>
            <legend>{C.hsl}</legend>
            <div className="pp-form">
              <label>{C.hue}</label>
              <NumberField value={Math.round(hsl.h)} min={0} max={359} step={1} width={90} onChange={(v) => fromRgb(hslToRgb({ ...hsl, h: v }))} label={`${C.hue} (TSL)`} />
              <label>{C.saturation}</label>
              <NumberField value={Math.round(hsl.s)} min={0} max={100} step={1} width={90} onChange={(v) => fromRgb(hslToRgb({ ...hsl, s: v }))} label={C.saturation} />
              <label>{C.lightness}</label>
              <NumberField value={Math.round(hsl.l)} min={0} max={100} step={1} width={90} onChange={(v) => fromRgb(hslToRgb({ ...hsl, l: v }))} label={C.lightness} />
            </div>
          </fieldset>
        </div>
      </div>
    </Dialog>
  );
}
