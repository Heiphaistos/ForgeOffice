// Barre d'etat Office : informations a gauche, boutons d'affichage, curseur de zoom 10-500 % et pourcentage cliquable.
import { useRef, useState, type ReactNode } from 'react';
import { Icon } from '../icons/Icon.tsx';
import type { IconName } from '../icons/generated.ts';
import { S, percentLabel } from '../strings.ts';
import { ZOOM_PRESETS, clampZoom, sliderToZoom, stepZoom, zoomToSlider } from '../logic/zoom.ts';
import { Dialog } from './Dialog.tsx';
import { NumberField } from './Controls.tsx';
import { Tooltip } from './Tooltip.tsx';
import './StatusBar.css';

export interface StatusItem {
  id: string;
  label: string;
  icon?: IconName;
  /** Info-bulle ; un element cliquable devient un bouton. */
  title?: string;
  onClick?: () => void;
}

export interface StatusView {
  id: string;
  label: string;
  icon: IconName;
}

export interface ZoomPreset {
  label: string;
  /** Calcule le zoom au moment du choix (ex. « Largeur de page »). */
  compute: () => number;
}

export interface StatusBarProps {
  left?: readonly StatusItem[];
  right?: readonly StatusItem[];
  views?: readonly StatusView[];
  activeView?: string;
  onViewChange?: (id: string) => void;
  /** Zoom en %. Absent = pas de zoom. */
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  /** Choix supplementaires de la boite Zoom (Largeur de page, Page entiere...). */
  zoomPresets?: readonly ZoomPreset[];
  /** Contenu libre (ex. barre de progression d'enregistrement). */
  children?: ReactNode;
  /** Clic droit sur la barre (menu de personnalisation). Absent = menu du navigateur. */
  onContextMenu?: (e: { clientX: number; clientY: number; preventDefault: () => void }) => void;
}

function Item({ item }: { item: StatusItem }) {
  const content = (
    <>
      {item.icon && <Icon name={item.icon} size={16} />}
      <span>{item.label}</span>
    </>
  );
  if (!item.onClick) return <span className="fo-sb__item" title={item.title}>{content}</span>;
  return (
    <button type="button" className="fo-sb__item fo-sb__item--btn" title={item.title} onClick={item.onClick}>
      {content}
    </button>
  );
}

function ZoomSlider({ zoom, onChange }: { zoom: number; onChange: (z: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const fromPointer = (clientX: number): void => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    const z = sliderToZoom((clientX - r.left) / r.width);
    // aimantation sur 100 %
    onChange(Math.abs(z - 100) <= 4 ? 100 : z);
  };
  const pos = zoomToSlider(zoom) * 100;
  return (
    <div
      ref={trackRef}
      className="fo-sb__slider"
      role="slider"
      tabIndex={0}
      aria-label={S.statusBar.zoom}
      aria-valuemin={10}
      aria-valuemax={500}
      aria-valuenow={zoom}
      aria-valuetext={percentLabel(zoom)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        fromPointer(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(stepZoom(zoom, 1));
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(stepZoom(zoom, -1));
        else if (e.key === 'Home') onChange(10);
        else if (e.key === 'End') onChange(500);
        else return;
        e.preventDefault();
      }}
    >
      <span className="fo-sb__rail" />
      <span className="fo-sb__mid" />
      <span className="fo-sb__thumb" style={{ left: `${pos}%` }} />
    </div>
  );
}

function ZoomDialog({ zoom, onClose, onApply, presets }: { zoom: number; onClose: () => void; onApply: (z: number) => void; presets: readonly ZoomPreset[] }) {
  const [value, setValue] = useState(zoom);
  return (
    <Dialog open title={S.statusBar.zoomDialog} onClose={onClose} width={380} onConfirm={() => onApply(value)}>
      <fieldset className="fo-sb__zoomset">
        <legend>{S.statusBar.zoomTo}</legend>
        <div className="fo-sb__zoomgrid">
          {ZOOM_PRESETS.map((p) => (
            <label key={p} className="fo-sb__radio">
              <input type="radio" name="fo-zoom" checked={value === p} onChange={() => setValue(p)} />
              {percentLabel(p)}
            </label>
          ))}
          {presets.map((p) => (
            <label key={p.label} className="fo-sb__radio">
              <input type="radio" name="fo-zoom" onChange={() => setValue(clampZoom(p.compute()))} />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="fo-sb__zoomcustom">
        <span>{S.statusBar.percent}</span>
        <NumberField value={value} min={10} max={500} step={1} unit="%" width={96} label={S.statusBar.percent} onChange={(v) => setValue(clampZoom(v))} />
      </div>
    </Dialog>
  );
}

export function StatusBar({ left = [], right = [], views = [], activeView, onViewChange, zoom, onZoomChange, zoomPresets = [], children, onContextMenu }: StatusBarProps) {
  const [dialog, setDialog] = useState(false);
  return (
    <footer className="fo-sb" role="status" aria-label={S.statusBar.label} onContextMenu={onContextMenu}>
      <div className="fo-sb__left">
        {left.map((item) => (
          <Item key={item.id} item={item} />
        ))}
        {children}
      </div>
      <div className="fo-sb__right">
        {right.map((item) => (
          <Item key={item.id} item={item} />
        ))}
        {views.length > 0 && (
          <div className="fo-sb__views" role="radiogroup" aria-label={S.statusBar.views}>
            {views.map((v) => (
              <Tooltip key={v.id} content={{ title: v.label }} placement="above">
                <button type="button" role="radio" aria-checked={v.id === activeView} aria-label={v.label} className={`fo-sb__view${v.id === activeView ? ' is-active' : ''}`} onClick={() => onViewChange?.(v.id)}>
                  <Icon name={v.icon} size={16} filled={v.id === activeView} />
                </button>
              </Tooltip>
            ))}
          </div>
        )}
        {zoom !== undefined && onZoomChange && (
          <div className="fo-sb__zoom">
            <button type="button" className="fo-sb__zbtn" aria-label={S.statusBar.zoomOut} title={S.statusBar.zoomOut} onClick={() => onZoomChange(stepZoom(zoom, -1))}>
              <Icon name="subtract" size={12} />
            </button>
            <ZoomSlider zoom={zoom} onChange={onZoomChange} />
            <button type="button" className="fo-sb__zbtn" aria-label={S.statusBar.zoomIn} title={S.statusBar.zoomIn} onClick={() => onZoomChange(stepZoom(zoom, 1))}>
              <Icon name="add" size={12} />
            </button>
            <button type="button" className="fo-sb__pct" title={S.statusBar.zoomDialog} onClick={() => setDialog(true)}>
              {percentLabel(zoom)}
            </button>
          </div>
        )}
      </div>
      {dialog && zoom !== undefined && onZoomChange && (
        <ZoomDialog
          zoom={zoom}
          presets={zoomPresets}
          onClose={() => setDialog(false)}
          onApply={(z) => {
            setDialog(false);
            onZoomChange(z);
          }}
        />
      )}
    </footer>
  );
}
