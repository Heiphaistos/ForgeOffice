// Onglet Alignement : horizontal/vertical (libelles francais), retrait, orientation (cadran + degres), renvoi, ajuster, fusion, sens.
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Checkbox, NumberField } from '@forgeoffice/ui';
import type { HorizontalAlignment, VerticalAlignment } from '@forgeoffice/xlsx';
import { degreesToRotation, rotationToDegrees } from '../../../logic/format-edits.ts';
import { FC } from '../../../strings/index.ts';
import type { FormatCtx } from './state.ts';

const H_ORDER: readonly HorizontalAlignment[] = ['general', 'left', 'center', 'right', 'fill', 'justify', 'centerContinuous', 'distributed'];
const V_ORDER: readonly VerticalAlignment[] = ['top', 'center', 'bottom', 'justify', 'distributed'];
/** Alignements horizontaux qui acceptent un retrait. */
const INDENTABLE: ReadonlySet<HorizontalAlignment> = new Set(['left', 'right', 'distributed']);

/** Cadran d'orientation : demi-cercle a gauche, on clique ou on glisse pour choisir l'angle (-90 a 90 degres). */
function Dial({ degrees, onChange, label }: { degrees: number; onChange: (d: number) => void; label: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const at = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const dx = e.clientX - (box.left + box.width * 0.18);
    const dy = e.clientY - (box.top + box.height / 2);
    if (dx < 2 && Math.abs(dy) < 2) return;
    onChange(Math.round((-Math.atan2(dy, Math.max(dx, 0.001)) * 180) / Math.PI));
  };
  const rad = (degrees * Math.PI) / 180;
  const R = 52;
  return (
    <svg
      ref={ref} className="xl-fc-dial" width="120" height="120" viewBox="0 0 120 120" role="slider" aria-label={label} aria-valuemin={-90} aria-valuemax={90} aria-valuenow={degrees} tabIndex={0}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); at(e); }}
      onPointerMove={(e) => { if (e.buttons) at(e); }}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0;
        if (step) { e.preventDefault(); onChange(Math.max(-90, Math.min(90, degrees + step))); }
      }}
    >
      <path d="M 22 8 A 52 52 0 0 1 22 112" fill="none" stroke="var(--fo-border)" strokeWidth="1" />
      {[-90, -60, -45, -30, -15, 0, 15, 30, 45, 60, 90].map((d) => {
        const a = (d * Math.PI) / 180;
        return <circle key={d} cx={22 + R * Math.cos(a)} cy={60 - R * Math.sin(a)} r={d === 0 ? 2.5 : 1.8} fill="var(--fo-text-2)" />;
      })}
      <line x1="22" y1="60" x2={22 + R * Math.cos(rad)} y2={60 - R * Math.sin(rad)} stroke="var(--xl-accent)" strokeWidth="2" />
      <circle cx={22 + R * Math.cos(rad)} cy={60 - R * Math.sin(rad)} r="5" fill="var(--xl-accent)" />
      <text x="32" y="56" fontSize="11" textAnchor="start" fill="var(--fo-text-2)" transform={`rotate(${-degrees} 22 60)`}>{FC.textWord}</text>
    </svg>
  );
}

export function AlignTab({ f }: { f: FormatCtx }) {
  const h = f.get('h');
  const rot = f.get('rotation');
  const deg = rotationToDegrees(rot);
  const wrap = f.get('wrap');
  const merged = f.edits.merged ?? f.state.view.merged;
  return (
    <div className="xl-fc-align">
      <fieldset className="xl-fs">
        <legend>{FC.textAlign}</legend>
        <div className="xl-form">
          <label htmlFor="fc-h">{FC.horizontal}</label>
          <select id="fc-h" value={h} onChange={(e) => f.set({ h: e.target.value as HorizontalAlignment })}>
            {H_ORDER.map((k) => <option key={k} value={k}>{FC.hAlign[k]}</option>)}
          </select>
          <label htmlFor="fc-v">{FC.vertical}</label>
          <select id="fc-v" value={f.get('v')} onChange={(e) => f.set({ v: e.target.value as VerticalAlignment })}>
            {V_ORDER.map((k) => <option key={k} value={k}>{FC.vAlign[k]}</option>)}
          </select>
          <label>{FC.indent}</label>
          <NumberField value={f.get('indent')} min={0} max={250} width={80} label={FC.indent} disabled={!INDENTABLE.has(h)} onChange={(n) => f.set({ indent: n })} />
        </div>
      </fieldset>
      <fieldset className="xl-fs">
        <legend>{FC.orientation}</legend>
        <div className="xl-fc-orient">
          <Dial degrees={deg ?? 0} label={FC.orientation} onChange={(d) => f.set({ rotation: degreesToRotation(d) })} />
          <button type="button" className={`xl-fc-vert${rot === 255 ? ' is-active' : ''}`} aria-pressed={rot === 255} onClick={() => f.set({ rotation: rot === 255 ? 0 : 255 })}>
            {FC.vertical255}
          </button>
          <div className="xl-fc-deg">
            <NumberField value={deg ?? 0} min={-90} max={90} width={80} unit="°" label={FC.degreesLabel} disabled={rot === 255} onChange={(n) => f.set({ rotation: degreesToRotation(n) })} />
            <span>{FC.degrees}</span>
          </div>
        </div>
      </fieldset>
      <fieldset className="xl-fs">
        <legend>{FC.textControl}</legend>
        <Checkbox checked={wrap} mixed={f.isMixed('wrap')} onChange={(v) => f.set(v ? { wrap: true, shrink: false } : { wrap: false })} label={FC.wrap} />
        <Checkbox checked={f.get('shrink')} mixed={f.isMixed('shrink')} disabled={wrap} onChange={(v) => f.set({ shrink: v })} label={FC.shrink} />
        <Checkbox checked={merged} onChange={(v) => f.set({ merged: v })} label={FC.merge} />
      </fieldset>
      <fieldset className="xl-fs">
        <legend>{FC.direction}</legend>
        <div className="xl-form">
          <label htmlFor="fc-dir">{FC.directionLabel}</label>
          <select id="fc-dir" value={f.get('readingOrder')} onChange={(e) => f.set({ readingOrder: Number(e.target.value) })}>
            {FC.directions.map((label, i) => <option key={label} value={i}>{label}</option>)}
          </select>
        </div>
      </fieldset>
    </div>
  );
}
