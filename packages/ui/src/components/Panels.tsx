// Notifications (toasts), volet lateral redimensionnable, onglets de documents.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NOTICE_EVENT, type NoticeKind } from '@forgeoffice/core';
import { Icon } from '../icons/Icon.tsx';
import type { IconName } from '../icons/generated.ts';
import { S } from '../strings.ts';
import { Tooltip } from './Tooltip.tsx';
import './Panels.css';

interface Toast {
  id: number;
  message: string;
  kind: NoticeKind;
}

const TOAST_ICON: Record<NoticeKind, IconName> = { info: 'info', success: 'checkmark', warning: 'warning', error: 'error_circle' };
const TOAST_MS: Record<NoticeKind, number> = { info: 5000, success: 4000, warning: 7000, error: 9000 };

function isNotice(value: unknown): value is { message: string; kind?: NoticeKind } {
  return typeof value === 'object' && value !== null && typeof (value as { message?: unknown }).message === 'string';
}

/** Affiche les notifications envoyees par services.notify() (evenement NOTICE_EVENT). A monter une fois. */
export function Toaster({ max = 4 }: { max?: number }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  useEffect(() => {
    const timers = new Set<number>();
    const onNotice = (e: Event): void => {
      const detail = (e as CustomEvent<unknown>).detail;
      if (!isNotice(detail)) return;
      const kind: NoticeKind = detail.kind ?? 'info';
      const id = next.current++;
      setToasts((list) => [...list.slice(-(max - 1)), { id, message: detail.message, kind }]);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setToasts((list) => list.filter((t) => t.id !== id));
      }, TOAST_MS[kind]);
      timers.add(timer);
    };
    window.addEventListener(NOTICE_EVENT, onNotice);
    return () => {
      window.removeEventListener(NOTICE_EVENT, onNotice);
      for (const t of timers) window.clearTimeout(t);
    };
  }, [max]);
  return (
    <div className="fo-toasts" role="region" aria-label={S.toast.region}>
      {toasts.map((t) => (
        <div key={t.id} className={`fo-toast fo-toast--${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <Icon name={TOAST_ICON[t.kind]} size={20} filled />
          <span className="fo-toast__msg">{t.message}</span>
          <button type="button" className="fo-toast__close" aria-label={S.toast.dismiss} onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}>
            <Icon name="dismiss" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export interface TaskPaneProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  side?: 'left' | 'right';
  width: number;
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  /** Contenu a droite du titre (menu d'options du volet). */
  actions?: ReactNode;
}

/** Volet Office (Navigation, Styles, Format de la forme...) redimensionnable a la souris et au clavier. */
export function TaskPane({ title, onClose, children, side = 'right', width, onWidthChange, minWidth = 200, maxWidth = 640, actions }: TaskPaneProps) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const clamp = (w: number): number => Math.round(Math.min(maxWidth, Math.max(minWidth, w)));
  return (
    <aside className={`fo-pane fo-pane--${side}`} style={{ width }} aria-label={title}>
      <div
        className="fo-pane__grip"
        role="separator"
        aria-orientation="vertical"
        aria-label={S.taskPane.resize}
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { x: e.clientX, w: width };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const delta = side === 'right' ? s.x - e.clientX : e.clientX - s.x;
          onWidthChange(clamp(s.w + delta));
        }}
        onPointerUp={() => {
          start.current = null;
        }}
        onKeyDown={(e) => {
          const grow = side === 'right' ? 'ArrowLeft' : 'ArrowRight';
          const shrink = side === 'right' ? 'ArrowRight' : 'ArrowLeft';
          if (e.key === grow) onWidthChange(clamp(width + 16));
          else if (e.key === shrink) onWidthChange(clamp(width - 16));
          else return;
          e.preventDefault();
        }}
      />
      <div className="fo-pane__head">
        <h2>{title}</h2>
        {actions}
        {onClose && (
          <button type="button" className="fo-pane__close" aria-label={S.taskPane.close} title={S.taskPane.close} onClick={onClose}>
            <Icon name="dismiss" size={16} />
          </button>
        )}
      </div>
      <div className="fo-pane__body fo-scroll">{children}</div>
    </aside>
  );
}

export interface DocumentTab {
  id: string;
  label: string;
  modified?: boolean;
  icon?: IconName;
}

export interface DocumentTabsProps {
  tabs: readonly DocumentTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
  onNew?: () => void;
  /** Contenu en fin de rangee (ex. boutons de la fenetre). */
  end?: ReactNode;
}

/** Onglets de documents ouverts (plusieurs classeurs, documents...). Clic du milieu = fermer. */
export function DocumentTabs({ tabs, activeId, onSelect, onClose, onNew, end }: DocumentTabsProps) {
  return (
    <div className="fo-doctabs" role="tablist" aria-label={S.tabs.label} data-tauri-drag-region>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tab"
          aria-selected={t.id === activeId}
          tabIndex={t.id === activeId ? 0 : -1}
          className={`fo-doctab${t.id === activeId ? ' is-active' : ''}`}
          onClick={() => onSelect(t.id)}
          onAuxClick={(e) => {
            if (e.button === 1) onClose?.(t.id);
          }}
          onKeyDown={(e) => {
            const i = tabs.findIndex((x) => x.id === t.id);
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
              if (n) onSelect(n.id);
            } else if (e.key === 'Delete' && onClose) onClose(t.id);
          }}
        >
          {t.icon && <Icon name={t.icon} size={16} />}
          <span className="fo-doctab__label">{t.label}</span>
          {t.modified && <span className="fo-doctab__dot" aria-label={S.tabs.modified} />}
          {onClose && (
            <button
              type="button"
              className="fo-doctab__close"
              aria-label={`${S.tabs.close} ${t.label}`}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onClose(t.id);
              }}
            >
              <Icon name="dismiss" size={12} />
            </button>
          )}
        </div>
      ))}
      {onNew && (
        <Tooltip content={{ title: S.tabs.add }}>
          <button type="button" className="fo-doctabs__add" aria-label={S.tabs.add} onClick={onNew}>
            <Icon name="add" size={16} />
          </button>
        </Tooltip>
      )}
      {end && <div className="fo-doctabs__end">{end}</div>}
    </div>
  );
}
