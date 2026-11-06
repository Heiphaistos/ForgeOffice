// Onglet Remplissage : couleur d'arriere-plan (palette + autres couleurs), couleur et style de motif, effets de remplissage (degrade).
import { useEffect, useRef, useState } from 'react';
import { Button, ColorPalette, ColorPicker, Dialog, shade } from '@forgeoffice/ui';
import type { Color, Fill, Workbook } from '@forgeoffice/xlsx';
import { GRADIENT_KINDS, PATTERNS, buildGradient, joinFill, resolveFill, splitFill, type GradientKind } from '../../../logic/fill-spec.ts';
import { FC } from '../../../strings/index.ts';
import { paintFill } from '../../paint-fill.ts';
import { colorHex, hexColor, type FormatCtx } from './state.ts';

const hexOf = (wb: Workbook) => (c: Color | undefined, fallback: string): string => colorHex(wb, c) ?? fallback;

/** Apercu d'un remplissage (plat, motif ou degrade). */
export function FillPreview({ fill, wb, width = 120, height = 60, label }: { fill: Fill; wb: Workbook; width?: number; height?: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    const hex = hexOf(wb);
    const special = resolveFill(fill, hex);
    if (special) paintFill(ctx, special, 0, 0, width, height);
    else if (fill.type === 'pattern' && fill.pattern === 'solid') {
      ctx.fillStyle = hex(fill.fg, '#FFFFFF');
      ctx.fillRect(0, 0, width, height);
    }
  }, [fill, wb, width, height]);
  return <canvas ref={ref} width={width} height={height} className="xl-fc-fillprev" role="img" aria-label={label ?? FC.sample} style={{ width, height }} />;
}

function GradientDialog({ f, onApply, onClose }: { f: FormatCtx; onApply: (fill: Fill) => void; onClose: () => void }) {
  const current = f.get('fill');
  const first = current.type === 'gradient' ? current.stops[0]?.color : undefined;
  const last = current.type === 'gradient' ? current.stops[current.stops.length - 1]?.color : undefined;
  const [c1, setC1] = useState<string>(colorHex(f.wb, first) ?? '#FFFFFF');
  const [c2, setC2] = useState<string>(colorHex(f.wb, last) ?? '#4472C4');
  const [two, setTwo] = useState(true);
  const [tone, setTone] = useState(0.5);
  const [kind, setKind] = useState<GradientKind>('horizontal');
  const [variant, setVariant] = useState(1);
  const second = two ? c2 : shade(c1, tone - 0.5);
  const make = (k: GradientKind, v: number): Fill => buildGradient(k, v, hexColor(c1), hexColor(second));
  return (
    <Dialog open title={FC.gradientTitle} onClose={onClose} onConfirm={() => onApply(make(kind, variant))} width={520}>
      <div className="xl-fc-grad">
        <div>
          <fieldset className="xl-fs">
            <legend>{FC.gradientColors}</legend>
            <label className="xl-radio"><input type="radio" name="gm" checked={!two} onChange={() => setTwo(false)} />{FC.gradientOne}</label>
            <label className="xl-radio"><input type="radio" name="gm" checked={two} onChange={() => setTwo(true)} />{FC.gradientTwo}</label>
            <div className="xl-form">
              <label>{FC.gradientColor1}</label>
              <ColorPicker label={FC.gradientColor1} showLabel value={c1} onChange={(c) => c && setC1(c)} />
              {two ? (
                <>
                  <label>{FC.gradientColor2}</label>
                  <ColorPicker label={FC.gradientColor2} showLabel value={c2} onChange={(c) => c && setC2(c)} />
                </>
              ) : (
                <>
                  <label htmlFor="fc-tone">{FC.gradientColor2}</label>
                  <input id="fc-tone" type="range" min={0} max={1} step={0.05} value={tone} onChange={(e) => setTone(Number(e.target.value))} />
                </>
              )}
            </div>
          </fieldset>
          <fieldset className="xl-fs">
            <legend>{FC.gradientStyles}</legend>
            {GRADIENT_KINDS.map((k) => <label key={k} className="xl-radio"><input type="radio" name="gk" checked={kind === k} onChange={() => setKind(k)} />{FC.gradientKinds[k]}</label>)}
          </fieldset>
        </div>
        <div>
          <fieldset className="xl-fs">
            <legend>{FC.gradientVariants}</legend>
            <div className="xl-fc-variants">
              {[1, 2, 3, 4].map((v) => (
                <button key={v} type="button" className={variant === v ? 'is-active' : ''} aria-pressed={variant === v} aria-label={`${FC.variant} ${v}`} onClick={() => setVariant(v)}>
                  <FillPreview fill={make(kind, v)} wb={f.wb} width={96} height={48} label={`${FC.variant} ${v}`} />
                </button>
              ))}
            </div>
          </fieldset>
          <label className="xl-fc-label">{FC.sample}</label>
          <FillPreview fill={make(kind, variant)} wb={f.wb} width={216} height={64} />
        </div>
      </div>
    </Dialog>
  );
}

export function FillTab({ f }: { f: FormatCtx }) {
  const fill = f.get('fill');
  const parts = splitFill(fill);
  const [gradient, setGradient] = useState(false);
  const set = (p: Partial<typeof parts>): void => f.set({ fill: joinFill({ ...parts, ...p }) });
  const bgHex = colorHex(f.wb, parts.bg);
  return (
    <div className="xl-fc-fill">
      <div>
        <label className="xl-fc-label">{FC.background}</label>
        <ColorPalette value={bgHex} emptyMode="none" onPick={(c) => set({ bg: c ? hexColor(c) : null })} />
        <div className="xl-fc-fillbtns">
          <Button onClick={() => setGradient(true)}>{FC.fillEffects}</Button>
        </div>
      </div>
      <div>
        <div className="xl-form">
          <label>{FC.patternColor}</label>
          <ColorPicker label={FC.patternColor} showLabel value={colorHex(f.wb, parts.patternColor)} onChange={(c) => set({ patternColor: c ? hexColor(c) : null, pattern: parts.pattern === 'none' && c ? 'darkGrid' : parts.pattern })} />
        </div>
        <label className="xl-fc-label">{FC.patternStyle}</label>
        <div className="xl-fc-patterns" role="listbox" aria-label={FC.patternStyle}>
          {PATTERNS.map((p) => (
            <button key={p} type="button" role="option" aria-selected={parts.pattern === p} title={FC.patterns[p]} aria-label={FC.patterns[p]} className={parts.pattern === p ? 'is-active' : ''} onClick={() => set({ pattern: p })}>
              <FillPreview fill={p === 'none' ? { type: 'pattern', pattern: 'none' } : joinFill({ bg: null, pattern: p, patternColor: null })} wb={f.wb} width={28} height={20} label={FC.patterns[p]} />
            </button>
          ))}
        </div>
        <label className="xl-fc-label">{FC.sample}</label>
        <FillPreview fill={fill} wb={f.wb} width={200} height={70} />
      </div>
      {gradient && <GradientDialog f={f} onClose={() => setGradient(false)} onApply={(g) => { f.set({ fill: g }); setGradient(false); }} />}
    </div>
  );
}
