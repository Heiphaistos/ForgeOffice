// Onglet Bordure : 13 styles de trait, couleur, presélections (Aucune, Contour, Intérieur), 8 boutons de bord, aperçu cliquable.
import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import { ColorPicker } from '@forgeoffice/ui';
import type { BorderEdge, BorderStyle } from '@forgeoffice/xlsx';
import { BORDER_STYLES, shownBorders, type BorderKey, type BorderSpec } from '../../../logic/border-spec.ts';
import { FC } from '../../../strings/index.ts';
import { colorHex, hexColor, type FormatCtx } from './state.ts';

const DASH: Partial<Record<BorderStyle, string>> = {
  hair: '1 1', dotted: '2 2', dashed: '5 2', mediumDashed: '6 2', dashDot: '5 2 1 2', mediumDashDot: '6 2 2 2', dashDotDot: '5 2 1 2 1 2', mediumDashDotDot: '6 2 2 2 2 2', slantDashDot: '6 2 2 2',
};
const WIDTH: Partial<Record<BorderStyle, number>> = { medium: 2, mediumDashed: 2, mediumDashDot: 2, mediumDashDotDot: 2, slantDashDot: 2, thick: 3 };
const lineWidth = (s: BorderStyle): number => WIDTH[s] ?? 1;

function Stroke({ style, color, x1, y1, x2, y2 }: { style: BorderStyle; color: string; x1: number; y1: number; x2: number; y2: number }) {
  if (style === 'double') {
    const horiz = y1 === y2;
    const d = horiz ? [0, 2.5] : [2.5, 0];
    return (
      <>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1} />
        <line x1={x1 + d[0]!} y1={y1 + d[1]!} x2={x2 + d[0]!} y2={y2 + d[1]!} stroke={color} strokeWidth={1} />
      </>
    );
  }
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={lineWidth(style)} strokeDasharray={DASH[style]} />;
}

/** Pictogramme d'un bord : carre en pointilles avec le bord en trait plein. */
function Glyph({ k }: { k: BorderKey | 'all' | 'outline' | 'inside' | 'none' }) {
  const g = { stroke: 'var(--fo-text)', strokeWidth: 2 };
  const faint = { stroke: 'var(--fo-border)', strokeWidth: 1, strokeDasharray: '1 1' };
  const on = (key: string): boolean => k === key || (k === 'outline' && ['top', 'bottom', 'left', 'right'].includes(key)) || (k === 'inside' && ['innerH', 'innerV'].includes(key));
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="3" y="3" width="16" height="16" fill="none" {...faint} />
      <line x1="3" y1="11" x2="19" y2="11" {...(on('innerH') ? g : faint)} />
      <line x1="11" y1="3" x2="11" y2="19" {...(on('innerV') ? g : faint)} />
      <line x1="3" y1="3" x2="19" y2="3" {...(on('top') ? g : faint)} />
      <line x1="3" y1="19" x2="19" y2="19" {...(on('bottom') ? g : faint)} />
      <line x1="3" y1="3" x2="3" y2="19" {...(on('left') ? g : faint)} />
      <line x1="19" y1="3" x2="19" y2="19" {...(on('right') ? g : faint)} />
      {k === 'diagUp' && <line x1="3" y1="19" x2="19" y2="3" {...g} />}
      {k === 'diagDown' && <line x1="3" y1="3" x2="19" y2="19" {...g} />}
    </svg>
  );
}

const EDGE_ORDER_LEFT: readonly BorderKey[] = ['top', 'innerH', 'bottom', 'diagUp'];
const EDGE_ORDER_BOTTOM: readonly BorderKey[] = ['left', 'innerV', 'right', 'diagDown'];

// Zone d'apercu (coordonnees du SVG).
const BX = 14;
const BY = 10;
const BW = 172;
const BH = 100;

export function BorderTab({ f }: { f: FormatCtx }) {
  const { multiRow, multiCol } = f.state.view;
  const [style, setStyle] = useState<BorderStyle | 'none'>('thin');
  const [color, setColor] = useState<string | null>(null);
  const shown = shownBorders(f.state.view.border, f.edits.border ?? {});
  const available = (k: BorderKey): boolean => (k === 'innerH' ? multiRow : k === 'innerV' ? multiCol : true);
  const keys = (['top', 'bottom', 'left', 'right', 'innerH', 'innerV', 'diagUp', 'diagDown'] as const).filter(available);
  const edge = (): BorderEdge | null => (style === 'none' ? null : color ? { style, color: hexColor(color) } : { style });
  const toggle = (k: BorderKey): void => {
    const cur = shown[k];
    const next = edge();
    const same = cur && next && cur.style === next.style && JSON.stringify(cur.color ?? null) === JSON.stringify(next.color ?? null);
    f.setBorders({ [k]: same ? null : next });
  };
  const preset = (which: 'none' | 'outline' | 'inside'): void => {
    const patch: BorderSpec = {};
    const e = edge();
    if (which === 'none') for (const k of keys) patch[k] = null;
    else if (which === 'outline') for (const k of ['top', 'bottom', 'left', 'right'] as const) patch[k] = e;
    else for (const k of ['innerH', 'innerV'] as const) if (available(k)) patch[k] = e;
    f.setBorders(patch);
  };
  const onPreviewClick = (ev: ReactMouseEvent<SVGSVGElement>): void => {
    const box = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - box.left) / box.width) * 200;
    const y = ((ev.clientY - box.top) / box.height) * 120;
    const candidates: [BorderKey, number][] = [
      ['top', Math.abs(y - BY)], ['bottom', Math.abs(y - BY - BH)], ['left', Math.abs(x - BX)], ['right', Math.abs(x - BX - BW)],
      ...(multiRow ? [['innerH', Math.abs(y - BY - BH / 2)] as [BorderKey, number]] : []),
      ...(multiCol ? [['innerV', Math.abs(x - BX - BW / 2)] as [BorderKey, number]] : []),
    ];
    const best = candidates.reduce((a, b) => (b[1] < a[1] ? b : a));
    if (best[1] <= 9) toggle(best[0]);
  };
  const colorOf = (e: BorderEdge): string => colorHex(f.wb, e.color) ?? '#000000';
  const line = (k: BorderKey, x1: number, y1: number, x2: number, y2: number) => {
    const known = k in shown;
    const e = shown[k];
    if (!known) return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9AA0A6" strokeWidth={1} strokeDasharray="2 3" />;
    return e ? <Stroke key={k} style={e.style} color={colorOf(e)} x1={x1} y1={y1} x2={x2} y2={y2} /> : null;
  };
  const midY = BY + BH / 2;
  const midX = BX + BW / 2;
  return (
    <div className="xl-fc-border">
      <div className="xl-fc-border-left">
        <fieldset className="xl-fs">
          <legend>{FC.lineGroup}</legend>
          <label className="xl-fc-label">{FC.lineStyle}</label>
          <div className="xl-fc-lines" role="listbox" aria-label={FC.lineStyle}>
            <button type="button" role="option" aria-selected={style === 'none'} className={style === 'none' ? 'is-active' : ''} onClick={() => setStyle('none')}>{FC.noLine}</button>
            {BORDER_STYLES.map((s) => (
              <button key={s} type="button" role="option" aria-selected={style === s} title={FC.borderStyles[s]} className={style === s ? 'is-active' : ''} onClick={() => setStyle(s)}>
                <svg width="64" height="12" viewBox="0 0 64 12" aria-hidden="true"><Stroke style={s} color="currentColor" x1={2} y1={6} x2={62} y2={6} /></svg>
              </button>
            ))}
          </div>
          <label className="xl-fc-label">{FC.lineColor}</label>
          <ColorPicker label={FC.lineColor} showLabel value={color} onChange={setColor} />
        </fieldset>
      </div>
      <div className="xl-fc-border-right">
        <fieldset className="xl-fs">
          <legend>{FC.presets}</legend>
          <div className="xl-fc-presets">
            {(['none', 'outline', 'inside'] as const).map((p) => (
              <button key={p} type="button" className="xl-fc-glyph" disabled={p === 'inside' && !multiRow && !multiCol} onClick={() => preset(p)} title={p === 'none' ? FC.presetNone : p === 'outline' ? FC.presetOutline : FC.presetInside}>
                <Glyph k={p} />
                <span>{p === 'none' ? FC.presetNone : p === 'outline' ? FC.presetOutline : FC.presetInside}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="xl-fs">
          <legend>{FC.borderGroup}</legend>
          <div className="xl-fc-borderbox">
            <div className="xl-fc-btncol">
              {EDGE_ORDER_LEFT.map((k) => (
                <button key={k} type="button" className="xl-fc-glyph" disabled={!available(k)} aria-pressed={!!shown[k]} title={FC.borderNames[k]} aria-label={FC.borderNames[k]} data-edge={k} onClick={() => toggle(k)}><Glyph k={k} /></button>
              ))}
            </div>
            <svg className="xl-fc-bpreview" viewBox="0 0 200 120" width="200" height="120" onClick={onPreviewClick} role="img" aria-label={FC.preview}>
              <rect x={BX} y={BY} width={BW} height={BH} fill="var(--fo-bg-canvas)" stroke="var(--fo-border-subtle)" strokeDasharray="2 3" />
              {multiRow && <line x1={BX} y1={midY} x2={BX + BW} y2={midY} stroke="var(--fo-border-subtle)" strokeDasharray="2 3" />}
              {multiCol && <line x1={midX} y1={BY} x2={midX} y2={BY + BH} stroke="var(--fo-border-subtle)" strokeDasharray="2 3" />}
              <text x={BX + BW / 2} y={BY + BH / 2 + 4} textAnchor="middle" fontSize="12" fill="var(--fo-text-2)">{FC.textWord}</text>
              {keys.includes('diagUp') && line('diagUp', BX, BY + BH, BX + BW, BY)}
              {keys.includes('diagDown') && line('diagDown', BX, BY, BX + BW, BY + BH)}
              {multiRow && line('innerH', BX, midY, BX + BW, midY)}
              {multiCol && line('innerV', midX, BY, midX, BY + BH)}
              {line('top', BX, BY, BX + BW, BY)}
              {line('bottom', BX, BY + BH, BX + BW, BY + BH)}
              {line('left', BX, BY, BX, BY + BH)}
              {line('right', BX + BW, BY, BX + BW, BY + BH)}
            </svg>
            <div className="xl-fc-btnrow">
              {EDGE_ORDER_BOTTOM.map((k) => (
                <button key={k} type="button" className="xl-fc-glyph" disabled={!available(k)} aria-pressed={!!shown[k]} title={FC.borderNames[k]} aria-label={FC.borderNames[k]} data-edge={k} onClick={() => toggle(k)}><Glyph k={k} /></button>
              ))}
            </div>
          </div>
        </fieldset>
      </div>
      <p className="xl-fc-desc xl-fc-border-help">{FC.borderHelp}</p>
    </div>
  );
}
